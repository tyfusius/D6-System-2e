import {
  D6_MATCHING_REWARD_MAX,
  type D6MatchingRewardPolicyV1,
  type D6RulesProfileV4,
} from "@d6-system-2e/core";
import {
  currentTerminology,
  terminologyResourceLabel,
  type ResourceTerminologyId,
} from "../registries/terminology";
import { currentMetaCurrencyRuntimeStrategy } from "./roll-outcome";
import {
  D6_NEXUS_MATCHING_DETECTOR_ID,
  matchingDetectorForProfile,
} from "../registries/matching-evaluators";

export interface MatchingRewardCapture {
  readonly invalid: readonly HTMLInputElement[];
  readonly profile: D6RulesProfileV4;
}

export function captureMatchingRewardFields(
  profile: D6RulesProfileV4,
  form: HTMLFormElement,
  detectorId?: string,
): MatchingRewardCapture {
  const currentResolutionId =
    detectorId ??
    profile.homebrew.matchingRewards?.find(({ enabled }) => enabled)
      ?.detectorId ??
    profile.homebrew.matchingRewards?.[0]?.detectorId ??
    D6_NEXUS_MATCHING_DETECTOR_ID;
  const selectedMatching = matchingDetectorForProfile(
    profile,
    currentResolutionId,
  );
  if (!selectedMatching) {
    return Object.freeze({ invalid: Object.freeze([]), profile });
  }
  const master = form.querySelector<HTMLInputElement>(
    '[name="homebrew.matchingRewards.enabled"]',
  );
  if (!master) return Object.freeze({ invalid: Object.freeze([]), profile });
  const rows = Array.from(
    form.querySelectorAll<HTMLElement>("[data-matching-reward-row]"),
  );
  const invalid: HTMLInputElement[] = [];
  const currentPolicy = profile.homebrew.matchingRewards?.find(
    (policy) =>
      policy.detectorId === currentResolutionId &&
      policy.evaluatorId === selectedMatching.evaluator.id,
  );
  const visibleIds = new Set(rows.map((row) => row.dataset.patternId ?? ""));
  const removedIds = new Set(
    Array.from(
      form.querySelectorAll<HTMLElement>(
        '[data-unavailable-reward][data-removed="true"]',
      ),
    ).map((row) => row.dataset.patternId ?? ""),
  );
  const retainedUnavailable = Object.fromEntries(
    Object.entries(currentPolicy?.awards ?? {}).filter(
      ([id]) => !visibleIds.has(id) && !removedIds.has(id),
    ),
  );
  const awards = {
    ...retainedUnavailable,
    ...Object.fromEntries(
      rows.map((row) => {
        const id = row.dataset.patternId ?? "";
        const enabled =
          row.querySelector<HTMLInputElement>("[data-reward-enabled]")
            ?.checked === true;
        const numeric = (kind: "meta" | "cp"): number => {
          const input = row.querySelector<HTMLInputElement>(
            `[data-reward-${kind}]`,
          );
          const raw = input?.value.trim() ?? "";
          const value = Number(raw);
          input?.removeAttribute("aria-invalid");
          if (
            !raw ||
            !Number.isSafeInteger(value) ||
            value < 0 ||
            value > D6_MATCHING_REWARD_MAX
          ) {
            if (input) invalid.push(input);
            return 0;
          }
          return value;
        };
        const metaCurrency = numeric("meta");
        const characterPoints = numeric("cp");
        if (
          master.checked &&
          enabled &&
          metaCurrency === 0 &&
          characterPoints === 0
        ) {
          const first = row.querySelector<HTMLInputElement>(
            "[data-reward-meta], [data-reward-cp]",
          );
          if (first) invalid.push(first);
        }
        return [
          id,
          Object.freeze({
            characterPoints,
            enabled,
            metaCurrency,
            patternLabel: row.dataset.patternLabel ?? id,
            sourceLabel: row.dataset.sourceLabel ?? "",
          }),
        ];
      }),
    ),
  };
  if (invalid.length > 0) {
    return Object.freeze({ invalid: Object.freeze(invalid), profile });
  }
  const policy: D6MatchingRewardPolicyV1 = Object.freeze({
    awards: Object.freeze(awards),
    enabled: master.checked,
    evaluatorId: selectedMatching.evaluator.id,
    detectorId: currentResolutionId,
    version: 1,
  });
  const retained = (profile.homebrew.matchingRewards ?? []).filter(
    (entry) =>
      entry.detectorId !== policy.detectorId ||
      entry.evaluatorId !== policy.evaluatorId,
  );
  return Object.freeze({
    invalid: Object.freeze([]),
    profile: Object.freeze({
      ...profile,
      homebrew: Object.freeze({
        ...profile.homebrew,
        matchingRewards: Object.freeze([...retained, policy]),
      }),
    }),
  });
}

