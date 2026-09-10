import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { parseHTML } from "linkedom";
import { compareAttributeInitiative } from "@d6-system-2e/core";
import strings from "../../../../lang/en.json";
const state = vi.hoisted(() => ({
  strategy: "open-d6.initiative.perception-base",
  primary: "perception",
  secondary: "agility",
  active: ["perception", "agility"],
}));
vi.mock("../settings/initiative", () => ({
  currentInitiativeRuntimeStrategy: () => ({
    id: state.strategy,
    ordering: "rolled-descending",
    family: "perception",
  }),
}));
vi.mock("../settings/rules-profile-library", () => ({
  currentConfiguredRulesProfile: () => ({
    initiativeBaseTies: { version: 1, secondaryAttributeId: state.secondary },
  }),
}));
vi.mock("../settings/attributes", () => ({
  currentAttributeRole: () => state.primary,
  currentActiveAttributeDefinitions: () =>
    state.active.map((id) => ({
      id,
      label: id === "agility" ? "Dexterity" : id,
    })),
}));
import {
  initiativeAttributeBindingsForActor,
  initiativeFormulaForActor,
  registerD6CombatDocuments,
} from "./combat-documents";
import {
  bindInitiativeTooltips,
  initiativePresentation,
  presentNativeInitiative,
} from "./initiative-presentation";
const actor = (primary = 10, secondary = 14, isOwner = true) => ({
  isOwner,
  system: {
    attributes: {
      [state.primary]: { score: primary },
      [state.secondary]: { score: secondary },
      reflexes: { score: 90 },
    },
  },
});
const localize = (k: string) => (strings as Record<string, string>)[k] ?? k;
beforeEach(() => {
  state.strategy = "open-d6.initiative.perception-base";
  state.primary = "perception";
  state.secondary = "agility";
  state.active = ["perception", "agility"];
  vi.stubGlobal("game", {
    user: { isGM: false },
    i18n: {
      localize,
      format: (k: string, d: Record<string, unknown>) =>
        localize(k).replace(/\{(\w+)\}/gu, (_, key: string) => String(d[key])),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());
describe("profile-owned whole-total initiative", () => {
  it("rolls actual base Perception including pips, without the legacy sum", () => {
    expect(initiativeFormulaForActor(actor(11, 14))).toBe(
      "2d6[Base]+1dw[Wild]+2",
    );
    expect(initiativeAttributeBindingsForActor(actor()).secondary).toBe(14);
    expect(initiativeAttributeBindingsForActor(actor()).secondaryLabel).toBe(
      "Dexterity",
    );
    state.strategy = "open-d6.initiative.perception";
    expect(initiativeFormulaForActor(actor(11, 14))).toBe(
      "2d6[Base]+1dw[Wild]+2+0.25",
    );
  });
  it("uses Fantasy's active Acumen role and never dormant Perception", () => {
    state.primary = "acumen";
    state.active = ["acumen", "agility"];
    expect(initiativeFormulaForActor(actor(10, 9))).toBe(
      "2d6[Base]+1dw[Wild]+1",
    );
    expect(initiativeAttributeBindingsForActor(actor()).primaryId).toBe(
      "acumen",
    );
  });
  it("requires explicit active secondary, preserving active zero rather than aliasing", () => {
    expect(initiativeAttributeBindingsForActor(actor(10, 0)).secondary).toBe(0);
    state.secondary = "dexterity";
    expect(
      initiativeAttributeBindingsForActor(actor()).secondary,
    ).toBeUndefined();
    expect(() => initiativeFormulaForActor(actor())).toThrow(
      "MissingBaseAttributes",
    );
  });
  it("compares full primary and secondary pips lexicographically with stable incomplete subgroups", () => {
    const rows = [
      { id: "b", total: 9, primary: 10, secondary: 4 },
      { id: "missing", total: 9, primary: 10 },
      { id: "a", total: 9, primary: 10, secondary: 11 },
      { id: "primary", total: 9, primary: 11, secondary: 0 },
      { id: "total", total: 10, primary: 0, secondary: 0 },
      { id: "unrolled", total: null },
    ];
    const compare = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
      compareAttributeInitiative(a, b, rows) ||
      rows.indexOf(a) - rows.indexOf(b);
    expect([...rows].sort(compare).map((r) => r.id)).toEqual([
      "total",
      "primary",
      "b",
      "missing",
      "a",
      "unrolled",
    ]);
    for (const a of rows)
      for (const b of rows)
        for (const c of rows)
          if (compare(a, b) <= 0 && compare(b, c) <= 0)
            expect(compare(a, c)).toBeLessThanOrEqual(0);
    expect(
      compareAttributeInitiative(
        { total: 9, primary: 10, secondary: 11 },
        { total: 9, primary: 10, secondary: 10 },
      ),
    ).toBe(-1);
  });
  it("adapts native sorting without changing stored numbers and leaves legacy ordering native", () => {
    const rows = [
      { id: "a", initiative: 9, actor: actor(10, 10) },
      { id: "b", initiative: 9, actor: actor(11, 0) },
    ];
    class Combat {
      combatants = { contents: rows };
      _sortCombatants() {
        return 123;
      }
    }
    class Combatant {
      _getInitiativeFormula() {
        return "0";
      }
    }
    const config = {
      Combat: { documentClass: Combat },
      Combatant: { documentClass: Combatant },
    };
    vi.stubGlobal("Combat", Combat);
    vi.stubGlobal("Combatant", Combatant);
    vi.stubGlobal("CONFIG", config);
    registerD6CombatDocuments();
    const combat = new config.Combat.documentClass();
    const compare = combat._sortCombatants.bind(combat) as (
      a: (typeof rows)[number],
      b: (typeof rows)[number],
    ) => number;
    expect(compare(required(rows[0]), required(rows[1]))).toBeGreaterThan(0);
    expect(rows.map((r) => r.initiative)).toEqual([9, 9]);
    state.strategy = "open-d6.initiative.perception";
    expect(compare(required(rows[0]), required(rows[1]))).toBe(123);
  });
});
describe("authorized initiative explanations", () => {
  it("exposes current base scores only to owner or GM and preserves zero/unrolled/redacted values", () => {
    expect(
      initiativePresentation(9, { id: "a", actor: actor() }),
    ).toMatchObject({ initiativeDisplay: "9" });
    expect(
      initiativePresentation(9, { id: "a", actor: actor() })
        .initiativeExplanation,
    ).toContain("3D+1");
    const hidden = actor(10, 14, false);
    Object.defineProperty(hidden, "system", {
      get: () => {
        throw new Error("Do not read nonowner base scores");
      },
    });
    expect(
      initiativePresentation(9, { id: "a", actor: hidden })
        .initiativeExplanation,
    ).not.toContain("3D+1");
    expect(initiativePresentation(0).initiativeDisplay).toBe("0");
    expect(initiativePresentation(null).initiativeDisplay).toBe("—");
    expect(initiativePresentation(undefined).initiativeDisplay).toBeUndefined();
    expect(initiativePresentation(9.19).initiativeDisplay).toBe("9.19");
    vi.stubGlobal("game", {
      user: { isGM: true },
      i18n: {
        localize,
        format: (k: string, d: Record<string, unknown>) =>
          localize(k).replace(/\{(\w+)\}/gu, (_, key: string) =>
            String(d[key]),
          ),
      },
    });
    expect(
      initiativePresentation(9, { id: "a", actor: actor(10, 14, false) })
        .initiativeExplanation,
    ).toContain("4D+2");
  });
  it("formats native rolled spans accessibly without replacing roll/edit controls or revealing hidden totals", () => {
    const { document } = parseHTML(
      '<main><li class="combatant" data-combatant-id="a"><div class="token-initiative"><span>9.00</span><button data-action="edit">Edit</button></div></li><li class="combatant" data-combatant-id="b"><div class="token-initiative"><button data-action="roll">Roll</button></div></li></main>',
    );
    const root = document.querySelector("main") as unknown as HTMLElement;
    const button = root.querySelector("button");
    presentNativeInitiative(root, [
      { id: "a", initiative: 9, actor: actor() },
      { id: "b", initiative: 12, actor: actor() },
    ]);
    expect(root.querySelector("span")?.textContent).toBe("9");
    expect(root.querySelector("span")?.getAttribute("tabindex")).toBe("0");
    expect(root.querySelector("span")?.getAttribute("aria-label")).toContain(
      "Highest roll first",
    );
    expect(root.querySelector("button")).toBe(button);
    expect(root.querySelector('[data-combatant-id="b"]')?.textContent).toBe(
      "Roll",
    );
  });
});

it("opens literal help visibly on keyboard focus, dismisses on blur/Escape and restores the grid description", () => {
  const { document, Event } = parseHTML(
    '<main><span class="d6e2-round-grid-initiative" tabindex="0" data-tooltip="Literal &lt;b&gt;Attribute&lt;/b&gt;" aria-describedby="grid-help">9</span><span id="grid-help">Explanation</span></main>',
  );
  const root = document.querySelector("main") as unknown as HTMLElement;
  const target = required(
    root.querySelector<HTMLElement>(".d6e2-round-grid-initiative"),
  );
  const manager = {
    element: null as HTMLElement | null,
    activate: vi.fn((element: HTMLElement, options: { text: string }) => {
      expect(options.text).toBe("Literal <b>Attribute</b>");
      manager.element = element;
      element.setAttribute("aria-describedby", "tooltip");
    }),
    deactivate: vi.fn(() => {
      manager.element = null;
      target.removeAttribute("aria-describedby");
    }),
  };
  vi.stubGlobal("game", { ...game, tooltip: manager });
  bindInitiativeTooltips(root);
  bindInitiativeTooltips(root);
  target.dispatchEvent(new Event("focus"));
  expect(manager.activate).toHaveBeenCalledExactlyOnceWith(target, {
    text: "Literal <b>Attribute</b>",
  });
  target.dispatchEvent(new Event("blur"));
  expect(manager.deactivate).toHaveBeenCalledTimes(1);
  expect(target.getAttribute("aria-describedby")).toBe("grid-help");
  target.dispatchEvent(new Event("focus"));
  const escape = new Event("keydown");
  Object.defineProperty(escape, "key", { value: "Escape" });
  target.dispatchEvent(escape);
  expect(manager.deactivate).toHaveBeenCalledTimes(2);
});

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined)
    throw new Error("Missing test fixture");
  return value;
}

it.each([
  { gm: true, owner: false, readonly: false },
  { gm: false, owner: true, readonly: true },
  { gm: false, owner: false, readonly: true },
])(
  "adds input focus help without changing native editing or privacy: %j",
  ({ gm, owner, readonly }) => {
    const { document, Event } = parseHTML(
      `<main><li class="combatant" data-combatant-id="rolled"><div class="token-initiative"><input type="text" class="initiative-input" inputmode="numeric" pattern="^[+=\\-]?\\d*" value="14" aria-label="Initiative" ${readonly ? "readonly" : ""}></div></li><li class="combatant" data-combatant-id="unrolled"><div class="token-initiative"><button data-action="rollInitiative">Roll</button></div></li></main>`,
    );
    const root = document.querySelector("main") as unknown as HTMLElement;
    const input = required(root.querySelector<HTMLInputElement>("input"));
    const button = root.querySelector("button");
    const original = {
      value: input.value,
      type: input.type,
      readOnly: input.readOnly,
      readonly: input.hasAttribute("readonly"),
      pattern: input.getAttribute("pattern"),
      inputmode: input.getAttribute("inputmode"),
      tabindex: input.getAttribute("tabindex"),
    };
    const change = vi.fn();
    input.addEventListener("change", change);
    const manager = {
      element: null as HTMLElement | null,
      activate: vi.fn((element: HTMLElement) => {
        manager.element = element;
      }),
      deactivate: vi.fn(() => {
        manager.element = null;
      }),
    };
    vi.stubGlobal("game", { ...game, user: { isGM: gm }, tooltip: manager });
    presentNativeInitiative(root, [
      { id: "rolled", initiative: 14, actor: actor(10, 14, owner) },
      { id: "unrolled", initiative: null, actor: actor() },
    ]);
    expect(root.querySelector("input")).toBe(input);
    expect({
      value: input.value,
      type: input.type,
      readOnly: input.readOnly,
      readonly: input.hasAttribute("readonly"),
      pattern: input.getAttribute("pattern"),
      inputmode: input.getAttribute("inputmode"),
      tabindex: input.getAttribute("tabindex"),
    }).toEqual(original);
    expect(input.getAttribute("aria-label")).toBe("Initiative");
    expect(input.getAttribute("aria-description")).toContain(
      "Highest roll first",
    );
    expect(input.dataset.tooltipText?.includes("3D+1")).toBe(gm || owner);
    input.dispatchEvent(new Event("focus"));
    expect(manager.activate).toHaveBeenCalledWith(input, {
      text: input.dataset.tooltipText,
    });
    input.dispatchEvent(new Event("blur"));
    expect(manager.deactivate).toHaveBeenCalledTimes(1);
    input.dispatchEvent(new Event("focus"));
    const escape = new Event("keydown", { cancelable: true });
    Object.defineProperty(escape, "key", { value: "Escape" });
    input.dispatchEvent(escape);
    expect(manager.deactivate).toHaveBeenCalledTimes(2);
    expect(escape.defaultPrevented).toBe(true);
    input.dispatchEvent(new Event("change"));
    expect(change).toHaveBeenCalledTimes(1);
    expect(root.querySelector("button")).toBe(button);
    expect(button?.hasAttribute("data-initiative-tooltip-bound")).toBe(false);
  },
);
