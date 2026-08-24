import { d6BlastZoneAtDistance } from "@d6-system-2e/core";
import type {
  D6CanvasPoint,
  D6ExplosiveRegionStateV1,
} from "../../application/explosive-workflow";
import {
  D6ExplosiveBlastOverlay,
  currentSceneExplosiveTargets,
} from "./explosive-canvas";
import { isD6ExplosiveAimActive } from "./explosive-aim-controller";
import {
  d6ExplosiveRegionState,
  requestD6ExplosiveMutation,
} from "./explosive-region";

interface OverlayParent {
  addChild(child: unknown): void;
  removeChild(child: unknown): void;
}

interface RegionDocumentLike {
  readonly hidden?: boolean;
  getFlag(scope: string, key: string): unknown;
}

interface PointerEventLike {
  readonly data?: {
    getLocalPosition(target: object): D6CanvasPoint;
  };
  getLocalPosition?(target: object): D6CanvasPoint;
}

interface PointerStage {
  off(event: "mousemove", handler: (event: unknown) => void): void;
  on(event: "mousemove", handler: (event: unknown) => void): void;
}

const activeOverlays = new Map<string, D6ExplosiveBlastOverlay>();

export function syncD6ExplosiveVisualization(
  state: D6ExplosiveRegionStateV1,
  sourceHidden: boolean,
): void {
  if (canvas.scene?.id !== state.sceneId || !maySee(state, sourceHidden)) {
    destroyD6ExplosiveVisualization(state.requestId);
    return;
  }
  const parent = (canvas as unknown as { readonly interface?: OverlayParent })
    .interface;
  if (!parent) return;
  let overlay = activeOverlays.get(state.requestId);
  if (!overlay) {
    overlay = new D6ExplosiveBlastOverlay(parent);
    activeOverlays.set(state.requestId, overlay);
  }
  const targets =
    state.affectedTargets.length > 0
      ? state.affectedTargets
      : currentSceneExplosiveTargets(state.resolvedPoint, state.blastProfile);
  overlay.update({
    ...(state.scatter
      ? {
          aimedPoint: state.aimedPoint,
          deviationMeters: state.scatter.distanceMeters,
        }
      : {}),
    center: state.resolvedPoint,
    profile: state.blastProfile,
    targets,
    themeColor: state.visualColor,
  });
}

/** Draw the authoritative state locally and yield through one paint boundary. */
export async function revealD6ExplosiveVisualization(
  state: D6ExplosiveRegionStateV1,
): Promise<void> {
  syncD6ExplosiveVisualization(state, false);
  await new Promise<void>((resolve) => {
    const frame = globalThis.requestAnimationFrame;
    if (typeof frame === "function") frame(() => resolve());
    else queueMicrotask(resolve);
  });
}

export function destroyD6ExplosiveVisualization(requestId: string): void {
  const overlay = activeOverlays.get(requestId);
  if (!overlay) return;
  overlay.destroy();
  activeOverlays.delete(requestId);
}

export function clearD6ExplosiveVisualizations(): void {
  for (const overlay of activeOverlays.values()) overlay.destroy();
  activeOverlays.clear();
}

export function selectD6ExplosiveFootprint(
  states: readonly D6ExplosiveRegionStateV1[],
  point: D6CanvasPoint,
  pixelsPerMeter: number,
): D6ExplosiveRegionStateV1 | null {
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    !Number.isFinite(pixelsPerMeter) ||
    pixelsPerMeter <= 0
  )
    return null;
  return (
    states
      .flatMap((state) => {
        const distancePixels = Math.hypot(
          point.x - state.resolvedPoint.x,
          point.y - state.resolvedPoint.y,
        );
        const distanceMeters = distancePixels / pixelsPerMeter;
        const zone = d6BlastZoneAtDistance(distanceMeters, state.blastProfile);
        return zone ? [{ distancePixels, state, zone }] : [];
      })
      .sort(
        (left, right) =>
          left.zone - right.zone ||
          left.distancePixels - right.distancePixels ||
          left.state.requestId.localeCompare(right.state.requestId),
      )[0]?.state ?? null
  );
}

export async function cancelD6ExplosiveAtPoint(
  point: D6CanvasPoint,
): Promise<string | null> {
  const user = game.user;
  const scene = canvas.scene as unknown as
    | {
        readonly id?: string;
        readonly regions?: {
          readonly contents?: readonly RegionDocumentLike[];
        };
      }
    | undefined;
  if (!user || !scene?.id) return null;
  const authorized: D6ExplosiveRegionStateV1[] = [];
  for (const region of scene.regions?.contents ?? []) {
    const state = d6ExplosiveRegionState(region);
    if (state?.sceneId !== scene.id) continue;
    if (user.isGM) {
      authorized.push(state);
      continue;
    }
    if (state.userId !== user.id) continue;
    const actor = (await fromUuid(
      state.actorUuid,
    )) as FoundryActorDocument | null;
    if (actor?.testUserPermission(user, "OWNER")) authorized.push(state);
  }
  const selected = selectD6ExplosiveFootprint(
    authorized,
    point,
    currentPixelsPerMeter(),
  );
  if (!selected) return null;
  await requestD6ExplosiveMutation({
    operation: "delete",
    regionId: selected.regionId,
    requestId: selected.requestId,
    sceneId: selected.sceneId,
  });
  return selected.requestId;
}

