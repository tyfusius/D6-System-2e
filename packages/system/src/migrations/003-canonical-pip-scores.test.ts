import type { ActorSource, ItemSource } from "@d6-system-2e/core";
import { describe, expect, it } from "vitest";
import { canonicalPipScoresMigration } from "./003-canonical-pip-scores";

describe("schema 3 canonical pip-score migration", () => {
  it("converts attribute dice and pips to one integer score", async () => {
    const source: ActorSource = {
      items: [],
      system: {
        attributes: {
          agility: { dice: 3, pips: 1, retained: "yes" },
          brawn: { score: 8 },
        },
      },
      type: "character",
    };

    await canonicalPipScoresMigration.updateActor?.(source);

    expect(source.system.attributes).toEqual({
      agility: { score: 10, retained: "yes" },
      brawn: { score: 8 },
    });
  });

  it("converts skill increases and preserves unknown rating data", async () => {
    const source: ItemSource = {
      system: {
        rating: { dice: 2, pips: 2, campaignNote: "retained" },
      },
      type: "skill",
    };

    await canonicalPipScoresMigration.updateItem?.(source);

    expect(source.system).toEqual({
      rating: { campaignNote: "retained" },
      score: 8,
    });
  });

  it("is idempotent and does not overwrite canonical scores", async () => {
    const source: ItemSource = {
      system: { rating: { dice: 9, pips: 2 }, score: 4 },
      type: "skill",
    };

    await canonicalPipScoresMigration.updateItem?.(source);
    await canonicalPipScoresMigration.updateItem?.(source);

    expect(source.system.score).toBe(4);
    expect(source.system.rating).toEqual({ dice: 9, pips: 2 });
  });

  it("preserves malformed legacy values for a reportable later decision", async () => {
    const source: ActorSource = {
      items: [],
      system: {
        attributes: { agility: { dice: "three", pips: 1 } },
      },
      type: "character",
    };

    await canonicalPipScoresMigration.updateActor?.(source);

    expect(source.system.attributes).toEqual({
      agility: { dice: "three", pips: 1 },
    });
  });
});
