import { afterEach, describe, expect, it, vi } from "vitest";
import {
  guardActorPortraitUpdate,
  mayEditActorPortrait,
  registerActorPortraitPermissions,
} from "./actor-portrait-permissions";

afterEach(() => vi.unstubAllGlobals());

describe("character portrait permissions", () => {
  it.each([
    [true, false, false, true],
    [false, true, true, true],
    [false, true, false, false],
    [false, false, true, false],
  ])(
    "resolves GM=%s owner=%s enabled=%s to %s",
    (isGM, isOwner, playerUpdatesAllowed, expected) => {
      expect(
        mayEditActorPortrait({ isGM, isOwner, playerUpdatesAllowed }),
      ).toBe(expected);
    },
  );

  it("registers a pre-update guard and rejects a disabled player portrait write", () => {
    let guard:
      | ((
          actor: unknown,
          changes: unknown,
          options: unknown,
          userId: unknown,
        ) => boolean | undefined)
      | undefined;
    const player = { id: "player", isGM: false };
    const actor = {
      testUserPermission: () => true,
      type: "character",
    };
    vi.stubGlobal("Hooks", {
      on: (name: string, callback: typeof guard) => {
        if (name === "preUpdateActor") guard = callback;
      },
    });
    vi.stubGlobal("game", {
      settings: { get: () => false },
      user: player,
      users: { get: (id: string) => (id === player.id ? player : undefined) },
    });

    registerActorPortraitPermissions();

    expect(guard).toBeTypeOf("function");
    expect(guard?.(actor, { img: "worlds/test/new.webp" }, {}, player.id)).toBe(
      false,
    );
    expect(guard?.(actor, { name: "New name" }, {}, player.id)).toBeUndefined();
  });

  it("allows an owning player when enabled and never restricts other Actor families", () => {
    const player = { id: "player", isGM: false };
    vi.stubGlobal("game", {
      settings: { get: () => true },
      user: player,
      users: { get: () => player },
    });
    const ownedCharacter = {
      testUserPermission: () => true,
      type: "character",
    };
    const machine = {
      testUserPermission: () => false,
      type: "starship",
    };

    expect(
      guardActorPortraitUpdate(
        ownedCharacter,
        { img: "worlds/test/new.webp" },
        {},
        player.id,
      ),
    ).toBeUndefined();
    expect(
      guardActorPortraitUpdate(
        machine,
        { img: "worlds/test/new.webp" },
        {},
        player.id,
      ),
    ).toBeUndefined();
  });

  it("keeps GM portrait updates available when player updates are disabled", () => {
    const gm = { id: "gm", isGM: true };
    vi.stubGlobal("game", {
      settings: { get: () => false },
      user: gm,
      users: { get: () => gm },
    });
    const actor = {
      testUserPermission: () => false,
      type: "npc",
    };

    expect(
      guardActorPortraitUpdate(
        actor,
        { img: "worlds/test/new.webp" },
        {},
        gm.id,
      ),
    ).toBeUndefined();
  });
});
