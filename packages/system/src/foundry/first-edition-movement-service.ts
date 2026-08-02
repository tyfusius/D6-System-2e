import {
  firstEditionMovementPlan,
  firstEditionSegmentMovementPlan,
  type D6RollResultV1,
  type FirstEditionMovementPlan,
  type FirstEditionMovementPlanInput,
  type FirstEditionSegmentMovementPlan,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { currentEditionCapabilityProfile } from "../settings/edition-capabilities";
import {
  readCombatantRound,
  recordFirstEditionCombatantSegmentMovement,
  spendFirstEditionCombatantAction,
} from "./combat-service";
import {
  rollFirstEditionMovementCheck,
  rollFirstEditionSegmentRunningCheck,
} from "./rolls/roll-service";
import { booleanSetting } from "../settings/setting-values";
import { TYFUSIUS_HOMEBREW_SETTING_KEYS } from "../settings/settings-catalog";

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
  readonly reactive?: boolean;
}

export interface FirstEditionActorMovementResolution {
  readonly completed: boolean;
  readonly plan: FirstEditionMovementPlan;
  readonly roll: D6RollResultV1 | null;
  readonly successful: boolean;
  readonly segmentPlan?: FirstEditionSegmentMovementPlan;
  readonly complication?: boolean;
}

function segmentedMovementEnabled(): boolean {
  return booleanSetting(
    TYFUSIUS_HOMEBREW_SETTING_KEYS.firstEditionSegmentedActions,
    false,
  );
}

export function firstEditionActorSegmentMovementPlan(
  actorValue: object,
  baseMove: number,
): FirstEditionSegmentMovementPlan | null {
  const actor = actorValue as FoundryActorDocument;
  if (typeof actor.id !== "string" || typeof actor.name !== "string") {
    throw new TypeError("Segment movement requires a Foundry Actor.");
  }
  const round = readCombatantRound(actor);
  const commitment = round?.firstEditionCommitment;
  if (!segmentedMovementEnabled() || !round || !commitment) return null;
  const pending = round.firstEditionSegmentMovement;
  if (pending && pending.remainingMovementDistance > 0) {
    return Object.freeze({
      calculable: true,
      diceAllowance: 0,
      lowestEffectiveScore: null,
      maximumDistance: pending.remainingMovementDistance,
      normalDistance: pending.remainingMovementDistance,
      plannedActionCount: commitment.plannedActionCount,
      running: false,
      runningDifficulty: commitment.plannedActionCount * 5,
    });
  }
  const current = round.actions[commitment.spentActionCount];
  const plan = firstEditionSegmentMovementPlan({
    baseMove,
    effectiveScores: round.actions.flatMap((action) =>
      action.effectiveScore === undefined ? [] : [action.effectiveScore],
    ),
    plannedActionCount: commitment.plannedActionCount,
    running: current?.kind === "move",
  });
  if (pending?.movementUsedAtSpentActionCount === commitment.spentActionCount) {
    return Object.freeze({ ...plan, maximumDistance: 0, normalDistance: 0 });
  }
  return plan;
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
  const segmentPlan = firstEditionActorSegmentMovementPlan(
    actor,
    input.baseMove,
  );
  if (segmentPlan && !segmentPlan.calculable) {
    throw new Error("D6E2.Combat.Error.FirstEditionSegmentPoolRequired");
  }
  if (segmentPlan && input.distance > segmentPlan.maximumDistance) {
    throw new Error("D6E2.Combat.Error.FirstEditionSegmentMovementTooFar");
  }
  if (segmentPlan?.running === true && input.type !== "land") {
    throw new Error("D6E2.Combat.Error.FirstEditionRunningRequiresLand");
  }
  const plan = segmentPlan
    ? firstEditionMovementPlan({
        ...input,
        distance: Math.min(input.distance, input.baseMove * 4),
        hasMovementSkill,
      })
    : firstEditionMovementPlan({ ...input, hasMovementSkill });
  if (segmentPlan) {
    const roundState = readCombatantRound(actor);
    if (!roundState) throw new Error("D6E2.Combat.Error.NotInCombat");
    if (input.expectedRevision !== roundState.revision) {
      throw new Error("D6E2.Combat.Error.RevisionConflict");
    }
    const pendingMovement =
      roundState.firstEditionSegmentMovement?.remainingMovementDistance ?? 0;
    if (!roundState.firstEditionSegmentReady) {
      throw new Error("D6E2.Combat.Error.FirstEditionQueueIncomplete");
    }
    if (
      pendingMovement <= 0 &&
      input.reactive !== true &&
      roundState.firstEditionNextCombatantId !== roundState.combatantId
    ) {
      throw new Error("D6E2.Combat.Error.FirstEditionSegmentTurn");
    }
    if (
      pendingMovement <= 0 &&
      input.reactive === true &&
      roundState.firstEditionNextCombatantId === roundState.combatantId
    ) {
      throw new Error("D6E2.Combat.Error.FirstEditionReactionRequiresTrigger");
    }
    const runningRoll = segmentPlan.running
      ? await rollFirstEditionSegmentRunningCheck(
          actor,
          segmentPlan.runningDifficulty,
          input.distance,
        )
      : null;
    if (segmentPlan.running && runningRoll === null) {
      return Object.freeze({
        completed: false,
        plan,
        roll: null,
        segmentPlan,
        successful: false,
      });
    }
    const complication = runningRoll?.wildFaces[0] === 1;
    const runningFailure =
      segmentPlan.running && !complication && runningRoll?.success !== true;
    const withinNormal = input.distance <= segmentPlan.normalDistance;
    const successful =
      !segmentPlan.running ||
      (!complication && !runningFailure) ||
      withinNormal;
    await recordFirstEditionCombatantSegmentMovement(
      actor,
      roundState.revision,
      {
        complication,
        consumeAction: segmentPlan.running,
        distance: input.distance,
        normalDistance: segmentPlan.normalDistance,
        reactive: input.reactive === true,
        runningFailure,
      },
    );
    return Object.freeze({
      completed: true,
      complication,
      plan,
      roll: runningRoll,
      segmentPlan,
      successful,
    });
  }
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
