import type {
  D6System2eThemeDefinition,
  D6System2eThemeRegistry,
} from "@d6-system-2e/core";

const ID_PATTERN = /^[a-z][a-z0-9-]*$/u;
const CSS_CLASS_PATTERN = /^[a-z][a-z0-9_-]*$/u;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/iu;
const THEME_ASSET_PATH_PATTERN =
  /^(?:systems\/d6-system-2e|modules\/[a-z][a-z0-9-]*)\/[A-Za-z0-9_./-]+\.(?:avif|png|svg|webp)$/u;

export const D6_SYSTEM_2E_DEFAULT_WILD_DIE_LABELS = Object.freeze([
  "1",
  "2",
  "3",
  "4",
  "5",
  "systems/d6-system-2e/assets/dice/wild-six.png",
]);

export function themeWildDieLabels(
  theme: D6System2eThemeDefinition,
): readonly string[] {
  return theme.dice?.wildDieLabels ?? D6_SYSTEM_2E_DEFAULT_WILD_DIE_LABELS;
}

export function themeWildDieMark(
  theme: D6System2eThemeDefinition,
): Readonly<{ kind: "image" | "text"; value: string }> {
  const value = themeWildDieLabels(theme)[5] ?? "6";
  return Object.freeze({
    kind: THEME_ASSET_PATH_PATTERN.test(value) ? "image" : "text",
    value,
  });
}

export function themeWildDieChatProperties(
  theme: D6System2eThemeDefinition,
  route: (path: string) => string,
): Readonly<{ image: string; text: string }> {
  const mark = themeWildDieMark(theme);
  return Object.freeze({
    image: mark.kind === "image" ? `url("${route(mark.value)}")` : "none",
    text: mark.kind === "text" ? JSON.stringify(mark.value) : '""',
  });
}

function colorChannels(value: string): string {
  return [value.slice(1, 3), value.slice(3, 5), value.slice(5, 7)]
    .map((channel) => Number.parseInt(channel, 16))
    .join(" ");
}

/** Map the compact public theme contract onto every generic presentation token. */
export function themePresentationProperties(
  theme: D6System2eThemeDefinition,
): Readonly<Record<string, string>> {
  const { accent, accentBright, background, muted, text } = theme.tokens;
  const accentRgb = colorChannels(accent);
  const accentBrightRgb = colorChannels(accentBright);
  return Object.freeze({
    "--d6e2-accent": accent,
    "--d6e2-accent-bright": accentBright,
    "--d6e2-accent-rgb": accentRgb,
    "--d6e2-dim": `color-mix(in srgb, ${muted} 66%, black)`,
    "--d6e2-line": `rgb(${accentRgb} / 26%)`,
    "--d6e2-line-strong": `rgb(${accentBrightRgb} / 55%)`,
    "--d6e2-muted": muted,
    "--d6e2-panel": `color-mix(in srgb, ${background} 86%, white)`,
    "--d6e2-panel-raised": `color-mix(in srgb, ${background} 78%, white)`,
    "--d6e2-space": `color-mix(in srgb, ${background} 82%, black)`,
    "--d6e2-text": text,
    "--d6e2-void": `color-mix(in srgb, ${background} 66%, black)`,
    "--od6-accent": accent,
    "--od6-accent-bright": accentBright,
    "--od6-accent-bright-rgb": accentBrightRgb,
    "--od6-accent-deep": `color-mix(in srgb, ${accent} 72%, black)`,
    "--od6-accent-rgb": accentRgb,
    "--od6-accent-soft": `rgb(${accentRgb} / 16%)`,
    "--od6-amber": accentBright,
    "--od6-amber-soft": `rgb(${accentBrightRgb} / 15%)`,
    "--od6-bg": background,
    "--od6-bg-deep": `color-mix(in srgb, ${background} 66%, black)`,
    "--od6-dim": `color-mix(in srgb, ${muted} 66%, black)`,
    "--od6-faction-secondary": `color-mix(in srgb, ${accentBright} 72%, ${text})`,
    "--od6-line": `rgb(${accentRgb} / 26%)`,
    "--od6-line-strong": `rgb(${accentBrightRgb} / 55%)`,
    "--od6-muted": muted,
    "--od6-cyan": accent,
    "--od6-cyan-soft": `rgb(${accentRgb} / 16%)`,
    "--od6-panel": `color-mix(in srgb, ${background} 86%, white)`,
    "--od6-panel-hover": `color-mix(in srgb, ${background} 72%, white)`,
    "--od6-panel-raised": `color-mix(in srgb, ${background} 78%, white)`,
    "--od6-resource-gold": accent,
    "--od6-resource-gold-bright": accentBright,
    "--od6-space": `color-mix(in srgb, ${background} 82%, black)`,
    "--od6-text": text,
    "--od6-void": `color-mix(in srgb, ${background} 66%, black)`,
  });
}

const CLASSIC_THEME: D6System2eThemeDefinition = Object.freeze({
  cssClass: "d6e2-theme-classic",
  dice: Object.freeze({
    body: "#090a0c",
    colorsetId: "d6-system-2e-standard",
    edge: "#c89b45",
    face: "#f0c96c",
    name: "D6 System Second Edition dice",
    systemId: "d6-system-2e",
  }),
  id: "classic",
  label: "OpenD6 Classic",
  pauseIcon: "systems/d6-system-2e/assets/ui/d6-pause-cube.png",
  tokens: Object.freeze({
    accent: "#c89b45",
    accentBright: "#f0c96c",
    background: "#0a0d12",
    muted: "#9a968d",
    text: "#eeeae0",
  }),
});

