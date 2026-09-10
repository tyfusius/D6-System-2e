import {
  createCombinedActionRootState,
  currentCombinedRootStep,
  replaceCombinedRootStep,
  type CombinedActionRoot,
  type CombinedRootStep,
} from "../application/combined-action-root";
import {
  COMBINED_ROOT_FLAG,
  combinedRoot,
  combinedRootCoordinator,
  combinedRootFollowUpPorts,
  mutateCombinedRoot,
  registerCombinedRootSocket,
  repairCombinedRootPresentation,
  requireCombinedRootAuthority,
  setCombinedRootRenderer,
  writeCombinedRoot,
} from "./combined-action-root";
import {
  hasUnpresentedInitiatingActionResults,
  initiatingActionVisibilityIntersection,
} from "./initiating-action-message";
import {
  renderD6RollResult,
  buildWeaponAttackTargetContext,
} from "./rolls/roll-service";
import { bindD6EmbeddedRollActions } from "./rolls/chat-card-actions";
import { cancelRollRequest } from "./roll-requests";
import {
  combinedActionBonus,
  combinedActionRoles,
  formatPipScore,
  validateCombinedActionAllocation,
  type D6CombinedActionCandidate,
  type D6RollInvocationOptionsV1,
} from "@d6-system-2e/core";
import { runD6ActiveGmTask } from "../application/active-gm-tasks";
import { resolveD6PendingInteraction } from "../application/pending-interactions";
import { parseD6OrdinaryAttackThread } from "../application/ordinary-attack-thread";
import { composeCombinedCombatResults } from "../application/combined-combat-results";
import { synchronizeD6OrdinaryAttackThread } from "./rolls/ordinary-attack-thread";
import { SYSTEM_ID } from "../constants";
import { currentConfiguredRulesProfile } from "../settings/rules-profile-library";
import { booleanSetting } from "../settings/setting-values";
import { currentCombinedPipScore } from "../settings/pip-rules";
import { foundryRandomId } from "./foundry-random-id";
import { TYFUSIUS_HOMEBREW_SETTING_KEYS } from "../settings/settings-catalog";
import {
  activeNonGmOwners,
  requestCombinedActorRoll,
  type RequestedRollConfiguration,
  type RequestedRollSubject,
} from "./roll-requests";
import {
  combinedActionBlocksRoll,
  lockCombinedActionParticipants,
  unlockCombinedActionParticipants,
} from "./combined-action-state";
import { integer, record, stringValue } from "./sheets/values";
import { registerFoundryPendingInteraction } from "./pending-interactions";

const CONSENT_LIFETIME_MS = 5 * 60_000;
const CONSENT_ACK_TIMEOUT_MS = 5_000;
const CONSENT_VERSION = 1 as const;

interface CombinedActionSetup {
  readonly application: "combat" | "multiple" | "single";
  readonly actorIds: readonly string[];
  readonly difficulty: number;
  readonly leaderWorks: boolean;
}

interface CombinedActionAllocation {
  readonly label: string;
  readonly score: number;
  readonly subject: RequestedRollSubject;
}

type ConsentMessage =
  | {
      readonly actorId: string;
      readonly actorName: string;
      readonly createdAt: number;
      readonly expiresAt: number;
      readonly groupId: string;
      readonly id: string;
      readonly label: string;
      readonly requesterUserId: string;
      readonly targetUserId: string;
      readonly type: "combined-action-consent";
      readonly version: number;
    }
  | {
      readonly accepted: boolean;
      readonly id: string;
      readonly requesterUserId: string;
      readonly targetUserId: string;
      readonly type: "combined-action-consent-response";
    }
  | {
      readonly id: string;
      readonly requesterUserId: string;
      readonly targetUserId: string;
      readonly type: "combined-action-consent-ack";
    }
  | {
      readonly id: string;
      readonly requesterUserId: string;
      readonly targetUserId: string;
      readonly type: "combined-action-consent-cancel";
    };

const outgoingConsent = new Map<
  string,
  {
    readonly targetUserId: string;
    readonly acknowledge: () => void;
    readonly resolve: (accepted: boolean) => void;
  }
>();
const incomingConsentSenders = new Map<string, string>();
function emitConsent(message: ConsentMessage): void {
  const recipient = [
    "combined-action-consent",
    "combined-action-consent-cancel",
  ].includes(message.type)
    ? message.targetUserId
    : message.requesterUserId;
  game.socket?.emit(`system.${SYSTEM_ID}`, message, {
    recipients: [recipient],
  });
}
const incomingConsentDialogs = new Map<string, { close(): Promise<void> }>();

export function combinedActionsEnabled(): boolean {
  return (
    currentConfiguredRulesProfile().strategies.actionEconomy.startsWith(
      "d6e2.",
    ) &&
    booleanSetting(
      TYFUSIUS_HOMEBREW_SETTING_KEYS.secondEditionCombinedActions,
      false,
    )
  );
}

function compatibleSubject(
  actor: FoundryActorDocument,
  sourceActor: FoundryActorDocument,
  subject: RequestedRollSubject,
): RequestedRollSubject | null {
  if (subject.kind === "attribute") {
    return record(actor.system.attributes)[subject.attributeId]
      ? subject
      : null;
  }
  const source = sourceActor.items.get(subject.itemId);
  const key = stringValue(source?.system.key);
  if (!key) return null;
  const item = actor.items.contents.find(
    (candidate) =>
      candidate.type === "skill" && stringValue(candidate.system.key) === key,
  );
  return item ? { itemId: item.id, kind: "skill" } : null;
}

function poolScore(
  actor: FoundryActorDocument,
  subject: RequestedRollSubject,
): number {
  if (subject.kind === "attribute") {
    return integer(
      record(record(actor.system.attributes)[subject.attributeId]).score,
    );
  }
  const item = actor.items.get(subject.itemId);
  if (!item) return 0;
  if (["advanced", "psionic"].includes(stringValue(item.system.training))) {
    return integer(item.system.score);
  }
  const attribute = record(
    record(actor.system.attributes)[stringValue(item.system.attributeId)],
  );
  return currentCombinedPipScore(
    integer(attribute.score),
    integer(item.system.score),
  );
}

