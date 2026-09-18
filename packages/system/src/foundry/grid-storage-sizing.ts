import { D6_STORAGE_SCALE_PRESETS } from "../application/grid-storage-configuration.js";
import {
  STORAGE_SPACE_PRESETS,
  storageSpacePresetValues,
} from "../application/grid-storage-presets.js";

const SCALE_VALUES: Readonly<
  Record<string, { cellWidthMm: number; cellDepthMm: number }>
> = D6_STORAGE_SCALE_PRESETS;
const sizingKeys = [
  "spacePresetId",
  "scalePresetId",
  "columns",
  "rows",
  "cellWidthMm",
  "cellDepthMm",
  "interiorHeightMm",
  "customScaleId",
  "scaleLabel",
] as const;
export interface StorageSizingValues {
  readonly configuration?: "grid" | "capacity-only";
  readonly columns: number;
  readonly rows: number;
  readonly cellWidthMm: number | null;
  readonly cellDepthMm: number | null;
  readonly scalePresetId: string;
  readonly interiorHeightMm?: number | null;
  readonly customScaleId?: string;
  readonly scaleLabel?: string;
}
const positive = (value: unknown): boolean =>
  Number.isSafeInteger(Number(value)) && Number(value) > 0;

export function storageMetricPreview(values: Record<string, unknown>) {
  const scale = SCALE_VALUES[String(values.scalePresetId)];
  const cellWidth = scale?.cellWidthMm ?? Number(values.cellWidthMm);
  const cellDepth = scale?.cellDepthMm ?? Number(values.cellDepthMm);
  const columns = Number(values.columns),
    rows = Number(values.rows);
  const height =
    values.interiorHeightMm === "" || values.interiorHeightMm == null
      ? null
      : Number(values.interiorHeightMm);
  const gridEnabled = values.configuration !== "capacity-only";
  const validGrid =
    [columns, rows, cellWidth, cellDepth].every(positive) &&
    Number.isSafeInteger(columns * cellWidth) &&
    Number.isSafeInteger(rows * cellDepth) &&
    (height === null || positive(height));
  const valid = gridEnabled ? validGrid : height === null || positive(height);
  let exampleColumns = validGrid ? Math.ceil(300 / cellWidth) : 1;
  let exampleRows = validGrid ? Math.ceil(200 / cellDepth) : 1;
  const directFit = exampleColumns <= columns && exampleRows <= rows;
  const rotatedFit =
    Math.ceil(200 / cellWidth) <= columns && Math.ceil(300 / cellDepth) <= rows;
  const exampleFloorFits =
    gridEnabled && validGrid && (directFit || rotatedFit);
  if (!directFit && rotatedFit) {
    exampleColumns = Math.ceil(200 / cellWidth);
    exampleRows = Math.ceil(300 / cellDepth);
  }
  const exampleFits = exampleFloorFits && height !== null && height >= 50;
  const useMetres =
    valid &&
    columns * cellWidth >= 1000 &&
    rows * cellDepth >= 1000 &&
    (height === null || height >= 1000);
  const unit = useMetres ? 1000 : 10;
  const format = (key: string, data: Record<string, string | number>) =>
    game.i18n.format(`D6E2.Storage.Metric.${key}`, data);
  const bounded = (n: number) =>
    Number.isFinite(n) ? Math.max(1, Math.min(24, n)) : 1;
  return {
    previewWidth: validGrid
      ? (120 * (columns * cellWidth)) /
        Math.max(columns * cellWidth, rows * cellDepth)
      : 120,
    previewHeight: validGrid
      ? (120 * (rows * cellDepth)) /
        Math.max(columns * cellWidth, rows * cellDepth)
      : 120,
    gridLabel: validGrid ? format("Grid", { columns, rows }) : "",
    valid,
    gridEnabled,
    exampleFloorFits,
    heightChecked: height !== null,
    dimensionsLabel: !gridEnabled
      ? game.i18n.localize("D6E2.Storage.CapacityOnly")
      : valid
        ? format(
            (height === null ? "DimensionsNoHeight" : "Dimensions") +
              (useMetres ? "Metres" : ""),
            {
              width: (columns * cellWidth) / unit,
              depth: (rows * cellDepth) / unit,
              height: (height ?? 0) / unit,
            },
          )
        : game.i18n.localize("D6E2.Storage.Metric.Invalid"),
    scaleLabel: valid
      ? format("Scale", { width: cellWidth / 10, depth: cellDepth / 10 })
      : "",
    exampleLabel: format("Example", {
      columns: exampleColumns,
      rows: exampleRows,
    }),
    exampleFitLabel: !gridEnabled
      ? game.i18n.localize("D6E2.Storage.CapacityOnly")
      : game.i18n.localize(
          `D6E2.Storage.Metric.${!valid ? "Invalid" : !exampleFloorFits ? "ExampleTooLarge" : height === null ? "ExampleHeightUnchecked" : exampleFits ? "ExampleFits" : "ExampleTooLarge"}`,
        ),
    exampleFits,
    columns: bounded(columns),
    rows: bounded(rows),
    exampleColumns: bounded(exampleColumns),
    exampleRows: bounded(exampleRows),
  };
}

