import {
  d6BlastZoneAtDistance,
  type D6BlastProfile,
  type D6BlastZoneIndex,
} from "@d6-system-2e/core";
import type {
  D6CanvasPoint,
  D6ExplosiveAffectedTarget,
} from "../../application/explosive-workflow";

interface OverlayParent {
  addChild(child: unknown): void;
  removeChild(child: unknown): void;
}

interface DisplayContainer extends OverlayParent {
  destroy(options?: object): void;
  eventMode?: string;
  removeChildren(): { destroy?(options?: object): void }[];
  zIndex?: number;
}

interface GraphicsShape {
  beginFill?(color: number, alpha?: number): void;
  circle?(x: number, y: number, radius: number): GraphicsShape;
  destroy?(options?: object): void;
  drawCircle?(x: number, y: number, radius: number): void;
  endFill?(): void;
  fill?(options: object): GraphicsShape;
  lineStyle?(width: number, color: number, alpha?: number): void;
  lineTo?(x: number, y: number): GraphicsShape;
  moveTo?(x: number, y: number): GraphicsShape;
  stroke?(options: object): GraphicsShape;
}

interface TextShape {
  anchor?: { set(x: number, y?: number): void };
  destroy?(options?: object): void;
  eventMode?: string;
  text?: string;
  x?: number;
  y?: number;
}

