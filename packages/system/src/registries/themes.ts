import type {
  D6System2eThemeDefinition,
  D6System2eThemeRegistry,
} from "@d6-system-2e/core";

const ID_PATTERN = /^[a-z][a-z0-9-]*$/u;
const CSS_CLASS_PATTERN = /^[a-z][a-z0-9_-]*$/u;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/iu;

const CLASSIC_THEME: D6System2eThemeDefinition = Object.freeze({
  cssClass: "d6e2-theme-classic",
  id: "classic",
  label: "OpenD6 Classic",
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

function color(value: string, field: string): string {
  if (!HEX_COLOR_PATTERN.test(value)) {
    throw new TypeError(`Theme ${field} must be a six-digit hex color.`);
  }
  return value;
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
            ...(dice.wildDieLabels
              ? { wildDieLabels: Object.freeze([...dice.wildDieLabels]) }
              : {}),
          }),
        }
      : {}),
    id: definition.id,
    label: definition.label.trim(),
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
  },
  unregisterOwner: (ownerId: string) => {
    for (const [id, registration] of themes) {
      if (registration.ownerId === ownerId) themes.delete(id);
    }
  },
});

export function resetThemeRegistryForTests(): void {
  themes.clear();
}
