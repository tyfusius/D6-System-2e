import {
  D6_MATCHING_EVALUATOR_VERSION,
  D6_MATCHING_REWARD_MAX,
  D6_MATCHING_ROLL_CONTRACT_VERSION,
  type D6MatchingCandidateV1,
  type D6MatchingConsumedGroupV1,
  type D6MatchingEvaluationOptionsV1,
  type D6MatchingEvaluatorV1,
  type D6MatchingFaceGroupV1,
  type D6MatchingPatternV1,
  type D6MatchingRewardPlanV1,
  type D6MatchingRewardPolicyV1,
  type D6MatchingResultV1,
} from "../contracts/pool-evaluation";
import type { D6RollResultV2 } from "../contracts/roll";

const ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;

export function resolveD6MatchingRewardPlan(
  policy: D6MatchingRewardPolicyV1 | undefined,
  input: Readonly<{
    evaluatorId: string;
    operationId: string;
    patternId: string;
    detectorId: string;
  }>,
): D6MatchingRewardPlanV1 | undefined {
  if (!policy?.enabled) return undefined;
  if (
    policy.evaluatorId !== input.evaluatorId ||
    policy.detectorId !== input.detectorId
  )
    return undefined;
  const award = policy.awards[input.patternId];
  if (!award?.enabled) return undefined;
  const amounts = [award.characterPoints, award.metaCurrency];
  if (
    amounts.some(
      (amount) =>
        !Number.isSafeInteger(amount) ||
        amount < 0 ||
        amount > D6_MATCHING_REWARD_MAX,
    ) ||
    amounts.every((amount) => amount === 0)
  )
    return undefined;
  return Object.freeze({
    characterPoints: award.characterPoints,
    evaluatorId: input.evaluatorId,
    metaCurrency: award.metaCurrency,
    operationId: input.operationId,
    patternId: input.patternId,
    patternLabel: award.patternLabel,
    detectorId: input.detectorId,
    version: policy.version,
  });
}

export function compareD6MatchingRankVectors(
  left: readonly number[],
  right: readonly number[],
): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? -1) - (right[index] ?? -1);
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * Appends an immutable Homebrew observation to an already-resolved numeric D6
 * result. It never changes totals, success, difficulty, opposition, Wild Die,
 * pool construction, resource spends, or retry evidence.
 */
export function observeD6MatchingCombination(
  result: D6RollResultV2,
  evaluator: D6MatchingEvaluatorV1,
): D6RollResultV2 {
  const rawFaces = Object.freeze([
    ...result.baseFaces,
    ...result.wildFaces,
    ...(result.characterPointFaces ?? []),
  ]);
  if (
    rawFaces.length < evaluator.pool.minimum ||
    rawFaces.length > evaluator.pool.maximum
  ) {
    return result;
  }
  return Object.freeze({
    ...result,
    matchingObservation: evaluateD6MatchingPool(evaluator, rawFaces, {
      mode: "best-combination",
    }),
  });
}

