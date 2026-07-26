import {
  resolveD6Roll,
  type D6RollRequestV1,
  type D6RollResultV1,
  type D6WildDieChoice,
  type D6WildDiePolicy,
  type RulesProfile,
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
  rollBaseDice(count: number): Promise<D6RolledBatch>;
  rollWildDie(): Promise<D6RolledBatch>;
}

export interface ExecutedD6Roll {
  readonly artifacts: readonly unknown[];
  readonly result: D6RollResultV1;
}

function successEvaluator(profile: RulesProfile): SuccessEvaluator {
  return profile.compatibility.firstEditionSuccessEvaluator
    ? "first-edition-meets"
    : "second-edition-strict";
}

function wildPolicy(profile: RulesProfile): D6WildDiePolicy {
  return profile.compatibility.firstEditionWildDie
    ? "first-edition"
    : "second-edition";
}

export async function executeD6Roll(
  request: D6RollRequestV1,
  profile: RulesProfile,
  runtime: D6RollRuntimePort,
): Promise<ExecutedD6Roll | null> {
  const dice = Math.floor(request.score / 3);
  if (dice < 1) throw new RangeError("A roll requires at least 1D.");

  const base = await runtime.rollBaseDice(dice - 1);
  const firstWild = await runtime.rollWildDie();
  const wildBatches: D6RolledBatch[] = [firstWild];
  const artifacts: unknown[] = [base.artifact, firstWild.artifact];
  let choice: D6WildDieChoice | undefined;
  let result: D6RollResultV1;

  for (let safety = 0; safety < 100; safety += 1) {
    result = resolveD6Roll({
      baseFaces: base.faces,
      ...(choice === undefined ? {} : { choice }),
      profileId: profile.id,
      request,
      successEvaluator: successEvaluator(profile),
      wildFaces: wildBatches.flatMap((batch) => batch.faces),
      wildPolicy: wildPolicy(profile),
    });

    if (result.requiresWildExplosion) {
      const extra = await runtime.rollWildDie();
      wildBatches.push(extra);
      artifacts.push(extra.artifact);
      continue;
    }

    if (result.pendingChoices.length > 0) {
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
