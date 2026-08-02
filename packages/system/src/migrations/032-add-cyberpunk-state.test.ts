import { describe, expect, it } from "vitest";
import {
  addCyberneticProfile,
  addCyberpunkState,
} from "./032-add-cyberpunk-state";

describe("Cyberpunk state migration", () => {
  it("normalizes actor hardening state without touching other actor kinds", () => {
    const actor = {
      items: [],
      system: {
        cyberpunk: {
          hardening: { combatId: "combat", untilRound: 4, untilTurn: 2 },
        },
      },
      type: "character",
    };
    addCyberpunkState(actor);
    expect(actor.system.cyberpunk.hardening).toEqual({
      combatId: "combat",
      untilRound: 4,
      untilTurn: 2,
    });
  });

  it("adds a stable augmentation profile to legacy Cybernetic Items", () => {
    const item = { system: {}, type: "cybernetic" };
    addCyberneticProfile(item);
    expect(item.system).toMatchObject({
      augmentationKind: "cyberware",
      disabled: { combatId: "", untilRound: 0, untilTurn: 0 },
      installation: {
        difficulty: 0,
        installerName: "",
        minutes: 0,
        previousCount: 0,
      },
      installed: false,
      linkedTalentId: "",
      rank: 1,
    });
  });
});
