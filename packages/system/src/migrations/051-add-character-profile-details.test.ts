import { describe, expect, it } from "vitest";
import { addCharacterProfileDetails } from "./051-add-character-profile-details";

describe("character profile details migration", () => {
  it("adds the neutral od6s-next profile fields without disturbing companion data", () => {
    const actor = {
      items: [],
      system: {
        biography: "<p>Legacy background.</p>",
        profile: { allegiance: "Rebel Alliance", future: true },
      },
      type: "character",
    };
    addCharacterProfileDetails(actor);
    expect(actor.system.profile).toEqual({
      age: "",
      allegiance: "Rebel Alliance",
      background: "<p>Legacy background.</p>",
      future: true,
      gender: "",
      height: "",
      personality: "",
      physicalDescription: "",
      weight: "",
    });
    addCharacterProfileDetails(actor);
    expect(actor.system.profile.future).toBe(true);
  });
});
