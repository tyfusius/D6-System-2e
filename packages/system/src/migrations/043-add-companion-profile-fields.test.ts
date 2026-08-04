import { describe, expect, it } from "vitest";
import { addCompanionProfileFields } from "./043-add-companion-profile-fields";

describe("schema 43 companion profile fields", () => {
  it("adds latent personal fields without replacing existing values", () => {
    const actor = {
      items: [],
      system: { profile: { allegiance: "Guild", currency: 17 } },
      type: "character",
    };
    addCompanionProfileFields(actor);
    expect(actor.system.profile).toEqual({ allegiance: "Guild", currency: 17 });
  });

  it("adds a safe starship drive rating and ignores unrelated actors", () => {
    const starship = { items: [], system: {}, type: "starship" };
    addCompanionProfileFields(starship);
    expect(starship.system).toEqual({ interstellarDrive: 0 });

    const vehicle = { items: [], system: { retained: true }, type: "vehicle" };
    addCompanionProfileFields(vehicle);
    expect(vehicle.system).toEqual({ retained: true });
  });
});
