import {
  resolveD6Roll,
  combinedActionBonus,
  validateCombinedActionAllocation,
  type ResolveD6RollInput,
  type D6RollInvocationOptionsV1,
  type D6RollRequestV1,
  type D6RollResultV1,
} from "@d6-system-2e/core";
import {
  createD6InitiatingActionResultLedger,
  parseD6InitiatingActionResultLedger,
  type D6InitiatingActionResultLedgerV1,
} from "./initiating-action-results";
import {
  bindCombinedCombatDamage,
  type CombinedCombatDamageBindingV1,
} from "./combined-combat-damage";

export type CombinedRootSubject =
  | { readonly kind: "attribute"; readonly attributeId: string }
  | {
      readonly kind: "skill" | "weaponAttack" | "weaponDamage";
      readonly itemId: string;
    };
export type CombinedRootRuntime = Pick<
  ResolveD6RollInput,
  "profileId" | "successEvaluator" | "wildPolicy" | "wildTriumph"
>;
export interface CombinedRootStep {
  readonly id: string;
  readonly actorId: string;
  readonly label: string;
  readonly subject: CombinedRootSubject;
  readonly options: NonNullable<D6RollInvocationOptionsV1["combinedAction"]>;
  readonly status: "pending" | "requested" | "rolling" | "recorded" | "skipped";
  readonly controllerId?: string;
  readonly request?: D6RollRequestV1;
  readonly runtime?: CombinedRootRuntime;
  readonly result?: D6RollResultV1;
  /** Opaque Foundry artifacts are stored by the adapter, never evaluated here. */
  readonly artifacts?: readonly unknown[];
}
export interface CombinedActionRoot {
  readonly version: 1 | 2;
  readonly rootMessageId: string;
  readonly groupId: string;
  readonly coordinatorId: string;
  readonly createdAt: number;
  readonly revision: number;
  readonly cancelled: boolean;
  readonly label: string;
  readonly application: "single" | "multiple" | "combat";
  readonly participantIds: readonly string[];
  readonly participantNames: string;
  readonly primarySubject: CombinedRootSubject;
  readonly steps: readonly CombinedRootStep[];
  readonly results: D6InitiatingActionResultLedgerV1;
  readonly combatIntent?: {
    readonly weaponId: string;
    readonly targetActorId: string;
    readonly targetTokenId: string;
  };
  readonly combatDamageBonusScore?: number;
  readonly combatDamage?: CombinedCombatDamageBindingV1;
  readonly followUps: readonly {
    readonly stepId: string;
    readonly claimedBy?: string;
    readonly matchingResult?: D6RollResultV1;
  }[];
}
export function createCombinedActionRootState(
  input: Omit<
    CombinedActionRoot,
    "version" | "revision" | "cancelled" | "results" | "followUps"
  >,
): CombinedActionRoot {
  return {
    ...input,
    version: input.application === "combat" ? 2 : 1,
    revision: 0,
    cancelled: false,
    followUps: [],
    results: createD6InitiatingActionResultLedger(
      input.rootMessageId,
      input.groupId,
    ),
  };
}
const object = (v: unknown): Record<string, unknown> | undefined =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
const text = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 512;
export function parseCombinedActionRoot(
  value: unknown,
): CombinedActionRoot | null {
  const v = object(value);
  if (
    (v?.version !== 1 && v?.version !== 2) ||
    !text(v.rootMessageId) ||
    !text(v.groupId) ||
    !text(v.coordinatorId) ||
    !text(v.label) ||
    !Number.isFinite(v.createdAt) ||
    !Number.isInteger(v.revision) ||
    Number(v.revision) < 0 ||
    typeof v.cancelled !== "boolean" ||
    !(v.version === 1
      ? ["single", "multiple"].includes(String(v.application))
      : v.application === "combat") ||
    !Array.isArray(v.followUps) ||
    !v.followUps.every((f) => object(f) && text(object(f)?.stepId)) ||
    !Array.isArray(v.participantIds) ||
    v.participantIds.length < 2 ||
    !v.participantIds.every(text) ||
    new Set(v.participantIds).size !== v.participantIds.length ||
    typeof v.participantNames !== "string" ||
    !subject(v.primarySubject) ||
    (v.version === 1 &&
      ["weaponAttack", "weaponDamage"].includes(
        String(object(v.primarySubject)?.kind),
      )) ||
    !Array.isArray(v.steps) ||
    v.steps.length < 1 ||
    !v.steps.every(step)
  )
    return null;
  if (
    v.version === 1
      ? v.combatIntent !== undefined ||
        v.combatDamageBonusScore !== undefined ||
        v.combatDamage !== undefined
      : !text(object(v.combatIntent)?.weaponId) ||
        !text(object(v.combatIntent)?.targetActorId) ||
        !text(object(v.combatIntent)?.targetTokenId) ||
        object(v.primarySubject)?.kind !== "weaponAttack" ||
        object(v.primarySubject)?.itemId !== object(v.combatIntent)?.weaponId ||
        ![1, 3].includes(v.steps.length) ||
        (v.steps.length === 1
          ? v.combatDamageBonusScore !== undefined ||
            v.combatDamage !== undefined
          : !Number.isSafeInteger(v.combatDamageBonusScore) ||
            Number(v.combatDamageBonusScore) < 0)
  )
    return null;
  const results = parseD6InitiatingActionResultLedger(v.results);
  if (
    results?.rootMessageId !== v.rootMessageId ||
    results.requestId !== v.groupId ||
    new Set(v.steps.map((s) => (s as CombinedRootStep).id)).size !==
      v.steps.length
  )
    return null;
  for (const [index, raw] of v.steps.entries()) {
    const s = raw as CombinedRootStep;
    if (
      !v.participantIds.includes(s.actorId) ||
      !v.participantIds.includes(s.options.context.leaderActorId) ||
      !v.participantIds.includes(s.options.context.primaryActorId) ||
      s.options.context.participantCount !== v.participantIds.length ||
      (index > 0 &&
        (v.steps[index - 1] as CombinedRootStep).status !== "recorded" &&
        s.status !== "pending") ||
      s.options.context.groupId !== v.groupId ||
      s.options.context.stage !== (index === 0 ? "command" : "task") ||
      (s.subject.kind === "weaponAttack" && (v.version !== 2 || index !== 1)) ||
      (v.version === 2 && index === 1 && s.subject.kind !== "weaponAttack") ||
      (s.subject.kind === "weaponDamage" && (v.version !== 2 || index !== 2)) ||
      (v.version === 2 &&
        index === 2 &&
        (s.subject.kind !== "weaponDamage" ||
          s.options.bonusScore !== v.combatDamageBonusScore ||
          s.id !== `ordinary:${v.rootMessageId}:damage`)) ||
      (s.status === "skipped" &&
        (v.version !== 2 ||
          index !== 2 ||
          (v.steps[1] as CombinedRootStep).result?.success !== false))
    )
      return null;
  }
  if (v.version === 2 && v.steps.length === 3) {
    const command = v.steps[0] as CombinedRootStep;
    const attack = v.steps[1] as CombinedRootStep;
    const damage = v.steps[2] as CombinedRootStep;
    if (
      !command.result ||
      command.status !== "recorded" ||
      attack.actorId !== command.options.context.primaryActorId ||
      damage.actorId !== attack.actorId ||
      damage.subject.kind !== "weaponDamage" ||
      attack.subject.kind !== "weaponAttack" ||
      damage.subject.itemId !== attack.subject.itemId ||
      attack.subject.itemId !== object(v.combatIntent)?.weaponId ||
      [attack, damage].some(
        (task) =>
          task.options.penaltyScore !== 0 ||
          stable(task.options.context) !==
            stable({
              ...command.options.context,
              stage: "task",
              allocatedBonusScore: task.options.bonusScore,
            }),
      ) ||
      (attack.result?.success === false && damage.status !== "skipped") ||
      (["requested", "rolling", "recorded"].includes(damage.status) &&
        attack.result?.success !== true)
    )
      return null;
    try {
      validateCombinedActionAllocation(
        combinedActionBonus(
          v.participantIds.length,
          command.result.total,
          command.options.context.commandDifficulty,
        ).finalBonusScore,
        [attack.options.bonusScore, damage.options.bonusScore],
      );
    } catch {
      return null;
    }
    if (["rolling", "recorded"].includes(attack.status)) {
      if (!attack.request) return null;
      try {
        const expected = bindCombinedCombatDamage(
          { ...v, cancelled: false } as unknown as CombinedActionRoot,
          attack,
          attack.request,
          Number(v.combatDamageBonusScore),
        );
        if (stable(v.combatDamage) !== stable(expected)) return null;
      } catch {
        return null;
      }
    } else if (v.combatDamage !== undefined) return null;
    if (damage.request) {
      try {
        validateCombinedDamageRequest(
          v as unknown as CombinedActionRoot,
          damage,
          damage.request,
        );
      } catch {
        return null;
      }
    }
  }
  const recorded = (v.steps as CombinedRootStep[]).filter(
    (s) => s.status === "recorded",
  );
  if (results.entries.length !== recorded.length) return null;
  for (const s of recorded) {
    const result = s.result;
    if (!result) return null;
    const entry = results.entries.find((e) => e.appendId === s.id);
    if (
      entry?.kind !==
        (s.options.context.stage === "command"
          ? "combined-action-command"
          : s.subject.kind === "weaponDamage"
            ? "ordinary-weapon-damage"
            : "combined-action-task") ||
      entry.details.actorId !== s.actorId ||
      entry.details.total !== result.total ||
      entry.rollMode !== result.request.rollMode ||
      stable(s.request) !== stable(result.request)
    )
      return null;
    try {
      validateCombinedRootResult(s, result);
    } catch {
      return null;
    }
  }
  const followUps = v.followUps as CombinedActionRoot["followUps"];
  if (new Set(followUps.map((f) => f.stepId)).size !== followUps.length)
    return null;
  for (const follow of followUps) {
    const parent = recorded.find((s) => s.id === follow.stepId);
    if (!parent || (follow.claimedBy !== undefined && !text(follow.claimedBy)))
      return null;
    if (follow.matchingResult) {
      if (stable(follow.matchingResult.request) !== stable(parent.request))
        return null;
      try {
        validateCombinedRootResult(parent, follow.matchingResult);
      } catch {
        return null;
      }
    }
  }
  return structuredClone(v) as unknown as CombinedActionRoot;
}
function subject(v: unknown): boolean {
  const s = object(v);
  return Boolean(
    s &&
    (s.kind === "attribute"
      ? text(s.attributeId)
      : ["skill", "weaponAttack", "weaponDamage"].includes(String(s.kind)) &&
        text(s.itemId)),
  );
}
function step(v: unknown): boolean {
  const s = object(v);
  const options = object(s?.options);
  const context = object(options?.context);
  const runtime = object(s?.runtime);
  return Boolean(
    s &&
    text(s.id) &&
    text(s.actorId) &&
    text(s.label) &&
    subject(s.subject) &&
    ["pending", "requested", "rolling", "recorded", "skipped"].includes(
      String(s.status),
    ) &&
    options &&
    context &&
    text(context.groupId) &&
    text(context.leaderActorId) &&
    text(context.primaryActorId) &&
    text(context.leaderName) &&
    text(context.primaryName) &&
    Number.isSafeInteger(context.participantCount) &&
    Number(context.participantCount) >= 2 &&
    Number.isSafeInteger(context.commandDifficulty) &&
    Number(context.commandDifficulty) >= 0 &&
    Number.isSafeInteger(context.commandPenaltyScore) &&
    Number(context.commandPenaltyScore) >= 0 &&
    Number.isSafeInteger(context.allocatedBonusScore) &&
    Number(context.allocatedBonusScore) >= 0 &&
    Number.isInteger(options.bonusScore) &&
    Number.isInteger(options.penaltyScore) &&
    (["pending", "skipped"].includes(String(s.status)) ||
      text(s.controllerId)) &&
    (!["rolling", "recorded"].includes(String(s.status)) ||
      (object(s.request) &&
        runtime &&
        text(runtime.profileId) &&
        ["second-edition-strict", "first-edition-meets"].includes(
          String(runtime.successEvaluator),
        ) &&
        [
          "second-edition",
          "second-edition-basic",
          "second-edition-classic",
          "second-edition-simple",
          "first-edition",
          "d6mv",
        ].includes(String(runtime.wildPolicy)))) &&
    (!["pending", "requested", "skipped"].includes(String(s.status)) ||
      (s.request === undefined &&
        s.runtime === undefined &&
        s.result === undefined &&
        s.artifacts === undefined)) &&
    (s.status !== "recorded" ||
      (object(s.result) &&
        Array.isArray(s.artifacts) &&
        s.artifacts.length > 0)),
  );
}
export function replaceCombinedRootStep(
  root: CombinedActionRoot,
  next: CombinedRootStep,
): CombinedActionRoot {
  if (root.cancelled || !root.steps.some((s) => s.id === next.id))
    throw new Error("D6E2.CombinedActions.Root.Invalid");
  return {
    ...root,
    revision: root.revision + 1,
    steps: root.steps.map((s) => (s.id === next.id ? next : s)),
  };
}
export function currentCombinedRootStep(
  root: CombinedActionRoot,
): CombinedRootStep | undefined {
  return root.steps.find((s) => !["recorded", "skipped"].includes(s.status));
}
export function claimCombinedRootStep(
  root: CombinedActionRoot,
  id: string,
  controllerId: string,
  request: D6RollRequestV1,
  runtime: CombinedRootRuntime,
): CombinedActionRoot {
  const s = currentCombinedRootStep(root);
  const requested = request.context?.requestedRoll;
  if (
    s?.id !== id ||
    s.status !== "requested" ||
    root.cancelled ||
    request.source.actorId !== s.actorId ||
    requested?.requestId !== id ||
    requested.requesterUserId !== root.coordinatorId ||
    requested.recipientUserId !== controllerId ||
    request.rollMode === "selfroll" ||
    JSON.stringify(request.context?.combinedAction) !==
      JSON.stringify(s.options.context) ||
    (s.subject.kind === "attribute"
      ? request.kind !== "attribute" ||
        request.source.attributeId !== s.subject.attributeId
      : request.source.itemId !== s.subject.itemId ||
        request.kind !==
          (s.subject.kind === "skill"
            ? "skill"
            : s.subject.kind === "weaponAttack"
              ? "weapon-attack"
              : "damage"))
  )
    throw new Error("D6E2.CombinedActions.Root.Invalid");
  if (
    s.options.context.stage === "command" &&
    request.difficulty !== s.options.context.commandDifficulty
  )
    throw new Error("D6E2.CombinedActions.Root.Invalid");
  if (s.subject.kind === "weaponDamage")
    validateCombinedDamageRequest(root, s, request);
  const claimed = replaceCombinedRootStep(root, {
    ...s,
    status: "rolling",
    controllerId,
    request: structuredClone(request),
    runtime: structuredClone(runtime),
  });
  return root.version === 2 && s.subject.kind === "weaponAttack"
    ? {
        ...claimed,
        combatDamage: bindCombinedCombatDamage(
          root,
          s,
          request,
          root.combatDamageBonusScore ?? -1,
        ),
      }
    : claimed;
}
function validateCombinedDamageRequest(
  root: CombinedActionRoot,
  s: CombinedRootStep,
  request: D6RollRequestV1,
): void {
  const binding = root.combatDamage;
  const attack = root.steps[1]?.result;
  if (
    !binding ||
    attack?.success !== true ||
    stable(s.options) !== stable(binding.options) ||
    request.rollMode !== binding.attackRequest.rollMode ||
    stable(request.context?.weaponDamage) !==
      stable(binding.plan.weaponDamage) ||
    stable(request.context?.scale) !== stable(binding.plan.scale) ||
    stable(request.context?.autofire) !== stable(binding.plan.autofire)
  )
    throw new Error("D6E2.CombinedActions.Root.Invalid");
}
export function recordCombinedRootStep(
  root: CombinedActionRoot,
  id: string,
  result: D6RollResultV1,
  artifacts: readonly unknown[],
): CombinedActionRoot {
  const s = root.steps.find((s) => s.id === id);
  if (!s || JSON.stringify(s.request) !== JSON.stringify(result.request))
    throw new Error("D6E2.CombinedActions.Root.Invalid");
  if (s.status === "recorded") {
    if (
      JSON.stringify(s.result) !== JSON.stringify(result) ||
      JSON.stringify(s.artifacts) !== JSON.stringify(artifacts)
    )
      throw new Error("D6E2.ActionThread.ResultConflict");
    return root;
  }
  if (s.status !== "rolling" || currentCombinedRootStep(root)?.id !== id)
    throw new Error("D6E2.CombinedActions.Root.Invalid");
  validateCombinedRootResult(s, result);
  const recorded: CombinedRootStep = {
    ...s,
    status: "recorded",
    result: structuredClone(result),
    artifacts: structuredClone(artifacts),
  };
  // Cancellation stops unstarted work; already-claimed dice remain part of the audit.
  return {
    ...root,
    revision: root.revision + 1,
    steps: root.steps.map((step) =>
      step.id === id
        ? recorded
        : root.version === 2 &&
            s.subject.kind === "weaponAttack" &&
            result.success === false &&
            step.subject.kind === "weaponDamage"
          ? { ...step, status: "skipped" }
          : step,
    ),
  };
}

