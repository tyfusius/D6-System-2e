import {
  firstEditionMovementPlan,
  type D6RollResultV1,
  type FirstEditionMovementPlan,
  type FirstEditionMovementPlanInput,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { currentEditionCapabilityProfile } from "../settings/edition-capabilities";
import {
  readCombatantRound,
  spendFirstEditionCombatantAction,
} from "./combat-service";
import { rollFirstEditionMovementCheck } from "./rolls/roll-service";

const MOVEMENT_SKILLS = Object.freeze({
  climb: "climb-jump",
  fly: "flying-zero-g",
  land: "running",
  swim: "swim",
});

function actorDocument(value: object): FoundryActorDocument {
  const actor = value as Partial<FoundryActorDocument>;
  if (typeof actor.id !== "string" || typeof actor.name !== "string") {
    throw new TypeError("First Edition movement requires a Foundry Actor.");
  }
  if (actor.isOwner !== true) {
    throw new Error("D6E2.Combat.Error.NotAuthorized");
  }
  return actor as FoundryActorDocument;
}

export interface FirstEditionActorMovementInput extends Omit<
  FirstEditionMovementPlanInput,
  "hasMovementSkill"
> {
  readonly expectedRevision?: number;
}

export interface FirstEditionActorMovementResolution {
  readonly completed: boolean;
  readonly plan: FirstEditionMovementPlan;
  readonly roll: D6RollResultV1 | null;
  readonly successful: boolean;
}

export async function resolveFirstEditionActorMovement(
  actorValue: object,
  input: FirstEditionActorMovementInput,
): Promise<FirstEditionActorMovementResolution> {
  const actor = actorDocument(actorValue);
  if (
    currentEditionCapabilityProfile().movement.strategy !==
    "open-d6-relative-movement"
  ) {
    throw new Error("D6E2.Combat.Error.FirstEditionMovementInactive");
  }
  const skillKey = MOVEMENT_SKILLS[input.type];
  const hasMovementSkill = actor.items.contents.some(
    (item) => item.type === "skill" && item.system.key === skillKey,
  );
  const plan = firstEditionMovementPlan({ ...input, hasMovementSkill });
  const roll = plan.rollRequired
    ? await rollFirstEditionMovementCheck(actor, plan)
    : null;
  if (plan.rollRequired && roll === null) {
    return Object.freeze({ completed: false, plan, roll, successful: false });
  }
  const roundState = readCombatantRound(actor);
  let trackedAction = false;
  if (
    plan.actionRequired &&
    roundState?.firstEditionCommitment &&
    roundState.firstEditionRemainingActionCount > 0
  ) {
    if (input.expectedRevision !== roundState.revision) {
      throw new Error("D6E2.Combat.Error.RevisionConflict");
    }
    await spendFirstEditionCombatantAction(actor, roundState.revision);
    trackedAction = true;
  }
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/actor/character/first-edition-movement-card.hbs`,
    {
      actor,
      plan,
      actionLabel: game.i18n.localize(
        plan.actionRequired
          ? "D6E2.Combat.Movement.OneAction"
          : "D6E2.Combat.FirstEdition.FreeMovement",
      ),
      trackedAction,
      typeLabel: game.i18n.localize(
        `D6E2.Combat.FirstEdition.Movement.${input.type}`,
      ),
    },
  );
  await ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker({ actor }),
  });
  return Object.freeze({
    completed: true,
    plan,
    roll,
    successful: !plan.rollRequired || roll?.success === true,
  });
}

export async function planFirstEditionActorMovement(
  actorValue: object,
  input: FirstEditionActorMovementInput,
): Promise<FirstEditionMovementPlan> {
  return (await resolveFirstEditionActorMovement(actorValue, input)).plan;
}
