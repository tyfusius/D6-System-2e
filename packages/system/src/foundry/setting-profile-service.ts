import type { D6System2eSettingProfileActivationResult } from "@d6-system-2e/core";
import {
  currentResolvedSettingProfile,
  selectSettingProfile,
  availableSettingProfiles,
} from "../settings/setting-profile";
import { settingProfileAssetDiagnostics } from "./setting-profile-storage";

export async function activateSettingProfile(
  profileId: string,
): Promise<D6System2eSettingProfileActivationResult> {
  if (!game.user?.isGM) {
    throw new Error("Only a Gamemaster can activate a Setting Profile.");
  }
  const resolved = availableSettingProfiles().find(
    ({ profile }) => profile.id === profileId,
  );
  if (!resolved) throw new RangeError(`Unknown Setting Profile: ${profileId}`);
  const diagnostics = await settingProfileAssetDiagnostics(resolved.profile);
  if (diagnostics.length > 0) {
    throw new RangeError(
      diagnostics
        .map(({ path }) => path)
        .filter(Boolean)
        .join(" "),
    );
  }
  await selectSettingProfile(profileId);
  return Object.freeze({ profile: currentResolvedSettingProfile() });
}