export async function renderStorageSizing(
  values: StorageSizingValues,
  prefix: "" | "space." | "storageInterior.",
  canEdit: boolean,
): Promise<string> {
  const metricPreview = storageMetricPreview({ ...values });
  const render = (path: string, data: Record<string, unknown>) =>
    foundry.applications.handlebars.renderTemplate(path, data);
  const metricPreviewHtml = await render(
    "systems/d6-system-2e/templates/apps/grid-storage-metric-preview.hbs",
    metricPreview,
  );
  return render("systems/d6-system-2e/templates/apps/grid-storage-sizing.hbs", {
    ...values,
    interiorHeightMm: values.interiorHeightMm ?? null,
    canEdit,
    spacePresetId: "custom",
    spacePresets: [
      {
        value: "custom",
        label: game.i18n.localize("D6E2.Storage.Preset.Custom"),
        selected: true,
      },
      ...STORAGE_SPACE_PRESETS.map((p) => ({
        value: p.id,
        label: game.i18n.localize(p.labelKey),
        selected: false,
      })),
    ],
    scalePresetOptions: Object.fromEntries(
      Object.values(D6_STORAGE_SCALE_PRESETS).map((p) => [p.id, p.label]),
    ),
    fields: Object.fromEntries(
      sizingKeys.map((key) => [key, `${prefix}${key}`]),
    ),
    metricPreview,
    metricPreviewHtml,
  });
}