function candidate(
  actor: FoundryActorDocument,
  taskSubject: RequestedRollSubject,
): D6CombinedActionCandidate {
  const command = actor.items.contents.find(
    (item) =>
      item.type === "skill" && stringValue(item.system.key) === "command",
  );
  const commandAttribute = record(
    record(actor.system.attributes)[stringValue(command?.system.attributeId)],
  );
  return Object.freeze({
    actorId: actor.id,
    actorName: actor.name,
    commandScore: command
      ? currentCombinedPipScore(
          integer(commandAttribute.score),
          integer(command.system.score),
        )
      : 0,
    commandTrained: Boolean(command),
    perceptionScore: integer(
      record(record(actor.system.attributes).perception).score,
    ),
    taskScore: poolScore(actor, taskSubject),
  });
}

function activeActors(): readonly FoundryActorDocument[] {
  return Object.freeze(
    (game.actors?.contents ?? []).filter((actor) =>
      ["character", "creature", "npc"].includes(actor.type),
    ),
  );
}

async function promptSetup(
  sourceActor: FoundryActorDocument,
  subject: RequestedRollSubject,
  label: string,
): Promise<CombinedActionSetup | null> {
  const candidates = activeActors().flatMap((actor) => {
    const resolved = compatibleSubject(actor, sourceActor, subject);
    return resolved
      ? [
          {
            actor,
            checked: actor.id === sourceActor.id,
            scoreLabel: formatPipScore(poolScore(actor, resolved)),
          },
        ]
      : [];
  });
  if (candidates.length < 2) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.CombinedActions.NotEnoughCharacters"),
    );
    return null;
  }
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/roll/combined-action-dialog.hbs`,
    { candidates, label, sourceActor },
  );
  const result =
    await foundry.applications.api.DialogV2.wait<CombinedActionSetup | null>({
      buttons: [
        {
          action: "cancel",
          callback: () => null,
          class: "od6roll-cancel",
          label: game.i18n.localize("D6E2.Cancel"),
        },
        {
          action: "continue",
          callback: (_event, button) => {
            const form = button.form;
            if (!form) return null;
            const actorIds = Array.from(
              form.querySelectorAll<HTMLInputElement>(
                'input[name="actorId"]:checked',
              ),
            ).map(({ value }) => value);
            const difficultyControl = form.elements.namedItem("difficulty");
            const leaderWorksControl = form.elements.namedItem("leaderWorks");
            return {
              application: (() => {
                const control = form.elements.namedItem("application");
                const value =
                  control instanceof HTMLSelectElement
                    ? control.value
                    : "single";
                return value === "combat" || value === "multiple"
                  ? value
                  : "single";
              })(),
              actorIds,
              difficulty:
                difficultyControl instanceof HTMLInputElement
                  ? Math.max(
                      0,
                      Math.trunc(Number(difficultyControl.value) || 0),
                    )
                  : 0,
              leaderWorks:
                leaderWorksControl instanceof HTMLInputElement &&
                leaderWorksControl.checked,
            };
          },
          class: "od6roll-submit",
          default: true,
          icon: "fa-solid fa-people-group",
          label: game.i18n.localize("D6E2.CombinedActions.RequestAgreement"),
        },
      ],
      classes: ["d6e2", "od6roll-dialog", "d6-combined-action-dialog"],
      content,
      modal: true,
      position: { width: 540 },
      rejectClose: false,
      window: {
        icon: "fa-solid fa-people-group",
        title: game.i18n.localize("D6E2.CombinedActions.Title"),
      },
    });
  return result && typeof result === "object" ? result : null;
}

function consentConfiguration(
  actor: FoundryActorDocument,
): RequestedRollConfiguration {
  const owner = activeNonGmOwners(actor)[0];
  return {
    delivery: "open-roll-window",
    recipientUserId: owner?.id ?? game.user?.id ?? "",
    visibility: "public",
  };
}

async function promptIncomingConsent(
  message: Extract<ConsentMessage, { type: "combined-action-consent" }>,
): Promise<boolean | null> {
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/roll/combined-action-consent.hbs`,
    message,
  );
  try {
    return (
      (await foundry.applications.api.DialogV2.wait<boolean | null>({
        buttons: [
          {
            action: "decline",
            callback: () => false,
            class: "od6roll-cancel",
            label: game.i18n.localize("D6E2.CombinedActions.Decline"),
          },
          {
            action: "agree",
            callback: () => true,
            class: "od6roll-submit",
            default: true,
            icon: "fa-solid fa-handshake",
            label: game.i18n.localize("D6E2.CombinedActions.Agree"),
          },
        ],
        classes: ["d6e2", "od6roll-dialog", "d6-combined-action-consent"],
        content,
        modal: true,
        position: { width: 460 },
        rejectClose: false,
        render: (_event, dialog) => {
          incomingConsentDialogs.set(message.id, dialog);
        },
        window: {
          icon: "fa-solid fa-handshake",
          title: game.i18n.localize("D6E2.CombinedActions.AgreementTitle"),
        },
      })) ?? null
    );
  } finally {
    incomingConsentDialogs.delete(message.id);
  }
}

