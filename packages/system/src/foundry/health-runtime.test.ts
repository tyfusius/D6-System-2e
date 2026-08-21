import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyActorHealthDamageOutcome,
  actorHealthResolutionStrategy,
  damageActorHealthPool,
  healActorHealthPool,
  readActorHealth,
  recoverActorRoundStartHealth,
  setActorHealthPool,
  setActorHealthTrack,
} from "./health-runtime";

const values = new Map<string, unknown>();

vi.stubGlobal("game", {
  i18n: { localize: (key: string) => key },
  settings: {
    get: (_system: string, key: string) => values.get(key),
    set: (_system: string, key: string, value: unknown) => {
      values.set(key, value);
      return Promise.resolve(value);
    },
  },
});
vi.stubGlobal("Hooks", { callAll: vi.fn() });

function setPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
) {
  const parts = path.split(".");
  let current = target;
  for (const part of parts.slice(0, -1)) {
    const next = current[part];
    if (typeof next === "object" && next !== null) {
      current = next as Record<string, unknown>;
    } else {
      const created: Record<string, unknown> = {};
      current[part] = created;
      current = created;
    }
  }
  current[parts.at(-1) ?? ""] = value;
}

function actor() {
  const document = {
    id: "actor-1",
    isOwner: true,
    system: {
      health: {
        condition: "healthy",
        firstEditionBodyPoints: { current: 20, maximum: 20 },
        firstEditionState: {},
        firstEditionWound: "healthy",
        tracks: {},
      },
      movement: { posture: "standing" },
    },
    type: "character",
    update: vi.fn((changes: Record<string, unknown>) => {
      for (const [path, value] of Object.entries(changes))
        setPath(document, path, value);
      return Promise.resolve(document);
    }),
  };
  return document as unknown as FoundryActorDocument;
}

function selectProfile(id: "open-d6" | "second-edition") {
  values.set("worldRulesProfiles", {
    activeProfileId: id,
    profiles: {},
    version: 1,
  });
  values.set("gameMode", id);
}

