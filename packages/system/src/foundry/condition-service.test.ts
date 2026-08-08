import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  recoverActorRoundStartCondition,
  setActorCondition,
  setActorFirstEditionWound,
  setActorPosture,
  spendActorHeroPoint,
} from "./condition-service";

const settings = new Map<string, unknown>();

beforeEach(() => {
  settings.clear();
  vi.stubGlobal("game", {
    settings: {
      get: (_namespace: string, key: string) => settings.get(key) ?? false,
    },
  });
});

function selectOpenD6Wounds(): void {
  settings.set("worldRulesProfiles", {
    activeProfileId: "open-d6",
    profiles: {},
    version: 1,
  });
  settings.set("gameMode", "open-d6");
  settings.set("firstEditionBodyPoints", "wounds");
}

function actor(condition: string, heroPoints: number) {
  const updates: Record<string, unknown>[] = [];
  const document = {
    id: "actor-1",
    isOwner: true,
    type: "character",
    system: {
      environment: {
        active: false,
      } as Record<string, unknown>,
      health: { condition, firstEditionWound: "healthy" },
      movement: { posture: "standing" },
      resources: { heroPoints: { value: heroPoints } },
    },
    update: (changes: Record<string, unknown>) => {
      updates.push(changes);
      return Promise.resolve();
    },
  };
  return {
    document,
    updates,
  };
}

describe("Second Edition condition command", () => {
  it("spends one Hero Point for a Killing Blow survival choice", async () => {
    const subject = actor("healthy", 2);
    await expect(spendActorHeroPoint(subject.document)).resolves.toBe(1);
    expect(subject.updates).toEqual([
      { "system.resources.heroPoints.value": 1 },
    ]);
  });
  it("spends one Hero Point and retains the prior condition when preventing Stunned", async () => {
    const subject = actor("staggered", 2);
    await expect(
      setActorCondition(subject.document, "stunned", {
        preventStunnedWithHeroPoint: true,
      }),
    ).resolves.toEqual({
      current: "staggered",
      heroPointSpent: 1,
      previous: "staggered",
      prevented: true,
    });
    expect(subject.updates).toEqual([
      { "system.resources.heroPoints.value": 1 },
    ]);
  });

  it("applies machine conditions without creating personal posture data", async () => {
    const subject = actor("healthy", 0);
    subject.document.type = "vehicle";
    await setActorCondition(subject.document, "wounded");
    expect(subject.updates).toEqual([{ "system.health.condition": "wounded" }]);
  });

  it("applies an ordinary condition transition without spending", async () => {
    const subject = actor("healthy", 2);
    await expect(
      setActorCondition(subject.document, "wounded"),
    ).resolves.toEqual({
      current: "wounded",
      heroPointSpent: 0,
      previous: "healthy",
      prevented: false,
    });
    expect(subject.updates).toEqual([
      {
        "system.health.condition": "wounded",
        "system.movement.posture": "prone",
      },
    ]);
  });

  it("promotes Stunned to Wounded during severe cold or heat exposure", async () => {
    settings.set("secondEditionEnvironmentsModule", true);
    const subject = actor("healthy", 2);
    subject.document.system.environment = {
      active: true,
      appliedCondition: "none",
      difficulty: 20,
      halfMove: false,
      hazard: "cold",
      penaltyScore: 6,
      previousCondition: "healthy",
      severity: "severe",
      sourcePage: 77,
      version: 1,
    };
    await expect(
      setActorCondition(subject.document, "stunned", {
        preventStunnedWithHeroPoint: true,
      }),
    ).resolves.toEqual({
      current: "wounded",
      heroPointSpent: 0,
      previous: "healthy",
      prevented: false,
    });
    expect(subject.updates).toEqual([
      {
        "system.health.condition": "wounded",
        "system.movement.posture": "prone",
      },
    ]);
  });

  it("keeps a stored environment effect inert while the rules component is disabled", async () => {
    const subject = actor("healthy", 2);
    subject.document.system.environment = {
      active: true,
      appliedCondition: "none",
      difficulty: 20,
      halfMove: false,
      hazard: "heat",
      penaltyScore: 6,
      previousCondition: "healthy",
      severity: "severe",
      sourcePage: 78,
      version: 1,
    };
    await setActorCondition(subject.document, "stunned");
    expect(subject.updates).toEqual([{ "system.health.condition": "stunned" }]);
  });

  it("rejects prevention without an available Hero Point", async () => {
    const subject = actor("healthy", 0);
    await expect(
      setActorCondition(subject.document, "stunned", {
        preventStunnedWithHeroPoint: true,
      }),
    ).rejects.toThrow("The Hero Point expenditure exceeds the balance.");
    expect(subject.updates).toEqual([]);
  });

  it("persists voluntary posture changes without touching condition", async () => {
    const subject = actor("healthy", 2);
    await expect(setActorPosture(subject.document, "prone")).resolves.toEqual({
      current: "prone",
      previous: "standing",
    });
    expect(subject.updates).toEqual([{ "system.movement.posture": "prone" }]);
  });

  it("persists the independent First Edition wound and forces severe wounds prone", async () => {
    selectOpenD6Wounds();
    const subject = actor("healthy", 1);
    await expect(
      setActorFirstEditionWound(subject.document, "severely-wounded"),
    ).resolves.toEqual({ current: "severely-wounded", previous: "healthy" });
    expect(subject.updates).toEqual([
      {
        "system.health.firstEditionWound": "severely-wounded",
        "system.movement.posture": "prone",
      },
    ]);
  });

  it("marks Incapacitated consciousness unresolved and Mortally Wounded unconscious", async () => {
    selectOpenD6Wounds();
    const incapacitated = actor("healthy", 1);
    await setActorFirstEditionWound(incapacitated.document, "incapacitated");
    expect(incapacitated.updates[0]).toMatchObject({
      "system.health.firstEditionState.consciousness": "unresolved",
      "system.health.firstEditionState.source": "incapacitated",
      "system.health.firstEditionWound": "incapacitated",
    });

    const mortal = actor("healthy", 1);
    await setActorFirstEditionWound(mortal.document, "mortally-wounded");
    expect(mortal.updates[0]).toMatchObject({
      "system.health.firstEditionState.consciousness": "unconscious",
      "system.health.firstEditionState.source": "mortally-wounded",
      "system.health.firstEditionWound": "mortally-wounded",
    });
  });

  it("clears Staggered and Stunned at round start but retains Wounded", async () => {
    const stunned = actor("stunned", 1);
    const wounded = actor("wounded", 1);
    await expect(
      recoverActorRoundStartCondition(stunned.document),
    ).resolves.toBe(true);
    await expect(
      recoverActorRoundStartCondition(wounded.document),
    ).resolves.toBe(false);
    expect(stunned.updates).toEqual([{ "system.health.condition": "healthy" }]);
    expect(wounded.updates).toEqual([]);
  });
});
