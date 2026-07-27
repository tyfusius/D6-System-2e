import {
  canPreventBecomingStunned,
  heroPointBalanceAfter,
  isSecondEditionCondition,
  type D6ConditionCommandOptions,
  type D6ConditionCommandResultV1,
  type SecondEditionCondition,
} from "@d6-system-2e/core";
import { currentRulesProfile } from "../settings/rules-compatibility";
import { integer, record } from "./sheets/values";

function actorDocument(value: object): FoundryActorDocument {
  const actor = value as Partial<FoundryActorDocument>;
  if (
    typeof actor.id !== "string" ||
    typeof actor.system !== "object" ||
    typeof actor.update !== "function"
  ) {
    throw new TypeError("The condition API requires a Foundry Actor document.");
  }
  return actor as FoundryActorDocument;
}

export async function setActorCondition(
  actorValue: object,
  proposed: SecondEditionCondition,
  options: D6ConditionCommandOptions = {},
): Promise<D6ConditionCommandResultV1> {
  const actor = actorDocument(actorValue);
  if (actor.isOwner !== true) {
    throw new Error("D6E2.Condition.OwnerRequired");
  }
  if (!isSecondEditionCondition(proposed)) {
    throw new RangeError("D6E2.Condition.Invalid");
  }
  const health = record(actor.system.health);
  const previous = isSecondEditionCondition(health.condition)
    ? health.condition
    : "healthy";
  const prevent =
    options.preventStunnedWithHeroPoint === true &&
    canPreventBecomingStunned(previous, proposed);
  if (prevent) {
    if (currentRulesProfile().compatibility.firstEditionMetaCurrency) {
      throw new RangeError("D6E2.Roll.HeroPoint.SecondEditionRequired");
    }
    const resources = record(actor.system.resources);
    const heroPoints = record(resources.heroPoints);
    const balance = integer(heroPoints.value);
    await actor.update({
      "system.resources.heroPoints.value": heroPointBalanceAfter(balance, 1, 0),
    });
    return Object.freeze({
      current: previous,
      heroPointSpent: 1,
      previous,
      prevented: true,
    });
  }
  await actor.update({ "system.health.condition": proposed });
  return Object.freeze({
    current: proposed,
    heroPointSpent: 0,
    previous,
    prevented: false,
  });
}
