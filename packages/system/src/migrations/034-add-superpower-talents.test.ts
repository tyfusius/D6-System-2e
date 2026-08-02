import { describe, expect, it } from "vitest";
import type { ItemSource } from "@d6-system-2e/core";
import { addSuperpowerTalentFields } from "./034-add-superpower-talents";

describe("schema 34 Superpower Talent fields", () => {
  it("adds safe defaults while preserving valid custom accounting", () => {
    const source = {
      type: "talent",
      system: {
        superpower: true,
        superpowerAutomatic: true,
        superpowerEnhancementCost: 2,
        superpowerLimitationCredit: 3,
      },
    } as unknown as ItemSource;
    addSuperpowerTalentFields(source);
    expect(source.system).toMatchObject({
      superpower: true,
      superpowerAutomatic: true,
      superpowerEnhancementCost: 2,
      superpowerLimitationCredit: 3,
    });
  });
});
