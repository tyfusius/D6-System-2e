import { afterEach, describe, expect, it, vi } from "vitest";
import { parseHTML } from "linkedom";

vi.mock("./destiny-service", () => ({
  destinyConfiguration: () => ({ size: 3 }),
  destinyEnabled: () => true,
  destinyPrimaryGM: () => ({ id: "gm" }),
  destinyPublicState: () => ({ status: "active", coins: [], revision: 1 }),
  subscribeDestiny: () => undefined,
}));
vi.mock("./destiny-workspace", () => ({
  destinyLabels: () => ({}),
  destinySummary: () => "",
  destinyText: (key: string) => key,
  destinyWorkspace: {},
}));

async function fixture(saved: Record<string, unknown> = { version: 1 }) {
  vi.resetModules();
  const { window, document } = parseHTML(
    '<html><body><div id="hotbar"></div></body></html>',
  );
  let hotbarTop = 0;
  const rect = () => ({
    left: 388,
    top: hotbarTop,
    right: 812,
    bottom: hotbarTop + 128,
    width: 424,
    height: 128,
  });
  const hotbar = document.querySelector("#hotbar");
  if (!hotbar) throw new Error("Fixture hotbar missing");
  Object.assign(hotbar, {
    getBoundingClientRect: rect,
    getClientRects: () => [rect()],
  });
  let frame: FrameRequestCallback | undefined;
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", document);
  vi.stubGlobal("HTMLElement", window.HTMLElement);
  vi.stubGlobal("innerWidth", 1200);
  vi.stubGlobal("innerHeight", 1388);
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    frame = fn;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    frame = undefined;
  });
  const save = vi.fn(
    (_scope: string, _key: string, value: Record<string, unknown>) => {
      Object.assign(saved, value);
      return Promise.resolve();
    },
  );
  vi.stubGlobal("game", { settings: { get: () => saved, set: save } });
  // Model the native ordering: onRender is followed by final setPosition.
  // Direct element.style writes in onRender are overwritten by that final call.
  class NativeApplication {
    element = document.createElement("div");
    rendered = false;
    position: Record<string, unknown> = { left: 451.5, top: 631.6 };
    constructor() {
      this.element.innerHTML =
        '<button data-action="moveDestiny">Move</button>';
      document.body.append(this.element);
      Object.assign(this.element, {
        getBoundingClientRect: () => ({ width: 297, height: 54 }),
      });
    }
    _prePosition(position: Record<string, unknown>) {
      Object.assign(this.position, position);
    }
    _onRender() {
      return Promise.resolve();
    }
    setPosition(position: Record<string, unknown> = {}) {
      Object.assign(this.position, position);
      this._prePosition(this.position);
      Object.assign(this.element.style, {
        left: `${String(this.position.left)}px`,
        top: `${String(this.position.top)}px`,
      });
      return this.position;
    }
    async render() {
      await this._onRender();
      this.rendered = true;
      this.setPosition(this.position);
      return this;
    }
    close() {
      this.rendered = false;
      return Promise.resolve();
    }
  }
  vi.stubGlobal("foundry", {
    applications: {
      api: {
        ApplicationV2: NativeApplication,
        HandlebarsApplicationMixin: (base: unknown) => base,
      },
    },
  });
  const { DestinyDock } = await import("./destiny-ui");
  const dock = new DestinyDock();
  const key = (key: string) => {
    const event = new window.Event("keydown", {
      bubbles: true,
      cancelable: true,
    });
    Object.assign(event, { key, shiftKey: false });
    dock.element.dispatchEvent(event);
  };
  const move = () => dock.element.querySelector("button")?.click();
  return {
    dock,
    saved,
    save,
    key,
    move,
    hotbarAt: (top: number) => {
      hotbarTop = top;
    },
    frame: () => {
      const fn = frame;
      frame = undefined;
      fn?.(0);
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("Destiny native position lifecycle", () => {
  it("rebases automatic placement after layout and keeps native coordinates through rerenders and keyboard movement", async () => {
    const f = await fixture();
    await f.dock.render(true);
    f.hotbarAt(1244);
    f.frame();
    expect(f.dock.element.style.left).toBe("388px");
    expect(f.dock.element.style.top).toBe("1178px");
    await f.dock.render(true);
    expect(f.dock.element.style.top).toBe("1178px");
    f.move();
    await Promise.resolve();
    f.key("ArrowUp");
    f.key("Enter");
    await f.dock.render(true);
    expect(f.saved).toEqual({ version: 1, x: 388, y: 1174 });
    expect(f.dock.element.style.top).toBe("1174px");
    f.hotbarAt(1000);
    f.dock.resize();
    expect(f.dock.element.style.top).toBe("1174px");
    await f.dock.close();
  });
  it("restores a saved position, bounds resize, and cancels keyboard movement without saving", async () => {
    const f = await fixture({ version: 1, x: 700, y: 800 });
    f.hotbarAt(1244);
    await f.dock.render(true);
    expect(f.dock.element.style.left).toBe("700px");
    expect(f.dock.element.style.top).toBe("800px");
    f.move();
    await Promise.resolve();
    f.key("ArrowUp");
    f.key("Escape");
    await f.dock.render(true);
    expect(f.dock.element.style.top).toBe("800px");
    expect(f.save).not.toHaveBeenCalled();
    vi.stubGlobal("innerWidth", 600);
    f.dock.resize();
    expect(f.dock.element.style.left).toBe("295px");
    expect(f.saved).toEqual({ version: 1, x: 700, y: 800 });
    await f.dock.close();
  });
});
