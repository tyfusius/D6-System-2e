import {
  isFirstEditionWoundLevel,
  MODEL_B_STIM_EFFECT_ID,
  type D6RollMode,
} from "@d6-system-2e/core";
import {
  advanceMedicalConsumableRoot,
  createMedicalConsumableRoot,
  medicalConsumableRootCanCancel,
  parseMedicalConsumableRoot,
  type MedicalConsumableRootV1,
} from "../application/medical-consumable-root";
import {
  cancelFirstEditionAction,
  claimFirstEditionActionStage,
  FirstEditionActionError,
  recordFirstEditionActionStage,
} from "../application/first-edition-action-root";
import type {
  FirstEditionActionRoot,
  FirstEditionStageReceipt,
} from "../application/first-edition-action-contract";
import { executeFirstEditionEffect } from "../application/first-edition-action-ports";
import {
  canonical,
  object,
  text,
} from "../application/first-edition-action-validation";
import { SYSTEM_ID } from "../constants";
import { currentConfiguredRulesProfile } from "../settings/rules-profile-library";
import { currentActionEconomyRuntimeStrategy } from "../settings/action-economy";
import { readActorHealth } from "./health-runtime";
import {
  destinyActiveAuthority,
  destinyClientIsAuthority,
  destinyEnrolledGMIds,
  destinyNativeAuthor,
  heartbeatDestinyCrypto,
  openDestinyEnvelope,
  sealDestiny,
} from "./destiny-crypto";
import { chatVisibilityForMode } from "./rolls/chat-visibility";
import { foundryRandomId } from "./foundry-random-id";
import { hydrateD6FoundryRolls } from "./initiating-action-message";
import {
  applyMedicalStimState,
  MEDICAL_ITEM_RECEIPTS_FLAG,
  medicalStimProjectionForActor,
  readMedicalActorAuthority,
  reconcileMedicalStimClock,
  endMedicalStimState,
  repairMedicalStimTiming,
} from "./medical-consumable-state";
import {
  readCombatantRound,
  readFirstEditionCombatantActionReceipt,
  spendFirstEditionCombatantAction,
} from "./combat-service";
import { PRIVATE_COMBAT_AUTHORITY } from "./combat-round-private";
import { registerFoundryPendingInteraction } from "./pending-interactions";
import { resolveD6PendingInteraction } from "../application/pending-interactions";
import { requireGridStorageItemAction } from "./grid-storage-availability";
import { requestGridStorageOperation } from "./grid-storage-authority";
import { gridStorageItemParticipates } from "./grid-storage-document-adapter";
import { readGridStorageAuthorityState } from "./grid-storage-state";
import {
  GRID_STORAGE_AUTHORITY_WRITE_OPTION,
  synchronizeGridStorageItemWitness,
} from "./grid-storage-mutation-guard";

export const MEDICAL_ROOT_FLAG = "medicalConsumableRoot" as const;
const BINDINGS = "medicalConsumableAuthority";
type EffectReceipt = Extract<FirstEditionStageReceipt, { kind: "effect" }>;
export type MedicalEffectStatus =
  "active" | "expired" | "ended" | "needs-attention";

interface MedicalBindingV1 {
  readonly version: 1;
  readonly useId: string;
  readonly initiatorUserId: string;
  readonly administratorUuid: string;
  readonly patientUuid: string;
  readonly itemUuid: string;
  readonly beforeQuantity: number;
  readonly itemName: string;
  readonly itemDefinitionWitness: string;
  readonly patientState: {
    readonly version: 1;
    readonly physiologyRevision: number;
    readonly wound: "wounded" | "severely-wounded";
    readonly healthModelId: "open-d6.health.wound-track";
    readonly damageStrategyId: "open-d6.damage.wounds";
  };
  readonly actionContext:
    | { readonly kind: "untracked" }
    | {
        readonly kind: "tracked";
        readonly combatantId: string;
        readonly round: number;
        readonly revision: number;
        readonly actionEconomyStrategyId: string;
      };
  readonly witness: string;
  readonly rollMode: D6RollMode;
  readonly initialRoot: MedicalConsumableRootV1;
  readonly latestRoot: MedicalConsumableRootV1;
  readonly effectStatus?: MedicalEffectStatus;
  readonly untrackedActionReceipt?: {
    readonly version: 1;
    readonly useId: string;
    readonly witness: string;
  };
  readonly trackedActionReceipt?: {
    readonly version: 1;
    readonly useId: string;
    readonly witness: string;
  };
  readonly approval?: {
    readonly version: 1;
    readonly requestId: string;
    readonly controllerUserId: string;
    readonly useId: string;
  };
  readonly retired?: true;
  readonly termination?: {
    readonly version: 1;
    readonly userId: string;
    readonly reason: "manual";
    readonly actionRevision: number;
    readonly actionReceipt: string | null;
    readonly itemReceipt: string | null;
    readonly patientReceipt: string | null;
  };
}

interface MedicalApprovalProofV1 {
  readonly version: 1;
  readonly requestId: string;
  readonly controllerUserId: string;
  readonly useId: string;
}

const approvals = new Map<
  string,
  {
    readonly requesterUserId: string;
    readonly targetUserId: string;
    readonly useId: string;
    resolve(value: boolean): void;
  }
>();

function patientController(
  patient: FoundryActorDocument,
): FoundryUser | undefined {
  return (game.users?.contents ?? [])
    .filter(
      (candidate) =>
        candidate.active &&
        !candidate.isGM &&
        patient.testUserPermission(candidate, "OWNER"),
    )
    .sort((left, right) => left.id.localeCompare(right.id))[0];
}

async function requestPatientApproval(
  patient: FoundryActorDocument,
  administrator: FoundryActorDocument,
  requester: FoundryUser,
  useId: string,
): Promise<MedicalApprovalProofV1> {
  const controller = patientController(patient);
  if (!controller) throw new FirstEditionActionError("authority");
  const requestId = foundryRandomId();
  const createdAt = Date.now();
  const expiresAt = createdAt + 60_000;
  const accepted = await new Promise<boolean>((resolve) => {
    approvals.set(requestId, {
      requesterUserId: requester.id,
      targetUserId: controller.id,
      useId,
      resolve,
    });
    setTimeout(() => {
      const pending = approvals.get(requestId);
      if (!pending) return;
      approvals.delete(requestId);
      pending.resolve(false);
    }, 60_000);
    game.socket?.emit(
      `system.${SYSTEM_ID}`,
      {
        type: "medical-approval-request",
        requestId,
        requesterUserId: requester.id,
        targetUserId: controller.id,
        useId,
        gmUserId: game.user?.id,
        createdAt,
        expiresAt,
        administratorName: administrator.name,
        patientId: patient.id,
        patientName: patient.name,
      },
      { recipients: [controller.id] },
    );
  });
  if (!accepted) throw new FirstEditionActionError("authority");
  return {
    version: 1,
    requestId,
    controllerUserId: controller.id,
    useId,
  };
}

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

