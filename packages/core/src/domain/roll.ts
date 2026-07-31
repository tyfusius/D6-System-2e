import type {
  D6RollPool,
  D6RollRequestV1,
  D6RollResultV1,
  D6WildDieChoice,
  D6WildDieOutcome,
  D6WildDiePolicy,
} from "../contracts/roll";
import { evaluateDifficulty, type SuccessEvaluator } from "./check";
import { dieCodeFromPipScore } from "./die-code";
import { evaluateOpposedRoll, type D6OpposedEvaluation } from "./opposed";
import type { RulesProfileId } from "./rules-profile";

export interface ResolveD6RollInput {
  readonly baseFaces: readonly number[];
  readonly choice?: D6WildDieChoice;
  readonly profileId: RulesProfileId;
  readonly request: D6RollRequestV1;
  readonly successEvaluator: SuccessEvaluator;
  readonly wildFaces: readonly number[];
  readonly wildPolicy: D6WildDiePolicy;
}

function integer(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer.`);
  }
  return value;
}

function face(value: number, label: string): number {
  const valid = integer(value, label);
  if (valid < 1 || valid > 6) {
    throw new RangeError(`${label} must be between 1 and 6.`);
  }
  return valid;
}

function frozenFaces(
  values: readonly number[],
  label: string,
): readonly number[] {
  return Object.freeze(
    values.map((value, index) => face(value, `${label} ${index + 1}`)),
  );
}

export function buildD6RollPool(score: number, resultModifier = 0): D6RollPool {
  const code = dieCodeFromPipScore(score);
  if (code.dice < 1) {
    throw new RangeError("A D6 roll pool must contain at least one die.");
  }
  return Object.freeze({
    baseDice: code.dice - 1,
    code,
    resultModifier: integer(resultModifier, "Result modifier"),
    wildDice: 1,
  });
}

function pending(
  ...choices: readonly D6WildDieChoice[]
): readonly D6WildDieChoice[] {
  return Object.freeze([...choices]);
}

export function acceptedWildDieChoice(
  choices: readonly D6WildDieChoice[],
  value: unknown,
): D6WildDieChoice | null {
  return typeof value === "string" && choices.includes(value as D6WildDieChoice)
    ? (value as D6WildDieChoice)
    : null;
}

export function resolveD6Roll(input: ResolveD6RollInput): D6RollResultV1 {
  if (
    input.request.difficulty !== undefined &&
    input.request.opposition !== undefined
  ) {
    throw new RangeError(
      "A roll cannot use a difficulty and an opposition at the same time.",
    );
  }
  const effectiveScore =
    input.request.heroPointUse === "double-die-code"
      ? input.request.score * 2
      : input.request.score;
  const pool = buildD6RollPool(effectiveScore, input.request.resultModifier);
  const baseFaces = frozenFaces(input.baseFaces, "Base die");
  const wildFaces = frozenFaces(input.wildFaces, "Wild Die");
  if (baseFaces.length !== pool.baseDice) {
    throw new RangeError(
      `Expected ${pool.baseDice} base dice but received ${baseFaces.length}.`,
    );
  }
  const firstWild = wildFaces[0];
  if (firstWild === undefined) {
    throw new RangeError("A Wild Die result is required.");
  }

  const baseTotal = baseFaces.reduce((total, value) => total + value, 0);
  const pipAndModifier = pool.code.pips + pool.resultModifier;
  const initialTotal = baseTotal + firstWild + pipAndModifier;
  const initialDifficulty =
    input.request.difficulty === undefined
      ? undefined
      : evaluateDifficulty(
          initialTotal,
          input.request.difficulty,
          input.successEvaluator,
        );
  const initialOpposition =
    input.request.opposition === undefined
      ? undefined
      : evaluateOpposedRoll({
          actorKind: input.request.opposition.actorKind,
          actorTotal: initialTotal,
          actorWildFace: firstWild,
          opponentKind: input.request.opposition.opponentKind,
          opponentTotal: input.request.opposition.total,
          ...(input.request.opposition.wildDieFace === undefined
            ? {}
            : {
                opponentWildFace: input.request.opposition.wildDieFace,
              }),
        });
  const initialSuccess =
    initialDifficulty?.success ??
    (initialOpposition?.winner === "actor"
      ? true
      : initialOpposition?.winner === "opponent"
        ? false
        : undefined);

  let total = initialTotal;
  let outcome: D6WildDieOutcome = "normal";
  let heroPointAward: 0 | 1 | 2 = 0;
  let pendingChoices: readonly D6WildDieChoice[] = Object.freeze([]);
  let requiresWildExplosion = false;
  let forcedSuccess: boolean | undefined;

  if (input.wildPolicy === "first-edition") {
    if (firstWild === 6) {
      outcome = "exploded";
      requiresWildExplosion = wildFaces.at(-1) === 6;
      total =
        baseTotal +
        wildFaces.reduce((sum, value) => sum + value, 0) +
        pipAndModifier;
    } else if (firstWild === 1) {
      if (input.choice === undefined) {
        pendingChoices = pending(
          "first-edition-remove-highest",
          "first-edition-complication",
        );
      } else if (input.choice === "first-edition-remove-highest") {
        total = baseTotal - Math.max(...baseFaces, 0) + pipAndModifier;
      } else if (input.choice === "first-edition-complication") {
        outcome = "complication";
      } else {
        throw new RangeError(
          "The selected choice is not valid for this Wild Die.",
        );
      }
    }
  } else if (input.wildPolicy === "second-edition-basic") {
    if (firstWild === 6) {
      outcome = "exploded";
      requiresWildExplosion = wildFaces.at(-1) === 6;
      total =
        baseTotal +
        wildFaces.reduce((sum, value) => sum + value, 0) +
        pipAndModifier;
    } else if (firstWild === 1) {
      total = baseTotal - Math.max(...baseFaces, 0) + pipAndModifier;
      outcome = "penalty";
    }
  } else if (input.wildPolicy === "second-edition-classic") {
    if (firstWild === 6) {
      outcome = "exploded";
      requiresWildExplosion = wildFaces.at(-1) === 6;
      total =
        baseTotal +
        wildFaces.reduce((sum, value) => sum + value, 0) +
        pipAndModifier;
    } else if (firstWild === 1) {
      if (input.choice === undefined) {
        pendingChoices = pending(
          "second-edition-classic-penalty",
          "second-edition-classic-complication",
        );
      } else if (input.choice === "second-edition-classic-penalty") {
        total = baseTotal - Math.max(...baseFaces, 0) + pipAndModifier;
        outcome = "penalty";
      } else if (input.choice === "second-edition-classic-complication") {
        total = baseTotal + pipAndModifier;
        outcome = "complication";
      } else {
        throw new RangeError(
          "The selected choice is not valid for this Wild Die mishap.",
        );
      }
    }
  } else if (input.wildPolicy === "second-edition-simple") {
    if (firstWild === 6) {
      outcome = "exploded";
      requiresWildExplosion = wildFaces.at(-1) === 6;
      total =
        baseTotal +
        wildFaces.reduce((sum, value) => sum + value, 0) +
        pipAndModifier;
    }
  } else if (firstWild === 6) {
    if (initialSuccess === undefined) {
      outcome = "unresolved-advantage";
    } else if (initialSuccess) {
      if (input.choice === undefined) {
        pendingChoices = pending(
          "second-edition-exceptional",
          "second-edition-ordinary",
        );
      } else if (input.choice === "second-edition-exceptional") {
        outcome = "exceptional-success";
        heroPointAward = 1;
      } else if (input.choice === "second-edition-ordinary") {
        outcome = "ordinary-success";
        heroPointAward = 2;
      } else {
        throw new RangeError(
          "The selected choice is not valid for this Advantage.",
        );
      }
    } else {
      outcome = "exploded";
      heroPointAward = 1;
      requiresWildExplosion = wildFaces.at(-1) === 6;
      total =
        baseTotal +
        wildFaces.reduce((sum, value) => sum + value, 0) +
        pipAndModifier;
    }
  } else if (firstWild === 1) {
    if (initialSuccess === undefined) {
      outcome = "unresolved-complication";
    } else if (initialSuccess) {
      if (input.choice === undefined) {
        pendingChoices = pending(
          "second-edition-partial",
          "second-edition-failure",
        );
      } else if (input.choice === "second-edition-partial") {
        outcome = "partial-success";
        heroPointAward = 1;
        forcedSuccess = true;
      } else if (input.choice === "second-edition-failure") {
        outcome = "failure";
        heroPointAward = 2;
        forcedSuccess = false;
      } else {
        throw new RangeError(
          "The selected choice is not valid for this Complication.",
        );
      }
    } else {
      outcome = "complication";
      heroPointAward = 1;
      forcedSuccess = false;
    }
  }

  const difficulty =
    input.request.difficulty === undefined
      ? undefined
      : evaluateDifficulty(
          total,
          input.request.difficulty,
          input.successEvaluator,
        );
  const opposition: D6OpposedEvaluation | undefined =
    input.request.opposition === undefined
      ? undefined
      : evaluateOpposedRoll({
          actorKind: input.request.opposition.actorKind,
          actorTotal: total,
          actorWildFace: firstWild,
          opponentKind: input.request.opposition.opponentKind,
          opponentTotal: input.request.opposition.total,
          ...(input.request.opposition.wildDieFace === undefined
            ? {}
            : {
                opponentWildFace: input.request.opposition.wildDieFace,
              }),
        });
  const evaluatedSuccess =
    difficulty?.success ??
    (opposition?.winner === "actor"
      ? true
      : opposition?.winner === "opponent"
        ? false
        : undefined);
  const success = forcedSuccess ?? evaluatedSuccess;
  const failedDoublingDown =
    input.request.context?.doublingDown !== undefined && success === false;
  if (failedDoublingDown) {
    outcome = "complication";
    heroPointAward = 0;
  }

  return Object.freeze({
    baseFaces,
    contractVersion: input.request.contractVersion,
    ...(difficulty === undefined ? {} : { difficulty }),
    heroPointAward,
    heroPointSpent: input.request.heroPointUse === "none" ? 0 : 1,
    ...(opposition === undefined ? {} : { opposition }),
    pendingChoices,
    pool,
    profileId: input.profileId,
    request: input.request,
    requiresWildExplosion,
    ...(success === undefined ? {} : { success }),
    total,
    ...(input.choice === undefined ? {} : { wildChoice: input.choice }),
    wildFaces,
    wildPolicy: input.wildPolicy,
    wildOutcome: outcome,
  });
}