export interface CanvasLabelBounds {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

interface CanvasLabelPosition extends D6CanvasPoint {
  readonly align: "center" | "left" | "right";
}

export interface D6BlastOverlayLabelLayout {
  readonly guide: CanvasLabelPosition;
  readonly side: "left" | "right";
  readonly zones: readonly CanvasLabelPosition[];
}

interface ClientRectangle {
  readonly bottom: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly width: number;
}

export interface D6BlastZoneVisual {
  readonly color: string;
  readonly index: D6BlastZoneIndex;
  readonly radiusMeters: number;
}

export interface D6ExplosiveBlastOverlayOptions {
  readonly aimedPoint?: D6CanvasPoint;
  readonly center: D6CanvasPoint;
  readonly deviationMeters?: number;
  readonly guideLabel?: string;
  readonly origin?: D6CanvasPoint;
  readonly profile: D6BlastProfile;
  readonly targets?: readonly D6ExplosiveAffectedTarget[];
  readonly themeColor: string;
}

const ZONE_COLORS: Readonly<Record<D6BlastZoneIndex, string>> = Object.freeze({
  1: "#ff2020",
  2: "#ff5a1f",
  3: "#ff9800",
  4: "#ffd400",
});

const LABEL_EDGE_MARGIN = 12;
const LABEL_ESTIMATED_WIDTH = 210;
const LABEL_HALF_HEIGHT = 9;
const LABEL_STACK_SPACING = 22;

export function d6BlastOverlayLabelLayout(
  center: D6CanvasPoint,
  outerRadius: number,
  zoneCount: number,
  bounds: CanvasLabelBounds | null = canvasLabelBounds(),
): D6BlastOverlayLabelLayout {
  const count = Math.max(0, Math.trunc(zoneCount));
  const minX = (bounds?.x ?? Number.NEGATIVE_INFINITY) + LABEL_EDGE_MARGIN;
  const maxX =
    (bounds ? bounds.x + bounds.width : Number.POSITIVE_INFINITY) -
    LABEL_EDGE_MARGIN;
  const proposedRight = center.x + outerRadius + LABEL_EDGE_MARGIN;
  const proposedLeft = center.x - outerRadius - LABEL_EDGE_MARGIN;
  const rightFits = proposedRight + LABEL_ESTIMATED_WIDTH <= maxX;
  const leftFits = proposedLeft - LABEL_ESTIMATED_WIDTH >= minX;
  const side =
    rightFits || (!leftFits && maxX - center.x >= center.x - minX)
      ? "right"
      : "left";
  const x =
    side === "right"
      ? clamp(proposedRight, minX, maxX - LABEL_ESTIMATED_WIDTH)
      : clamp(proposedLeft, minX + LABEL_ESTIMATED_WIDTH, maxX);
  const minY = (bounds?.y ?? Number.NEGATIVE_INFINITY) + LABEL_HALF_HEIGHT;
  const maxY =
    (bounds ? bounds.y + bounds.height : Number.POSITIVE_INFINITY) -
    LABEL_HALF_HEIGHT;
  const stackHeight = Math.max(0, count - 1) * LABEL_STACK_SPACING;
  const firstY = clamp(center.y - stackHeight / 2, minY, maxY - stackHeight);
  const zones = Object.freeze(
    Array.from({ length: count }, (_, index) =>
      Object.freeze({
        align: side === "right" ? ("left" as const) : ("right" as const),
        x,
        y: firstY + index * LABEL_STACK_SPACING,
      }),
    ),
  );
  const oppositeSide = side === "right" ? "left" : "right";
  const oppositeFits = oppositeSide === "right" ? rightFits : leftFits;
  const guideSide = oppositeFits ? oppositeSide : side;
  const guideX =
    guideSide === "right"
      ? clamp(proposedRight, minX, maxX - LABEL_ESTIMATED_WIDTH)
      : clamp(proposedLeft, minX + LABEL_ESTIMATED_WIDTH, maxX);
  const guideY = oppositeFits
    ? clamp(center.y, minY, maxY)
    : clamp((zones.at(-1)?.y ?? center.y) + LABEL_STACK_SPACING, minY, maxY);
  return Object.freeze({
    guide: Object.freeze({
      align: guideSide === "right" ? "left" : "right",
      x: guideX,
      y: guideY,
    }),
    side,
    zones,
  });
}

export function d6VisibleCanvasLabelBounds(): CanvasLabelBounds | null {
  const runtime = canvas as unknown as {
    readonly app?: {
      readonly view?: {
        getBoundingClientRect?(): ClientRectangle;
      };
    };
    canvasCoordinatesFromClient?(point: D6CanvasPoint): D6CanvasPoint;
  };
  const viewRect = validClientRectangle(
    runtime.app?.view?.getBoundingClientRect?.(),
  );
  const convert = runtime.canvasCoordinatesFromClient?.bind(runtime);
  if (!viewRect || typeof convert !== "function") return canvasSceneBounds();

  let visibleRight = viewRect.right;
  const sidebar =
    typeof document === "undefined" ? null : document.querySelector("#sidebar");
  const sidebarRect = visibleElementRectangle(sidebar);
  if (
    sidebarRect &&
    sidebarRect.left >= viewRect.left + viewRect.width / 2 &&
    sidebarRect.left < visibleRight &&
    sidebarRect.right > viewRect.left &&
    sidebarRect.bottom > viewRect.top &&
    sidebarRect.top < viewRect.bottom
  )
    visibleRight = sidebarRect.left;

  if (visibleRight <= viewRect.left) return canvasSceneBounds();
  const topLeft = convert({
    x: viewRect.left,
    y: viewRect.top,
  });
  const bottomRight = convert({
    x: visibleRight,
    y: viewRect.bottom,
  });
  const x = Math.min(topLeft.x, bottomRight.x);
  const y = Math.min(topLeft.y, bottomRight.y);
  const width = Math.abs(bottomRight.x - topLeft.x);
  const height = Math.abs(bottomRight.y - topLeft.y);
  return Number.isFinite(x) &&
    Number.isFinite(y) &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
    ? { height, width, x, y }
    : canvasSceneBounds();
}

export function d6BlastZoneVisuals(
  profile: D6BlastProfile,
): readonly D6BlastZoneVisual[] {
  return Object.freeze(
    profile.zones.map((zone) =>
      Object.freeze({
        color: ZONE_COLORS[zone.index],
        index: zone.index,
        radiusMeters: zone.radiusMeters,
      }),
    ),
  );
}

export class D6ExplosiveBlastOverlay {
  readonly #parent: OverlayParent;
  readonly #root: DisplayContainer;

