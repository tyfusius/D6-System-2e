import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";
import { featureDefinitionItemSource } from "./feature-catalog-service";
import {
  distinctionAutomationStatusId,
  distinctionModifierScoreLabel,
  distinctionItemAutomationPresentation,
  distinctionItemAutomationSummary,
  distinctionRollModifier,
  privacySafeDistinctionRollResult,
  talentAutomationDefinitionUpdate,
  talentAutomationDraftRows,
} from "./distinction-automation-service";

const item = (
  id: string,
  mechanics: readonly Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
) => ({
  id,
  name: `Distinction ${id}`,
  type: "talent",
  system: { rank: 1, ...overrides },
  getFlag: (_namespace: string, key: string) =>
    key === "featureDefinition"
      ? {
          definitionId: `world.${id}`,
          mechanics,
        }
      : undefined,
});

const actor = (contents: readonly unknown[]) =>
  ({ items: { contents } }) as unknown as FoundryActorDocument;

describe("Distinction automation service", () => {
  it("formats positive and negative authored modifiers as explicit signed evidence", () => {
    expect(distinctionModifierScoreLabel(4)).toBe("+1D+1");
    expect(distinctionModifierScoreLabel(-4)).toBe("−1D+1");
  });

  it("authors safe Talent roll rules while preserving provider metadata and deferred mechanics", () => {
    const result = talentAutomationDefinitionUpdate(
      "talent-id",
      {
        catalogId: "private.catalog",
        definitionId: "private.talent",
        mechanics: [
          { kind: "reroll", limit: 1 },
          { kind: "provider-future-mechanic", opaque: true },
        ],
        ownerId: "private-provider",
        version: 1,
      },
      [
        {
          application: "skill",
          mode: "automatic-roll",
          perRank: true,
          score: 3,
          selector: "blaster",
        },
        {
          application: "initiative",
          mode: "contextual-roll",
          score: 6,
        },
        { mode: "narrative" },
      ],
    );
    expect(result.issues).toEqual([]);
    expect(result.definition).toMatchObject({
      catalogId: "private.catalog",
      definitionId: "private.talent",
      ownerId: "private-provider",
      mechanics: [
        { kind: "reroll", limit: 1 },
        { kind: "provider-future-mechanic", opaque: true },
        {
          application: "skill",
          automatic: true,
          kind: "roll-modifier",
          perRank: true,
          score: 3,
          selector: "blaster",
        },
        {
          application: "initiative",
          automatic: false,
          kind: "roll-modifier",
          score: 6,
        },
        { kind: "narrative" },
      ],
    });
    expect(talentAutomationDraftRows(result.definition)).toEqual([
      expect.objectContaining({ mode: "automatic-roll", score: 3 }),
      expect.objectContaining({ mode: "contextual-roll", score: 6 }),
      { mode: "narrative" },
    ]);
  });

  it("rejects incomplete executable rules without inventing values", () => {
    expect(
      talentAutomationDefinitionUpdate("talent-id", {}, [
        { mode: "automatic-roll", score: 0 },
      ]).issues,
    ).toEqual([
      expect.objectContaining({ field: "application", index: 0 }),
      expect.objectContaining({ field: "score", index: 0 }),
    ]);
    expect(
      talentAutomationDefinitionUpdate("talent-id", {}, [
        { application: "all-rolls", mode: "automatic-roll", score: 63 },
      ]).issues,
    ).toEqual([expect.objectContaining({ field: "score", index: 0 })]);
  });
  it("derives current effects from native Item lifecycle without actor writes", () => {
    const granted = item("steady", [
      {
        application: "skill",
        automatic: true,
        kind: "roll-modifier",
        score: 3,
        selector: "blaster",
      },
    ]);
    const scope = {
      applications: ["skill" as const],
      attributeId: "agility",
      itemId: "blaster",
      kind: "skill" as const,
    };
    expect(distinctionRollModifier(actor([granted]), scope).totalScore).toBe(3);
    expect(distinctionRollModifier(actor([]), scope).totalScore).toBe(0);
    expect(distinctionRollModifier(actor([granted]), scope).totalScore).toBe(3);
  });

  it("supports rank, multiple sources, manual snapshots, and provider disappearance", () => {
    const mechanic = {
      application: "all-rolls",
      automatic: true,
      kind: "roll-modifier",
      perRank: true,
      score: 3,
    };
    const evaluation = distinctionRollModifier(
      actor([
        item("catalog-copy", [mechanic], { rank: 2 }),
        item("manual-world", [mechanic], { rank: 1 }),
      ]),
      { applications: ["all-rolls", "attribute"], kind: "attribute" },
    );
    expect(evaluation.totalScore).toBe(9);
    expect(evaluation.effects).toHaveLength(2);
  });

  it("never offers private contextual mechanics to a non-GM roller", () => {
    const privateChoice = item(
      "private-choice",
      [
        {
          application: "all-rolls",
          automatic: false,
          kind: "roll-modifier",
          score: 3,
        },
      ],
      { private: true },
    );
    const scope = {
      applications: ["all-rolls" as const],
      kind: "attribute" as const,
    };
    expect(
      distinctionRollModifier(actor([privateChoice]), scope).choices,
    ).toEqual([]);
    expect(
      distinctionRollModifier(actor([privateChoice]), scope, true).choices,
    ).toHaveLength(1);
  });

  it("keeps private automatic mechanics active while excluding every private name and ID from non-GM dialog and chat markup", () => {
    const privateFeature = {
      ...item("private-live", [
        {
          application: "all-rolls",
          automatic: true,
          kind: "roll-modifier",
          score: 3,
        },
        {
          application: "all-rolls",
          automatic: false,
          kind: "roll-modifier",
          score: 6,
        },
      ]),
      name: "Private Talent Name",
      system: { private: true, rank: 1 },
      getFlag: (_namespace: string, key: string) =>
        key === "featureDefinition"
          ? {
              definitionId: "private.definition-id",
              mechanics: [
                {
                  application: "all-rolls",
                  automatic: true,
                  kind: "roll-modifier",
                  score: 3,
                },
                {
                  application: "all-rolls",
                  automatic: false,
                  kind: "roll-modifier",
                  score: 6,
                },
              ],
            }
          : undefined,
    };
    const evaluation = distinctionRollModifier(
      actor([privateFeature]),
      { applications: ["all-rolls"], kind: "attribute" },
      false,
    );

    expect(evaluation.totalScore).toBe(3);
    expect(evaluation.effects).toEqual([
      expect.objectContaining({ label: "Private Talent Name", private: true }),
    ]);
    expect(evaluation.choices).toEqual([]);

    const dialogSource = readFileSync("templates/roll/dialog.hbs", "utf8");
    const dialogStart = dialogSource.indexOf("{{#if hasDistinctionChoices}}");
    const dialogEnd = dialogSource.indexOf("{{/if}}", dialogStart) + 7;
    const dialogHtml = Handlebars.compile(
      dialogSource.slice(dialogStart, dialogEnd),
    )({
      distinctionChoices: evaluation.choices,
      hasDistinctionChoices: evaluation.choices.length > 0,
    });

    const projected = privacySafeDistinctionRollResult({
      request: {
        context: {
          distinctionEffects: {
            effects: evaluation.effects,
            privateEffectCount: 0,
            version: 1,
          },
        },
      },
    } as never);
    const visibleEffects =
      projected.request.context?.distinctionEffects?.effects ?? [];
    const chatSource = readFileSync("templates/roll/chat-card.hbs", "utf8");
    const chatStart = chatSource.indexOf("{{#if hasDistinctionEffects}}");
    const chatEnd = chatSource.indexOf("{{/if}}", chatStart) + 7;
    const chatHtml = Handlebars.compile(chatSource.slice(chatStart, chatEnd))({
      distinctionEffects: visibleEffects,
      hasDistinctionEffects: visibleEffects.length > 0,
    });

    for (const html of [dialogHtml, chatHtml]) {
      expect(html).not.toContain("Private Talent Name");
      expect(html).not.toContain("private.definition-id");
      expect(html).not.toContain("private-live");
    }
  });

  it("ignores unrelated Items and malformed or prose-only snapshots", () => {
    const unrelated = { ...item("weapon", [], {}), type: "weapon" };
    const prose = item("prose", [{ kind: "narrative" }]);
    const malformed = item("bad", [
      {
        application: "skill",
        automatic: true,
        kind: "roll-modifier",
        score: "3D",
      },
    ]);
    const evaluation = distinctionRollModifier(
      actor([unrelated, prose, malformed]),
      { applications: ["skill"], kind: "skill" },
    );
    expect(evaluation.totalScore).toBe(0);
    expect(evaluation.effects).toEqual([]);
    expect(evaluation.inert).toHaveLength(1);
  });

  it("maps defense, initiative, damage, and resistance semantic scopes", () => {
    const features = ["defense", "initiative", "damage", "resistance"].map(
      (application) =>
        item(application, [
          {
            application,
            automatic: true,
            kind: "roll-modifier",
            score: 3,
          },
        ]),
    );
    for (const application of [
      "defense",
      "initiative",
      "damage",
      "resistance",
    ] as const) {
      expect(
        distinctionRollModifier(actor(features), {
          applications: [application],
          kind:
            application === "damage"
              ? "damage"
              : application === "resistance"
                ? "resistance"
                : "skill",
        }).totalScore,
      ).toBe(3);
    }
  });

  it("redacts private Distinction evidence without leaking names or IDs", () => {
    const result = {
      request: {
        context: {
          distinctionEffects: {
            effects: [
              {
                application: "skill",
                definitionId: "private.secret",
                effectId: "private.secret:0",
                itemId: "secret-item",
                label: "Secret Distinction",
                mode: "automatic",
                private: true,
                score: 3,
              },
            ],
            privateEffectCount: 0,
            version: 1,
          },
        },
      },
    } as never;
    const projected = privacySafeDistinctionRollResult(result);
    expect(projected.request.context?.distinctionEffects).toEqual({
      effects: [],
      privateEffectCount: 1,
      version: 1,
    });
    expect(JSON.stringify(projected)).not.toContain("Secret Distinction");
    expect(JSON.stringify(projected)).not.toContain("private.secret");
  });

  it("keeps four dispositions distinct and suppresses private presentation for unauthorized viewers", () => {
    const feature = item(
      "mixed",
      [
        {
          application: "skill",
          automatic: true,
          kind: "roll-modifier",
          score: 3,
        },
        { kind: "resource" },
        { kind: "narrative" },
        { kind: "minimum-total" },
      ],
      { private: true },
    ) as unknown as FoundryItemDocument;

    expect(distinctionItemAutomationSummary(feature, false)).toBeNull();
    expect(distinctionItemAutomationPresentation(feature, false)).toBeNull();
    expect(distinctionItemAutomationSummary(feature, true)).toEqual({
      automatic: 1,
      declaration: 1,
      narrativeOnly: 1,
      storedOnly: 1,
    });
  });

  it("builds an Item presentation without exposing stable provider, definition, or selector IDs", () => {
    const longTarget =
      "A very long human-readable Skill target label that must remain intact";
    const feature = {
      ...item("view", [
        {
          application: "skill",
          automatic: true,
          kind: "roll-modifier",
          perRank: true,
          score: 3,
          selector: "private.skill-id",
        },
        { kind: "resource" },
        { kind: "narrative" },
        { kind: "minimum-total" },
      ]),
      parent: {
        items: {
          get: (id: string) =>
            id === "private.skill-id" ? { name: longTarget } : undefined,
        },
      },
      system: {
        rank: 2,
        source: {
          book: "Campaign reference",
          module: "A Very Long Campaign Feature Library",
          page: 42,
        },
      },
    } as unknown as FoundryItemDocument;

    const presentation = distinctionItemAutomationPresentation(
      feature,
      true,
      (moduleId) =>
        moduleId === "A Very Long Campaign Feature Library"
          ? "Frontier Feature Library"
          : undefined,
    );
    expect(presentation).not.toBeNull();
    expect(
      presentation?.mechanics.map(({ disposition }) => disposition),
    ).toEqual(["automatic", "declaration", "narrative-only", "stored-only"]);
    expect(presentation?.mechanics[0]).toMatchObject({
      application: "skill",
      perRank: true,
      scopeLabel: longTarget,
      score: 3,
    });
    expect(presentation?.provenanceLabel).toBe("Frontier Feature Library");
    expect(presentation?.source).toEqual({
      book: "Campaign reference",
      page: 42,
    });
    const serialized = JSON.stringify(presentation);
    expect(serialized).not.toContain("private.skill-id");
    expect(serialized).not.toContain("world.view");
    expect(serialized).not.toContain("A Very Long Campaign Feature Library");
  });

  it("preserves imported page-zero source text and resolves provider IDs to human labels", () => {
    const feature = item("imported", [{ kind: "narrative" }], {
      source: {
        book: "Imported Skill Tree",
        module: "skill-tree",
        page: 0,
      },
    }) as unknown as FoundryItemDocument;

    const presentation = distinctionItemAutomationPresentation(
      feature,
      true,
      (moduleId) =>
        moduleId === "skill-tree" ? "Skill Tree Importer" : undefined,
    );

    expect(presentation?.source).toEqual({ book: "Imported Skill Tree" });
    expect(presentation?.provenanceLabel).toBe("Skill Tree Importer");
    expect(presentation?.providerUnavailable).toBe(false);
    expect(JSON.stringify(presentation)).not.toContain("skill-tree");
    expect(distinctionItemAutomationPresentation(feature, true)).toMatchObject({
      providerUnavailable: true,
    });
  });

  it("preserves first-party human source copy while resolving or hiding true provider IDs", () => {
    const itemSource = featureDefinitionItemSource(
      {
        catalog: {
          id: "d6e2.features",
          ownerId: "d6-system-2e",
          version: 1,
        },
        definition: {
          id: "d6e2.feature.steady",
          kind: "talent",
          label: "Steady",
          mechanics: [{ kind: "narrative" }],
          repeatable: false,
        },
      } as never,
      {
        creationSkillCostScore: 3,
        focus: "",
        rank: 1,
        source: { book: "D6 System", page: 0 },
      } as never,
    );
    const system = itemSource.system as Record<string, unknown>;
    const flags = itemSource.flags as Record<string, unknown>;
    const feature = {
      ...item("first-party", [{ kind: "narrative" }]),
      flags,
      name: itemSource.name as string,
      system,
      type: itemSource.type as string,
      getFlag: (_namespace: string, key: string) =>
        key === "featureDefinition"
          ? (flags["d6-system-2e"] as Record<string, unknown>).featureDefinition
          : undefined,
    } as unknown as FoundryItemDocument;

    expect(system.source).toMatchObject({
      module: "Perks, Flaws & Talents",
    });
    expect(distinctionItemAutomationPresentation(feature, true)).toMatchObject({
      provenanceLabel: "Perks, Flaws & Talents",
      providerUnavailable: false,
    });

    const missingProvider = item("missing-provider", [{ kind: "narrative" }], {
      source: { book: "Imported", module: "missing-provider", page: 4 },
    }) as unknown as FoundryItemDocument;
    const missingPresentation = distinctionItemAutomationPresentation(
      missingProvider,
      true,
    );
    expect(missingPresentation).toMatchObject({ providerUnavailable: true });
    expect(JSON.stringify(missingPresentation)).not.toContain(
      "missing-provider",
    );
  });

  it("builds collision-safe status IDs from an ApplicationV2 instance scope and render positions", () => {
    expect(distinctionAutomationStatusId("sheet-alpha", 0, 0)).toBe(
      "d6e2-distinction-status-sheet-alpha-0-0",
    );
    expect(distinctionAutomationStatusId("sheet-alpha", 0, 1)).not.toBe(
      distinctionAutomationStatusId("sheet-beta", 0, 1),
    );
    expect(distinctionAutomationStatusId("sheet-alpha", 0, 0)).not.toContain(
      "item.id",
    );
  });

  it.each(["talent", "perk", "flaw"])(
    "presents typed mechanics for native %s Items",
    (type) => {
      const feature = {
        ...item(type, [{ kind: "narrative" }]),
        type,
      } as unknown as FoundryItemDocument;
      expect(
        distinctionItemAutomationPresentation(feature, true)?.mechanics,
      ).toHaveLength(1);
    },
  );
});
