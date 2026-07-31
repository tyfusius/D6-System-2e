import { PIPS_PER_DIE } from "./die-code";
import type { D6EquipmentEraSelection } from "../contracts/contributions";

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
  readonly chases?: boolean;
  readonly environments?: boolean;
  readonly noDodgeDefense?: boolean;
  readonly equipmentEra?: D6EquipmentEraSelection;
  readonly perksFlawsTalents?: boolean;
  readonly optionalAttributeIds: readonly string[];
  readonly pipsModule: boolean;
  readonly skillSpecializationAdvancedSkills: boolean;
  readonly troublesAssets?: boolean;
}

export interface SecondEditionCampaignProfileV1 {
  readonly activeAttributeIds: readonly string[];
  readonly additionalSkillModuleCount: number;
  readonly creation: {
    readonly attributeBudgetScore: number;
    readonly skillBudgetScore: number;
  };
  readonly chases: boolean;
  readonly environments: boolean;
  readonly equipmentEra: D6EquipmentEraSelection;
  readonly id: SecondEditionCampaignProfileId;
  readonly moduleIds: readonly string[];
  readonly noDodgeDefense: boolean;
  readonly profileVersion: typeof D6_SECOND_EDITION_CAMPAIGN_PROFILE_VERSION;
  readonly perksFlawsTalents: boolean;
  readonly pipsModule: boolean;
  readonly skillSpecializationAdvancedSkills: boolean;
  readonly troublesAssets: boolean;
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
  const perksFlawsTalents = input.perksFlawsTalents === true;
  const troublesAssets = input.troublesAssets === true;
  const pipsModule = input.pipsModule;
  const chases = input.chases === true;
  const environments = input.environments === true;
  const noDodgeDefense = input.noDodgeDefense === true;
  const equipmentEra: D6EquipmentEraSelection = [
    "medieval",
    "modern",
    "science-fiction",
  ].includes(input.equipmentEra ?? "none")
    ? (input.equipmentEra ?? "none")
    : "none";
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
    ...(perksFlawsTalents ? ["features.perks-flaws-talents"] : []),
    ...(troublesAssets ? ["features.troubles-assets"] : []),
    ...(pipsModule ? ["rules.pips"] : []),
    ...(chases ? ["rules.chases"] : []),
    ...(environments ? ["rules.environments"] : []),
    ...(noDodgeDefense ? ["rules.no-dodge-defense"] : []),
    ...(equipmentEra === "none" ? [] : [`rules.equipment.${equipmentEra}`]),
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
      !skillSpecializationAdvancedSkills &&
      !perksFlawsTalents &&
      !troublesAssets &&
      !chases &&
      !environments &&
      !noDodgeDefense &&
      equipmentEra === "none" &&
      !pipsModule
        ? "core-default"
        : "custom",
    moduleIds,
    noDodgeDefense,
    chases,
    environments,
    equipmentEra,
    perksFlawsTalents,
    pipsModule,
    profileVersion: D6_SECOND_EDITION_CAMPAIGN_PROFILE_VERSION,
    skillSpecializationAdvancedSkills,
    troublesAssets,
  });
}
