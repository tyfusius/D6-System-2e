import { tokenAnchorEnabled } from "./settings";

export interface Rectangle {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface HudAnchorPosition {
  readonly left: number;
  readonly top: number;
}

export type TokenAnchorPlacement = "above" | "below" | "left" | "right";

export interface TokenAnchorSelection {
  readonly placement: TokenAnchorPlacement;
  readonly position: HudAnchorPosition;
}

export interface TokenAnchorMemory extends TokenAnchorSelection {
  readonly tokenId: string;
  readonly viewport: Pick<Rectangle, "height" | "width">;
}

export interface FlyoutPlacement {
  readonly direction: "down" | "up";
  readonly maxHeight: number;
}

const GAP = 12;
const BLOCKER_CLEARANCE = 12;
const VIEWPORT_HYSTERESIS = 16;
const VIEWPORT_MARGIN = 8;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

interface AnchorCandidate {
  readonly affectedTokenCount: number;
  readonly anchorOverlap: number;
  readonly blockerOverlap: number;
  readonly distance: number;
  readonly order: number;
  readonly placement: TokenAnchorPlacement;
  readonly position: HudAnchorPosition;
}

function expanded(rectangle: Rectangle, amount: number): Rectangle {
  return {
    height: rectangle.height + amount * 2,
    width: rectangle.width + amount * 2,
    x: rectangle.x - amount,
    y: rectangle.y - amount,
  };
}

function overlapArea(left: Rectangle, right: Rectangle): number {
  const width = Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) -
      Math.max(left.x, right.x),
  );
  const height = Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) -
      Math.max(left.y, right.y),
  );
  return width * height;
}

function rectangleDistance(left: Rectangle, right: Rectangle): number {
  const horizontal = Math.max(
    0,
    left.x - (right.x + right.width),
    right.x - (left.x + left.width),
  );
  const vertical = Math.max(
    0,
    left.y - (right.y + right.height),
    right.y - (left.y + left.height),
  );
  return Math.hypot(horizontal, vertical);
}

export function selectTokenAnchorPosition(
  token: Rectangle,
  hud: Pick<Rectangle, "height" | "width">,
  viewport: Pick<Rectangle, "height" | "width">,
  blockers: readonly Rectangle[] = [],
  previousPlacement?: TokenAnchorPlacement,
): TokenAnchorSelection | null {
  const centeredLeft = token.x + token.width / 2 - hud.width / 2;
  const centeredTop = token.y + token.height / 2 - hud.height / 2;
  const right = token.x + token.width + GAP;
  const left = token.x - hud.width - GAP;
  const below = token.y + token.height + GAP;
  const above = token.y - hud.height - GAP;
  const ideals: readonly (readonly [TokenAnchorPlacement, number, number])[] = [
    ["above", centeredLeft, above],
    ["below", centeredLeft, below],
    ["left", left, centeredTop],
    ["right", right, centeredTop],
  ];
  const expandedAnchor = expanded(token, BLOCKER_CLEARANCE);
  const expandedBlockers = blockers.map((blocker) =>
    expanded(blocker, BLOCKER_CLEARANCE),
  );
  const candidates = ideals.map(([placement, idealLeft, idealTop], order) => {
    const position = Object.freeze({
      left: Math.round(
        clamp(
          idealLeft,
          VIEWPORT_MARGIN,
          viewport.width - hud.width - VIEWPORT_MARGIN,
        ),
      ),
      top: Math.round(
        clamp(
          idealTop,
          VIEWPORT_MARGIN,
          viewport.height - hud.height - VIEWPORT_MARGIN,
        ),
      ),
    });
    const rectangle = {
      height: hud.height,
      width: hud.width,
      x: position.left,
      y: position.top,
    };
    const blockerOverlaps = expandedBlockers.map((blocker) =>
      overlapArea(rectangle, blocker),
    );
    return {
      affectedTokenCount: blockerOverlaps.filter((area) => area > 0).length,
      anchorOverlap: overlapArea(rectangle, expandedAnchor),
      blockerOverlap: blockerOverlaps.reduce((total, area) => total + area, 0),
      distance: rectangleDistance(rectangle, token),
      order,
      placement,
      position,
    } satisfies AnchorCandidate;
  });
  const anchorSafe = candidates.filter(
    (candidate) => candidate.anchorOverlap === 0,
  );
  if (anchorSafe.length === 0) return null;
  const empty = anchorSafe.filter(
    (candidate) => candidate.blockerOverlap === 0,
  );
  const ranked =
    empty.length > 0
      ? [...empty].sort(
          (leftCandidate, rightCandidate) =>
            leftCandidate.order - rightCandidate.order,
        )
      : [...anchorSafe].sort(
          (leftCandidate, rightCandidate) =>
            leftCandidate.blockerOverlap - rightCandidate.blockerOverlap ||
            leftCandidate.affectedTokenCount -
              rightCandidate.affectedTokenCount ||
            leftCandidate.distance - rightCandidate.distance ||
            leftCandidate.order - rightCandidate.order,
        );
  const best = ranked[0];
  if (!best) return null;
  const previous = previousPlacement
    ? anchorSafe.find((candidate) => candidate.placement === previousPlacement)
    : undefined;
  const meaningfulImprovement =
    previous !== undefined &&
    (best.affectedTokenCount < previous.affectedTokenCount ||
      (best.blockerOverlap < previous.blockerOverlap &&
        best.blockerOverlap <= previous.blockerOverlap * 0.8));
  const selected = previous && !meaningfulImprovement ? previous : best;
  return Object.freeze({
    placement: selected.placement,
    position: selected.position,
  });
}

