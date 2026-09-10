import type {
  D6RollMode,
  D6RollRequestV1,
  D6RollResultV1,
} from "@d6-system-2e/core";
import type {
  FirstEditionActionRoot,
  FirstEditionActionStage,
  FirstEditionEffectPlan,
  FirstEditionRollRuntime,
  FirstEditionSerializedRoll,
  FirstEditionStageReceipt,
} from "./first-edition-action-contract";
import {
  claimFirstEditionActionStage,
  FirstEditionActionError,
  parseFirstEditionActionRoot,
  recordFirstEditionActionStage,
} from "./first-edition-action-root";
import { canonical, stageReceipt } from "./first-edition-action-validation";

export interface FirstEditionStageBinding {
  readonly rootMessageId: string;
  readonly operationId: string;
  readonly stageId: string;
  /** From the authenticated transport/current user, never the payload. */
  readonly authenticatedSenderId: string;
}
export interface FirstEditionActionStorePorts {
  load: (rootMessageId: string) => Promise<unknown>;
  /** Serialized by the existing authority. Must compare revision and intersect
   * recipient scope BEFORE saving the claim/receipt. Never recreate a missing root. */
  compareAndSwap: (
    rootMessageId: string,
    expectedRevision: number,
    next: FirstEditionActionRoot,
    scope: D6RollMode | "preserve",
  ) => Promise<boolean>;
  /** Claim checks live UUIDs, document permissions, strategy/model and before
   * state. Record/repair authenticate saved evidence without replaying effects. */
  authorize: (
    binding: FirstEditionStageBinding,
    root: FirstEditionActionRoot,
    stage: FirstEditionActionStage,
    phase: "claim" | "record" | "repair",
  ) => Promise<void>;
}
export interface FirstEditionRollPorts<
  TArtifact,
> extends FirstEditionActionStorePorts {
  runtime: () => FirstEditionRollRuntime;
  sanitizeRequest: (request: D6RollRequestV1) => D6RollRequestV1;
  sanitizeResult: (result: D6RollResultV1) => D6RollResultV1;
  serialize: (
    artifacts: readonly TArtifact[],
  ) => Promise<readonly FirstEditionSerializedRoll[]>;
  /** Hydrate and verify serialized fingerprints; never evaluate dice. */
  validateArtifacts: (
    artifacts: readonly FirstEditionSerializedRoll[],
  ) => Promise<void>;
  /** Existing idempotent private Actor audit, keyed by actual root and stage. */
  audit: (
    result: D6RollResultV1,
    rootMessageId: string,
    stageId: string,
  ) => Promise<void>;
  /** Neutral once-only presentation append; effect receipts do not enter it. */
  present: (
    root: FirstEditionActionRoot,
    stage: FirstEditionActionStage,
    receipt: Exclude<FirstEditionStageReceipt, { kind: "effect" }>,
  ) => Promise<void>;
}
export interface FirstEditionRollCapture<TArtifact> {
  readonly suppressChatMessage: true;
  beforeDice: (request: D6RollRequestV1) => Promise<void>;
  captureRollExecution: (
    result: D6RollResultV1,
    artifacts: readonly TArtifact[],
  ) => Promise<void>;
}
async function read(
  binding: FirstEditionStageBinding,
  ports: FirstEditionActionStorePorts,
) {
  const raw = await ports.load(binding.rootMessageId);
  if (raw === null) throw new FirstEditionActionError("deleted");
  const root = parseFirstEditionActionRoot(raw);
  const stage = root?.stages.find((stage) => stage.id === binding.stageId);
  if (
    root?.rootMessageId !== binding.rootMessageId ||
    root.operationId !== binding.operationId ||
    !stage
  )
    throw new FirstEditionActionError("invalid");
  return { root, stage };
}
async function save(
  binding: FirstEditionStageBinding,
  ports: FirstEditionActionStorePorts,
  root: FirstEditionActionRoot,
  next: FirstEditionActionRoot,
  scope: D6RollMode | "preserve",
) {
  if (root === next) return;
  if (
    !(await ports.compareAndSwap(
      binding.rootMessageId,
      root.revision,
      next,
      scope,
    ))
  )
    throw new FirstEditionActionError("conflict");
}
function receiptScope(
  receipt: FirstEditionStageReceipt,
  stage: FirstEditionActionStage,
): D6RollMode | "preserve" {
  return receipt.kind === "d6-roll"
    ? receipt.result.request.rollMode
    : stage.claim?.kind === "plain-d6"
      ? stage.claim.rollMode
      : "preserve";
}
async function record(
  binding: FirstEditionStageBinding,
  ports: FirstEditionActionStorePorts,
  receipt: FirstEditionStageReceipt,
) {
  const { root, stage } = await read(binding, ports);
  await ports.authorize(binding, root, stage, "record");
  const next = recordFirstEditionActionStage(root, stage.id, receipt);
  await save(binding, ports, root, next, receiptScope(receipt, stage));
}
/** One invocation's cache survives a failed save. A new instance after reload
 * can use only persisted evidence; it never manufactures a replacement roll. */
