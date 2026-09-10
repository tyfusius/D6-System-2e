import type { D6RollMode, D6RollResultV1 } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../../constants";
import { currentSettingProfile } from "../../settings/setting-profile";

/** Local feedback for the client executing a roll, never a socket recipient or
 * chat-render hook. Self rolls belong to that executor; actor ownership does not
 * reveal a Blind result. GM decision dialogs have their own authority boundary. */
export function canSeeExecutingRollOutcome(mode: D6RollMode): boolean {
  const user = game.user;
  return !!user && (mode !== "blindroll" || user.isGM);
}

export async function playSettingWildDieSound(
  result: D6RollResultV1,
): Promise<void> {
  if (!canSeeExecutingRollOutcome(result.request.rollMode)) return;
  const firstWild = result.wildFaceGroups?.[0]?.[0] ?? result.wildFaces[0];
  const profile = currentSettingProfile();
  const src =
    firstWild === 1
      ? profile.wildDie.oneSound
      : firstWild === 6
        ? profile.wildDie.sixSound
        : "";
  if (!src) return;
  const audioHelper = (
    foundry as unknown as {
      readonly audio?: {
        readonly AudioHelper?: {
          play(
            options: {
              readonly autoplay: boolean;
              readonly loop: boolean;
              readonly src: string;
              readonly volume: number;
            },
            broadcast: boolean,
          ): Promise<unknown>;
        };
      };
    }
  ).audio?.AudioHelper;
  try {
    await audioHelper?.play(
      { autoplay: true, loop: false, src, volume: 0.55 },
      false,
    );
  } catch (error) {
    console.warn(`${SYSTEM_ID} | Could not play Wild Die result sound`, error);
  }
}
