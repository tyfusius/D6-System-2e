import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  initialDestinyState,
  transitionDestiny,
  type D6DestinyStateV1,
  type D6DestinyOperation,
  type D6RollRequestV1,
} from "@d6-system-2e/core";
const f = vi.hoisted(() => ({
  enabled: true,
  state: {} as D6DestinyStateV1,
  sequence: 0,
  choice: "spend",
}));
const player = { userId: "player", isGM: false, actorIds: ["hero"] };
vi.mock("./destiny-service", () => ({
  destinyEnabled: () => f.enabled,
  destinyPrimaryGM: () => ({ id: "gm" }),
  destinyPublicState: () => f.state,
  refreshDestinyView: () => Promise.resolve(f.state),
  requestDestiny: async (operation: D6DestinyOperation) => {
    await Promise.resolve();
    f.state = transitionDestiny(
      f.state,
      {
        version: 1,
        id: `command${++f.sequence}`,
        expectedRevision: f.state.revision,
        sessionId: f.state.sessionId,
        operation,
      },
      player,
    );
    return f.state;
  },
}));
vi.mock("../settings/rules-profile-library", () => ({
  currentConfiguredRulesProfile: () => ({
    difficultyLadder: [
      { value: 5 },
      { value: 10 },
      { value: 15 },
      { value: 20 },
    ],
  }),
}));
import { prepareDestinyRoll } from "./destiny-effects";
function request(ids: string[]): D6RollRequestV1 {
  return {
    label: "Activation",
    source: { actorId: "hero" },
    context: {
      extraordinaryPower: { activationId: "power", checkIndex: 1 },
      distinctionEffects: { effects: ids.map((itemId) => ({ itemId })) },
    },
  } as unknown as D6RollRequestV1;
}
function actor() {
  return {
    id: "hero",
    testUserPermission: () => true,
    items: {
      get: (id: string) => ({
        id,
        name: id,
        type: "talent",
        getFlag: () => ({ version: 1, enabled: true, cost: 1 }),
      }),
    },
  } as unknown as FoundryActorDocument;
}
describe("Explicit Destiny Talent costs", () => {
  beforeEach(() => {
    f.enabled = true;
    f.choice = "spend";
    f.sequence = 0;
    f.state = {
      ...initialDestinyState(),
      status: "active",
      sessionId: "session",
      coins: [{ id: "coin", face: "light" }],
    };
    vi.stubGlobal("game", {
      user: { id: "player", isGM: false },
      users: { contents: [{ id: "player", isGM: false }] },
      i18n: { localize: (k: string) => k },
    });
    vi.stubGlobal("foundry", {
      utils: { randomID: () => `id${++f.sequence}` },
      applications: {
        api: {
          DialogV2: { wait: async () => await Promise.resolve(f.choice) },
        },
      },
    });
  });
  it("charges one structured Talent once per activation, including retry and repeated check usage", async () => {
    const a = actor();
    await prepareDestinyRoll(a, request(["talent"]));
    expect(f.state.spends).toHaveLength(1);
    expect(f.state.coins[0]?.face).toBe("dark");
    await prepareDestinyRoll(a, request(["talent", "talent"]));
    expect(f.state.spends).toHaveLength(1);
  });
  it("rejects multiple costs before spending and rejects a cost when the feature is off", async () => {
    await expect(
      prepareDestinyRoll(actor(), request(["one", "two"])),
    ).rejects.toThrow("MultipleTalentCosts");
    expect(f.state.spends).toHaveLength(0);
    f.enabled = false;
    await expect(prepareDestinyRoll(actor(), request(["one"]))).rejects.toThrow(
      "TalentUnavailable",
    );
    expect(await prepareDestinyRoll(actor(), request([]))).toEqual(request([]));
  });
  it("does not execute a required Talent activation when spending is cancelled", async () => {
    f.choice = "continue";
    await expect(prepareDestinyRoll(actor(), request(["one"]))).rejects.toThrow(
      "TalentCancelled",
    );
    expect(f.state.spends).toHaveLength(0);
  });
});
