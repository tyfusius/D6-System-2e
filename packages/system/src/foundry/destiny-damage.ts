import { requireDestinyValue } from "@d6-system-2e/core";
import {
  destinyIncomingWound,
  type D6DestinyEffectV1,
  type D6HealthTrackCommandResultV1,
} from "@d6-system-2e/core";
import {
  SECOND_EDITION_CONDITION_TRACK_MODEL_ID,
  OPEN_D6_WOUND_TRACK_MODEL_ID,
  D6MV_INJURY_TRACK_MODEL_ID,
  currentConfiguredHealthModel,
} from "../settings/health-model-library";
import { currentConfiguredRulesProfile } from "../settings/rules-profile-library";
import { SYSTEM_ID } from "../constants";
import {
  destinyEnabled,
  destinyPrimaryGM,
  destinyPublicState,
} from "./destiny-service";
import { offerDestinyEffect } from "./destiny-effects";
import { foundryRandomId } from "./foundry-random-id";
import {
  applyActorHealthDamageOutcome,
  readActorHealth,
} from "./health-runtime";
import { record } from "./sheets/values";

export interface DestinyDamageIntervention {
  readonly incoming: string;
  readonly command?: D6HealthTrackCommandResultV1;
  readonly evidence?: {
    readonly effectId: string;
    readonly before: string;
    readonly after: string;
    readonly spendId: string;
  };
}

export async function preventDestinyIncomingHit(
  actor: FoundryActorDocument,
  eventId: string,
  incoming: string,
): Promise<DestinyDamageIntervention> {
  if (
    !destinyEnabled() ||
    !destinyPrimaryGM() ||
    destinyPublicState().status !== "active"
  )
    return { incoming };
  const model = currentConfiguredHealthModel(currentConfiguredRulesProfile());
  if (
    model.kind !== "track" ||
    ![
      SECOND_EDITION_CONDITION_TRACK_MODEL_ID,
      OPEN_D6_WOUND_TRACK_MODEL_ID,
      D6MV_INJURY_TRACK_MODEL_ID,
    ].includes(model.id as typeof SECOND_EDITION_CONDITION_TRACK_MODEL_ID) ||
    !eventId
  )
    return { incoming };
  const outcomes = model.track.damageResults.map((r) => r.id);
  const reduction = destinyIncomingWound(outcomes, incoming);
  if (!reduction) return { incoming };
  const pc = (game.users?.contents ?? []).some(
    (u) => !u.isGM && actor.testUserPermission(u, "OWNER"),
  );
  const effect: D6DestinyEffectV1 = await offerDestinyEffect({
    id: foundryRandomId(),
    key: `hit:${eventId}:${actor.id}`,
    kind: "incoming-hit",
    actorId: actor.id,
    userId: requireDestinyValue(game.user).id,
    label: actor.name,
    side: pc ? "light" : "dark",
    before: reduction.before,
    ladder: [],
  });
  if (!effect.spendId) return { incoming };
  const after = reduction.after;
  if (!after) throw new Error("D6E2.Destiny.Error.NoIncomingWound");
  const key = effect.id;
  const receipts = record(actor.getFlag(SYSTEM_ID, "destinyDamage"));
  const receipt = record(receipts[key]);
  const evidence = {
    effectId: effect.id,
    before: incoming,
    after,
    spendId: effect.spendId,
  };
  if (receipt.status === "complete")
    return {
      incoming: after,
      command: receipt.command as D6HealthTrackCommandResultV1,
      evidence,
    };
  if (receipt.status) throw new Error("D6E2.Destiny.Error.PendingRecovery");
  const previous = readActorHealth(actor);
  await actor.update({
    [`flags.${SYSTEM_ID}.destinyDamage`]: {
      ...receipts,
      [key]: { version: 1, status: "applying", eventId, evidence, previous },
    },
  });
  let command: D6HealthTrackCommandResultV1;
  if (after === "none")
    command = {
      previous,
      current: previous,
      heroPointSpent: 0,
      prevented: true,
    };
  else {
    const current = previous.track?.currentStateId;
    if (!current || !model.track.damageTransitions[current]?.[after])
      throw new Error("D6E2.Destiny.Error.NoIncomingWound");
    command = await applyActorHealthDamageOutcome(actor, after);
  }
  await actor.update({
    [`flags.${SYSTEM_ID}.destinyDamage`]: {
      ...record(actor.getFlag(SYSTEM_ID, "destinyDamage")),
      [key]: { version: 1, status: "complete", eventId, evidence, command },
    },
  });
  return { incoming: after, command, evidence };
}

/** Explicit GM reconciliation acknowledges the observed health; never replays a hit. */
export async function acknowledgeDestinyDamage(
  actor: FoundryActorDocument,
  effectId: string,
  reason: string,
): Promise<void> {
  if (!game.user?.isGM) throw new Error("D6E2.Destiny.Error.GMRequired");
  if (!reason.trim() || reason.length > 2000)
    throw new Error("D6E2.Destiny.Error.TextRequired");
  const receipts = record(actor.getFlag(SYSTEM_ID, "destinyDamage"));
  const receipt = record(receipts[effectId]);
  if (receipt.status !== "applying")
    throw new Error("D6E2.Destiny.Error.PendingRecovery");
  const current = readActorHealth(actor);
  const command = {
    previous: receipt.previous ?? current,
    current,
    heroPointSpent: 0,
    prevented: record(receipt.evidence).after === "none",
  };
  await actor.update({
    [`flags.${SYSTEM_ID}.destinyDamage`]: {
      ...receipts,
      [effectId]: {
        ...receipt,
        status: "complete",
        command,
        recovery: { userId: game.user.id, reason },
      },
    },
  });
}