export function positionBesideToken(
  token: Rectangle,
  hud: Pick<Rectangle, "height" | "width">,
  viewport: Pick<Rectangle, "height" | "width">,
  blockers: readonly Rectangle[] = [],
): HudAnchorPosition | null {
  return (
    selectTokenAnchorPosition(token, hud, viewport, blockers)?.position ?? null
  );
}

export function rememberedTokenAnchorPlacement(
  memory: TokenAnchorMemory | null,
  tokenId: string,
  viewport: Pick<Rectangle, "height" | "width">,
): TokenAnchorPlacement | undefined {
  if (!memory) return undefined;
  if (
    tokenId.length === 0 ||
    memory.tokenId !== tokenId ||
    Math.abs(memory.viewport.width - viewport.width) > VIEWPORT_HYSTERESIS ||
    Math.abs(memory.viewport.height - viewport.height) > VIEWPORT_HYSTERESIS
  ) {
    return undefined;
  }
  return memory.placement;
}

export function placeFlyout(
  group: Pick<Rectangle, "height" | "y">,
  flyoutHeight: number,
  viewportHeight: number,
): FlyoutPlacement {
  const groupBottom = group.y + group.height;
  const spaceBelow = Math.max(
    0,
    viewportHeight - VIEWPORT_MARGIN - groupBottom,
  );
  const spaceAbove = Math.max(0, group.y - VIEWPORT_MARGIN);
  const direction =
    flyoutHeight <= spaceBelow || spaceBelow >= spaceAbove ? "down" : "up";
  return Object.freeze({
    direction,
    maxHeight: Math.floor(direction === "down" ? spaceBelow : spaceAbove),
  });
}

interface RuntimeToken {
  readonly destroyed?: boolean;
  readonly document?: { readonly hidden?: boolean };
  getBounds?(): Rectangle;
  readonly id?: string;
  readonly renderable?: boolean;
  readonly visible?: boolean;
}

interface RuntimeCanvas {
  readonly app?: {
    readonly renderer?: {
      readonly screen?: { readonly height: number; readonly width: number };
    };
    readonly view?: {
      getBoundingClientRect(): {
        readonly height: number;
        readonly left: number;
        readonly top: number;
        readonly width: number;
      };
    };
  };
  readonly tokens?: {
    readonly controlled?: readonly RuntimeToken[];
    readonly placeables?: readonly RuntimeToken[];
  };
}

export interface ScreenTokenRectangles {
  readonly anchor: Rectangle;
  readonly blockers: readonly Rectangle[];
  readonly controlled: RuntimeToken;
  readonly tokenId: string;
}

