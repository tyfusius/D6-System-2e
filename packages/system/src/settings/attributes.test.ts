import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  attributeRuntimeStrategy,
  currentActiveAttributeDefinitions,
  currentAttributeCreationRuntime,
  currentAttributeRole,
  currentAttributeRuntimeStrategy,
  currentTemplateAttributeDefinitions,
} from "./attributes";

let configured = "d6e2.attributes.campaign-profile";
const settings = new Map<string, unknown>();

vi.mock("./rules-profile-library", () => ({
  currentConfiguredRulesProfile: () => ({
    strategies: { attributes: configured },
  }),
}));

vi.mock("./campaign-profile", () => ({
  currentSecondEditionCampaignProfile: () => ({
    creation: { attributeBudgetScore: 45, skillBudgetScore: 24 },
  }),
}));

vi.mock("./first-edition-genre-profile", () => ({
  currentFirstEditionGenreProfile: () => ({
    attributeBudgetScore: 54,
    roles: {
      initiative: "perception",
      knowledge: "knowledge",
      strength: "physique",
    },
    skillBudgetScore: 21,
  }),
}));

vi.mock("./setting-profile", () => ({
  currentSettingActiveAttributes: () => [
    { active: true, id: "agility", label: "Grace" },
    { active: true, id: "brawn", label: "Might" },
  ],
  currentSettingProfile: () => ({
    attributes: [
      { active: true, id: "agility", label: "Grace" },
      { active: true, id: "brawn", label: "Might" },
      { active: false, id: "magic", label: "Arcana" },
    ],
  }),
}));

beforeEach(() => {
  configured = "d6e2.attributes.campaign-profile";
  settings.clear();
  vi.stubGlobal("game", {
    settings: { get: (_namespace: string, key: string) => settings.get(key) },
  });
});

describe("Attribute runtime strategies", () => {
  it("publishes immutable family, catalog, creation, and visibility contracts", () => {
    expect(
      attributeRuntimeStrategy("open-d6.attributes.six-attribute"),
    ).toEqual({
      catalog: "open-d6-genre",
      creation: "open-d6-genre",
      family: "open-d6",
      id: "open-d6.attributes.six-attribute",
      visibility: "active-setting-profile",
    });
    expect(Object.isFrozen(attributeRuntimeStrategy(configured))).toBe(true);
  });

  it("fails closed to the Second Edition Attribute family", () => {
    configured = "community.attributes.unknown";
    expect(currentAttributeRuntimeStrategy().id).toBe(
      "d6e2.attributes.campaign-profile",
    );
  });

  it("keeps active visibility separate from the lossless template catalog", () => {
    expect(currentActiveAttributeDefinitions().map(({ id }) => id)).toEqual([
      "agility",
      "brawn",
    ]);
    expect(currentTemplateAttributeDefinitions().map(({ id }) => id)).toEqual([
      "agility",
      "brawn",
      "magic",
    ]);
  });

  it("resolves Second Edition budgets and semantic roles", () => {
    expect(currentAttributeCreationRuntime()).toMatchObject({
      attributeBudgetScore: 45,
      skillBudgetScore: 24,
    });
    expect(currentAttributeRole("strength")).toBe("brawn");
  });

  it("honors imported Open D6 budgets and genre-owned roles", () => {
    configured = "open-d6.attributes.six-attribute";
    expect(currentAttributeRuntimeStrategy().family).toBe("open-d6");
    expect(currentAttributeCreationRuntime()).toMatchObject({
      attributeBudgetScore: 54,
      skillBudgetScore: 21,
    });
    expect(currentAttributeRole("strength")).toBe("physique");
  });
});