  constructor(parent: OverlayParent) {
    const Container = (
      globalThis as unknown as {
        PIXI?: { Container?: new () => DisplayContainer };
      }
    ).PIXI?.Container;
    if (!Container) throw new Error("D6E2.Explosive.Error.CanvasUnavailable");
    this.#parent = parent;
    this.#root = new Container();
    this.#root.eventMode = "none";
    this.#root.zIndex = 10_000;
    parent.addChild(this.#root);
  }

  update(options: D6ExplosiveBlastOverlayOptions): void {
    for (const child of this.#root.removeChildren())
      child.destroy?.({ children: true });
    const Graphics = (
      globalThis as unknown as { PIXI?: { Graphics?: new () => GraphicsShape } }
    ).PIXI?.Graphics;
    if (!Graphics) throw new Error("D6E2.Explosive.Error.CanvasUnavailable");
    const graphics = new Graphics();
    this.#root.addChild(graphics);
    const themeColor = safeHexColor(options.themeColor, "#65b9ff");
    if (options.origin)
      this.#line(graphics, options.origin, options.center, themeColor, 3);
    const zones = d6BlastZoneVisuals(options.profile);
    const sortedZones = [...zones].sort(
      (left, right) => right.radiusMeters - left.radiusMeters,
    );
    const outerRadius = Math.max(
      0,
      ...zones.map((zone) => zone.radiusMeters * pixelsPerMeter()),
    );
    const labelLayout = d6BlastOverlayLabelLayout(
      options.center,
      outerRadius,
      sortedZones.length,
    );
    for (const [index, zone] of sortedZones.entries()) {
      const radius = zone.radiusMeters * pixelsPerMeter();
      this.#circle(graphics, options.center, radius, zone.color, 3, 0.95);
      const labelPosition = labelLayout.zones[index];
      if (!labelPosition) continue;
      this.#line(
        graphics,
        {
          x:
            options.center.x +
            (labelLayout.side === "right" ? radius : -radius),
          y: options.center.y,
        },
        labelPosition,
        zone.color,
        2,
      );
      this.#label(
        `${game.i18n.localize("D6E2.Explosive.Zone")} ${zone.index} · ${zone.radiusMeters} ${game.i18n.localize("D6E2.Combat.Meters")}`,
        labelPosition.x,
        labelPosition.y,
        zone.color,
        labelPosition.align,
      );
    }
    this.#reticle(graphics, options.center, themeColor);
    if (
      options.aimedPoint &&
      options.deviationMeters !== undefined &&
      options.deviationMeters > 0
    )
      this.#deviation(
        graphics,
        options.aimedPoint,
        options.center,
        options.deviationMeters,
        themeColor,
      );
    for (const target of options.targets ?? [])
      this.#target(graphics, target, zones);
    if (options.guideLabel)
      this.#label(
        options.guideLabel,
        labelLayout.guide.x,
        labelLayout.guide.y,
        themeColor,
        labelLayout.guide.align,
      );
  }

  destroy(): void {
    this.#parent.removeChild(this.#root);
    this.#root.destroy({ children: true });
  }

  #circle(
    graphics: GraphicsShape,
    center: D6CanvasPoint,
    radius: number,
    color: string,
    width: number,
    alpha: number,
  ): void {
    const numeric = numericColor(color);
    const path = graphics.circle?.(center.x, center.y, radius);
    if (path?.stroke) path.stroke({ alpha, color: numeric, width });
    else {
      graphics.lineStyle?.(width, numeric, alpha);
      graphics.drawCircle?.(center.x, center.y, radius);
    }
  }

  #line(
    graphics: GraphicsShape,
    from: D6CanvasPoint,
    to: D6CanvasPoint,
    color: string,
    width: number,
  ): void {
    graphics.moveTo?.(from.x, from.y);
    graphics.lineTo?.(to.x, to.y);
    if (graphics.stroke)
      graphics.stroke({ alpha: 0.98, color: numericColor(color), width });
    else {
      graphics.lineStyle?.(width, numericColor(color), 0.98);
      graphics.moveTo?.(from.x, from.y);
      graphics.lineTo?.(to.x, to.y);
    }
  }

  #reticle(
    graphics: GraphicsShape,
    center: D6CanvasPoint,
    color: string,
  ): void {
    this.#circle(graphics, center, 8, color, 3, 1);
    this.#line(
      graphics,
      { x: center.x - 14, y: center.y },
      { x: center.x + 14, y: center.y },
      color,
      2,
    );
    this.#line(
      graphics,
      { x: center.x, y: center.y - 14 },
      { x: center.x, y: center.y + 14 },
      color,
      2,
    );
  }

  #deviation(
    graphics: GraphicsShape,
    aimed: D6CanvasPoint,
    resolved: D6CanvasPoint,
    distanceMeters: number,
    color: string,
  ): void {
    this.#circle(graphics, aimed, 7, "#ffffff", 2, 0.9);
    this.#line(graphics, aimed, resolved, color, 5);
    const angle = Math.atan2(resolved.y - aimed.y, resolved.x - aimed.x);
    for (const offset of [-0.55, 0.55])
      this.#line(
        graphics,
        resolved,
        {
          x: resolved.x - Math.cos(angle + offset) * 16,
          y: resolved.y - Math.sin(angle + offset) * 16,
        },
        color,
        4,
      );
    this.#label(
      `${game.i18n.localize("D6E2.Explosive.Scatter")} · ${distanceMeters} ${game.i18n.localize("D6E2.Combat.Meters")}`,
      (aimed.x + resolved.x) / 2,
      (aimed.y + resolved.y) / 2 - 18,
      color,
      "center",
    );
  }

  #target(
    graphics: GraphicsShape,
    target: D6ExplosiveAffectedTarget,
    zones: readonly D6BlastZoneVisual[],
  ): void {
    const token = canvas.tokens?.placeables.find(
      (entry) => entry.id === target.tokenId,
    );
    if (!token?.center || token.visible === false || !target.visible) return;
    const bounds = token as unknown as {
      readonly bounds?: { readonly height?: number; readonly width?: number };
    };
    const radius =
      Math.max(bounds.bounds?.width ?? 0, bounds.bounds?.height ?? 0, 36) / 2 +
      10;
    const color =
      zones.find((zone) => zone.index === target.zone)?.color ?? "#ffffff";
    const numeric = numericColor(color);
    const path = graphics.circle?.(token.center.x, token.center.y, radius);
    if (path?.fill && path.stroke) {
      path.fill({ alpha: 0.16, color: numeric });
      path.stroke({ alpha: 1, color: numeric, width: 5 });
    } else {
      graphics.beginFill?.(numeric, 0.16);
      graphics.drawCircle?.(token.center.x, token.center.y, radius);
      graphics.endFill?.();
      this.#circle(graphics, token.center, radius, color, 5, 1);
    }
    this.#label(
      `${game.i18n.localize("D6E2.Explosive.Zone")} ${target.zone}`,
      token.center.x,
      token.center.y - radius - 14,
      color,
      "center",
    );
  }

  #label(
    text: string,
    x: number,
    y: number,
    color: string,
    align: "center" | "left" | "right",
  ): void {
    const Text = (
      globalThis as unknown as {
        PIXI?: {
          Text?: new (
            text: string,
            style?: Record<string, unknown>,
          ) => TextShape;
        };
      }
    ).PIXI?.Text;
    if (!Text) return;
    const label = new Text(text, {
      dropShadow: true,
      dropShadowAlpha: 0.95,
      dropShadowBlur: 4,
      dropShadowColor: "#000000",
      dropShadowDistance: 1,
      fill: safeHexColor(color, "#ffffff"),
      fontSize: 14,
      fontWeight: "800",
      stroke: "#05070a",
      strokeThickness: 3,
    });
    label.eventMode = "none";
    label.anchor?.set(
      align === "center" ? 0.5 : align === "right" ? 1 : 0,
      0.5,
    );
    label.x = x;
    label.y = y;
    this.#root.addChild(label);
  }
}

function safeHexColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : fallback;
}

function numericColor(value: string): number {
  return Number.parseInt(safeHexColor(value, "#ffffff").slice(1), 16);
}

function canvasLabelBounds(): CanvasLabelBounds | null {
  return d6VisibleCanvasLabelBounds();
}

function canvasSceneBounds(): CanvasLabelBounds | null {
  const sceneRect = (
    canvas as unknown as {
      readonly dimensions?: {
        readonly sceneRect?: Partial<CanvasLabelBounds>;
      };
    }
  ).dimensions?.sceneRect;
  return Number.isFinite(sceneRect?.x) &&
    Number.isFinite(sceneRect?.y) &&
    Number.isFinite(sceneRect?.width) &&
    Number.isFinite(sceneRect?.height) &&
    (sceneRect?.width ?? 0) > 0 &&
    (sceneRect?.height ?? 0) > 0
    ? {
        height: sceneRect?.height ?? 0,
        width: sceneRect?.width ?? 0,
        x: sceneRect?.x ?? 0,
        y: sceneRect?.y ?? 0,
      }
    : null;
}

function validClientRectangle(value: unknown): ClientRectangle | null {
  if (!value || typeof value !== "object") return null;
  const rectangle = value as Partial<ClientRectangle>;
  return Number.isFinite(rectangle.left) &&
    Number.isFinite(rectangle.right) &&
    Number.isFinite(rectangle.top) &&
    Number.isFinite(rectangle.bottom) &&
    Number.isFinite(rectangle.width) &&
    Number.isFinite(rectangle.height) &&
    (rectangle.width ?? 0) > 0 &&
    (rectangle.height ?? 0) > 0
    ? (rectangle as ClientRectangle)
    : null;
}