export function collectScreenTokenRectangles(
  runtimeCanvas: RuntimeCanvas | undefined,
): ScreenTokenRectangles | null {
  const token = runtimeCanvas?.tokens?.controlled?.[0];
  const bounds = token?.getBounds?.();
  const view = runtimeCanvas?.app?.view;
  const screen = runtimeCanvas?.app?.renderer?.screen;
  if (
    !token ||
    !bounds ||
    !view ||
    !screen ||
    screen.width <= 0 ||
    screen.height <= 0
  ) {
    return null;
  }
  const canvasRect = view.getBoundingClientRect();
  const scaleX = canvasRect.width / screen.width;
  const scaleY = canvasRect.height / screen.height;
  const screenRectangle = (rectangle: Rectangle): Rectangle => ({
    height: rectangle.height * scaleY,
    width: rectangle.width * scaleX,
    x: canvasRect.left + rectangle.x * scaleX,
    y: canvasRect.top + rectangle.y * scaleY,
  });
  const anchor = screenRectangle(bounds);
  const blockers = (runtimeCanvas.tokens.placeables ?? []).flatMap(
    (placeable) => {
      if (
        placeable === token ||
        placeable.destroyed === true ||
        placeable.document?.hidden === true ||
        placeable.renderable === false ||
        placeable.visible === false
      ) {
        return [];
      }
      const blocker = placeable.getBounds?.();
      if (!blocker || blocker.width <= 0 || blocker.height <= 0) return [];
      return [screenRectangle(blocker)];
    },
  );
  return Object.freeze({
    anchor: Object.freeze(anchor),
    blockers: Object.freeze(blockers),
    controlled: token,
    tokenId: token.id ?? "",
  });
}

function canvasTokenRectangles(): ScreenTokenRectangles | null {
  return collectScreenTokenRectangles(
    (globalThis as { readonly canvas?: RuntimeCanvas }).canvas,
  );
}

export function createFrameCoalescer(
  requestFrame: (callback: () => void) => unknown,
  callback: () => void,
): () => void {
  let pending = false;
  return () => {
    if (pending) return;
    pending = true;
    requestFrame(() => {
      pending = false;
      callback();
    });
  };
}

export function createBoundedFrameRetry(
  requestFrame: (callback: () => void) => unknown,
  attempt: () => boolean,
  maximumFrames: number,
): () => void {
  let pending = false;
  return () => {
    if (pending) return;
    pending = true;
    let remaining = Math.max(1, Math.floor(maximumFrames));
    const retry = (): void => {
      remaining -= 1;
      if (attempt() || remaining === 0) {
        pending = false;
        return;
      }
      requestFrame(retry);
    };
    requestFrame(retry);
  };
}

let lastAnchorMemory: TokenAnchorMemory | null = null;

function resetStickyPlacement(): void {
  lastAnchorMemory = null;
}

function visibleRectangle(selector: string): DOMRect | null {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return null;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return null;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect : null;
}

function usableViewport(): Pick<Rectangle, "height" | "width"> {
  const bottom = ["#ui-bottom", "#hotbar", ".hotbar"]
    .map(visibleRectangle)
    .filter((rect): rect is DOMRect => rect !== null)
    .map(({ top }) => top)
    .filter((top) => top > window.innerHeight / 2);
  const right = ["#sidebar", "#ui-right"]
    .map(visibleRectangle)
    .filter((rect): rect is DOMRect => rect !== null)
    .map(({ left }) => left)
    .filter((left) => left > window.innerWidth / 2);
  return {
    height: Math.min(window.innerHeight, ...bottom),
    width: Math.min(window.innerWidth, ...right),
  };
}

function directChild(parent: Element, selector: string): HTMLElement | null {
  return (
    (Array.from(parent.children).find((child) => child.matches(selector)) as
      HTMLElement | undefined) ?? null
  );
}

