import { describe, expect, it } from "vitest";
import { D6_SYSTEM_2E_API_VERSION, isD6System2eApiV1 } from "./api";

describe("D6 System 2e API version guard", () => {
  it("accepts the stable package identity and API major", () => {
    expect(
      isD6System2eApiV1({
        apiVersion: D6_SYSTEM_2E_API_VERSION,
        systemId: "d6-system-2e",
      }),
    ).toBe(true);
  });

  it("rejects other systems and API majors", () => {
    expect(isD6System2eApiV1({ apiVersion: 2, systemId: "d6-system-2e" })).toBe(
      false,
    );
    expect(isD6System2eApiV1({ apiVersion: 1, systemId: "od6s-next" })).toBe(
      false,
    );
    expect(isD6System2eApiV1(null)).toBe(false);
  });
});