function visibleElementRectangle(
  element: Element | null,
): ClientRectangle | null {
  if (!element) return null;
  if (element.getClientRects().length === 0) return null;
  return validClientRectangle(element.getBoundingClientRect());
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (minimum > maximum) return (minimum + maximum) / 2;
  return Math.min(maximum, Math.max(minimum, value));
}

export function currentSceneExplosiveTargets(
  center: D6CanvasPoint,
  profile: D6BlastProfile,
): readonly D6ExplosiveAffectedTarget[] {
  return Object.freeze(
    (canvas.tokens?.placeables ?? [])
      .flatMap<D6ExplosiveAffectedTarget>((token) => {
        const actor = token.actor;
        if (!actor?.id || token.isPreview) return [];
        if (!token.center) return [];
        const distance = tokenFootprintDistanceMeters(center, token as never);
        const zone = d6BlastZoneAtDistance(distance, profile);
        if (!zone || blastWallBlocks(center, token.center)) return [];
        const visible = token.visible !== false;
        const tokenLabel = token.name?.trim();
        return [
          {
            actorId: actor.id,
            label: visible ? (tokenLabel ?? actor.name) : "",
            tokenId: token.id,
            visible,
            zone,
          },
        ];
      })
      .sort(
        (left, right) =>
          left.zone - right.zone || left.tokenId.localeCompare(right.tokenId),
      ),
  );
}

function tokenFootprintDistanceMeters(
  center: D6CanvasPoint,
  token: {
    readonly bounds?: {
      readonly height?: number;
      readonly width?: number;
      readonly x?: number;
      readonly y?: number;
    };
    readonly center: D6CanvasPoint;
  },
): number {
  const bounds = token.bounds;
  const grid = canvas.grid;
  if (!grid) return Number.POSITIVE_INFINITY;
  if (
    !bounds?.width ||
    !bounds.height ||
    bounds.x === undefined ||
    bounds.y === undefined
  ) {
    return grid.measurePath([center, token.center]).distance;
  }
  const closest = {
    x: Math.max(bounds.x, Math.min(center.x, bounds.x + bounds.width)),
    y: Math.max(bounds.y, Math.min(center.y, bounds.y + bounds.height)),
  };
  return grid.measurePath([center, closest]).distance;
}

function blastWallBlocks(from: D6CanvasPoint, to: D6CanvasPoint): boolean {
  const backends = (
    CONFIG as unknown as {
      readonly Canvas?: {
        readonly polygonBackends?: Readonly<
          Record<
            string,
            {
              testCollision(
                a: D6CanvasPoint,
                b: D6CanvasPoint,
                options: object,
              ): unknown;
            }
          >
        >;
      };
    }
  ).Canvas?.polygonBackends;
  return (
    backends?.sight?.testCollision(from, to, { mode: "any", type: "sight" }) ===
    true
  );
}

function pixelsPerMeter(): number {
  const dimensions = canvas as unknown as {
    readonly dimensions?: {
      readonly distance?: number;
      readonly distancePixels?: number;
      readonly size?: number;
    };
  };
  return (
    dimensions.dimensions?.distancePixels ??
    (dimensions.dimensions?.size ?? 1) / (dimensions.dimensions?.distance ?? 1)
  );
}
