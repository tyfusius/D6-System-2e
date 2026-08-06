import { describe, expect, it } from "vitest";
import { addHideoutActorFields } from "./036-add-hideout-actors";

describe("schema 36 hideout actors", () => {
  it("normalizes persisted hideout state idempotently", () => {
    const source = {
      items: [],
      type: "hideout",
      system: {
        featureLimit: 4.5,
        features: [{ label: "Custom Workshop" }, { label: "" }],
        members: [{ actorId: "actor-1", name: "Owner" }, {}],
        ownershipKind: "group",
        relocation: { monthsCompleted: 2, state: "relocating" },
      },
    };
    addHideoutActorFields(source);
    const once = structuredClone(source.system);
    addHideoutActorFields(source);
    expect(source.system).toEqual(once);
    expect(source.system).toMatchObject({
      acquisition: "gm-granted",
      featureLimit: 4,
      locationType: "urban",
      ownershipKind: "group",
      relocation: { monthsCompleted: 2, state: "relocating" },
    });
    expect(source.system.features).toHaveLength(1);
  });

  it("leaves other Actor types unchanged", () => {
    const source = { items: [], type: "character", system: { biography: "x" } };
    addHideoutActorFields(source);
    expect(source.system).toEqual({ biography: "x" });
  });
});
