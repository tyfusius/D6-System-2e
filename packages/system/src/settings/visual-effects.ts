import { SYSTEM_ID } from "../constants";

export const VISUAL_EFFECTS_SETTING_KEY = "visualEffects";

export type VisualEffectsPreference = "automatic" | "full" | "reduced";
export type ResolvedVisualEffects = "full" | "reduced";

const MEDIA_QUERY = "(prefers-reduced-motion: reduce)";
let observedMedia: MediaQueryList | undefined;
let observedListener: (() => void) | undefined;

export function resolveVisualEffects(
  preference: VisualEffectsPreference,
  prefersReducedMotion: boolean,
): ResolvedVisualEffects {
  if (preference === "reduced") return "reduced";
  if (preference === "full") return "full";
  return prefersReducedMotion ? "reduced" : "full";
}

function validPreference(value: unknown): VisualEffectsPreference {
  return value === "full" || value === "reduced" ? value : "automatic";
}

function readPreference(): VisualEffectsPreference {
  try {
    return validPreference(
      game.settings.get(SYSTEM_ID, VISUAL_EFFECTS_SETTING_KEY),
    );
  } catch {
    return "automatic";
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof globalThis.matchMedia === "function" &&
    globalThis.matchMedia(MEDIA_QUERY).matches
  );
}

function applyRootMarkers(preference: VisualEffectsPreference): void {
  if (typeof document === "undefined") return;
  const resolved = resolveVisualEffects(preference, prefersReducedMotion());
  const root = document.documentElement;
  root.dataset.d6e2VisualEffects = preference;
  root.dataset.d6e2VisualEffectsResolved = resolved;
}

function stopObservingOperatingSystemPreference(): void {
  if (observedMedia && observedListener) {
    observedMedia.removeEventListener("change", observedListener);
  }
  observedMedia = undefined;
  observedListener = undefined;
}

function observeOperatingSystemPreference(): void {
  if (typeof globalThis.matchMedia !== "function") return;
  const media = globalThis.matchMedia(MEDIA_QUERY);
  if (observedMedia === media) return;
  stopObservingOperatingSystemPreference();
  observedMedia = media;
  observedListener = () => {
    if (readPreference() === "automatic") applyRootMarkers("automatic");
  };
  media.addEventListener("change", observedListener);
}

/** Apply the client preference and keep Automatic synchronized with the OS. */
export function applyVisualEffectsPreference(
  preference: VisualEffectsPreference = readPreference(),
): void {
  const normalized = validPreference(preference);
  applyRootMarkers(normalized);
  if (normalized === "automatic") observeOperatingSystemPreference();
  else stopObservingOperatingSystemPreference();
}