export function buildMatchingHomebrewContext(
  profile: D6RulesProfileV4,
): Record<string, unknown> {
  const localized = (key: string): string => game.i18n.localize(key);
  const selectedResolution =
    profile.homebrew.matchingRewards?.find(({ enabled }) => enabled)
      ?.detectorId ??
    profile.homebrew.matchingRewards?.[0]?.detectorId ??
    D6_NEXUS_MATCHING_DETECTOR_ID;
  const selectedMatching = matchingDetectorForProfile(
    profile,
    selectedResolution,
  );
  const terminology = currentTerminology();
  const configuredMeta = currentMetaCurrencyRuntimeStrategy();
  const metaResource: ResourceTerminologyId =
    profile.strategies.metaCurrency ===
    "open-d6.meta-currency.character-and-fate-points"
      ? "fatePoints"
      : configuredMeta.primaryResource === "experiencePoints"
        ? "experiencePoints"
        : "heroPoints";
  const metaCurrencyLabel = terminologyResourceLabel(terminology, metaResource);
  const characterPointsLabel = terminologyResourceLabel(
    terminology,
    "characterPoints",
  );
  const selectedPolicies = (profile.homebrew.matchingRewards ?? []).filter(
    (policy) => policy.detectorId === selectedResolution,
  );
  const selectedEvaluatorId = selectedMatching?.evaluator.id;
  const rewardPolicy =
    selectedPolicies.find(
      (policy) => policy.evaluatorId === selectedEvaluatorId,
    ) ?? selectedPolicies[0];
  const rewardRows = selectedMatching
    ? selectedMatching.evaluator.patterns.map((pattern, index) => {
        const saved = rewardPolicy?.awards[pattern.id];
        const characterPoints = saved?.characterPoints ?? 0;
        const metaCurrency = saved?.metaCurrency ?? 0;
        return {
          advanced: pattern.id === selectedMatching.evaluator.fallbackPatternId,
          characterPoints,
          enabled: saved?.enabled === true,
          id: pattern.id,
          inputId: `d6e2-matching-reward-${index}`,
          label: localized(pattern.label),
          metaCurrency,
          sourceLabel: localized(selectedMatching.evaluator.label),
          sentence: game.i18n.format(
            "D6E2.Settings.RulesProfile.Rewards.RowSentence",
            {
              characterPointsLabel,
              cp: characterPoints,
              label: localized(pattern.label),
              meta: metaCurrency,
              metaLabel: metaCurrencyLabel,
            },
          ),
        };
      })
    : [];
  const availableIds = new Set(rewardRows.map(({ id }) => id));
  const unavailable = Object.entries(rewardPolicy?.awards ?? {})
    .filter(([id]) => !availableIds.has(id))
    .map(([id, award]) => ({
      canRemove: Boolean(selectedMatching),
      id,
      label: award.patternLabel,
      removeLabel: game.i18n.format(
        "D6E2.Settings.RulesProfile.Rewards.RemoveNamed",
        { label: award.patternLabel },
      ),
      sourceLabel: award.sourceLabel,
    }));
  const configuredCount = rewardRows.filter(
    (row) => row.enabled && (row.metaCurrency > 0 || row.characterPoints > 0),
  ).length;
  return {
    rewards: {
      available: Boolean(selectedMatching),
      characterPointsLabel,
      configuredClass:
        !selectedMatching || rewardPolicy?.enabled === true
          ? ""
          : "is-collapsed",
      configuredCount,
      enabled: rewardPolicy?.enabled === true,
      fallback: rewardRows.filter((row) => row.advanced),
      maximum: D6_MATCHING_REWARD_MAX,
      metaCurrencyLabel,
      named: rewardRows.filter((row) => !row.advanced),
      scope: rewardPolicy
        ? `${rewardPolicy.detectorId}\u0000${rewardPolicy.evaluatorId}`
        : selectedMatching
          ? `${selectedResolution}\u0000${selectedMatching.evaluator.id}`
          : "",
      unavailable,
    },
  };
}
