import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveFirstEditionAssistedHealing,
  resolveFirstEditionBodyPointNaturalHealing,
  resolveFirstEditionBodyPointAssistedHealing,
  resolveFirstEditionEndOfRoundMortality,
  resolveFirstEditionMortalityCheck,
  resolveFirstEditionNaturalHealing,
} from "./first-edition-healing-service";

const healingMocks = vi.hoisted(() => ({
  automaticRoll: vi.fn(),
  startRoot: vi.fn(),
  rootAvailable: vi.fn(),
  healPool: vi.fn(),
  readHealth: vi.fn(),
  roll: vi.fn(),
  setPool: vi.fn(),
  setWound: vi.fn(),
}));

vi.mock("./first-edition-wound-root", () => ({
  startWoundRoot: healingMocks.startRoot,
}));
vi.mock("./first-edition-wound-authority", () => ({
  woundRootModelAvailable: healingMocks.rootAvailable,
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

describe("Wound entry point routing", () => {
  beforeEach(() => {
    healingMocks.rootAvailable.mockReturnValue(true);
    healingMocks.startRoot.mockReset().mockResolvedValue(null);
  });
  it("routes natural recovery without standalone rolls or direct health writes", async () => {
    const patient = actor("stunned");
    expect(await resolveFirstEditionNaturalHealing(patient)).toBeNull();
    expect(healingMocks.startRoot).toHaveBeenCalledWith(patient, "natural");
    expect(healingMocks.roll).not.toHaveBeenCalled();
    expect(healingMocks.setWound).not.toHaveBeenCalled();
  });
  it("binds the selected healer and embedded Medicine to the patient root", async () => {
    const patient = actor("wounded"),
      healer = actor("healthy", "Medic");
    await resolveFirstEditionAssistedHealing(patient, healer, "medicine-id");
    expect(healingMocks.startRoot).toHaveBeenCalledWith(patient, "assisted", {
      healer,
      medicineItemId: "medicine-id",
    });
    expect(healingMocks.roll).not.toHaveBeenCalled();
    expect(healingMocks.setWound).not.toHaveBeenCalled();
  });
  it("routes manual mortality without advancing the round clock", async () => {
    const patient = actor("mortally-wounded");
    await resolveFirstEditionMortalityCheck(patient, 4);
    expect(healingMocks.startRoot).toHaveBeenCalledWith(
      patient,
      "manual-mortality",
      { minutes: 4 },
    );
    expect((patient as unknown as { updates: unknown[] }).updates).toEqual([]);
  });
  it("carries the actual Combat identity for scheduled mortality", async () => {
    const patient = actor("mortally-wounded");
    await resolveFirstEditionEndOfRoundMortality(
      patient,
      "c:round:1",
      "Combat.c",
    );
    expect(healingMocks.startRoot).toHaveBeenCalledWith(
      patient,
      "round-mortality",
      { checkId: "c:round:1", combatUuid: "Combat.c" },
    );
    expect(healingMocks.automaticRoll).not.toHaveBeenCalled();
  });
  it("does not turn a root failure into a fallback roll", async () => {
    healingMocks.startRoot.mockRejectedValue(new Error("uncertain"));
    await expect(
      resolveFirstEditionNaturalHealing(actor("wounded")),
    ).rejects.toThrow("uncertain");
    expect(healingMocks.roll).not.toHaveBeenCalled();
    expect(healingMocks.setWound).not.toHaveBeenCalled();
  });
  it("does not admit unsupported models to Wound healing", async () => {
    healingMocks.rootAvailable.mockReturnValue(false);
    expect(
      await resolveFirstEditionNaturalHealing(actor("wounded")),
    ).toBeNull();
    expect(healingMocks.startRoot).not.toHaveBeenCalled();
  });
  it.each(["healthy", "dead"])(
    "keeps %s treatment admission a no-op",
    async (wound) => {
      const patient = actor(wound);
      expect(await resolveFirstEditionNaturalHealing(patient)).toBeNull();
      expect(
        await resolveFirstEditionAssistedHealing(
          patient,
          actor("healthy", "Medic"),
          "medicine",
        ),
      ).toBeNull();
      expect(healingMocks.startRoot).not.toHaveBeenCalled();
      expect(healingMocks.roll).not.toHaveBeenCalled();
    },
  );
  it("preserves the existing Body Point manual mortality path", async () => {
    const patient = actor("mortally-wounded");
    healingMocks.rootAvailable.mockReturnValue(false);
    healingMocks.readHealth.mockReturnValue({
      kind: "pool",
      damageStrategyId: "open-d6.damage.body-points",
      pool: { current: 0, maximum: 20 },
    });
    healingMocks.roll.mockResolvedValue({ total: 3 });
    expect(await resolveFirstEditionMortalityCheck(patient, 4)).toBe("dead");
    expect(healingMocks.setPool).toHaveBeenCalledWith(patient, {
      current: -20,
      maximum: 20,
    });
    expect(healingMocks.startRoot).not.toHaveBeenCalled();
  });
  it("preserves the existing Body Point scheduled mortality path", async () => {
    const patient = actor("mortally-wounded");
    healingMocks.rootAvailable.mockReturnValue(false);
    healingMocks.readHealth.mockReturnValue({
      kind: "pool",
      damageStrategyId: "open-d6.damage.body-points",
      pool: { current: 0, maximum: 20 },
    });
    healingMocks.automaticRoll.mockResolvedValue({ total: 0 });
    expect(
      await resolveFirstEditionEndOfRoundMortality(
        patient,
        "combat:round:1",
        "Combat.combat",
      ),
    ).toMatchObject({
      completedRounds: 1,
      elapsedMinutes: 0,
      outcome: "survived",
    });
    expect(healingMocks.startRoot).not.toHaveBeenCalled();
    expect(healingMocks.setWound).not.toHaveBeenCalled();
  });
});

describe("Body Point treatment and mortality entry guards", () => {
  it.each([
    "open-d6.damage.body-points",
    "open-d6.damage.body-points-with-wounds",
  ])(
    "rejects Dead through both public treatment services for %s",
    async (damageStrategyId) => {
      healingMocks.readHealth.mockReturnValue({
        damageStrategyId,
        modelId: "body",
        pool: { current: -21, maximum: 21 },
      });
      const patient = actor("healthy");
      await expect(
        resolveFirstEditionBodyPointNaturalHealing(patient, 0),
      ).rejects.toThrow("PatientUnavailable");
      await expect(
        resolveFirstEditionBodyPointAssistedHealing(
          patient,
          actor("healthy", "Healer"),
          "medicine",
        ),
      ).rejects.toThrow("PatientUnavailable");
      expect(healingMocks.roll).not.toHaveBeenCalled();
      expect(healingMocks.healPool).not.toHaveBeenCalled();
      expect(healingMocks.setPool).not.toHaveBeenCalled();
    },
  );
  it.each([2, 3])(
    "uses the exact pool-derived boundary for manual/scheduled mortality at %i/21",
    async (current) => {
      healingMocks.rootAvailable.mockReturnValue(false);
      healingMocks.readHealth.mockReturnValue({
        kind: "pool",
        damageStrategyId: "open-d6.damage.body-points",
        pool: { current, maximum: 21 },
      });
      healingMocks.roll.mockResolvedValue({ total: 5 });
      healingMocks.automaticRoll.mockResolvedValue({ total: 5 });
      const patient = actor("healthy");
      expect(await resolveFirstEditionMortalityCheck(patient, 5)).toBe(
        current === 2 ? "survived" : null,
      );
      const scheduled = await resolveFirstEditionEndOfRoundMortality(
        patient,
        "combat:round:1",
        "Combat.combat",
      );
      if (current === 2) {
        expect(scheduled).toMatchObject({ outcome: "survived" });
        expect(healingMocks.automaticRoll).toHaveBeenCalledTimes(1);
      } else {
        expect(scheduled).toBeNull();
        expect(healingMocks.automaticRoll).not.toHaveBeenCalled();
      }
    },
  );
});
