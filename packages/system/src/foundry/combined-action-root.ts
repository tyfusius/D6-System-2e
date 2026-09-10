import type { D6RollRequestV1, D6RollResultV1 } from "@d6-system-2e/core";
import { appendD6InitiatingActionResult } from "../application/initiating-action-results";
import {
  claimCombinedRootStep,
  parseCombinedActionRoot,
  recordCombinedRootStep,
  replaceCombinedRootStep,
  type CombinedActionRoot,
} from "../application/combined-action-root";
import { currentConfiguredRulesProfile } from "../settings/rules-profile-library";
import {
  currentSuccessRuntimeStrategy,
  currentWildDieRuntimeStrategy,
} from "../settings/roll-outcome";
import { booleanSetting, numberSetting } from "../settings/setting-values";
import { TYFUSIUS_HOMEBREW_SETTING_KEYS as K } from "../settings/settings-catalog";
import {
  persistFreeD6FeatureRollAudit,
  privacySafeFreeD6FeatureRollResult,
} from "./free-d6-feature-service";
import { privacySafeDistinctionRollResult } from "./distinction-automation-service";
import { SYSTEM_ID } from "../constants";
import { foundryRandomId } from "./foundry-random-id";
import {
  appendD6InitiatingActionPresentation,
  hydrateD6FoundryRolls,
  initiatingActionVisibilityIntersection,
  serializeD6FoundryRolls,
  type D6SerializedFoundryRollV1,
} from "./initiating-action-message";
import {
  rollAttribute,
  rollSkill,
  retryD6MatchingResultReward,
  d6RollMessageFlags,
} from "./rolls/roll-service";
import type { D6RollInvocationOptionsV1 } from "@d6-system-2e/core";
import type { CombinedRootSubject } from "../application/combined-action-root";

type Operation =
  | "claim"
  | "record"
  | "follow-up-claim"
  | "follow-up-release"
  | "matching-reward";
export const COMBINED_ROOT_FLAG = "combinedActionRoot";
export interface CombinedRootBinding {
  readonly rootMessageId: string;
  readonly coordinatorId: string;
}
const tails = new Map<string, Promise<unknown>>();
const evaluated = new Map<
  string,
  {
    result: D6RollResultV1;
    artifacts: readonly D6SerializedFoundryRollV1[];
    auditResult: D6RollResultV1;
  }
>();
const replies = new Map<
  string,
  { coordinatorId: string; resolve(): void; reject(error: Error): void }
>();
let render: (root: CombinedActionRoot) => Promise<string> = () =>
  Promise.resolve("");
