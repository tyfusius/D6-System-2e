import { readFileSync } from "node:fs";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import Handlebars from "handlebars";
import { parseHTML } from "linkedom";
import {
  commitFirstEditionActions,
  createCombatantRoundState,
  projectCombatRoundGrid,
  spendFirstEditionAction,
  type D6CombatantRoundStateV1,
} from "@d6-system-2e/core";
import type { D6CombatRoundGridApplication } from "./combat-round-grid";
const f = vi.hoisted(
  (): {
    spend: ReturnType<typeof vi.fn>;
    annotate: ReturnType<typeof vi.fn>;
    open: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    read: ReturnType<typeof vi.fn>;
    private: boolean;
    combat: unknown;
    projection: unknown;
  } => ({
    spend: vi.fn(),
    annotate: vi.fn(),
    open: vi.fn(),
    read: vi.fn(),
    private: false,
    refresh: vi.fn(),
    combat: undefined,
    projection: undefined,
  }),
);
vi.mock("../settings/action-economy", () => ({
  currentActionEconomyRuntimeStrategy: () => ({
    turnScheduling: "round-robin-segments",
  }),
}));
vi.mock("../settings/initiative", () => ({
  currentInitiativeRuntimeStrategy: () => ({
    id: "open-d6.initiative.perception",
  }),
}));
vi.mock("./combat-documents", () => ({
  initiativeBaseBindingsForActor: () => ({}),
}));
vi.mock("./combat-service", () => ({
  spendFirstEditionCombatantAction: f.spend,
  readCombatantRound: f.read,
  annotateCombatantNextAction: f.annotate,
}));
vi.mock("./combat-round-private", () => ({
  activeGridCombat: () => f.combat,
  combatHasPrivateQueues: () => f.private,
  onCombatGridChange: () => () => undefined,
  refreshCombatGridProjection: f.refresh,
}));
vi.mock("./combat-round-grid-service", () => ({
  projectCurrentCombatGrid: () => f.projection,
  registerCombatRoundGridService: () => undefined,
}));
let state: D6CombatantRoundStateV1;
let C: typeof D6CombatRoundGridApplication;
let doc: Document;
let reveal: ReturnType<typeof vi.fn>;
const template = readFileSync(
  process.env.D6_ROUND_GRID_TEMPLATE ??
    new URL("../../../../templates/combat/round-grid.hbs", import.meta.url),
  "utf8",
);
function project() {
  f.projection = projectCombatRoundGrid(
    [
      {
        id: "own",
        label: "Own character",
        initiative: 13,
        visible: true,
        canRead: true,
        canManage: true,
        defeated: false,
        state,
      },
      {
        id: "SECRET_ACTOR",
        label: "SECRET_ACTOR",
        initiative: 12,
        visible: false,
        canRead: false,
        canManage: false,
        defeated: false,
        state,
      },
    ],
    1,
    true,
  );
}
beforeEach(async () => {
  vi.resetModules();
  f.private = false;
  f.spend.mockReset();
  f.read.mockReturnValue({ revision: 1 });
  f.annotate.mockReset();
  f.open.mockReset();
  f.refresh.mockReset();
  reveal = vi.fn();
  const { document, window } = parseHTML("<html><body></body></html>");
  doc = document;
  vi.stubGlobal("document", doc);
  vi.stubGlobal("HTMLElement", window.HTMLElement);
  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: reveal,
  });
  Object.defineProperty(window.HTMLElement.prototype, "focus", {
    configurable: true,
    value(this: HTMLElement) {
      Object.defineProperty(doc, "activeElement", {
        configurable: true,
        value: this,
      });
    },
  });
  const h = Handlebars.create();
  // Foundry 14.367 registers this helper; exclude Handlebars' options argument.
  h.registerHelper("or", (...values: unknown[]) =>
    values.slice(0, -1).some(Boolean),
  );
  h.registerHelper(
    "localize",
    (key: string, options: { hash: Record<string, unknown> }) =>
      key + JSON.stringify(options.hash),
  );
  const render = h.compile(template);
  class Base {
    element: HTMLElement | undefined;
    rendered = false;
    _onRender(): Promise<void> {
      return Promise.resolve();
    }
    _prepareContext(): Promise<Record<string, unknown>> {
      return Promise.resolve({});
    }
    async render() {
      const context = await this._prepareContext();
      this.element ??= doc.createElement("section");
      this.element.innerHTML = render(context);
      this.rendered = true;
      await this._onRender();
      return this;
    }
  }
  vi.stubGlobal("foundry", {
    applications: {
      api: {
        ApplicationV2: Base,
        HandlebarsApplicationMixin: (b: unknown) => b,
      },
    },
  });
  vi.stubGlobal("game", {
    user: { id: "gm", isGM: true },
    i18n: {
      localize: (k: string) => k,
      format: (k: string, d: Record<string, unknown>) => k + JSON.stringify(d),
    },
  });
  state = commitFirstEditionActions(
    createCombatantRoundState(1),
    2,
    1,
    "none",
    0,
    [
      { id: "a1", kind: "other", label: "Move and shoot" },
      { id: "a2", kind: "other", label: "Reload" },
    ],
  );
  f.combat = {
    id: "combat",
    name: "Encounter",
    round: 1,
    combatants: {
      contents: [
        {
          id: "own",
          actor: {
            id: "actor",
            isOwner: true,
            sheet: {
              render: () => Promise.resolve(),
              openFirstEditionActionDeclaration: f.open,
            },
          },
        },
      ],
    },
  };
  project();
  f.spend.mockImplementation(() => {
    state = spendFirstEditionAction(state);
    project();
    return Promise.resolve({ changed: true, state });
  });
  C = (await import("./combat-round-grid")).D6CombatRoundGridApplication;
});
afterEach(() => vi.unstubAllGlobals());
describe("round grid production template and ApplicationV2 actions", () => {
  it("prepares the first render before Foundry creates an element, then reveals the active cell", async () => {
    const app = new C();
    expect(app.element).toBeUndefined();
    Object.defineProperty(doc, "activeElement", {
      configurable: true,
      value: doc.createElement("button"),
    });
    await expect(app._prepareContext()).resolves.toMatchObject({
      available: true,
    });
    await app.render();
    expect(app.element.querySelector(".d6e2-round-grid-scroll")).not.toBeNull();
    expect(reveal).toHaveBeenCalled();
  });

  it("renders semantic headers and a single grouped cell, then invokes only the existing next action", async () => {
    const app = new C();
    await app.render();
    expect(app.element.innerHTML).not.toContain("SECRET_ACTOR");
    expect(app.element.querySelectorAll('th[scope="col"]')).toHaveLength(3);
    expect(app.element.querySelectorAll('th[scope="row"]')).toHaveLength(1);
    expect(app.element.textContent).toContain("Move and shoot");
    const button = app.element.querySelector<HTMLButtonElement>(
      '[data-action="completeNext"]',
    );
    if (!button) throw new Error("Missing action button");
    await C.DEFAULT_OPTIONS.actions.completeNext.call(
      app,
      new Event("click"),
      button,
    );
    expect(f.spend).toHaveBeenCalledTimes(1);
    expect(f.spend.mock.calls[0]?.[1]).toBe(1);
    expect(f.spend.mock.calls[0]?.[3]).toBe("own");
    expect(state.firstEditionCommitment?.spentActionCount).toBe(1);
    expect(
      app.element.querySelector('[data-active="true"]')?.textContent,
    ).toContain("Reload");
  });
  it("keeps focus on the scroll region across refresh after a previously focused action", async () => {
    const app = new C();
    await app.render();
    const button = app.element.querySelector<HTMLButtonElement>(
      '[data-action="completeNext"]',
    );
    button?.focus();
    await app.render();
    expect((doc.activeElement as HTMLElement).dataset.action).toBe(
      "completeNext",
    );
    const viewport = app.element.querySelector<HTMLElement>(
      ".d6e2-round-grid-scroll",
    );
    viewport?.focus();
    await app.render();
    expect(doc.activeElement).toBe(
      app.element.querySelector(".d6e2-round-grid-scroll"),
    );
    await app.render();
    expect(doc.activeElement).toBe(
      app.element.querySelector(".d6e2-round-grid-scroll"),
    );
  });
  it("does not restore stale grid focus after the user moves to another control", async () => {
    const app = new C();
    await app.render();
    app.element
      .querySelector<HTMLButtonElement>('[data-action="completeNext"]')
      ?.focus();
    await app.render();
    const outside = doc.createElement("button");
    outside.focus();
    await app.render();
    expect(doc.activeElement).toBe(outside);
  });
  it("keeps native scrolling keys on the focused region away from canvas handlers without cancelling their default", async () => {
    const app = new C();
    await app.render();
    const viewport = app.element.querySelector<HTMLElement>(
      ".d6e2-round-grid-scroll",
    );
    if (!viewport) throw new Error("Missing region");
    const globalHandler = vi.fn();
    app.element.addEventListener("keydown", globalHandler);
    const view = doc.defaultView;
    if (!view) throw new Error("Missing test window");
    const keyEvent = (key: string, extra: Record<string, unknown> = {}) => {
      const event = new view.Event("keydown", {
        bubbles: true,
        cancelable: true,
      });
      Object.assign(event, { key, ...extra });
      return event;
    };
    for (const key of [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "PageUp",
      "PageDown",
      "Home",
      "End",
      " ",
      "Tab",
    ]) {
      const event = keyEvent(key);
      viewport.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(globalHandler).not.toHaveBeenCalled();
    viewport.dispatchEvent(keyEvent("Enter"));
    viewport.dispatchEvent(keyEvent("ArrowRight", { ctrlKey: true }));
    app.element.querySelector("button")?.dispatchEvent(keyEvent("ArrowRight"));
    expect(globalHandler).toHaveBeenCalledTimes(3);
  });
  it("preserves native forward and backward Tab traversal on grid controls without intercepting activation", async () => {
    const app = new C();
    await app.render();
    const outer = doc.createElement("main");
    outer.append(app.element);
    const globalHandler = vi.fn();
    outer.addEventListener("keydown", globalHandler);
    const button = app.element.querySelector("button");
    const view = doc.defaultView;
    if (!button || !view) throw new Error("Missing fixture controls");
    for (const shiftKey of [false, true]) {
      const event = new view.Event("keydown", {
        bubbles: true,
        cancelable: true,
      });
      Object.assign(event, { key: "Tab", shiftKey });
      button.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(globalHandler).not.toHaveBeenCalled();
    for (const key of ["Enter", " ", "ArrowRight"]) {
      const event = new view.Event("keydown", {
        bubbles: true,
        cancelable: true,
      });
      Object.assign(event, { key });
      button.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(globalHandler).toHaveBeenCalledTimes(3);
  });
  it("preserves viewport on refresh and delegates declaration to the existing sheet entry", async () => {
    const app = new C();
    await app.render();
    expect(reveal).toHaveBeenCalled();
    const viewport = app.element.querySelector<HTMLElement>(
      ".d6e2-round-grid-scroll",
    );
    if (!viewport) throw new Error("Missing grid viewport");
    viewport.scrollLeft = 140;
    viewport.scrollTop = 20;
    reveal.mockClear();
    await app.render();
    expect(
      app.element.querySelector<HTMLElement>(".d6e2-round-grid-scroll")
        ?.scrollLeft,
    ).toBe(140);
    expect(reveal).not.toHaveBeenCalled();
    const button = app.element.querySelector<HTMLButtonElement>(
      '[data-action="openDeclaration"]',
    );
    if (!button) throw new Error("Missing declaration button");
    await C.DEFAULT_OPTIONS.actions.openDeclaration.call(
      app,
      new Event("click"),
      button,
    );
    expect(f.open).toHaveBeenCalledTimes(1);
  });
  it("fails visibly before opening an ambiguous actor-only declaration", async () => {
    f.read.mockReturnValue(null);
    const app = new C();
    await app.render();
    const button = app.element.querySelector<HTMLButtonElement>(
      '[data-action="openDeclaration"]',
    );
    if (!button) throw new Error("Missing declaration button");
    await C.DEFAULT_OPTIONS.actions.openDeclaration.call(
      app,
      new Event("click"),
      button,
    );
    expect(f.open).not.toHaveBeenCalled();
    expect(app.element.textContent).toContain("ambiguousActor");
  });
  it("fails visibly with no actionable stale table when private authority is unavailable", async () => {
    f.private = true;
    f.refresh.mockRejectedValue(
      new Error("D6E2.Combat.RoundGrid.authorityUnavailable"),
    );
    const app = new C();
    await app.render();
    expect(app.element.textContent).toContain("authorityUnavailable");
    expect(
      app.element.querySelector('[data-action="completeNext"]'),
    ).toBeNull();
  });
});
