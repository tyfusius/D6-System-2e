import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";

const template = Handlebars.create();
const labels = JSON.parse(readFileSync("lang/en.json", "utf8")) as Record<
  string,
  string
>;
template.registerHelper("localize", (key: string) => labels[key] ?? key);
const render = template.compile(
  readFileSync(
    process.env.D6_ALLOCATION_TEMPLATE ??
      "templates/roll/combined-action-allocation.hbs",
    "utf8",
  ),
);

function accessibleLabel(control: Element): string {
  const direct = control.getAttribute("aria-label");
  if (direct) return direct;
  const label = control.closest("label")?.cloneNode(true) as
    Element | undefined;
  if (!label) return "";
  for (const field of Array.from(label.querySelectorAll("select,input")))
    field.remove();
  return label.textContent.replace(/\s+/g, " ").trim();
}

describe("Combined allocation form contract", () => {
  it("keeps the selected source Skill on every labelled allocation row", () => {
    const rows = Array.from({ length: 4 }, (_, index) => ({
      allocation: index === 0 ? 3 : 0,
      maximum: 3,
      subjectId: "climbing",
      skills: [
        { id: "climbing", name: "Climbing", selected: true },
        { id: "observation", name: "Observation", selected: false },
      ],
    }));
    const { document } = parseHTML(
      render({ combat: false, rows, bonusScore: 3, bonusLabel: "1D" }),
    );
    const selects = Array.from(
      document.querySelectorAll('select[name="subjectId"]'),
    );
    const inputs = Array.from(
      document.querySelectorAll('input[name="allocation"]'),
    );
    expect(selects).toHaveLength(4);
    expect(inputs).toHaveLength(4);
    for (const select of selects) {
      const selected = select.querySelectorAll("option[selected]");
      expect(selected).toHaveLength(1);
      expect(selected[0]?.getAttribute("value")).toBe("climbing");
      expect(
        select
          .querySelector('option[value="observation"]')
          ?.hasAttribute("selected"),
      ).toBe(false);
      expect(accessibleLabel(select)).toBe("Skill");
    }
    for (const [index, input] of inputs.entries()) {
      expect(input.getAttribute("type")).toBe("number");
      expect(input.getAttribute("value")).toBe(index === 0 ? "3" : "0");
      expect(input.getAttribute("min")).toBe("0");
      expect(input.getAttribute("max")).toBe("3");
      expect(input.getAttribute("step")).toBe("1");
      expect(accessibleLabel(input)).toBe("Bonus (pips)");
    }
  });

  it("preserves the combat weapon and separately labelled attack/Damage inputs", () => {
    const { document } = parseHTML(
      render({
        combat: true,
        bonusScore: 3,
        bonusLabel: "1D",
        weapons: [{ id: "weapon", name: "Weapon" }],
      }),
    );
    const weapon = document.querySelector('select[name="weaponId"]');
    expect(weapon?.querySelector("option")?.getAttribute("value")).toBe(
      "weapon",
    );
    if (!weapon) throw new Error("Missing weapon selector");
    expect(accessibleLabel(weapon)).toBe(labels["D6E2.CombinedActions.Weapon"]);
    const inputs = Array.from(
      document.querySelectorAll('input[name="allocation"]'),
    );
    expect(inputs).toHaveLength(2);
    expect(inputs.map((input) => input.getAttribute("value"))).toEqual([
      "3",
      "0",
    ]);
    expect(inputs.map(accessibleLabel)).toEqual([
      labels["D6E2.Combat.Attack"],
      labels["D6E2.Item.Damage"],
    ]);
    for (const input of inputs) {
      expect(input.getAttribute("min")).toBe("0");
      expect(input.getAttribute("max")).toBe("3");
      expect(input.getAttribute("step")).toBe("1");
    }
  });
  it("submits the locked Weapon once while keeping its name read-only", () => {
    const { document } = parseHTML(
      render({
        combat: true,
        weaponLocked: true,
        weaponId: "chosen",
        weaponName: "Chosen weapon",
        bonusScore: 3,
        bonusLabel: "1D",
      }),
    );
    expect(document.querySelector('select[name="weaponId"]')).toBeNull();
    expect(document.querySelectorAll('[name="weaponId"]')).toHaveLength(1);
    expect(
      document.querySelector('input[name="weaponId"]')?.getAttribute("value"),
    ).toBe("chosen");
    expect(
      document.querySelector('input[name="weaponId"]')?.getAttribute("type"),
    ).toBe("hidden");
    expect(
      document.querySelector("input[readonly]")?.getAttribute("value"),
    ).toBe("Chosen weapon");
    expect(
      Array.from(document.querySelectorAll('[name="allocation"]'), (input) =>
        input.getAttribute("value"),
      ),
    ).toEqual(["3", "0"]);
  });
  it("selects exactly one Weapon belonging to the resolved primary before Command", () => {
    const picker = template.compile(
      readFileSync(
        process.env.D6_WEAPON_TEMPLATE ??
          "templates/roll/combined-action-weapon.hbs",
        "utf8",
      ),
    );
    const { document } = parseHTML(
      picker({
        primaryName: "Primary worker",
        weapons: [
          { id: "chosen", name: "First", selected: true },
          { id: "other", name: "Second", selected: false },
        ],
      }),
    );
    expect(document.querySelectorAll('[name="weaponId"]')).toHaveLength(1);
    const control = required(document.querySelector('select[name="weaponId"]'));
    expect(control.querySelectorAll("option[selected]")).toHaveLength(1);
    expect(
      control.querySelector("option[selected]")?.getAttribute("value"),
    ).toBe("chosen");
    expect(accessibleLabel(control)).toContain("Primary worker");
  });
});

function required<T>(value: T | null | undefined): T {
  if (value === undefined || value === null)
    throw new Error("Missing test fixture value");
  return value;
}
