import { describe, expect, it } from "vitest";
import { addFreeformMagicDesign } from "./026-add-freeform-magic-design";

describe("schema 26 freeform magic design", () => {
  it("adds loss-preserving defaults only to manifestations", () => {
    const item = { system: { description: "Original" }, type: "manifestation" };
    addFreeformMagicDesign(item);
    expect(item.system).toMatchObject({
      castingTime: "action",
      description: "Original",
      duration: "instant",
      power: 1,
      range: "melee",
      resistance: "partial",
      school: "alteration",
      target: "one",
    });
    const gear = { system: { power: 9 }, type: "gear" };
    addFreeformMagicDesign(gear);
    expect(gear.system).toEqual({ power: 9 });
  });
});
