import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveFirstEditionAssistedHealing,
  resolveFirstEditionEndOfRoundMortality,
  resolveFirstEditionMortalityCheck,
  resolveFirstEditionNaturalHealing,
} from "./first-edition-healing-service";

const healingMocks = vi.hoisted(() => ({
  automaticRoll: vi.fn(),
  healPool: vi.fn(),
  readHealth: vi.fn(),
  roll: vi.fn(),
  setPool: vi.fn(),
  setWound: vi.fn(),
}));

vi.mock("./health-runtime", () => ({
  actorHealthResolutionStrategy: (source: FoundryActorDocument) => {
    const projection: unknown = healingMocks.readHealth(source);
    const strategyId =
      typeof projection === "object" &&
      projection !== null &&
      "damageStrategyId" in projection
        ? projection.damageStrategyId
        : "";
    return strategyId === "open-d6.damage.wounds"
      ? { family: "wounds" }
      : { family: "body-points" };
  },
  healActorHealthPool: healingMocks.healPool,
  readActorHealth: healingMocks.readHealth,
  setActorHealthPool: healingMocks.setPool,
  setActorHealthTrack: healingMocks.setWound,
}));

vi.mock("./rolls/roll-service", () => ({
  rollFirstEditionAutomatedMortalityCheck: healingMocks.automaticRoll,
  rollFirstEditionHealingCheck: healingMocks.roll,
}));

function actor(wound: string, name = "Patient") {
  const updates: Record<string, unknown>[] = [];
  return {
    id: name,
    isOwner: true,
    name,
    system: {
      attributes: { brawn: { score: 9 } },
      health: {
        firstEditionState: { mortalityCheckId: "", mortalityRounds: 0 },
        firstEditionWound: wound,
      },
    },
    update: (changes: Record<string, unknown>) => {
      updates.push(changes);
      return Promise.resolve();
    },
    updates,
  } as unknown as FoundryActorDocument;
}

beforeEach(() => {
  healingMocks.roll.mockReset();
  healingMocks.automaticRoll.mockReset();
  healingMocks.healPool.mockReset();
  healingMocks.readHealth
    .mockReset()
    .mockImplementation((source: FoundryActorDocument) => {
      const health = source.system.health as { firstEditionWound: string };
      return {
        contractVersion: 1,
        damageStrategyId: "open-d6.damage.wounds",
        kind: "track",
        modelId: "open-d6.health.wound-track",
        track: {
          currentState: {
            id: health.firstEditionWound,
            label: health.firstEditionWound,
            penaltyScore: 0,
          },
          currentStateId: health.firstEditionWound,
          states: [],
        },
      };
    });
  healingMocks.setWound.mockReset().mockResolvedValue(undefined);
  healingMocks.setPool.mockReset();
  vi.stubGlobal("game", {
    i18n: {
      format: (key: string) => key,
      localize: (key: string) => key,
    },
  });
});

describe("First Edition healing adapter", () => {
  it("recovers Stunned automatically after the confirmed rest period", async () => {
    const patient = actor("stunned");
    await expect(
      resolveFirstEditionNaturalHealing(patient),
    ).resolves.toMatchObject({
      nextWound: "healthy",
      outcome: "automatic",
    });
    expect(healingMocks.roll).not.toHaveBeenCalled();
    expect(healingMocks.setWound).toHaveBeenCalledWith(patient, "healthy");
  });

  it("applies natural-healing Critical Failures to the patient", async () => {
    const patient = actor("severely-wounded");
    healingMocks.roll.mockResolvedValue({
      total: 20,
      wildOutcome: "complication",
    });
    await resolveFirstEditionNaturalHealing(patient);
    expect(healingMocks.setWound).toHaveBeenCalledWith(
      patient,
      "incapacitated",
    );
  });

  it("rolls the selected healer's Medicine at the printed difficulty", async () => {
    const patient = actor("wounded");
    const healer = actor("healthy", "Medic");
    healingMocks.roll.mockResolvedValue({ total: 15, wildOutcome: "normal" });
    await resolveFirstEditionAssistedHealing(patient, healer, "medicine-id");
    expect(healingMocks.roll).toHaveBeenCalledWith(
      healer,
      "D6E2.Combat.FirstEdition.Healing.MedicineCheck",
      15,
      "medicine-id",
    );
    expect(healingMocks.setWound).toHaveBeenCalledWith(patient, "stunned");
  });

  it("marks a failed elapsed-minute mortality check Dead", async () => {
    const patient = actor("mortally-wounded");
    healingMocks.roll.mockResolvedValue({ total: 3, wildOutcome: "normal" });
    await expect(resolveFirstEditionMortalityCheck(patient, 4)).resolves.toBe(
      "dead",
    );
    expect(healingMocks.setWound).toHaveBeenCalledWith(patient, "dead");
  });

  it("runs and persists one automatic mortality check per completed round", async () => {
    const patient = actor("mortally-wounded") as FoundryActorDocument & {
      updates: Record<string, unknown>[];
    };
    healingMocks.automaticRoll.mockResolvedValue({ total: 0 });
    await expect(
      resolveFirstEditionEndOfRoundMortality(patient, "combat-1:round:1"),
    ).resolves.toMatchObject({
      completedRounds: 1,
      elapsedMinutes: 0,
      outcome: "survived",
      total: 0,
    });
    expect(healingMocks.automaticRoll).toHaveBeenCalledWith(
      patient,
      "D6E2.Combat.FirstEdition.Mortality.AutomaticCheck",
      0,
      {
        checkId: "combat-1:round:1",
        completedRounds: 1,
        elapsedMinutes: 0,
        sourcePage: 76,
      },
    );
    expect(patient.updates).toEqual([
      {
        "system.health.firstEditionWound": "mortally-wounded",
        "system.health.firstEditionState.mortalityCheckId": "combat-1:round:1",
        "system.health.firstEditionState.mortalityRounds": 1,
      },
    ]);
  });

  it("skips duplicate round checks and marks a failed later check Dead", async () => {
    const patient = actor("mortally-wounded");
    patient.system.health = {
      firstEditionState: {
        mortalityCheckId: "combat-1:round:11",
        mortalityRounds: 11,
      },
      firstEditionWound: "mortally-wounded",
    };
    await expect(
      resolveFirstEditionEndOfRoundMortality(patient, "combat-1:round:11"),
    ).resolves.toBeNull();
    healingMocks.automaticRoll.mockResolvedValue({ total: 0 });
    await expect(
      resolveFirstEditionEndOfRoundMortality(patient, "combat-1:round:12"),
    ).resolves.toMatchObject({
      completedRounds: 12,
      elapsedMinutes: 1,
      outcome: "dead",
    });
    expect(healingMocks.setWound).toHaveBeenCalledWith(patient, "dead");
  });
});
