import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveMachineRepair } from "./machine-damage-service";

const mocks = vi.hoisted(() => ({ condition: vi.fn(), roll: vi.fn() }));

vi.mock("./health-runtime", () => ({
  currentHealthResolutionStrategy: () => ({ family: "conditions" }),
  readActorHealth: (actor: FoundryActorDocument) => ({
    track: {
      currentStateId: (actor.system.health as { condition: string }).condition,
    },
  }),
  setActorHealthTrack: mocks.condition,
}));
vi.mock("./rolls/roll-service", () => ({
  rollFirstEditionRecoveryCheck: mocks.roll,
}));

function actor(type: string, condition = "healthy") {
  return {
    id: `${type}-1`,
    isOwner: true,
    items: { contents: [] },
    name: type,
    system: { health: { condition } },
    type,
  } as unknown as FoundryActorDocument;
}

beforeEach(() => {
  mocks.condition.mockReset().mockResolvedValue(undefined);
  mocks.roll.mockReset();
  vi.stubGlobal("game", {
    i18n: { format: (key: string) => key },
    settings: { get: () => false },
  });
});

describe("Second Edition machine repair", () => {
  it("uses Mechanical at the locked condition difficulty and clears success", async () => {
    const machine = actor("vehicle", "incapacitated");
    const repairer = actor("character");
    mocks.roll.mockResolvedValue({ total: 15 });
    await expect(
      resolveMachineRepair(machine, repairer),
    ).resolves.toMatchObject({
      condition: "incapacitated",
      difficulty: 15,
      repaired: true,
      sourcePage: 183,
    });
    expect(mocks.roll).toHaveBeenCalledWith(
      repairer,
      "D6E2.Machine.RepairCheck",
      "mechanical",
      15,
      undefined,
    );
    expect(mocks.condition).toHaveBeenCalledWith(machine, "healthy");
  });

  it("retains the condition on a failed or cancelled repair", async () => {
    const machine = actor("starship", "mortally-wounded");
    mocks.roll.mockResolvedValue({ total: 19 });
    await expect(
      resolveMachineRepair(machine, actor("npc")),
    ).resolves.toMatchObject({
      difficulty: 20,
      repaired: false,
      sourcePage: 180,
    });
    expect(mocks.condition).not.toHaveBeenCalled();
  });

  it("does not invent repair difficulties for Staggered or Dead", async () => {
    await expect(
      resolveMachineRepair(actor("vehicle", "staggered"), actor("character")),
    ).rejects.toThrow("D6E2.Machine.NoAutomatedRepair");
  });
});
