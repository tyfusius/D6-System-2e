import {
  advanceModelBStimCampaignClock,
  advanceModelBStimCombatClock,
  enterModelBStimCombat,
  leaveModelBStimCombat,
  MODEL_B_STIM_EFFECT_ID,
  MODEL_B_STIM_TIMING_POLICY_ID,
  modelBStimInitialState,
  modelBStimProjection,
  unresolvedModelBStimClock,
  type D6ModelBStimStateV1,
  type FirstEditionWoundLevel,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { currentConfiguredRulesProfile } from "../settings/rules-profile-library";
import {
  destinyClientIsAuthority,
  destinyEnrolledGMIds,
  openDestinyEnvelope,
  sealDestiny,
} from "./destiny-crypto";
import { readActorHealth } from "./health-runtime";

export const MEDICAL_ACTOR_AUTHORITY_FLAG =
  "medicalConsumableAuthority" as const;
export const MEDICAL_ITEM_RECEIPTS_FLAG = "medicalConsumableReceipts" as const;

export interface MedicalUseHistoryV1 {
  readonly version: 1;
  readonly useId: string;
  readonly rootMessageId: string;
  readonly itemName: string;
  readonly summary: string;
  readonly rollMode: "publicroll" | "gmroll" | "selfroll" | "blindroll";
  readonly terminal: "active" | "expired" | "ended" | "needs-attention";
}

export interface MedicalActorAuthorityV1 {
  readonly version: 1;
  readonly active?: D6ModelBStimStateV1;
  readonly history: readonly MedicalUseHistoryV1[];
  readonly audits: readonly {
    readonly version: 1;
    readonly useId: string;
    readonly kind: "repair" | "expiry" | "end";
    readonly beforeClock: string;
    readonly afterClock: string;
    readonly actorUserId: string;
  }[];
  readonly receipts: Readonly<
    Record<string, { readonly version: 1; readonly witness: string }>
  >;
}

const empty = (): MedicalActorAuthorityV1 => ({
  version: 1,
  history: [],
  audits: [],
  receipts: {},
});
const authorityScope = (actorUuid: string) => `medical-consumable:${actorUuid}`;

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
function nonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function validActive(value: unknown): value is D6ModelBStimStateV1 {
  const active = record(value);
  const clock = record(active?.clock);
  if (
    active?.version !== 1 ||
    !nonempty(active.useId) ||
    !nonempty(active.rootMessageId) ||
    active.effectId !== MODEL_B_STIM_EFFECT_ID ||
    active.timingPolicyId !== MODEL_B_STIM_TIMING_POLICY_ID ||
    !Number.isSafeInteger(active.durationRoll) ||
    Number(active.durationRoll) < 1 ||
    Number(active.durationRoll) > 6 ||
    !nonnegative(active.remainingSeconds) ||
    active.remainingSeconds > Number(active.durationRoll) * 5 ||
    !Number.isSafeInteger(active.revision) ||
    Number(active.revision) < 0 ||
    !nonempty(active.sourceActorUuid) ||
    !nonempty(active.sourceItemUuid) ||
    typeof active.sourceItemName !== "string" ||
    !clock ||
    !["campaign", "combat", "unresolved"].includes(String(clock.mode)) ||
    (clock.campaignHighWater !== null &&
      !nonnegative(clock.campaignHighWater)) ||
    (clock.combatRoundHighWater !== null &&
      (!Number.isSafeInteger(clock.combatRoundHighWater) ||
        Number(clock.combatRoundHighWater) < 1)) ||
    (clock.combatUuid !== null && !nonempty(clock.combatUuid))
  )
    return false;
  if (
    (clock.explicitCombatAnchor !== undefined &&
      typeof clock.explicitCombatAnchor !== "boolean") ||
    (clock.explicitCombatAnchor === true && clock.mode !== "combat")
  )
    return false;
  if (
    clock.mode === "combat" &&
    (!nonempty(clock.combatUuid) ||
      !Number.isSafeInteger(clock.combatRoundHighWater))
  )
    return false;
  if (
    clock.mode === "campaign" &&
    (!nonnegative(clock.campaignHighWater) || clock.combatUuid !== null)
  )
    return false;
  return (
    clock.mode !== "unresolved" ||
    ["ambiguous-combat", "invalid-world-time", "missing-combat"].includes(
      String(clock.unresolvedReason),
    )
  );
}

export function parseMedicalActorAuthority(
  value: unknown,
): MedicalActorAuthorityV1 {
  if (!record(value))
    throw new Error("D6E2.Medical.Error.InvalidAuthorityState");
  const state = value as Partial<MedicalActorAuthorityV1>;
  const receipts = record(state.receipts);
  if (
    state.version !== 1 ||
    !Array.isArray(state.history) ||
    !Array.isArray(state.audits) ||
    state.audits.length > 200 ||
    state.history.length > 50 ||
    !receipts ||
    Object.keys(receipts).length > 4096 ||
    (state.active !== undefined && !validActive(state.active)) ||
    state.history.some((raw) => {
      const entry = record(raw);
      return (
        entry?.version !== 1 ||
        !nonempty(entry.useId) ||
        !nonempty(entry.rootMessageId) ||
        typeof entry.itemName !== "string" ||
        typeof entry.summary !== "string" ||
        !["publicroll", "gmroll", "selfroll", "blindroll"].includes(
          String(entry.rollMode),
        ) ||
        !["active", "expired", "ended", "needs-attention"].includes(
          String(entry.terminal),
        )
      );
    }) ||
    state.audits.some((raw) => {
      const audit = record(raw);
      return (
        audit?.version !== 1 ||
        !nonempty(audit.useId) ||
        !["repair", "expiry", "end"].includes(String(audit.kind)) ||
        !nonempty(audit.beforeClock) ||
        !nonempty(audit.afterClock) ||
        typeof audit.actorUserId !== "string"
      );
    }) ||
    Object.entries(receipts).some(([useId, raw]) => {
      const receipt = record(raw);
      return (
        !nonempty(useId) || receipt?.version !== 1 || !nonempty(receipt.witness)
      );
    }) ||
    (state.active !== undefined &&
      (!receipts[state.active.useId] ||
        !state.history.some(({ useId }) => useId === state.active?.useId)))
  )
    throw new Error("D6E2.Medical.Error.InvalidAuthorityState");
  return structuredClone(state as MedicalActorAuthorityV1);
}

export async function readMedicalActorAuthority(
  actor: FoundryActorDocument & { readonly uuid?: string },
): Promise<MedicalActorAuthorityV1> {
  if (!destinyClientIsAuthority() || !actor.uuid)
    throw new Error("D6E2.Medical.Error.NotAuthorized");
  const envelope = actor.getFlag(SYSTEM_ID, MEDICAL_ACTOR_AUTHORITY_FLAG);
  return envelope
    ? parseMedicalActorAuthority(
        await openDestinyEnvelope<unknown>(
          authorityScope(actor.uuid),
          envelope,
        ),
      )
    : empty();
}

async function writeMedicalActorAuthority(
  actor: FoundryActorDocument & { readonly uuid: string },
  state: MedicalActorAuthorityV1,
  marker: {
    readonly version: 0 | 1;
    readonly useId: string;
    readonly effectId: string;
    readonly status: "none" | "active" | "needs-attention";
  },
  options: Record<string, unknown> = {},
): Promise<void> {
  if (!destinyClientIsAuthority())
    throw new Error("D6E2.Medical.Error.NotAuthorized");
  const envelope = await sealDestiny(
    authorityScope(actor.uuid),
    parseMedicalActorAuthority(state),
    destinyEnrolledGMIds(),
  );
  await actor.update(
    {
      [`flags.${SYSTEM_ID}.${MEDICAL_ACTOR_AUTHORITY_FLAG}`]: envelope,
      "system.medical.stim": marker,
    },
    options,
  );
}

export async function applyMedicalStimState(input: {
  readonly administratorUuid: string;
  readonly ambiguousCombat?: boolean;
  readonly actor: FoundryActorDocument & { readonly uuid: string };
  readonly campaignTime: number | null;
  readonly combatRound: number | null;
  readonly combatUuid: string | null;
  readonly durationRoll: number;
  readonly itemName: string;
  readonly itemUuid: string;
  readonly rootMessageId: string;
  readonly rollMode: MedicalUseHistoryV1["rollMode"];
  readonly useId: string;
  readonly witness: string;
}): Promise<D6ModelBStimStateV1> {
  const current = await readMedicalActorAuthority(input.actor);
  if (current.receipts[input.useId]?.witness === input.witness) {
    if (current.active?.useId !== input.useId)
      throw new Error("D6E2.Medical.Error.InvalidAuthorityState");
    return current.active;
  }
  if (Object.keys(current.receipts).length >= 4096)
    throw new Error("D6E2.Medical.Error.InvalidAuthorityState");
  if (current.active && current.active.remainingSeconds > 0)
    throw new Error("D6E2.Medical.Error.ActiveEffect");
  const active = modelBStimInitialState({
    ...(input.ambiguousCombat === undefined
      ? {}
      : { ambiguousCombat: input.ambiguousCombat }),
    campaignTime: input.campaignTime,
    combatRound: input.combatRound,
    combatUuid: input.combatUuid,
    durationRoll: input.durationRoll,
    rootMessageId: input.rootMessageId,
    sourceActorUuid: input.administratorUuid,
    sourceItemName: input.itemName,
    sourceItemUuid: input.itemUuid,
    useId: input.useId,
  });
  const needsAttention = active.clock.mode === "unresolved";
  await writeMedicalActorAuthority(
    input.actor,
    {
      version: 1,
      active,
      audits: current.audits,
      history: [
        ...current.history.slice(-49),
        {
          version: 1,
          useId: input.useId,
          rootMessageId: input.rootMessageId,
          itemName: input.itemName,
          summary: "Model B wound-penalty suppression",
          rollMode: input.rollMode,
          terminal: needsAttention ? "needs-attention" : "active",
        },
      ],
      receipts: {
        ...current.receipts,
        [input.useId]: { version: 1, witness: input.witness },
      },
    },
    {
      version: 1,
      useId: input.useId,
      effectId: active.effectId,
      status: needsAttention ? "needs-attention" : "active",
    },
  );
  return active;
}

export async function reconcileMedicalStimClock(
  actor: FoundryActorDocument & { readonly uuid: string },
  event:
    | { readonly kind: "campaign"; readonly campaignTime: number }
    | {
        readonly kind: "combat";
        readonly combatUuid: string;
        readonly round: number;
      }
    | {
        readonly kind: "enter";
        readonly campaignTime: number;
        readonly combatUuid: string;
        readonly round: number;
      }
    | {
        readonly kind: "leave";
        readonly campaignTime: number;
        readonly combatUuid: string;
        readonly round: number;
      }
    | {
        readonly kind: "sync";
        readonly ambiguousCombat: boolean;
        readonly campaignTime: number | null;
        readonly combatUuid: string | null;
        readonly combatClocks?: readonly {
          readonly combatUuid: string;
          readonly round: number;
        }[];
        readonly round: number | null;
      },
): Promise<D6ModelBStimStateV1 | undefined> {
  const eventValue = event as unknown;
  if (!eventValue || typeof eventValue !== "object")
    throw new Error("D6E2.Medical.Error.InvalidAuthorityState");
  const rawEvent = eventValue as Record<string, unknown>;
  const validPair =
    rawEvent.combatUuid === null && rawEvent.round === null
      ? true
      : nonempty(rawEvent.combatUuid) &&
        Number.isSafeInteger(rawEvent.round) &&
        Number(rawEvent.round) >= 1;
  if (
    !["campaign", "combat", "enter", "leave", "sync"].includes(event.kind) ||
    (event.kind === "campaign" && !nonnegative(event.campaignTime)) ||
    (event.kind === "combat" &&
      (!nonempty(event.combatUuid) ||
        !Number.isSafeInteger(event.round) ||
        event.round < 1)) ||
    ((event.kind === "enter" || event.kind === "leave") &&
      (!nonnegative(event.campaignTime) ||
        !nonempty(event.combatUuid) ||
        !Number.isSafeInteger(event.round) ||
        event.round < 1)) ||
    (event.kind === "sync" &&
      (typeof event.ambiguousCombat !== "boolean" ||
        (event.campaignTime !== null && !nonnegative(event.campaignTime)) ||
        !validPair ||
        (event.combatClocks !== undefined &&
          (!Array.isArray(event.combatClocks) ||
            event.combatClocks.some(
              ({ combatUuid, round }) =>
                !nonempty(combatUuid) ||
                !Number.isSafeInteger(round) ||
                round < 1,
            )))))
  )
    throw new Error("D6E2.Medical.Error.InvalidAuthorityState");
  const current = await readMedicalActorAuthority(actor);
  if (!current.active) return undefined;
  const currentTerminal = current.history.find(
    ({ useId }) => useId === current.active?.useId,
  )?.terminal;
  if (
    current.active.remainingSeconds <= 0 ||
    currentTerminal === "ended" ||
    currentTerminal === "expired"
  )
    return undefined;
  const sync = (state: D6ModelBStimStateV1): D6ModelBStimStateV1 => {
    if (state.clock.mode === "unresolved") return state;
    if (event.kind !== "sync") return state;
    if (
      state.clock.mode === "combat" &&
      state.clock.explicitCombatAnchor === true
    ) {
      const selected = event.combatClocks?.find(
        ({ combatUuid }) => combatUuid === state.clock.combatUuid,
      );
      return selected
        ? advanceModelBStimCombatClock(
            state,
            selected.combatUuid,
            selected.round,
          )
        : unresolvedModelBStimClock(state, "missing-combat");
    }
    if (event.ambiguousCombat)
      return unresolvedModelBStimClock(state, "ambiguous-combat");
    if (event.campaignTime === null || !nonnegative(event.campaignTime))
      return unresolvedModelBStimClock(state, "invalid-world-time");
    const validCombat =
      nonempty(event.combatUuid) &&
      Number.isSafeInteger(event.round) &&
      Number(event.round) >= 1;
    if (state.clock.mode === "campaign")
      return validCombat
        ? enterModelBStimCombat(state, {
            campaignTime: event.campaignTime,
            combatUuid: event.combatUuid,
            round: Number(event.round),
          })
        : advanceModelBStimCampaignClock(state, event.campaignTime);
    if (!validCombat) return unresolvedModelBStimClock(state, "missing-combat");
    if (state.clock.combatUuid !== event.combatUuid)
      return unresolvedModelBStimClock(state, "ambiguous-combat");
    return advanceModelBStimCombatClock(
      state,
      event.combatUuid,
      Number(event.round),
    );
  };
  const next =
    event.kind === "sync"
      ? sync(current.active)
      : event.kind === "campaign"
        ? advanceModelBStimCampaignClock(current.active, event.campaignTime)
        : event.kind === "combat"
          ? advanceModelBStimCombatClock(
              current.active,
              event.combatUuid,
              event.round,
            )
          : event.kind === "enter"
            ? enterModelBStimCombat(current.active, event)
            : leaveModelBStimCombat(current.active, event);
  if (next === current.active) return undefined;
  const terminal: MedicalUseHistoryV1["terminal"] =
    next.remainingSeconds <= 0
      ? "expired"
      : next.clock.mode === "unresolved"
        ? "needs-attention"
        : "active";
  const history = current.history.map((entry) =>
    entry.useId === next.useId ? { ...entry, terminal } : entry,
  );
  await writeMedicalActorAuthority(
    actor,
    {
      ...current,
      active: next,
      history,
      audits:
        current.active.remainingSeconds > 0 && next.remainingSeconds <= 0
          ? [
              ...current.audits.slice(-199),
              {
                version: 1,
                useId: next.useId,
                kind: "expiry",
                beforeClock: JSON.stringify(current.active.clock),
                afterClock: JSON.stringify(next.clock),
                actorUserId: "system",
              },
            ]
          : current.audits,
    },
    next.remainingSeconds <= 0
      ? { version: 0, useId: "", effectId: "", status: "none" }
      : {
          version: 1,
          useId: next.useId,
          effectId: next.effectId,
          status: terminal === "needs-attention" ? "needs-attention" : "active",
        },
    // A serialized view/projection may trigger this reconciliation. Suppress
    // Actor-sheet rendering so that render cannot re-enter the same queue.
    { render: false },
  );
  return next;
}

export async function medicalStimProjectionForActor(input: {
  readonly actor: FoundryActorDocument & { readonly uuid: string };
  readonly wound: FirstEditionWoundLevel;
  readonly woundPenaltyScore: number;
}) {
  const state = await readMedicalActorAuthority(input.actor);
  if (!state.active)
    return {
      active: false,
      applicable: false,
      suppressedPenaltyScore: 0,
    } as const;
  const profile = currentConfiguredRulesProfile();
  const health = readActorHealth(input.actor);
  const physiology = record(record(input.actor.system.medical)?.physiology);
  const wound = health.track?.currentStateId;
  const woundPenaltyScore = Number(health.track?.currentState.penaltyScore);
  const supported =
    health.kind === "track" &&
    health.damageStrategyId === "open-d6.damage.wounds" &&
    health.modelId === "open-d6.health.wound-track" &&
    physiology?.kind === "biological" &&
    (wound === "wounded" || wound === "severely-wounded") &&
    wound === input.wound &&
    Number.isFinite(woundPenaltyScore) &&
    woundPenaltyScore >= 0 &&
    woundPenaltyScore === input.woundPenaltyScore;
  const projection = modelBStimProjection(
    state.active,
    input.wound,
    woundPenaltyScore,
    profile.homebrew.tyfusiusMedicalConsumables,
    supported,
  );
  return {
    active: projection.active,
    applicable: projection.applicable,
    suppressedPenaltyScore: projection.suppressedPenaltyScore,
  } as const;
}

export async function endMedicalStimState(
  actor: FoundryActorDocument & { readonly uuid: string },
  useId: string,
  actorUserId: string,
): Promise<void> {
  const current = await readMedicalActorAuthority(actor);
  if (current.active?.useId !== useId)
    throw new Error("D6E2.Medical.Error.InvalidAuthorityState");
  await writeMedicalActorAuthority(
    actor,
    {
      ...current,
      active: {
        ...current.active,
        remainingSeconds: 0,
        revision: current.active.revision + 1,
      },
      history: current.history.map((entry) =>
        entry.useId === useId
          ? { ...entry, terminal: "ended" as const }
          : entry,
      ),
      audits: [
        ...current.audits.slice(-199),
        {
          version: 1,
          useId,
          kind: "end",
          beforeClock: JSON.stringify(current.active.clock),
          afterClock: JSON.stringify(current.active.clock),
          actorUserId,
        },
      ],
    },
    { version: 0, useId: "", effectId: "", status: "none" },
  );
}

export async function repairMedicalStimTiming(
  actor: FoundryActorDocument & { readonly uuid: string },
  useId: string,
  actorUserId: string,
  input: {
    readonly campaignTime: number;
    readonly combatUuid?: string;
    readonly round?: number;
  },
): Promise<void> {
  const current = await readMedicalActorAuthority(actor);
  if (
    current.active?.useId !== useId ||
    current.active.clock.mode !== "unresolved"
  )
    throw new Error("D6E2.Medical.Error.InvalidAuthorityState");
  const combat =
    input.combatUuid &&
    Number.isSafeInteger(input.round) &&
    Number(input.round) >= 1;
  const active: D6ModelBStimStateV1 = Object.freeze({
    ...current.active,
    clock: Object.freeze(
      combat
        ? {
            campaignHighWater: input.campaignTime,
            combatRoundHighWater: Number(input.round),
            combatUuid: input.combatUuid,
            explicitCombatAnchor: true,
            mode: "combat" as const,
          }
        : {
            campaignHighWater: input.campaignTime,
            combatRoundHighWater: null,
            combatUuid: null,
            mode: "campaign" as const,
          },
    ),
    revision: current.active.revision + 1,
  });
  await writeMedicalActorAuthority(
    actor,
    {
      ...current,
      active,
      history: current.history.map((entry) =>
        entry.useId === useId
          ? { ...entry, terminal: "active" as const }
          : entry,
      ),
      audits: [
        ...current.audits.slice(-199),
        {
          version: 1,
          useId,
          kind: "repair",
          beforeClock: JSON.stringify(current.active.clock),
          afterClock: JSON.stringify(active.clock),
          actorUserId,
        },
      ],
    },
    { version: 1, useId, effectId: active.effectId, status: "active" },
  );
}