/** Re-resolve captured faces without evaluating dice or repeating transactions. */
export function validateCombinedRootResult(
  step: CombinedRootStep,
  result: D6RollResultV1,
): void {
  if (!step.request || !step.runtime)
    throw new Error("D6E2.CombinedActions.Root.Invalid");
  const replay = resolveD6Roll({
    ...step.runtime,
    request: step.request,
    baseFaces: result.baseFaces,
    wildFaces: result.wildFaces,
    ...(result.wildFaceGroups ? { wildFaceGroups: result.wildFaceGroups } : {}),
    ...(result.characterPointFaceGroups
      ? { characterPointFaceGroups: result.characterPointFaceGroups }
      : {}),
    ...(result.wildChoice ? { choice: result.wildChoice } : {}),
  });
  // Matching-pattern reward observations are appended by the existing roll service;
  // they do not change the numeric or Wild Die resolution being accepted here.
  const { matchingObservation: _observation, ...numeric } = result;
  void _observation;
  if (
    replay.requiresWildExplosion ||
    replay.pendingChoices.length ||
    stable(replay) !== stable(numeric)
  )
    throw new Error("D6E2.ActionThread.RollArtifactInvalid");
}
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    const v = object(item);
    return v
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((key) => [key, v[key]]),
        )
      : item;
  });
}
