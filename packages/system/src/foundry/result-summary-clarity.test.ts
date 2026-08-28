import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";

Handlebars.registerHelper(
  "eq",
  (left: unknown, right: unknown) => left === right,
);
Handlebars.registerHelper("localize", (key: string) => key);

const chaseTemplate = Handlebars.compile(
  readFileSync("templates/chat/chase-resolution.hbs", "utf8"),
);
const magicPointTemplate = Handlebars.compile(
  readFileSync("templates/roll/magic-point-cast.hbs", "utf8"),
);

describe("standalone neutral result-summary clarity", () => {
  it("states the next required chase exchange when the chase remains active", () => {
    const html = chaseTemplate({
      chase: {
        exchange: 3,
        fleeing: { actorName: "Runner" },
        label: "Dockside chase",
        pursuer: { actorName: "Pursuer" },
        status: "active",
      },
      result: {
        exchange: 2,
        exceptional: false,
        fleeingTotal: 12,
        fleeingWildOutcome: "normal",
        fromDistance: 4,
        pursuerTotal: 15,
        pursuerWildOutcome: "normal",
        tieBreak: "none",
        toDistance: 3,
        winner: "pursuer",
      },
    });

    expect(html).toContain("D6E2.Chase.NextExchange");
    expect(html).toContain("3");
  });

  it("states the full authored scope and next step for a Magic Point cast", () => {
    const html = magicPointTemplate({
      actor: { img: "actor.webp", name: "Caster" },
      castingTimeLabel: "Two turns",
      cost: 4,
      difficulty: 18,
      durationLabel: "Ten minutes",
      manifestation: { name: "Veil" },
      maximum: 12,
      rangeLabel: "One mile",
      remaining: 8,
      resistanceLabel: "Partial resistance",
      schoolLabel: "Alteration",
      targetLabel: "One target or object",
    });

    expect(html).toContain("One target or object");
    expect(html).toContain("One mile");
    expect(html).toContain("Ten minutes");
    expect(html).toContain("Two turns");
    expect(html).toContain("Partial resistance");
    expect(html).toContain("D6E2.Magic.ResolveEffect");
  });
});
