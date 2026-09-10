import { requireDestinyValue } from "@d6-system-2e/core";
import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  initialDestinyState,
  transitionDestiny,
  type D6DestinyStateV1,
  type D6DestinyOperation,
  type D6RollRequestV1,
  type D6RollResultV1,
} from "@d6-system-2e/core";
const f = vi.hoisted(() => ({
  state: {} as D6DestinyStateV1,
  enabled: true,
  provider: true,
  registered: true,
  sequence: 0,
  operations: [] as string[],
}));
const player = { userId: "player", isGM: false, actorIds: ["hero"] };
function act(operation: D6DestinyOperation, isGM = false) {
  f.operations.push(operation.kind);
  f.state = transitionDestiny(
    f.state,
    {
      version: 1,
      id: `c${++f.sequence}`,
      expectedRevision: f.state.revision,
      sessionId: f.state.sessionId,
      operation,
    },
    isGM ? { userId: "gm", isGM: true, actorIds: [] } : player,
  );
  return structuredClone(f.state);
}
vi.mock("./destiny-service", () => ({
  destinyEnabled: () => f.enabled,
  refreshDestinyView: () => Promise.resolve(structuredClone(f.state)),
  requestDestiny: async (operation: D6DestinyOperation) => {
    await Promise.resolve();
    return act(operation);
  },
}));
vi.mock("./destiny-consequence", () => ({
  requireDestinyFramework: () => {
    if (!f.provider) throw new Error("D6E2.Destiny.Error.ProviderMissing");
    return {
      ownerId: "provider",
      destinyTemptation: { consequenceResourceRoleId: "dark" },
    };
  },
}));
vi.mock("../registries/extraordinary-powers", () => ({
  resolvedExtraordinaryPowerFramework: () =>
    f.registered ? { destinyTemptation: { version: 1 } } : {},
}));
import { prepareDestinyPower } from "./destiny-power";
const actor = { id: "hero" } as FoundryActorDocument;
const checks = [
  { itemId: "skill", roleId: "control", difficulty: 15 },
  { itemId: "sense", roleId: "sense", difficulty: 15 },
];
function request(index: number): D6RollRequestV1 {
  return {
    id: `roll${index}`,
    source: {
      actorId: "hero",
      itemId: requireDestinyValue(checks[index]).itemId,
    },
    context: {
      extraordinaryPower: {
        frameworkId: "force",
        roleId: requireDestinyValue(checks[index]).roleId,
        checkIndex: index + 1,
        checkCount: 2,
      },
    },
    score: 6,
  } as unknown as D6RollRequestV1;
}
function result(
  index: number,
  groups: readonly (readonly number[])[],
): D6RollResultV1 {
  return {
    request: request(index),
    wildFaceGroups: groups,
    wildFaces: groups.flat(),
    success: true,
  } as unknown as D6RollResultV1;
}
describe("Destiny registered power lifecycle", () => {
  beforeEach(() => {
    f.state = initialDestinyState();
    f.enabled = true;
    f.provider = true;
    f.registered = true;
    f.sequence = 0;
    f.operations = [];
    act(
      {
        kind: "reset",
        sessionId: "session",
        size: 3,
        nominatedUserId: "player",
      },
      true,
    );
    act({ kind: "session-roll", die: 6 });
    f.operations = [];
  });
  it("samples after committed costs, once before first dice, and checks every original Wild die", async () => {
    const lifecycle = await prepareDestinyPower(
      actor,
      "force",
      checks,
      "activation",
    );
    expect(f.operations).toEqual([]);
    act(
      {
        kind: "correct",
        faces: ["dark", "dark", "dark"],
        reason: "costs already committed",
      },
      true,
    );
    await requireDestinyValue(lifecycle).beforeDice(0, request(0));
    expect(f.operations.slice(-2)).toEqual(["sample", "claim-power-roll"]);
    await requireDestinyValue(lifecycle).capture(
      0,
      result(0, [[6, 1], [1]]),
      [],
    );
    expect(f.state.temptations.activation?.status).toBe("rolling");
    act(
      {
        kind: "correct",
        faces: ["light", "light", "light"],
        reason: "later pool",
      },
      true,
    );
    await requireDestinyValue(lifecycle).beforeDice(1, request(1));
    await requireDestinyValue(lifecycle).capture(1, result(1, [[1]]), []);
    await requireDestinyValue(lifecycle).complete();
    expect(f.operations.filter((k) => k === "sample")).toHaveLength(1);
    expect(f.state.temptations.activation?.faces).toEqual([
      "dark",
      "dark",
      "dark",
    ]);
    expect(f.state.temptations.activation?.completed).toBe(true);
  });
  it("reuses recorded checks on reload and never rerolls a claim missing its result", async () => {
    const original = await prepareDestinyPower(
      actor,
      "force",
      checks,
      "activation",
    );
    await requireDestinyValue(original).beforeDice(0, request(0));
    await requireDestinyValue(original).capture(0, result(0, [[6, 1]]), []);
    const reloaded = await prepareDestinyPower(
      actor,
      "force",
      checks,
      "activation",
    );
    expect(requireDestinyValue(reloaded).previous(0)).toEqual(
      result(0, [[6, 1]]),
    );
    expect(f.state.temptations.activation?.status).toBe("sampled");
    await requireDestinyValue(reloaded).beforeDice(1, request(1));
    const interrupted = await prepareDestinyPower(
      actor,
      "force",
      checks,
      "activation",
    );
    await expect(
      requireDestinyValue(interrupted).beforeDice(1, request(1)),
    ).rejects.toThrow("PendingRecovery");
    expect(f.operations.filter((k) => k === "sample")).toHaveLength(1);
  });
  it("does not sample for disabled or standalone/unregistered workflows and fails closed on provider removal", async () => {
    f.enabled = false;
    expect(await prepareDestinyPower(actor, "force", checks)).toBeUndefined();
    f.enabled = true;
    f.registered = false;
    expect(await prepareDestinyPower(actor, "force", checks)).toBeUndefined();
    f.registered = true;
    const lifecycle = await prepareDestinyPower(
      actor,
      "force",
      checks,
      "activation",
    );
    f.provider = false;
    await expect(
      requireDestinyValue(lifecycle).beforeDice(0, request(0)),
    ).rejects.toThrow("ProviderMissing");
    expect(f.operations).toEqual([]);
  });
  it("does not sample zero-dice failures and preserves them when later checks roll", async () => {
    const lifecycle = await prepareDestinyPower(
      actor,
      "force",
      checks,
      "activation",
    );
    const failure = {
      ...result(0, []),
      success: false,
    } as unknown as D6RollResultV1;
    await requireDestinyValue(lifecycle).unrollable(0, failure);
    expect(f.operations).toEqual([]);
    await requireDestinyValue(lifecycle).beforeDice(1, request(1));
    expect(f.state.temptations.activation?.rollResults?.[0]).toEqual(failure);
  });
});
