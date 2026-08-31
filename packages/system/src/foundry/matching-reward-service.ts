import type {
  D6MatchingRewardPlanV1,
  D6MatchingRewardSnapshotV1,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { currentMetaCurrencyRuntimeStrategy } from "../settings/roll-outcome";
import { withAuthorizedOpenD6ResourceUpdate } from "./mechanical-edit-guard";
import { integer, record } from "./sheets/values";
import { freeD6FeatureEconomyActive } from "./free-d6-feature-service";

const LEDGER_FLAG = "matchingRewardOperations";
const actorQueues = new WeakMap<object, Promise<unknown>>();

function metaResource(): D6MatchingRewardSnapshotV1["metaCurrencyResource"] {
  const strategy = currentMetaCurrencyRuntimeStrategy();
  return strategy.secondaryResource === "fatePoints"
    ? "fatePoints"
    : strategy.primaryResource === "characterPoints"
      ? "heroPoints"
      : strategy.primaryResource;
}

function queue<T>(actor: object, operation: () => Promise<T>): Promise<T> {
  const prior = actorQueues.get(actor) ?? Promise.resolve();
  const next = prior.catch(() => undefined).then(operation);
  actorQueues.set(actor, next);
  return next.finally(() => {
    if (actorQueues.get(actor) === next) actorQueues.delete(actor);
  });
}

export async function applyD6MatchingReward(
  actor: FoundryActorDocument,
  plan: D6MatchingRewardPlanV1,
): Promise<D6MatchingRewardSnapshotV1> {
  return queue(actor, async () => {
    const resource = metaResource();
    const prior = Array.isArray(actor.getFlag(SYSTEM_ID, LEDGER_FLAG))
      ? (actor.getFlag(SYSTEM_ID, LEDGER_FLAG) as string[])
      : [];
    const base = { ...plan, metaCurrencyResource: resource } as const;
    if (prior.includes(plan.operationId))
      return Object.freeze({ ...base, status: "granted" as const });
    const resources = record(actor.system.resources);
    const changes: Record<string, unknown> = {
      [`flags.${SYSTEM_ID}.${LEDGER_FLAG}`]: Object.freeze(
        [...prior, plan.operationId].slice(-100),
      ),
    };
    if (plan.characterPoints > 0) {
      changes["system.resources.characterPoints.value"] =
        Math.max(0, integer(record(resources.characterPoints).value)) +
        plan.characterPoints;
      if (freeD6FeatureEconomyActive()) {
        changes["system.resources.veteranPoints.value"] =
          Math.max(0, integer(record(resources.veteranPoints).value)) +
          plan.characterPoints;
      }
    }
    if (plan.metaCurrency > 0) {
      changes[`system.resources.${resource}.value`] =
        Math.max(0, integer(record(resources[resource]).value)) +
        plan.metaCurrency;
    }
    try {
      await withAuthorizedOpenD6ResourceUpdate(actor, () =>
        actor.update(changes),
      );
      return Object.freeze({ ...base, status: "granted" as const });
    } catch {
      return Object.freeze({ ...base, status: "failed" as const });
    }
  });
}
