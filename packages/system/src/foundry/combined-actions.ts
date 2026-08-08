import {
  combinedActionBonus,
  combinedActionRoles,
  formatPipScore,
  validateCombinedActionAllocation,
  type D6CombinedActionCandidate,
  type D6RollInvocationOptionsV1,
} from "@d6-system-2e/core";
import { runD6ActiveGmTask } from "../application/active-gm-tasks";
import { SYSTEM_ID } from "../constants";
import { currentConfiguredRulesProfile } from "../settings/rules-profile-library";
import { booleanSetting } from "../settings/setting-values";
import { currentCombinedPipScore } from "../settings/pip-rules";
import { TYFUSIUS_HOMEBREW_SETTING_KEYS } from "../settings/settings-catalog";
import {
  activeNonGmOwners,
  requestCombinedActorRoll,
  type RequestedRollConfiguration,
  type RequestedRollSubject,
} from "./roll-requests";
import {
  lockCombinedActionParticipants,
  unlockCombinedActionParticipants,
} from "./combined-action-state";
import { integer, record, stringValue } from "./sheets/values";

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
    readonly acknowledge: () => void;
    readonly resolve: (accepted: boolean) => void;
  }
>();
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
): Promise<boolean> {
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/roll/combined-action-consent.hbs`,
    message,
  );
  try {
    return (
      (await foundry.applications.api.DialogV2.wait<boolean>({
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
      })) === true
    );
  } finally {
    incomingConsentDialogs.delete(message.id);
  }
}

async function receiveConsent(value: unknown): Promise<void> {
  if (!value || typeof value !== "object" || !("type" in value)) return;
  const message = value as ConsentMessage;
  const currentUser = game.user;
  if (!currentUser) return;
  if (
    message.type === "combined-action-consent-ack" &&
    message.requesterUserId === currentUser.id
  ) {
    outgoingConsent.get(message.id)?.acknowledge();
    return;
  }
  if (
    message.type === "combined-action-consent-response" &&
    message.requesterUserId === currentUser.id
  ) {
    const pending = outgoingConsent.get(message.id);
    outgoingConsent.delete(message.id);
    pending?.resolve(message.accepted);
    return;
  }
  if (
    message.type === "combined-action-consent-cancel" &&
    message.targetUserId === currentUser.id
  ) {
    await incomingConsentDialogs.get(message.id)?.close();
    return;
  }
  if (
    message.type !== "combined-action-consent" ||
    message.targetUserId !== currentUser.id ||
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
  game.socket?.emit(`system.${SYSTEM_ID}`, {
    id: message.id,
    requesterUserId: message.requesterUserId,
    targetUserId: currentUser.id,
    type: "combined-action-consent-ack",
  } satisfies ConsentMessage);
  const accepted = await promptIncomingConsent(message);
  game.socket?.emit(`system.${SYSTEM_ID}`, {
    accepted,
    id: message.id,
    requesterUserId: message.requesterUserId,
    targetUserId: currentUser.id,
    type: "combined-action-consent-response",
  } satisfies ConsentMessage);
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
  const id = globalThis.crypto.randomUUID();
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
    game.socket?.emit(`system.${SYSTEM_ID}`, {
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
        acknowledge: () => {
          acknowledged = true;
          globalThis.clearTimeout(timer);
        },
        resolve: (accepted) => {
          globalThis.clearTimeout(timer);
          resolve(accepted);
        },
      });
      game.socket?.emit(`system.${SYSTEM_ID}`, request);
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

async function promptAllocations(
  actor: FoundryActorDocument,
  fallbackSubject: RequestedRollSubject,
  fallbackLabel: string,
  bonusScore: number,
  application: CombinedActionSetup["application"],
): Promise<readonly CombinedActionAllocation[] | null> {
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
            weaponId: weapon instanceof HTMLSelectElement ? weapon.value : "",
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
    validateCombinedActionAllocation(bonusScore, result.allocations);
  } catch {
    ui.notifications.warn(
      game.i18n.localize("D6E2.CombinedActions.AllocationInvalid"),
    );
    return null;
  }
  if (application === "combat") {
    const weapon = actor.items.get(result.weaponId);
    if (!weapon) return null;
    return [
      {
        label: `${weapon.name} · ${game.i18n.localize("D6E2.Combat.Attack")}`,
        score: result.allocations[0] ?? 0,
        subject: { itemId: weapon.id, kind: "weaponAttack" },
      },
      {
        label: `${weapon.name} · ${game.i18n.localize("D6E2.Item.Damage")}`,
        score: result.allocations[1] ?? 0,
        subject: { itemId: weapon.id, kind: "weaponDamage" },
      },
    ];
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
      commandClass: context.commandSucceeded === false ? "has-failed" : "",
    },
  );
  await ChatMessage.create({
    content,
    flags: { [SYSTEM_ID]: { combinedAction: structuredClone(context) } },
  });
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
  const groupId = globalThis.crypto.randomUUID();
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
      participantNames: participants.map(({ actor }) => actor.name).join(", "),
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
}

export function registerCombinedActionSocket(): void {
  game.socket?.on(`system.${SYSTEM_ID}`, (value: unknown) => {
    void receiveConsent(value);
  });
}

export function resetCombinedActionsForTests(): void {
  outgoingConsent.clear();
  incomingConsentDialogs.clear();
}