async function receiveConsent(
  value: unknown,
  senderId?: string,
): Promise<void> {
  if (!senderId) return;
  if (!value || typeof value !== "object" || !("type" in value)) return;
  const message = value as ConsentMessage;
  const currentUser = game.user;
  if (!currentUser) return;
  if (
    message.type === "combined-action-consent-ack" &&
    message.requesterUserId === currentUser.id
  ) {
    const pending = outgoingConsent.get(message.id);
    if (pending?.targetUserId !== senderId || message.targetUserId !== senderId)
      return;
    pending.acknowledge();
    return;
  }
  if (
    message.type === "combined-action-consent-response" &&
    message.requesterUserId === currentUser.id
  ) {
    const pending = outgoingConsent.get(message.id);
    if (
      pending?.targetUserId !== senderId ||
      message.targetUserId !== senderId ||
      typeof message.accepted !== "boolean"
    )
      return;
    outgoingConsent.delete(message.id);
    pending.resolve(message.accepted);
    return;
  }
  if (
    message.type === "combined-action-consent-cancel" &&
    message.targetUserId === currentUser.id
  ) {
    if (
      incomingConsentSenders.get(message.id) !== senderId ||
      message.requesterUserId !== senderId
    )
      return;
    incomingConsentSenders.delete(message.id);
    await incomingConsentDialogs.get(message.id)?.close();
    resolveD6PendingInteraction(message.id);
    return;
  }
  if (
    message.type !== "combined-action-consent" ||
    message.targetUserId !== currentUser.id ||
    message.requesterUserId !== senderId ||
    message.version !== CONSENT_VERSION ||
    message.expiresAt <= Date.now()
  ) {
    return;
  }
  const requester = game.users?.get(message.requesterUserId);
  const actor = game.actors?.get(message.actorId);
  if (
    !requester?.active ||
    !requester.isGM ||
    !actor?.isOwner ||
    currentUser.isGM
  ) {
    return;
  }
  incomingConsentSenders.set(message.id, senderId);
  emitConsent({
    id: message.id,
    requesterUserId: message.requesterUserId,
    targetUserId: currentUser.id,
    type: "combined-action-consent-ack",
  } satisfies ConsentMessage);
  await registerFoundryPendingInteraction(
    {
      actorId: actor.id,
      actorImg: actor.img,
      actorName: actor.name,
      controllerName: currentUser.name ?? currentUser.id,
      controllerUserId: currentUser.id,
      createdAt: message.createdAt,
      expiresAt: message.expiresAt,
      id: message.id,
      kind: "combined-action",
      label: message.label,
      onExpire: () => {
        emitConsent({
          accepted: false,
          id: message.id,
          requesterUserId: message.requesterUserId,
          targetUserId: currentUser.id,
          type: "combined-action-consent-response",
        } satisfies ConsentMessage);
      },
      reopen: async () => {
        const accepted = await promptIncomingConsent(message);
        if (accepted === null) return "dismissed";
        emitConsent({
          accepted,
          id: message.id,
          requesterUserId: message.requesterUserId,
          targetUserId: currentUser.id,
          type: "combined-action-consent-response",
        } satisfies ConsentMessage);
        return "resolved";
      },
      subjectLabel: actor.name,
    },
    { automaticEligible: true },
  );
}

async function requestConsent(
  actor: FoundryActorDocument,
  groupId: string,
  label: string,
): Promise<boolean> {
  const currentUser = game.user;
  if (!currentUser?.isGM) return false;
  const controller = activeNonGmOwners(actor)[0];
  if (!controller) return true;
  const id = foundryRandomId();
  const createdAt = Date.now();
  const expiresAt = createdAt + CONSENT_LIFETIME_MS;
  const request = {
    actorId: actor.id,
    actorName: actor.name,
    createdAt,
    expiresAt,
    groupId,
    id,
    label,
    requesterUserId: currentUser.id,
    targetUserId: controller.id,
    type: "combined-action-consent",
    version: CONSENT_VERSION,
  } satisfies ConsentMessage;
  const cancelRemote = (): Promise<void> => {
    outgoingConsent.get(id)?.resolve(false);
    outgoingConsent.delete(id);
    emitConsent({
      id,
      requesterUserId: currentUser.id,
      targetUserId: controller.id,
      type: "combined-action-consent-cancel",
    } satisfies ConsentMessage);
    return Promise.resolve();
  };
  const execute = (): Promise<boolean> =>
    new Promise((resolve, reject) => {
      let acknowledged = false;
      const timer = globalThis.setTimeout(() => {
        if (!acknowledged) {
          outgoingConsent.delete(id);
          reject(new Error("Combined-action consent was not acknowledged."));
        }
      }, CONSENT_ACK_TIMEOUT_MS);
      outgoingConsent.set(id, {
        targetUserId: controller.id,
        acknowledge: () => {
          acknowledged = true;
          globalThis.clearTimeout(timer);
        },
        resolve: (accepted) => {
          globalThis.clearTimeout(timer);
          resolve(accepted);
        },
      });
      emitConsent(request);
    });
  return runD6ActiveGmTask({
    actorId: actor.id,
    actorImg: actor.img,
    actorName: actor.name,
    cancelRemote,
    cancelValue: false,
    controllerName: controller.name ?? controller.id,
    controllerUserId: controller.id,
    createdAt,
    delivery: "open-roll-window",
    execute,
    expiresAt,
    id,
    kind: "combinedAction",
    label,
    subject: { id: groupId, kind: "skill" },
    takeOver: () => Promise.resolve(true),
  });
}

function commandSubject(actor: FoundryActorDocument): RequestedRollSubject {
  const command = actor.items.contents.find(
    (item) =>
      item.type === "skill" && stringValue(item.system.key) === "command",
  );
  return command
    ? { itemId: command.id, kind: "skill" }
    : { attributeId: "perception", kind: "attribute" };
}

