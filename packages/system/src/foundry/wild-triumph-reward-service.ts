import type { D6RollResultV1 } from "@d6-system-2e/core";
import { currentMetaCurrencyRuntimeStrategy } from "../settings/roll-outcome";
import { transactActorHeroPoints } from "./hero-point-service";
import { withAuthorizedOpenD6ResourceUpdate } from "./mechanical-edit-guard";
import { awardOpenD6RollResources } from "./open-d6-roll-resource-service";
import { integer, record } from "./sheets/values";

function actorDocument(value: object): FoundryActorDocument {
  const actor = value as Partial<FoundryActorDocument>;
  if (
    typeof actor.id !== "string" ||
    typeof actor.system !== "object" ||
    typeof actor.update !== "function"
  ) {
    throw new TypeError("Wild Triumph rewards require a Foundry Actor.");
  }
  return actor as FoundryActorDocument;
}

export async function applyWildTriumphRewards(
  actorValue: object,
  result: D6RollResultV1,
): Promise<void> {
  const triumph = result.wildTriumph;
  if (!triumph?.triggered) return;
  const actor = actorDocument(actorValue);
  const characterPointAward = Math.max(
    0,
    Math.trunc(triumph.characterPointAward),
  );
  const metaCurrencyAward = Math.max(0, Math.trunc(triumph.metaCurrencyAward));
  if (characterPointAward === 0 && metaCurrencyAward === 0) return;

  const strategy = currentMetaCurrencyRuntimeStrategy();
  if (strategy.id === "open-d6.meta-currency.character-and-fate-points") {
    await awardOpenD6RollResources(
      actor,
      characterPointAward,
      metaCurrencyAward,
    );
    return;
  }

  if (metaCurrencyAward > 0 && strategy.heroPointStrategy !== null) {
    await transactActorHeroPoints(actor, 0, metaCurrencyAward);
  }
  if (characterPointAward > 0) {
    const resources = record(actor.system.resources);
    const current = Math.max(
      0,
      integer(record(resources.characterPoints).value),
    );
    await withAuthorizedOpenD6ResourceUpdate(actor, () =>
      actor.update({
        "system.resources.characterPoints.value": current + characterPointAward,
      }),
    );
  }
}
