import {
  applyFirstEditionBodyPointDamage,
  firstEditionBodyPointWound,
  normalizeFirstEditionBodyPoints,
  recoverFirstEditionBodyPoints,
  type FirstEditionBodyPointState,
  type FirstEditionWoundLevel,
} from "@d6-system-2e/core";
import { currentConfiguredHealthModel } from "../settings/health-model-library";
import { currentConfiguredRulesProfile } from "../settings/rules-profile-library";
import { firstEditionWoundUpdate } from "./condition-service";
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

function derivedInjuryUpdate(
  actor: FoundryActorDocument,
  wound: FirstEditionWoundLevel,
): Record<string, unknown> {
  const strategyId = currentConfiguredHealthModel(
    currentConfiguredRulesProfile(),
  ).damageStrategyId;
  if (strategyId === "open-d6.damage.body-points-with-wounds") {
    return firstEditionWoundUpdate(actor, wound);
  }
  if (strategyId !== "open-d6.damage.body-points") return {};
  const state = record(record(actor.system.health).firstEditionState);
  const currentSource =
    typeof state.source === "string" ? state.source : "none";
  if (wound === "mortally-wounded" || wound === "dead") {
    return {
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
    };
  } else if (currentSource === "mortally-wounded") {
    return {
      "system.health.firstEditionState.consciousness": "conscious",
      "system.health.firstEditionState.source": "none",
      "system.health.firstEditionState.mortalityCheckId": "",
      "system.health.firstEditionState.mortalityRounds": 0,
    };
  }
  return {};
}

async function persistBodyPoints(
  actor: FoundryActorDocument,
  next: FirstEditionBodyPointState,
): Promise<void> {
  const wound = firstEditionBodyPointWound(next.current, next.maximum);
  const changes = derivedInjuryUpdate(actor, wound);
  for (const [path, value] of Object.entries(changes)) {
    const current = path
      .split(".")
      .reduce<unknown>((source, part) => record(source)[part], actor);
    if (current === value) Reflect.deleteProperty(changes, path);
  }
  const previous = record(record(actor.system.health).firstEditionBodyPoints);
  if (previous.current !== next.current || previous.maximum !== next.maximum)
    changes["system.health.firstEditionBodyPoints"] = {
      current: next.current,
      maximum: next.maximum,
    };
  if (Object.keys(changes).length) await actor.update(changes);
}

export async function setActorFirstEditionBodyPoints(
  actorValue: object,
  proposed: FirstEditionBodyPointState,
): Promise<FirstEditionBodyPointState> {
  const actor = actorDocument(actorValue);
  if (actor.isOwner !== true) throw new Error("D6E2.Condition.OwnerRequired");
  const normalized = normalizeFirstEditionBodyPoints(proposed);
  await persistBodyPoints(actor, normalized);
  return normalized;
}

export async function damageActorFirstEditionBodyPoints(
  actorValue: object,
  difference: number,
): Promise<
  FirstEditionBodyPointState & { readonly wound: FirstEditionWoundLevel }
> {
  const actor = actorDocument(actorValue);
  if (actor.isOwner !== true) throw new Error("D6E2.Condition.OwnerRequired");
  const next = applyFirstEditionBodyPointDamage(
    readActorFirstEditionBodyPoints(actor),
    difference,
  );
  const wound = firstEditionBodyPointWound(next.current, next.maximum);
  await persistBodyPoints(actor, next);
  return Object.freeze({ ...next, wound });
}

export async function healActorFirstEditionBodyPoints(
  actorValue: object,
  recovered: number,
): Promise<
  FirstEditionBodyPointState & { readonly wound: FirstEditionWoundLevel }
> {
  const actor = actorDocument(actorValue);
  if (actor.isOwner !== true) throw new Error("D6E2.Condition.OwnerRequired");
  const next = recoverFirstEditionBodyPoints(
    readActorFirstEditionBodyPoints(actor),
    recovered,
  );
  const wound = firstEditionBodyPointWound(next.current, next.maximum);
  await persistBodyPoints(actor, next);
  return Object.freeze({ ...next, wound });
}