async function promptCombatWeapon(
  actor: FoundryActorDocument,
): Promise<FoundryItemDocument | null> {
  const weapons = actor.items.contents.filter((item) => item.type === "weapon");
  if (weapons.length === 0) {
    ui.notifications.warn(game.i18n.localize("D6E2.CombinedActions.NoWeapon"));
    return null;
  }
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/roll/combined-action-weapon.hbs`,
    {
      primaryName: actor.name,
      weapons: weapons.map((item, index) => ({
        id: item.id,
        name: item.name,
        selected: index === 0,
      })),
    },
  );
  const result = await foundry.applications.api.DialogV2.wait<string | null>({
    buttons: [
      {
        action: "cancel",
        callback: () => null,
        class: "od6roll-cancel",
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "continue",
        callback: (_event, button) => {
          const control = button.form?.elements.namedItem("weaponId");
          return control instanceof HTMLSelectElement ? control.value : null;
        },
        class: "od6roll-submit",
        default: true,
        label: game.i18n.localize("D6E2.CombinedActions.Root.Continue"),
      },
    ],
    classes: ["d6e2", "od6roll-dialog", "d6-combined-allocation-dialog"],
    content,
    modal: true,
    position: { width: 500 },
    rejectClose: false,
    window: {
      icon: "fa-solid fa-crosshairs",
      title: game.i18n.localize("D6E2.CombinedActions.ChooseWeapon"),
    },
  });
  const weapon =
    typeof result === "string" ? actor.items.get(result) : undefined;
  return weapon?.type === "weapon" ? weapon : null;
}

async function promptAllocations(
  actor: FoundryActorDocument,
  fallbackSubject: RequestedRollSubject,
  fallbackLabel: string,
  bonusScore: number,
  application: CombinedActionSetup["application"],
  lockedWeaponId?: string,
): Promise<readonly CombinedActionAllocation[] | null> {
  const lockedWeapon = lockedWeaponId
    ? actor.items.get(lockedWeaponId)
    : undefined;
  if (lockedWeaponId && lockedWeapon?.type !== "weapon")
    throw new Error("D6E2.CombinedActions.Root.Invalid");
  const combatAllocations = (
    weapon: FoundryItemDocument,
    scores: readonly number[],
  ) => [
    {
      label: `${weapon.name} · ${game.i18n.localize("D6E2.Combat.Attack")}`,
      score: scores[0] ?? 0,
      subject: { itemId: weapon.id, kind: "weaponAttack" as const },
    },
    {
      label: `${weapon.name} · ${game.i18n.localize("D6E2.Item.Damage")}`,
      score: scores[1] ?? 0,
      subject: { itemId: weapon.id, kind: "weaponDamage" as const },
    },
  ];
  if (lockedWeapon && bonusScore === 0)
    return combatAllocations(lockedWeapon, [0, 0]);
  if (application === "single" || bonusScore === 0) {
    return [
      { label: fallbackLabel, score: bonusScore, subject: fallbackSubject },
    ];
  }
  const weapons = actor.items.contents
    .filter((item) => item.type === "weapon")
    .map((item) => ({ id: item.id, name: item.name }));
  if (application === "combat" && weapons.length === 0) {
    ui.notifications.warn(game.i18n.localize("D6E2.CombinedActions.NoWeapon"));
    return null;
  }
  const skills = actor.items.contents
    .filter((item) => item.type === "skill")
    .map((item) => ({ id: item.id, name: item.name }));
  if (application === "multiple" && skills.length === 0) return null;
  const initialSkillId =
    fallbackSubject.kind === "skill" ? fallbackSubject.itemId : skills[0]?.id;
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/roll/combined-action-allocation.hbs`,
    {
      bonusLabel: formatPipScore(bonusScore),
      bonusScore,
      combat: application === "combat",
      weaponLocked: Boolean(lockedWeapon),
      weaponId: lockedWeapon?.id ?? "",
      weaponName: lockedWeapon?.name ?? "",
      rows: Array.from({ length: 4 }, (_, index) => ({
        allocation: index === 0 ? bonusScore : 0,
        maximum: bonusScore,
        skills: skills.map((skill) => ({
          ...skill,
          selected: skill.id === initialSkillId,
        })),
        subjectId: initialSkillId,
      })),
      skills,
      weapons,
    },
  );
  const result = await foundry.applications.api.DialogV2.wait<{
    readonly allocations: readonly number[];
    readonly subjectIds: readonly string[];
    readonly weaponId: string;
  } | null>({
    buttons: [
      {
        action: "cancel",
        callback: () => null,
        class: "od6roll-cancel",
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "apply",
        callback: (_event, button) => {
          const form = button.form;
          if (!form) return null;
          const allocations = Array.from(
            form.querySelectorAll<HTMLInputElement>('input[name="allocation"]'),
          ).map((input) => Math.max(0, Math.trunc(Number(input.value) || 0)));
          const subjectIds = Array.from(
            form.querySelectorAll<HTMLSelectElement>(
              'select[name="subjectId"]',
            ),
          ).map((select) => select.value);
          const weapon = form.elements.namedItem("weaponId");
          return {
            allocations,
            subjectIds,
            weaponId:
              weapon instanceof HTMLSelectElement ||
              weapon instanceof HTMLInputElement
                ? weapon.value
                : "",
          };
        },
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-arrow-right",
        label: game.i18n.localize("D6E2.CombinedActions.ApplyAllocation"),
      },
    ],
    classes: ["d6e2", "od6roll-dialog", "d6-combined-allocation-dialog"],
    content,
    modal: true,
    position: { width: 500 },
    rejectClose: false,
    window: {
      icon: "fa-solid fa-code-branch",
      title: game.i18n.localize("D6E2.CombinedActions.AllocateTitle"),
    },
  });
  if (!result) return null;
  try {
    if (application === "combat" && result.allocations.length !== 2)
      throw new Error("D6E2.CombinedActions.AllocationInvalid");
    validateCombinedActionAllocation(bonusScore, result.allocations);
  } catch {
    ui.notifications.warn(
      game.i18n.localize("D6E2.CombinedActions.AllocationInvalid"),
    );
    return null;
  }
  if (application === "combat") {
    const weapon = lockedWeapon ?? actor.items.get(result.weaponId);
    if (
      weapon?.type !== "weapon" ||
      (lockedWeapon && result.weaponId !== lockedWeapon.id)
    )
      return null;
    return combatAllocations(weapon, result.allocations);
  }
  const allocations = result.allocations.flatMap((score, index) => {
    const skill = actor.items.get(result.subjectIds[index] ?? "");
    return skill && (score > 0 || index === 0)
      ? [
          {
            label: skill.name,
            score,
            subject: { itemId: skill.id, kind: "skill" as const },
          },
        ]
      : [];
  });
  return allocations.length > 0 ? allocations : null;
}

