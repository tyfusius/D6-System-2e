import { describe, expect, it } from "vitest";
import { D6_SYSTEM_2E_API_VERSION, isD6System2eApiV1 } from "./api";

describe("D6 System 2e API version guard", () => {
  it("accepts the stable package identity and API major", () => {
    expect(
      isD6System2eApiV1({
        advancement: {
          attribute: () => Promise.resolve({}),
          item: () => Promise.resolve({}),
        },
        apiVersion: D6_SYSTEM_2E_API_VERSION,
        campaign: {
          current: () => ({}),
        },
        health: {
          condition: () => Promise.resolve({}),
        },
        roll: {
          attribute: () => Promise.resolve(null),
          item: () => Promise.resolve(null),
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
