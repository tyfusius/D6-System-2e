import { describe, expect, it } from "vitest";
import { characterUpdateParts } from "./character-render-dependencies";
const update = (renderData: unknown) => ({
  isFirstRender: false,
  renderContext: "updateActor",
  renderData,
});
describe("native character part dependencies", () => {
  it("refreshes both health displays for flat or expanded health/movement changes", () => {
    for (const change of [
      { "system.health.condition": "wounded" },
      {
        system: {
          health: { firstEditionWound: "wounded" },
          movement: { posture: "prone" },
        },
      },
      {
        "system.health.condition": "healthy",
        _id: "actor",
        _stats: { modifiedTime: 42 },
      },
    ])
      expect(characterUpdateParts(update(change))).toEqual([
        "header",
        "combat",
      ]);
  });
  it("falls back for unknown, permission, deletion, replacement and embedded updates", () => {
    for (const change of [
      undefined,
      {},
      { system: {} },
      { "system.health": null },
      { "system.-=health": null },
      { "system.health.condition": "wounded", ownership: { player: 0 } },
      { "system.resources.characterPoints.value": 3 },
      [{ _id: "item", "system.ammo.value": 2 }],
    ])
      expect(characterUpdateParts(update(change))).toBeNull();
    expect(
      characterUpdateParts({
        ...update({ "system.health.condition": "wounded" }),
        isFirstRender: true,
      }),
    ).toBeNull();
    expect(
      characterUpdateParts({
        ...update({ "system.health.condition": "wounded" }),
        renderContext: "updateitems",
      }),
    ).toBeNull();
  });
});