describe("neutral Actor health runtime", () => {
  beforeEach(() => {
    values.clear();
    selectProfile("second-edition");
  });

  it("projects and commands the active Second Edition track", async () => {
    const subject = actor();
    expect(readActorHealth(subject)).toMatchObject({
      contractVersion: 2,
      damageStrategyId: "d6e2.damage.conditions",
      kind: "track",
      modelId: "d6e2.health.condition-track",
      track: { currentStateId: "healthy" },
    });
    const result = await setActorHealthTrack(subject, "wounded");
    expect(result.previous.track?.currentStateId).toBe("healthy");
    expect(result.current.track?.currentStateId).toBe("wounded");
    expect(result.prevented).toBe(false);
    expect((subject.system.health as Record<string, unknown>).tracks).toEqual({
      "d6e2%2Ehealth%2Econdition-track": { stateId: "wounded" },
    });
    expect(actorHealthResolutionStrategy(subject)).toEqual({
      family: "conditions",
      id: "d6e2.damage.conditions",
      lifecycle: {
        accumulatingStuns: "none",
        mortality: "none",
        roundStartRecovery: "d6e2.transient-conditions",
      },
      resistance: "brawn-and-armor",
      trackEditable: true,
    });
  });

  it("projects and commands the active Open D6 Wound track", async () => {
    selectProfile("open-d6");
    values.set("firstEditionBodyPoints", false);
    const subject = actor();
    expect(readActorHealth(subject)).toMatchObject({
      damageStrategyId: "open-d6.damage.wounds",
      kind: "track",
      modelId: "open-d6.health.wound-track",
    });
    expect(actorHealthResolutionStrategy(subject).lifecycle).toEqual({
      accumulatingStuns: "open-d6.optional-accumulating-stuns",
      mortality: "open-d6.elapsed-rounds",
      roundStartRecovery: "none",
    });
    const result = await setActorHealthTrack(subject, "severely-wounded");
    expect(result.current.track?.currentStateId).toBe("severely-wounded");
    expect((subject.system.health as Record<string, unknown>).tracks).toEqual({
      "open-d6%2Ehealth%2Ewound-track": { stateId: "severely-wounded" },
    });
  });

  it("uses one pool projection for set, damage, and healing commands", async () => {
    selectProfile("open-d6");
    values.set("firstEditionBodyPoints", "body-points");
    const subject = actor();
    expect(readActorHealth(subject)).toMatchObject({
      kind: "pool",
      pool: { current: 20, maximum: 20 },
    });
    await setActorHealthPool(subject, { current: 18, maximum: 20 });
    const damaged = await damageActorHealthPool(subject, 5);
    expect(damaged.current.pool).toEqual({ current: 13, maximum: 20 });
    const healed = await healActorHealthPool(subject, 3);
    expect(healed.current.pool).toEqual({ current: 16, maximum: 20 });
    expect(actorHealthResolutionStrategy(subject)).toMatchObject({
      family: "body-points",
      lifecycle: {
        accumulatingStuns: "open-d6.optional-accumulating-stuns",
        mortality: "open-d6.elapsed-rounds",
        roundStartRecovery: "none",
      },
      resistance: "armor-only",
      woundDerivation: false,
    });
  });

  it("derives hybrid track state from its pool and rejects direct track writes", async () => {
    selectProfile("open-d6");
    values.set("firstEditionBodyPoints", "body-points-with-wounds");
    const subject = actor();
    await setActorHealthPool(subject, { current: 4, maximum: 20 });
    const projection = readActorHealth(subject);
    expect(projection).toMatchObject({
      kind: "hybrid",
      pool: { current: 4, maximum: 20 },
      track: { currentStateId: "severely-wounded" },
    });
    expect(actorHealthResolutionStrategy(subject)).toMatchObject({
      family: "body-points",
      woundDerivation: true,
    });
    await expect(setActorHealthTrack(subject, "healthy")).rejects.toThrow(
      "D6E2.Health.DerivedTrackReadOnly",
    );
  });

  it("restores independent model state across A to B to A switches", async () => {
    const outcomes = [
      "staggered",
      "stunned",
      "wounded",
      "mortally-wounded",
      "dead",
    ];
    const row = (target: string) =>
      Object.fromEntries(outcomes.map((outcome) => [outcome, target]));
    values.set("worldRulesProfiles", {
      activeProfileId: "profile-a",
      profiles: {
        "profile-a": {
          id: "profile-a",
          label: "A",
          source: { kind: "world" },
          strategies: { health: "profile-a.health.grit" },
          healthModels: [
            {
              damageStrategyId: "d6e2.damage.conditions",
              id: "profile-a.health.grit",
              kind: "track",
              label: "Grit",
              track: {
                damageTransitions: { ready: row("down"), down: row("down") },
                initialStateId: "ready",
                states: [
                  {
                    allowsActions: true,
                    id: "ready",
                    label: "Ready",
                    penaltyScore: 0,
                    terminal: false,
                  },
                  {
                    allowsActions: false,
                    id: "down",
                    label: "Down",
                    penaltyScore: 6,
                    terminal: true,
                  },
                ],
              },
            },
          ],
        },
        "profile-b": {
          id: "profile-b",
          label: "B",
          source: { kind: "world" },
          strategies: { health: "open-d6.health.wound-track" },
        },
      },
      version: 3,
    });
    const subject = actor();
    await setActorHealthTrack(subject, "down");
    (
      values.get("worldRulesProfiles") as { activeProfileId: string }
    ).activeProfileId = "profile-b";
    await setActorHealthTrack(subject, "severely-wounded");
    (
      values.get("worldRulesProfiles") as { activeProfileId: string }
    ).activeProfileId = "profile-a";
    expect(readActorHealth(subject).track?.currentStateId).toBe("down");
    expect((subject.system.health as Record<string, unknown>).tracks).toEqual({
      "profile-a%2Ehealth%2Egrit": { stateId: "down" },
      "open-d6%2Ehealth%2Ewound-track": { stateId: "severely-wounded" },
    });
  });

  it("uses a safe fallback for a missing active model without overwriting its orphan", () => {
    values.set("worldRulesProfiles", {
      activeProfileId: "missing-model",
      profiles: {
        "missing-model": {
          id: "missing-model",
          label: "Missing",
          source: { kind: "world" },
          strategies: { health: "module.health.absent" },
        },
      },
      version: 3,
    });
    const subject = actor();
    (subject.system.health as Record<string, unknown>).tracks = {
      "module.health.absent": { stateId: "hurt" },
    };
    expect(readActorHealth(subject)).toMatchObject({
      modelId: "d6e2.health.condition-track",
      track: { currentStateId: "healthy" },
    });
    expect((subject.system.health as Record<string, unknown>).tracks).toEqual({
      "module.health.absent": { stateId: "hurt" },
    });
  });

  it("applies the active model damage table and optional round-start transition", async () => {
    const outcomes = [
      "staggered",
      "stunned",
      "wounded",
      "mortally-wounded",
      "dead",
    ];
    const row = (target: string) =>
      Object.fromEntries(outcomes.map((outcome) => [outcome, target]));
    values.set("worldRulesProfiles", {
      activeProfileId: "grit-rules",
      profiles: {
        "grit-rules": {
          healthModels: [
            {
              damageStrategyId: "d6e2.damage.conditions",
              id: "grit-rules.health.grit",
              kind: "track",
              label: "Grit",
              track: {
                damageTransitions: {
                  down: row("down"),
                  ready: { ...row("down"), staggered: "shaken" },
                  shaken: row("down"),
                },
                initialStateId: "ready",
                states: [
                  {
                    allowsActions: true,
                    id: "ready",
                    label: "Ready",
                    penaltyScore: 0,
                    terminal: false,
                  },
                  {
                    allowsActions: true,
                    id: "shaken",
                    label: "Shaken",
                    penaltyScore: 2,
                    roundStartStateId: "ready",
                    terminal: false,
                  },
                  {
                    allowsActions: false,
                    id: "down",
                    label: "Down",
                    penaltyScore: 6,
                    terminal: true,
                  },
                ],
              },
            },
          ],
          id: "grit-rules",
          label: "Grit Rules",
          source: { kind: "world" },
          strategies: { health: "grit-rules.health.grit" },
        },
      },
      version: 3,
    });
    const subject = actor();
    const applied = await applyActorHealthDamageOutcome(subject, "staggered");
    expect(applied.current.track?.currentStateId).toBe("shaken");
    expect(await recoverActorRoundStartHealth(subject)).toBe(true);
    expect(readActorHealth(subject).track?.currentStateId).toBe("ready");
  });

  it("keeps canonical round-start recovery mirrored in legacy and per-model state", async () => {
    const subject = actor();
    await setActorHealthTrack(subject, "stunned");
    expect(await recoverActorRoundStartHealth(subject)).toBe(true);
    expect((subject.system.health as Record<string, unknown>).condition).toBe(
      "healthy",
    );
    expect((subject.system.health as Record<string, unknown>).tracks).toEqual({
      "d6e2%2Ehealth%2Econdition-track": { stateId: "healthy" },
    });
  });
});
