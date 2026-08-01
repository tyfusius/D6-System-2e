import { describe, expect, it } from "vitest";
import type { ActorSource } from "@d6-system-2e/core";
import {
  addMagicPointsResource,
  addAutofireRating,
} from "./027-add-magic-points-and-autofire";

describe("schema 27 Magic Points and autofire", () => {
  it("adds loss-preserving defaults to personal actors and weapons", () => {
    const actor = { system: { resources: {} }, type: "character" };
    addMagicPointsResource(actor as unknown as ActorSource);
    expect(actor.system.resources).toMatchObject({
      magicPoints: { initialized: false, value: 0 },
    });
    const weapon = { system: { damage: 9 }, type: "weapon" };
    addAutofireRating(weapon);
    expect(weapon.system).toMatchObject({ autofireRating: 0, damage: 9 });
  });
});
