import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { parseHTML } from "linkedom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { actionEconomyRollPlan, evaluateOpposedRoll } from "@d6-system-2e/core";
import {
  assertRollDialogSubmission,
  bindRollDialogControls,
  effectiveRollDialogMode,
  manualOppositionAllowed,
  rollActorParticipantKind,
  rollDialogComparison,
  rollNumberStep,
  rollVisibility,
  updateRollDescriptions,
  validateRollDialogForm,
  type RollDialogAuthority,
} from "./roll-dialog-controls";
import {
  rollDialogFixture,
  rollDialogLocalize as localize,
} from "./roll-dialog.test-fixtures";
const hbs = Handlebars.create();
hbs.registerHelper(
  "localize",
  (
    key: string,
    options: {
      hash: Record<string, string>;
    },
  ) =>
    Object.entries(options.hash).reduce(
      (text, [name, value]) => text.replace(`{${name}}`, value),
      localize(key),
    ),
);
const template = hbs.compile(
  readFileSync(
    new URL("../../../../../templates/roll/dialog.hbs", import.meta.url),
    "utf8",
  ),
);
function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined)
    throw new Error("Missing rendered control");
  return value;
}
const free: RollDialogAuthority = {
  manualOppositionAllowed: true,
  defaultRollMode: "publicroll",
};
function rendered(overrides: Record<string, unknown> = {}, authority = free) {
  const { document, window } = parseHTML(
    `<html><body><form>${template(rollDialogFixture(overrides))}<button type="submit" class="od6roll-submit" data-action="roll">Roll</button></form></body></html>`,
  );
  vi.stubGlobal("Event", window.Event);
  const root = document.querySelector("form") as unknown as HTMLFormElement;
  const get = (name: string) =>
    required(root.querySelector<HTMLInputElement>(`[name="${name}"]`));
  // Linkedom does not implement selectedOptions/form controls; browser-native selection is represented by option[selected].
  const select = (name: string, value: string) => {
    const input = required(
      root.querySelector<HTMLSelectElement>(`[name="${name}"]`),
    );
    for (const option of Array.from(input.querySelectorAll("option")))
      option.toggleAttribute("selected", option.value === value);
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
  };
  for (const input of Array.from(root.querySelectorAll("input"))) {
    Object.defineProperty(input, "validity", { value: { badInput: false } });
  }
  const preview = vi.fn();
  bindRollDialogControls(root, authority, localize, preview);
  const enter = (name: string, value: string) => {
    get(name).value = value;
    get(name).dispatchEvent(new window.Event("input", { bubbles: true }));
  };
  const step = (name: string, direction: number) =>
    required(
      required(
        get(name).closest("[data-roll-number-control]"),
      ).querySelector<HTMLButtonElement>(`[data-roll-step="${direction}"]`),
    ).click();
  return { root, get, select, enter, step, preview, window };
}
afterEach(() => vi.unstubAllGlobals());
describe("actual roll template disclosures and numeric controls", () => {
  it("starts closed, retains typed/stepped values and summarizes visibility, MAP, dice and flat totals separately", () => {
    const { root, get, enter, step, select } = rendered();
    expect(
      required(root.querySelector("[data-roll-options]")).hasAttribute("open"),
    ).toBe(false);
    expect(
      required(root.querySelector("[data-manual-opposition]")).hasAttribute(
        "open",
      ),
    ).toBe(false);
    enter("mapPenaltyDice", "2");
    enter("manualDiceAdjustment", "-3");
    step("resultModifier", 1);
    select("rollMode", "blindroll");
    const details = required(root.querySelector("[data-roll-options]"));
    details.setAttribute("open", "");
    details.removeAttribute("open");
    expect(get("mapPenaltyDice").value).toBe("2");
    expect(get("manualDiceAdjustment").value).toBe("-3");
    expect(
      required(root.querySelector("[data-roll-options-summary]")).textContent,
    ).toBe("Blind GM roll · MAP −2D · Dice −3D · Total +1");
    expect(get("resultModifier").disabled).toBeFalsy();
    expect(
      actionEconomyRollPlan({
        assistance: "optional",
        baseScore: 18,
        rollCostsAction: true,
        manualMapDice: Number(get("mapPenaltyDice").value),
        trackedMapPenaltyScore: 6,
      }).mapPenaltyScore,
    ).toBe(6);
  });
  it("distinguishes untouched optional blanks, an explicit zero and incomplete opposition setup", () => {
    const { root, get, enter, step } = rendered();
    expect(get("oppositionTotal").value).toBe("");
    expect(rollDialogComparison(root, free, 15)).toEqual({
      opposed: false,
      value: 15,
    });
    enter("oppositionName", "Rival");
    expect(
      required(root.querySelector("[data-manual-opposition-summary]"))
        .textContent,
    ).toContain("Incomplete");
    enter("oppositionTotal", "0");
    expect(rollDialogComparison(root, free, 15)).toEqual({
      opposed: true,
      value: 0,
    });
    expect(
      required(root.querySelector("[data-manual-opposition-summary]"))
        .textContent,
    ).toBe("Rival 0");
    enter("oppositionTotal", "");
    step("oppositionTotal", -1);
    expect(get("oppositionTotal").value).toBe("-1");
    expect(rollDialogComparison(root, free, 15)).toEqual({
      opposed: true,
      value: -1,
    });
  });
  it("preserves bounds, localized button names and first-step semantics", () => {
    const { root, get, step, enter } = rendered();
    expect(get("oppositionWildDie").value).toBe("");
    step("oppositionWildDie", -1);
    expect(get("oppositionWildDie").value).toBe("1");
    enter("manualDiceAdjustment", "99");
    expect(
      required(
        required(
          get("manualDiceAdjustment").closest("[data-roll-number-control]"),
        ).querySelector<HTMLButtonElement>('[data-roll-step="1"]'),
      ).disabled,
    ).toBe(true);
    step("manualDiceAdjustment", -1);
    expect(get("manualDiceAdjustment").value).toBe("98");
    expect(
      root.querySelector('[aria-label="Increase Total adjustment"]'),
    ).not.toBeNull();
    expect(rollNumberStep("", -1, 0)).toBe(0);
    expect(rollNumberStep("", 1, 1, 6)).toBe(1);
    expect(rollNumberStep("", -1)).toBe(-1);
    expect(rollNumberStep("1.5", 1)).toBeUndefined();
    expect(rollNumberStep(String(Number.MAX_SAFE_INTEGER), 1)).toBeUndefined();
  });
  it.each(["1.5", "100", "9007199254740992", "bad"])(
    "reveals and focuses invalid dice %s before submission and preserves the entry",
    (value) => {
      const { root, get, enter, window } = rendered();
      enter("manualDiceAdjustment", value);
      const focus = vi.spyOn(get("manualDiceAdjustment"), "focus");
      const execute = vi.fn();
      root.addEventListener("submit", execute);
      const event = new window.Event("submit", {
        bubbles: true,
        cancelable: true,
      });
      root.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(execute).not.toHaveBeenCalled();
      expect(
        required(root.querySelector("[data-roll-options]")).hasAttribute(
          "open",
        ),
      ).toBe(true);
      expect(focus).toHaveBeenCalled();
      expect(get("manualDiceAdjustment").value).toBe(value);
      expect(get("manualDiceAdjustment").getAttribute("aria-invalid")).toBe(
        "true",
      );
      expect(
        required(root.querySelector("[data-roll-field-error]")).textContent,
      ).toBe(localize("D6E2.Roll.Options.InvalidNumber"));
    },
  );
  it("scrolls the complete invalid control and error into view after focusing the input", () => {
    const { root, get, enter } = rendered();
    enter("manualDiceAdjustment", "100");
    const input = get("manualDiceAdjustment");
    const wrapper = required(input.closest("[data-roll-number-control]"));
    const focus = vi.spyOn(input, "focus");
    const scroll = vi.fn(() => {
      expect(
        required(root.querySelector("[data-roll-options]")).hasAttribute(
          "open",
        ),
      ).toBe(true);
      expect(
        wrapper.querySelector("[data-roll-field-error]")?.textContent,
      ).toBe(localize("D6E2.Roll.Options.InvalidNumber"));
      expect(focus).toHaveBeenCalledOnce();
    });
    Object.defineProperty(wrapper, "scrollIntoView", { value: scroll });
    expect(validateRollDialogForm(root, free, localize)).toBe(false);
    expect(scroll).toHaveBeenCalledExactlyOnceWith({
      block: "nearest",
      inline: "nearest",
    });
    expect(input.value).toBe("100");
    expect(focus.mock.invocationCallOrder[0]).toBeLessThan(
      scroll.mock.invocationCallOrder[0] ?? 0,
    );
  });
  it("retains an entered Wild face when types change and reveals invalid retained values", () => {
    const { root, select, enter, get } = rendered();
    select("opponentKind", "player-character");
    expect(
      required(root.querySelector<HTMLElement>("[data-opposition-wild-field]"))
        .hidden,
    ).toBe(false);
    enter("oppositionWildDie", "7");
    select("opponentKind", "non-player-character");
    expect(
      required(root.querySelector<HTMLElement>("[data-opposition-wild-field]"))
        .hidden,
    ).toBe(false);
    expect(get("oppositionWildDie").value).toBe("7");
    expect(validateRollDialogForm(root, free, localize)).toBe(false);
    expect(
      required(root.querySelector("[data-manual-opposition]")).hasAttribute(
        "open",
      ),
    ).toBe(true);
  });
  it("retains difficulty suggestions and does not add duplicate listeners on rebinding", () => {
    const { root, step, get, preview } = rendered({
      hasDifficultySuggestions: true,
      difficultySuggestions: [{ value: 10, label: "Moderate" }],
    });
    expect(root.querySelector("[data-difficulty-combobox]")).not.toBeNull();
    bindRollDialogControls(root, free, localize, preview);
    step("resultModifier", 1);
    expect(get("resultModifier").value).toBe("1");
    expect(preview).toHaveBeenCalledTimes(1);
  });
});
describe("comparison authority and participant semantics", () => {
  it.each([
    { fixedDifficulty: 0 },
    { fixedDifficulty: 15 },
    { targetControlled: true },
    { requestOwned: true },
    { kind: "resistance" },
  ])(
    "denies manual opposition for %j in both visibility policy and submission",
    (context) => {
      const allowed = manualOppositionAllowed({ kind: "skill", ...context });
      expect(allowed).toBe(false);
      const authority = { ...free, manualOppositionAllowed: allowed };
      const { root, enter } = rendered({}, authority);
      enter("oppositionTotal", "0");
      expect(validateRollDialogForm(root, authority, localize)).toBe(false);
      expect(rollDialogComparison(root, authority, 15)).toEqual({
        opposed: false,
        value: 15,
      });
      expect(() =>
        assertRollDialogSubmission(
          {
            mapPenaltyDice: 0,
            manualDiceAdjustment: 0,
            resultModifier: 0,
            opposition: {
              total: 0,
              name: "Rival",
              actorKind: "player-character",
              opponentKind: "non-player-character",
            },
          },
          authority,
        ),
      ).toThrow("OppositionUnavailable");
    },
  );
  it.each(["publicroll", "gmroll", "blindroll", "selfroll"] as const)(
    "preserves locked %s without requested-roll metadata, including a tampered or missing input",
    (mode) => {
      const authority = { ...free, lockedRollMode: mode };
      const visibility = rollVisibility(mode, localize, true);
      const { root, get, enter } = rendered(
        { rollVisibility: visibility, rollModeLocked: true },
        authority,
      );
      expect(get("rollMode").value).toBe(mode);
      expect(
        required(root.querySelector(".od6roll-visibility-status")).textContent,
      ).toContain(visibility.label);
      enter("rollMode", "publicroll");
      expect(effectiveRollDialogMode(authority, get("rollMode").value)).toBe(
        mode,
      );
      expect(effectiveRollDialogMode(authority, "")).toBe(mode);
      expect(
        required(root.querySelector("[data-roll-options-summary]")).textContent,
      ).toContain(visibility.label);
    },
  );
  it("uses known actor types and preserves the existing opposed evaluator", () => {
    expect(
      ["character", "npc", "creature", "imported"].map(
        rollActorParticipantKind,
      ),
    ).toEqual([
      "player-character",
      "non-player-character",
      "non-player-character",
      "unknown",
    ]);
    expect(
      evaluateOpposedRoll({
        actorKind: "player-character",
        opponentKind: "player-character",
        actorTotal: 12,
        opponentTotal: 12,
        actorWildFace: 2,
        opponentWildFace: 5,
      }).winner,
    ).toBe("opponent");
  });
});
describe("safe full descriptions", () => {
  it("updates excerpt and full content together, avoids duplicate narration and preserves explicit disclosure state", () => {
    const long =
      'Long text <script>alert("x")</script> ' + "Full details. ".repeat(80);
    const { root, select } = rendered({
      rollDescription: "Short…",
      rollDescriptionFull: long,
      hasAdvancedSkillContexts: true,
      dialogAdvancedSkillContexts: [
        {
          itemId: "advanced",
          description: "Advanced excerpt…",
          descriptionFull: "Advanced full text",
          optionLabel: "Advanced",
        },
      ],
    });
    const details = required(
      root.querySelector<HTMLElement>("[data-roll-description-disclosure]"),
    );
    expect(details.hidden).toBe(false);
    expect(root.querySelector("script")).toBeNull();
    expect(
      required(root.querySelector("[data-roll-description-full]")).textContent,
    ).toBe(long);
    details.setAttribute("open", "");
    updateRollDescriptions(root);
    expect(
      required(root.querySelector<HTMLElement>("[data-roll-description]"))
        .hidden,
    ).toBe(true);
    select("advancedSkillItemId", "advanced");
    expect(
      required(root.querySelector("[data-roll-description-full]")).textContent,
    ).toBe("Advanced full text");
    expect(details.hasAttribute("open")).toBe(true);
    details.removeAttribute("open");
    updateRollDescriptions(root);
    expect(
      required(root.querySelector<HTMLElement>("[data-roll-description]"))
        .hidden,
    ).toBe(false);
    expect(
      required(root.querySelector("[data-roll-description]")).textContent,
    ).toBe("Advanced excerpt…");
  });
});
