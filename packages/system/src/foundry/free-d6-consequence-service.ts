import {
  FREE_D6_FATIGUE_CHANNEL_ID,
  applyFreeD6FatigueLevel,
  consequencePenaltyProjection,
  freeD6FatigueProjection,
  normalizeActorConsequenceState,
  type D6ActorConsequenceStateV1,
  type D6ConsequencePenaltyProjectionV1,
  type FreeD6FatigueProjectionV1,
} from "@d6-system-2e/core";
import {
  currentConfiguredRulesProfile,
  profileUsesFreeD6AttributeVocabulary,
} from "../settings/rules-profile-library";
import { readActorHealth } from "./health-runtime";
import { record, stringValue } from "./sheets/values";
import { resolvedConsequenceSuite } from "../registries/consequence-suites";

export const FREE_D6_CONSEQUENCE_STATE_KEY = "free-d6.consequences.v1";
export const FREE_D6_CONSEQUENCE_SUITE_ID =
  "free-d6.consequences.physical-and-fatigue";

function integer(value: unknown): number {
  return Number.isSafeInteger(value) ? Number(value) : 0;
}

function storedState(actor: FoundryActorDocument): unknown {
  return record(record(actor.system.health).tracks)[
    FREE_D6_CONSEQUENCE_STATE_KEY
  ];
}

export function freeD6ConsequenceSuiteActive(): boolean {
  const selected = currentConfiguredRulesProfile().strategies.consequenceSuite;
  return (
    selected === FREE_D6_CONSEQUENCE_SUITE_ID &&
    resolvedConsequenceSuite(selected) !== null
  );
}

export function freeD6ConsequenceSuiteState():
  "active" | "other" | "unavailable" {
  const profile = currentConfiguredRulesProfile();
  if (!profileUsesFreeD6AttributeVocabulary(profile)) return "other";
  return profile.strategies.consequenceSuite === FREE_D6_CONSEQUENCE_SUITE_ID &&
    resolvedConsequenceSuite(FREE_D6_CONSEQUENCE_SUITE_ID) !== null
    ? "active"
    : "unavailable";
}

export function readFreeD6ConsequenceState(
  actor: FoundryActorDocument,
): D6ActorConsequenceStateV1 {
  return normalizeActorConsequenceState(storedState(actor));
}

function skillScore(actor: FoundryActorDocument, key: string): number {
  const skill = actor.items.contents.find(
    (item) => item.type === "skill" && stringValue(item.system.key) === key,
  );
  if (!skill) return 0;
  const attributeId = stringValue(skill.system.attributeId);
  return (
    integer(record(record(actor.system.attributes)[attributeId]).score) +
    integer(skill.system.score)
  );
}

export function freeD6FatigueForActor(
  actor: FoundryActorDocument,
): FreeD6FatigueProjectionV1 {
  const state = readFreeD6ConsequenceState(actor);
  const level = state.channels[FREE_D6_FATIGUE_CHANNEL_ID]?.level ?? 0;
  const stamina = skillScore(actor, "stamina");
  const willpower = skillScore(actor, "willpower");
  return freeD6FatigueProjection(
    level,
    stamina,
    willpower > 0 ? willpower : undefined,
  );
}

export function freeD6FatigueAllowsActions(
  actor: FoundryActorDocument,
): boolean {
  return !freeD6FatigueForActor(actor).unconscious;
}

export function freeD6ConsequencePenaltyProjection(
  actor: FoundryActorDocument,
): D6ConsequencePenaltyProjectionV1 {
  const physical = readActorHealth(actor).track?.currentState;
  const fatigue = freeD6FatigueForActor(actor);
  return consequencePenaltyProjection([
    ...(physical && physical.penaltyScore > 0
      ? [
          {
            channelId: "d6e2.consequence.physical",
            label: physical.label,
            penaltyScore: physical.penaltyScore,
            scope: "all-rolls" as const,
            stackingGroup: "consequences",
          },
        ]
      : []),
    fatigue.effect,
  ]);
}

export function plannedFreeD6FatigueState(
  actor: FoundryActorDocument,
  level: number,
  options: {
    readonly expectedRevision?: number;
    readonly source?: string;
  } = {},
): D6ActorConsequenceStateV1 {
  const stamina = skillScore(actor, "stamina");
  const willpower = skillScore(actor, "willpower");
  return applyFreeD6FatigueLevel(storedState(actor), level, stamina, {
    ...(options.expectedRevision === undefined
      ? {}
      : { expectedRevision: options.expectedRevision }),
    ...(options.source === undefined ? {} : { source: options.source }),
    ...(willpower > 0 ? { willpowerScore: willpower } : {}),
  });
}

async function persistState(
  actor: FoundryActorDocument,
  next: D6ActorConsequenceStateV1,
): Promise<void> {
  if (actor.isOwner !== true && game.user?.isGM !== true) {
    throw new Error("D6E2.Consequences.Error.OwnerRequired");
  }
  const tracks = structuredClone(record(record(actor.system.health).tracks));
  tracks[FREE_D6_CONSEQUENCE_STATE_KEY] = next;
  await actor.update({ "system.health.tracks": tracks });
}

export async function setFreeD6FatigueLevel(
  actor: FoundryActorDocument,
  level: number,
  options: {
    readonly expectedRevision?: number;
    readonly source?: string;
  } = {},
): Promise<FreeD6FatigueProjectionV1> {
  if (!freeD6ConsequenceSuiteActive()) {
    throw new Error("D6E2.Consequences.Error.SuiteInactive");
  }
  const next = plannedFreeD6FatigueState(actor, level, options);
  await persistState(actor, next);
  return freeD6FatigueForActor({
    ...actor,
    system: {
      ...actor.system,
      health: {
        ...record(actor.system.health),
        tracks: {
          ...record(record(actor.system.health).tracks),
          [FREE_D6_CONSEQUENCE_STATE_KEY]: next,
        },
      },
    },
  });
}

export async function addFreeD6Fatigue(
  actor: FoundryActorDocument,
  source = "",
): Promise<FreeD6FatigueProjectionV1> {
  const state = readFreeD6ConsequenceState(actor);
  const current = state.channels[FREE_D6_FATIGUE_CHANNEL_ID];
  return setFreeD6FatigueLevel(actor, (current?.level ?? 0) + 1, {
    expectedRevision: current?.revision ?? 0,
    source,
  });
}

export async function recoverFreeD6Fatigue(
  actor: FoundryActorDocument,
  levels = 1,
  source = "recovery",
): Promise<FreeD6FatigueProjectionV1> {
  const state = readFreeD6ConsequenceState(actor);
  const current = state.channels[FREE_D6_FATIGUE_CHANNEL_ID];
  return setFreeD6FatigueLevel(
    actor,
    Math.max(0, (current?.level ?? 0) - Math.max(1, integer(levels))),
    { expectedRevision: current?.revision ?? 0, source },
  );
}
