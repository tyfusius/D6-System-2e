import {
  D6_FEATURE_SESSION_CONTRACT_VERSION,
  D6_FEATURE_SESSION_MAX_USES,
  type D6FeatureCommandResultV1,
  type D6FeatureInvocationV1,
  type D6FeatureSessionStateV1,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { currentEditionCapabilityProfile } from "../settings/edition-capabilities";
import { withAuthorizedFeatureUpdate } from "./mechanical-edit-guard";
import { integer, record } from "./sheets/values";
import {
  actorHeroPointBalance,
  heroPointResourceId,
} from "./hero-point-service";

const FEATURE_SESSION_FLAG = "featureSession";

function actorDocument(value: object): FoundryActorDocument {
  const actor = value as Partial<FoundryActorDocument>;
  if (
    typeof actor.id !== "string" ||
    typeof actor.system !== "object" ||
    typeof actor.update !== "function"
  ) {
    throw new TypeError("The feature API requires a Foundry Actor document.");
  }
  return actor as FoundryActorDocument;
}

function initialState(): D6FeatureSessionStateV1 {
  return Object.freeze({
    contractVersion: D6_FEATURE_SESSION_CONTRACT_VERSION,
    revision: 0,
    sessionId: "session-1",
    uses: Object.freeze({}),
  });
}

function normalizedState(source: unknown): D6FeatureSessionStateV1 {
  if (
    typeof source !== "object" ||
    source === null ||
    record(source).contractVersion !== D6_FEATURE_SESSION_CONTRACT_VERSION
  ) {
    return initialState();
  }
  const value = record(source);
  const rawUses = record(value.uses);
  const uses = Object.fromEntries(
    Object.entries(rawUses)
      .filter(
        ([id, count]) =>
          id.length > 0 && Number.isSafeInteger(count) && Number(count) >= 0,
      )
      .map(([id, count]) => [
        id,
        Math.min(D6_FEATURE_SESSION_MAX_USES, Number(count)),
      ]),
  );
  return Object.freeze({
    contractVersion: D6_FEATURE_SESSION_CONTRACT_VERSION,
    revision: Math.max(0, integer(value.revision)),
    sessionId:
      typeof value.sessionId === "string" && value.sessionId.length > 0
        ? value.sessionId
        : "session-1",
    uses: Object.freeze(uses),
  });
}

export function readFeatureSession(
  actorValue: object,
): D6FeatureSessionStateV1 {
  const actor = actorDocument(actorValue);
  return normalizedState(actor.getFlag(SYSTEM_ID, FEATURE_SESSION_FLAG));
}

function assertOwner(actor: FoundryActorDocument): void {
  if (game.user?.isGM !== true && actor.isOwner !== true) {
    throw new Error("D6E2.Feature.Error.OwnerRequired");
  }
}

function assertRevision(
  state: D6FeatureSessionStateV1,
  expectedRevision: number,
): void {
  if (state.revision !== expectedRevision) {
    throw new Error("D6E2.Feature.Error.RevisionConflict");
  }
}

function escaped(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

export async function invokeNarrativeFeature(
  actorValue: object,
  itemId: string,
  invocation: D6FeatureInvocationV1,
): Promise<D6FeatureCommandResultV1> {
  const actor = actorDocument(actorValue);
  assertOwner(actor);
  if (currentEditionCapabilityProfile().narrativeFeatures.state !== "active") {
    throw new Error("D6E2.Feature.Error.ModuleRequired");
  }
  const item = actor.items.get(itemId);
  if (!item || !["asset", "trouble"].includes(item.type)) {
    throw new Error("D6E2.Feature.Error.NarrativeFeatureRequired");
  }
  const current = readFeatureSession(actor);
  assertRevision(current, invocation.expectedRevision);
  const uses = integer(current.uses[item.id]);
  if (uses >= D6_FEATURE_SESSION_MAX_USES) {
    throw new Error("D6E2.Feature.Error.SessionLimit");
  }
  if (
    item.type === "asset" &&
    !["hero-point", "roll-bonus"].includes(invocation.choice ?? "")
  ) {
    throw new Error("D6E2.Feature.Error.AssetChoiceRequired");
  }
  const heroPointDelta =
    item.type === "trouble" || invocation.choice === "hero-point" ? 1 : 0;
  const complicationRequired = item.type === "trouble";
  const rollBonusScore =
    item.type === "asset" && invocation.choice === "roll-bonus" ? 9 : 0;
  const next = Object.freeze({
    contractVersion: D6_FEATURE_SESSION_CONTRACT_VERSION,
    revision: current.revision + 1,
    sessionId: current.sessionId,
    uses: Object.freeze({ ...current.uses, [item.id]: uses + 1 }),
  }) satisfies D6FeatureSessionStateV1;
  const changes: Record<string, unknown> = {
    [`flags.${SYSTEM_ID}.${FEATURE_SESSION_FLAG}`]: next,
  };
  if (heroPointDelta === 1) {
    changes[`system.resources.${heroPointResourceId()}.value`] =
      actorHeroPointBalance(actor) + 1;
  }
  await withAuthorizedFeatureUpdate(actor, () => actor.update(changes));
  try {
    await ChatMessage.create({
      content: `<p><strong>${escaped(actor.name)}</strong>: ${escaped(item.name)}</p><p>${complicationRequired ? game.i18n.localize("D6E2.Feature.ComplicationRequired") : rollBonusScore === 9 ? game.i18n.localize("D6E2.Feature.AssetRollBonus") : game.i18n.localize("D6E2.Feature.HeroPointAwarded")}</p>`,
      speaker: ChatMessage.getSpeaker({ actor }),
    });
  } catch (error) {
    console.warn(
      "D6 System Second Edition | Feature state committed but audit chat failed.",
      error,
    );
  }
  return Object.freeze({
    changed: true,
    complicationRequired,
    heroPointDelta,
    itemId: item.id,
    rollBonusScore,
    state: next,
  });
}

export async function resetFeatureSession(
  actorValue: object,
  expectedRevision: number,
): Promise<D6FeatureSessionStateV1> {
  const actor = actorDocument(actorValue);
  if (game.user?.isGM !== true) {
    throw new Error("D6E2.Feature.Error.ResetRequiresGM");
  }
  const current = readFeatureSession(actor);
  assertRevision(current, expectedRevision);
  const next = Object.freeze({
    contractVersion: D6_FEATURE_SESSION_CONTRACT_VERSION,
    revision: current.revision + 1,
    sessionId: `session-${current.revision + 2}`,
    uses: Object.freeze({}),
  }) satisfies D6FeatureSessionStateV1;
  const clearedUses = Object.fromEntries(
    Object.keys(current.uses).map((itemId) => [
      `flags.${SYSTEM_ID}.${FEATURE_SESSION_FLAG}.uses.-=${itemId}`,
      null,
    ]),
  );
  await withAuthorizedFeatureUpdate(actor, () =>
    actor.update({
      [`flags.${SYSTEM_ID}.${FEATURE_SESSION_FLAG}.contractVersion`]:
        next.contractVersion,
      [`flags.${SYSTEM_ID}.${FEATURE_SESSION_FLAG}.revision`]: next.revision,
      [`flags.${SYSTEM_ID}.${FEATURE_SESSION_FLAG}.sessionId`]: next.sessionId,
      ...clearedUses,
    }),
  );
  return next;
}
