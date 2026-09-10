import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { parseHTML } from "linkedom";
import { expect, it } from "vitest";
const h = Handlebars.create();
const labels = JSON.parse(readFileSync("lang/en.json", "utf8")) as Record<
  string,
  string
>;
h.registerHelper("localize", (key: string) => labels[key] ?? key);
const render = h.compile(
  readFileSync(
    process.env.D6_MOVEMENT_TEMPLATE ??
      "templates/actor/character/first-edition-movement-card.hbs",
    "utf8",
  ),
);
it("pairs the explicit root VM with initially inert controls and ordinary nested roll detail", () => {
  const { document } = parseHTML(
    render({
      root: true,
      actor: { name: "Mover", img: "token.webp" },
      typeLabel: "Land movement",
      actionLabel: "One action",
      plan: {
        distance: 15,
        movementRate: 10,
        freeDistance: 5,
        maximumDistance: 40,
        rollRequired: true,
        difficulty: 5,
      },
      statusLabel: "Pending",
      rollDetails: [
        {
          id: "move:check",
          label: "Movement check",
          total: 4,
          content:
            '<div class="d6-roll"><button data-action="doubleDown">Double down</button></div>',
        },
      ],
      movementOutcome: { label: "Not confirmed" },
      actionOutcome: { label: "Not confirmed" },
      controls: [
        { action: "continue", label: "Continue" },
        { action: "cancel", label: "Cancel" },
      ],
    }),
  );
  const root = document.querySelector(".od6-first-edition-movement-root");
  expect(root).not.toBeNull();
  const controls = Array.from(
    document.querySelectorAll("[data-d6-movement-root-action]"),
  );
  expect(controls).toHaveLength(2);
  expect(
    controls.every(
      (b) =>
        b.hasAttribute("disabled") && b.getAttribute("hidden") === "hidden",
    ),
  ).toBe(true);
  expect(
    document.querySelector(
      '[data-d6-movement-result-id="move:check"] .d6-roll [data-action="doubleDown"]',
    ),
  ).not.toBeNull();
  expect(root?.classList.contains("od6-movement-root-bound")).toBe(false);
});
it("keeps the legacy VM outside the new root and its runtime controls", () => {
  const { document } = parseHTML(
    render({
      actor: { name: "Mover" },
      plan: {
        distance: 4,
        movementRate: 10,
        freeDistance: 5,
        maximumDistance: 40,
      },
      typeLabel: "Land movement",
      actionLabel: "Free movement",
    }),
  );
  expect(document.querySelector("article")?.textContent).toContain("Mover");
  expect(document.querySelector(".od6-first-edition-movement-root")).toBeNull();
  expect(document.querySelector("[data-d6-movement-root-action]")).toBeNull();
});