async function postSummary(context: Record<string, unknown>): Promise<void> {
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/roll/combined-action-result.hbs`,
    {
      ...context,
      showCommand: true,
      terminal: true,
      commandClass: context.commandSucceeded === false ? "has-failed" : "",
    },
  );
  await ChatMessage.create({
    content,
    flags: { [SYSTEM_ID]: { combinedAction: structuredClone(context) } },
  });
}

const runningRoots = new Set<string>();
function rootComplete(root: CombinedActionRoot): boolean {
  return (
    root.steps.length > 1 &&
    root.steps.every((step) => ["recorded", "skipped"].includes(step.status)) &&
    (root.version !== 2 || combatContinuationComplete(root))
  );
}
function combatContinuationComplete(root: CombinedActionRoot): boolean {
  const message = game.messages?.get(root.rootMessageId);
  const thread = message
    ? parseD6OrdinaryAttackThread(
        message.getFlag(SYSTEM_ID, "ordinaryAttackThread"),
      )
    : null;
  if (!thread) return false;
  try {
    composeCombinedCombatResults(root, thread);
  } catch {
    return false;
  }
  return (
    ["applied", "no-damage"].includes(thread.target.stage) &&
    thread.reactions.every(
      (reaction) =>
        ["applied", "no-damage"].includes(reaction.target.stage) &&
        !["pending", "rolling"].includes(reaction.attack.stage),
    )
  );
}
async function rootContent(root: CombinedActionRoot): Promise<string> {
  const command = root.steps[0];
  if (!command) throw new Error("D6E2.CombinedActions.Root.Invalid");
  const context = command.options.context;
  const result = command.result;
  const bonus = result
    ? combinedActionBonus(
        root.participantIds.length,
        result.total,
        context.commandDifficulty,
      )
    : undefined;
  const current = currentCombinedRootStep(root);
  const phase = root.cancelled
    ? "Cancelled"
    : rootComplete(root)
      ? "Complete"
      : current?.status === "rolling"
        ? "AwaitingEvidence"
        : root.version === 2 && root.steps.length > 1
          ? current?.subject.kind === "weaponDamage"
            ? "AwaitingDamage"
            : !current
              ? "AwaitingHealth"
              : "AwaitingRoll"
          : !current
            ? "Allocation"
            : "AwaitingRoll";
  return foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/roll/combined-action-result.hbs`,
    {
      root: true,
      rootId: root.rootMessageId,
      terminal: root.cancelled || rootComplete(root),
      phaseLabel: game.i18n.localize(`D6E2.CombinedActions.Root.${phase}`),
      nextLabel: current?.label ?? "",
      showCommand: Boolean(result),
      commandClass: bonus?.commandSucceeded === false ? "has-failed" : "",
      commandDifficulty: context.commandDifficulty,
      commandTotal: result?.total,
      commandSucceeded: bonus?.commandSucceeded,
      label:
        root.version === 2 ? (root.steps[1]?.label ?? root.label) : root.label,
      participantNames: root.participantNames,
      leaderName: context.leaderName,
      primaryName: context.primaryName,
      leaderWorks: context.commandPenaltyScore > 0,
      bonusLabel: bonus ? formatPipScore(bonus.finalBonusScore) : "",
      potentialBonusLabel: bonus
        ? formatPipScore(bonus.potentialBonusScore)
        : "",
      allocationLabel: root.steps
        .slice(1)
        .map(
          (step) => `${step.label} +${formatPipScore(step.options.bonusScore)}`,
        )
        .join(" · "),
      rollDetails: await Promise.all(
        root.steps
          .filter((step) => step.result)
          .map(async (step) => {
            const actor = game.actors?.get(step.actorId);
            const result =
              root.followUps.find((f) => f.stepId === step.id)
                ?.matchingResult ?? step.result;
            return {
              id: step.id,
              label: step.label,
              total: result?.total,
              content:
                actor && result ? await renderD6RollResult(actor, result) : "",
            };
          }),
      ),
      taskResults: root.steps
        .slice(1)
        .filter((step) => step.result)
        .map((step) => ({
          label: step.label,
          total: step.result?.total,
          bonus: formatPipScore(step.options.bonusScore),
        })),
    },
  );
}
async function releaseUnrolledRequest(
  message: FoundryChatMessageDocument,
  id: string,
): Promise<void> {
  await mutateCombinedRoot(message, async (root) => {
    const step = root.steps.find((s) => s.id === id);
    if (step?.status !== "requested" || root.cancelled) return;
    const { controllerId: _controller, ...pending } = step;
    void _controller;
    await writeCombinedRoot(
      message,
      replaceCombinedRootStep(root, { ...pending, status: "pending" }),
    );
  });
}
export async function continueCombinedActionRoot(
  message: FoundryChatMessageDocument,
): Promise<void> {
  if (runningRoots.has(message.id)) return;
  let root = requireCombinedRootAuthority(message);
  runningRoots.add(message.id);
  lockCombinedActionParticipants(root.groupId, root.participantIds);
  try {
    await mutateCombinedRoot(message, (current) =>
      repairCombinedRootPresentation(message, current),
    );
    for (;;) {
      root = requireCombinedRootAuthority(message);
      if (root.version === 2 && root.steps[1]?.result) {
        await synchronizeD6OrdinaryAttackThread(message);
        root = requireCombinedRootAuthority(message);
      }
      if (root.cancelled || rootComplete(root)) return;
      if (!combinedActionsEnabled())
        throw new Error("D6E2.CombinedActions.Root.Inactive");
      let step = currentCombinedRootStep(root);
      if (
        root.version === 2 &&
        root.steps.length > 1 &&
        (!step || step.subject.kind === "weaponDamage")
      )
        return;
      if (!step) {
        const command = root.steps[0];
        const primary = command
          ? game.actors?.get(command.options.context.primaryActorId)
          : undefined;
        if (!command?.result || !primary)
          throw new Error("D6E2.CombinedActions.Root.Invalid");
        const bonus = combinedActionBonus(
          root.participantIds.length,
          command.result.total,
          command.options.context.commandDifficulty,
        );
        const allocations = await promptAllocations(
          primary,
          root.primarySubject,
          root.label,
          bonus.finalBonusScore,
          root.application,
          root.combatIntent?.weaponId,
        );
        if (!allocations) return;
        await mutateCombinedRoot(message, async (latest) => {
          if (latest.cancelled || latest.steps.length !== 1)
            throw new Error("D6E2.CombinedActions.Root.Invalid");
          const tasks: CombinedRootStep[] = allocations.map(
            (allocation, index) => ({
              id:
                allocation.subject.kind === "weaponDamage" &&
                latest.version === 2
                  ? `ordinary:${message.id}:damage`
                  : `${root.groupId}-task-${index}`,
              actorId: primary.id,
              label: allocation.label,
              subject: allocation.subject,
              status: "pending",
              options: {
                bonusScore: allocation.score,
                penaltyScore: 0,
                context: {
                  ...command.options.context,
                  allocatedBonusScore: allocation.score,
                  stage: "task",
                },
              },
            }),
          );
          await writeCombinedRoot(message, {
            ...latest,
            revision: latest.revision + 1,
            steps: [...latest.steps, ...tasks],
            ...(latest.version === 2
              ? { combatDamageBonusScore: tasks[1]?.options.bonusScore ?? 0 }
              : {}),
          });
        });
        continue;
      }
      if (step.status === "rolling")
        throw new Error("D6E2.CombinedActions.Root.Uncertain");
      const actor = game.actors?.get(step.actorId);
      if (!actor) throw new Error("D6E2.CombinedActions.Root.Invalid");
      const configuration = consentConfiguration(actor);
      const stepId = step.id;
      await mutateCombinedRoot(message, async (latest) => {
        const pending = currentCombinedRootStep(latest);
        if (
          pending?.id !== stepId ||
          !["pending", "requested"].includes(pending.status)
        )
          throw new Error("D6E2.CombinedActions.Root.Invalid");
        await writeCombinedRoot(message, {
          ...replaceCombinedRootStep(latest, {
            ...pending,
            status: "requested",
            controllerId: configuration.recipientUserId,
          }),
          coordinatorId: game.user?.id ?? latest.coordinatorId,
        });
      });
      root = requireCombinedRootAuthority(message);
      step = currentCombinedRootStep(root);
      if (!step) continue;
      const outcome = await requestCombinedActorRoll(
        actor,
        step.subject,
        step.label,
        configuration,
        step.options,
        {
          rootMessageId: message.id,
          coordinatorId: root.coordinatorId,
          requestId: step.id,
        },
      );
      const recorded = combinedRoot(message)?.steps.find(
        (s) => s.id === stepId,
      );
      if (recorded?.status === "recorded") continue;
      if (outcome.status !== "rolled") {
        await releaseUnrolledRequest(message, stepId);
        return;
      }
      throw new Error("D6E2.CombinedActions.Root.Uncertain");
    }
  } finally {
    runningRoots.delete(message.id);
    const latest = combinedRoot(message);
    if (!latest || latest.cancelled || rootComplete(latest))
      unlockCombinedActionParticipants(root.groupId);
    if (latest && game.messages?.get(message.id) === message)
      await writeCombinedRoot(message, latest);
  }
}
export async function cancelCombinedActionRoot(
  message: FoundryChatMessageDocument,
): Promise<void> {
  const root = requireCombinedRootAuthority(message);
  await mutateCombinedRoot(message, async (latest) => {
    if (latest.cancelled) return;
    await writeCombinedRoot(message, {
      ...latest,
      cancelled: true,
      revision: latest.revision + 1,
    });
  });
  const step = currentCombinedRootStep(root);
  if (step) await cancelRollRequest(step.id);
  unlockCombinedActionParticipants(root.groupId);
  if (root.version === 2 && root.steps[1]?.result)
    await synchronizeD6OrdinaryAttackThread(message);
}
function rootFailure(error: unknown): void {
  ui.notifications.warn(
    game.i18n.localize(
      error instanceof Error
        ? error.message
        : "D6E2.CombinedActions.Root.Invalid",
    ),
  );
}
export async function startCombinedAction(
  sourceActor: FoundryActorDocument,
  sourceSubject: RequestedRollSubject,
  label: string,
): Promise<void> {
  if (!game.user?.isGM || !combinedActionsEnabled()) return;
  const setup = await promptSetup(sourceActor, sourceSubject, label);
  if (!setup) return;
  const participants = setup.actorIds.flatMap((actorId) => {
    const actor = game.actors?.get(actorId);
    const subject = actor
      ? compatibleSubject(actor, sourceActor, sourceSubject)
      : null;
    return actor && subject ? [{ actor, subject }] : [];
  });
  if (participants.length < 2) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.CombinedActions.NotEnoughCharacters"),
    );
    return;
  }
  const roles = combinedActionRoles(
    participants.map(({ actor, subject }) => candidate(actor, subject)),
  );
  if (participants.length > roles.capacity) {
    ui.notifications.warn(
      game.i18n.format("D6E2.CombinedActions.OverCapacity", {
        capacity: roles.capacity,
        leader: roles.leader.actorName,
      }),
    );
    return;
  }
  if (
    setup.application !== "combat" &&
    participants.some(({ actor }) =>
      combinedActionBlocksRoll(actor, "attribute"),
    )
  ) {
    ui.notifications.warn(game.i18n.localize("D6E2.CombinedActions.Root.Busy"));
    return;
  }
  const groupId = foundryRandomId();
  const consent = await Promise.all(
    participants.map(({ actor }) => requestConsent(actor, groupId, label)),
  );
  if (consent.some((accepted) => !accepted)) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.CombinedActions.AgreementRequired"),
    );
    return;
  }
  const leader = participants.find(
    ({ actor }) => actor.id === roles.leader.actorId,
  );
  const primary = participants.find(
    ({ actor }) => actor.id === roles.primaryWorker.actorId,
  );
  if (!leader || !primary) return;
  const combatWeapon =
    setup.application === "combat"
      ? await promptCombatWeapon(primary.actor)
      : null;
  if (setup.application === "combat" && !combatWeapon) return;
  const combatTarget =
    combatWeapon && combatWeapon.system.weaponKind !== "thrown-explosive"
      ? buildWeaponAttackTargetContext(primary.actor, combatWeapon)
          .selectedTarget
      : null;
  const combatIntent =
    combatWeapon && combatTarget
      ? {
          weaponId: combatWeapon.id,
          targetActorId: combatTarget.actorId,
          targetTokenId: combatTarget.id,
        }
      : undefined;
  if (
    combatIntent &&
    participants.some(({ actor }) =>
      combinedActionBlocksRoll(actor, "attribute"),
    )
  ) {
    ui.notifications.warn(game.i18n.localize("D6E2.CombinedActions.Root.Busy"));
    return;
  }
  const baseContext = {
    allocatedBonusScore: 0,
    commandDifficulty: setup.difficulty,
    commandPenaltyScore: setup.leaderWorks ? 3 : 0,
    groupId,
    leaderActorId: leader.actor.id,
    leaderName: leader.actor.name,
    participantCount: participants.length,
    primaryActorId: primary.actor.id,
    primaryName: primary.actor.name,
  } as const;
  // Unsupported explosive/untargeted intent retains the complete existing flow.
  if (setup.application === "combat" && !combatIntent) {
    lockCombinedActionParticipants(
      groupId,
      participants.map(({ actor }) => actor.id),
    );
    try {
      const commandOptions = {
        bonusScore: 0,
        context: { ...baseContext, stage: "command" as const },
        penaltyScore: setup.leaderWorks ? 3 : 0,
      } satisfies NonNullable<D6RollInvocationOptionsV1["combinedAction"]>;
      const command = await requestCombinedActorRoll(
        leader.actor,
        commandSubject(leader.actor),
        game.i18n.format("D6E2.CombinedActions.CommandLabel", { task: label }),
        consentConfiguration(leader.actor),
        commandOptions,
      );
      if (command.status !== "rolled" || command.total === undefined) return;
      const bonus = combinedActionBonus(
        participants.length,
        command.total,
        setup.difficulty,
      );
      const allocations = await promptAllocations(
        primary.actor,
        primary.subject,
        label,
        bonus.finalBonusScore,
        setup.application,
      );
      if (!allocations) return;
      const taskOutcomes = [];
      for (const allocation of allocations) {
        const taskOptions = {
          bonusScore: allocation.score,
          context: {
            ...baseContext,
            allocatedBonusScore: allocation.score,
            stage: "task" as const,
          },
          penaltyScore: 0,
        } satisfies NonNullable<D6RollInvocationOptionsV1["combinedAction"]>;
        const outcome = await requestCombinedActorRoll(
          primary.actor,
          allocation.subject,
          allocation.label,
          consentConfiguration(primary.actor),
          taskOptions,
        );
        taskOutcomes.push({ allocation, outcome });
        if (outcome.status !== "rolled") break;
      }
      await postSummary({
        allocationLabel: allocations
          .map(
            ({ label: allocationLabel, score }) =>
              `${allocationLabel} +${formatPipScore(score)}`,
          )
          .join(" · "),
        bonusLabel: formatPipScore(bonus.finalBonusScore),
        commandDifficulty: setup.difficulty,
        commandMargin: bonus.commandMargin,
        commandSucceeded: bonus.commandSucceeded,
        commandTotal: command.total,
        groupId,
        label,
        leaderName: leader.actor.name,
        leaderWorks: setup.leaderWorks,
        participantNames: participants
          .map(({ actor }) => actor.name)
          .join(", "),
        potentialBonusLabel: formatPipScore(bonus.potentialBonusScore),
        primaryName: primary.actor.name,
        taskCompleted:
          taskOutcomes.length === allocations.length &&
          taskOutcomes.every(({ outcome }) => outcome.status === "rolled"),
        taskTotal: taskOutcomes
          .flatMap(({ allocation, outcome }) =>
            outcome.total === undefined
              ? []
              : [`${allocation.label} ${outcome.total}`],
          )
          .join(" · "),
      });
    } finally {
      unlockCombinedActionParticipants(groupId);
    }
    return;
  }
  const rootLabel =
    combatIntent && combatWeapon
      ? `${combatWeapon.name} · ${game.i18n.localize("D6E2.Combat.Attack")}`
      : label;
  const message = await ChatMessage.create({
    content: await foundry.applications.handlebars.renderTemplate(
      `systems/${SYSTEM_ID}/templates/roll/combined-action-result.hbs`,
      {
        root: true,
        label: rootLabel,
        phaseLabel: game.i18n.localize(
          "D6E2.CombinedActions.Root.AwaitingRoll",
        ),
        leaderName: leader.actor.name,
        primaryName: primary.actor.name,
        participantNames: participants.map((p) => p.actor.name).join(", "),
      },
    ),
  });
  const root = createCombinedActionRootState({
    rootMessageId: message.id,
    groupId,
    coordinatorId: game.user.id,
    createdAt: Date.now(),
    label: rootLabel,
    application: setup.application,
    participantIds: participants.map((p) => p.actor.id),
    participantNames: participants.map((p) => p.actor.name).join(", "),
    primarySubject: combatIntent
      ? { kind: "weaponAttack", itemId: combatIntent.weaponId }
      : primary.subject,
    ...(combatIntent ? { combatIntent } : {}),
    steps: [
      {
        id: `${groupId}-command`,
        actorId: leader.actor.id,
        label: game.i18n.format("D6E2.CombinedActions.CommandLabel", {
          task: label,
        }),
        subject: commandSubject(leader.actor),
        status: "pending",
        options: {
          bonusScore: 0,
          context: { ...baseContext, stage: "command" },
          penaltyScore: setup.leaderWorks ? 3 : 0,
        },
      },
    ],
  });
  await message.update({
    ...(combatIntent && combatTarget?.hidden
      ? initiatingActionVisibilityIntersection(message, "gmroll")
      : {}),
    content: await rootContent(root),
    [`flags.${SYSTEM_ID}.${COMBINED_ROOT_FLAG}`]: structuredClone(root),
  });
  try {
    await continueCombinedActionRoot(message);
  } catch (error) {
    rootFailure(error);
  }
}

