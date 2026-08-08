import type { D6RulesSelectionV1 } from "@d6-system-2e/core";
import {
  currentConfiguredRulesProfile,
  rulesProfileSettingsWorkspace,
} from "./rules-profile-library";
import { currentRulesRuntime } from "./rules-runtime";

export function currentRulesSelection(): D6RulesSelectionV1 {
  const profile = currentConfiguredRulesProfile();
  const primaryProfileId = profile.id;
  const primaryFamily = rulesProfileSettingsWorkspace(profile);
  const importedOwner =
    primaryFamily === "second-edition" ? "open-d6" : "second-edition";
  const importedMechanicIds = currentRulesRuntime()
    .decisions.filter(
      (decision) =>
        decision.state === "active" && decision.owner === importedOwner,
    )
    .map(({ id }) => id)
    .sort();
  return Object.freeze({
    contractVersion: 1,
    importedMechanicIds: Object.freeze(importedMechanicIds),
    primaryProfileId,
    resolvedProfileId: primaryProfileId,
  });
}
