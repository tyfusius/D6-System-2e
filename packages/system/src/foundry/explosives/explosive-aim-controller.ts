import type {
  D6BlastProfile,
  D6ExplosiveRangeResolution,
} from "@d6-system-2e/core";
import type { D6CanvasPoint } from "../../application/explosive-workflow";
import type { D6ExplosiveAffectedTarget } from "../../application/explosive-workflow";
import { D6ExplosiveBlastOverlay } from "./explosive-canvas";

export interface D6ExplosiveAimResult {
  readonly difficulty: number;
  readonly point: D6CanvasPoint;
  readonly range: D6ExplosiveRangeResolution;
}

export interface D6ExplosiveAimOptions {
  readonly blastProfile: D6BlastProfile;
  readonly color: string;
  readonly origin: D6CanvasPoint;
  readonly targets: (
    point: D6CanvasPoint,
  ) => readonly D6ExplosiveAffectedTarget[];
  readonly resolve: (distance: number) => {
    readonly difficulty: number;
    readonly range: D6ExplosiveRangeResolution;
  };
  readonly title: string;
}

interface OverlayLayer {
  addChild(child: unknown): void;
  removeChild(child: unknown): void;
}

let activeAimControllers = 0;

export function isD6ExplosiveAimActive(): boolean {
  return activeAimControllers > 0;
}

