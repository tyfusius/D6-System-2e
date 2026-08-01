import {
  applyFirstEditionBodyPointDamage,
  firstEditionBodyPointWound,
  normalizeFirstEditionBodyPoints,
  recoverFirstEditionBodyPoints,
  type FirstEditionBodyPointState,
  type FirstEditionWoundLevel,
} from "@d6-system-2e/core";
import { currentFirstEditionDamageMode } from "../settings/setting-values";
import { setActorFirstEditionWound } from "./condition-service";
import { integer, record } from "./sheets/values";

function actorDocument(value: object): FoundryActorDocument {
  const actor = value as Partial<FoundryActorDocument>;
  if (
    typeof actor.id !== "string" ||
    typeof actor.system !== "object" ||
    typeof actor.update !== "function"
  ) {
    throw new TypeError(
      "The Body Points service requires a Foundry Actor document.",
    );
  }
  return actor as FoundryActorDocument;
}

export function readActorFirstEditionBodyPoints(
  actorValue: object,
): FirstEditionBodyPointState {
  const actor = actorValue as Partial<FoundryActorDocument>;
  if (typeof actor.system !== "object") {
    throw new TypeError(
      "The Body Points reader requires an Actor-shaped source.",
    );
  }
  const value = record(record(actor.system.health).firstEditionBodyPoints);
  return normalizeFirstEditionBodyPoints({
    current: integer(value.current),
    maximum: integer(value.maximum),
  });
}

async function synchronizeDerivedInjury(
  actor: FoundryActorDocument,
  wound: FirstEditionWoundLevel,
): Promise<void> {
  const mode = currentFirstEditionDamageMode();
  if (mode === "body-points-with-wounds") {
    await setActorFirstEditionWound(actor, wound, {
      derivedFromBodyPoints: true,
    });
    return;
  }
  if (mode !== "body-points") return;
  const state = record(record(actor.system.health).firstEditionState);
  const currentSource =
    typeof state.source === "string" ? state.source : "none";
  if (wound === "mortally-wounded" || wound === "dead") {
    await actor.update({
      "system.health.firstEditionState.consciousness": "unconscious",
      "system.health.firstEditionState.source": "mortally-wounded",
      "system.health.firstEditionState.stunWound": "none",
      "system.health.firstEditionState.unconsciousMinutes": 0,
      ...(currentSource === "mortally-wounded"
        ? {}
        : {
            "system.health.firstEditionState.mortalityCheckId": "",
            "system.health.firstEditionState.mortalityRounds": 0,
          }),
    });
  } else if (currentSource === "mortally-wounded") {
    await actor.update({
      "system.health.firstEditionState.consciousness": "conscious",
      "system.health.firstEditionState.source": "none",
      "system.health.firstEditionState.mortalityCheckId": "",
      "system.health.firstEditionState.mortalityRounds": 0,
    });
  }
}

export async function setActorFirstEditionBodyPoints(
  actorValue: object,
  proposed: FirstEditionBodyPointState,
): Promise<FirstEditionBodyPointState> {
  const actor = actorDocument(actorValue);
  if (actor.isOwner !== true) throw new Error("D6E2.Condition.OwnerRequired");
  const normalized = normalizeFirstEditionBodyPoints(proposed);
  await actor.update({
    "system.health.firstEditionBodyPoints": {
      current: normalized.current,
      maximum: normalized.maximum,
    },
  });
  await synchronizeDerivedInjury(
    actor,
    firstEditionBodyPointWound(normalized.current, normalized.maximum),
  );
  return normalized;
}

export async function damageActorFirstEditionBodyPoints(
  actorValue: object,
  difference: number,
): Promise<
  FirstEditionBodyPointState & { readonly wound: FirstEditionWoundLevel }
> {
  const actor = actorDocument(actorValue);
  const next = applyFirstEditionBodyPointDamage(
    readActorFirstEditionBodyPoints(actor),
    difference,
  );
  await actor.update({
    "system.health.firstEditionBodyPoints": {
      current: next.current,
      maximum: next.maximum,
    },
  });
  const wound = firstEditionBodyPointWound(next.current, next.maximum);
  await synchronizeDerivedInjury(actor, wound);
  return Object.freeze({ ...next, wound });
}

export async function healActorFirstEditionBodyPoints(
  actorValue: object,
  recovered: number,
): Promise<
  FirstEditionBodyPointState & { readonly wound: FirstEditionWoundLevel }
> {
  const actor = actorDocument(actorValue);
  const next = recoverFirstEditionBodyPoints(
    readActorFirstEditionBodyPoints(actor),
    recovered,
  );
  await actor.update({
    "system.health.firstEditionBodyPoints": {
      current: next.current,
      maximum: next.maximum,
    },
  });
  const wound = firstEditionBodyPointWound(next.current, next.maximum);
  await synchronizeDerivedInjury(actor, wound);
  return Object.freeze({ ...next, wound });
}