export function registerD6ExplosiveVisualizationLifecycle(): void {
  let lastPointer: D6CanvasPoint | undefined;
  let pointerStage: PointerStage | undefined;
  let pointerView: HTMLCanvasElement | undefined;
  const pointerMoved = (event: unknown): void => {
    const input = event as PointerEventLike;
    const target = (canvas as unknown as { readonly interface?: object })
      .interface;
    const point = target
      ? (input.getLocalPosition?.(target) ??
        input.data?.getLocalPosition(target))
      : undefined;
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y))
      lastPointer = Object.freeze({ x: point.x, y: point.y });
  };
  const contextMenu = (event: Event): void => {
    if (!lastPointer || isD6ExplosiveAimActive()) return;
    const states = visibleUserExplosiveStates();
    if (
      !selectD6ExplosiveFootprint(states, lastPointer, currentPixelsPerMeter())
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void cancelD6ExplosiveAtPoint(lastPointer).catch((error: unknown) => {
      console.error("D6 System | Failed to retire explosive footprint", error);
    });
  };
  const detachPointerDeletion = (): void => {
    pointerStage?.off("mousemove", pointerMoved);
    pointerView?.removeEventListener("contextmenu", contextMenu);
    pointerStage = undefined;
    pointerView = undefined;
    lastPointer = undefined;
  };
  const attachPointerDeletion = (): void => {
    detachPointerDeletion();
    const runtime = canvas as unknown as {
      readonly app?: { readonly view?: HTMLCanvasElement };
      readonly stage?: PointerStage;
    };
    if (!runtime.stage || !runtime.app?.view) return;
    pointerStage = runtime.stage;
    pointerView = runtime.app.view;
    pointerStage.on("mousemove", pointerMoved);
    pointerView.addEventListener("contextmenu", contextMenu);
  };
  const syncDocument = (value: unknown): void => {
    const state = d6ExplosiveRegionState(value as RegionDocumentLike);
    if (state)
      syncD6ExplosiveVisualization(
        state,
        (value as RegionDocumentLike).hidden === true,
      );
  };
  const syncScene = (): void => {
    clearD6ExplosiveVisualizations();
    const regions = (
      canvas.scene as unknown as
        | {
            readonly regions?: {
              readonly contents?: readonly RegionDocumentLike[];
            };
          }
        | undefined
    )?.regions?.contents;
    for (const region of regions ?? []) syncDocument(region);
  };
  Hooks.on("refreshRegion", (value: unknown) => {
    const placeable = value as {
      readonly document?: RegionDocumentLike;
      visible?: boolean;
    };
    const state = placeable.document
      ? d6ExplosiveRegionState(placeable.document)
      : null;
    if (!state) return;
    placeable.visible = false;
    syncD6ExplosiveVisualization(state, placeable.document?.hidden === true);
  });
  Hooks.on("createRegion", syncDocument);
  Hooks.on("updateRegion", syncDocument);
  Hooks.on("deleteRegion", (value: unknown) => {
    const state = d6ExplosiveRegionState(value as RegionDocumentLike);
    if (state) destroyD6ExplosiveVisualization(state.requestId);
  });
  Hooks.on("refreshToken", () => {
    const regions = (
      canvas.scene as unknown as
        | {
            readonly regions?: {
              readonly contents?: readonly RegionDocumentLike[];
            };
          }
        | undefined
    )?.regions?.contents;
    for (const region of regions ?? []) syncDocument(region);
  });
  Hooks.on("canvasReady", () => {
    syncScene();
    attachPointerDeletion();
  });
  Hooks.on("canvasTearDown", () => {
    detachPointerDeletion();
    clearD6ExplosiveVisualizations();
  });
}

function visibleUserExplosiveStates(): readonly D6ExplosiveRegionStateV1[] {
  const scene = canvas.scene as unknown as
    | {
        readonly id?: string;
        readonly regions?: {
          readonly contents?: readonly RegionDocumentLike[];
        };
      }
    | undefined;
  const user = game.user;
  if (!scene?.id || !user) return Object.freeze([]);
  return Object.freeze(
    (scene.regions?.contents ?? []).flatMap((region) => {
      const state = d6ExplosiveRegionState(region);
      return state &&
        state.sceneId === scene.id &&
        (user.isGM || state.userId === user.id) &&
        maySee(state, region.hidden === true)
        ? [state]
        : [];
    }),
  );
}

function currentPixelsPerMeter(): number {
  const dimensions = (
    canvas as unknown as {
      readonly dimensions?: {
        readonly distance?: number;
        readonly distancePixels?: number;
        readonly size?: number;
      };
    }
  ).dimensions;
  return (
    dimensions?.distancePixels ??
    (dimensions?.size ?? 1) / (dimensions?.distance ?? 1)
  );
}

function maySee(
  state: D6ExplosiveRegionStateV1,
  sourceHidden: boolean,
): boolean {
  return (
    !sourceHidden || game.user?.isGM === true || game.user?.id === state.userId
  );
}
