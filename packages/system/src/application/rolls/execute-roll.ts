import {
  resolveD6Roll,
  effectiveD6RollScore,
  type D6RollRequestV1,
  type D6RollResultV1,
  type D6WildDieChoice,
  type D6WildDiePolicy,
  type D6WildTriumphPolicyV1,
  type SuccessEvaluator,
} from "@d6-system-2e/core";

export interface D6RolledBatch {
  readonly artifact: unknown;
  readonly faces: readonly number[];
}

export interface D6RollRuntimePort {
  chooseWildDie(
    choices: readonly D6WildDieChoice[],
    result: D6RollResultV1,
  ): Promise<D6WildDieChoice | null>;
  presentWildDieRoll?(
    result: D6RollResultV1,
    artifacts: readonly unknown[],
  ): Promise<void>;
  rollBaseDice(count: number): Promise<D6RolledBatch>;
  rollWildDie(explodeOnSix: boolean): Promise<D6RolledBatch>;
}

export interface ExecutedD6Roll {
  readonly artifacts: readonly unknown[];
  readonly result: D6RollResultV1;
}

export interface D6RollOutcomeExecutionStrategy {
  readonly profileId: string;
  readonly successEvaluator: SuccessEvaluator;
  readonly wildPolicy: D6WildDiePolicy;
}

export async function executeD6Roll(
  request: D6RollRequestV1,
  outcome: D6RollOutcomeExecutionStrategy,
  runtime: D6RollRuntimePort,
  wildTriumph: D6WildTriumphPolicyV1 = {
    automaticSuccess: false,
    enabled: false,
    threshold: 3,
  },
): Promise<ExecutedD6Roll | null> {
  const effectiveScore = effectiveD6RollScore(request);
  const heroPointSpend = Math.max(
    0,
    Math.trunc(
      request.heroPointUse === "none" ? 0 : (request.heroPointSpend ?? 1),
    ),
  );
  const bonusOrdinaryDice =
    request.heroPointUse === "basic-bonus-dice" ? heroPointSpend : 0;
  const bonusWildDice =
    request.heroPointUse === "classic-bonus-wild-dice" ? heroPointSpend : 0;
  const dice = Math.floor(effectiveScore / 3);
  if (dice < 1) throw new RangeError("A roll requires at least 1D.");

  const base = await runtime.rollBaseDice(dice - 1 + bonusOrdinaryDice);
  const resolvedWildPolicy = outcome.wildPolicy;
  const hypotheticalWildFaceGroups = Array.from(
    { length: 1 + bonusWildDice },
    () => [6] as const,
  );
  const explodeWildDieOnSix =
    resolvedWildPolicy !== "second-edition" ||
    resolveD6Roll({
      baseFaces: base.faces,
      profileId: outcome.profileId,
      request,
      successEvaluator: outcome.successEvaluator,
      wildFaceGroups: hypotheticalWildFaceGroups,
      wildFaces: hypotheticalWildFaceGroups.flat(),
      wildPolicy: resolvedWildPolicy,
      wildTriumph,
    }).requiresWildExplosion;
  const wildBatches: D6RolledBatch[][] = [];
  const artifacts: unknown[] = [base.artifact];
  for (let index = 0; index < 1 + bonusWildDice; index += 1) {
    const initial = await runtime.rollWildDie(explodeWildDieOnSix);
    wildBatches.push([initial]);
    artifacts.push(initial.artifact);
  }
  let choice: D6WildDieChoice | undefined;
  let result: D6RollResultV1;

  for (let safety = 0; safety < 100; safety += 1) {
    result = resolveD6Roll({
      baseFaces: base.faces,
      ...(choice === undefined ? {} : { choice }),
      profileId: outcome.profileId,
      request,
      successEvaluator: outcome.successEvaluator,
      wildFaceGroups: wildBatches.map((group) =>
        group.flatMap((batch) => batch.faces),
      ),
      wildFaces: wildBatches.flatMap((group) =>
        group.flatMap((batch) => batch.faces),
      ),
      wildPolicy: resolvedWildPolicy,
      wildTriumph,
    });

    if (result.requiresWildExplosion) {
      for (const group of wildBatches) {
        if (group.at(-1)?.faces.at(-1) !== 6) continue;
        const extra = await runtime.rollWildDie(true);
        group.push(extra);
        artifacts.push(extra.artifact);
      }
      continue;
    }

    if (result.pendingChoices.length > 0) {
      await runtime.presentWildDieRoll?.(result, Object.freeze([...artifacts]));
      const selected = await runtime.chooseWildDie(
        result.pendingChoices,
        result,
      );
      if (selected === null) return null;
      choice = selected;
      continue;
    }

    return Object.freeze({
      artifacts: Object.freeze(artifacts),
      result,
    });
  }

  throw new Error("Wild Die explosion limit exceeded.");
}
