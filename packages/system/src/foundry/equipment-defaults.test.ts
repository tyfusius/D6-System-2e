import { afterEach, describe, expect, it, vi } from "vitest";
import { initializeEquipmentProvenance } from "./equipment-defaults";

afterEach(() => vi.unstubAllGlobals());

describe("new equipment provenance defaults", () => {
  it("inherits the selected campaign era for a new equipment Item", () => {
    vi.stubGlobal("game", {
      settings: { get: () => "modern" },
    });
    const updateSource = vi.fn<(changes: Record<string, unknown>) => void>();
    initializeEquipmentProvenance(
      { updateSource },
      { system: {}, type: "gear" },
    );
    const changes = updateSource.mock.calls[0]?.[0];
    expect(changes?.["system.equipmentProvenance"]).toMatchObject({
      era: "modern",
      catalogId: "",
      catalogVersion: 0,
    });
  });

  it("preserves explicit imported provenance and ignores other Items", () => {
    vi.stubGlobal("game", { settings: { get: () => "science-fiction" } });
    const updateSource = vi.fn<(changes: Record<string, unknown>) => void>();
    initializeEquipmentProvenance(
      { updateSource },
      {
        system: { equipmentProvenance: { era: "medieval" } },
        type: "weapon",
      },
    );
    initializeEquipmentProvenance(
      { updateSource },
      { system: {}, type: "skill" },
    );
    expect(updateSource).not.toHaveBeenCalled();
  });
});
