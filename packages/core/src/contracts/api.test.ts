import { describe, expect, it } from "vitest";
import { D6_SYSTEM_2E_API_VERSION, isD6System2eApiV2 } from "./api";

describe("D6 System 2e API version guard", () => {
  it("accepts the stable package identity and API major", () => {
    expect(
      isD6System2eApiV2({
        advancement: {
          attribute: () => Promise.resolve({}),
          item: () => Promise.resolve({}),
          milestone: {
            award: () => Promise.resolve({}),
            exchangeForPerk: () => Promise.resolve({}),
            read: () => ({}),
          },
          narrative: {
            approve: () => Promise.resolve({}),
            complete: () => Promise.resolve({}),
            propose: () => Promise.resolve({}),
            read: () => [],
            remove: () => Promise.resolve(false),
            toggleStep: () => Promise.resolve({}),
          },
          specialization: () => Promise.resolve({}),
        },
        apiVersion: D6_SYSTEM_2E_API_VERSION,
        bestiary: {
          create: () => Promise.resolve({}),
          preview: () => ({}),
        },
        bestiaryRegistry: { register: () => undefined },
        campaign: {
          current: () => ({}),
        },
        campaignPackages: {
          register: () => undefined,
          resolve: () => ({}),
        },
        contentPackages: { register: () => undefined },
        firstEditionGenreProfiles: { register: () => undefined },
        characterTemplates: {
          apply: () => Promise.resolve({}),
          preview: () => ({}),
        },
        chase: {
          end: () => Promise.resolve(),
          read: () => null,
          resolve: () => Promise.resolve({}),
          roll: () => Promise.resolve(null),
          start: () => Promise.resolve({}),
        },
        combat: {
          completeNext: () => Promise.resolve({}),
          declare: () => Promise.resolve({}),
          read: () => null,
          reset: () => Promise.resolve({}),
        },
        health: {
          condition: () => Promise.resolve({}),
          damagePool: () => Promise.resolve({}),
          healPool: () => Promise.resolve({}),
          posture: () => Promise.resolve({}),
          read: () => ({}),
          setPool: () => Promise.resolve({}),
          setTrack: () => Promise.resolve({}),
          wound: () => Promise.resolve({}),
        },
        features: {
          invoke: () => Promise.resolve({}),
          read: () => ({}),
          reset: () => Promise.resolve({}),
        },
        featureCatalogs: {
          apply: () => Promise.resolve({}),
          preview: () => ({}),
        },
        featureCatalogRegistry: { register: () => undefined },
        magic: {
          cast: () => Promise.resolve(null),
          difficulty: () => ({}),
        },
        psionics: {
          read: () => ({}),
          roll: () => Promise.resolve(null),
          train: () => Promise.resolve({}),
        },
        psionicPowerRegistry: { register: () => undefined },
        hideoutFeatureRegistry: { register: () => undefined },
        roll: {
          attribute: () => Promise.resolve(null),
          defense: () => Promise.resolve(null),
          doubleDown: () => Promise.resolve(null),
          item: () => Promise.resolve(null),
          resistance: () => Promise.resolve(null),
          reroll: () => Promise.resolve(null),
          skill: () => Promise.resolve(null),
        },
        read: {
          actor: () => ({}),
        },
        rules: {
          activate: () => Promise.resolve(),
          configured: () => ({}),
          runtime: () => ({}),
          selection: () => ({}),
        },
        rulesProfileRegistry: { register: () => undefined },
        setting: {
          activate: () => Promise.resolve(),
          configured: () => ({}),
          selection: () => ({}),
        },
        settingProfileRegistry: { register: () => undefined },
        profilePreset: {
          activate: () => Promise.resolve(),
          preview: () => Promise.resolve(),
        },
        profilePresetRegistry: {
          current: () => [],
          register: () => undefined,
          unregisterOwner: () => undefined,
        },
        healthModelRegistry: { register: () => undefined },
        systemId: "d6-system-2e",
        terminology: { register: () => undefined },
        themes: { register: () => undefined },
        equipment: { register: () => undefined },
        templates: { register: () => undefined },
      }),
    ).toBe(true);
  });

  it("rejects other systems and API majors", () => {
    expect(
      isD6System2eApiV2({
        apiVersion: 1,
        rules: {
          activate: () => Promise.resolve(),
          configured: () => ({}),
          runtime: () => ({}),
          selection: () => ({}),
        },
        systemId: "d6-system-2e",
        terminology: { register: () => undefined },
        themes: { register: () => undefined },
      }),
    ).toBe(false);
    expect(isD6System2eApiV2({ apiVersion: 2, systemId: "od6s-next" })).toBe(
      false,
    );
    expect(isD6System2eApiV2(null)).toBe(false);
  });

  it("rejects an identity-only object without the rules profile contract", () => {
    expect(isD6System2eApiV2({ apiVersion: 2, systemId: "d6-system-2e" })).toBe(
      false,
    );
  });
});
