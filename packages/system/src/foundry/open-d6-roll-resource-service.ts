import type {
  D6RollContextV1,
  D6RollKind,
  D6RollRequestV1,
  D6RollResultV1,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { currentAttributeRole } from "../settings/attributes";
import { currentMetaCurrencyRuntimeStrategy } from "../settings/roll-outcome";
import { withAuthorizedOpenD6ResourceUpdate } from "./mechanical-edit-guard";
import { readCombatantRound } from "./combat-service";
import { integer, record } from "./sheets/values";
import { freeD6FeatureEconomyActive } from "./free-d6-feature-service";

export const OPEN_D6_FATE_POINT_EFFECT_FLAG = "openD6FatePointEffect" as const;

interface OpenD6FatePointEffectV1 {
  readonly combatantId: string;
  readonly round: number;
  readonly version: 1;
}

export interface OpenD6RollResourceState {
  readonly characterPoints: number;
  readonly fatePointActive: boolean;
  readonly fatePoints: number;
}

const transactionQueues = new WeakMap<object, Promise<void>>();

function actorDocument(value: object): FoundryActorDocument {
  const actor = value as Partial<FoundryActorDocument>;
  if (
    typeof actor.id !== "string" ||
    typeof actor.system !== "object" ||
    typeof actor.update !== "function"
  ) {
    throw new TypeError(
      "An Open D6 resource transaction requires a Foundry Actor.",
    );
  }
  return actor as FoundryActorDocument;
}

function fatePointEffect(
  actor: FoundryActorDocument,
): OpenD6FatePointEffectV1 | null {
  const value = record(
    actor.getFlag(SYSTEM_ID, OPEN_D6_FATE_POINT_EFFECT_FLAG),
  );
  return value.version === 1 &&
    typeof value.combatantId === "string" &&
    Number.isSafeInteger(value.round) &&
    Number(value.round) >= 1
    ? {
        combatantId: value.combatantId,
        round: Number(value.round),
        version: 1,
      }
    : null;
}

export function openD6FatePointActive(actorValue: object): boolean {
  const actor = actorDocument(actorValue);
  const effect = fatePointEffect(actor);
  const round = readCombatantRound(actor);
  return (
    effect !== null &&
    round !== null &&
    effect.combatantId === round.combatantId &&
    effect.round === round.round
  );
}

export function readOpenD6RollResources(
  actorValue: object,
): OpenD6RollResourceState {
  const actor = actorDocument(actorValue);
  const resources = record(actor.system.resources);
  return Object.freeze({
    characterPoints: Math.max(
      0,
      integer(record(resources.characterPoints).value),
    ),
    fatePointActive: openD6FatePointActive(actor),
    fatePoints: Math.max(0, integer(record(resources.fatePoints).value)),
  });
}

export function openD6CharacterPointSpendLimit(
  actorValue: object,
  kind: D6RollKind,
  context?: D6RollContextV1,
  itemId?: string,
  attributeId?: string,
): number {
  const actor = actorDocument(actorValue);
  if (context?.firstEditionActiveDefense !== undefined) return 5;
  if (kind === "damage" || kind === "resistance") return 5;
  if (
    kind === "attribute" &&
    attributeId === currentAttributeRole("initiative")
  )
    return 5;
  if (itemId && actor.items.get(itemId)?.type === "specialization") return 5;
  return 2;
}

export function validateOpenD6RollResourceRequest(
  actorValue: object,
  request: D6RollRequestV1,
): void {
  const use = request.openD6Resources;
  if (!use) return;
  const actor = actorDocument(actorValue);
  if (
    currentMetaCurrencyRuntimeStrategy().id !==
    "open-d6.meta-currency.character-and-fate-points"
  ) {
    throw new RangeError("D6E2.Roll.OpenD6Resource.ProfileRequired");
  }
  if (request.source.actorId !== actor.id) {
    throw new RangeError("D6E2.Roll.OpenD6Resource.ActorMismatch");
  }
  if (
    !Number.isSafeInteger(use.characterPointSpend) ||
    use.characterPointSpend < 0
  ) {
    throw new RangeError("D6E2.Roll.OpenD6Resource.CharacterPointLimit");
  }
  const resources = readOpenD6RollResources(actor);
  const limit = openD6CharacterPointSpendLimit(
    actor,
    request.kind,
    request.context,
    request.source.itemId,
    request.source.attributeId,
  );
  if (use.characterPointSpend > limit) {
    throw new RangeError("D6E2.Roll.OpenD6Resource.CharacterPointLimit");
  }
  if (use.characterPointSpend > resources.characterPoints) {
    throw new RangeError("D6E2.Roll.OpenD6Resource.CharacterPointsMissing");
  }
  if (use.fatePoint === "active" && !resources.fatePointActive) {
    throw new RangeError("D6E2.Roll.OpenD6Resource.FatePointInactive");
  }
  if (
    use.fatePoint === "spend" &&
    (resources.fatePointActive || resources.fatePoints < 1)
  ) {
    throw new RangeError(
      resources.fatePointActive
        ? "D6E2.Roll.OpenD6Resource.FatePointAlreadyActive"
        : "D6E2.Roll.OpenD6Resource.FatePointMissing",
    );
  }
}

async function queued<T>(actor: object, work: () => Promise<T>): Promise<T> {
  const previous = transactionQueues.get(actor) ?? Promise.resolve();
  let release = (): void => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  transactionQueues.set(actor, tail);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (transactionQueues.get(actor) === tail) transactionQueues.delete(actor);
  }
}