let renderer: (
  root: MedicalConsumableRootV1,
  effectStatus?: MedicalEffectStatus,
) => Promise<string> = () => Promise.resolve("");
export function setMedicalRootRenderer(value: typeof renderer): void {
  renderer = value;
}
function invalid(): never {
  throw new FirstEditionActionError("invalid");
}
function requireAuthority(): void {
  if (!destinyClientIsAuthority())
    throw new FirstEditionActionError("authority");
}
function allowed(user: FoundryUser, actor: FoundryActorDocument): boolean {
  return user.active && (user.isGM || actor.testUserPermission(user, "OWNER"));
}
function canObserve(user: FoundryUser, actor: FoundryActorDocument): boolean {
  const observableActor = actor as FoundryActorDocument & {
    testUserPermission(candidate: FoundryUser, level: string): boolean;
  };
  return (
    user.active &&
    (user.isGM || observableActor.testUserPermission(user, "OBSERVER"))
  );
}
const medicalStatusRefreshTimers = new Set<ReturnType<typeof setTimeout>>();
function scheduleMedicalStatusRefresh(
  actor: FoundryActorDocument & { readonly uuid: string },
): void {
  const localUserId = game.user?.id;
  const timer = setTimeout(() => {
    medicalStatusRefreshTimers.delete(timer);
    actor.sheet.render(false);
    const recipients = (game.users?.contents ?? [])
      .filter((user) => user.id !== localUserId && canObserve(user, actor))
      .map(({ id }) => id);
    if (recipients.length)
      game.socket?.emit(
        `system.${SYSTEM_ID}`,
        { type: "medical-status-refresh", actorUuid: actor.uuid },
        { recipients },
      );
  }, 0);
  medicalStatusRefreshTimers.add(timer);
}
export function resetMedicalConsumableAuthorityForTests(): void {
  for (const timer of medicalStatusRefreshTimers) clearTimeout(timer);
  medicalStatusRefreshTimers.clear();
}
async function actorDocument(uuid: string) {
  const actor = (await fromUuid(uuid)) as
    (FoundryActorDocument & { readonly uuid: string }) | null;
  if (!actor?.uuid || actor.uuid !== uuid)
    throw new FirstEditionActionError("deleted");
  return actor;
}
async function itemDocument(uuid: string) {
  const item = (await fromUuid(uuid)) as
    | (FoundryItemDocument & {
        readonly uuid: string;
        readonly parent?: FoundryActorDocument;
      })
    | null;
  if (!item?.uuid || item.uuid !== uuid || item.type !== "gear")
    throw new FirstEditionActionError("deleted");
  return item;
}
function itemDefinitionWitness(item: FoundryItemDocument): string {
  const medical = object(item.system.medicalConsumable);
  return canonical({
    type: item.type,
    gearCategory: item.system.gearCategory,
    medicalConsumable: medical,
  });
}
function runningCombatClocksForActor(actor: {
  readonly uuid: string;
}): readonly {
  readonly combatUuid: string;
  readonly round: number;
}[] {
  return (
    (game as unknown as { readonly combats?: { contents?: unknown[] } }).combats
      ?.contents ?? []
  ).flatMap((combat) => {
    if ((combat as { readonly started?: unknown }).started === false) return [];
    const uuid = (combat as { readonly uuid?: unknown }).uuid;
    const round = Number((combat as { readonly round?: unknown }).round);
    const combatants =
      (
        combat as {
          readonly combatants?: {
            readonly contents?: readonly { readonly actor?: unknown }[];
          };
        }
      ).combatants?.contents ?? [];
    const contains = combatants.some(({ actor: candidate }) => {
      const uuid = (candidate as { readonly uuid?: unknown } | undefined)?.uuid;
      return uuid === actor.uuid;
    });
    return contains &&
      typeof uuid === "string" &&
      Number.isSafeInteger(round) &&
      round >= 1
      ? [{ combatUuid: uuid, round }]
      : [];
  });
}
function currentMedicalClockEvent(actor: { readonly uuid: string }) {
  const clocks = runningCombatClocksForActor(actor);
  const combatClock = clocks.length === 1 ? clocks[0] : undefined;
  const campaign = (game as unknown as { time?: { worldTime?: unknown } }).time
    ?.worldTime;
  return {
    kind: "sync" as const,
    ambiguousCombat: clocks.length > 1,
    campaignTime:
      Number.isFinite(campaign) && Number(campaign) >= 0
        ? Number(campaign)
        : null,
    combatUuid: combatClock?.combatUuid ?? null,
    combatClocks: clocks,
    round: combatClock?.round ?? null,
  };
}
function medicalVisibility(mode: D6RollMode, initiatorUserId: string) {
  const gmIds =
    game.users?.contents.filter((user) => user.isGM).map((user) => user.id) ??
    [];
  const scope = chatVisibilityForMode(mode, gmIds, initiatorUserId);
  return { blind: scope.blind ?? false, whisper: scope.whisper ?? [] };
}
function rootHasSavedProgress(root: MedicalConsumableRootV1): boolean {
  return root.action.stages.some(({ state }) => state !== "pending");
}
function actionReceiptMatches(
  binding: MedicalBindingV1,
  administrator: FoundryActorDocument,
): boolean {
  if (binding.actionContext.kind !== "tracked") return false;
  const receipt = object(
    readFirstEditionCombatantActionReceipt(
      administrator,
      `${binding.useId}:action`,
      binding.actionContext.combatantId,
    ),
  );
  return (
    receipt?.useId === binding.useId && receipt.witness === binding.witness
  );
}
function parseBindings(value: unknown): Record<string, MedicalBindingV1> {
  if (value == null) return {};
  const source = object(value),
    roots = object(source?.roots);
  if (source?.version !== 1 || !roots) invalid();
  for (const [id, raw] of Object.entries(roots)) {
    const b = object(raw);
    const initialRoot = parseMedicalConsumableRoot(b?.initialRoot);
    const approval = object(b?.approval);
    const termination = object(b?.termination);
    const untrackedActionReceipt = object(b?.untrackedActionReceipt);
    const patientState = object(b?.patientState);
    const actionContext = object(b?.actionContext);
    const latestRoot = parseMedicalConsumableRoot(b?.latestRoot);
    if (
      !text(id) ||
      b?.version !== 1 ||
      !text(b.useId) ||
      !text(b.initiatorUserId) ||
      !text(b.administratorUuid) ||
      !text(b.patientUuid) ||
      !text(b.itemUuid) ||
      !Number.isSafeInteger(b.beforeQuantity) ||
      Number(b.beforeQuantity) < 1 ||
      typeof b.itemName !== "string" ||
      !text(b.itemDefinitionWitness) ||
      patientState?.version !== 1 ||
      !Number.isSafeInteger(patientState.physiologyRevision) ||
      Number(patientState.physiologyRevision) < 0 ||
      !["wounded", "severely-wounded"].includes(String(patientState.wound)) ||
      patientState.healthModelId !== "open-d6.health.wound-track" ||
      patientState.damageStrategyId !== "open-d6.damage.wounds" ||
      !actionContext ||
      !["tracked", "untracked"].includes(String(actionContext.kind)) ||
      (actionContext.kind === "tracked" &&
        (!text(actionContext.combatantId) ||
          !Number.isSafeInteger(actionContext.round) ||
          Number(actionContext.round) < 1 ||
          !Number.isSafeInteger(actionContext.revision) ||
          Number(actionContext.revision) < 0 ||
          !text(actionContext.actionEconomyStrategyId))) ||
      !text(b.witness) ||
      !["publicroll", "gmroll", "selfroll", "blindroll"].includes(
        String(b.rollMode),
      ) ||
      !initialRoot ||
      !latestRoot ||
      initialRoot.useId !== b.useId ||
      initialRoot.action.rootMessageId !== id ||
      initialRoot.initiatorUserId !== b.initiatorUserId ||
      initialRoot.item.itemUuid !== b.itemUuid ||
      initialRoot.item.beforeQuantity !== b.beforeQuantity ||
      initialRoot.rollMode !== b.rollMode ||
      initialRoot.action.status !== "open" ||
      !initialRoot.action.stages.every(({ state }) => state === "pending") ||
      latestRoot.useId !== b.useId ||
      latestRoot.action.rootMessageId !== id ||
      latestRoot.initiatorUserId !== b.initiatorUserId ||
      latestRoot.item.itemUuid !== b.itemUuid ||
      latestRoot.item.beforeQuantity !== b.beforeQuantity ||
      latestRoot.rollMode !== b.rollMode ||
      (b.effectStatus !== undefined &&
        (typeof b.effectStatus !== "string" ||
          !["active", "expired", "ended", "needs-attention"].includes(
            b.effectStatus,
          ))) ||
      (untrackedActionReceipt !== undefined &&
        (untrackedActionReceipt.version !== 1 ||
          untrackedActionReceipt.useId !== b.useId ||
          untrackedActionReceipt.witness !== b.witness ||
          actionContext.kind !== "untracked")) ||
      (b.retired !== undefined && b.retired !== true) ||
      (approval !== undefined &&
        (approval.version !== 1 ||
          !text(approval.requestId) ||
          !text(approval.controllerUserId) ||
          !text(approval.useId))) ||
      (termination !== undefined &&
        (termination.version !== 1 ||
          !text(termination.userId) ||
          termination.reason !== "manual" ||
          !Number.isSafeInteger(termination.actionRevision) ||
          (termination.actionReceipt !== null &&
            typeof termination.actionReceipt !== "string") ||
          (termination.itemReceipt !== null &&
            typeof termination.itemReceipt !== "string") ||
          (termination.patientReceipt !== null &&
            typeof termination.patientReceipt !== "string") ||
          b.retired !== true))
    )
      invalid();
  }
  return structuredClone(roots) as Record<string, MedicalBindingV1>;
}
async function bindings() {
  requireAuthority();
  const envelope = game.settings.get(SYSTEM_ID, BINDINGS);
  return parseBindings(
    envelope ? await openDestinyEnvelope<unknown>(BINDINGS, envelope) : null,
  );
}
async function saveBindings(roots: Record<string, MedicalBindingV1>) {
  requireAuthority();
  const envelope = await sealDestiny(
    BINDINGS,
    { version: 1, roots },
    destinyEnrolledGMIds(),
  );
  await game.settings.set(SYSTEM_ID, BINDINGS, envelope);
}
function messageRoot(id: string) {
  const message = game.messages?.get(id);
  if (!message) invalid();
  const value = parseMedicalConsumableRoot(
    message.getFlag(SYSTEM_ID, MEDICAL_ROOT_FLAG),
  );
  if (
    value?.action.rootMessageId !== id ||
    !game.users?.get(destinyNativeAuthor(message))?.isGM
  )
    invalid();
  return { message, value };
}
async function write(
  id: string,
  value: MedicalConsumableRootV1,
  extra: Record<string, unknown> = {},
  bindingUpdate: { readonly retired?: true } = {},
) {
  requireAuthority();
  if (!parseMedicalConsumableRoot(value)) invalid();
  const { message } = messageRoot(id);
  const all = await bindings();
  const binding = all[id];
  if (!binding) invalid();
  all[id] = { ...binding, ...bindingUpdate, latestRoot: value };
  await saveBindings(all);
  await message.update({
    ...extra,
    content: await renderer(value, binding.effectStatus),
    [`flags.${SYSTEM_ID}.${MEDICAL_ROOT_FLAG}`]: value,
  });
}
async function refreshRootLifecycle(
  id: string,
  status: MedicalEffectStatus,
): Promise<void> {
  const all = await bindings();
  const binding = all[id];
  if (!binding) return;
  if (binding.effectStatus !== status) {
    all[id] = { ...binding, effectStatus: status };
    await saveBindings(all);
  }
  const message = game.messages?.get(id);
  if (!message) return;
  const visibility = medicalVisibility(
    rootHasSavedProgress(binding.latestRoot) ? binding.rollMode : "selfroll",
    binding.initiatorUserId,
  );
  const content = await renderer(binding.latestRoot, status);
  const currentContent = (message as unknown as { readonly content?: unknown })
    .content;
  if (
    currentContent === content &&
    message.blind === visibility.blind &&
    canonical(message.whisper ?? []) === canonical(visibility.whisper) &&
    canonical(message.getFlag(SYSTEM_ID, MEDICAL_ROOT_FLAG)) ===
      canonical(binding.latestRoot) &&
    message.getFlag(SYSTEM_ID, "medicalRootScopePending") === false &&
    message.getFlag(SYSTEM_ID, "medicalEffectStatus") === status
  )
    return;
  await message.update({
    content,
    ...visibility,
    [`flags.${SYSTEM_ID}.${MEDICAL_ROOT_FLAG}`]: binding.latestRoot,
    [`flags.${SYSTEM_ID}.medicalRootScopePending`]: false,
    [`flags.${SYSTEM_ID}.medicalEffectStatus`]: status,
  });
}
async function lifecycleStatus(
  actor: FoundryActorDocument & { readonly uuid: string },
  state: {
    readonly useId: string;
    readonly remainingSeconds: number;
    readonly clock: { readonly mode: string };
  },
): Promise<MedicalEffectStatus> {
  const authority = await readMedicalActorAuthority(actor);
  const terminal = authority.history.find(
    ({ useId }) => useId === state.useId,
  )?.terminal;
  if (terminal === "ended") return "ended";
  if (state.remainingSeconds <= 0 || terminal === "expired") return "expired";
  return state.clock.mode === "unresolved" ? "needs-attention" : "active";
}
async function context(id: string, user: FoundryUser, live: boolean) {
  let root = messageRoot(id);
  const binding = (await bindings())[id];
  if (!binding) invalid();
  const expectedVisibility = medicalVisibility(
    rootHasSavedProgress(binding.latestRoot) ? binding.rollMode : "selfroll",
    binding.initiatorUserId,
  );
  if (
    canonical(root.value) !== canonical(binding.latestRoot) ||
    root.message.blind !== expectedVisibility.blind ||
    canonical(root.message.whisper ?? []) !==
      canonical(expectedVisibility.whisper)
  ) {
    await root.message.update({
      content: await renderer(binding.latestRoot, binding.effectStatus),
      ...expectedVisibility,
      [`flags.${SYSTEM_ID}.${MEDICAL_ROOT_FLAG}`]: binding.latestRoot,
      [`flags.${SYSTEM_ID}.medicalRootScopePending`]: false,
    });
    root = messageRoot(id);
  }
  const administrator = await actorDocument(binding.administratorUuid);
  const patient = await actorDocument(binding.patientUuid);
  const item = await itemDocument(binding.itemUuid);
  if (!allowed(user, administrator) && !user.isGM)
    throw new FirstEditionActionError("authority");
  if (!user.isGM && user.id !== binding.initiatorUserId)
    throw new FirstEditionActionError("authority");
  await requireGridStorageItemAction(item, administrator.uuid, "use");
  if (
    root.value.initiatorUserId !== binding.initiatorUserId ||
    root.value.useId !== binding.useId ||
    root.value.item.itemUuid !== binding.itemUuid ||
    root.value.item.beforeQuantity !== binding.beforeQuantity ||
    (binding.approval !== undefined &&
      binding.approval.useId !== root.value.useId)
  )
    invalid();
  if (live) {
    if (binding.retired) throw new FirstEditionActionError("cancelled");
    const profile = currentConfiguredRulesProfile();
    const health = readActorHealth(patient);
    const physiology = object(object(patient.system.medical)?.physiology);
    const consciousness =
      object(object(health.track)?.firstEditionState)?.consciousness ??
      object(object(patient.system.health)?.firstEditionState)?.consciousness;
    if (
      !profile.homebrew.tyfusiusMedicalConsumables ||
      health.kind !== "track" ||
      health.modelId !== "open-d6.health.wound-track" ||
      health.damageStrategyId !== "open-d6.damage.wounds" ||
      physiology?.kind !== "biological" ||
      physiology.revision !== binding.patientState.physiologyRevision ||
      health.track?.currentStateId !== binding.patientState.wound ||
      consciousness === "unconscious" ||
      !["wounded", "severely-wounded"].includes(health.track.currentStateId)
    )
      throw new FirstEditionActionError("conflict");
    if (
      item.parent?.id !== administrator.id ||
      item.name !== binding.itemName ||
      itemDefinitionWitness(item) !== binding.itemDefinitionWitness
    )
      throw new FirstEditionActionError("conflict");
    if (!user.isGM && !binding.approval && !allowed(user, patient))
      throw new FirstEditionActionError("authority");
    if (binding.approval) {
      const controller = game.users?.get(binding.approval.controllerUserId);
      if (
        !controller?.active ||
        controller.isGM ||
        !patient.testUserPermission(controller, "OWNER")
      )
        throw new FirstEditionActionError("authority");
    }
    if (binding.actionContext.kind === "tracked") {
      const round = readCombatantRound(
        administrator,
        binding.actionContext.combatantId,
      );
      if (
        !actionReceiptMatches(binding, administrator) &&
        (!round?.firstEditionCommitment ||
          round.round !== binding.actionContext.round ||
          round.revision !== binding.actionContext.revision ||
          round.actionEconomyStrategyId !==
            binding.actionContext.actionEconomyStrategyId)
      )
        throw new Error("D6E2.Medical.Error.ActionUnavailable");
    } else {
      const currentRound = readCombatantRound(administrator);
      if (
        currentRound?.firstEditionCommitment ||
        (currentRound &&
          currentActionEconomyRuntimeStrategy().declaration !==
            "action-commitment")
      )
        throw new Error("D6E2.Medical.Error.ActionUnavailable");
    }
  }
  return { ...root, binding, administrator, patient, item };
}