export function createFirstEditionRollPorts<TArtifact>(
  binding: FirstEditionStageBinding,
  ports: FirstEditionRollPorts<TArtifact>,
) {
  let captured:
    { result: D6RollResultV1; artifacts: readonly TArtifact[] } | undefined;
  let capturedPlain:
    | {
        total: number;
        faces: readonly number[];
        artifacts: readonly TArtifact[];
      }
    | undefined;
  let cached: Exclude<FirstEditionStageReceipt, { kind: "effect" }> | undefined;
  const verifyCaptured = async (receipt: FirstEditionStageReceipt) => {
    const { root, stage } = await read(binding, ports);
    await ports.authorize(binding, root, stage, "record");
    if (!stageReceipt(receipt, stage))
      throw new FirstEditionActionError("invalid");
  };
  const storeCaptured = async () => {
    if (!captured) throw new FirstEditionActionError("uncertain");
    cached ??= {
      kind: "d6-roll",
      result: ports.sanitizeResult(captured.result),
      artifacts: await ports.serialize(captured.artifacts),
    };
    await verifyCaptured(cached);
    await ports.validateArtifacts(cached.artifacts);
    await ports.audit(captured.result, binding.rootMessageId, binding.stageId);
    await record(binding, ports, cached);
  };
  const storePlain = async () => {
    if (!capturedPlain) throw new FirstEditionActionError("uncertain");
    cached ??= {
      kind: "plain-d6",
      total: capturedPlain.total,
      faces: [...capturedPlain.faces],
      artifacts: await ports.serialize(capturedPlain.artifacts),
    };
    await verifyCaptured(cached);
    await ports.validateArtifacts(cached.artifacts);
    await record(binding, ports, cached);
  };
  const hooks: FirstEditionRollCapture<TArtifact> = {
    suppressChatMessage: true,
    beforeDice: async (request) => {
      const { root, stage } = await read(binding, ports);
      await ports.authorize(binding, root, stage, "claim");
      const input = {
        kind: "d6-roll" as const,
        request: ports.sanitizeRequest(request),
        runtime: ports.runtime(),
      };
      await save(
        binding,
        ports,
        root,
        claimFirstEditionActionStage(
          root,
          stage.id,
          binding.authenticatedSenderId,
          input,
        ),
        input.request.rollMode,
      );
    },
    captureRollExecution: async (result, artifacts) => {
      if (captured && canonical(captured.result) !== canonical(result))
        throw new FirstEditionActionError("conflict");
      if (
        cached &&
        canonical(cached.artifacts) !==
          canonical(await ports.serialize(artifacts))
      )
        throw new FirstEditionActionError("conflict");
      captured ??= {
        result: structuredClone(result),
        artifacts: [...artifacts],
      };
      await storeCaptured();
    },
  };
  const resume = async (): Promise<
    Exclude<FirstEditionStageReceipt, { kind: "effect" }>
  > => {
    let { root, stage } = await read(binding, ports);
    await ports.authorize(binding, root, stage, "repair");
    if (stage.state !== "recorded") {
      if (captured) await storeCaptured();
      else if (capturedPlain) await storePlain();
      else if (cached) {
        await ports.validateArtifacts(cached.artifacts);
        await record(binding, ports, cached);
      } else throw new FirstEditionActionError("uncertain");
      ({ root, stage } = await read(binding, ports));
    }
    const receipt = stage.receipt;
    if (!receipt || receipt.kind === "effect")
      throw new FirstEditionActionError("invalid");
    await ports.validateArtifacts(receipt.artifacts);
    await ports.present(root, stage, receipt);
    return receipt;
  };
  return {
    hooks,
    resume,
    async runD6(
      builder: (
        hooks: FirstEditionRollCapture<TArtifact>,
      ) => Promise<D6RollResultV1 | null>,
    ): Promise<D6RollResultV1 | null> {
      const { root, stage } = await read(binding, ports);
      if (stage.spec.kind !== "d6-roll")
        throw new FirstEditionActionError("invalid");
      if (stage.state !== "pending") {
        const receipt = await resume();
        if (receipt.kind !== "d6-roll")
          throw new FirstEditionActionError("invalid");
        return receipt.result;
      }
      if (root.status !== "open")
        throw new FirstEditionActionError("cancelled");
      await ports.authorize(binding, root, stage, "claim");
      const result = await builder(hooks);
      if (!result) {
        if ((await read(binding, ports)).stage.state !== "pending")
          throw new FirstEditionActionError("uncertain");
        return null; // Survival/duration cancellation stays unresolved, never death/zero.
      }
      const receipt = await resume();
      if (receipt.kind !== "d6-roll")
        throw new FirstEditionActionError("invalid");
      return receipt.result;
    },
    async runPlain(
      rollMode: D6RollMode,
      evaluate: (dice: number) => Promise<{
        total: number;
        faces: readonly number[];
        artifacts: readonly TArtifact[];
      }>,
    ) {
      const { root, stage } = await read(binding, ports);
      if (stage.spec.kind !== "plain-d6")
        throw new FirstEditionActionError("invalid");
      if (stage.state !== "pending") return resume();
      await ports.authorize(binding, root, stage, "claim");
      await save(
        binding,
        ports,
        root,
        claimFirstEditionActionStage(
          root,
          stage.id,
          binding.authenticatedSenderId,
          { kind: "plain-d6", dice: stage.spec.dice, rollMode },
        ),
        rollMode,
      );
      const evaluated = await evaluate(stage.spec.dice);
      capturedPlain = {
        ...evaluated,
        faces: [...evaluated.faces],
        artifacts: [...evaluated.artifacts],
      };
      await storePlain();
      return resume();
    },
  };
}

