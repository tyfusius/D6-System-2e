import type { D6RulesSelectionV1 } from "@d6-system-2e/core";
import { currentEditionCapabilityProfile } from "./edition-capabilities";
import { currentGameMode } from "./game-mode";
import { currentRulesProfile } from "./rules-compatibility";

export function currentRulesSelection(): D6RulesSelectionV1 {
  const primaryProfileId = currentGameMode();
  const importedOwner =
    primaryProfileId === "second-edition" ? "open-d6" : "second-edition";
  const importedMechanicIds = currentEditionCapabilityProfile()
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
    resolvedProfileId: currentRulesProfile().id,
  });
}
