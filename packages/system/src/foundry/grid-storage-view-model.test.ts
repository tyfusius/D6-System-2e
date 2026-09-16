import { describe, expect, it } from "vitest";

import { D6_GRID_STORAGE_DESIGN_FIXTURES } from "./grid-storage-view-model.js";

describe("grid storage design fixtures", () => {
  it("provides template-ready one-based grid coordinates and spans", () => {
    for (const fixture of [
      D6_GRID_STORAGE_DESIGN_FIXTURES.personalBackpack,
      D6_GRID_STORAGE_DESIGN_FIXTURES.machineCargo,
    ]) {
      for (const item of fixture.items) {
        expect(item.gridColumnStart).toBe(item.x + 1);
        expect(item.gridRowStart).toBe(item.y + 1);
        expect(item.gridColumnSpan).toBe(item.columns);
        expect(item.gridRowSpan).toBe(item.rows);
      }
    }
  });

  it("keeps capacity-only legacy inventory available without inventing a grid", () => {
    const fixture = D6_GRID_STORAGE_DESIGN_FIXTURES.personalCarryList;

    expect(fixture.viewMode).toBe("list");
    expect(fixture.spaceMode).toBe("capacity-only");
    expect(fixture.gridConfigured).toBe(false);
    expect(fixture.canAutoPack).toBe(false);
    expect(fixture.unplaced).toHaveLength(1);
    expect(fixture.unplaced[0]?.canPlace).toBe(true);
  });

  it("keeps grid physics when its presentation can switch to a list", () => {
    const fixture = D6_GRID_STORAGE_DESIGN_FIXTURES.personalBackpack;

    expect(fixture.spaceMode).toBe("grid");
    expect(
      fixture.capacities.find((capacity) => capacity.id === "grid")?.value,
    ).toBe("12 of 48 cells");
  });

  it("does not expose hidden items, measurements, or occupancy", () => {
    const fixture = D6_GRID_STORAGE_DESIGN_FIXTURES.permissionRedacted;

    expect(fixture.items).toEqual([]);
    expect(fixture.unplaced).toEqual([]);
    expect(fixture.revision).toBeNull();
    expect(fixture.viewMode).toBe("redacted");
    expect(fixture.canViewGrid).toBe(false);
    expect(fixture.columns).toBeNull();
    expect(fixture.rows).toBeNull();
    expect(
      fixture.capacities.every((capacity) => capacity.state === "hidden"),
    ).toBe(true);
  });

  it("does not misreport a bounded search as impossible", () => {
    const fixture = D6_GRID_STORAGE_DESIGN_FIXTURES.autoPackLimited;

    expect(fixture.outcome).toBe("not-found-within-limit");
    expect(fixture.summary).toContain("may still be packable");
    expect(fixture.canApply).toBe(false);
  });

  it("makes excluded auto-pack items and square-first configuration explicit", () => {
    const preview = D6_GRID_STORAGE_DESIGN_FIXTURES.autoPackPreview;
    const editor = D6_GRID_STORAGE_DESIGN_FIXTURES.physicalEditor;

    expect(preview.eligibleCount).toBe(4);
    expect(preview.moves).toHaveLength(preview.eligibleCount);
    expect(preview.showGridPreview).toBe(true);
    expect(preview.previewItems).toHaveLength(preview.eligibleCount);
    expect(preview.previewItems[0]).toMatchObject({
      gridColumnStart: 1,
      gridRowStart: 1,
      gridColumnSpan: 4,
      gridRowSpan: 3,
    });
    expect(preview.excludedCount).toBe(1);
    expect(preview.excludedSummary).toContain("remains unplaced");
    expect(editor.footprintColumns).toBe(1);
    expect(editor.footprintRows).toBe(1);
    expect(editor.scaleLabel).toContain("each square");
    expect(D6_GRID_STORAGE_DESIGN_FIXTURES.autoPackLimited).toMatchObject({
      showGridPreview: false,
      previewItems: [],
    });
  });

  it("provides exact space configuration fields and move actions", () => {
    const space = D6_GRID_STORAGE_DESIGN_FIXTURES.spaceEditor;
    const move = D6_GRID_STORAGE_DESIGN_FIXTURES.movePreview;

    expect(space.fields.rows).toBe("space.rows");
    expect(space.fields.columns).toBe("space.columns");
    expect(space.fields.scalePresetId).toBe("space.scalePresetId");
    expect(
      D6_GRID_STORAGE_DESIGN_FIXTURES.physicalEditor.fields.footprintColumns,
    ).toBe("storagePhysical.footprintColumns");
    expect(
      D6_GRID_STORAGE_DESIGN_FIXTURES.machineCargo.breadcrumbs[0]?.rootUuid,
    ).toBe("Actor.wayfarer");
    expect(move.applyAction).toBe("applyStorageMove");
    expect(move.cancelAction).toBe("cancelStorageMove");
    expect(D6_GRID_STORAGE_DESIGN_FIXTURES.selection.canOpen).toBe(true);
    expect(D6_GRID_STORAGE_DESIGN_FIXTURES.selection.canUse).toBe(false);
  });
});
