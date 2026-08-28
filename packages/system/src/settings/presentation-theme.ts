import type {
  D6SettingProfileV5,
  D6System2eThemeDefinition,
} from "@d6-system-2e/core";
import { D6_SYSTEM_2E_NEUTRAL_PAUSE_ICON } from "../registries/themes";

const D6_SYSTEM_2E_LEGACY_NEUTRAL_PROFILE_LOGO =
  "systems/d6-system-2e/assets/ui/d6-pause-cube.png";

export interface D6PersonalThemeSelection {
  readonly available: boolean;
  readonly effectiveTheme: D6System2eThemeDefinition | undefined;
  readonly inherits: boolean;
  readonly requestedId: string;
}

export function resolvePersonalThemeSelection(
  themes: readonly D6System2eThemeDefinition[],
  profile: Pick<D6SettingProfileV5, "id" | "logo">,
  personalThemeId: string,
): D6PersonalThemeSelection {
  const classic = themes.find(({ id }) => id === "classic");
  if (personalThemeId !== "inherit") {
    const personal = themes.find(({ id }) => id === personalThemeId);
    return Object.freeze({
      available: personal !== undefined,
      effectiveTheme: personal ?? classic,
      inherits: false,
      requestedId: personalThemeId,
    });
  }
  return Object.freeze({
    available: true,
    effectiveTheme:
      themes.find(({ id }) => id === profile.id) ??
      themes.find(({ pauseIcon }) => pauseIcon === profile.logo) ??
      classic,
    inherits: true,
    requestedId: personalThemeId,
  });
}

/** Resolve presentation without a second world-level selector. */
export function resolveSelectedTheme(
  themes: readonly D6System2eThemeDefinition[],
  profile: Pick<D6SettingProfileV5, "id" | "logo">,
  personalThemeId: string,
): D6System2eThemeDefinition | undefined {
  return resolvePersonalThemeSelection(themes, profile, personalThemeId)
    .effectiveTheme;
}

interface ThemePresentationRoot {
  readonly classList: Pick<DOMTokenList, "add" | "remove">;
  readonly dataset: Record<string, string | undefined>;
  readonly style: Pick<CSSStyleDeclaration, "removeProperty" | "setProperty">;
}

function presentationSignature(
  theme: D6System2eThemeDefinition,
  properties: Readonly<Record<string, string>>,
): string {
  return JSON.stringify([
    theme.id,
    theme.cssClass,
    theme.dice,
    Object.entries(properties).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  ]);
}

/** Replace only the system-owned presentation applied by the previous theme. */
export function replaceAppliedThemePresentation(
  root: ThemePresentationRoot,
  theme: D6System2eThemeDefinition,
  properties: Readonly<Record<string, string>>,
): boolean {
  const signature = presentationSignature(theme, properties);
  if (root.dataset.d6System2eThemeSignature === signature) return false;

  const previousClass = root.dataset.d6System2eThemeClass;
  if (previousClass) root.classList.remove(previousClass);
  for (const property of (root.dataset.d6System2eThemeProperties ?? "").split(
    ",",
  )) {
    if (property) root.style.removeProperty(property);
  }

  root.classList.add(theme.cssClass);
  for (const [property, value] of Object.entries(properties)) {
    root.style.setProperty(property, value);
  }
  root.dataset.d6System2eThemeClass = theme.cssClass;
  root.dataset.d6System2eThemeProperties = Object.keys(properties)
    .sort()
    .join(",");
  root.dataset.d6System2eThemeSignature = signature;
  return true;
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

/** Resolve shared pause branding independently of a personal palette choice. */
export function resolveSettingProfilePauseIcon(
  themes: readonly D6System2eThemeDefinition[],
  profile: Pick<D6SettingProfileV5, "id" | "logo">,
): string {
  return resolvePauseIcon(
    profile,
    resolvePersonalThemeSelection(themes, profile, "inherit").effectiveTheme,
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
