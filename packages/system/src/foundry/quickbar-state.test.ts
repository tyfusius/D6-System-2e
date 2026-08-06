import { describe, expect, it } from "vitest";
import {
  parseQuickbarState,
  pinQuickbarActor,
  removeQuickbarActor,
  reorderQuickbarActor,
  resolveQuickbarSections,
  toggleQuickbarSection,
} from "./quickbar-state";

describe("GM Quickbar state", () => {
  it("migrates the unversioned live flag without losing personalization", () => {
    expect(
      parseQuickbarState({
        hiddenActorIds: [" hidden ", "hidden", "pinned"],
        npcCollapsed: true,
        pcCollapsed: false,
        pinnedActorIds: ["pinned"],
      }),
    ).toEqual({
      hiddenActorIds: ["hidden"],
      npcCollapsed: true,
      npcOrder: [],
      pcCollapsed: false,
      pcOrder: [],
      pinnedActorIds: ["pinned"],
      version: 2,
    });
  });

  it("normalizes versioned order and resolves unlisted actors by type", () => {
    const state = parseQuickbarState({
      hiddenActorIds: ["hidden"],
      npcOrder: ["npc", "pc"],
      pcOrder: ["pc", "missing"],
      pinnedActorIds: [],
      version: 2,
    });
    expect(
      resolveQuickbarSections(state, [
        { id: "pc", type: "character" },
        { id: "automatic", type: "character" },
        { id: "npc", type: "npc" },
        { id: "creature", type: "creature" },
        { id: "hidden", type: "character" },
      ]),
    ).toEqual({
      npcIds: ["npc", "creature"],
      pcIds: ["pc", "automatic"],
    });
  });

  it("pins, reorders across sections, removes, and toggles independently", () => {
    const initial = parseQuickbarState({
      hiddenActorIds: ["b"],
      npcCollapsed: false,
      npcOrder: ["c"],
      pcCollapsed: false,
      pcOrder: ["a"],
      pinnedActorIds: ["a", "c"],
      version: 2,
    });
    const pinned = pinQuickbarActor(initial, "b", "pc");
    expect(pinned.hiddenActorIds).toEqual([]);
    expect(pinned.pcOrder).toEqual(["a", "b"]);

    const reordered = reorderQuickbarActor(pinned, "a", "npc", 0);
    expect(reordered.pcOrder).toEqual(["b"]);
    expect(reordered.npcOrder).toEqual(["a", "c"]);

    const removed = removeQuickbarActor(reordered, "a");
    expect(removed.hiddenActorIds).toEqual(["a"]);
    expect(removed.pinnedActorIds).toEqual(["c", "b"]);
    expect(removed.npcOrder).toEqual(["c"]);

    const collapsed = toggleQuickbarSection(removed, "npc");
    expect(collapsed.npcCollapsed).toBe(true);
    expect(collapsed.pcCollapsed).toBe(false);
  });
});