async function createRootMessage(
  id: string,
  value: MedicalConsumableRootV1,
  administrator: FoundryActorDocument,
  initiatorUserId: string,
  effectStatus?: MedicalEffectStatus,
  recoveredRollMode?: D6RollMode,
): Promise<void> {
  const progressed = rootHasSavedProgress(value);
  const scope = medicalVisibility(
    progressed && recoveredRollMode ? recoveredRollMode : "selfroll",
    initiatorUserId,
  );
  await ChatMessage.create(
    {
      _id: id,
      content: await renderer(value, effectStatus),
      speaker: ChatMessage.getSpeaker({ actor: administrator }),
      ...scope,
      flags: {
        [SYSTEM_ID]: {
          [MEDICAL_ROOT_FLAG]: value,
          medicalRootScopePending: !progressed,
        },
      },
    },
    { keepId: true },
  );
}

async function create(data: Record<string, unknown>, user: FoundryUser) {
  const id = typeof data.rootMessageId === "string" ? data.rootMessageId : "",
    useId = typeof data.useId === "string" ? data.useId : "",
    mode = data.rollMode as D6RollMode;
  if (
    !id ||
    !useId ||
    !text(data.administratorUuid) ||
    !text(data.patientUuid) ||
    !text(data.itemUuid) ||
    !["publicroll", "gmroll", "selfroll", "blindroll"].includes(mode)
  )
    invalid();
  const administrator = await actorDocument(data.administratorUuid);
  const patient = await actorDocument(data.patientUuid);
  const item = await itemDocument(data.itemUuid);
  if (!allowed(user, administrator) || item.parent?.id !== administrator.id)
    throw new FirstEditionActionError("authority");
  const all = await bindings();
  const existingBinding = all[id];
  if (existingBinding) {
    if (
      existingBinding.useId !== useId ||
      existingBinding.initiatorUserId !== user.id ||
      existingBinding.administratorUuid !== administrator.uuid ||
      existingBinding.patientUuid !== patient.uuid ||
      existingBinding.itemUuid !== item.uuid ||
      existingBinding.rollMode !== mode
    )
      invalid();
    if (!game.messages?.get(id))
      await createRootMessage(
        id,
        existingBinding.latestRoot,
        administrator,
        user.id,
        existingBinding.effectStatus,
        existingBinding.rollMode,
      );
    return (await context(id, user, false)).value;
  }
  const quantity = Number(item.system.quantity);
  const definitionWitness = itemDefinitionWitness(item);
  const medical = object(item.system.medicalConsumable);
  const duration = object(medical?.duration);
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    item.system.gearCategory !== "medical-consumable" ||
    medical?.version !== 1 ||
    medical.effectId !== MODEL_B_STIM_EFFECT_ID ||
    medical.compatibility !== "biological" ||
    medical.treatmentFamily !== "none" ||
    medical.actionCost !== 1 ||
    medical.doseCost !== 1 ||
    duration?.dice !== 1 ||
    duration.faces !== 6 ||
    duration.unit !== "rounds"
  )
    invalid();
  const health = readActorHealth(patient);
  const physiology = object(object(patient.system.medical)?.physiology);
  const consciousness = object(patient.system.health)?.firstEditionState;
  const wound = health.track?.currentStateId;
  const profile = currentConfiguredRulesProfile();
  if (
    !profile.homebrew.tyfusiusMedicalConsumables ||
    health.kind !== "track" ||
    health.modelId !== "open-d6.health.wound-track" ||
    health.damageStrategyId !== "open-d6.damage.wounds" ||
    physiology?.kind !== "biological" ||
    !Number.isSafeInteger(physiology.revision) ||
    Number(physiology.revision) < 0 ||
    object(consciousness)?.consciousness === "unconscious" ||
    !isFirstEditionWoundLevel(wound) ||
    !["wounded", "severely-wounded"].includes(wound)
  )
    invalid();
  const patientAuthority = await readMedicalActorAuthority(patient);
  if (patientAuthority.active?.remainingSeconds) {
    throw new FirstEditionActionError("conflict");
  }
  const round = readCombatantRound(administrator);
  if (
    round &&
    currentActionEconomyRuntimeStrategy().declaration !== "action-commitment"
  )
    throw new Error("D6E2.Medical.Error.ActionUnavailable");
  if (Object.keys(all).length >= 4096)
    throw new FirstEditionActionError("conflict");
  if (
    Object.values(all).some(
      (b) =>
        !b.retired &&
        (b.itemUuid === item.uuid || b.patientUuid === patient.uuid),
    )
  )
    throw new FirstEditionActionError("conflict");
  const approval =
    !user.isGM && !allowed(user, patient)
      ? await requestPatientApproval(patient, administrator, user, useId)
      : undefined;
  const refreshedHealth = readActorHealth(patient);
  const refreshedPhysiology = object(
    object(patient.system.medical)?.physiology,
  );
  const refreshedRound = readCombatantRound(administrator);
  if (
    Number(item.system.quantity) !== quantity ||
    itemDefinitionWitness(item) !== definitionWitness ||
    refreshedPhysiology?.kind !== "biological" ||
    refreshedPhysiology.revision !== physiology.revision ||
    refreshedHealth.kind !== "track" ||
    refreshedHealth.modelId !== health.modelId ||
    refreshedHealth.damageStrategyId !== health.damageStrategyId ||
    refreshedHealth.track?.currentStateId !== wound ||
    canonical(
      round?.firstEditionCommitment
        ? {
            combatantId: round.combatantId,
            round: round.round,
            revision: round.revision,
          }
        : null,
    ) !==
      canonical(
        refreshedRound?.firstEditionCommitment
          ? {
              combatantId: refreshedRound.combatantId,
              round: refreshedRound.round,
              revision: refreshedRound.revision,
            }
          : null,
      )
  )
    throw new FirstEditionActionError("conflict");
  const actorBinding = (actor: typeof administrator) => ({
    actorId: actor.id,
    actorUuid: actor.uuid,
  });
  const value = createMedicalConsumableRoot({
    rootMessageId: id,
    useId,
    initiatorUserId: user.id,
    coordinatorUserId: game.user?.id ?? "",
    controllerUserId: user.id,
    administrator: actorBinding(administrator),
    patient: actorBinding(patient),
    item: {
      actorUuid: administrator.uuid,
      itemId: item.id,
      itemUuid: item.uuid,
      beforeQuantity: quantity,
    },
    injury: wound as "wounded" | "severely-wounded",
    rollMode: mode,
    runtime: {
      profileId: profile.id,
      healthModelId: health.modelId,
      damageStrategyId: health.damageStrategyId,
      actionEconomyStrategyId: profile.strategies.actionEconomy,
    },
  });
  all[id] = {
    version: 1,
    useId,
    initiatorUserId: user.id,
    administratorUuid: administrator.uuid,
    patientUuid: patient.uuid,
    itemUuid: item.uuid,
    beforeQuantity: quantity,
    itemName: item.name,
    itemDefinitionWitness: definitionWitness,
    patientState: {
      version: 1,
      physiologyRevision: Number(physiology.revision),
      wound: wound as "wounded" | "severely-wounded",
      healthModelId: "open-d6.health.wound-track",
      damageStrategyId: "open-d6.damage.wounds",
    },
    actionContext: round?.firstEditionCommitment
      ? {
          kind: "tracked",
          combatantId: round.combatantId,
          round: round.round,
          revision: round.revision,
          actionEconomyStrategyId: round.actionEconomyStrategyId,
        }
      : { kind: "untracked" },
    witness: foundryRandomId(),
    rollMode: mode,
    initialRoot: value,
    latestRoot: value,
    ...(approval === undefined ? {} : { approval }),
  };
  await saveBindings(all);
  await createRootMessage(id, value, administrator, user.id);
  return messageRoot(id).value;
}

