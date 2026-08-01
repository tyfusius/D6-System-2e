import { describe, expect, it } from "vitest";
import { D6_SYSTEM_2E_API_VERSION, isD6System2eApiV1 } from "./api";

describe("D6 System 2e API version guard", () => {
  it("accepts the stable package identity and API major", () => {
    expect(
      isD6System2eApiV1({
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
          posture: () => Promise.resolve({}),
          wound: () => Promise.resolve({}),
        },
        features: {
          invoke: () => Promise.resolve({}),
          read: () => ({}),
          reset: () => Promise.resolve({}),
        },
        magic: {
          cast: () => Promise.resolve(null),
          difficulty: () => ({}),
        },
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
          applyPreset: () => Promise.resolve(),
          capabilities: () => ({}),
          current: () => ({}),
        },
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
      isD6System2eApiV1({
        apiVersion: 2,
        rules: {
          applyPreset: () => Promise.resolve(),
          capabilities: () => ({}),
          current: () => ({}),
        },
        systemId: "d6-system-2e",
        terminology: { register: () => undefined },
        themes: { register: () => undefined },
      }),
    ).toBe(false);
    expect(isD6System2eApiV1({ apiVersion: 1, systemId: "od6s-next" })).toBe(
      false,
    );
    expect(isD6System2eApiV1(null)).toBe(false);
  });

  it("rejects an identity-only object without the rules profile contract", () => {
    expect(isD6System2eApiV1({ apiVersion: 1, systemId: "d6-system-2e" })).toBe(
      false,
    );
  });
});
