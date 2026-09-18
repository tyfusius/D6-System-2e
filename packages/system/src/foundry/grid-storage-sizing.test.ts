import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { parseHTML } from "linkedom";
import { bindStorageSizing, storageMetricPreview } from "./grid-storage-sizing";

const render = vi.fn(() => Promise.resolve("<p>preview</p>"));
beforeEach(() => {
  render.mockClear();
  vi.stubGlobal("game", {
    i18n: {
      localize: (key: string) => key,
      format: (key: string, args: object) => `${key}:${JSON.stringify(args)}`,
    },
  });
  vi.stubGlobal("foundry", {
    applications: { handlebars: { renderTemplate: render } },
  });
});
afterEach(() => vi.unstubAllGlobals());
const personal = {
  columns: 4,
  rows: 3,
  cellWidthMm: 100,
  cellDepthMm: 100,
  scalePresetId: "personal-100",
  interiorHeightMm: 100,
};

it("uses selected scale, metre guidance and bounded diagrams without changing true dimensions", () => {
  expect(storageMetricPreview(personal)).toMatchObject({
    exampleColumns: 3,
    exampleRows: 2,
    exampleFits: true,
  });
  const cargo = storageMetricPreview({
    ...personal,
    columns: 24,
    rows: 5,
    scalePresetId: "cargo-500",
    interiorHeightMm: 2500,
  });
  expect(cargo).toMatchObject({
    exampleColumns: 1,
    exampleRows: 1,
    exampleFits: true,
  });
  expect(cargo.dimensionsLabel).toBe(
    'D6E2.Storage.Metric.DimensionsMetres:{"width":12,"depth":2.5,"height":2.5}',
  );
  const huge = storageMetricPreview({ ...personal, columns: 200 });
  expect(huge.columns).toBe(24);
  expect(huge.dimensionsLabel).toContain('"width":2000');
});
it("distinguishes floor fit from unchecked height and rotates only when needed", () => {
  expect(
    storageMetricPreview({
      ...personal,
      columns: 2,
      rows: 3,
      interiorHeightMm: "",
    }),
  ).toMatchObject({
    exampleColumns: 2,
    exampleRows: 3,
    exampleFloorFits: true,
    exampleFits: false,
    heightChecked: false,
    exampleFitLabel: "D6E2.Storage.Metric.ExampleHeightUnchecked",
  });
  expect(
    storageMetricPreview({
      ...personal,
      columns: 1,
      rows: 1,
      interiorHeightMm: "",
    }),
  ).toMatchObject({
    exampleFloorFits: false,
    exampleFitLabel: "D6E2.Storage.Metric.ExampleTooLarge",
  });
  expect(
    storageMetricPreview({ ...personal, interiorHeightMm: 49 }),
  ).toMatchObject({ exampleFloorFits: true, exampleFits: false });
});
it("capacity-only does not promise floor fit or require grid dimensions", () => {
  expect(
    storageMetricPreview({
      ...personal,
      configuration: "capacity-only",
      columns: "",
      rows: "",
    }),
  ).toMatchObject({
    valid: true,
    gridEnabled: false,
    exampleFloorFits: false,
    exampleFits: false,
  });
  expect(
    storageMetricPreview({ ...personal, interiorHeightMm: -1 }),
  ).toMatchObject({ valid: false });
});

it("preset/manual changes stay in the draft, bind once, and preserve invalid-name Save gating", async () => {
  const { document, window } =
    parseHTML(`<form><input name="label" value=""><section data-d6-storage-dimensions>
    <input name="spacePresetId" value="custom"><input name="scalePresetId" value="personal-100">
    <input name="columns" value="4"><input name="rows" value="3"><input name="cellWidthMm" value="100"><input name="cellDepthMm" value="100"><input name="interiorHeightMm" value=""><input name="customScaleId" value="custom">
    <div data-d6-storage-metric-preview></div></section><button data-action="save"></button></form>`);
  vi.stubGlobal("HTMLInputElement", window.HTMLInputElement);
  vi.stubGlobal("HTMLSelectElement", window.HTMLSelectElement);
  const root = document.querySelector("form") as unknown as HTMLElement;
  for (const input of Array.from(root.querySelectorAll("input")))
    input.setCustomValidity = vi.fn();
  const field = (name: string) => {
    const input = root.querySelector<HTMLInputElement>(`[name="${name}"]`);
    if (!input) throw new Error(`Missing fixture field ${name}`);
    return input;
  };
  bindStorageSizing(root);
  bindStorageSizing(root);
  await Promise.resolve();
  expect(render).toHaveBeenCalledTimes(1);
  field("spacePresetId").value = "large-cargo";
  field("spacePresetId").dispatchEvent(
    new window.Event("change", { bubbles: true }),
  );
  await Promise.resolve();
  expect(render).toHaveBeenCalledTimes(2);
  expect(field("columns").value).toBe("24");
  expect(field("interiorHeightMm").value).toBe("2500");
  expect(root.querySelector<HTMLButtonElement>("button")?.disabled).toBe(true);
  field("label").value = "Hold";
  field("cellWidthMm").value = "250";
  field("cellWidthMm").dispatchEvent(
    new window.Event("input", { bubbles: true }),
  );
  await Promise.resolve();
  expect(field("scalePresetId").value).toBe("");
  expect(field("spacePresetId").value).toBe("custom");
  expect(root.querySelector<HTMLButtonElement>("button")?.disabled).toBe(false);
  const section = root.querySelector<HTMLElement>("section");
  if (!section) throw new Error("Missing fixture section");
  const previousHtml = section.outerHTML;
  section.outerHTML = previousHtml;
  for (const input of Array.from(root.querySelectorAll("input")))
    input.setCustomValidity = vi.fn();
  bindStorageSizing(root);
  await Promise.resolve();
  render.mockClear();
  field("label").value = "";
  field("label").dispatchEvent(new window.Event("input", { bubbles: true }));
  await Promise.resolve();
  expect(render).toHaveBeenCalledTimes(1);
  expect(root.querySelector<HTMLButtonElement>("button")?.disabled).toBe(true);
});