async function effect(id: string, user: FoundryUser) {
  const c = await context(id, user, false);
  const stage = c.value.action.stages.find(({ state }) => state !== "recorded");
  if (stage?.spec.kind !== "effect") invalid();
  if (stage.spec.plan.kind !== "medical-consumable-use") invalid();
  const plan = stage.spec.plan;
  const receiptKey = `${stage.id}:effect`;
  const readReceipt = async (): Promise<EffectReceipt | null> => {
    const state = await readMedicalActorAuthority(c.patient);
    if (state.receipts[plan.useId]?.witness !== c.binding.witness) return null;
    return {
      kind: "effect",
      plan,
      receiptKey,
      authorityReceiptId: c.binding.witness,
      outcome: "applied",
    };
  };
  const compareAndApply = async (): Promise<EffectReceipt> => {
    const existing = await readReceipt();
    if (existing) return existing;
    let live = await context(id, user, true);
    const patientState = await readMedicalActorAuthority(live.patient);
    if (patientState.receipts[plan.useId])
      throw new FirstEditionActionError("conflict");
    if (Object.keys(patientState.receipts).length >= 4096)
      throw new FirstEditionActionError("conflict");
    let itemReceipts =
      object(live.item.getFlag?.(SYSTEM_ID, MEDICAL_ITEM_RECEIPTS_FLAG)) ?? {};
    let itemReceipt = object(itemReceipts[plan.useId]);
    if (itemReceipt && itemReceipt.witness !== c.binding.witness)
      throw new FirstEditionActionError("conflict");
    if (!itemReceipt && Object.keys(itemReceipts).length >= 4096)
      throw new FirstEditionActionError("conflict");
    if (live.binding.actionContext.kind === "tracked") {
      if (
        currentActionEconomyRuntimeStrategy().declaration !==
        "action-commitment"
      )
        throw new Error("D6E2.Medical.Error.ActionUnavailable");
      const actionReceiptKey = `${plan.useId}:action`;
      const actionReceipt = object(
        readFirstEditionCombatantActionReceipt(
          live.administrator,
          actionReceiptKey,
          live.binding.actionContext.combatantId,
        ),
      );
      if (
        actionReceipt &&
        (actionReceipt.useId !== plan.useId ||
          actionReceipt.witness !== c.binding.witness)
      )
        throw new FirstEditionActionError("conflict");
      if (!actionReceipt)
        await spendFirstEditionCombatantAction(
          live.administrator,
          live.binding.actionContext.revision,
          PRIVATE_COMBAT_AUTHORITY,
          live.binding.actionContext.combatantId,
          {
            key: actionReceiptKey,
            value: {
              version: 1,
              useId: plan.useId,
              witness: c.binding.witness,
            },
          },
        );
      const all = await bindings();
      const binding = all[id];
      if (binding?.actionContext.kind !== "tracked") invalid();
      if (!binding.trackedActionReceipt) {
        all[id] = {
          ...binding,
          trackedActionReceipt: {
            version: 1,
            useId: binding.useId,
            witness: binding.witness,
          },
        };
        await saveBindings(all);
      }
    } else if (!live.binding.untrackedActionReceipt) {
      const all = await bindings();
      const binding = all[id];
      if (binding?.actionContext.kind !== "untracked") invalid();
      all[id] = {
        ...binding,
        untrackedActionReceipt: {
          version: 1,
          useId: binding.useId,
          witness: binding.witness,
        },
      };
      await saveBindings(all);
    }
    live = await context(id, user, true);
    itemReceipts =
      object(live.item.getFlag?.(SYSTEM_ID, MEDICAL_ITEM_RECEIPTS_FLAG)) ?? {};
    itemReceipt = object(itemReceipts[plan.useId]);
    if (itemReceipt && itemReceipt.witness !== live.binding.witness)
      throw new FirstEditionActionError("conflict");
    if (!itemReceipt) {
      const targetQuantity = plan.beforeQuantity.value - plan.doseCost.value;
      const itemReceiptChange = {
        [`flags.${SYSTEM_ID}.${MEDICAL_ITEM_RECEIPTS_FLAG}.${plan.useId}`]: {
          version: 1,
          witness: live.binding.witness,
          action:
            live.binding.actionContext.kind === "tracked"
              ? "tracked"
              : "untracked",
        },
      };
      const operationId = `${plan.useId}:storage-quantity`;
      const currentStorageParticipant = gridStorageItemParticipates(live.item);
      const storageState =
        currentStorageParticipant ||
        Number(live.item.system.quantity) === targetQuantity
          ? await readGridStorageAuthorityState()
          : null;
      const completed = storageState?.receipts[operationId];
      const completedQuantity =
        completed?.request.kind === "quantity" ? completed.request.value : null;
      const completedTouchesItem =
        completed?.request.kind === "quantity" &&
        completed.writes.some(
          ({ documentUuid }) => documentUuid === live.item.uuid,
        );
      const storageParticipant =
        currentStorageParticipant || completedTouchesItem;
      if (storageParticipant) {
        if (!storageState) throw new FirstEditionActionError("conflict");
        const instanceId = currentStorageParticipant
          ? String(live.item.system.storageInstanceId)
          : (completedQuantity?.instanceId ?? "");
        if (completed) {
          if (
            completed.state !== "completed" ||
            completed.response?.status !== "completed" ||
            completedQuantity?.instanceId !== instanceId ||
            completedQuantity.targetQuantity !== targetQuantity ||
            Number(live.item.system.quantity) !== targetQuantity
          )
            throw new FirstEditionActionError("conflict");
        } else {
          if (Number(live.item.system.quantity) !== plan.beforeQuantity.value)
            throw new FirstEditionActionError("conflict");
          const storageObject = storageState.ledger.objects[instanceId];
          if (!storageObject) throw new FirstEditionActionError("conflict");
          const result = await requestGridStorageOperation({
            kind: "quantity",
            value: {
              version: 1,
              operationId,
              baseRevision: storageState.ledger.revision,
              instanceId,
              actingActorUuid: live.administrator.uuid,
              targetQuantity,
              witnesses: { [instanceId]: storageObject.witness },
            },
          });
          if (result.status !== "completed")
            throw new FirstEditionActionError("conflict");
        }
        await live.item.update(itemReceiptChange, {
          [GRID_STORAGE_AUTHORITY_WRITE_OPTION]: true,
        });
        await synchronizeGridStorageItemWitness(live.item);
      } else {
        if (Number(live.item.system.quantity) !== plan.beforeQuantity.value)
          throw new FirstEditionActionError("conflict");
        await live.item.update({
          "system.quantity": targetQuantity,
          ...itemReceiptChange,
        });
      }
    }
    live = await context(id, user, true);
    const clock = currentMedicalClockEvent(live.patient);
    if (clock.ambiguousCombat || clock.campaignTime === null) {
      await refreshRootLifecycle(id, "needs-attention");
      throw new FirstEditionActionError("uncertain");
    }
    const combatClocks = runningCombatClocksForActor(live.patient);
    const combatClock = combatClocks.length === 1 ? combatClocks[0] : undefined;
    const applied = await applyMedicalStimState({
      administratorUuid: live.administrator.uuid,
      ambiguousCombat: combatClocks.length > 1,
      actor: live.patient,
      campaignTime: Number.isFinite(
        (game as unknown as { time?: { worldTime?: number } }).time?.worldTime,
      )
        ? Number(
            (game as unknown as { time?: { worldTime?: number } }).time
              ?.worldTime,
          )
        : null,
      combatRound: combatClock?.round ?? null,
      combatUuid: combatClock?.combatUuid ?? null,
      durationRoll: plan.durationRoll,
      itemName: live.binding.itemName,
      itemUuid: live.item.uuid,
      rootMessageId: id,
      rollMode: live.binding.rollMode,
      useId: plan.useId,
      witness: live.binding.witness,
    });
    await refreshRootLifecycle(
      id,
      applied.clock.mode === "unresolved" ? "needs-attention" : "active",
    );
    return (await readReceipt()) ?? invalid();
  };
  if (stage.state === "claimed" && !(await readReceipt()))
    await compareAndApply();
  await executeFirstEditionEffect(
    {
      rootMessageId: id,
      operationId: c.value.action.operationId,
      stageId: stage.id,
      authenticatedSenderId: user.id,
    },
    {
      load: () => Promise.resolve(messageRoot(id).value.action),
      authorize: async () => {
        if (!(await readReceipt())) await context(id, user, true);
      },
      compareAndSwap: async (_rootId, revision, next) => {
        const latest = messageRoot(id).value;
        if (latest.action.revision !== revision) return false;
        await write(id, { ...latest, action: next });
        return true;
      },
      readReceipt: async () => readReceipt(),
      compareAndApply,
    },
  );
  const completed = messageRoot(id).value;
  if (completed.action.status === "complete" && (await readReceipt())) {
    const all = await bindings();
    const binding = all[id];
    if (!binding) invalid();
    all[id] = { ...binding, retired: true, latestRoot: completed };
    await saveBindings(all);
  }
}

