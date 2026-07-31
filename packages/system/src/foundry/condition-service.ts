import {
  canPreventBecomingStunned,
  heroPointBalanceAfter,
  isSecondEditionCondition,
  isFirstEditionWoundLevel,
  secondEditionRoundStartCondition,
  type D6ConditionCommandOptions,
  type D6FirstEditionWoundCommandResultV1,
  type D6ConditionCommandResultV1,
  type D6PostureCommandResultV1,
  type SecondEditionCondition,
  type FirstEditionWoundLevel,
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
  await actor.update({
    "system.health.condition": proposed,
    ...(["wounded", "incapacitated", "mortally-wounded", "dead"].includes(
      proposed,
    )
      ? { "system.movement.posture": "prone" }
      : {}),
  });
  return Object.freeze({
    current: proposed,
    heroPointSpent: 0,
    previous,
    prevented: false,
  });
}

export async function setActorFirstEditionWound(
  actorValue: object,
  proposed: FirstEditionWoundLevel,
): Promise<D6FirstEditionWoundCommandResultV1> {
  const actor = actorDocument(actorValue);
  if (actor.isOwner !== true) {
    throw new Error("D6E2.Condition.OwnerRequired");
  }
  if (!isFirstEditionWoundLevel(proposed)) {
    throw new RangeError("D6E2.Condition.Invalid");
  }
  const health = record(actor.system.health);
  const previous = isFirstEditionWoundLevel(health.firstEditionWound)
    ? health.firstEditionWound
    : "healthy";
  if (previous !== proposed) {
    const injuryState = record(health.firstEditionState);
    const injurySource =
      typeof injuryState.source === "string" ? injuryState.source : "none";
    const stateUpdate =
      proposed === "incapacitated"
        ? {
            "system.health.firstEditionState.consciousness": "unresolved",
            "system.health.firstEditionState.source": "incapacitated",
            "system.health.firstEditionState.stunWound": "none",
            "system.health.firstEditionState.unconsciousMinutes": 0,
          }
        : proposed === "mortally-wounded"
          ? {
              "system.health.firstEditionState.consciousness": "unconscious",
              "system.health.firstEditionState.source": "mortally-wounded",
              "system.health.firstEditionState.stunWound": "none",
              "system.health.firstEditionState.unconsciousMinutes": 0,
            }
          : ["incapacitated", "mortally-wounded"].includes(previous) ||
              ["incapacitated", "mortally-wounded"].includes(injurySource)
            ? {
                "system.health.firstEditionState.consciousness": "conscious",
                "system.health.firstEditionState.source": "none",
                "system.health.firstEditionState.stunWound": "none",
                "system.health.firstEditionState.unconsciousMinutes": 0,
              }
            : {};
    await actor.update({
      "system.health.firstEditionWound": proposed,
      ...stateUpdate,
      ...([
        "wounded",
        "severely-wounded",
        "incapacitated",
        "mortally-wounded",
        "dead",
      ].includes(proposed)
        ? { "system.movement.posture": "prone" }
        : {}),
    });
  }
  return Object.freeze({ current: proposed, previous });
}

export async function setActorPosture(
  actorValue: object,
  proposed: unknown,
): Promise<D6PostureCommandResultV1> {
  const actor = actorDocument(actorValue);
  if (actor.isOwner !== true) {
    throw new Error("D6E2.Condition.OwnerRequired");
  }
  if (proposed !== "standing" && proposed !== "prone") {
    throw new RangeError("D6E2.Combat.Error.InvalidPosture");
  }
  const movement = record(actor.system.movement);
  const previous = movement.posture === "prone" ? "prone" : "standing";
  if (previous !== proposed) {
    await actor.update({ "system.movement.posture": proposed });
  }
  return Object.freeze({ current: proposed, previous });
}

export async function recoverActorRoundStartCondition(
  actorValue: object,
): Promise<boolean> {
  const actor = actorDocument(actorValue);
  if (actor.isOwner !== true) return false;
  const health = record(actor.system.health);
  const current = isSecondEditionCondition(health.condition)
    ? health.condition
    : "healthy";
  const recovered = secondEditionRoundStartCondition(current);
  if (recovered === current) return false;
  await actor.update({ "system.health.condition": recovered });
  return true;
}
