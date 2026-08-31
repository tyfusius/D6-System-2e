import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  healthTrackStorageKey,
  type D6MvTraumaLevel,
} from "@d6-system-2e/core";

const health = vi.hoisted(() => ({ stateId: "wounded" }));

vi.mock("./health-runtime", () => ({
  readActorHealth: () => ({ track: { currentStateId: health.stateId } }),
  setActorHealthTrack: vi.fn((_actor: unknown, stateId: string) => {
    health.stateId = stateId;
    return Promise.resolve();
  }),
}));
vi.mock("./combat-service", () => ({ readCombatantRound: () => null }));
vi.mock("../settings/pip-rules", () => ({
  currentEffectivePipScore: (value: number) => value,
}));

import {
  applyD6MvFatigue,
  applyD6MvTrauma,
  D6MV_CONDITION_STATE_KEY,
  d6MvActorPenaltyScore,
  d6MvTraumaOptions,
  readD6MvConditionState,
  recoverD6MvInjury,
  recoverD6MvTrauma,
  resolveD6MvMentalAttack,
  resolveD6MvMortalityCheck,
} from "./d6mv-condition-service";

Handlebars.registerHelper("localize", (key: string) => key);

const combatTemplate = Handlebars.compile(
  readFileSync("templates/actor/character/combat.hbs", "utf8"),
);

function normalizeFoundryObjectField(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    const path = key.split(".");
    let target = normalized;
    for (const segment of path.slice(0, -1)) {
      const next: Record<string, unknown> = {};
      target[segment] = next;
      target = next;
    }
    target[path.at(-1) ?? key] = entry;
  }
  return normalized;
}

describe("D6MV independent condition state", () => {
  let actor: {
    isOwner: boolean;
    system: {
      attributes: { charm: { score: number } };
      health: { tracks: Record<string, unknown> };
    };
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    health.stateId = "wounded";
    vi.stubGlobal("game", { user: { isGM: true } });
    actor = {
      isOwner: true,
      system: {
        attributes: { charm: { score: 9 } },
        health: { tracks: {} },
      },
      update: vi.fn((changes: Record<string, unknown>) => {
        actor.system.health.tracks = normalizeFoundryObjectField(
          changes["system.health.tracks"] as Record<string, unknown>,
        );
        return Promise.resolve();
      }),
    };
  });

  it("persists condition channels through Foundry dotted-key normalization without replacing other health tracks", async () => {
    const existingKey = healthTrackStorageKey("world.health.track");
    actor.system.health.tracks[existingKey] = { stateId: "wounded" };

    await applyD6MvTrauma(actor as never, "shaken");
    expect(readD6MvConditionState(actor as never).trauma).toBe("shaken");
    await applyD6MvFatigue(actor as never, 12);

    expect(D6MV_CONDITION_STATE_KEY).toBe(
      healthTrackStorageKey("d6mv.conditions.v1"),
    );
    expect(actor.system.health.tracks[D6MV_CONDITION_STATE_KEY]).toMatchObject({
      fatigueLevel: 1,
      trauma: "shaken",
    });
    expect(actor.system.health.tracks[existingKey]).toEqual({
      stateId: "wounded",
    });
  });

  it("reads the nested shape produced by the rejected dotted key without rewriting it", () => {
    actor.system.health.tracks = {
      d6mv: {
        conditions: {
          v1: {
            fatigueLevel: 2,
            trauma: "traumatized",
            version: 1,
          },
        },
      },
    };

    expect(readD6MvConditionState(actor as never)).toMatchObject({
      fatigueLevel: 2,
      trauma: "traumatized",
      version: 1,
    });
    expect(actor.update).not.toHaveBeenCalled();
  });

  it("normalizes missing state without writing and stacks injury, trauma, and Fatigue penalties", async () => {
    expect(readD6MvConditionState(actor as never)).toMatchObject({
      fatigueLevel: 0,
      trauma: "none",
      version: 1,
    });
    expect(actor.update).not.toHaveBeenCalled();
    await applyD6MvTrauma(actor as never, "shaken");
    await applyD6MvFatigue(actor as never, 12);
    expect(d6MvActorPenaltyScore(actor as never)).toBe(9);
    expect(actor.system.health.tracks[D6MV_CONDITION_STATE_KEY]).toMatchObject({
      fatigueLevel: 1,
      trauma: "shaken",
    });
  });

  it("keeps physical and mental recovery independent", async () => {
    await applyD6MvTrauma(actor as never, "traumatized");
    expect(await recoverD6MvTrauma(actor as never, 14)).toBe(false);
    expect(await recoverD6MvTrauma(actor as never, 15)).toBe(true);
    expect(health.stateId).toBe("wounded");
    expect(
      await recoverD6MvInjury(actor as never, 10, { dayId: "day-1" }),
    ).toBe(true);
    expect(health.stateId).toBe("healthy");
  });

  it("records a mental attack only in the trauma channel", async () => {
    expect(await resolveD6MvMentalAttack(actor as never, 18, 9)).toBe("shaken");
    expect(readD6MvConditionState(actor as never).trauma).toBe("shaken");
    expect(health.stateId).toBe("wounded");
  });

  it.each<D6MvTraumaLevel>([
    "none",
    "stunned",
    "shaken",
    "traumatized",
    "severely-traumatized",
  ])("renders exactly the persisted %s trauma state as selected", (state) => {
    const options = d6MvTraumaOptions(state).map((option) => ({
      ...option,
      label: option.id,
    }));
    expect(options.filter((option) => option.selected)).toEqual([
      expect.objectContaining({ id: state }),
    ]);
    const html = combatTemplate({
      combat: {
        d6mvConditions: {
          canSetTrauma: true,
          traumaOptions: options,
        },
      },
    });
    const selected = [
      ...html.matchAll(/<option value="([^"]+)" selected>/g),
    ].map((match) => match[1]);
    expect(selected).toEqual([state]);
  });

  it("targets both real Character ApplicationV2 roots and their narrow containers", () => {
    const css = readFileSync("styles/d6-system-2e.css", "utf8");
    expect(css).toContain(
      ".application:is(.d6e2-character-v2, .od6s-character-v2)",
    );
    expect(css).toMatch(
      /@container d6e2-sheet \(max-width: 720px\)[\s\S]*?\.application\.d6e2-character-v2[\s\S]*?grid-template-columns: 1fr/,
    );
    expect(css).toMatch(
      /@container od6v2-sheet \(max-width: 720px\)[\s\S]*?\.application\.od6s-character-v2[\s\S]*?grid-template-columns: 1fr/,
    );
    expect(css).not.toContain(".d6e2-character-sheet .d6e2-d6mv");
  });

  it("runs one mortality transaction per round and applies the exact death boundary", async () => {
    health.stateId = "mortally-wounded";
    expect(
      await resolveD6MvMortalityCheck(actor as never, "combat:round:1", 1),
    ).toBe("survived");
    expect(
      await resolveD6MvMortalityCheck(actor as never, "combat:round:1", 1),
    ).toBeNull();
    expect(
      await resolveD6MvMortalityCheck(actor as never, "combat:round:2", 1),
    ).toBe("dead");
    expect(health.stateId).toBe("dead");
  });
});