function refreshFlyouts(element: HTMLElement, viewportHeight: number): void {
  for (const group of Array.from(
    element.querySelectorAll<HTMLElement>(".tah-tab-group.hover"),
  )) {
    const button = directChild(group, ".tah-group-button");
    const container = directChild(group, ".tah-subgroups-container");
    const flyout = container ? directChild(container, ".tah-subgroups") : null;
    if (!button || !container || !flyout) continue;

    flyout.style.removeProperty("--d6e2-tah-flyout-max-height");
    const buttonRect = button.getBoundingClientRect();
    const flyoutHeight = Math.max(
      flyout.scrollHeight,
      flyout.getBoundingClientRect().height,
    );
    const placement = placeFlyout(
      { height: buttonRect.height, y: buttonRect.y },
      flyoutHeight,
      viewportHeight,
    );
    container.classList.toggle("expand-up", placement.direction === "up");
    container.classList.toggle("expand-down", placement.direction === "down");
    flyout.style.setProperty(
      "--d6e2-tah-flyout-max-height",
      `${String(placement.maxHeight)}px`,
    );
  }
}

function clearAnchor(element: HTMLElement): void {
  resetStickyPlacement();
  element.classList.remove("d6e2-tah-token-anchored");
  for (const property of ["bottom", "inset", "left", "right", "top"]) {
    element.style.removeProperty(property);
  }
  for (const flyout of Array.from(
    element.querySelectorAll<HTMLElement>(".tah-subgroups"),
  )) {
    flyout.style.removeProperty("--d6e2-tah-flyout-max-height");
  }
}

function refreshAnchor(): void {
  const element = document.querySelector<HTMLElement>("#token-action-hud-app");
  if (!element) {
    resetStickyPlacement();
    return;
  }
  if (!tokenAnchorEnabled()) {
    clearAnchor(element);
    return;
  }
  const tokens = canvasTokenRectangles();
  if (!tokens) {
    clearAnchor(element);
    return;
  }
  const rect = element.getBoundingClientRect();
  const viewport = usableViewport();
  const previousPlacement = rememberedTokenAnchorPlacement(
    lastAnchorMemory,
    tokens.tokenId,
    viewport,
  );
  const selection = selectTokenAnchorPosition(
    tokens.anchor,
    { height: rect.height, width: rect.width },
    viewport,
    tokens.blockers,
    previousPlacement,
  );
  if (!selection) {
    clearAnchor(element);
    return;
  }
  lastAnchorMemory = Object.freeze({
    ...selection,
    tokenId: tokens.tokenId,
    viewport: Object.freeze({ ...viewport }),
  });
  element.classList.add("d6e2-tah-token-anchored");
  element.style.inset = "auto";
  element.style.left = `${selection.position.left}px`;
  element.style.top = `${selection.position.top}px`;
  refreshFlyouts(element, viewport.height);
}

function refreshFlyoutsOnly(): void {
  const element = document.querySelector<HTMLElement>("#token-action-hud-app");
  if (!element || !tokenAnchorEnabled()) return;
  refreshFlyouts(element, usableViewport().height);
}

const refreshAfterLayout = createFrameCoalescer(
  (callback) => window.requestAnimationFrame(callback),
  refreshAnchor,
);
const refreshFlyoutsAfterPointer = createFrameCoalescer(
  (callback) => window.requestAnimationFrame(callback),
  refreshFlyoutsOnly,
);
const stabilizeAfterControl = createBoundedFrameRetry(
  (callback) => window.requestAnimationFrame(callback),
  () => {
    const element = document.querySelector<HTMLElement>(
      "#token-action-hud-app",
    );
    if (!element) return false;
    const rectangle = element.getBoundingClientRect();
    if (rectangle.width <= 0 || rectangle.height <= 0) return false;
    refreshAfterLayout();
    return true;
  },
  60,
);

let installed = false;

export function installTokenAnchor(): void {
  if (installed) return;
  installed = true;
  for (const hook of [
    "canvasPan",
    "d6e2RefreshTokenActionHudAnchor",
    "renderTokenActionHud",
    "updateToken",
  ]) {
    Hooks.on(hook, refreshAfterLayout);
  }
  Hooks.on("controlToken", stabilizeAfterControl);
  window.addEventListener("resize", refreshAfterLayout);
  document.addEventListener("pointerover", refreshFlyoutsAfterPointer, true);
  document.addEventListener("pointerup", refreshFlyoutsAfterPointer, true);
  refreshAfterLayout();
}
