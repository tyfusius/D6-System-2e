import type {
  D6SettingProfileV5,
  D6System2eThemeDefinition,
} from "@d6-system-2e/core";

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
  return (
    (profile.logo.length > 0 ? profile.logo : theme?.pauseIcon) ??
    "systems/d6-system-2e/assets/ui/d6-pause-cube.png"
  );
}
