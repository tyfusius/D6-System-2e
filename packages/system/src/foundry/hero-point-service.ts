import { heroPointBalanceAfter } from "@d6-system-2e/core";
import { numberSetting } from "../settings/setting-values";
import { SECOND_EDITION_OPTION_KEYS } from "../settings/settings-catalog";
import { heroicHeroPointsCarryOver } from "../settings/hero-points";
import { currentMetaCurrencyRuntimeStrategy } from "../settings/roll-outcome";
import { withAuthorizedHeroPointUpdate } from "./mechanical-edit-guard";
import { withAuthorizedSuperheroicUpdate } from "./mechanical-edit-guard";
import { currentSecondEditionCampaignProfile } from "../settings/campaign-profile";
import { integer, record } from "./sheets/values";

function actorDocument(value: object): FoundryActorDocument {
  const actor = value as Partial<FoundryActorDocument>;
  if (
    typeof actor.id !== "string" ||
    typeof actor.system !== "object" ||
    typeof actor.update !== "function"
  ) {
    throw new TypeError("A Hero Point transaction requires a Foundry Actor.");
  }
  return actor as FoundryActorDocument;
}

export function heroPointResourceId(): "experiencePoints" | "heroPoints" {
  return currentMetaCurrencyRuntimeStrategy().primaryResource ===
    "experiencePoints"
    ? "experiencePoints"
    : "heroPoints";
}

export function actorHeroPointBalance(actorValue: object): number {
  const actor = actorDocument(actorValue);
  if (currentMetaCurrencyRuntimeStrategy().heroPointStrategy === null) return 0;
  const relationships = record(record(actor.system.superheroic).relationships);
  if (
    currentSecondEditionCampaignProfile().nemesisCompanionsSidekicks &&
    relationships.nemesisActive === true
  ) {
    return Math.max(0, integer(relationships.nemesisPoints));
  }
  return integer(
    record(record(actor.system.resources)[heroPointResourceId()]).value,
  );
}

export async function transactActorHeroPoints(
  actorValue: object,
  spent: number,
  awarded: number,
): Promise<number> {
  const actor = actorDocument(actorValue);
  if (currentMetaCurrencyRuntimeStrategy().heroPointStrategy === null) {
    throw new RangeError("D6E2.Roll.HeroPoint.SecondEditionRequired");
  }
  const relationships = record(record(actor.system.superheroic).relationships);
  if (
    currentSecondEditionCampaignProfile().nemesisCompanionsSidekicks &&
    relationships.nemesisActive === true
  ) {
    const next = heroPointBalanceAfter(
      actorHeroPointBalance(actor),
      spent,
      awarded,
    );
    await withAuthorizedSuperheroicUpdate(actor, () =>
      actor.update({ "system.superheroic.relationships.nemesisPoints": next }),
    );
    return next;
  }
  const resourceId = heroPointResourceId();
  const next = heroPointBalanceAfter(
    actorHeroPointBalance(actor),
    spent,
    awarded,
  );
  await withAuthorizedHeroPointUpdate(actor, () =>
    actor.update({ [`system.resources.${resourceId}.value`]: next }),
  );
  return next;
}

export async function refreshHeroicHeroPointsForNewSession(): Promise<number> {
  if (game.user?.isGM !== true) {
    throw new Error("D6E2.HeroPointSession.GMRequired");
  }
  if (
    currentMetaCurrencyRuntimeStrategy().heroPointStrategy !== "heroic" ||
    heroicHeroPointsCarryOver()
  ) {
    throw new Error("D6E2.HeroPointSession.RefreshUnavailable");
  }
  const starting = currentSecondEditionCampaignProfile().superheroicHeroPoints
    ? 3
    : Math.max(
        0,
        Math.trunc(
          numberSetting(SECOND_EDITION_OPTION_KEYS.startingHeroPoints, 1),
        ),
      );
  const actors = (game.actors?.contents ?? []).filter((actor) =>
    ["character", "creature", "npc"].includes(actor.type),
  );
  await Promise.all(
    actors.map((actor) =>
      withAuthorizedHeroPointUpdate(actor, () =>
        actor.update({ "system.resources.heroPoints.value": starting }),
      ),
    ),
  );
  return actors.length;
}
