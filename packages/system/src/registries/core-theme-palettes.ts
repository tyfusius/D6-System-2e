import type { D6System2eThemeDefinition } from "@d6-system-2e/core";

/** Built-in color choices without typography, branding, or dice definitions. */
export const CORE_THEME_PALETTES: readonly Pick<
  D6System2eThemeDefinition,
  "id" | "label" | "tokens"
>[] = Object.freeze([
  Object.freeze({
    id: "ember",
    label: "Ember",
    // Preserve the existing 1876 Outlaw palette exactly, without importing it.
    tokens: Object.freeze({
      background: "#090607",
      text: "#ead9d1",
      accent: "#f08c80",
      accentBright: "#f3b0a3",
      muted: "#baa69e",
    }),
  }),
  Object.freeze({
    id: "verdigris",
    label: "Verdigris",
    tokens: Object.freeze({
      background: "#081310",
      text: "#e5eee8",
      accent: "#80c4aa",
      accentBright: "#b3dec6",
      muted: "#a4b8ad",
    }),
  }),
  Object.freeze({
    id: "amethyst",
    label: "Amethyst",
    tokens: Object.freeze({
      background: "#100c18",
      text: "#ede7f4",
      accent: "#bda5e5",
      accentBright: "#d8bdf2",
      muted: "#bbafc9",
    }),
  }),
]);