function synchronizeRootParticipants(
  message: FoundryChatMessageDocument,
): void {
  const root = combinedRoot(message);
  if (!root) return;
  if (root.cancelled || rootComplete(root))
    unlockCombinedActionParticipants(root.groupId);
  else lockCombinedActionParticipants(root.groupId, root.participantIds);
}
let lifecycleRegistered = false;
let socketRegistered = false;

/** Register before Foundry renders restored chat history. User/socket work stays
 * in ready, but the first chat render must receive role and once-only controls. */
export function registerCombinedActionLifecycle(): void {
  if (lifecycleRegistered) return;
  lifecycleRegistered = true;
  setCombinedRootRenderer(rootContent);
  for (const hook of ["createChatMessage", "updateChatMessage"])
    Hooks.on(hook, (value: unknown) =>
      synchronizeRootParticipants(value as FoundryChatMessageDocument),
    );
  Hooks.on("renderChatMessageHTML", (value: unknown, html: unknown) => {
    const message = value as FoundryChatMessageDocument;
    const root = combinedRoot(message);
    if (!root || !(html instanceof HTMLElement)) return;
    // Completed roots reuse stored content, so decorate their initial render too.
    // textContent preserves saved flags/receipts and treats Weapon names as text.
    const combatTitle = root.version === 2 ? root.steps[1]?.label : undefined;
    if (combatTitle) {
      const card = html.matches(".od6-combined-action-result")
        ? html
        : html.querySelector<HTMLElement>(".od6-combined-action-result");
      const heading = card?.querySelector<HTMLElement>(
        ":scope > header strong",
      );
      if (heading) heading.textContent = combatTitle;
    }
    if (root.cancelled || rootComplete(root))
      unlockCombinedActionParticipants(root.groupId);
    else lockCombinedActionParticipants(root.groupId, root.participantIds);
    for (const detail of Array.from(
      html.querySelectorAll<HTMLElement>("[data-combined-result-id]"),
    )) {
      const step = root.steps.find(
        (s) => s.id === detail.dataset.combinedResultId,
      );
      if (!step?.result) continue;
      const follow = root.followUps.find((f) => f.stepId === step.id);
      bindD6EmbeddedRollActions(
        message,
        detail,
        follow?.matchingResult ?? step.result,
        Boolean(follow?.claimedBy),
        combinedRootFollowUpPorts(message, step.id),
      );
    }
    for (const button of Array.from(
      html.querySelectorAll<HTMLButtonElement>("[data-combined-root-action]"),
    )) {
      const authorized =
        game.user?.isGM === true &&
        combinedRootCoordinator(root)?.id === game.user.id;
      button.hidden = !authorized;
      button.classList.toggle("od6-combined-root-visible", authorized);
      const terminal = root.cancelled || rootComplete(root);
      const repair = hasUnpresentedInitiatingActionResults(
        message,
        root.results,
      );
      button.disabled =
        !authorized ||
        (button.dataset.combinedRootAction === "cancel"
          ? terminal
          : runningRoots.has(message.id) || (terminal && !repair));
      if (
        terminal &&
        repair &&
        button.dataset.combinedRootAction === "continue"
      )
        button.textContent = game.i18n.localize(
          "D6E2.CombinedActions.Root.Repair",
        );
      button.addEventListener("click", () => {
        if (button.disabled) return;
        void (
          button.dataset.combinedRootAction === "cancel"
            ? cancelCombinedActionRoot(message)
            : continueCombinedActionRoot(message)
        ).catch(rootFailure);
      });
    }
    const article = html.matches(".od6-combined-action-result")
      ? html
      : html.querySelector(".od6-combined-action-result");
    article?.classList.add("od6-combined-actions-bound");
  });
  Hooks.on("deleteChatMessage", (value: unknown) => {
    const message = value as FoundryChatMessageDocument;
    const root = combinedRoot(message);
    if (!root) return;
    unlockCombinedActionParticipants(root.groupId);
    const step = currentCombinedRootStep(root);
    if (step && game.user?.isGM) void cancelRollRequest(step.id);
  });
}

export function registerCombinedActionSocket(): void {
  if (socketRegistered) return;
  socketRegistered = true;
  registerCombinedActionLifecycle();
  registerCombinedRootSocket();
  for (const message of game.messages?.contents ?? [])
    synchronizeRootParticipants(message);
  game.socket?.on(
    `system.${SYSTEM_ID}`,
    (value: unknown, senderId?: string) => {
      void receiveConsent(value, senderId);
    },
  );
}

export function resetCombinedActionsForTests(): void {
  lifecycleRegistered = false;
  socketRegistered = false;
  outgoingConsent.clear();
  incomingConsentDialogs.clear();
  incomingConsentSenders.clear();
  runningRoots.clear();
}
