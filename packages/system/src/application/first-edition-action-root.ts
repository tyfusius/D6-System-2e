import type {
  FirstEditionActionRoot,
  FirstEditionActionStage,
  FirstEditionClaimInput,
  FirstEditionStageReceipt,
  FirstEditionStageSpec,
} from "./first-edition-action-contract";
import {
  actorBinding,
  canonical,
  claimInput,
  clock,
  integer,
  keys,
  object,
  stageReceipt,
  stageSpec,
  text,
} from "./first-edition-action-validation";

export class FirstEditionActionError extends Error {
  constructor(
    readonly code:
      | "invalid"
      | "conflict"
      | "uncertain"
      | "authority"
      | "deleted"
      | "cancelled",
  ) {
    super(`first-edition-action:${code}`);
  }
}
/** Parse only an explicitly bound new flag. Never infer a root from nearby chat. */
export function parseFirstEditionActionRoot(
  value: unknown,
): FirstEditionActionRoot | null {
  try {
    const v = object(value),
      runtime = object(v?.runtime);
    if (
      !v ||
      canonical(v).length > 2_000_000 ||
      !keys(v, [
        "version",
        "rootMessageId",
        "operationId",
        "initiation",
        "coordinatorUserId",
        "subjects",
        "status",
        "revision",
        "runtime",
        "clock",
        "stages",
      ]) ||
      v.version !== 1 ||
      !text(v.rootMessageId) ||
      !text(v.operationId) ||
      !text(v.coordinatorUserId) ||
      !integer(v.revision) ||
      ![
        "movement",
        "healing",
        "manual-mortality",
        "round-mortality",
        "medical-consumable",
      ].includes(String(v.initiation)) ||
      !["open", "cancelled", "complete"].includes(String(v.status)) ||
      !runtime ||
      !keys(runtime, [
        "profileId",
        "movementStrategyId",
        "actionEconomyStrategyId",
        "healthModelId",
        "damageStrategyId",
        "roundLifecycleId",
      ]) ||
      !text(runtime.profileId) ||
      !Object.values(runtime).every(text) ||
      (v.initiation === "movement"
        ? !text(runtime.movementStrategyId) ||
          !text(runtime.actionEconomyStrategyId)
        : !text(runtime.healthModelId) || !text(runtime.damageStrategyId)) ||
      (v.clock !== undefined && !clock(v.clock)) ||
      (v.initiation === "round-mortality" &&
        (!clock(v.clock) ||
          !text(object(v.clock)?.combatUuid) ||
          !text(runtime.roundLifecycleId))) ||
      !Array.isArray(v.stages) ||
      v.stages.length === 0 ||
      v.stages.length > 64 ||
      !Array.isArray(v.subjects) ||
      v.subjects.length < 1 ||
      v.subjects.length > 2 ||
      !v.subjects.every((raw: unknown) => {
        const s = object(raw);
        return Boolean(
          s &&
          keys(s, ["role", "actor"]) &&
          ["mover", "patient", "healer", "administrator"].includes(
            String(s.role),
          ) &&
          actorBinding(s.actor),
        );
      })
    )
      return null;
    const root = v as unknown as FirstEditionActionRoot;
    const roles = root.subjects.map((subject) => subject.role);
    if (
      new Set(roles).size !== roles.length ||
      (root.initiation === "movement"
        ? roles.length !== 1 || roles[0] !== "mover"
        : root.initiation === "medical-consumable"
          ? roles.length !== 2 ||
            !roles.includes("patient") ||
            !roles.includes("administrator")
          : !roles.includes("patient") ||
            roles.includes("mover") ||
            (root.initiation !== "healing" && roles.length !== 1))
    )
      return null;
    const ids = new Set<string>();
    let unresolved = false;
    for (const raw of v.stages as unknown[]) {
      const s = object(raw);
      if (
        !s ||
        !keys(s, ["id", "spec", "state", "claim", "receipt"]) ||
        !text(s.id) ||
        !s.id.startsWith(`${root.operationId}:`) ||
        s.id === `${root.operationId}:` ||
        ids.has(s.id) ||
        !stageSpec(s.spec, root) ||
        !["pending", "claimed", "recorded"].includes(String(s.state))
      )
        return null;
      ids.add(s.id);
      const stage = s as unknown as FirstEditionActionStage;
      if (!admitted(root.initiation, stage.spec)) return null;
      // No stage can start before the preceding stage's durable result.
      if (unresolved && stage.state !== "pending") return null;
      if (stage.state !== "recorded") unresolved = true;
      if (stage.state === "pending") {
        if (s.claim !== undefined || s.receipt !== undefined) return null;
      } else if (
        !claimInput(s.claim, root, stage) ||
        (stage.state === "claimed"
          ? s.receipt !== undefined
          : !stageReceipt(s.receipt, stage))
      )
        return null;
    }
    if (root.status === "complete" && unresolved) return null;
    return structuredClone(root);
  } catch {
    return null;
  }
}
function admitted(
  initiation: FirstEditionActionRoot["initiation"],
  spec: FirstEditionStageSpec,
): boolean {
  if (spec.kind === "effect") {
    const movement = [
      "action-spend",
      "segment-movement",
      "ordered-completion",
      "token-translation",
    ].includes(spec.plan.kind);
    if (initiation === "medical-consumable")
      return spec.plan.kind === "medical-consumable-use";
    return initiation === "movement"
      ? movement
      : !movement &&
          (initiation === "healing" || spec.plan.kind !== "item-score-change");
  }
  if (initiation === "movement")
    return spec.purpose === "movement" || spec.purpose === "segment-running";
  if (initiation === "medical-consumable")
    return spec.kind === "plain-d6" && spec.purpose === "duration";
  if (initiation === "healing")
    return spec.purpose !== "movement" && spec.purpose !== "segment-running";
  return spec.purpose === "survival";
}
function checked(root: FirstEditionActionRoot): FirstEditionActionRoot {
  const parsed = parseFirstEditionActionRoot(root);
  if (!parsed) throw new FirstEditionActionError("invalid");
  return parsed;
}
export function createFirstEditionActionRoot(
  input: Omit<
    FirstEditionActionRoot,
    "version" | "revision" | "status" | "stages"
  > & {
    readonly stages: readonly Pick<FirstEditionActionStage, "id" | "spec">[];
  },
): FirstEditionActionRoot {
  return checked({
    ...input,
    version: 1,
    revision: 0,
    status: "open",
    stages: input.stages.map((stage) => ({ ...stage, state: "pending" })),
  });
}
export function currentFirstEditionActionStage(
  root: FirstEditionActionRoot,
): FirstEditionActionStage | undefined {
  return root.stages.find((stage) => stage.state !== "recorded");
}
export function claimFirstEditionActionStage(
  root: FirstEditionActionRoot,
  id: string,
  authenticatedSenderId: string,
  input: FirstEditionClaimInput,
): FirstEditionActionRoot {
  checked(root);
  const stage = currentFirstEditionActionStage(root);
  if (stage?.spec.controllerUserId !== authenticatedSenderId)
    throw new FirstEditionActionError("authority");
  if (root.status !== "open") throw new FirstEditionActionError("cancelled");
  if (
    stage.id !== id ||
    stage.state !== "pending" ||
    !claimInput(input, root, stage)
  )
    throw new FirstEditionActionError("uncertain");
  return checked({
    ...root,
    revision: root.revision + 1,
    stages: root.stages.map((s) =>
      s.id === id ? { ...s, state: "claimed", claim: input } : s,
    ),
  });
}
export function recordFirstEditionActionStage(
  root: FirstEditionActionRoot,
  id: string,
  receipt: FirstEditionStageReceipt,
): FirstEditionActionRoot {
  checked(root);
  const stage = root.stages.find((s) => s.id === id);
  if (!stage || !stageReceipt(receipt, stage))
    throw new FirstEditionActionError("invalid");
  if (stage.state === "recorded") {
    if (canonical(stage.receipt) !== canonical(receipt))
      throw new FirstEditionActionError("conflict");
    return root;
  }
  if (
    stage.state !== "claimed" ||
    currentFirstEditionActionStage(root)?.id !== id
  )
    throw new FirstEditionActionError("invalid");
  // Cancellation never discards evidence from work already claimed.
  return checked({
    ...root,
    revision: root.revision + 1,
    stages: root.stages.map((s) =>
      s.id === id ? { ...s, state: "recorded", receipt } : s,
    ),
  });
}
export function cancelFirstEditionAction(
  root: FirstEditionActionRoot,
): FirstEditionActionRoot {
  checked(root);
  return root.status !== "open"
    ? root
    : checked({ ...root, status: "cancelled", revision: root.revision + 1 });
}
/** Consumers explicitly choose the next stage from saved results and existing rules. */
export function appendFirstEditionActionStages(
  root: FirstEditionActionRoot,
  stages: readonly Pick<FirstEditionActionStage, "id" | "spec">[],
): FirstEditionActionRoot {
  checked(root);
  if (
    root.status !== "open" ||
    currentFirstEditionActionStage(root) ||
    stages.length === 0
  )
    throw new FirstEditionActionError("invalid");
  return checked({
    ...root,
    revision: root.revision + 1,
    stages: [
      ...root.stages,
      ...stages.map((stage) => ({ ...stage, state: "pending" as const })),
    ],
  });
}
export function completeFirstEditionAction(
  root: FirstEditionActionRoot,
): FirstEditionActionRoot {
  checked(root);
  if (root.status === "complete") return root;
  if (root.status !== "open" || currentFirstEditionActionStage(root))
    throw new FirstEditionActionError("invalid");
  return checked({ ...root, status: "complete", revision: root.revision + 1 });
}
