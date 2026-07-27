import { PIPS_PER_DIE } from "./die-code";

export const D6_SECOND_EDITION_CAMPAIGN_PROFILE_VERSION = 1 as const;

export const SECOND_EDITION_CORE_ATTRIBUTE_IDS = Object.freeze([
  "agility",
  "brawn",
  "knowledge",
  "perception",
]);

export const SECOND_EDITION_OPTIONAL_ATTRIBUTE_IDS = Object.freeze([
  "mechanical",
  "technical",
  "charm",
  "magic",
  "mysticism",
]);

export type SecondEditionCampaignProfileId = "core-default" | "custom";

export interface SecondEditionCampaignProfileInput {
  readonly additionalSkillModuleCount: number;
  readonly optionalAttributeIds: readonly string[];
  readonly skillSpecializationAdvancedSkills: boolean;
}

export interface SecondEditionCampaignProfileV1 {
  readonly activeAttributeIds: readonly string[];
  readonly additionalSkillModuleCount: number;
  readonly creation: {
    readonly attributeBudgetScore: number;
    readonly skillBudgetScore: number;
  };
  readonly id: SecondEditionCampaignProfileId;
  readonly moduleIds: readonly string[];
  readonly profileVersion: typeof D6_SECOND_EDITION_CAMPAIGN_PROFILE_VERSION;
  readonly skillSpecializationAdvancedSkills: boolean;
}

function wholeNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function resolveSecondEditionCampaignProfile(
  input: SecondEditionCampaignProfileInput,
): SecondEditionCampaignProfileV1 {
  const selected = new Set(
    input.optionalAttributeIds.filter((id) =>
      SECOND_EDITION_OPTIONAL_ATTRIBUTE_IDS.includes(id),
    ),
  );
  const optionalAttributeIds = SECOND_EDITION_OPTIONAL_ATTRIBUTE_IDS.filter(
    (id) => selected.has(id),
  );
  const additionalSkillModuleCount = wholeNonNegative(
    input.additionalSkillModuleCount,
  );
  const skillSpecializationAdvancedSkills =
    input.skillSpecializationAdvancedSkills;
  const activeAttributeIds = Object.freeze([
    ...SECOND_EDITION_CORE_ATTRIBUTE_IDS,
    ...optionalAttributeIds,
  ]);
  const moduleIds = Object.freeze([
    "core.second-edition",
    ...optionalAttributeIds.map((id) => `attribute.${id}`),
    ...(skillSpecializationAdvancedSkills
      ? ["skill.specialization-advanced-skills"]
      : []),
  ]);

  return Object.freeze({
    activeAttributeIds,
    additionalSkillModuleCount,
    creation: Object.freeze({
      attributeBudgetScore:
        (12 + optionalAttributeIds.length * 3) * PIPS_PER_DIE,
      skillBudgetScore: (7 + additionalSkillModuleCount * 2) * PIPS_PER_DIE,
    }),
    id:
      optionalAttributeIds.length === 0 &&
      additionalSkillModuleCount === 0 &&
      !skillSpecializationAdvancedSkills
        ? "core-default"
        : "custom",
    moduleIds,
    profileVersion: D6_SECOND_EDITION_CAMPAIGN_PROFILE_VERSION,
    skillSpecializationAdvancedSkills,
  });
}
