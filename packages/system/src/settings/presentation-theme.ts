import type {
  D6SettingProfileV5,
  D6System2eThemeDefinition,
} from "@d6-system-2e/core";
import { D6_SYSTEM_2E_NEUTRAL_PAUSE_ICON } from "../registries/themes";

const D6_SYSTEM_2E_LEGACY_NEUTRAL_PROFILE_LOGO =
  "systems/d6-system-2e/assets/ui/d6-pause-cube.png";
export const D6_SYSTEM_2E_OPEN_D6_PROFILE_LOGO =
  "systems/d6-system-2e/assets/ui/open-d6-profile-mark.svg";
const D6_SYSTEM_2E_MASK_LOGOS = new Set([
  D6_SYSTEM_2E_NEUTRAL_PAUSE_ICON,
  D6_SYSTEM_2E_OPEN_D6_PROFILE_LOGO,
]);

export type D6SettingLogoBrand = "d6-system" | "image" | "open-d6";
export interface D6SettingLogoPresentation {
  readonly brand: D6SettingLogoBrand;
  readonly mode: "image" | "mask";
  readonly path: string;
}

export interface D6PersonalThemeSelection {
  readonly available: boolean;
  readonly effectiveTheme: D6System2eThemeDefinition | undefined;
  readonly inherits: boolean;
  readonly requestedId: string;
}

export function resolveSettingProfilePalette(
  themes: readonly D6System2eThemeDefinition[],
  profile: Pick<D6SettingProfileV5, "id" | "logo" | "palette">,
): D6System2eThemeDefinition["tokens"] | undefined {
  return resolvePersonalThemeSelection(themes, profile, "inherit")
    .effectiveTheme?.tokens;
}

export function resolvePersonalThemeSelection(
  themes: readonly D6System2eThemeDefinition[],
  profile: Pick<D6SettingProfileV5, "id" | "logo" | "palette">,
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
  const inherited =
    themes.find(({ id }) => id === profile.id) ??
    themes.find(({ pauseIcon }) => pauseIcon === profile.logo) ??
    classic;
  return Object.freeze({
    available: true,
    effectiveTheme:
      inherited && profile.palette
        ? Object.freeze({ ...inherited, tokens: profile.palette })
        : inherited,
    inherits: true,
    requestedId: personalThemeId,
  });
}

/** Resolve presentation without a second world-level selector. */
export function resolveSelectedTheme(
  themes: readonly D6System2eThemeDefinition[],
  profile: Pick<D6SettingProfileV5, "id" | "logo" | "palette">,
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

export function isSystemSettingLogoMask(path: string): boolean {
  return D6_SYSTEM_2E_MASK_LOGOS.has(path);
}

export function settingLogoBrand(path: string): D6SettingLogoBrand {
  const resolved = resolveSettingLogo(path);
  if (resolved === D6_SYSTEM_2E_NEUTRAL_PAUSE_ICON) return "d6-system";
  if (resolved === D6_SYSTEM_2E_OPEN_D6_PROFILE_LOGO) return "open-d6";
  return "image";
}

export function resolveSettingLogoPresentation(
  path: string,
): D6SettingLogoPresentation {
  const resolved = resolveSettingLogo(path);
  const brand = settingLogoBrand(resolved);
  return Object.freeze({
    brand,
    mode: brand === "image" ? "image" : "mask",
    path: resolved,
  });
}

/** Compatibility name for the original single neutral system mask. */
export function isNeutralPauseIcon(path: string): boolean {
  return isSystemSettingLogoMask(path);
}

/** Upgrade only the retired system-owned cube sentinel at presentation time. */
export function resolveSettingLogo(path: string): string {
  const trimmed = path.trim();
  return trimmed === D6_SYSTEM_2E_LEGACY_NEUTRAL_PROFILE_LOGO
    ? D6_SYSTEM_2E_NEUTRAL_PAUSE_ICON
    : trimmed;
}
