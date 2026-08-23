import type {
  D6SettingProfileV5,
  D6System2eThemeDefinition,
} from "@d6-system-2e/core";
import { D6_SYSTEM_2E_NEUTRAL_PAUSE_ICON } from "../registries/themes";

const D6_SYSTEM_2E_LEGACY_NEUTRAL_PROFILE_LOGO =
  "systems/d6-system-2e/assets/ui/d6-pause-cube.png";

/** Resolve presentation without a second world-level selector. */
export function resolveSelectedTheme(
  themes: readonly D6System2eThemeDefinition[],
  profile: Pick<D6SettingProfileV5, "id" | "logo">,
  personalThemeId: string,
): D6System2eThemeDefinition | undefined {
  if (personalThemeId !== "inherit") {
    const personal = themes.find(({ id }) => id === personalThemeId);
    if (personal) return personal;
  }
  return (
    themes.find(({ id }) => id === profile.id) ??
    themes.find(({ pauseIcon }) => pauseIcon === profile.logo) ??
    themes.find(({ id }) => id === "classic")
  );
}

export function resolvePauseIcon(
  profile: Pick<D6SettingProfileV5, "logo">,
  theme: D6System2eThemeDefinition | undefined,
): string {
  const profileLogo = resolveSettingLogo(profile.logo);
  return (
    (profileLogo.length > 0 ? profileLogo : theme?.pauseIcon) ??
    D6_SYSTEM_2E_NEUTRAL_PAUSE_ICON
  );
}

export function isNeutralPauseIcon(path: string): boolean {
  return path === D6_SYSTEM_2E_NEUTRAL_PAUSE_ICON;
}

/** Upgrade only the retired system-owned cube sentinel at presentation time. */
export function resolveSettingLogo(path: string): string {
  const trimmed = path.trim();
  return trimmed === D6_SYSTEM_2E_LEGACY_NEUTRAL_PROFILE_LOGO
    ? D6_SYSTEM_2E_NEUTRAL_PAUSE_ICON
    : trimmed;
}
