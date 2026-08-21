import { describe, expect, it, vi } from "vitest";
import type { D6System2eResolvedTerminology } from "@d6-system-2e/core";
import {
  applyDocumentTypeTerminology,
  documentTypeLabelProjection,
} from "./document-type-terminology";

const terminology = {
  actors: {
    character: { plural: "Heroes", singular: "Hero" },
    starship: { plural: "Spaceships", singular: "Spaceship" },
  },
  attributes: {},
  bodyPoints: {},
  conditions: { states: {} },
  details: {},
  items: {
    gear: { plural: "Supplies", singular: "Supply" },
    specialAbility: "Gift",
    weapon: { plural: "Arms", singular: "Arm" },
  },
  machines: {},
  manifestations: {},
  metaphysics: { skills: {} },
  resources: {},
  wounds: { states: {} },
} satisfies D6System2eResolvedTerminology;

describe("Foundry document type terminology projection", () => {
  it("uses profile singular labels without changing stable document types", () => {
    const labels = documentTypeLabelProjection(
      terminology,
      (key) => `localized:${key}`,
    );

    expect(labels.actors.character).toBe("Hero");
    expect(labels.actors.starship).toBe("Spaceship");
    expect(labels.items.gear).toBe("Supply");
    expect(labels.items.weapon).toBe("Arm");
    expect(labels.items.specialability).toBe("Gift");
    expect(Object.keys(labels.actors)).toEqual([
      "character",
      "creature",
      "hideout",
      "npc",
      "starship",
      "vehicle",
    ]);
    expect(Object.keys(labels.items)).toContain("starship-weapon");
    expect(Object.keys(labels.items)).not.toContain("advancedSkill");
  });

  it("inherits localized Foundry labels for blank profile fields", () => {
    const labels = documentTypeLabelProjection(
      terminology,
      (key) => `localized:${key}`,
    );

    expect(labels.actors.vehicle).toBe("localized:TYPES.Actor.vehicle");
    expect(labels.items.armor).toBe("localized:TYPES.Item.armor");
    expect(labels.items.skill).toBe("localized:TYPES.Item.skill");
  });

  it("updates Foundry's supported type-label registry through local translation keys", () => {
    const actorTypeLabels: Record<string, string> = {};
    const itemTypeLabels: Record<string, string> = {};
    const translations: Record<string, unknown> = {};
    vi.stubGlobal("CONFIG", {
      Actor: { typeLabels: actorTypeLabels },
      Item: { typeLabels: itemTypeLabels },
    });
    vi.stubGlobal("game", {
      i18n: {
        localize: (key: string) => `localized:${key}`,
        translations,
      },
    });

    applyDocumentTypeTerminology(terminology);

    expect(actorTypeLabels.starship).toBe(
      "D6E2RuntimeDocumentTypes.Actor.starship",
    );
    expect(itemTypeLabels.weapon).toBe("D6E2RuntimeDocumentTypes.Item.weapon");
    expect(translations).toMatchObject({
      D6E2RuntimeDocumentTypes: {
        Actor: { character: "Hero", starship: "Spaceship" },
        Item: { gear: "Supply", weapon: "Arm" },
      },
    });
  });
});
