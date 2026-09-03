import { describe, expect, it } from "vitest";
import {
  applyDistinctionRollChoices,
  classifyDistinctionMechanic,
  resolveDistinctionRollEffects,
} from "./distinction-automation";

const source = (
  overrides: Partial<
    Parameters<typeof resolveDistinctionRollEffects>[0][number]
  > = {},
) => ({
  definitionId: "frontier.quick-draw",
  itemId: "talent-1",
  label: "Quick Draw",
  mechanics: [
    {
      application: "initiative" as const,
      automatic: true,
      kind: "roll-modifier" as const,
      perRank: true,
      score: 3,
    },
  ],
  private: false,
  rank: 2,
  ...overrides,
});

describe("Distinction automation", () => {
  it("classifies every feature mechanic kind without treating prose as executable", () => {
    expect(
      classifyDistinctionMechanic({
        application: "skill",
        automatic: true,
        kind: "roll-modifier",
        score: 3,
      }),
    ).toBe("automatic");
    expect(classifyDistinctionMechanic({ kind: "reroll" })).toBe("declaration");
    expect(classifyDistinctionMechanic({ kind: "narrative" })).toBe(
      "narrative-only",
    );
    expect(classifyDistinctionMechanic({ kind: "minimum-total" })).toBe(
      "stored-only",
    );
  });

  it("applies only exact automatic roll scopes and multiplies per rank", () => {
    const result = resolveDistinctionRollEffects([source()], {
      applications: ["attribute", "initiative"],
      attributeId: "perception",
      kind: "attribute",
    });
    expect(result.totalScore).toBe(6);
    expect(result.choices).toEqual([]);
    expect(result.effects).toEqual([
      expect.objectContaining({
        application: "initiative",
        definitionId: "frontier.quick-draw",
        effectId: "frontier.quick-draw:talent-1:0",
        itemId: "talent-1",
        score: 6,
      }),
    ]);
    expect(
      resolveDistinctionRollEffects([source()], {
        applications: ["attribute"],
        attributeId: "perception",
        kind: "attribute",
      }).totalScore,
    ).toBe(0);
  });

  it("matches stable selectors and sums multiple independent sources once", () => {
    const mechanics = [
      {
        application: "skill" as const,
        automatic: true,
        kind: "roll-modifier" as const,
        score: 3,
        selector: "blaster",
      },
    ];
    const result = resolveDistinctionRollEffects(
      [
        source({ itemId: "talent-a", mechanics, rank: 1 }),
        source({ itemId: "talent-b", mechanics, rank: 1 }),
        source({ itemId: "talent-b", mechanics, rank: 1 }),
      ],
      {
        applications: ["skill"],
        attributeId: "agility",
        itemId: "blaster",
        kind: "skill",
      },
    );
    expect(result.totalScore).toBe(6);
    expect(result.effects.map(({ itemId }) => itemId)).toEqual([
      "talent-a",
      "talent-b",
    ]);
  });

  it("retains unsupported and manual mechanics as explicit inert evidence", () => {
    const result = resolveDistinctionRollEffects(
      [
        source({
          mechanics: [
            { kind: "resource", score: 1 },
            {
              application: "all-rolls",
              automatic: false,
              kind: "roll-modifier",
              score: 9,
            },
            { kind: "narrative" },
          ],
        }),
      ],
      { applications: ["skill"], kind: "skill" },
    );
    expect(result.totalScore).toBe(0);
    expect(result.choices).toEqual([]);
    expect(result.inert.map(({ disposition }) => disposition)).toEqual([
      "declaration",
      "declaration",
      "narrative-only",
    ]);
  });

  it("offers contextual roll modifiers and applies only explicit selections", () => {
    const evaluation = resolveDistinctionRollEffects(
      [
        source({
          mechanics: [
            {
              application: "skill",
              automatic: false,
              kind: "roll-modifier",
              perRank: true,
              score: 3,
              selector: "blaster",
            },
          ],
          rank: 2,
        }),
      ],
      { applications: ["skill"], itemId: "blaster", kind: "skill" },
    );
    expect(evaluation.totalScore).toBe(0);
    expect(evaluation.effects).toEqual([]);
    expect(evaluation.choices).toEqual([
      expect.objectContaining({
        effectId: "frontier.quick-draw:talent-1:0",
        score: 6,
      }),
    ]);
    expect(applyDistinctionRollChoices(evaluation, []).totalScore).toBe(0);
    expect(
      applyDistinctionRollChoices(evaluation, [
        "frontier.quick-draw:talent-1:0",
      ]),
    ).toMatchObject({
      effects: [expect.objectContaining({ mode: "chosen", score: 6 })],
      totalScore: 6,
    });
  });

  it("keeps contextual choices independent when two owned Items share a definition", () => {
    const mechanic = {
      application: "all-rolls" as const,
      automatic: false,
      kind: "roll-modifier" as const,
      score: 3,
    };
    const evaluation = resolveDistinctionRollEffects(
      [
        source({ itemId: "talent-a", mechanics: [mechanic], rank: 1 }),
        source({ itemId: "talent-b", mechanics: [mechanic], rank: 1 }),
      ],
      { applications: ["all-rolls"], kind: "attribute" },
    );
    expect(evaluation.choices.map(({ effectId }) => effectId)).toEqual([
      "frontier.quick-draw:talent-a:0",
      "frontier.quick-draw:talent-b:0",
    ]);
    expect(
      applyDistinctionRollChoices(evaluation, [
        evaluation.choices[0]?.effectId ?? "",
      ]).effects,
    ).toEqual([expect.objectContaining({ itemId: "talent-a", score: 3 })]);
  });

  it("grant, remove, regrant, and changed rank recompute without base writes", () => {
    const request = {
      applications: ["initiative" as const],
      kind: "attribute" as const,
    };
    expect(resolveDistinctionRollEffects([source()], request).totalScore).toBe(
      6,
    );
    expect(resolveDistinctionRollEffects([], request).totalScore).toBe(0);
    expect(
      resolveDistinctionRollEffects([source({ rank: 3 })], request).totalScore,
    ).toBe(9);
  });

  it("treats selectors as opaque stable IDs instead of property paths or expressions", () => {
    const malicious = source({
      mechanics: [
        {
          application: "attribute",
          automatic: true,
          kind: "roll-modifier",
          score: 99,
          selector: "system.attributes.agility.score + 99",
        },
      ],
      rank: 1,
    });
    expect(
      resolveDistinctionRollEffects([malicious], {
        applications: ["attribute"],
        attributeId: "agility",
        kind: "attribute",
      }).totalScore,
    ).toBe(0);
  });
});
