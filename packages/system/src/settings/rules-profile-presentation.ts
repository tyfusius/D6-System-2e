import type { RulesProfileId } from "@d6-system-2e/core";

export function rulesProfileWordmark(profileId: RulesProfileId): string {
  return profileId === "open-d6" ? "OPEN D6" : "D62e";
}

export function applyRulesProfilePresentation(profileId: RulesProfileId): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.d6System2eRulesProfile = profileId;
  root.style.setProperty(
    "--od6-theme-mark",
    JSON.stringify(rulesProfileWordmark(profileId)),
  );
}
