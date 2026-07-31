import { beforeEach, describe, expect, it, vi } from "vitest";
import { planFirstEditionActorMovement } from "./first-edition-movement-service";

const movementMocks = vi.hoisted(() => ({
  createMessage: vi.fn(),
  roundState: null as Record<string, unknown> | null,
  spend: vi.fn(),
  roll: vi.fn(),
}));

vi.mock("../settings/edition-capabilities", () => ({
  currentEditionCapabilityProfile: () => ({
    movement: { strategy: "open-d6-relative-movement" },
  }),
}));

vi.mock("./combat-service", () => ({
  readCombatantRound: () => movementMocks.roundState,
  spendFirstEditionCombatantAction: movementMocks.spend,
}));

vi.mock("./rolls/roll-service", () => ({
  rollFirstEditionMovementCheck: movementMocks.roll,
}));

const actor = {
  id: "actor-1",
  img: "actor.webp",
  isOwner: true,
  items: {
    contents: [
      { system: { key: "climb-jump" }, type: "skill" },
      { system: { key: "running" }, type: "skill" },
    ],
  },
  name: "Mover",
};

beforeEach(() => {
  movementMocks.roundState = null;
  movementMocks.createMessage.mockReset().mockResolvedValue(undefined);
  movementMocks.spend.mockReset();
  movementMocks.roll.mockReset().mockResolvedValue({ total: 10 });
  vi.stubGlobal("game", {
    i18n: { localize: (key: string) => key },
  });
  vi.stubGlobal("foundry", {
    applications: {
      handlebars: { renderTemplate: vi.fn(() => Promise.resolve("card")) },
    },
  });
  vi.stubGlobal("ChatMessage", {
    create: movementMocks.createMessage,
    getSpeaker: vi.fn(() => ({ actor: "actor-1" })),
  });
});

describe("First Edition actor movement adapter", () => {
  it("posts free half-Move movement without spending an action", async () => {
    const plan = await planFirstEditionActorMovement(actor, {
      baseMove: 10,
      distance: 5,
      type: "land",
    });
    expect(plan).toMatchObject({ actionRequired: false, freeDistance: 5 });
    expect(movementMocks.spend).not.toHaveBeenCalled();
    expect(movementMocks.createMessage).toHaveBeenCalledOnce();
  });

  it("spends a committed action for movement beyond half Move", async () => {
    movementMocks.roundState = {
      firstEditionCommitment: { plannedActionCount: 2 },
      firstEditionRemainingActionCount: 2,
      revision: 4,
    };
    const plan = await planFirstEditionActorMovement(actor, {
      baseMove: 10,
      distance: 8,
      expectedRevision: 4,
      type: "land",
    });
    expect(plan.actionRequired).toBe(true);
    expect(movementMocks.spend).toHaveBeenCalledWith(actor, 4);
  });

  it("rolls a required movement check before spending the tracked action", async () => {
    movementMocks.roundState = {
      firstEditionCommitment: { plannedActionCount: 2 },
      firstEditionRemainingActionCount: 2,
      revision: 4,
    };
    const plan = await planFirstEditionActorMovement(actor, {
      baseMove: 10,
      distance: 20,
      expectedRevision: 4,
      type: "land",
    });
    expect(plan).toMatchObject({ difficulty: 5, rollRequired: true });
    expect(movementMocks.roll).toHaveBeenCalledWith(actor, plan);
    expect(movementMocks.roll.mock.invocationCallOrder[0]).toBeLessThan(
      movementMocks.spend.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("does not spend the tracked action when a required roll is cancelled", async () => {
    movementMocks.roundState = {
      firstEditionCommitment: { plannedActionCount: 2 },
      firstEditionRemainingActionCount: 2,
      revision: 4,
    };
    movementMocks.roll.mockResolvedValue(null);
    await planFirstEditionActorMovement(actor, {
      baseMove: 10,
      distance: 20,
      expectedRevision: 4,
      type: "land",
    });
    expect(movementMocks.spend).not.toHaveBeenCalled();
    expect(movementMocks.createMessage).not.toHaveBeenCalled();
  });

  it("uses half Move for an untrained climb and enforces the four-rate cap", async () => {
    const untrained = { ...actor, items: { contents: [] } };
    await expect(
      planFirstEditionActorMovement(untrained, {
        baseMove: 10,
        distance: 21,
        type: "climb",
      }),
    ).rejects.toThrow("D6E2.Combat.Error.FirstEditionMovementTooFar");
  });
});
