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

export interface FlyoutPlacement {
  readonly direction: "down" | "up";
  readonly maxHeight: number;
}

const GAP = 12;
const VIEWPORT_MARGIN = 8;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function positionBesideToken(
  token: Rectangle,
  hud: Pick<Rectangle, "height" | "width">,
  viewport: Pick<Rectangle, "height" | "width">,
): HudAnchorPosition {
  const right = token.x + token.width + GAP;
  const left = token.x - hud.width - GAP;
  const preferredLeft =
    right + hud.width <= viewport.width - VIEWPORT_MARGIN ? right : left;
  return Object.freeze({
    left: Math.round(
      clamp(
        preferredLeft,
        VIEWPORT_MARGIN,
        viewport.width - hud.width - VIEWPORT_MARGIN,
      ),
    ),
    top: Math.round(
      clamp(
        token.y + token.height / 2 - hud.height / 2,
        VIEWPORT_MARGIN,
        viewport.height - hud.height - VIEWPORT_MARGIN,
      ),
    ),
  });
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
  getBounds?(): Rectangle;
}

interface RuntimeCanvas {
  readonly app?: {
    readonly renderer?: {
      readonly screen?: { readonly height: number; readonly width: number };
    };
    readonly view?: HTMLElement;
  };
  readonly tokens?: { readonly controlled?: readonly RuntimeToken[] };
}

function controlledTokenRectangle(): Rectangle | null {
  const runtimeCanvas = (globalThis as { readonly canvas?: RuntimeCanvas })
    .canvas;
  const token = runtimeCanvas?.tokens?.controlled?.[0];
  const bounds = token?.getBounds?.();
  const view = runtimeCanvas?.app?.view;
  const screen = runtimeCanvas?.app?.renderer?.screen;
  if (!bounds || !view || !screen || screen.width <= 0 || screen.height <= 0) {
    return null;
  }
  const canvasRect = view.getBoundingClientRect();
  const scaleX = canvasRect.width / screen.width;
  const scaleY = canvasRect.height / screen.height;
  return {
    height: bounds.height * scaleY,
    width: bounds.width * scaleX,
    x: canvasRect.left + bounds.x * scaleX,
    y: canvasRect.top + bounds.y * scaleY,
  };
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
  if (!element) return;
  if (!tokenAnchorEnabled()) {
    clearAnchor(element);
    return;
  }
  const token = controlledTokenRectangle();
  if (!token) {
    clearAnchor(element);
    return;
  }
  const rect = element.getBoundingClientRect();
  const viewport = usableViewport();
  const position = positionBesideToken(
    token,
    { height: rect.height, width: rect.width },
    viewport,
  );
  element.classList.add("d6e2-tah-token-anchored");
  element.style.inset = "auto";
  element.style.left = `${position.left}px`;
  element.style.top = `${position.top}px`;
  refreshFlyouts(element, viewport.height);
}

function refreshAfterLayout(): void {
  window.requestAnimationFrame(refreshAnchor);
}

let installed = false;

export function installTokenAnchor(): void {
  if (installed) return;
  installed = true;
  for (const hook of [
    "canvasPan",
    "controlToken",
    "d6e2RefreshTokenActionHudAnchor",
    "renderTokenActionHud",
    "updateToken",
  ]) {
    Hooks.on(hook, refreshAfterLayout);
  }
  window.addEventListener("resize", refreshAfterLayout);
  document.addEventListener("pointerover", refreshAfterLayout, true);
  document.addEventListener("pointerup", refreshAfterLayout, true);
  refreshAfterLayout();
}
