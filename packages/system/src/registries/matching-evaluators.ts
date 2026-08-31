import {
  validateD6MatchingEvaluator,
  type D6MatchingEvaluatorV1,
  type D6RulesProfileV4,
  type D6MatchingEvaluatorContributionV1,
  type D6System2eMatchingEvaluatorRegistry,
} from "@d6-system-2e/core";

export const D6_NEXUS_MATCHING_DETECTOR_ID =
  "d6-nexus.matching-detector.matches-v1" as const;
export const WORLD_MATCHING_DETECTOR_PREFIX =
  "world.matching-detector." as const;

const ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;

const MATCHING_EVALUATOR: D6MatchingEvaluatorV1 = Object.freeze({
  appliesTo: Object.freeze(["attribute", "skill"] as const),
  capabilities: Object.freeze({
    characterPoints: false,
    fatePoints: false,
    heroPoints: false,
    pips: false,
    resultModifiers: false,
    retries: false,
    specialDie: "none" as const,
  }),
  fallbackPatternId: "none",
  id: "d6-nexus.matches-v1",
  label: "D6E2.Roll.Matching.Evaluator.D6Nexus",
  patterns: Object.freeze([
    Object.freeze({
      enabled: true,
      groups: Object.freeze([]),
      id: "none",
      label: "D6E2.Roll.Matching.Pattern.NoMatch",
      precedence: 0,
    }),
    Object.freeze({
      enabled: true,
      groups: Object.freeze([{ count: 2, mode: "minimum" as const }]),
      id: "pair",
      label: "D6E2.Roll.Matching.Pattern.Pair",
      precedence: 1,
    }),
    Object.freeze({
      enabled: true,
      groups: Object.freeze([
        { count: 2, mode: "minimum" as const },
        { count: 2, mode: "minimum" as const },
      ]),
      id: "two-pair",
      label: "D6E2.Roll.Matching.Pattern.TwoPair",
      precedence: 2,
    }),
    Object.freeze({
      enabled: true,
      groups: Object.freeze([{ count: 3, mode: "minimum" as const }]),
      id: "three-kind",
      label: "D6E2.Roll.Matching.Pattern.ThreeKind",
      precedence: 3,
    }),
    Object.freeze({
      enabled: true,
      groups: Object.freeze([
        { count: 3, mode: "minimum" as const },
        { count: 2, mode: "minimum" as const },
      ]),
      id: "full-house",
      label: "D6E2.Roll.Matching.Pattern.FullHouse",
      precedence: 4,
    }),
    Object.freeze({
      enabled: true,
      groups: Object.freeze([{ count: 4, mode: "minimum" as const }]),
      id: "four-kind",
      label: "D6E2.Roll.Matching.Pattern.FourKind",
      precedence: 5,
    }),
    Object.freeze({
      enabled: true,
      groups: Object.freeze([{ count: 5, mode: "minimum" as const }]),
      id: "five-kind",
      label: "D6E2.Roll.Matching.Pattern.FiveKind",
      precedence: 6,
    }),
    Object.freeze({
      enabled: true,
      groups: Object.freeze([{ count: 6, mode: "minimum" as const }]),
      id: "six-kind",
      label: "D6E2.Roll.Matching.Pattern.SixKind",
      precedence: 7,
    }),
  ]),
  pool: Object.freeze({ maximum: 12, minimum: 1 }),
  source: Object.freeze({ kind: "system" as const }),
  version: 1,
});

const BUILT_INS = Object.freeze([
  Object.freeze({
    evaluator: MATCHING_EVALUATOR,
    id: D6_NEXUS_MATCHING_DETECTOR_ID,
    label: "D6E2.Roll.Matching.Evaluator.D6Nexus",
    version: 1 as const,
  }),
]);

const byOwner = new Map<
  string,
  Map<string, D6MatchingEvaluatorContributionV1>
>();

function validateContribution(
  ownerId: string,
  contribution: D6MatchingEvaluatorContributionV1,
) {
  if (
    !ID_PATTERN.test(ownerId) ||
    !ID_PATTERN.test(contribution.id) ||
    !contribution.label.trim()
  ) {
    throw new TypeError("Matching-evaluator identity is invalid.");
  }
  if (
    !contribution.id.startsWith(`${ownerId}.`) ||
    !contribution.evaluator.id.startsWith(`${ownerId}.`)
  ) {
    throw new TypeError(
      "Matching-evaluator identity must use its owner namespace.",
    );
  }
  validateD6MatchingEvaluator(contribution.evaluator);
  if (
    contribution.evaluator.source.kind !== "module" ||
    contribution.evaluator.source.ownerId !== ownerId
  ) {
    throw new TypeError(
      "Matching evaluator source must match its registered owner.",
    );
  }
}

export function matchingDetector(
  id: string,
): D6MatchingEvaluatorContributionV1 | null {
  const builtIn = BUILT_INS.find((entry) => entry.id === id);
  if (builtIn) return builtIn;
  for (const entries of byOwner.values()) {
    const contribution = entries.get(id);
    if (contribution) return contribution;
  }
  return null;
}

export function worldMatchingDetectorId(evaluatorId: string): string {
  return `${WORLD_MATCHING_DETECTOR_PREFIX}${evaluatorId}`;
}

export function matchingDetectorForProfile(
  profile: D6RulesProfileV4,
  id: string = D6_NEXUS_MATCHING_DETECTOR_ID,
): D6MatchingEvaluatorContributionV1 | null {
  const registered = matchingDetector(id);
  if (registered) return registered;
  if (!id.startsWith(WORLD_MATCHING_DETECTOR_PREFIX)) return null;
  const evaluatorId = id.slice(WORLD_MATCHING_DETECTOR_PREFIX.length);
  const evaluator = profile.matchingEvaluators.find(
    (candidate) =>
      candidate.id === evaluatorId && candidate.source.kind === "world",
  );
  return evaluator
    ? Object.freeze({
        evaluator,
        id,
        label: evaluator.label,
        version: 1 as const,
      })
    : null;
}

export const matchingEvaluatorRegistry: D6System2eMatchingEvaluatorRegistry =
  Object.freeze({
    current: () =>
      Object.freeze([
        ...BUILT_INS,
        ...[...byOwner.values()].flatMap((entries) => [...entries.values()]),
      ]),
    register: (
      ownerId: string,
      contribution: D6MatchingEvaluatorContributionV1,
    ) => {
      if (matchingDetector(contribution.id)) {
        throw new RangeError(
          `Matching evaluator "${contribution.id}" is already registered.`,
        );
      }
      validateContribution(ownerId, contribution);
      const entries =
        byOwner.get(ownerId) ??
        new Map<string, D6MatchingEvaluatorContributionV1>();
      entries.set(
        contribution.id,
        Object.freeze(structuredClone(contribution)),
      );
      byOwner.set(ownerId, entries);
      Hooks.callAll?.("d6e2MatchingEvaluatorsChanged");
    },
    unregisterOwner: (ownerId: string) => {
      byOwner.delete(ownerId);
      Hooks.callAll?.("d6e2MatchingEvaluatorsChanged");
    },
  });

export function resetMatchingEvaluatorRegistryForTests(): void {
  byOwner.clear();
}
