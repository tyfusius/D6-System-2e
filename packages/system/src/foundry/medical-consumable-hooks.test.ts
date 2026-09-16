import { requireDestinyValue as required } from "@d6-system-2e/core";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { registerMedicalConsumableHooks } from "./medical-consumable-hooks";

const f = vi.hoisted(() => ({
  authority: true,
  calls: [] as Record<string, unknown>[],
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
}));

vi.mock("./destiny-crypto", () => ({
  destinyClientIsAuthority: () => f.authority,
}));
vi.mock("./medical-consumable-authority", () => ({
  requestMedicalRoot: (data: Record<string, unknown>) => {
    f.calls.push(structuredClone(data));
    return Promise.resolve();
  },
}));

const medicalActor = (uuid: string) => ({
  uuid,
  system: { medical: { stim: { version: 1 } } },
});

describe("medical consumable lifecycle hooks", () => {
  const world = medicalActor("Actor.world");
  const synthetic = medicalActor("Scene.s.Token.t.Actor.synthetic");

  beforeAll(() => {
    vi.stubGlobal("Hooks", {
      on: (name: string, handler: (...args: unknown[]) => unknown) =>
        f.handlers.set(name, handler),
      once: (name: string, handler: (...args: unknown[]) => unknown) =>
        f.handlers.set(name, handler),
    });
    vi.stubGlobal("game", {
      user: { id: "gm", isGM: true },
      users: {
        get: (id: string) => ({ id, isGM: id === "gm" }),
      },
      actors: { contents: [world] },
      scenes: { contents: [{ tokens: { contents: [{ actor: synthetic }] } }] },
      combats: {
        contents: [
          {
            uuid: "Combat.one",
            round: 2,
            combatants: { contents: [{ actor: world }] },
          },
          {
            uuid: "Combat.two",
            round: 3,
            combatants: { contents: [{ actor: world }] },
          },
        ],
      },
      time: { worldTime: 100 },
    });
    registerMedicalConsumableHooks();
  });

  it("reconciles world and synthetic actors on ready and marks multiple combats ambiguous", async () => {
    f.calls.length = 0;
    f.handlers.get("ready")?.();
    await Promise.resolve();
    expect(f.calls.map(({ actorUuid }) => actorUuid)).toEqual([
      world.uuid,
      synthetic.uuid,
    ]);
    expect(f.calls[0]?.event).toEqual({
      kind: "sync",
      ambiguousCombat: true,
      campaignTime: 100,
      combatUuid: null,
      combatClocks: [
        { combatUuid: "Combat.one", round: 2 },
        { combatUuid: "Combat.two", round: 3 },
      ],
      round: null,
    });
  });

  it("rejects direct physiology updates from a non-GM", () => {
    const guard = required(f.handlers.get("preUpdateActor"));
    expect(
      guard(
        world,
        { system: { medical: { physiology: { kind: "biological" } } } },
        {},
        "owner",
      ),
    ).toBe(false);
    expect(
      guard(
        world,
        { "system.medical.physiology": { kind: "mechanical" } },
        {},
        "gm",
      ),
    ).toBeUndefined();
  });

  it("hands a round-zero Combat back to the campaign clock", async () => {
    f.calls.length = 0;
    f.handlers.get("updateCombat")?.(
      {
        uuid: "Combat.one",
        round: 0,
        started: false,
        combatants: { contents: [{ actor: world }] },
      },
      { round: 0, started: false },
    );
    await Promise.resolve();
    expect(f.calls).toEqual([
      {
        method: "reconcile",
        actorUuid: world.uuid,
        event: {
          kind: "leave",
          campaignTime: 100,
          combatUuid: "Combat.one",
          round: 1,
        },
      },
    ]);
  });

  it("reconciles every active actor when a Destiny presence grants authority", async () => {
    f.calls.length = 0;
    f.authority = false;
    const presence = {
      getFlag: () => ({ type: "presence" }),
    };
    f.handlers.get("updateChatMessage")?.(presence);
    expect(f.calls).toEqual([]);
    f.authority = true;
    f.handlers.get("updateChatMessage")?.(presence);
    await Promise.resolve();
    expect(f.calls.map(({ actorUuid }) => actorUuid)).toEqual([
      world.uuid,
      synthetic.uuid,
    ]);
  });
});