export function setCombinedRootRenderer(renderer: typeof render): void {
  render = renderer;
}
export function combinedRoot(
  message: FoundryChatMessageDocument,
): CombinedActionRoot | null {
  const root = parseCombinedActionRoot(
    message.getFlag(SYSTEM_ID, COMBINED_ROOT_FLAG),
  );
  return root?.rootMessageId === message.id ? root : null;
}
export function combinedRootCoordinator(
  root: CombinedActionRoot,
): FoundryUser | undefined {
  const previous = game.users?.get(root.coordinatorId);
  return previous?.active && previous.isGM
    ? previous
    : game.users?.contents
        .filter((u) => u.active && u.isGM)
        .sort((a, b) => a.id.localeCompare(b.id))[0];
}
export function requireCombinedRootAuthority(
  message: FoundryChatMessageDocument,
): CombinedActionRoot {
  const root = combinedRoot(message);
  if (
    !root ||
    game.messages?.get(message.id) !== message ||
    game.user?.isGM !== true ||
    combinedRootCoordinator(root)?.id !== game.user.id
  )
    throw new Error("D6E2.CombinedActions.Root.Authority");
  return root;
}
export async function writeCombinedRoot(
  message: FoundryChatMessageDocument,
  root: CombinedActionRoot,
  extra: Record<string, unknown> = {},
): Promise<void> {
  requireCombinedRootAuthority(message);
  await message.update({
    ...extra,
    content: await render(root),
    [`flags.${SYSTEM_ID}.${COMBINED_ROOT_FLAG}`]: structuredClone(root),
  });
}
export function mutateCombinedRoot<T>(
  message: FoundryChatMessageDocument,
  fn: (root: CombinedActionRoot) => Promise<T>,
): Promise<T> {
  const task = (tails.get(message.id) ?? Promise.resolve())
    .catch(() => undefined)
    .then(() => fn(requireCombinedRootAuthority(message)));
  tails.set(message.id, task);
  void task
    .finally(() => {
      if (tails.get(message.id) === task) tails.delete(message.id);
    })
    .catch(() => undefined);
  return task;
}
export async function repairCombinedRootPresentation(
  message: FoundryChatMessageDocument,
  root = requireCombinedRootAuthority(message),
): Promise<void> {
  for (const step of root.steps) {
    if (step.status !== "recorded") continue;
    const entry = root.results.entries.find((e) => e.appendId === step.id);
    if (!entry || !step.artifacts)
      throw new Error("D6E2.CombinedActions.Root.Invalid");
    await appendD6InitiatingActionPresentation({
      message,
      ledger: root.results,
      entry,
      artifacts: await hydrateD6FoundryRolls(step.artifacts),
    });
  }
}
async function processOperation(
  binding: CombinedRootBinding,
  id: string,
  operation: Operation,
  payload: unknown,
  senderId: string,
): Promise<void> {
  const message = game.messages?.get(binding.rootMessageId);
  if (!message) throw new Error("D6E2.CombinedActions.Root.Deleted");
  await mutateCombinedRoot(message, async (root) => {
    const step = root.steps.find((s) => s.id === id);
    const sender = game.users?.get(senderId);
    const actor = step ? game.actors?.get(step.actorId) : undefined;
    if (
      !step ||
      !sender?.active ||
      !actor ||
      (root.cancelled && operation === "claim") ||
      binding.coordinatorId !== game.user?.id ||
      (!sender.isGM && !actor.testUserPermission(sender, "OWNER")) ||
      (sender.isGM
        ? sender.id !== game.user.id
        : ["claim", "record"].includes(operation) &&
          step.controllerId !== sender.id)
    )
      throw new Error("D6E2.CombinedActions.Root.Authority");
    if (!["claim", "record"].includes(operation)) {
      if (!step.result || step.status !== "recorded")
        throw new Error("D6E2.CombinedActions.Root.Invalid");
      const previous = root.followUps.find((f) => f.stepId === id) ?? {
        stepId: id,
      };
      let follow = previous;
      if (operation === "follow-up-claim") {
        if (previous.claimedBy)
          throw new Error("D6E2.CombinedActions.Root.Invalid");
        follow = { ...previous, claimedBy: senderId };
      } else if (operation === "follow-up-release") {
        if (previous.claimedBy !== senderId) return;
        const { claimedBy: _claimed, ...released } = previous;
        void _claimed;
        follow = released;
      } else {
        follow = {
          ...previous,
          matchingResult: await retryD6MatchingResultReward(
            actor,
            previous.matchingResult ?? step.result,
          ),
        };
      }
      await writeCombinedRoot(message, {
        ...root,
        revision: root.revision + 1,
        followUps: [...root.followUps.filter((f) => f.stepId !== id), follow],
      });
      return;
    }
    if (operation === "claim") {
      const request = privateSafe({
        request: payload as D6RollRequestV1,
      }).request;
      const next = claimCombinedRootStep(root, id, senderId, request, {
        profileId: currentConfiguredRulesProfile().id,
        successEvaluator: currentSuccessRuntimeStrategy().evaluator,
        wildPolicy: currentWildDieRuntimeStrategy().policy,
        wildTriumph: {
          automaticSuccess: booleanSetting(
            K.wildTriumphAutomaticSuccess,
            false,
          ),
          characterPointAward: numberSetting(
            K.wildTriumphCharacterPointAward,
            0,
          ),
          enabled: booleanSetting(K.wildTriumphEnabled, false),
          metaCurrencyAward: numberSetting(K.wildTriumphMetaCurrencyAward, 0),
          threshold: numberSetting(K.wildTriumphThreshold, 3),
        },
      });
      // Narrow visibility atomically before storing any potentially private input.
      await writeCombinedRoot(message, next, {
        ...initiatingActionVisibilityIntersection(message, request.rollMode),
      });
      return;
    }
    const raw =
      payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : {};
    const rawResult =
      raw.result && typeof raw.result === "object"
        ? (raw.result as Record<string, unknown>)
        : {};
    if (
      !Array.isArray(raw.artifacts) ||
      raw.artifacts.length === 0 ||
      raw.artifacts.length > 100 ||
      !Number.isFinite(rawResult.total)
    )
      throw new Error("D6E2.CombinedActions.Root.Invalid");
    const receipt = raw as unknown as {
      result: D6RollResultV1;
      artifacts: readonly D6SerializedFoundryRollV1[];
    };
    const artifacts = await hydrateD6FoundryRolls(receipt.artifacts);
    const faces = receipt.artifacts.flatMap((a) => a.evidence.faces);
    const ordinary = [
      ...receipt.result.baseFaces,
      ...(receipt.result.characterPointFaces ?? []),
    ];
    // Supplemental Wild Dice batches can be interleaved across multiple Wild Dice.
    // Keep the ordinary prefix exact, then compare the remaining Wild Die faces.
    if (
      JSON.stringify(faces.slice(0, ordinary.length)) !==
        JSON.stringify(ordinary) ||
      JSON.stringify(faces.slice(ordinary.length).sort()) !==
        JSON.stringify([...receipt.result.wildFaces].sort())
    )
      throw new Error("D6E2.ActionThread.RollArtifactInvalid");
    let next = recordCombinedRootStep(
      root,
      id,
      receipt.result,
      receipt.artifacts,
    );
    if (next !== root) {
      next = {
        ...next,
        results: appendD6InitiatingActionResult(next.results, {
          appendId: id,
          kind:
            step.options.context.stage === "command"
              ? "combined-action-command"
              : step.subject.kind === "weaponDamage"
                ? "ordinary-weapon-damage"
                : "combined-action-task",
          details: {
            actorId: step.actorId,
            label: step.label,
            total: receipt.result.total,
            bonusScore: step.options.bonusScore,
            penaltyScore: step.options.penaltyScore,
            ...(step.subject.kind === "weaponDamage"
              ? {
                  targetActorId:
                    root.combatDamage?.plan.scale.targetActorId ?? "",
                }
              : {}),
          },
          rollMode: receipt.result.request.rollMode,
          rolls: receipt.artifacts.map((a) => a.evidence),
        }),
      };
      const attackFlags =
        step.subject.kind === "weaponAttack"
          ? Object.fromEntries(
              Object.entries(d6RollMessageFlags(receipt.result)[SYSTEM_ID]).map(
                ([key, value]) => [`flags.${SYSTEM_ID}.${key}`, value],
              ),
            )
          : {};
      await writeCombinedRoot(message, next, attackFlags);
    }
    const entry = next.results.entries.find((e) => e.appendId === id);
    if (!entry) throw new Error("D6E2.CombinedActions.Root.Invalid");
    await appendD6InitiatingActionPresentation({
      message,
      ledger: next.results,
      entry,
      artifacts,
    });
  });
}
async function sendOperation(
  binding: CombinedRootBinding,
  id: string,
  operation: Operation,
  payload: unknown,
): Promise<void> {
  const parent = game.messages?.get(binding.rootMessageId);
  const root = parent ? combinedRoot(parent) : null;
  const coordinator = root ? combinedRootCoordinator(root) : undefined;
  const route = coordinator
    ? { ...binding, coordinatorId: coordinator.id }
    : binding;
  if (!game.user) throw new Error("D6E2.CombinedActions.Root.Authority");
  if (game.user.id === route.coordinatorId)
    return processOperation(route, id, operation, payload, game.user.id);
  const packetId = foundryRandomId();
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      replies.delete(packetId);
      reject(new Error("D6E2.CombinedActions.Root.Uncertain"));
    }, 10_000);
    replies.set(packetId, {
      coordinatorId: route.coordinatorId,
      resolve: () => {
        clearTimeout(timer);
        resolve();
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });
    game.socket?.emit(
      `system.${SYSTEM_ID}`,
      {
        type: "combined-root-operation",
        packetId,
        binding: route,
        id,
        operation,
        payload,
      },
      { recipients: [route.coordinatorId] },
    );
  });
}
export function registerCombinedRootSocket(): void {
  game.socket?.on(
    `system.${SYSTEM_ID}`,
    (value: unknown, senderId?: string) => {
      if (!value || typeof value !== "object" || !senderId) return;
      const packet = value as Record<string, unknown>;
      if (
        packet.type === "combined-root-reply" &&
        typeof packet.packetId === "string"
      ) {
        const pending = replies.get(packet.packetId);
        if (pending?.coordinatorId !== senderId) return;
        replies.delete(packet.packetId);
        if (typeof packet.error === "string")
          pending.reject(new Error(packet.error));
        else pending.resolve();
      }
      if (
        packet.type !== "combined-root-operation" ||
        typeof packet.packetId !== "string" ||
        typeof packet.id !== "string" ||
        ![
          "claim",
          "record",
          "follow-up-claim",
          "follow-up-release",
          "matching-reward",
        ].includes(String(packet.operation)) ||
        !packet.binding ||
        typeof packet.binding !== "object"
      )
        return;
      const binding = packet.binding as CombinedRootBinding;
      if (binding.coordinatorId !== game.user?.id || !game.user.isGM) return;
      void processOperation(
        binding,
        packet.id,
        packet.operation as Operation,
        packet.payload,
        senderId,
      )
        .then(
          () => undefined,
          () => "D6E2.CombinedActions.Root.Invalid",
        )
        .then((error) => {
          game.socket?.emit(
            `system.${SYSTEM_ID}`,
            {
              type: "combined-root-reply",
              packetId: packet.packetId,
              ...(error ? { error } : {}),
            },
            { recipients: [senderId] },
          );
        });
    },
  );
}
export async function executeCombinedRootRoll(
  actor: FoundryActorDocument,
  subject: CombinedRootSubject,
  options: D6RollInvocationOptionsV1,
  binding: CombinedRootBinding,
): Promise<D6RollResultV1 | null> {
  const id = options.requestedRoll?.requestId;
  if (!id || !options.combinedAction)
    throw new Error("D6E2.CombinedActions.Root.Invalid");
  const key = `${binding.rootMessageId}:${id}`;
  const saved = evaluated.get(key);
  if (saved) {
    if (actor.id !== saved.result.request.source.actorId)
      throw new Error("D6E2.CombinedActions.Root.Invalid");
    await persistFreeD6FeatureRollAudit(
      actor,
      binding.rootMessageId,
      saved.auditResult,
      id,
    );
    await sendOperation(binding, id, "record", {
      result: saved.result,
      artifacts: saved.artifacts,
    });
    return saved.result;
  }
  const internal = {
    ...options,
    suppressChatMessage: true,
    beforeDice: (request: D6RollRequestV1) =>
      sendOperation(binding, id, "claim", privateSafe({ request }).request),
    captureRollExecution: async (
      result: D6RollResultV1,
      artifacts: readonly FoundryRoll[],
    ) => {
      const receipt = {
        result: structuredClone(privateSafe(result)),
        artifacts: await serializeD6FoundryRolls(artifacts),
      };
      evaluated.set(key, { ...receipt, auditResult: result });
      await persistFreeD6FeatureRollAudit(
        actor,
        binding.rootMessageId,
        result,
        id,
      );
      await sendOperation(binding, id, "record", receipt);
    },
  };
  if (subject.kind === "weaponAttack") {
    const item = actor.items.get(subject.itemId);
    // Explosive placement and untargeted fallback remain in the existing entry
    // flow until their complete continuation contracts are composed.
    if (
      item?.type !== "weapon" ||
      item.system.weaponKind === "thrown-explosive"
    )
      throw new Error("D6E2.CombinedActions.Root.Invalid");
    const message = game.messages?.get(binding.rootMessageId);
    const intent = message ? combinedRoot(message)?.combatIntent : undefined;
    if (intent?.weaponId !== subject.itemId)
      throw new Error("D6E2.CombinedActions.Root.Invalid");
    const { rollCombinedWeaponAttack } = await import("./rolls/roll-service");
    return rollCombinedWeaponAttack(actor, subject.itemId, intent, internal);
  }
  if (subject.kind === "weaponDamage") {
    const message = game.messages?.get(binding.rootMessageId);
    const root = message ? combinedRoot(message) : null;
    const damage = root?.combatDamage;
    const attack = root?.steps.find(
      (step) => step.id === damage?.attackStepId,
    )?.result;
    if (!damage || !attack)
      throw new Error("D6E2.CombinedActions.Root.Invalid");
    const { rollSuccessfulWeaponAttackDamage } =
      await import("./rolls/roll-service");
    return rollSuccessfulWeaponAttackDamage(actor, attack, damage.plan, {
      ...internal,
      fixedRollMode: attack.request.rollMode,
    });
  }
  return subject.kind === "attribute"
    ? rollAttribute(actor, subject.attributeId, internal)
    : rollSkill(actor, subject.itemId, internal);
}

