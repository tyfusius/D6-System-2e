import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveFirstEditionAssistedHealing,
  resolveFirstEditionMortalityCheck,
  resolveFirstEditionNaturalHealing,
} from "./first-edition-healing-service";

const healingMocks = vi.hoisted(() => ({
  roll: vi.fn(),
  setWound: vi.fn(),
}));

vi.mock("./condition-service", () => ({
  setActorFirstEditionWound: healingMocks.setWound,
}));

vi.mock("./rolls/roll-service", () => ({
  rollFirstEditionHealingCheck: healingMocks.roll,
}));

function actor(wound: string, name = "Patient") {
  return {
    id: name,
    isOwner: true,
    name,
    system: { health: { firstEditionWound: wound } },
  } as unknown as FoundryActorDocument;
}

beforeEach(() => {
  healingMocks.roll.mockReset();
  healingMocks.setWound.mockReset().mockResolvedValue(undefined);
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
});