let tail: Promise<unknown> = Promise.resolve();
export function processMedicalRootOperation(
  data: Record<string, unknown>,
  user: FoundryUser,
): Promise<unknown> {
  let refreshActor:
    (FoundryActorDocument & { readonly uuid: string }) | undefined;
  const run = async () => {
    requireAuthority();
    if (data.method === "view") {
      const actor = await actorDocument(String(data.actorUuid));
      if (!canObserve(user, actor))
        throw new FirstEditionActionError("authority");
      const reconciled = await reconcileMedicalStimClock(
        actor,
        currentMedicalClockEvent(actor),
      );
      const state = await readMedicalActorAuthority(actor);
      const lifecycle = reconciled ?? state.active;
      if (lifecycle)
        await refreshRootLifecycle(
          lifecycle.rootMessageId,
          await lifecycleStatus(actor, lifecycle),
        );
      if (reconciled) refreshActor = actor;
      const profile = currentConfiguredRulesProfile();
      const active = state.active;
      const all = await bindings();
      const visible = (entry: {
        readonly rootMessageId: string;
        readonly rollMode: D6RollMode;
      }) => {
        const binding = all[entry.rootMessageId];
        if (entry.rollMode === "publicroll") return true;
        if (entry.rollMode === "blindroll") return user.isGM;
        if (entry.rollMode === "gmroll")
          return user.isGM || binding?.initiatorUserId === user.id;
        return binding?.initiatorUserId === user.id;
      };
      const activeHistory = active
        ? state.history.find(({ useId }) => useId === active.useId)
        : undefined;
      const canSeeActive = activeHistory ? visible(activeHistory) : false;
      const currentHealth = readActorHealth(actor);
      const currentWound = currentHealth.track?.currentStateId;
      const currentPhysiology = object(
        object(actor.system.medical)?.physiology,
      )?.kind;
      const applicable =
        !!active &&
        profile.homebrew.tyfusiusMedicalConsumables &&
        currentHealth.kind === "track" &&
        currentHealth.modelId === "open-d6.health.wound-track" &&
        currentHealth.damageStrategyId === "open-d6.damage.wounds" &&
        currentPhysiology === "biological" &&
        ["wounded", "severely-wounded"].includes(String(currentWound)) &&
        active.clock.mode !== "unresolved" &&
        active.remainingSeconds > 0;
      return {
        componentEnabled: profile.homebrew.tyfusiusMedicalConsumables,
        ...(active
          ? {
              stim: {
                useId: active.useId,
                status:
                  activeHistory?.terminal === "ended"
                    ? "ended"
                    : active.clock.mode === "unresolved"
                      ? "needs-attention"
                      : active.remainingSeconds > 0
                        ? "active"
                        : "expired",
                statusLabel:
                  activeHistory?.terminal === "ended"
                    ? "Ended"
                    : active.clock.mode === "unresolved"
                      ? "Needs attention"
                      : active.remainingSeconds > 0
                        ? "Active"
                        : "Expired",
                itemName: canSeeActive
                  ? active.sourceItemName
                  : "Medical effect",
                remainingLabel: canSeeActive
                  ? active.clock.mode === "unresolved"
                    ? "Timing unavailable"
                    : active.remainingSeconds <= 0
                      ? "No duration remaining"
                      : active.clock.mode === "combat"
                        ? `${Math.ceil(active.remainingSeconds / 5)} round ${Math.ceil(active.remainingSeconds / 5) === 1 ? "boundary" : "boundaries"} (${active.remainingSeconds} seconds) remaining`
                        : `${active.remainingSeconds} seconds remaining`
                  : "Duration hidden",
                expiryLabel: !canSeeActive
                  ? "Timing hidden"
                  : active.clock.mode === "unresolved"
                    ? "GM timing repair required"
                    : active.clock.mode === "combat"
                      ? `Expires on entry to round ${(active.clock.combatRoundHighWater ?? 0) + Math.ceil(active.remainingSeconds / 5)}`
                      : "Campaign clock",
                suppressionLabel: !profile.homebrew.tyfusiusMedicalConsumables
                  ? "Rules component disabled"
                  : applicable
                    ? "Eligible wound penalty is suppressed while applicable"
                    : "No wound penalty is suppressed.",
                applicable,
                needsAttention: active.clock.mode === "unresolved",
                componentEnabled: profile.homebrew.tyfusiusMedicalConsumables,
                controls:
                  user.isGM && activeHistory?.terminal !== "ended"
                    ? [
                        ...(active.clock.mode === "unresolved"
                          ? [
                              {
                                action: "repair-timing",
                                label: "Repair timing",
                              },
                            ]
                          : []),
                        { action: "end-effect", label: "End effect" },
                      ]
                    : [],
                history: state.history
                  .filter(visible)
                  .slice(-50)
                  .reverse()
                  .map((entry) => ({
                    rootMessageId: entry.rootMessageId,
                    label: entry.itemName,
                    summary: entry.summary,
                    canOpen:
                      game.messages?.get(entry.rootMessageId) !== undefined,
                  })),
              },
            }
          : {}),
      };
    }
    if (data.method === "projection") {
      const actor = await actorDocument(String(data.actorUuid));
      if (!allowed(user, actor)) throw new FirstEditionActionError("authority");
      const reconciled = await reconcileMedicalStimClock(
        actor,
        currentMedicalClockEvent(actor),
      );
      const active =
        reconciled ?? (await readMedicalActorAuthority(actor)).active;
      if (active)
        await refreshRootLifecycle(
          active.rootMessageId,
          await lifecycleStatus(actor, active),
        );
      const projection = await medicalStimProjectionForActor({
        actor,
        wound: data.wound as never,
        woundPenaltyScore: Number(data.woundPenaltyScore),
      });
      if (reconciled) refreshActor = actor;
      return projection;
    }
    if (data.method === "reconcile") {
      if (!user.isGM) throw new FirstEditionActionError("authority");
      const actor = await actorDocument(String(data.actorUuid));
      const state = await reconcileMedicalStimClock(actor, data.event as never);
      if (state)
        await refreshRootLifecycle(
          state.rootMessageId,
          await lifecycleStatus(actor, state),
        );
      if (state) refreshActor = actor;
      return state;
    }
    if (data.method === "end-effect" || data.method === "repair-timing") {
      if (!user.isGM) throw new FirstEditionActionError("authority");
      const actor = await actorDocument(String(data.actorUuid));
      const useId = String(data.useId);
      if (data.method === "end-effect") {
        await endMedicalStimState(actor, useId, user.id);
        const state = await readMedicalActorAuthority(actor);
        const rootId = state.history.find(
          ({ useId: id }) => id === useId,
        )?.rootMessageId;
        if (rootId) await refreshRootLifecycle(rootId, "ended");
      } else {
        const campaignTime = Number(
          (game as unknown as { time?: { worldTime?: number } }).time
            ?.worldTime,
        );
        if (!Number.isFinite(campaignTime) || campaignTime < 0) invalid();
        const clocks = runningCombatClocksForActor(actor);
        const anchorMode = data.anchorMode;
        const selected = clocks.find(
          ({ combatUuid }) => combatUuid === data.combatUuid,
        );
        if (
          (anchorMode !== "campaign" && anchorMode !== "combat") ||
          (anchorMode === "campaign" && clocks.length !== 0) ||
          (anchorMode === "combat" && !selected)
        )
          invalid();
        await repairMedicalStimTiming(actor, useId, user.id, {
          campaignTime,
          ...(anchorMode === "combat" && selected
            ? {
                combatUuid: selected.combatUuid,
                round: selected.round,
              }
            : {}),
        });
        const state = await readMedicalActorAuthority(actor);
        if (state.active)
          await refreshRootLifecycle(state.active.rootMessageId, "active");
      }
      return true;
    }
    if (data.method === "create") return create(data, user);
    const id = typeof data.rootMessageId === "string" ? data.rootMessageId : "";
    if (!id) invalid();
    const c = await context(id, user, false);
    if (data.method === "load") return c.value;
    if (data.method === "cas") {
      const next = object(data.next) as unknown as FirstEditionActionRoot;
      const parsed = parseMedicalConsumableRoot({ ...c.value, action: next });
      const changed = next.stages.find(
        (s) =>
          c.value.action.stages.find((o) => o.id === s.id)?.state !== s.state,
      );
      if (!parsed || !changed || data.revision !== c.value.action.revision)
        return false;
      let expected: FirstEditionActionRoot | undefined;
      if (changed.state === "claimed" && changed.claim?.kind === "plain-d6")
        if (changed.claim.rollMode !== c.binding.rollMode) invalid();
      if (changed.state === "claimed" && changed.claim?.kind === "plain-d6")
        expected = claimFirstEditionActionStage(
          c.value.action,
          changed.id,
          user.id,
          changed.claim,
        );
      else if (
        changed.state === "recorded" &&
        changed.receipt?.kind === "plain-d6"
      ) {
        await hydrateD6FoundryRolls(changed.receipt.artifacts);
        expected = recordFirstEditionActionStage(
          c.value.action,
          changed.id,
          changed.receipt,
        );
      } else invalid();
      if (canonical(expected) !== canonical(next)) invalid();
      const mode =
        changed.claim?.kind === "plain-d6"
          ? changed.claim.rollMode
          : c.binding.rollMode;
      await write(
        id,
        { ...c.value, action: expected },
        {
          ...medicalVisibility(mode, user.id),
          [`flags.${SYSTEM_ID}.medicalRootScopePending`]: false,
        },
      );
      return true;
    }
    if (data.method === "present") await write(id, c.value);
    else if (data.method === "advance") {
      const advanced = advanceMedicalConsumableRoot(c.value);
      let retire = false;
      if (advanced.action.status === "complete") {
        const state = await readMedicalActorAuthority(c.patient);
        retire = state.receipts[c.binding.useId]?.witness === c.binding.witness;
      }
      await write(id, advanced, {}, retire ? { retired: true } : {});
    } else if (data.method === "effect") await effect(id, user);
    else if (data.method === "end-operation") {
      if (!user.isGM) throw new FirstEditionActionError("authority");
      if (
        c.value.action.status !== "open" ||
        medicalConsumableRootCanCancel(c.value)
      )
        throw new FirstEditionActionError("conflict");
      const state = await readMedicalActorAuthority(c.patient);
      if (state.receipts[c.value.useId]?.witness === c.binding.witness)
        throw new FirstEditionActionError("conflict");
      const all = await bindings();
      const currentBinding = all[id];
      if (!currentBinding) invalid();
      const actionReceipt =
        currentBinding.actionContext.kind === "tracked"
          ? (object(
              readFirstEditionCombatantActionReceipt(
                c.administrator,
                `${currentBinding.useId}:action`,
                currentBinding.actionContext.combatantId,
              ),
            ) ?? currentBinding.trackedActionReceipt)
          : currentBinding.untrackedActionReceipt;
      const itemReceipt = object(
        object(c.item.getFlag?.(SYSTEM_ID, MEDICAL_ITEM_RECEIPTS_FLAG))?.[
          c.binding.useId
        ],
      );
      const patientReceipt = object(state.receipts[c.binding.useId]);
      all[id] = {
        ...currentBinding,
        retired: true,
        termination: {
          version: 1,
          userId: user.id,
          reason: "manual",
          actionRevision: c.value.action.revision,
          actionReceipt: actionReceipt ? canonical(actionReceipt) : null,
          itemReceipt: itemReceipt ? canonical(itemReceipt) : null,
          patientReceipt: patientReceipt ? canonical(patientReceipt) : null,
        },
      };
      await saveBindings(all);
      await write(id, {
        ...c.value,
        action: cancelFirstEditionAction(c.value.action),
      });
    } else if (data.method === "cancel") {
      if (!medicalConsumableRootCanCancel(c.value))
        throw new FirstEditionActionError("uncertain");
      const all = await bindings();
      all[id] = { ...c.binding, retired: true };
      await saveBindings(all);
      await write(id, {
        ...c.value,
        action: cancelFirstEditionAction(c.value.action),
      });
    } else invalid();
    return messageRoot(id).value;
  };
  const result = tail.catch(() => undefined).then(run);
  tail = result;
  return result.then((value) => {
    if (refreshActor) scheduleMedicalStatusRefresh(refreshActor);
    return value;
  });
}

