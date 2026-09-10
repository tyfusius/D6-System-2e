import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { D6RollMode, D6RollResultV1 } from "@d6-system-2e/core";
import { currentSettingProfile } from "../../settings/setting-profile";
import { playSettingWildDieSound } from "./wild-die-feedback";

vi.mock("../../settings/setting-profile", () => ({
  currentSettingProfile: vi.fn(),
}));
const play = vi.fn();
const profile = {
  wildDie: { oneSound: "worlds/test/one.mp3", sixSound: "worlds/test/six.ogg" },
};
function result(mode: D6RollMode, face: number, grouped = false) {
  return {
    request: { rollMode: mode, source: { actorId: "actor-1" } },
    wildFaces: grouped ? [3] : [face],
    ...(grouped ? { wildFaceGroups: [[face, 4], [6]] } : {}),
  } as unknown as D6RollResultV1;
}
beforeEach(() => {
  vi.mocked(currentSettingProfile).mockReturnValue(profile as never);
  play.mockResolvedValue(undefined);
  vi.stubGlobal("foundry", { audio: { AudioHelper: { play } } });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("local Wild Die outcome audio privacy", () => {
  it.each([1, 6])(
    "does not even load audio configuration for Blind face %s on any player",
    async (face) => {
      for (const id of ["owner", "other-player"]) {
        vi.stubGlobal("game", { user: { id, isGM: false } });
        await playSettingWildDieSound(result("blindroll", face));
        await playSettingWildDieSound(result("blindroll", face, true));
      }
      expect(currentSettingProfile).not.toHaveBeenCalled();
      expect(play).not.toHaveBeenCalled();
    },
  );
  it.each(["publicroll", "gmroll", "selfroll", "blindroll"] as const)(
    "keeps exactly one local sound per eligible completed %s roll",
    async (mode) => {
      for (const isGM of [false, true]) {
        if (mode === "blindroll" && !isGM) continue;
        vi.stubGlobal("game", { user: { id: isGM ? "gm" : "owner", isGM } });
        for (const face of [1, 6]) {
          for (const grouped of [false, true]) {
            play.mockClear();
            await playSettingWildDieSound(result(mode, face, grouped));
            expect(play).toHaveBeenCalledExactlyOnceWith(
              {
                autoplay: true,
                loop: false,
                src:
                  face === 1
                    ? profile.wildDie.oneSound
                    : profile.wildDie.sixSound,
                volume: 0.55,
              },
              false,
            );
          }
        }
      }
    },
  );
  it("never broadcasts a Self roll to another player or a coordinating GM", async () => {
    const remotePlay = vi.fn();
    play.mockImplementation((_options, broadcast) => {
      if (broadcast) remotePlay();
      return Promise.resolve();
    });
    vi.stubGlobal("game", { user: { id: "owner", isGM: false } });
    await playSettingWildDieSound(result("selfroll", 6));
    expect(play).toHaveBeenCalledTimes(1);
    expect(remotePlay).not.toHaveBeenCalled();
  });
  it("stays silent without a user, on ordinary faces, or with an empty configured sound", async () => {
    vi.stubGlobal("game", {});
    await playSettingWildDieSound(result("blindroll", 1));
    expect(currentSettingProfile).not.toHaveBeenCalled();
    vi.stubGlobal("game", { user: { id: "owner", isGM: false } });
    for (const face of [2, 3, 4, 5])
      await playSettingWildDieSound(result("publicroll", face));
    vi.mocked(currentSettingProfile).mockReturnValue({
      wildDie: { oneSound: "", sixSound: "" },
    } as never);
    await playSettingWildDieSound(result("selfroll", 1));
    await playSettingWildDieSound(result("publicroll", 6));
    expect(play).not.toHaveBeenCalled();
  });
  it("preserves nonfatal eligible audio errors and never attempts inaccessible Blind audio", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    play.mockRejectedValue(new Error("missing asset"));
    vi.stubGlobal("game", { user: { id: "owner", isGM: false } });
    await playSettingWildDieSound(result("blindroll", 6));
    expect(warn).not.toHaveBeenCalled();
    await expect(
      playSettingWildDieSound(result("publicroll", 6)),
    ).resolves.toBeUndefined();
    expect(play).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
