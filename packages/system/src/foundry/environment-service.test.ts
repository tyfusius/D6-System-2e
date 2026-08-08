import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  aidEnvironmentRecovery,
  exposeActorToEnvironment,
  recoverEnvironmentAfterSafeDay,
} from "./environment-service";

const mocks = vi.hoisted(() => ({
  actorGet: vi.fn(),
  capability: vi.fn(),
  chatCreate: vi.fn(),
  condition: vi.fn(),
  exposureRoll: vi.fn(),
  aidRoll: vi.fn(),
}));

vi.mock("../settings/optional-capabilities", () => ({
  currentOptionalCapabilityRuntime: mocks.capability,
}));
vi.mock("./health-runtime", () => ({
  readActorHealth: (actor: FoundryActorDocument) => ({
    track: {
      currentStateId: (actor.system.health as { condition: string }).condition,
    },
  }),
  setActorHealthTrack: mocks.condition,
}));
vi.mock("./rolls/roll-service", () => ({
  rollSecondEditionEnvironmentAid: mocks.aidRoll,
  rollSecondEditionEnvironmentExposure: mocks.exposureRoll,
}));

function actor(
  id: string,
  condition = "healthy",
  environment: Record<string, unknown> = { active: false },
) {
  const updates: Record<string, unknown>[] = [];
  return {
    document: {
      id,
      items: { contents: [], get: vi.fn() },
      name: id,
      system: {
        attributes: { brawn: { score: 6 } },
        environment,
        health: { condition },
      },
      type: "character",
      update: vi.fn((changes: Record<string, unknown>) => {
        updates.push(changes);
        return Promise.resolve();
      }),
    } as unknown as FoundryActorDocument,
    updates,
  };
}

beforeEach(() => {
  mocks.capability.mockReset().mockReturnValue({
    environments: { state: "active" },
  });
  mocks.condition.mockReset().mockResolvedValue(undefined);
  mocks.actorGet.mockReset();
  mocks.chatCreate.mockReset();
  mocks.exposureRoll.mockReset();
  mocks.aidRoll.mockReset();
  vi.stubGlobal("Hooks", { callAll: vi.fn() });
  vi.stubGlobal("ChatMessage", {
    create: mocks.chatCreate,
    getSpeaker: vi.fn(() => ({ alias: "actor" })),
  });
  vi.stubGlobal("foundry", {
    applications: {
      handlebars: {
        renderTemplate: vi.fn(() => Promise.resolve("<p>recovered</p>")),
      },
    },
  });
  vi.stubGlobal("game", {
    actors: { get: mocks.actorGet },
    i18n: { localize: (key: string) => key },
    user: { isGM: true },
  });
});

describe("Second Edition environment service", () => {
  it("persists a failed severe exposure for subsequent roll and condition effects", async () => {
    const subject = actor("target");
    mocks.actorGet.mockReturnValue(subject.document);
    mocks.exposureRoll.mockResolvedValue({ success: false });

    await expect(
      exposeActorToEnvironment({
        actorId: "target",
        hazard: "cold",
        severity: "severe",
      }),
    ).resolves.toBe(true);

    expect(subject.updates[0]).toMatchObject({
      "system.environment.active": true,
      "system.environment.difficulty": 20,
      "system.environment.halfMove": false,
      "system.environment.penaltyScore": 6,
      "system.environment.sourcePage": 77,
    });
    expect(mocks.condition).not.toHaveBeenCalled();
  });

  it("does not persist a successful resistance check", async () => {
    const subject = actor("target");
    mocks.actorGet.mockReturnValue(subject.document);
    mocks.exposureRoll.mockResolvedValue({ success: true });
    await expect(
      exposeActorToEnvironment({
        actorId: "target",
        hazard: "heat",
        severity: "moderate",
      }),
    ).resolves.toBe(false);
    expect(subject.updates).toEqual([]);
    expect(mocks.condition).not.toHaveBeenCalled();
  });

  it("clears a safe-day effect without overwriting a later condition", async () => {
    const effect = {
      active: true,
      appliedCondition: "wounded",
      difficulty: 20,
      halfMove: true,
      hazard: "cold",
      penaltyScore: 6,
      previousCondition: "healthy",
      severity: "severe",
      sourcePage: 77,
      version: 1,
    };
    const subject = actor("target", "incapacitated", effect);
    mocks.actorGet.mockReturnValue(subject.document);
    await recoverEnvironmentAfterSafeDay("target");
    expect(subject.updates[0]).toMatchObject({
      "system.environment.active": false,
      "system.environment.penaltyScore": 0,
    });
    expect(subject.updates[0]).not.toHaveProperty("system.health.condition");
    expect(mocks.chatCreate).toHaveBeenCalledOnce();
  });

  it("uses the original resistance difficulty and recovers after successful aid", async () => {
    const effect = {
      active: true,
      appliedCondition: "wounded",
      difficulty: 20,
      halfMove: true,
      hazard: "cold",
      penaltyScore: 6,
      previousCondition: "healthy",
      severity: "severe",
      sourcePage: 77,
      version: 1,
    };
    const target = actor("target", "wounded", effect);
    const helper = actor("helper");
    mocks.actorGet.mockImplementation((id: string) =>
      id === "target" ? target.document : helper.document,
    );
    mocks.aidRoll.mockResolvedValue({ success: true });

    await expect(
      aidEnvironmentRecovery("target", "helper", "skill-1"),
    ).resolves.toBe(true);
    expect(mocks.aidRoll).toHaveBeenCalledWith(
      helper.document,
      "skill-1",
      target.document,
      expect.objectContaining({ difficulty: 20 }),
    );
    expect(mocks.condition).toHaveBeenCalledWith(target.document, "healthy");
    expect(target.updates[0]).toMatchObject({
      "system.environment.active": false,
    });
  });

  it("requires GM authority", async () => {
    vi.stubGlobal("game", { ...game, user: { isGM: false } });
    await expect(recoverEnvironmentAfterSafeDay("target")).rejects.toThrow(
      "D6E2.Environment.Error.GmOnly",
    );
  });
});