function stableEvaluatorHash(evaluator: D6MatchingEvaluatorV1): string {
  const canonicalJson = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
        .join(",")}}`;
    }
    return JSON.stringify(value);
  };
  const source = canonicalJson(evaluator);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

export function validateD6MatchingEvaluator(
  evaluator: D6MatchingEvaluatorV1,
): void {
  const version: unknown = evaluator.version;
  if (version !== D6_MATCHING_EVALUATOR_VERSION) {
    throw new TypeError("Unsupported matching evaluator version.");
  }
  if (!ID_PATTERN.test(evaluator.id) || !evaluator.label.trim()) {
    throw new TypeError("Matching evaluator identity is invalid.");
  }
  if (
    !Number.isSafeInteger(evaluator.pool.minimum) ||
    !Number.isSafeInteger(evaluator.pool.maximum) ||
    evaluator.pool.minimum < 1 ||
    evaluator.pool.maximum < evaluator.pool.minimum ||
    evaluator.pool.maximum > 12
  ) {
    throw new TypeError("Matching evaluator pool limits are invalid.");
  }
  const appliesTo: readonly unknown[] = evaluator.appliesTo;
  if (
    appliesTo.length === 0 ||
    appliesTo.some((kind) => kind !== "attribute" && kind !== "skill")
  ) {
    throw new TypeError("Matching evaluator roll scope is invalid.");
  }
  const source = evaluator.source as unknown as Record<string, unknown>;
  if (
    (source.kind !== "system" &&
      source.kind !== "world" &&
      source.kind !== "module") ||
    (source.kind === "module" &&
      (typeof source.ownerId !== "string" || !ID_PATTERN.test(source.ownerId)))
  ) {
    throw new TypeError("Matching evaluator source is invalid.");
  }
  const capabilities = evaluator.capabilities as unknown as Record<
    string,
    unknown
  >;
  if (
    capabilities.characterPoints !== false ||
    capabilities.fatePoints !== false ||
    capabilities.heroPoints !== false ||
    capabilities.pips !== false ||
    capabilities.resultModifiers !== false ||
    capabilities.retries !== false ||
    capabilities.specialDie !== "none"
  ) {
    throw new TypeError("Matching evaluator capabilities are invalid.");
  }
  const ids = new Set<string>();
  const precedences = new Set<number>();
  for (const pattern of evaluator.patterns) {
    if (!ID_PATTERN.test(pattern.id) || !pattern.label.trim()) {
      throw new TypeError("Matching pattern identity is invalid.");
    }
    if (ids.has(pattern.id)) {
      throw new TypeError(`Duplicate matching pattern id "${pattern.id}".`);
    }
    ids.add(pattern.id);
    if (!Number.isSafeInteger(pattern.precedence) || pattern.precedence < 0) {
      throw new TypeError(
        `Matching pattern "${pattern.id}" has invalid precedence.`,
      );
    }
    if (precedences.has(pattern.precedence)) {
      throw new TypeError(
        `Duplicate matching precedence ${pattern.precedence}.`,
      );
    }
    precedences.add(pattern.precedence);
    const enabled: unknown = pattern.enabled;
    if (typeof enabled !== "boolean") {
      throw new TypeError(
        `Matching pattern "${pattern.id}" has invalid enabled state.`,
      );
    }
    if (
      pattern.id !== evaluator.fallbackPatternId &&
      pattern.groups.length === 0
    ) {
      throw new TypeError(
        `Matching pattern "${pattern.id}" requires at least one group.`,
      );
    }
    if (
      pattern.groups.some(({ count, mode: typedMode }) => {
        const mode: unknown = typedMode;
        return (
          !Number.isSafeInteger(count) ||
          count < 2 ||
          count > 12 ||
          (mode !== "exact" && mode !== "minimum")
        );
      })
    ) {
      throw new TypeError(
        `Matching pattern "${pattern.id}" has invalid groups.`,
      );
    }
    if (
      pattern.groups.length > 6 ||
      pattern.groups.reduce((sum, { count }) => sum + count, 0) >
        evaluator.pool.maximum
    ) {
      throw new TypeError(
        `Matching pattern "${pattern.id}" cannot fit this pool.`,
      );
    }
  }
  const fallback = evaluator.patterns.find(
    ({ id }) => id === evaluator.fallbackPatternId,
  );
  if (!fallback) {
    throw new TypeError(
      "Matching evaluator requires an empty fallback pattern.",
    );
  }
  if (fallback.groups.length !== 0 || !fallback.enabled) {
    throw new TypeError(
      "Matching evaluator requires an empty fallback pattern.",
    );
  }
}

function normalizeFaces(faces: readonly number[]) {
  const rawFaces = Object.freeze(
    faces.map((face, index) => {
      if (!Number.isSafeInteger(face) || face < 1 || face > 6) {
        throw new RangeError(`Die ${index + 1} must be between 1 and 6.`);
      }
      return face;
    }),
  );
  const byFace = new Map<number, number[]>();
  rawFaces.forEach((face, index) => {
    const indices = byFace.get(face) ?? [];
    indices.push(index);
    byFace.set(face, indices);
  });
  const groups: readonly D6MatchingFaceGroupV1[] = Object.freeze(
    [...byFace.entries()]
      .map(([face, dieIndices]) =>
        Object.freeze({
          count: dieIndices.length,
          dieIndices: Object.freeze([...dieIndices]),
          face,
        }),
      )
      .sort(
        (left, right) => right.count - left.count || right.face - left.face,
      ),
  );
  return { groups, rawFaces };
}

function patternCandidates(
  pattern: D6MatchingPatternV1,
  groups: readonly D6MatchingFaceGroupV1[],
  rawFaces: readonly number[],
): readonly D6MatchingCandidateV1[] {
  if (pattern.groups.length === 0) {
    const unusedDieIndices = Object.freeze(rawFaces.map((_, index) => index));
    const unusedFaces = Object.freeze([...rawFaces].sort((a, b) => b - a));
    return [
      Object.freeze({
        consumedGroups: Object.freeze([]),
        patternId: pattern.id,
        patternLabel: pattern.label,
        precedence: pattern.precedence,
        rankVector: Object.freeze([pattern.precedence, ...unusedFaces]),
        unusedDieIndices,
        unusedFaces,
      }),
    ];
  }
  const candidates: D6MatchingCandidateV1[] = [];
  const choose = (
    requirementIndex: number,
    usedFaces: ReadonlySet<number>,
    consumed: readonly D6MatchingConsumedGroupV1[],
  ) => {
    const requirement = pattern.groups[requirementIndex];
    if (requirement === undefined) {
      const consumedIndices = new Set(
        consumed.flatMap(({ dieIndices }) => dieIndices),
      );
      const unusedDieIndices = Object.freeze(
        rawFaces.flatMap((_, index) =>
          consumedIndices.has(index) ? [] : [index],
        ),
      );
      const unusedFaces = Object.freeze(
        unusedDieIndices
          .flatMap((index) => {
            const face = rawFaces[index];
            return face === undefined ? [] : [face];
          })
          .sort((a, b) => b - a),
      );
      const rankVector = Object.freeze([
        pattern.precedence,
        ...consumed.map(({ face }) => face),
        ...unusedFaces,
      ]);
      candidates.push(
        Object.freeze({
          consumedGroups: Object.freeze([...consumed]),
          patternId: pattern.id,
          patternLabel: pattern.label,
          precedence: pattern.precedence,
          rankVector,
          unusedDieIndices,
          unusedFaces,
        }),
      );
      return;
    }
    for (const group of groups) {
      if (usedFaces.has(group.face)) continue;
      const valid =
        requirement.mode === "exact"
          ? group.count === requirement.count
          : group.count >= requirement.count;
      if (!valid) continue;
      const count =
        requirement.mode === "minimum" ? group.count : requirement.count;
      choose(requirementIndex + 1, new Set([...usedFaces, group.face]), [
        ...consumed,
        Object.freeze({
          count,
          dieIndices: Object.freeze(group.dieIndices.slice(0, count)),
          face: group.face,
          requiredCount: requirement.count,
          requirementMode: requirement.mode,
        }),
      ]);
    }
  };
  choose(0, new Set(), []);
  return candidates;
}

export function evaluateD6MatchingPool(
  evaluator: D6MatchingEvaluatorV1,
  faces: readonly number[],
  options: D6MatchingEvaluationOptionsV1 = { mode: "best-combination" },
): D6MatchingResultV1 {
  validateD6MatchingEvaluator(evaluator);
  if (
    faces.length < evaluator.pool.minimum ||
    faces.length > evaluator.pool.maximum
  ) {
    throw new RangeError(
      `Matching pool requires ${evaluator.pool.minimum}–${evaluator.pool.maximum} dice.`,
    );
  }
  const { groups, rawFaces } = normalizeFaces(faces);
  const candidates = Object.freeze(
    evaluator.patterns.flatMap((pattern) =>
      pattern.enabled ? patternCandidates(pattern, groups, rawFaces) : [],
    ),
  );
  const best = candidates.reduce((winner, candidate) =>
    compareD6MatchingRankVectors(candidate.rankVector, winner.rankVector) > 0
      ? candidate
      : winner,
  );
  let success: boolean | undefined;
  if (options.mode === "minimum-combination") {
    const target = evaluator.patterns.find(
      ({ enabled, id }) => enabled && id === options.targetPatternId,
    );
    if (target === undefined)
      throw new TypeError("Target combination is missing or unavailable.");
    success = best.precedence >= target.precedence;
  }
  return Object.freeze({
    best,
    candidates,
    contractVersion: D6_MATCHING_ROLL_CONTRACT_VERSION,
    evaluator: Object.freeze({
      evaluator: deepFreeze(structuredClone(evaluator)),
      hash: stableEvaluatorHash(evaluator),
      version: D6_MATCHING_EVALUATOR_VERSION,
    }),
    groups,
    mode: options.mode,
    rawFaces,
    kind: "matching-observation",
    ...(success === undefined ? {} : { success }),
    ...(options.targetPatternId === undefined
      ? {}
      : { targetPatternId: options.targetPatternId }),
  });
}
