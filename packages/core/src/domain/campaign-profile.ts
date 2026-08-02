import { PIPS_PER_DIE } from "./die-code";
import type { D6EquipmentEraSelection } from "../contracts/contributions";
import type { SecondEditionHeroPointStrategy } from "./hero-points";
import type { SecondEditionInitiativeStrategy } from "./initiative";
import {
  SUPERPOWER_CREATION_DICE,
  type SuperheroicDieCodeCap,
  type SuperpowerCampaignLevel,
} from "./superheroic";

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
  readonly cyberpunk?: boolean;
  readonly environments?: boolean;
  readonly fantasySkills?: boolean;
  readonly scienceFictionSkills?: boolean;
  readonly superheroicSkills?: boolean;
  readonly superheroicHeroPoints?: boolean;
  readonly superheroicDieCodeCap?: SuperheroicDieCodeCap | "none";
  readonly superpowers?: boolean;
  readonly gadgetsGear?: boolean;
  readonly superpowerLevel?: SuperpowerCampaignLevel;
  readonly secretIdentities?: boolean;
  readonly psionics?: boolean;
  readonly freeformSkillBasedMagic?: boolean;
  readonly magicPointsCasting?: boolean;
  readonly activeResponsiveCombat?: boolean;
  readonly hyperLethalCombat?: boolean;
  readonly heroPointStrategy?: SecondEditionHeroPointStrategy;
  readonly initiativeStrategy?: SecondEditionInitiativeStrategy;
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
  readonly cyberpunk: boolean;
  readonly environments: boolean;
  readonly fantasySkills: boolean;
  readonly scienceFictionSkills: boolean;
  readonly superheroicSkills: boolean;
  readonly superheroicHeroPoints: boolean;
  readonly superheroicDieCodeCap: SuperheroicDieCodeCap | "none";
  readonly superpowers: boolean;
  readonly gadgetsGear: boolean;
  readonly superpowerLevel: SuperpowerCampaignLevel;
  readonly superpowerCreationDice: number;
  readonly secretIdentities: boolean;
  readonly psionics: boolean;
  readonly freeformSkillBasedMagic: boolean;
  readonly magicPointsCasting: boolean;
  readonly activeResponsiveCombat: boolean;
  readonly equipmentEra: D6EquipmentEraSelection;
  readonly id: SecondEditionCampaignProfileId;
  readonly hyperLethalCombat: boolean;
  readonly heroPointStrategy: SecondEditionHeroPointStrategy;
  readonly initiativeStrategy: SecondEditionInitiativeStrategy;
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
  const cyberpunk =
    input.cyberpunk === true &&
    selected.has("technical") &&
    input.scienceFictionSkills === true;
  const environments = input.environments === true;
  const fantasySkills = input.fantasySkills === true;
  const scienceFictionSkills = input.scienceFictionSkills === true;
  const superheroicSkills = input.superheroicSkills === true;
  const superheroicHeroPoints = input.superheroicHeroPoints === true;
  const superheroicDieCodeCap = [
    "young",
    "street",
    "standard",
    "national",
    "worldwide",
    "cosmic",
  ].includes(input.superheroicDieCodeCap ?? "none")
    ? (input.superheroicDieCodeCap ?? "none")
    : "none";
  const superpowers = input.superpowers === true && perksFlawsTalents;
  const gadgetsGear = input.gadgetsGear === true && superpowers;
  const superpowerLevel = [
    "young",
    "street",
    "standard",
    "national",
    "worldwide",
    "cosmic",
  ].includes(input.superpowerLevel ?? "standard")
    ? (input.superpowerLevel ?? "standard")
    : "standard";
  const secretIdentities = input.secretIdentities === true;
  const psionics = input.psionics === true;
  const freeformSkillBasedMagic =
    input.freeformSkillBasedMagic === true &&
    selected.has("magic") &&
    (skillSpecializationAdvancedSkills || input.magicPointsCasting === true);
  const magicPointsCasting =
    input.magicPointsCasting === true &&
    selected.has("magic") &&
    freeformSkillBasedMagic;
  const activeResponsiveCombat = input.activeResponsiveCombat === true;
  const hyperLethalCombat = input.hyperLethalCombat === true;
  const heroPointStrategy: SecondEditionHeroPointStrategy =
    input.heroPointStrategy === "basic" || input.heroPointStrategy === "classic"
      ? input.heroPointStrategy
      : "heroic";
  const noDodgeDefense = input.noDodgeDefense === true;
  const initiativeStrategy: SecondEditionInitiativeStrategy = [
    "simple",
    "basic",
    "narrative",
  ].includes(input.initiativeStrategy ?? "standard")
    ? (input.initiativeStrategy ?? "standard")
    : "standard";
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
    ...(cyberpunk ? ["rules.cyberpunk"] : []),
    ...(environments ? ["rules.environments"] : []),
    ...(fantasySkills ? ["skills.fantasy"] : []),
    ...(scienceFictionSkills ? ["skills.science-fiction"] : []),
    ...(superheroicSkills ? ["skills.superheroic"] : []),
    ...(superheroicHeroPoints ? ["rules.hero-points.superheroic"] : []),
    ...(superheroicDieCodeCap === "none"
      ? []
      : [`rules.die-code-cap.${superheroicDieCodeCap}`]),
    ...(secretIdentities ? ["rules.secret-identities"] : []),
    ...(superpowers ? [`rules.superpowers.${superpowerLevel}`] : []),
    ...(gadgetsGear ? ["rules.gadgets-gear"] : []),
    ...(psionics ? ["rules.psionics"] : []),
    ...(freeformSkillBasedMagic ? ["magic.freeform-skill-based"] : []),
    ...(magicPointsCasting ? ["magic.points-casting"] : []),
    ...(activeResponsiveCombat ? ["combat.active-responsive"] : []),
    ...(hyperLethalCombat ? ["rules.hyper-lethal-combat"] : []),
    `rules.hero-points.${heroPointStrategy}`,
    `rules.initiative.${initiativeStrategy}`,
    ...(noDodgeDefense ? ["rules.no-dodge-defense"] : []),
    ...(equipmentEra === "none" ? [] : [`rules.equipment.${equipmentEra}`]),
  ]);

  return Object.freeze({
    activeAttributeIds,
    additionalSkillModuleCount,
    creation: Object.freeze({
      attributeBudgetScore:
        (12 + optionalAttributeIds.length * 3) * PIPS_PER_DIE,
      skillBudgetScore:
        (7 + additionalSkillModuleCount * 2 + (superheroicSkills ? 1 : 0)) *
        PIPS_PER_DIE,
    }),
    id:
      optionalAttributeIds.length === 0 &&
      additionalSkillModuleCount === 0 &&
      !skillSpecializationAdvancedSkills &&
      !perksFlawsTalents &&
      !troublesAssets &&
      !chases &&
      !cyberpunk &&
      !environments &&
      !fantasySkills &&
      !scienceFictionSkills &&
      !superheroicSkills &&
      !superheroicHeroPoints &&
      superheroicDieCodeCap === "none" &&
      !secretIdentities &&
      !superpowers &&
      !gadgetsGear &&
      !psionics &&
      !freeformSkillBasedMagic &&
      !magicPointsCasting &&
      !activeResponsiveCombat &&
      !hyperLethalCombat &&
      heroPointStrategy === "heroic" &&
      initiativeStrategy === "standard" &&
      !noDodgeDefense &&
      equipmentEra === "none" &&
      !pipsModule
        ? "core-default"
        : "custom",
    moduleIds,
    hyperLethalCombat,
    heroPointStrategy,
    initiativeStrategy,
    noDodgeDefense,
    chases,
    cyberpunk,
    environments,
    fantasySkills,
    scienceFictionSkills,
    superheroicSkills,
    superheroicHeroPoints,
    superheroicDieCodeCap,
    superpowers,
    gadgetsGear,
    superpowerLevel,
    superpowerCreationDice: superpowers
      ? SUPERPOWER_CREATION_DICE[superpowerLevel]
      : 0,
    secretIdentities,
    psionics,
    freeformSkillBasedMagic,
    magicPointsCasting,
    activeResponsiveCombat,
    equipmentEra,
    perksFlawsTalents,
    pipsModule,
    profileVersion: D6_SECOND_EDITION_CAMPAIGN_PROFILE_VERSION,
    skillSpecializationAdvancedSkills,
    troublesAssets,
  });
}
