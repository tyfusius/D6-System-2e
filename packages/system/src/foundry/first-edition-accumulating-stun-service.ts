import {
  applyFirstEditionAccumulatingStun,
  emptyFirstEditionAccumulatingStuns,
  firstEditionAccumulatingStunThreshold,
  normalizeFirstEditionAccumulatingStuns,
  recoverFirstEditionAccumulatingStunsAtRoundStart as recoverAtRoundStart,
  type FirstEditionAccumulatingStunApplication,
  type FirstEditionAccumulatingStunState,
  type FirstEditionStunDamageResolution,
} from "@d6-system-2e/core";
import { rollFirstEditionAccumulatingStunDuration } from "./rolls/roll-service";
import { integer, record, stringValue } from "./sheets/values";
import { withAuthorizedHealthUpdate } from "./mechanical-edit-guard";
import { firstEditionAttributeRole } from "../settings/first-edition-genre-profile";

export interface AppliedFirstEditionAccumulatingStun extends FirstEditionAccumulatingStunApplication {
  readonly unconsciousMinutes: number;
}

function actorDocument(value: object): FoundryActorDocument {
  const actor = value as Partial<FoundryActorDocument>;
  if (
    typeof actor.id !== "string" ||
    typeof actor.system !== "object" ||
    typeof actor.update !== "function"
  ) {
    throw new TypeError(
      "The accumulating-stuns service requires a Foundry Actor document.",
    );
  }
  return actor as FoundryActorDocument;
}

function strengthPipScore(actor: FoundryActorDocument): number {
  return Math.max(
    0,
    integer(
      record(
        record(actor.system.attributes)[firstEditionAttributeRole("strength")],
      ).score,
    ),
  );
}

export function readFirstEditionAccumulatingStuns(
  actorValue: object,
): FirstEditionAccumulatingStunState {
  const actor = actorValue as Partial<FoundryActorDocument>;
  if (typeof actor.system !== "object") {
    throw new TypeError(
      "The accumulating-stuns reader requires an Actor-shaped source.",
    );
  }
  return normalizeFirstEditionAccumulatingStuns(
    record(record(actor.system.health).firstEditionStuns),
  );
}

export function actorFirstEditionAccumulatingStunThreshold(
  actorValue: object,
): number {
  return firstEditionAccumulatingStunThreshold(
    strengthPipScore(actorDocument(actorValue)),
  );
}

export async function applyActorFirstEditionAccumulatingStun(
  actorValue: object,
  resolution: FirstEditionStunDamageResolution,
): Promise<AppliedFirstEditionAccumulatingStun> {
  const actor = actorDocument(actorValue);
  if (actor.isOwner !== true) throw new Error("D6E2.Condition.OwnerRequired");
  const applied = applyFirstEditionAccumulatingStun(
    readFirstEditionAccumulatingStuns(actor),
    resolution.difference,
    strengthPipScore(actor),
  );
  let unconsciousMinutes = 0;
  if (applied.immediatelyUnconscious) {
    unconsciousMinutes = resolution.unconsciousMinutes;
  } else if (applied.crossedThreshold) {
    const duration = await rollFirstEditionAccumulatingStunDuration(actor);
    unconsciousMinutes = Math.max(0, Math.trunc(duration?.total ?? 0));
  }

  const injuryState = record(record(actor.system.health).firstEditionState);
  const currentSource = stringValue(injuryState.source);
  const becomesUnconscious = unconsciousMinutes > 0;
  await withAuthorizedHealthUpdate(actor, () =>
    actor.update({
      "system.health.firstEditionStuns": applied.state,
      ...(becomesUnconscious && currentSource !== "mortally-wounded"
        ? {
            "system.health.firstEditionState.consciousness": "unconscious",
            "system.health.firstEditionState.source": "stun",
            "system.health.firstEditionState.stunWound": "stunned",
            "system.health.firstEditionState.unconsciousMinutes":
              unconsciousMinutes,
            "system.movement.posture": "prone",
          }
        : {}),
    }),
  );
  return Object.freeze({ ...applied, unconsciousMinutes });
}

export async function clearActorFirstEditionAccumulatingStuns(
  actorValue: object,
): Promise<FirstEditionAccumulatingStunState> {
  const actor = actorDocument(actorValue);
  if (actor.isOwner !== true) throw new Error("D6E2.Condition.OwnerRequired");
  const next = emptyFirstEditionAccumulatingStuns();
  await withAuthorizedHealthUpdate(actor, () =>
    actor.update({ "system.health.firstEditionStuns": next }),
  );
  return next;
}

export async function recoverActorFirstEditionAccumulatingStunsAtRoundStart(
  actorValue: object,
  roundId: string,
): Promise<boolean> {
  const actor = actorDocument(actorValue);
  const current = readFirstEditionAccumulatingStuns(actor);
  const next = recoverAtRoundStart(current, roundId);
  if (
    next.lastProcessedRoundId === current.lastProcessedRoundId &&
    next.roundsRemaining === current.roundsRemaining
  ) {
    return false;
  }
  await withAuthorizedHealthUpdate(actor, () =>
    actor.update({ "system.health.firstEditionStuns": next }),
  );
  return true;
}
