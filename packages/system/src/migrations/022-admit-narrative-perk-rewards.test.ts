import { describe, expect, it } from "vitest";
import type { ActorSource } from "@d6-system-2e/core";
import { admitNarrativePerkRewards } from "./022-admit-narrative-perk-rewards";

describe("schema 22 Narrative Perk rewards", () => {
  it("admits imported Perk arcs with safe missing defaults", () => {
    const actor: ActorSource = {
      items: [],
      system: {
        advancement: {
          narrativeArcs: [
            {
              retained: true,
              rewardKind: "perk",
              rewardName: "Lucky",
            },
          ],
        },
      },
      type: "character",
    };
    admitNarrativePerkRewards(actor);
    expect(actor.system.advancement).toEqual({
      narrativeArcs: [
        {
          retained: true,
          rewardId: "",
          rewardKind: "perk",
          rewardName: "Lucky",
          targetScore: 1,
        },
      ],
    });
  });

  it("preserves existing arcs and ignores machine Actors", () => {
    const skillArc = { rewardId: "shooting", rewardKind: "skill" };
    const character: ActorSource = {
      items: [],
      system: { advancement: { narrativeArcs: [skillArc] } },
      type: "character",
    };
    admitNarrativePerkRewards(character);
    expect(character.system.advancement).toEqual({
      narrativeArcs: [skillArc],
    });

    const starship: ActorSource = {
      items: [],
      system: { advancement: { narrativeArcs: [{ rewardKind: "perk" }] } },
      type: "starship",
    };
    admitNarrativePerkRewards(starship);
    expect(starship.system.advancement).toEqual({
      narrativeArcs: [{ rewardKind: "perk" }],
    });
  });
});
