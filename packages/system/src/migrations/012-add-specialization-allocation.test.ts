import { describe, expect, it } from "vitest";
import type { ActorSource, ItemSource } from "@d6-system-2e/core";
import { addSpecializationAllocation } from "./012-add-specialization-allocation";

function actor(
  system: Record<string, unknown>,
  items: ItemSource[] = [],
): ActorSource {
  return { items, system, type: "character" };
}

describe("schema 12 explicit Specialization allocation", () => {
  it("starts Actors without Specializations at zero slots", () => {
    const source = actor({ creation: { active: true } });
    addSpecializationAllocation(source);
    expect(source.system.creation).toEqual({
      active: true,
      specializationSlots: 0,
    });
  });

  it("preserves existing Specializations by allocating three slots", () => {
    const source = actor({ creation: { active: true, retained: true } }, [
      { system: {}, type: "skill" },
      { system: {}, type: "specialization" },
    ]);
    addSpecializationAllocation(source);
    expect(source.system.creation).toEqual({
      active: true,
      retained: true,
      specializationSlots: 3,
    });
  });

  it("is idempotent and leaves unrelated Actor types unchanged", () => {
    const source = actor({ creation: { specializationSlots: 3 } });
    const vehicle: ActorSource = { items: [], system: {}, type: "vehicle" };
    addSpecializationAllocation(source);
    addSpecializationAllocation(source);
    addSpecializationAllocation(vehicle);
    expect(source.system.creation).toEqual({ specializationSlots: 3 });
    expect(vehicle.system).toEqual({});
  });
});
