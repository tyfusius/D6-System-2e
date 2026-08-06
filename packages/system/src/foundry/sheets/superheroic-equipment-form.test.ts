import { describe, expect, it } from "vitest";
import { superheroicGadgetTargetChanges } from "./superheroic-equipment-form";

describe("superheroic equipment form", () => {
  it("maps a Gadget target to the two persisted fields", () => {
    expect(superheroicGadgetTargetChanges("skill:climbing-id")).toEqual({
      "system.gadgetTargetKind": "skill",
      "system.gadgetTargetId": "climbing-id",
    });
  });

  it("clears both target fields for an empty or invalid selection", () => {
    expect(superheroicGadgetTargetChanges("")).toEqual({
      "system.gadgetTargetKind": "",
      "system.gadgetTargetId": "",
    });
    expect(superheroicGadgetTargetChanges("actor:not-supported")).toEqual({
      "system.gadgetTargetKind": "",
      "system.gadgetTargetId": "",
    });
  });
});