const pending = new Map<
  string,
  {
    authorityId: string;
    resolve(value: unknown): void;
    reject(error: Error): void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
export async function requestMedicalRoot(
  data: Record<string, unknown>,
): Promise<unknown> {
  await heartbeatDestinyCrypto();
  const authority = destinyActiveAuthority();
  if (!authority || !game.user) throw new FirstEditionActionError("authority");
  if (destinyClientIsAuthority())
    return processMedicalRootOperation(data, game.user);
  const packetId = foundryRandomId();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => {
        pending.delete(packetId);
        reject(new FirstEditionActionError("uncertain"));
      },
      data.method === "create" ? 75_000 : 15_000,
    );
    pending.set(packetId, {
      authorityId: authority.userId,
      resolve,
      reject,
      timer,
    });
    game.socket?.emit(
      `system.${SYSTEM_ID}`,
      { type: "medical-root-operation", packetId, data },
      { recipients: [authority.userId] },
    );
  });
}

export function registerMedicalConsumableAuthority(): void {
  game.settings.register(SYSTEM_ID, BINDINGS, {
    scope: "world",
    config: false,
    type: Object,
    default: null,
    name: BINDINGS,
    hint: "",
  });
}
export function registerMedicalConsumableSocket(): void {
  game.socket?.on(`system.${SYSTEM_ID}`, (raw: unknown, senderId?: string) => {
    const packet = object(raw);
    if (!packet || !senderId) return;
    if (packet.type === "medical-status-refresh") {
      const current = game.user;
      if (
        !current?.active ||
        !text(packet.actorUuid) ||
        destinyActiveAuthority()?.userId !== senderId ||
        !game.users?.get(senderId)?.isGM
      )
        return;
      void actorDocument(packet.actorUuid).then((actor) => {
        if (canObserve(current, actor)) actor.sheet.render(false);
      });
    } else if (packet.type === "medical-approval-request") {
      const current = game.user;
      const patient = game.actors?.get(String(packet.patientId));
      if (
        !current ||
        !text(packet.requestId) ||
        current.id !== packet.targetUserId ||
        current.isGM ||
        senderId !== packet.gmUserId ||
        destinyActiveAuthority()?.userId !== senderId ||
        !game.users?.get(senderId)?.isGM ||
        !text(packet.useId) ||
        !patient?.testUserPermission(current, "OWNER") ||
        !Number.isFinite(packet.createdAt) ||
        !Number.isFinite(packet.expiresAt) ||
        Number(packet.expiresAt) <= Date.now() ||
        Number(packet.expiresAt) - Number(packet.createdAt) > 60_000
      )
        return;
      const respond = (accepted: boolean) =>
        game.socket?.emit(
          `system.${SYSTEM_ID}`,
          {
            type: "medical-approval-response",
            requestId: packet.requestId,
            requesterUserId: packet.requesterUserId,
            targetUserId: current.id,
            useId: packet.useId,
            accepted,
          },
          { recipients: [senderId] },
        );
      void registerFoundryPendingInteraction(
        {
          actorId: patient.id,
          actorImg: patient.img,
          actorName: patient.name,
          controllerName: current.name ?? current.id,
          controllerUserId: current.id,
          createdAt: Number(packet.createdAt),
          expiresAt: Number(packet.expiresAt),
          id: packet.requestId,
          kind: "economy-approval",
          label: game.i18n.localize("D6E2.Medical.ApprovalTitle"),
          onExpire: () => respond(false),
          reopen: async () => {
            const accepted =
              await foundry.applications.api.DialogV2.wait<boolean>({
                classes: ["d6e2", "od6roll-dialog"],
                content: `<p>${game.i18n.format("D6E2.Medical.ApprovalPrompt", {
                  administrator: escapeHtml(packet.administratorName),
                  patient: escapeHtml(patient.name),
                })}</p>`,
                modal: true,
                position: { width: 440 },
                rejectClose: false,
                window: {
                  title: game.i18n.localize("D6E2.Medical.ApprovalTitle"),
                },
                buttons: [
                  {
                    action: "reject",
                    label: game.i18n.localize("D6E2.Cancel"),
                    callback: () => false,
                  },
                  {
                    action: "approve",
                    label: game.i18n.localize("D6E2.Medical.Approve"),
                    callback: () => true,
                    default: true,
                  },
                ],
              });
            if (accepted === null) return "dismissed";
            respond(accepted);
            return "resolved";
          },
          subjectLabel: patient.name,
        },
        { automaticEligible: true },
      );
    } else if (packet.type === "medical-approval-response") {
      if (
        !game.user?.isGM ||
        !destinyClientIsAuthority() ||
        !text(packet.requestId)
      )
        return;
      const approval = approvals.get(packet.requestId);
      if (
        !approval ||
        approval.requesterUserId !== packet.requesterUserId ||
        approval.targetUserId !== packet.targetUserId ||
        approval.useId !== packet.useId ||
        senderId !== packet.targetUserId
      )
        return;
      approvals.delete(packet.requestId);
      resolveD6PendingInteraction(packet.requestId);
      approval.resolve(packet.accepted === true);
    } else if (packet.type === "medical-root-reply") {
      if (!text(packet.packetId)) return;
      const wait = pending.get(packet.packetId);
      if (wait?.authorityId !== senderId) return;
      pending.delete(packet.packetId);
      clearTimeout(wait.timer);
      if (packet.error) wait.reject(new FirstEditionActionError("uncertain"));
      else wait.resolve(packet.value);
    } else if (
      packet.type === "medical-root-operation" &&
      destinyClientIsAuthority()
    ) {
      if (!text(packet.packetId)) return;
      const user = game.users?.get(senderId),
        data = object(packet.data);
      if (!user || !data) return;
      void processMedicalRootOperation(data, user).then(
        (value) =>
          game.socket?.emit(
            `system.${SYSTEM_ID}`,
            { type: "medical-root-reply", packetId: packet.packetId, value },
            { recipients: [senderId] },
          ),
        () =>
          game.socket?.emit(
            `system.${SYSTEM_ID}`,
            {
              type: "medical-root-reply",
              packetId: packet.packetId,
              error: true,
            },
            { recipients: [senderId] },
          ),
      );
    }
  });
}