export interface FirstEditionEffectPorts extends FirstEditionActionStorePorts {
  /** Existing authenticated document/Combat command authority must atomically
   * compare before state/revision, apply, and retain a durable receiptKey.
   * A raw document.update followed by an unrelated receipt write is insufficient. */
  compareAndApply: (
    plan: FirstEditionEffectPlan,
    receiptKey: string,
  ) => Promise<Extract<FirstEditionStageReceipt, { kind: "effect" }>>;
  /** Read-only reconciliation after a claimed effect or ambiguous save. null
   * means unknown, not proof that applying again is safe. */
  readReceipt: (
    plan: FirstEditionEffectPlan,
    receiptKey: string,
  ) => Promise<Extract<FirstEditionStageReceipt, { kind: "effect" }> | null>;
}
export async function executeFirstEditionEffect(
  binding: FirstEditionStageBinding,
  ports: FirstEditionEffectPorts,
) {
  const { root, stage } = await read(binding, ports);
  if (stage.spec.kind !== "effect")
    throw new FirstEditionActionError("invalid");
  await ports.authorize(
    binding,
    root,
    stage,
    stage.state === "pending" ? "claim" : "repair",
  );
  if (stage.state === "recorded") return stage.receipt;
  const receiptKey = `${stage.id}:effect`;
  let receipt: Extract<FirstEditionStageReceipt, { kind: "effect" }> | null;
  if (stage.state === "claimed") {
    receipt = await ports.readReceipt(stage.spec.plan, receiptKey);
    if (!receipt) throw new FirstEditionActionError("uncertain");
  } else {
    await save(
      binding,
      ports,
      root,
      claimFirstEditionActionStage(
        root,
        stage.id,
        binding.authenticatedSenderId,
        { kind: "effect" },
      ),
      "preserve",
    );
    // The effect authority revalidates ownership, origin/model and revision at apply.
    receipt = await ports.compareAndApply(stage.spec.plan, receiptKey);
  }
  await record(binding, ports, receipt);
  return receipt;
}