export async function transactOpenD6RollResources(
  actorValue: object,
  result: D6RollResultV1,
): Promise<OpenD6RollResourceState> {
  const actor = actorDocument(actorValue);
  if (
    currentMetaCurrencyRuntimeStrategy().id !==
    "open-d6.meta-currency.character-and-fate-points"
  ) {
    throw new RangeError("D6E2.Roll.OpenD6Resource.ProfileRequired");
  }
  if (result.request.source.actorId !== actor.id) {
    throw new RangeError("D6E2.Roll.OpenD6Resource.ActorMismatch");
  }
  const characterPointSpend = Math.max(
    0,
    Math.trunc(result.characterPointsSpent ?? 0),
  );
  const fatePointSpend = Math.max(0, Math.trunc(result.fatePointsSpent ?? 0));
  if (characterPointSpend === 0 && fatePointSpend === 0) {
    return readOpenD6RollResources(actor);
  }
  return queued(actor, async () => {
    const current = readOpenD6RollResources(actor);
    const limit = openD6CharacterPointSpendLimit(
      actor,
      result.request.kind,
      result.request.context,
      result.request.source.itemId,
      result.request.source.attributeId,
    );
    if (characterPointSpend > limit) {
      throw new RangeError("D6E2.Roll.OpenD6Resource.CharacterPointLimit");
    }
    if (characterPointSpend > current.characterPoints) {
      throw new RangeError("D6E2.Roll.OpenD6Resource.CharacterPointsMissing");
    }
    if (fatePointSpend > 1 || fatePointSpend > current.fatePoints) {
      throw new RangeError("D6E2.Roll.OpenD6Resource.FatePointMissing");
    }
    if (fatePointSpend > 0 && current.fatePointActive) {
      throw new RangeError("D6E2.Roll.OpenD6Resource.FatePointAlreadyActive");
    }
    const changes: Record<string, unknown> = {
      "system.resources.characterPoints.value":
        current.characterPoints - characterPointSpend,
      "system.resources.fatePoints.value": current.fatePoints - fatePointSpend,
    };
    const round = readCombatantRound(actor);
    if (fatePointSpend > 0 && round !== null) {
      changes[`flags.${SYSTEM_ID}.${OPEN_D6_FATE_POINT_EFFECT_FLAG}`] = {
        combatantId: round.combatantId,
        round: round.round,
        version: 1,
      } satisfies OpenD6FatePointEffectV1;
    }
    await withAuthorizedOpenD6ResourceUpdate(actor, () =>
      actor.update(changes),
    );
    return Object.freeze({
      characterPoints: current.characterPoints - characterPointSpend,
      fatePointActive: fatePointSpend > 0 && round !== null,
      fatePoints: current.fatePoints - fatePointSpend,
    });
  });
}

export async function awardOpenD6RollResources(
  actorValue: object,
  characterPointAward: number,
  fatePointAward: number,
): Promise<OpenD6RollResourceState> {
  const actor = actorDocument(actorValue);
  if (
    currentMetaCurrencyRuntimeStrategy().id !==
    "open-d6.meta-currency.character-and-fate-points"
  ) {
    throw new RangeError("D6E2.Roll.OpenD6Resource.ProfileRequired");
  }
  const characterPoints = Math.max(0, Math.trunc(characterPointAward));
  const fatePoints = Math.max(0, Math.trunc(fatePointAward));
  if (characterPoints === 0 && fatePoints === 0) {
    return readOpenD6RollResources(actor);
  }
  return queued(actor, async () => {
    const current = readOpenD6RollResources(actor);
    await withAuthorizedOpenD6ResourceUpdate(actor, () =>
      actor.update({
        "system.resources.characterPoints.value":
          current.characterPoints + characterPoints,
        "system.resources.fatePoints.value": current.fatePoints + fatePoints,
        ...(freeD6FeatureEconomyActive() && characterPoints > 0
          ? {
              "system.resources.veteranPoints.value":
                Math.max(
                  0,
                  integer(
                    record(record(actor.system.resources).veteranPoints).value,
                  ),
                ) + characterPoints,
            }
          : {}),
      }),
    );
    return Object.freeze({
      characterPoints: current.characterPoints + characterPoints,
      fatePointActive: current.fatePointActive,
      fatePoints: current.fatePoints + fatePoints,
    });
  });
}

export async function clearExpiredOpenD6FatePointEffects(
  actors: readonly FoundryActorDocument[],
): Promise<number> {
  if (game.user?.isGM !== true) return 0;
  let cleared = 0;
  for (const actor of actors) {
    if (fatePointEffect(actor) === null || openD6FatePointActive(actor))
      continue;
    await withAuthorizedOpenD6ResourceUpdate(actor, () =>
      actor.update({
        [`flags.${SYSTEM_ID}.-=${OPEN_D6_FATE_POINT_EFFECT_FLAG}`]: null,
      }),
    );
    cleared += 1;
  }
  return cleared;
}
