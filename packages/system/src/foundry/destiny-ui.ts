import { requireDestinyValue } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import {
  destinyConfiguration,
  destinyEnabled,
  destinyPrimaryGM,
  destinyPublicState,
  subscribeDestiny,
} from "./destiny-service";
import {
  destinyLabels,
  destinySummary,
  destinyText,
  destinyWorkspace,
} from "./destiny-workspace";

const POSITION = "destinyDockPositionV1";
const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);
interface Point {
  x: number;
  y: number;
}
export function boundDestinyDock(
  point: Point,
  width: number,
  height: number,
  viewport: { width: number; height: number },
  obstacles: readonly {
    left: number;
    top: number;
    right: number;
    bottom: number;
  }[],
): Point {
  const clamp = (p: Point) => ({
    x: Math.max(8, Math.min(p.x, viewport.width - width - 8)),
    y: Math.max(8, Math.min(p.y, viewport.height - height - 8)),
  });
  let result = clamp(point);
  for (let n = 0; n < 8; n++) {
    const collision = obstacles.find(
      (r) =>
        result.x < r.right + 8 &&
        result.x + width > r.left - 8 &&
        result.y < r.bottom + 8 &&
        result.y + height > r.top - 8,
    );
    if (!collision) break;
    const candidates = [
      { x: result.x, y: collision.top - height - 8 },
      { x: collision.left - width - 8, y: result.y },
      { x: collision.right + 8, y: result.y },
      { x: result.x, y: collision.bottom + 8 },
    ].map(clamp);
    const clear = candidates.filter(
      (p) =>
        !obstacles.some(
          (r) =>
            p.x < r.right + 8 &&
            p.x + width > r.left - 8 &&
            p.y < r.bottom + 8 &&
            p.y + height > r.top - 8,
        ),
    );
    result = requireDestinyValue(
      (clear.length ? clear : candidates).sort(
        (a, b) =>
          Math.hypot(a.x - point.x, a.y - point.y) -
          Math.hypot(b.x - point.x, b.y - point.y),
      )[0],
    );
  }
  return result;
}
export class DestinyDock extends Base {
  static override DEFAULT_OPTIONS = {
    id: "d6-destiny-dock",
    classes: ["d6e2", "d6-destiny-dock"],
    window: { frame: false, resizable: false },
    position: { width: "auto", height: "auto" },
  };
  static override PARTS = {
    content: { template: `systems/${SYSTEM_ID}/templates/destiny/dock.hbs` },
  };
  #point: Point | undefined;
  #original: Point | undefined;
  #preferred: Point | undefined;
  #positionLoaded = false;
  #layoutFrame: number | undefined;
  #layoutObserver: ResizeObserver | undefined;
  #moving = false;
  #lastSpend: string | undefined;
  #initialized = false;
  #flipping = "";
  #focusAction = "";
  #focusCoin = "";
  #suppressClick = false;
  #animationConsumed = false;
  #stopDrag: (() => void) | undefined;
  #timer: ReturnType<typeof setTimeout> | undefined;
  changed(): void {
    this.#captureFocus();
    const last = destinyPublicState().lastSpend;
    if (this.#initialized && last && last.id !== this.#lastSpend) {
      this.#flipping = last.coinId;
      this.#animationConsumed = false;
      if (this.#timer) clearTimeout(this.#timer);
      this.#timer = setTimeout(() => {
        this.#flipping = "";
        this.render();
      }, 280);
    }
    this.#lastSpend = last?.id;
    this.#initialized = true;
    this.render(true);
  }
  override _prepareContext(): Promise<Record<string, unknown>> {
    this.#captureFocus();
    const state = destinyPublicState();
    const active = state.status === "active";
    const side = game.user?.isGM ? "dark" : "light";
    const coins = state.coins.length
      ? state.coins
      : Array.from({ length: destinyConfiguration().size }, (_, i) => ({
          id: `coin-${i + 1}`,
          face: "dark" as const,
          reservationId: undefined,
        }));
    const animate = this.#animationConsumed ? "" : this.#flipping;
    this.#animationConsumed = true;
    return Promise.resolve({
      labels: destinyLabels(),
      revision: state.revision,
      summary: destinySummary(),
      announcement: this.#flipping ? destinyText("SpendConfirmed") : "",
      needsSession: !active,
      canManage: game.user?.isGM === true,
      busy: false,
      error: !destinyPrimaryGM() ? destinyText("Error.GMUnavailable") : "",
      placementHelp: this.#moving ? destinyText("MoveHelp") : "",
      lightImage: `systems/${SYSTEM_ID}/assets/ui/destiny-light.svg`,
      darkImage: `systems/${SYSTEM_ID}/assets/ui/destiny-dark.svg`,
      coins: coins.map((c) => ({
        id: c.id,
        side: active ? c.face : "unassigned",
        label: `${destinyText(active ? c.face : "awaitingSession")}${c.reservationId ? ` · ${destinyText("Reserved")}` : ""}`,
        reserved: Boolean(c.reservationId),
        selected: false,
        canUse:
          active &&
          c.face === side &&
          !c.reservationId &&
          Boolean(destinyPrimaryGM()),
        flipping: animate === c.id,
      })),
    });
  }
  #captureFocus(): void {
    const active = document.activeElement;
    this.#focusAction = "";
    this.#focusCoin = "";
    if (
      active instanceof HTMLElement &&
      this.rendered &&
      this.element.contains(active)
    ) {
      this.#focusAction = active.dataset.action ?? "";
      this.#focusCoin = active.dataset.coinId ?? "";
    }
  }
  #place(): void {
    if (this.rendered) this.setPosition({});
  }
  override _prePosition(position: Record<string, unknown>): void {
    super._prePosition(position);
    if (!this.element.isConnected) return;
    const rect = this.element.getBoundingClientRect();
    const hotbarElement = document.querySelector("#hotbar");
    const hotbar = hotbarElement?.getClientRects().length
      ? hotbarElement.getBoundingClientRect()
      : undefined;
    if (!this.#positionLoaded) {
      const saved = game.settings.get(SYSTEM_ID, POSITION) as
        { version?: number; x?: number; y?: number } | undefined;
      if (
        saved?.version === 1 &&
        Number.isFinite(saved.x) &&
        Number.isFinite(saved.y)
      )
        this.#preferred = {
          x: requireDestinyValue(saved.x),
          y: requireDestinyValue(saved.y),
        };
      this.#positionLoaded = true;
    }
    // Keep the automatic position relative to the current hotbar layout until
    // the user explicitly chooses a position. Do not freeze an early ready rect.
    const initial = this.#preferred ?? {
      x: hotbar?.left ?? Math.max(8, (innerWidth - rect.width) / 2),
      y: hotbar
        ? hotbar.top - rect.height - 12
        : innerHeight - rect.height - 90,
    };
    const obstacles = Array.from(
      document.querySelectorAll<HTMLElement>(
        "#hotbar,#sidebar,#players,#navigation,#d6e2-token-action-hud,#token-action-hud,.tah-actions",
      ),
    )
      .filter((e) => e !== this.element && e.getClientRects().length > 0)
      .map((e) => e.getBoundingClientRect());
    this.#point = boundDestinyDock(
      initial,
      rect.width,
      rect.height,
      { width: innerWidth, height: innerHeight },
      obstacles,
    );
    Object.assign(position, { left: this.#point.x, top: this.#point.y });
  }
  #afterLayout(): void {
    if (this.#layoutFrame !== undefined)
      cancelAnimationFrame(this.#layoutFrame);
    this.#layoutFrame = requestAnimationFrame(() => {
      this.#layoutFrame = undefined;
      this.#place();
    });
  }
  override async _onRender(
    context: Record<string, unknown>,
    options: { readonly parts: readonly string[] },
  ): Promise<void> {
    await super._onRender(context, options);
    this.#afterLayout();
    this.#layoutObserver?.disconnect();
    if (typeof ResizeObserver !== "undefined") {
      this.#layoutObserver = new ResizeObserver(() => this.#afterLayout());
      for (const element of Array.from(
        document.querySelectorAll("#hotbar,#sidebar,#players,#navigation"),
      ))
        this.#layoutObserver.observe(element);
    }
    this.element.removeEventListener("click", this.#click);
    this.element.addEventListener("click", this.#click);
    this.element.removeEventListener("keydown", this.#key);
    this.element.addEventListener("keydown", this.#key);
    this.element.removeEventListener("pointerdown", this.#pointer);
    this.element.addEventListener("pointerdown", this.#pointer);
    const active = document.activeElement;
    if (!active || active === document.body || this.element.contains(active))
      Array.from(
        this.element.querySelectorAll<HTMLElement>("button[data-action]"),
      )
        .find(
          (e) =>
            e.dataset.action === this.#focusAction &&
            (e.dataset.coinId ?? "") === this.#focusCoin,
        )
        ?.focus();
  }
  #click = (event: Event) => {
    const control = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-action]",
    );
    if (!control) return;
    if (this.#suppressClick) {
      this.#suppressClick = false;
      return;
    }
    this.#captureFocus();
    const action = control.dataset.action;
    if (action === "moveDestiny") {
      this.#moving = !this.#moving;
      if (this.#moving)
        this.#original = this.#preferred ? { ...this.#preferred } : undefined;
      else void this.#save();
      this.render();
    } else
      void destinyWorkspace.open(
        action === "manageDestiny" ? "session" : "use",
        control.dataset.coinId ?? "",
      );
  };
  #key = (event: KeyboardEvent) => {
    if (!this.#moving || !this.#point) return;
    const step = event.shiftKey ? 20 : 4;
    const shifts: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const shift = shifts[event.key];
    if (shift) {
      event.preventDefault();
      this.#preferred = {
        x: this.#point.x + shift.x,
        y: this.#point.y + shift.y,
      };
      this.#place();
    } else if (event.key === "Enter") {
      event.preventDefault();
      this.#moving = false;
      void this.#save();
      this.render();
    } else if (event.key === "Escape") {
      event.preventDefault();
      this.#preferred = this.#original;
      this.#moving = false;
      this.render();
    }
  };
  #pointer = (event: PointerEvent) => {
    if (
      !(event.target as HTMLElement).closest('[data-action="moveDestiny"]') ||
      event.button !== 0 ||
      !this.#point
    )
      return;
    const origin = { ...this.#point };
    const preferred = this.#preferred;
    const start = { x: event.clientX, y: event.clientY };
    let moved = false;
    const move = (e: PointerEvent) => {
      moved = true;
      this.#preferred = {
        x: origin.x + e.clientX - start.x,
        y: origin.y + e.clientY - start.y,
      };
      this.#place();
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      this.#stopDrag = undefined;
    };
    const up = () => {
      stop();
      if (moved) {
        this.#suppressClick = true;
        setTimeout(() => {
          this.#suppressClick = false;
        }, 0);
        this.#moving = false;
        void this.#save();
      }
    };
    const cancel = () => {
      stop();
      this.#preferred = preferred;
      this.#place();
    };
    this.#stopDrag?.();
    this.#stopDrag = stop;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", cancel, { once: true });
  };
  override async close(): Promise<void> {
    this.#stopDrag?.();
    this.#layoutObserver?.disconnect();
    if (this.#layoutFrame !== undefined)
      cancelAnimationFrame(this.#layoutFrame);
    if (this.#timer) clearTimeout(this.#timer);
    await super.close();
  }
  async #save(): Promise<void> {
    if (this.#point)
      await game.settings.set(SYSTEM_ID, POSITION, {
        version: 1,
        ...this.#point,
      });
  }
  resize = () => this.#place();
}
let dock: DestinyDock | undefined;
export function registerDestinyUI(): void {
  game.settings.register(SYSTEM_ID, POSITION, {
    name: "Destiny strip position",
    hint: "Position on this client",
    scope: "client",
    config: false,
    type: Object,
    default: { version: 1 },
  });
  let browserReady = false;
  const refresh = () => {
    if (!browserReady) return;
    if (!destinyEnabled()) {
      void dock?.close();
      void destinyWorkspace.close();
      return;
    }
    dock ??= new DestinyDock();
    dock.changed();
    destinyWorkspace.refresh();
  };
  subscribeDestiny(refresh);
  Hooks.once("ready", () => {
    // Register viewport listeners only for an actual ready browser client.
    // Server/loader initialization still registers the setting and hooks.
    if (typeof window === "undefined" || typeof document === "undefined")
      return;
    browserReady = true;
    window.addEventListener("resize", () => dock?.resize());
    refresh();
  });
  Hooks.on("updateSetting", refresh);
  Hooks.on("canvasReady", refresh);
}
