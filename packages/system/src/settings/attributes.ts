import { currentSecondEditionCampaignProfile } from "./campaign-profile";
import { currentFirstEditionGenreProfile } from "./first-edition-genre-profile";
import { currentConfiguredRulesProfile } from "./rules-profile-library";
import {
  currentSettingActiveAttributes,
  currentSettingProfile,
} from "./setting-profile";

export type D6AttributeRuntimeStrategyId =
  "d6e2.attributes.campaign-profile" | "open-d6.attributes.six-attribute";

export type D6AttributeRole = "initiative" | "knowledge" | "strength";

export interface D6AttributeDefinition {
  readonly id: string;
  readonly label: string;
}

export interface D6AttributeRuntimeStrategy {
  readonly catalog: "second-edition-universal" | "open-d6-genre";
  readonly creation: "second-edition-campaign" | "open-d6-genre";
  readonly family: "open-d6" | "second-edition";
  readonly id: D6AttributeRuntimeStrategyId;
  readonly visibility: "active-setting-profile";
}

const ATTRIBUTE_RUNTIME_STRATEGIES = Object.freeze({
  "d6e2.attributes.campaign-profile": Object.freeze({
    catalog: "second-edition-universal",
    creation: "second-edition-campaign",
    family: "second-edition",
    id: "d6e2.attributes.campaign-profile",
    visibility: "active-setting-profile",
  }),
  "open-d6.attributes.six-attribute": Object.freeze({
    catalog: "open-d6-genre",
    creation: "open-d6-genre",
    family: "open-d6",
    id: "open-d6.attributes.six-attribute",
    visibility: "active-setting-profile",
  }),
} as const satisfies Readonly<
  Record<D6AttributeRuntimeStrategyId, D6AttributeRuntimeStrategy>
>);

export function attributeRuntimeStrategy(
  strategyId: string,
): D6AttributeRuntimeStrategy {
  return (
    Object.values(ATTRIBUTE_RUNTIME_STRATEGIES).find(
      ({ id }) => id === strategyId,
    ) ?? ATTRIBUTE_RUNTIME_STRATEGIES["d6e2.attributes.campaign-profile"]
  );
}

export function currentAttributeRuntimeStrategy(): D6AttributeRuntimeStrategy {
  const configured = currentConfiguredRulesProfile().strategies.attributes;
  return attributeRuntimeStrategy(configured);
}

export function currentActiveAttributeDefinitions(): readonly D6AttributeDefinition[] {
  return Object.freeze(
    currentSettingActiveAttributes().map(({ id, label }) =>
      Object.freeze({ id, label }),
    ),
  );
}

export function currentTemplateAttributeDefinitions(): readonly D6AttributeDefinition[] {
  return Object.freeze(
    currentSettingProfile().attributes.map(({ id, label }) =>
      Object.freeze({ id, label }),
    ),
  );
}

export function currentAttributeRole(role: D6AttributeRole): string {
  const strategy = currentAttributeRuntimeStrategy();
  if (strategy.family === "open-d6") {
    return currentFirstEditionGenreProfile().roles[role];
  }
  if (
    role === "strength" &&
    currentSettingActiveAttributes().some(({ id }) => id === "strength")
  ) {
    return "strength";
  }
  return role === "strength" ? "brawn" : role;
}

export interface D6AttributeCreationRuntime {
  readonly activeAttributes: readonly D6AttributeDefinition[];
  readonly attributeBudgetScore: number;
  readonly skillBudgetScore: number;
}

export function currentAttributeCreationRuntime(): D6AttributeCreationRuntime {
  const strategy = currentAttributeRuntimeStrategy();
  const activeAttributes = currentActiveAttributeDefinitions();
  if (strategy.creation === "open-d6-genre") {
    const genre = currentFirstEditionGenreProfile();
    return Object.freeze({
      activeAttributes,
      attributeBudgetScore: genre.attributeBudgetScore,
      skillBudgetScore: genre.skillBudgetScore,
    });
  }
  const campaign = currentSecondEditionCampaignProfile();
  const creation = (
    campaign as Partial<typeof campaign> & {
      readonly creation?: {
        readonly attributeBudgetScore?: number;
        readonly skillBudgetScore?: number;
      };
    }
  ).creation;
  return Object.freeze({
    activeAttributes,
    attributeBudgetScore: Number.isSafeInteger(creation?.attributeBudgetScore)
      ? Number(creation?.attributeBudgetScore)
      : 36,
    skillBudgetScore: Number.isSafeInteger(creation?.skillBudgetScore)
      ? Number(creation?.skillBudgetScore)
      : 21,
  });
}
