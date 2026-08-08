import type {
  D6RollPool,
  D6RollRequestV1,
  D6RollResultV1,
  D6WildDieChoice,
  D6WildDieOutcome,
  D6WildDiePolicy,
  D6WildTriumphPolicyV1,
} from "../contracts/roll";
import { evaluateDifficulty, type SuccessEvaluator } from "./check";
import { dieCodeFromPipScore } from "./die-code";
import { evaluateOpposedRoll, type D6OpposedEvaluation } from "./opposed";
import { superheroicDieCodeCapPlan } from "./superheroic";

export interface ResolveD6RollInput {
  readonly baseFaces: readonly number[];
  readonly choice?: D6WildDieChoice;
  readonly profileId: string;
  readonly request: D6RollRequestV1;
  readonly successEvaluator: SuccessEvaluator;
  readonly wildFaces: readonly number[];
  readonly wildFaceGroups?: readonly (readonly number[])[];
  readonly wildPolicy: D6WildDiePolicy;
  readonly wildTriumph?: D6WildTriumphPolicyV1;
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

export function effectiveD6RollScore(request: D6RollRequestV1): number {
  const score =
    request.heroPointUse === "double-die-code"
      ? request.score * 2
      : request.score;
  const cap = request.context?.superheroicDieCodeCap?.cap;
  return cap === undefined
    ? score
    : superheroicDieCodeCapPlan(
        score,
        cap,
        request.heroPointUse === "superheroic-bypass-cap",
      ).cappedScore;
}

export function buildD6RollPool(
  score: number,
  resultModifier = 0,
  heroPointUse: D6RollRequestV1["heroPointUse"] = "none",
  heroPointSpend = 0,
): D6RollPool {
  const code = dieCodeFromPipScore(score);
  if (code.dice < 1) {
    throw new RangeError("A D6 roll pool must contain at least one die.");
  }
  const spend = Math.max(0, integer(heroPointSpend, "Hero Points spent"));
  const bonusOrdinaryDice = heroPointUse === "basic-bonus-dice" ? spend : 0;
  const bonusWildDice = heroPointUse === "classic-bonus-wild-dice" ? spend : 0;
  return Object.freeze({
    baseDice: code.dice - 1 + bonusOrdinaryDice,
    bonusOrdinaryDice,
    bonusWildDice,
    code,
    resultModifier: integer(resultModifier, "Result modifier"),
    wildDice: 1 + bonusWildDice,
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
  const effectiveScore = effectiveD6RollScore(input.request);
  const heroPointSpent = Math.max(
    0,
    Math.trunc(
      input.request.heroPointUse === "none"
        ? 0
        : (input.request.heroPointSpend ?? 1),
    ),
  );
  const pool = buildD6RollPool(
    effectiveScore,
    input.request.resultModifier,
    input.request.heroPointUse,
    heroPointSpent,
  );
  const baseFaces = frozenFaces(input.baseFaces, "Base die");
  const rawWildFaceGroups = input.wildFaceGroups ?? [input.wildFaces];
  const wildFaceGroups = Object.freeze(
    rawWildFaceGroups.map((group, index) =>
      frozenFaces(group, `Wild Die ${index + 1}`),
    ),
  );
  const wildFaces = Object.freeze(wildFaceGroups.flat());
  if (baseFaces.length !== pool.baseDice) {
    throw new RangeError(
      `Expected ${pool.baseDice} base dice but received ${baseFaces.length}.`,
    );
  }
  if (wildFaceGroups.length !== pool.wildDice) {
    throw new RangeError(
      `Expected ${pool.wildDice} Wild Dice but received ${wildFaceGroups.length}.`,
    );
  }
  const firstWild = wildFaceGroups[0]?.[0];
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
  let heroPointAward = 0;
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
    const initialWildFaces = wildFaceGroups.map((group) => group[0]);
    const mishapCount = initialWildFaces.filter((value) => value === 1).length;
    const classicWildTotal = wildFaceGroups.reduce(
      (sum, group) =>
        sum + group.reduce((groupSum, value) => groupSum + value, 0),
      0,
    );
    total = baseTotal + classicWildTotal + pipAndModifier;
    heroPointAward = wildFaces.filter((value) => value === 6).length;
    if (mishapCount > 0) {
      if (input.choice === undefined) {
        pendingChoices = pending(
          "second-edition-classic-penalty",
          "second-edition-classic-complication",
        );
      } else if (input.choice === "second-edition-classic-penalty") {
        const discardedBase = [...baseFaces]
          .sort((left, right) => right - left)
          .slice(0, mishapCount)
          .reduce((sum, value) => sum + value, 0);
        total =
          baseTotal -
          discardedBase +
          classicWildTotal -
          mishapCount +
          pipAndModifier;
        outcome = "penalty";
      } else if (input.choice === "second-edition-classic-complication") {
        total = baseTotal + classicWildTotal - mishapCount + pipAndModifier;
        outcome = "complication";
      } else {
        throw new RangeError(
          "The selected choice is not valid for this Wild Die mishap.",
        );
      }
    } else if (initialWildFaces.some((value) => value === 6)) {
      outcome = "exploded";
    }
    requiresWildExplosion = wildFaceGroups.some((group) => group.at(-1) === 6);
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

  const triumphThreshold = Math.min(
    10,
    Math.max(2, Math.trunc(input.wildTriumph?.threshold ?? 3)),
  );
  const consecutiveSixes = (wildFaceGroups[0] ?? []).findIndex(
    (value) => value !== 6,
  );
  const triumphSixes =
    consecutiveSixes === -1
      ? (wildFaceGroups[0]?.length ?? 0)
      : consecutiveSixes;
  const wildTriumphTriggered =
    input.wildTriumph?.enabled === true && triumphSixes >= triumphThreshold;
  if (
    input.wildTriumph?.enabled === true &&
    wildFaceGroups.some((group) => group.at(-1) === 6)
  ) {
    requiresWildExplosion = true;
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
  const automaticTriumphSuccess =
    wildTriumphTriggered &&
    input.wildTriumph.automaticSuccess &&
    difficulty !== undefined &&
    opposition === undefined;
  const success = automaticTriumphSuccess
    ? true
    : (forcedSuccess ?? evaluatedSuccess);
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
    heroPointSpent,
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
    wildFaceGroups,
    wildPolicy: input.wildPolicy,
    wildOutcome: outcome,
    ...(input.wildTriumph?.enabled === true
      ? {
          wildTriumph: Object.freeze({
            automaticSuccessApplied: automaticTriumphSuccess,
            consecutiveSixes: triumphSixes,
            successful: success === true,
            threshold: triumphThreshold,
            triggered: wildTriumphTriggered,
          }),
        }
      : {}),
  });
}