/** The ordinary Damage builder uses the parent's existing durable receipt path.
 * A saved result can finish the child state after reload without new dice. */
export async function executeCombinedRootDamage(
  message: FoundryChatMessageDocument,
  actor: FoundryActorDocument,
): Promise<D6RollResultV1 | null> {
  let root = requireCombinedRootAuthority(message);
  let step = root.steps.find(
    (candidate) => candidate.subject.kind === "weaponDamage",
  );
  if (step?.actorId !== actor.id)
    throw new Error("D6E2.CombinedActions.Root.Invalid");
  if (step.status === "recorded" && step.result) return step.result;
  if (step.status === "rolling" && !evaluated.has(`${message.id}:${step.id}`))
    throw new Error("D6E2.CombinedActions.Root.Uncertain");
  if (step.status === "pending" || step.status === "requested") {
    const id = step.id;
    await mutateCombinedRoot(message, async (latest) => {
      const pending = latest.steps.find((candidate) => candidate.id === id);
      if (!pending || latest.cancelled)
        throw new Error("D6E2.CombinedActions.Root.Invalid");
      if (!["pending", "requested"].includes(pending.status)) return;
      await writeCombinedRoot(message, {
        ...replaceCombinedRootStep(latest, {
          ...pending,
          status: "requested",
          controllerId: game.user?.id ?? "",
        }),
        coordinatorId: game.user?.id ?? latest.coordinatorId,
      });
    });
  }
  root = requireCombinedRootAuthority(message);
  step = root.steps.find((candidate) => candidate.id === step?.id);
  if (step?.status === "recorded" && step.result) return step.result;
  if (step?.status === "rolling" && !evaluated.has(`${message.id}:${step.id}`))
    throw new Error("D6E2.CombinedActions.Root.Uncertain");
  const mode = root.combatDamage?.attackRequest.rollMode;
  if (!step || step.status === "skipped" || !mode || mode === "selfroll")
    throw new Error("D6E2.CombinedActions.Root.Invalid");
  const result = await executeCombinedRootRoll(
    actor,
    step.subject,
    {
      combinedAction: step.options,
      requestedRoll: {
        requestId: step.id,
        requesterUserId: root.coordinatorId,
        requesterName: game.user?.name ?? "",
        recipientUserId: game.user?.id ?? "",
        rollMode: mode,
        visibility:
          mode === "publicroll"
            ? "public"
            : mode === "blindroll"
              ? "hidden"
              : "private",
      },
    },
    { rootMessageId: message.id, coordinatorId: root.coordinatorId },
  );
  if (!result)
    await mutateCombinedRoot(message, async (latest) => {
      const pending = latest.steps.find(
        (candidate) => candidate.id === step.id,
      );
      if (!latest.cancelled && pending?.status === "requested")
        await writeCombinedRoot(
          message,
          replaceCombinedRootStep(latest, { ...pending, status: "pending" }),
        );
    });
  if (result) {
    const saved = requireCombinedRootAuthority(message).steps.find(
      (candidate) => candidate.id === step.id,
    );
    if (saved?.status !== "recorded" || !saved.result)
      throw new Error("D6E2.CombinedActions.Root.Uncertain");
    return saved.result;
  }
  return null;
}
export function resetCombinedRootForTests(): void {
  tails.clear();
  evaluated.clear();
  replies.clear();
}

function privateSafe<T extends Pick<D6RollResultV1, "request">>(value: T): T {
  return privacySafeDistinctionRollResult(
    privacySafeFreeD6FeatureRollResult(value),
  );
}

export function combinedRootFollowUpPorts(
  message: FoundryChatMessageDocument,
  stepId: string,
) {
  const route = (operation: Operation) => {
    const root = combinedRoot(message);
    const gm = root ? combinedRootCoordinator(root) : undefined;
    if (!gm)
      return Promise.reject(new Error("D6E2.CombinedActions.Root.Authority"));
    return sendOperation(
      { rootMessageId: message.id, coordinatorId: gm.id },
      stepId,
      operation,
      {},
    );
  };
  return {
    claim: () =>
      route("follow-up-claim").then(
        () => true,
        () => false,
      ),
    release: () => route("follow-up-release"),
    retryReward: () => route("matching-reward"),
  };
}