interface Registration {
  readonly definition: D6System2eThemeDefinition;
  readonly ownerId: string;
}

const themes = new Map<string, Registration>();
const listeners = new Set<() => void>();

function notifyRegistryChanged(): void {
  for (const listener of listeners) listener();
}

export function observeThemeRegistry(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function color(value: string, field: string): string {
  if (!HEX_COLOR_PATTERN.test(value)) {
    throw new TypeError(`Theme ${field} must be a six-digit hex color.`);
  }
  return value;
}

function themeAssetPath(
  ownerId: string,
  value: string,
  field: "dice.wildDieLabels" | "pauseIcon",
): string {
  const path = value.trim();
  if (
    !THEME_ASSET_PATH_PATTERN.test(path) ||
    path.includes("..") ||
    (path.startsWith("modules/") && !path.startsWith(`modules/${ownerId}/`))
  ) {
    throw new TypeError(
      `Theme ${field} must be a safe asset path owned by the registering system or Foundry module.`,
    );
  }
  return path;
}

function normalize(
  ownerId: string,
  definition: D6System2eThemeDefinition,
): D6System2eThemeDefinition {
  if (!ID_PATTERN.test(ownerId)) {
    throw new TypeError(`Theme owner id "${ownerId}" is invalid.`);
  }
  if (!ID_PATTERN.test(definition.id) || definition.id === "classic") {
    throw new TypeError(`Theme id "${definition.id}" is reserved or invalid.`);
  }
  if (!CSS_CLASS_PATTERN.test(definition.cssClass)) {
    throw new TypeError(`Theme CSS class "${definition.cssClass}" is invalid.`);
  }
  if (!definition.label.trim()) throw new TypeError("Theme label is required.");
  const dice = definition.dice;
  if (dice && !ID_PATTERN.test(dice.colorsetId)) {
    throw new TypeError(
      `Theme dice colorset id "${dice.colorsetId}" is invalid.`,
    );
  }
  if (dice && !ID_PATTERN.test(dice.systemId)) {
    throw new TypeError(`Theme dice system id "${dice.systemId}" is invalid.`);
  }
  if (dice && !dice.name.trim()) {
    throw new TypeError("Theme dice name is required.");
  }
  if (dice?.wildDie && !ID_PATTERN.test(dice.wildDie.colorsetId)) {
    throw new TypeError(
      `Theme Wild Die colorset id "${dice.wildDie.colorsetId}" is invalid.`,
    );
  }
  if (dice?.wildDieLabels && dice.wildDieLabels.length !== 6) {
    throw new TypeError("A theme must provide exactly six Wild Die labels.");
  }
  return Object.freeze({
    cssClass: definition.cssClass,
    ...(dice
      ? {
          dice: Object.freeze({
            ...dice,
            body: color(dice.body, "dice.body"),
            edge: color(dice.edge, "dice.edge"),
            face: color(dice.face, "dice.face"),
            name: dice.name.trim(),
            ...(dice.wildDie
              ? {
                  wildDie: Object.freeze({
                    body: color(dice.wildDie.body, "dice.wildDie.body"),
                    colorsetId: dice.wildDie.colorsetId,
                    edge: color(dice.wildDie.edge, "dice.wildDie.edge"),
                    face: color(dice.wildDie.face, "dice.wildDie.face"),
                  }),
                }
              : {}),
            ...(dice.wildDieLabels
              ? {
                  wildDieLabels: Object.freeze(
                    dice.wildDieLabels.map((label) =>
                      THEME_ASSET_PATH_PATTERN.test(label)
                        ? themeAssetPath(ownerId, label, "dice.wildDieLabels")
                        : label,
                    ),
                  ),
                }
              : {}),
          }),
        }
      : {}),
    id: definition.id,
    label: definition.label.trim(),
    ...(definition.pauseIcon
      ? {
          pauseIcon: themeAssetPath(ownerId, definition.pauseIcon, "pauseIcon"),
        }
      : {}),
    tokens: Object.freeze({
      accent: color(definition.tokens.accent, "tokens.accent"),
      accentBright: color(
        definition.tokens.accentBright,
        "tokens.accentBright",
      ),
      background: color(definition.tokens.background, "tokens.background"),
      muted: color(definition.tokens.muted, "tokens.muted"),
      text: color(definition.tokens.text, "tokens.text"),
    }),
  });
}

export const themeRegistry: D6System2eThemeRegistry = Object.freeze({
  current: () =>
    Object.freeze([
      CLASSIC_THEME,
      ...Array.from(themes.values(), ({ definition }) => definition),
    ]),
  register: (ownerId: string, definition: D6System2eThemeDefinition) => {
    const normalized = normalize(ownerId, definition);
    const existing = themes.get(normalized.id);
    if (existing && existing.ownerId !== ownerId) {
      throw new Error(
        `Theme "${normalized.id}" is already registered by "${existing.ownerId}".`,
      );
    }
    themes.set(normalized.id, { definition: normalized, ownerId });
    notifyRegistryChanged();
  },
  unregisterOwner: (ownerId: string) => {
    let changed = false;
    for (const [id, registration] of themes) {
      if (registration.ownerId === ownerId) {
        themes.delete(id);
        changed = true;
      }
    }
    if (changed) notifyRegistryChanged();
  },
});

export function resetThemeRegistryForTests(): void {
  themes.clear();
  listeners.clear();
}
