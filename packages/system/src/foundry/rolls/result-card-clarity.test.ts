import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";

const template = Handlebars.compile(
  readFileSync("templates/roll/chat-card.hbs", "utf8"),
);
const movementTemplate = Handlebars.compile(
  readFileSync(
    "templates/actor/character/first-edition-movement-card.hbs",
    "utf8",
  ),
);

Handlebars.registerHelper(
  "eq",
  (left: unknown, right: unknown) => left === right,
);
Handlebars.registerHelper(
  "localize",
  (key: string, options: { readonly hash?: Record<string, unknown> }) => {
    if (key === "D6E2.Combat.FirstEdition.Consciousness.DurationResult") {
      return `${String(options.hash?.actor)} is unconscious for ${String(
        options.hash?.duration,
      )} ${String(options.hash?.unit)}.`;
    }
    if (key === "D6E2.Combat.Meters") return "m";
    return key;
  },
);

describe("neutral result-card clarity", () => {
  it("renders typed Distinction evidence without developer IDs", () => {
    const html = template({
      actor: { img: "actor.webp", name: "Tester" },
      baseFaces: [{ value: 4 }],
      characterPointFaces: [],
      distinctionEffects: [
        {
          label: "Steady Aim",
          modeLabel: "D6E2.Distinction.Automatic",
          scoreLabel: "+1D",
        },
      ],
      hasDistinctionEffects: true,
      request: { label: "Blaster", resultModifier: 0 },
      result: {
        pool: { code: { dice: 4, pips: 0 } },
        total: 14,
        wildOutcome: "normal",
      },
      wildDieStrategy: { label: "Classic", source: "Rules Profile" },
      wildFaces: [{ value: 5 }],
    });

    expect(html).toContain("Steady Aim");
    expect(html).toContain("+1D");
    expect(html).toContain("D6E2.Distinction.Automatic");
    expect(html).not.toContain("definitionId");
    expect(html).not.toContain("effectId");
    expect(html).not.toContain("itemId");
  });

  it("renders public FreeD6 modifier provenance without exposing private effect data", () => {
    const html = template({
      actor: { img: "actor.webp", name: "Tester" },
      baseFaces: [{ value: 4 }],
      characterPointFaces: [],
      featureEffects: [
        {
          definitionLabel: "Keen observer",
          providerLabel: "Frontier catalog",
          scoreLabel: "+1D",
        },
      ],
      hasFeatureEffects: true,
      request: { label: "Perception", resultModifier: 0 },
      result: {
        pool: { code: { dice: 3, pips: 0 } },
        total: 12,
        wildOutcome: "normal",
      },
      wildDieStrategy: { label: "Classic", source: "Rules Profile" },
      wildFaces: [{ value: 5 }],
    });

    expect(html).toContain("Keen observer");
    expect(html).toContain("Frontier catalog");
    expect(html).toContain("+1D");
    expect(html).not.toContain("privateEffectCount");
    expect(html).not.toContain("definitionId");
  });

  it("renders persisted D6MV degree evidence without inferring it in the template", () => {
    const html = template({
      actor: { img: "actor.webp", name: "Tester" },
      baseFaces: [{ value: 4 }, { value: 5 }],
      characterPointFaces: [],
      d6mv: {
        consequence: "setback",
        consequenceLabel: "Setback",
        degreeLabel: "Partial Success",
        difficulty: 10,
        hasAllyAward: false,
        hasSelfAward: true,
        margin: 0,
        selfHeroPointAward: 1,
        selfAwardLabel: "Force Points +1",
      },
      hasD6MvEvidence: true,
      request: { label: "Test", resultModifier: 0 },
      result: {
        pool: { code: { dice: 3, pips: 0 } },
        total: 10,
        wildOutcome: "d6mv-advantage",
      },
      wildDieStrategy: { label: "D6MV", source: "Rules Profile" },
      wildFaces: [{ value: 6 }],
    });

    expect(html).toContain("Partial Success");
    expect(html).toContain("Setback");
    expect(html).toContain("D6E2.Roll.D6MV.Margin");
    expect(html).toContain("Force Points +1");
    expect(html).not.toContain("D6E2.HeroPoints");
    expect(html).not.toContain("catastrophic-failure");
  });

  it("states the exact minutes-based unconscious effect beside retained roll evidence", () => {
    const html = template({
      actor: { img: "actor.webp", name: "Blackman Fade" },
      baseFaces: [{ value: 3 }, { value: 4 }],
      characterPointFaces: [],
      firstEditionDurationContext: {
        actorName: "Blackman Fade",
        duration: 34,
        effect: "unconscious",
        source: "incapacitation",
        unit: "minutes",
        unitLabel: "minutes",
      },
      hasFirstEditionDurationContext: true,
      request: {
        label: "Incapacitated · 10D unconscious minutes",
        resultModifier: 0,
      },
      result: {
        pool: { code: { dice: 10, pips: 0 } },
        total: 34,
        wildOutcome: "normal",
      },
      wildDieStrategy: { label: "Classic", source: "Rules Profile" },
      wildFaces: [{ value: 5 }],
    });

    expect(html).toContain('data-duration-effect="unconscious"');
    expect(html).toContain('data-duration-unit="minutes"');
    expect(html).toContain("Blackman Fade is unconscious for 34 minutes.");
    expect(html).toContain(">3<");
    expect(html).toContain(">4<");
    expect(html).toMatch(/class="is-wild [^"]*"[^>]*>[\s\S]*?5\s*<\/span>/);
    expect(html).toContain(
      "D6E2.Combat.FirstEdition.Consciousness.DurationRestriction",
    );
  });

  it("retains every authored Second Edition magic scope and duration value", () => {
    const html = template({
      actor: { img: "actor.webp", name: "Caster" },
      baseFaces: [{ value: 4 }],
      characterPointFaces: [],
      hasMagicContext: true,
      magicContext: {
        castingTimeLabel: "Two turns",
        durationLabel: "Ten minutes",
        firstEdition: false,
        power: 3,
        rangeLabel: "One mile",
        resistanceLabel: "Partial resistance",
        schoolLabel: "Alteration",
        targetLabel: "One target or object",
        untrainedLabel: "Trained",
        untrainedPenalty: 0,
      },
      request: { label: "Veil", resultModifier: 0 },
      result: {
        pool: { code: { dice: 3, pips: 0 } },
        total: 15,
        wildOutcome: "normal",
      },
      wildDieStrategy: { label: "Classic", source: "Rules Profile" },
      wildFaces: [{ value: 5 }],
    });

    expect(html).toContain("One target or object");
    expect(html).toContain("One mile");
    expect(html).toContain("Ten minutes");
    expect(html).toContain("Two turns");
    expect(html).toContain("Partial resistance");
  });

  it("labels every standalone First Edition movement distance in meters", () => {
    const html = movementTemplate({
      actionLabel: "One action",
      actor: { img: "actor.webp", name: "Runner" },
      plan: {
        difficulty: 15,
        distance: 18,
        freeDistance: 10,
        maximumDistance: 20,
        movementRate: 10,
        rollRequired: true,
      },
      trackedAction: true,
      typeLabel: "High speed",
    });

    const text = html.replace(/\s+/g, " ");
    expect(text).toContain("18 m / 10 m");
    expect(text).toContain("D6E2.Combat.FirstEdition.FreeThrough 10 m");
    expect(text).toContain("D6E2.Combat.FirstEdition.Maximum 20 m");
  });
});