export class D6ExplosiveAimController {
  async aim(
    options: D6ExplosiveAimOptions,
  ): Promise<D6ExplosiveAimResult | null> {
    const runtime = canvas as unknown as {
      readonly app?: { readonly view?: HTMLCanvasElement };
      canvasCoordinatesFromClient?(point: D6CanvasPoint): D6CanvasPoint;
      readonly interface?: OverlayLayer;
      readonly scene?: object;
    };
    if (
      !runtime.scene ||
      !runtime.interface ||
      !runtime.app?.view ||
      typeof runtime.canvasCoordinatesFromClient !== "function"
    )
      throw new Error("D6E2.Explosive.Error.CanvasUnavailable");
    const canvasView = runtime.app.view;
    const canvasCoordinatesFromClient =
      runtime.canvasCoordinatesFromClient.bind(runtime);
    const overlayLayer = runtime.interface;
    const overlay = new D6ExplosiveBlastOverlay(overlayLayer);
    let point: D6CanvasPoint | null = null;
    let resolution: ReturnType<D6ExplosiveAimOptions["resolve"]> | null = null;
    let dialog: HTMLElement | undefined;
    let affectedTargets: readonly D6ExplosiveAffectedTarget[] = [];

    const update = (): void => {
      const status = dialog?.querySelector<HTMLElement>(
        "[data-d6e2-explosive-status]",
      );
      const affected = dialog?.querySelector<HTMLElement>(
        "[data-d6e2-explosive-targets]",
      );
      const confirm = dialog?.querySelector<HTMLButtonElement>(
        '[data-action="confirm"]',
      );
      if (!status || !affected || !confirm) return;
      if (!resolution) {
        confirm.disabled = true;
        status.textContent = "";
        affected.replaceChildren();
        affected.hidden = true;
        return;
      }
      const band = resolution.range.band;
      confirm.disabled = resolution.range.outOfRange || band === null;
      status.textContent = resolution.range.outOfRange
        ? game.i18n.format("D6E2.Explosive.OutOfRange", {
            distance: resolution.range.distance.toFixed(1),
          })
        : game.i18n.format("D6E2.Explosive.AimStatus", {
            band: game.i18n.localize(rangeKey(band ?? "long")),
            difficulty: resolution.difficulty,
            distance: resolution.range.distance.toFixed(1),
          });
      affected.replaceChildren(
        ...affectedTargets
          .filter((target) => target.visible)
          .map((target) => {
            const entry = document.createElement("li");
            entry.textContent = game.i18n.format(
              "D6E2.Explosive.AffectedTarget",
              {
                name: target.label,
                zone: target.zone,
              },
            );
            return entry;
          }),
      );
      affected.hidden = affected.childElementCount === 0;
    };
    let lastMoveAt = Number.NEGATIVE_INFINITY;
    const move = (event: PointerEvent, force = false): boolean => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const now = Date.now();
      if (!force && now - lastMoveAt < 16) return false;
      if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY))
        return false;
      const raw = canvasCoordinatesFromClient({
        x: event.clientX,
        y: event.clientY,
      });
      if (!Number.isFinite(raw.x) || !Number.isFinite(raw.y)) return false;
      lastMoveAt = now;
      const grid = canvas.grid as unknown as {
        getSnappedPoint(
          point: D6CanvasPoint,
          options: { readonly mode: number },
        ): D6CanvasPoint;
        measurePath(points: readonly D6CanvasPoint[]): { distance: number };
      };
      point = grid.getSnappedPoint(raw, {
        mode: CONST.GRID_SNAPPING_MODES.VERTEX,
      });
      resolution = options.resolve(
        grid.measurePath([options.origin, point]).distance,
      );
      affectedTargets = options.targets(point);
      overlay.update({
        center: point,
        guideLabel: guideLabel(resolution),
        origin: options.origin,
        profile: options.blastProfile,
        targets: affectedTargets,
        themeColor: options.color,
      });
      update();
      return true;
    };
    const click = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      const updated = move(event, true);
      if (
        updated &&
        resolution &&
        !resolution.range.outOfRange &&
        resolution.range.band
      )
        dialog
          ?.querySelector<HTMLButtonElement>('[data-action="confirm"]')
          ?.click();
    };
    const escape = (event: KeyboardEvent): void => {
      if (event.key === "Escape")
        dialog
          ?.querySelector<HTMLButtonElement>('[data-action="cancel"]')
          ?.click();
    };
    const contextMenu = (event: Event): void => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      dialog
        ?.querySelector<HTMLButtonElement>('[data-action="cancel"]')
        ?.click();
    };
    const canvasTeardown = (): void => {
      dialog
        ?.querySelector<HTMLButtonElement>('[data-action="cancel"]')
        ?.click();
    };
    activeAimControllers += 1;
    canvasView.addEventListener("pointermove", move, true);
    canvasView.addEventListener("pointerdown", click, true);
    globalThis.addEventListener("keydown", escape, true);
    canvasView.addEventListener("contextmenu", contextMenu, true);
    Hooks.on("canvasTearDown", canvasTeardown);
    try {
      const result =
        await foundry.applications.api.DialogV2.wait<D6ExplosiveAimResult | null>(
          {
            buttons: [
              { action: "cancel", label: game.i18n.localize("D6E2.Cancel") },
              {
                action: "confirm",
                callback: () => {
                  if (
                    !point ||
                    !resolution ||
                    resolution.range.outOfRange ||
                    !resolution.range.band
                  )
                    return null;
                  return Object.freeze({
                    difficulty: resolution.difficulty,
                    point,
                    range: resolution.range,
                  });
                },
                default: true,
                icon: "fa-solid fa-crosshairs",
                label: game.i18n.localize("D6E2.Explosive.ConfirmPlacement"),
              },
            ],
            classes: ["d6e2", "od6roll-dialog", "d6e2-explosive-aim"],
            content: `<div class="d6e2-explosive-aim-panel"><p>${game.i18n.localize("D6E2.Explosive.AimHelp")}</p><p data-d6e2-explosive-status role="status" aria-live="polite"></p><ul data-d6e2-explosive-targets aria-label="${game.i18n.localize("D6E2.Explosive.AffectedTargets")}"></ul></div>`,
            modal: false,
            render: (_event, application) => {
              dialog = application.element;
              update();
            },
            window: { icon: "fa-solid fa-bomb", title: options.title },
          },
        );
      return result && typeof result === "object" ? result : null;
    } finally {
      canvasView.removeEventListener("pointermove", move, true);
      canvasView.removeEventListener("pointerdown", click, true);
      globalThis.removeEventListener("keydown", escape, true);
      canvasView.removeEventListener("contextmenu", contextMenu, true);
      Hooks.off("canvasTearDown", canvasTeardown);
      overlay.destroy();
      activeAimControllers = Math.max(0, activeAimControllers - 1);
    }
  }
}

function guideLabel(resolution: {
  readonly difficulty: number;
  readonly range: D6ExplosiveRangeResolution;
}): string {
  const distance = `${resolution.range.distance.toFixed(1)} ${game.i18n.localize("D6E2.Combat.Meters")}`;
  return resolution.range.outOfRange
    ? game.i18n.format("D6E2.Explosive.OutOfRange", {
        distance: resolution.range.distance.toFixed(1),
      })
    : `${distance} · ${game.i18n.localize(rangeKey(resolution.range.band ?? "long"))} · ${resolution.difficulty}`;
}

function rangeKey(band: string): string {
  return band === "point-blank"
    ? "D6E2.Combat.Range.PointBlank"
    : band === "short"
      ? "D6E2.Combat.Range.Short"
      : band === "medium"
        ? "D6E2.Combat.Range.Medium"
        : "D6E2.Combat.Range.Long";
}