const bound = new WeakSet<HTMLElement>();
const containerBindings = new WeakMap<HTMLElement, () => void>();
/** Draft-only sizing; controls keep focus and no document is written until Save. */
export function bindStorageSizing(root: HTMLElement): void {
  for (const section of Array.from(
    root.querySelectorAll<HTMLElement>("[data-d6-storage-dimensions]"),
  )) {
    if (bound.has(section)) continue;
    bound.add(section);
    let revision = 0;
    const controls = new Map(
      Array.from(
        section.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
          "[name]",
        ),
      ).map((control) => [control.name.split(".").at(-1) ?? "", control]),
    );
    const canEdit = [...controls.values()].some(
      (control) => !control.disabled && control.type !== "hidden",
    );
    const container =
      section.closest<HTMLElement>("[data-d6-storage-space-editor]") ??
      section.closest<HTMLElement>("form");
    if (container) containerBindings.get(container)?.();
    const values = () => ({
      ...Object.fromEntries(
        [...controls].map(([key, control]) => [key, control.value]),
      ),
      configuration: container?.querySelector<HTMLSelectElement>(
        '[name="space.configuration"]',
      )?.value,
    });
    const update = async () => {
      const current = ++revision;
      const preview = storageMetricPreview(values());
      const height = controls.get("interiorHeightMm");
      height?.setCustomValidity(
        height.value && !positive(height.value)
          ? game.i18n.localize("D6E2.Storage.Error.InteriorHeight")
          : "",
      );
      section.dataset.storageSizingValid = String(preview.valid);
      for (const control of Array.from(
        section.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
          "[data-storage-grid-field]",
        ),
      ))
        control.disabled = !canEdit || !preview.gridEnabled;
      const save = container?.querySelector<HTMLButtonElement>(
        'button[data-action="saveStorageConfiguration"], button[data-action="save"]',
      );
      if (save) {
        const label = container?.querySelector<HTMLInputElement>(
          '[name="label"], [name="space.label"], [name="storageInterior.label"]',
        );
        save.disabled =
          !canEdit ||
          !preview.valid ||
          (label !== null && label !== undefined && !label.value.trim());
        save.setAttribute("aria-disabled", String(save.disabled));
        save.title =
          label && !label.value.trim()
            ? game.i18n.localize("D6E2.Storage.ConfigureNameRequired")
            : preview.valid
              ? ""
              : game.i18n.localize("D6E2.Storage.Metric.Invalid");
      }
      const html = await foundry.applications.handlebars.renderTemplate(
        "systems/d6-system-2e/templates/apps/grid-storage-metric-preview.hbs",
        preview,
      );
      const target = section.querySelector<HTMLElement>(
        "[data-d6-storage-metric-preview]",
      );
      if (target && current === revision) target.innerHTML = html;
    };
    section.addEventListener("change", (event) => {
      const target = event.target;
      if (
        !(
          target instanceof HTMLInputElement ||
          target instanceof HTMLSelectElement
        ) ||
        target.disabled
      )
        return;
      const key = target.name.split(".").at(-1);
      if (key === "spacePresetId") {
        const preset = storageSpacePresetValues(target.value);
        if (preset)
          for (const [field, value] of Object.entries(preset)) {
            const control = controls.get(field);
            if (control) control.value = String(value);
          }
      } else if (
        key &&
        sizingKeys.includes(key as (typeof sizingKeys)[number])
      ) {
        if (key === "scalePresetId") {
          const scale = SCALE_VALUES[target.value];
          if (scale)
            for (const field of ["cellWidthMm", "cellDepthMm"] as const) {
              const control = controls.get(field);
              if (control) control.value = String(scale[field]);
            }
        }
        if (key === "cellWidthMm" || key === "cellDepthMm") {
          const scale = controls.get("scalePresetId");
          if (scale) scale.value = "";
          const id = controls.get("customScaleId");
          if (id)
            id.value = `custom-${controls.get("cellWidthMm")?.value}x${controls.get("cellDepthMm")?.value}`;
        }
        const preset = controls.get("spacePresetId");
        if (preset) preset.value = "custom";
      }
      void update();
    });
    section.addEventListener("input", (event) => {
      if (event.target instanceof HTMLInputElement) {
        const key = event.target.name.split(".").at(-1);
        if (key === "cellWidthMm" || key === "cellDepthMm") {
          const scale = controls.get("scalePresetId");
          if (scale) scale.value = "";
          const id = controls.get("customScaleId");
          if (id)
            id.value = `custom-${controls.get("cellWidthMm")?.value}x${controls.get("cellDepthMm")?.value}`;
        }
        const preset = controls.get("spacePresetId");
        if (preset) preset.value = "custom";
        void update();
      }
    });
    const nameChanged = (event: Event) => {
      if (
        event.target instanceof HTMLInputElement &&
        ["label", "space.label", "storageInterior.label"].includes(
          event.target.name,
        )
      )
        void update();
    };
    const modeChanged = (event: Event) => {
      if (
        event.target instanceof HTMLSelectElement &&
        event.target.name === "space.configuration"
      )
        void update();
    };
    if (container) {
      container.addEventListener("input", nameChanged);
      container.addEventListener("change", modeChanged);
      containerBindings.set(container, () => {
        container.removeEventListener("input", nameChanged);
        container.removeEventListener("change", modeChanged);
      });
    }
    void update();
  }
}
