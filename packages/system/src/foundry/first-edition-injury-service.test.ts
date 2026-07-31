import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyFirstEditionStunDamage,
  clearFirstEditionUnconsciousness,
  resolveFirstEditionIncapacitation,
} from "./first-edition-injury-service";

const injuryMocks = vi.hoisted(() => ({
  duration: vi.fn(),
  recovery: vi.fn(),
}));

vi.mock("./rolls/roll-service", () => ({
  rollFirstEditionRecoveryCheck: injuryMocks.recovery,
  rollFirstEditionUnconsciousDuration: injuryMocks.duration,
}));

function actor() {
  const update = vi.fn(() => Promise.resolve());
  return {
    actor: {
      id: "target",
      isOwner: true,
      items: {
        contents: [
          { id: "stamina-id", system: { key: "stamina" }, type: "skill" },
          { id: "will-id", system: { key: "willpower" }, type: "skill" },
        ],
      },
      name: "Target",
      system: {
        health: {
          firstEditionState: {
            consciousness: "conscious",
            source: "none",
            stunWound: "none",
            unconsciousMinutes: 0,
          },
        },
      },
      update,
    } as unknown as FoundryActorDocument,
    update,
  };
}

beforeEach(() => {
  injuryMocks.duration.mockReset();
  injuryMocks.recovery.mockReset();
  vi.stubGlobal("game", { i18n: { localize: (key: string) => key } });
});

describe("First Edition injury adapter", () => {
  it("stores reduced stun severity and positive unconscious duration", async () => {
    const subject = actor();
    await applyFirstEditionStunDamage(subject.actor, {
      damageTotal: 20,
      difference: 12,
      reducedWound: "wounded",
      resistanceTotal: 8,
      unconsciousMinutes: 12,
    });
    expect(subject.update).toHaveBeenCalledWith({
      "system.health.firstEditionState": {
        consciousness: "unconscious",
        source: "stun",
        stunWound: "wounded",
        unconsciousMinutes: 12,
      },
      "system.movement.posture": "prone",
    });
  });

  it("keeps an Incapacitated actor conscious after meeting Moderate 15", async () => {
    const subject = actor();
    injuryMocks.recovery.mockResolvedValue({ total: 15 });
    await resolveFirstEditionIncapacitation(subject.actor, "willpower");
    expect(injuryMocks.recovery).toHaveBeenCalledWith(
      subject.actor,
      "D6E2.Combat.FirstEdition.Consciousness.IncapacitationCheck",
      "knowledge",
      15,
      "will-id",
    );
    expect(injuryMocks.duration).not.toHaveBeenCalled();
    expect(subject.update).toHaveBeenCalledWith({
      "system.health.firstEditionState": {
        consciousness: "conscious",
        source: "incapacitated",
        stunWound: "none",
        unconsciousMinutes: 0,
      },
    });
  });

  it("rolls 10D minutes after failing the Incapacitated check", async () => {
    const subject = actor();
    injuryMocks.recovery.mockResolvedValue({ total: 14 });
    injuryMocks.duration.mockResolvedValue({ total: 34 });
    await resolveFirstEditionIncapacitation(subject.actor, "stamina");
    expect(injuryMocks.duration).toHaveBeenCalledWith(subject.actor);
    expect(subject.update).toHaveBeenCalledWith({
      "system.health.firstEditionState": {
        consciousness: "unconscious",
        source: "incapacitated",
        stunWound: "none",
        unconsciousMinutes: 34,
      },
      "system.movement.posture": "prone",
    });
  });

  it("clears temporary stun and unconsciousness state", async () => {
    const subject = actor();
    await clearFirstEditionUnconsciousness(subject.actor);
    expect(subject.update).toHaveBeenCalledWith({
      "system.health.firstEditionState": {
        consciousness: "conscious",
        source: "none",
        stunWound: "none",
        unconsciousMinutes: 0,
      },
    });
  });
});
