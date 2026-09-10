import { describe, it, expect } from "vitest";
import type { ActorSource, ItemSource } from "@d6-system-2e/core";
import {
  addDestinyActorDefaults,
  addDestinyTalentDefaults,
} from "./055-add-destiny-receipt-defaults";
describe("Destiny migration55", () => {
  it("initializes off without interpreting prose and is idempotent", () => {
    const item: ItemSource = {
      type: "talent",
      system: { description: "Spend Destiny" },
      flags: { external: { keep: true } },
    };
    addDestinyTalentDefaults(item);
    const first = structuredClone(item);
    addDestinyTalentDefaults(item);
    expect(item).toEqual(first);
    expect(item.flags).toEqual({
      external: { keep: true },
      "d6-system-2e": { destinyCost: { version: 1, enabled: false, cost: 1 } },
    });
  });
  it("preserves existing and future costs/receipts and leaves equipment ungranted", () => {
    const item: ItemSource = {
      type: "talent",
      system: {},
      flags: { "d6-system-2e": { destinyCost: { version: 2, enabled: true } } },
    };
    const actor: ActorSource = {
      type: "character",
      system: {},
      items: [],
      flags: {
        "d6-system-2e": { destinyConsequences: { existing: { version: 1 } } },
      },
    };
    const before = structuredClone({ item, actor });
    addDestinyTalentDefaults(item);
    addDestinyActorDefaults(actor);
    expect(item).toEqual(before.item);
    expect((actor.flags as Record<string, unknown>)["d6-system-2e"]).toEqual({
      destinyConsequences: { existing: { version: 1 } },
      destinyDamage: {},
      destinyFrameworkEdits: {},
    });
    const migrated = structuredClone(actor);
    addDestinyActorDefaults(actor);
    expect(actor).toEqual(migrated);
    const gear: ItemSource = { type: "gear", system: {} };
    addDestinyTalentDefaults(gear);
    expect(gear.flags).toBeUndefined();
  });
});
