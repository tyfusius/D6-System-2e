import { describe, expect, it } from "vitest";
import type { ActorSource } from "@d6-system-2e/core";
import { addDodgeBasis } from "./029-add-dodge-basis";

describe("schema 29 Dodge basis", () => {
  it("preserves Flying and otherwise installs the core Perception basis", () => {
    const flying = {
      system: { defenses: { dodgeBasis: "flying", parryOverride: 12 } },
      type: "character",
    };
    addDodgeBasis(flying as unknown as ActorSource);
    expect(flying.system.defenses).toEqual({
      dodgeBasis: "flying",
      parryOverride: 12,
    });

    const fresh = { system: {}, type: "npc" };
    addDodgeBasis(fresh as unknown as ActorSource);
    expect(fresh.system).toEqual({ defenses: { dodgeBasis: "perception" } });
  });
});
