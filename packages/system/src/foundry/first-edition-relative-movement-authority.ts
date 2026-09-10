import {
  firstEditionMovementPlan,
  firstEditionSegmentMovementPlan,
  type D6RollMode,
  type FirstEditionMovementPlan,
} from "@d6-system-2e/core";
import {
  runningOutcome,
  type FirstEditionRunningBinding,
} from "../application/first-edition-segmented-running";
import type {
  FirstEditionActionRoot,
  FirstEditionStageReceipt,
} from "../application/first-edition-action-contract";
import {
  createFirstEditionRelativeMovement,
  advanceFirstEditionRelativeMovement,
  parseFirstEditionRelativeMovement,
  type FirstEditionRelativeMovement,
} from "../application/first-edition-relative-movement";
import {
  cancelFirstEditionAction,
  claimFirstEditionActionStage,
  FirstEditionActionError,
  recordFirstEditionActionStage,
  parseFirstEditionActionRoot,
} from "../application/first-edition-action-root";
import {
  executeFirstEditionEffect,
  type FirstEditionActionStorePorts,
  type FirstEditionStageBinding,
} from "../application/first-edition-action-ports";
import {
  canonical,
  object,
  stageReceipt,
  text,
} from "../application/first-edition-action-validation";
import {
  appendD6InitiatingActionResult,
  createD6InitiatingActionResultLedger,
} from "../application/initiating-action-results";
import { SYSTEM_ID } from "../constants";
import { currentMovementRuntimeStrategy } from "../settings/movement";
import { currentActionEconomyRuntimeStrategy } from "../settings/action-economy";
import { currentConfiguredRulesProfile } from "../settings/rules-profile-library";
import {
  currentSuccessRuntimeStrategy,
  currentWildDieRuntimeStrategy,
} from "../settings/roll-outcome";
import { booleanSetting, numberSetting } from "../settings/setting-values";
import { TYFUSIUS_HOMEBREW_SETTING_KEYS as SETTING } from "../settings/settings-catalog";
import {
  activeGridCombat,
  confidentialMovementReceipt,
  bindConfidentialMovementRoot,
  PRIVATE_COMBAT_AUTHORITY,
  registerPrivateMovementRootExecutor,
  type GridCombatant,
  type PrivateMovementRootCommand,
} from "./combat-round-private";
import {
  destinyClientIsAuthority,
  destinyNativeAuthor,
} from "./destiny-crypto";
import {
  readCombatantRound,
  recordFirstEditionCombatantSegmentMovement,
  spendFirstEditionCombatantAction,
} from "./combat-service";
import {
  previewActorTokenMovement,
  previewActorTokenMovementPath,
} from "./token-movement-service";
import {
  firstEditionMovementCheckSource,
  retryD6MatchingResultReward,
} from "./rolls/roll-service";
import {
  appendD6InitiatingActionPresentation,
  hydrateD6FoundryRolls,
  initiatingActionVisibilityIntersection,
} from "./initiating-action-message";

export const RELATIVE_MOVEMENT_ROOT_FLAG = "firstEditionRelativeMovement";
const TOKEN_RECEIPTS = "relativeMovementReceipts";
type EffectReceipt = Extract<FirstEditionStageReceipt, { kind: "effect" }>;
interface RelativeToken {
  readonly id: string;
  readonly uuid: string;
  readonly x: number;
  readonly y: number;
  readonly actor: FoundryActorDocument & { readonly uuid: string };
  readonly parent: {
    readonly id: string;
    readonly uuid: string;
    readonly grid: {
      readonly size: number;
      readonly distance: number;
      readonly units: string;
    };
  };
  getCenterPoint(): { x: number; y: number };
  getFlag(scope: string, key: string): unknown;
  update(changes: Record<string, unknown>): Promise<unknown>;
}
let renderer:
  | ((
      value: FirstEditionRelativeMovement,
      actor: FoundryActorDocument,
    ) => Promise<string>)
  | undefined;
export function setRelativeMovementRenderer(
  value: NonNullable<typeof renderer>,
): void {
  renderer = value;
}
function invalid(): never {
  throw new FirstEditionActionError("invalid");
}
function requireAuthority(): void {
  if (!destinyClientIsAuthority())
    throw new FirstEditionActionError("authority");
}
function privateCombatant(c: GridCombatant): boolean {
  return (
    c.hidden === true ||
    object(c.getFlag(SYSTEM_ID, "roundAction"))?.privateRound === 1
  );
}
function selectedCombatant(command: PrivateMovementRootCommand): GridCombatant {
  const c = activeGridCombat()?.combatants.contents.find(
    (c) => c.id === command.combatantId && c.actor?.id === command.actorId,
  );
  if (!c?.actor || !privateCombatant(c))
    throw new FirstEditionActionError("authority");
  return c;
}
function movementCombatant(actor: FoundryActorDocument, tokenId: string) {
  return activeGridCombat()?.combatants.contents.find(
    (c) => object(c)?.tokenId === tokenId && c.actor?.uuid === actor.uuid,
  );
}
export function relativeMovementContextAvailable(
  actor: FoundryActorDocument,
  tokenId: string,
): boolean {
  const movement = currentMovementRuntimeStrategy(),
    economy = currentActionEconomyRuntimeStrategy();
  const c = movementCombatant(actor, tokenId),
    round = c && readCombatantRound(actor, c.id);
  if (
    !c ||
    !privateCombatant(c) ||
    !round?.firstEditionCommitment ||
    economy.declaration !== "action-commitment"
  )
    return false;
  if (
    movement.id === "open-d6.movement.relative" &&
    movement.segment === "free-or-action" &&
    economy.turnScheduling === "free-commitment"
  )
    return readCombatantRound(actor)?.combatantId === c.id;
  return (
    movement.id === "open-d6.movement.segmented" &&
    movement.segment === "round-robin-rate" &&
    economy.turnScheduling === "round-robin-segments" &&
    (round.firstEditionSegmentMovement?.remainingMovementDistance ?? 0) <= 0 &&
    round.actions[round.firstEditionCommitment.spentActionCount]?.kind ===
      "move"
  );
}
function runningBinding(
  actor: FoundryActorDocument,
  c: GridCombatant,
  baseMove: number,
  reactive: boolean,
): FirstEditionRunningBinding {
  const round = readCombatantRound(actor, c.id),
    commitment = round?.firstEditionCommitment;
  const action = round?.actions[commitment?.spentActionCount ?? -1];
  if (
    !round ||
    !commitment ||
    action?.kind !== "move" ||
    !round.firstEditionSegmentReady ||
    (round.firstEditionSegmentMovement?.remainingMovementDistance ?? 0) > 0 ||
    round.firstEditionSegmentMovement?.movementUsedAtSpentActionCount ===
      commitment.spentActionCount ||
    (reactive
      ? round.firstEditionNextCombatantId === c.id
      : round.firstEditionNextCombatantId !== c.id) ||
    (reactive && currentMovementRuntimeStrategy().reactive === "unsupported")
  )
    throw new FirstEditionActionError("authority");
  const effectiveScores = round.actions.flatMap((a) =>
    a.effectiveScore === undefined ? [] : [a.effectiveScore],
  );
  const plan = firstEditionSegmentMovementPlan({
    baseMove,
    effectiveScores,
    plannedActionCount: commitment.plannedActionCount,
    running: true,
  });
  if (!plan.calculable) throw new FirstEditionActionError("invalid");
  return {
    round: round.round,
    actionId: action.id,
    spentActionCount: commitment.spentActionCount,
    plannedActionCount: commitment.plannedActionCount,
    effectiveScores,
    reactive,
    plan,
  };
}
async function tokenDocument(uuid: string): Promise<RelativeToken> {
  const raw = await fromUuid(uuid),
    value = raw as Partial<RelativeToken> | null;
  if (
    value?.uuid !== uuid ||
    !value.actor?.uuid ||
    !value.parent?.uuid ||
    typeof value.getCenterPoint !== "function" ||
    typeof value.update !== "function"
  )
    invalid();
  return value as RelativeToken;
}
function authorized(
  user: FoundryUser,
  token: RelativeToken,
  c: GridCombatant,
): void {
  requireAuthority();
  if (
    !user.active ||
    !(user.isGM || token.actor.testUserPermission(user, "OWNER")) ||
    c.actor?.uuid !== token.actor.uuid ||
    object(c)?.tokenId !== token.id ||
    c.token?.uuid !== token.uuid ||
    c.token.parent?.uuid !== token.parent.uuid
  )
    throw new FirstEditionActionError("authority");
}
function immutableBinding(value: FirstEditionRelativeMovement) {
  const stages = value.action.stages;
  const action = {
    ...value.action,
    stages: undefined,
    status: undefined,
    revision: undefined,
  };
  return {
    ...value,
    action: {
      ...action,
      controllerUserId: stages[0]?.spec.controllerUserId,
      initialSpec: stages[0]?.spec,
    },
    followUps: undefined,
    matchingResult: undefined,
  };
}
function authorityBinding(value: FirstEditionRelativeMovement) {
  const combat = activeGridCombat();
  const c = combat?.combatants.contents.find(
    (c) =>
      value.combat.combatantUuid === `Combat.${combat.id}.Combatant.${c.id}`,
  );
  const binding =
    c &&
    object(
      confidentialMovementReceipt(c, `root:${value.action.rootMessageId}`),
    );
  if (
    !binding ||
    !text(binding.authorId) ||
    !text(binding.translationReceiptId) ||
    canonical(binding.immutable) !== canonical(immutableBinding(value))
  )
    throw new FirstEditionActionError("authority");
  return binding;
}
function messageRoot(id: string): {
  message: FoundryChatMessageDocument;
  value: FirstEditionRelativeMovement;
} {
  const message = game.messages?.get(id);
  if (!message) throw new FirstEditionActionError("deleted");
  const value = parseFirstEditionRelativeMovement(
    message.getFlag(SYSTEM_ID, RELATIVE_MOVEMENT_ROOT_FLAG),
  );
  if (value?.action.rootMessageId !== id) invalid();
  const binding = authorityBinding(value);
  if (
    destinyNativeAuthor(message) !== binding.authorId ||
    !game.users?.get(binding.authorId)?.isGM
  )
    throw new FirstEditionActionError("authority");
  return { message, value };
}
function checkRuntime(value: FirstEditionRelativeMovement): void {
  if (
    value.action.runtime.profileId !== currentConfiguredRulesProfile().id ||
    value.action.runtime.movementStrategyId !==
      currentMovementRuntimeStrategy().id ||
    value.action.runtime.actionEconomyStrategyId !==
      currentActionEconomyRuntimeStrategy().id
  )
    throw new FirstEditionActionError("authority");
}
export function relativeMovementRollRuntime() {
  return {
    profileId: currentConfiguredRulesProfile().id,
    successEvaluator: currentSuccessRuntimeStrategy().evaluator,
    wildPolicy: currentWildDieRuntimeStrategy().policy,
    wildTriumph: {
      automaticSuccess: booleanSetting(
        SETTING.wildTriumphAutomaticSuccess,
        false,
      ),
      characterPointAward: numberSetting(
        SETTING.wildTriumphCharacterPointAward,
        0,
      ),
      enabled: booleanSetting(SETTING.wildTriumphEnabled, false),
      metaCurrencyAward: numberSetting(SETTING.wildTriumphMetaCurrencyAward, 0),
      threshold: numberSetting(SETTING.wildTriumphThreshold, 3),
    },
  };
}
async function refreshContent(
  message: FoundryChatMessageDocument,
  value: FirstEditionRelativeMovement,
): Promise<void> {
  if (!renderer) invalid();
  const token = await tokenDocument(value.translation.tokenUuid);
  const content = await renderer(value, token.actor);
  if (game.messages?.get(message.id) !== message)
    throw new FirstEditionActionError("deleted");
  await message.update({ content });
}
async function save(
  message: FoundryChatMessageDocument,
  value: FirstEditionRelativeMovement,
  scope: D6RollMode | "preserve",
  userId: string,
): Promise<void> {
  requireAuthority();
  if (!parseFirstEditionRelativeMovement(value)) invalid();
  if (game.messages?.get(message.id) !== message)
    throw new FirstEditionActionError("deleted");
  await message.update({
    ...(scope === "preserve"
      ? {}
      : initiatingActionVisibilityIntersection(message, scope, userId)),
    [`flags.${SYSTEM_ID}.${RELATIVE_MOVEMENT_ROOT_FLAG}`]:
      structuredClone(value),
  });
  await refreshContent(message, value);
}
function assertCombat(
  value: FirstEditionRelativeMovement,
  c: GridCombatant,
): void {
  const combat = activeGridCombat();
  if (
    !combat ||
    value.combat.uuid !== `Combat.${combat.id}` ||
    value.combat.combatantUuid !== `Combat.${combat.id}.Combatant.${c.id}`
  )
    throw new FirstEditionActionError("authority");
}
async function scopeContext(
  value: FirstEditionRelativeMovement,
  c: GridCombatant,
  user: FoundryUser,
): Promise<RelativeToken> {
  const token = await tokenDocument(value.translation.tokenUuid);
  authorized(user, token, c);
  assertCombat(value, c);
  if (
    value.action.subjects[0]?.actor.actorUuid !== token.actor.uuid ||
    value.translation.sceneId !== token.parent.id
  )
    invalid();
  return token;
}
function validateOrigin(
  value: FirstEditionRelativeMovement,
  token: RelativeToken,
  c: GridCombatant,
): void {
  checkRuntime(value);
  const expectedRevision =
    value.spend &&
    value.action.stages.some(
      (s) =>
        s.spec.kind === "effect" &&
        ["action-spend", "segment-movement"].includes(s.spec.plan.kind) &&
        s.state === "recorded",
    )
      ? value.combat.revision + (value.segment ? 2 : 1)
      : value.combat.revision;
  if (readCombatantRound(token.actor, c.id)?.revision !== expectedRevision)
    throw new Error("D6E2.Combat.Error.RevisionConflict");
  if (
    token.x !== value.translation.from.x ||
    token.y !== value.translation.from.y ||
    canvas.scene?.id !== token.parent.id ||
    canonical(value.translation.measurement) !==
      canonical({
        sceneUnits: token.parent.grid.units,
        gridDistance: token.parent.grid.distance,
        gridSize: token.parent.grid.size,
      })
  )
    throw new FirstEditionActionError("uncertain");
  const center = token.getCenterPoint();
  if (value.segment) {
    const baseMove = Math.max(
      1,
      Math.trunc(Number(object(token.actor.system.movement)?.base) || 1),
    );
    if (
      readCombatantRound(token.actor, c.id)?.round !== value.segment.round ||
      baseMove !== value.planInput.baseMove
    )
      throw new FirstEditionActionError("uncertain");
    if (
      expectedRevision === value.combat.revision &&
      canonical(
        runningBinding(token.actor, c, baseMove, value.segment.reactive),
      ) !== canonical(value.segment)
    )
      throw new FirstEditionActionError("uncertain");
    const geometry = previewActorTokenMovementPath(token.actor, {
      tokenId: token.id,
      destination: {
        x: value.translation.to.x + center.x - token.x,
        y: value.translation.to.y + center.y - token.y,
      },
    });
    if (geometry.blocked || geometry.distance !== value.plan.distance)
      throw new FirstEditionActionError("uncertain");
    return;
  }
  const preview = previewActorTokenMovement(token.actor, {
    tokenId: token.id,
    destination: {
      x: value.translation.to.x + center.x - token.x,
      y: value.translation.to.y + center.y - token.y,
    },
    type: value.plan.type,
    terrainModifier: value.planInput.terrainModifier ?? 0,
    expectedRevision,
  });
  const source = firstEditionMovementCheckSource(token.actor, value.plan.type);
  const baseMove = Math.max(
    1,
    Math.trunc(Number(object(token.actor.system.movement)?.base) || 1),
  );
  const plan = firstEditionMovementPlan({
    ...value.planInput,
    baseMove,
    hasMovementSkill: source.itemId !== undefined,
  });
  if (
    preview.blocked ||
    !preview.canMove ||
    preview.distance !== value.plan.distance ||
    canonical(plan) !== canonical(value.plan)
  )
    throw new FirstEditionActionError("uncertain");
}
function localStore(
  id: string,
  c: GridCombatant,
  user: FoundryUser,
): FirstEditionActionStorePorts {
  return {
    load: () =>
      Promise.resolve(
        game.messages?.get(id) ? messageRoot(id).value.action : null,
      ),
    authorize: async (binding, root, stage, phase) => {
      const { value } = messageRoot(id);
      if (
        binding.authenticatedSenderId !== user.id ||
        binding.operationId !== value.action.operationId ||
        binding.rootMessageId !== id ||
        root.rootMessageId !== id
      )
        throw new FirstEditionActionError("authority");
      const token = await scopeContext(value, c, user);
      if (phase === "claim") {
        if (stage.spec.controllerUserId !== user.id)
          throw new FirstEditionActionError("authority");
        validateOrigin(value, token, c);
      }
    },
    compareAndSwap: async (_id, revision, next, scope) => {
      const { message, value } = messageRoot(id),
        current = value.action;
      if (current.revision !== revision) return false;
      const changed = next.stages.find(
        (s, i) => canonical(s) !== canonical(current.stages[i]),
      );
      if (!changed) invalid();
      const original = current.stages.find((s) => s.id === changed.id);
      let expected: FirstEditionActionRoot;
      if (
        original?.state === "pending" &&
        changed.state === "claimed" &&
        changed.claim
      ) {
        if (
          changed.claim.kind === "d6-roll" &&
          canonical(changed.claim.runtime) !==
            canonical(relativeMovementRollRuntime())
        )
          invalid();
        expected = claimFirstEditionActionStage(
          current,
          changed.id,
          user.id,
          changed.claim,
        );
      } else if (
        original?.state === "claimed" &&
        changed.state === "recorded" &&
        changed.receipt
      ) {
        if (!(user.isGM || original.spec.controllerUserId === user.id))
          throw new FirstEditionActionError("authority");
        if (changed.receipt.kind === "effect") {
          const durable = await readEffectReceipt(value, original, c, user);
          if (!durable || canonical(durable) !== canonical(changed.receipt))
            throw new FirstEditionActionError("authority");
        } else await hydrateD6FoundryRolls(changed.receipt.artifacts);
        expected = recordFirstEditionActionStage(
          current,
          changed.id,
          changed.receipt,
        );
      } else invalid();
      const expectedScope =
        changed.state === "claimed" && changed.claim?.kind === "d6-roll"
          ? changed.claim.request.rollMode
          : changed.state === "recorded" && changed.receipt?.kind === "d6-roll"
            ? changed.receipt.result.request.rollMode
            : "preserve";
      if (scope !== expectedScope || canonical(expected) !== canonical(next))
        invalid();
      await save(
        message,
        { ...value, action: expected },
        scope,
        current.stages[0]?.spec.controllerUserId ?? user.id,
      );
      return true;
    },
  };
}
async function present(id: string): Promise<void> {
  const { message, value } = messageRoot(id);
  let ledger = createD6InitiatingActionResultLedger(
    id,
    value.action.operationId,
  );
  for (const stage of value.action.stages) {
    if (stage.receipt?.kind !== "d6-roll") continue;
    const receipt = stage.receipt;
    ledger = appendD6InitiatingActionResult(ledger, {
      appendId: stage.id,
      details: { type: value.plan.type, distance: value.plan.distance },
      kind: "first-edition-movement-check",
      rollMode: receipt.result.request.rollMode,
      rolls: receipt.artifacts.map((a) => a.evidence),
    });
    const entry = ledger.entries.at(-1);
    if (!entry) invalid();
    await appendD6InitiatingActionPresentation({
      message,
      ledger,
      entry,
      artifacts: await hydrateD6FoundryRolls(receipt.artifacts),
      rollUserId: stage.spec.controllerUserId,
    });
  }
  await refreshContent(message, value);
}
async function readEffectReceipt(
  value: FirstEditionRelativeMovement,
  stage: FirstEditionActionRoot["stages"][number],
  c: GridCombatant,
  user: FoundryUser,
): Promise<EffectReceipt | null> {
  if (stage.spec.kind !== "effect") invalid();
  const token = await scopeContext(value, c, user),
    receiptKey = `${stage.id}:effect`,
    raw = ["action-spend", "segment-movement"].includes(stage.spec.plan.kind)
      ? confidentialMovementReceipt(c, receiptKey)
      : object(token.getFlag(SYSTEM_ID, TOKEN_RECEIPTS))?.[receiptKey];
  if (raw === undefined) return null;
  if (
    !stageReceipt(raw, {
      ...stage,
      state: "claimed",
      claim: { kind: "effect" },
    })
  )
    invalid();
  const receipt = raw as EffectReceipt;
  // This unpredictable witness is committed in GM-only encrypted Combat state
  // before root creation and first disclosed in the coordinate update itself.
  // An owner cannot preforge a matching Token receipt from the visible root.
  if (
    stage.spec.plan.kind === "token-translation" &&
    receipt.authorityReceiptId !== authorityBinding(value).translationReceiptId
  )
    throw new FirstEditionActionError("authority");
  return receipt;
}
async function effect(
  id: string,
  c: GridCombatant,
  user: FoundryUser,
): Promise<void> {
  const { value } = messageRoot(id),
    stage = value.action.stages.find((s) => s.state !== "recorded");
  if (stage?.spec.kind !== "effect") invalid();
  const binding: FirstEditionStageBinding = {
    rootMessageId: id,
    operationId: value.action.operationId,
    stageId: stage.id,
    authenticatedSenderId: user.id,
  };
  const readReceipt = async () =>
    readEffectReceipt(messageRoot(id).value, stage, c, user);
  await executeFirstEditionEffect(binding, {
    ...localStore(id, c, user),
    readReceipt,
    compareAndApply: async (plan, receiptKey) => {
      const existing = await readReceipt();
      if (existing) return existing;
      const latest = messageRoot(id).value,
        token = await scopeContext(latest, c, user);
      validateOrigin(latest, token, c);
      const receipt: EffectReceipt = {
        kind: "effect",
        plan,
        receiptKey,
        authorityReceiptId:
          plan.kind === "token-translation"
            ? String(authorityBinding(latest).translationReceiptId)
            : `${latest.combat.combatantUuid}:${receiptKey}`,
        outcome:
          plan.kind === "token-translation" &&
          canonical(plan.from) === canonical(plan.to) &&
          plan.distance.value === 0
            ? "no-change"
            : "applied",
      };
      requireAuthority();
      if (game.messages?.get(id) === undefined)
        throw new FirstEditionActionError("deleted");
      if (plan.kind === "action-spend")
        await spendFirstEditionCombatantAction(
          token.actor,
          plan.expectedRevision,
          PRIVATE_COMBAT_AUTHORITY,
          c.id,
          { key: receiptKey, value: receipt },
        );
      else if (plan.kind === "segment-movement") {
        const outcome = runningOutcome(latest);
        if (!outcome) invalid();
        await recordFirstEditionCombatantSegmentMovement(
          token.actor,
          plan.expectedRevision,
          outcome,
          PRIVATE_COMBAT_AUTHORITY,
          c.id,
          { key: receiptKey, value: receipt },
        );
      } else if (plan.kind === "token-translation") {
        const receipts = object(token.getFlag(SYSTEM_ID, TOKEN_RECEIPTS)) ?? {};
        if (Object.keys(receipts).length >= 1024)
          throw new FirstEditionActionError("uncertain");
        await token.update({
          x: plan.to.x,
          y: plan.to.y,
          [`flags.${SYSTEM_ID}.${TOKEN_RECEIPTS}.${receiptKey}`]: receipt,
        });
      } else invalid();
      return receipt;
    },
  });
}
async function initiate(
  command: PrivateMovementRootCommand,
  user: FoundryUser,
  data: Record<string, unknown>,
): Promise<FirstEditionRelativeMovement | null> {
  const c = selectedCombatant(command);
  if (
    !text(data.tokenUuid) ||
    !text(data.rootMessageId) ||
    !/^[a-zA-Z0-9]{16}$/.test(data.rootMessageId)
  )
    invalid();
  const token = await tokenDocument(data.tokenUuid);
  authorized(user, token, c);
  const existing = game.messages?.get(data.rootMessageId);
  if (existing) {
    const value = messageRoot(existing.id).value;
    if (
      value.action.stages[0]?.spec.controllerUserId !== user.id ||
      value.translation.tokenUuid !== token.uuid
    )
      invalid();
    return value;
  }
  if (
    !relativeMovementContextAvailable(token.actor, token.id) ||
    canvas.scene?.id !== token.parent.id ||
    !["m", "meter", "meters", "metre", "metres"].includes(
      token.parent.grid.units.toLowerCase(),
    )
  )
    return null;
  const destination = object(data.destination),
    origin = object(data.origin);
  if (
    !destination ||
    origin?.x !== token.x ||
    origin.y !== token.y ||
    !["land", "fly", "swim", "climb"].includes(String(data.type))
  )
    invalid();
  const round = readCombatantRound(token.actor, c.id),
    combat = activeGridCombat();
  if (!round || !combat || round.revision !== command.revision)
    throw new Error("D6E2.Combat.Error.RevisionConflict");
  const type = data.type as FirstEditionMovementPlan["type"];
  const terrainModifier = Number(data.terrainModifier ?? 0);
  const preview = previewActorTokenMovement(
    token.actor,
    {
      tokenId: token.id,
      type,
      terrainModifier,
      destination: { x: Number(destination.x), y: Number(destination.y) },
      expectedRevision: command.revision,
    },
    c.id,
  );
  if (preview.blocked || !preview.canMove)
    throw new Error("D6E2.Movement.Error.Blocked");
  const source = firstEditionMovementCheckSource(token.actor, type),
    center = token.getCenterPoint();
  const planInput = {
    baseMove: Math.max(
      1,
      Math.trunc(Number(object(token.actor.system.movement)?.base) || 1),
    ),
    distance: preview.distance,
    terrainModifier,
    type,
    hasMovementSkill: source.itemId !== undefined,
  };
  const segment =
    currentMovementRuntimeStrategy().id === "open-d6.movement.segmented"
      ? runningBinding(
          token.actor,
          c,
          planInput.baseMove,
          data.reactive === true,
        )
      : undefined;
  if (segment && type !== "land")
    throw new Error("D6E2.Combat.Error.FirstEditionRunningRequiresLand");
  if (!segment && data.reactive === true)
    throw new Error("D6E2.Combat.Error.FirstEditionReactionRequiresTrigger");
  const plan = firstEditionMovementPlan(planInput),
    combatBinding = {
      uuid: `Combat.${combat.id}`,
      combatantUuid: `Combat.${combat.id}.Combatant.${c.id}`,
      revision: command.revision,
    };
  const value = createFirstEditionRelativeMovement({
    rootMessageId: data.rootMessageId,
    operationId: data.rootMessageId,
    controllerUserId: user.id,
    coordinatorUserId: game.user?.id ?? "",
    subject: {
      actorId: token.actor.id,
      actorUuid: token.actor.uuid,
      sceneId: token.parent.id,
      tokenUuid: token.uuid,
    },
    runtime: {
      profileId: currentConfiguredRulesProfile().id,
      movementStrategyId: currentMovementRuntimeStrategy().id,
      actionEconomyStrategyId: currentActionEconomyRuntimeStrategy().id,
    },
    combat: combatBinding,
    planInput,
    source,
    ...(segment ? { segment } : {}),
    translation: {
      kind: "token-translation",
      actorUuid: token.actor.uuid,
      sceneId: token.parent.id,
      tokenUuid: token.uuid,
      from: { x: token.x, y: token.y, unit: "pixels" },
      to: {
        x: preview.destination.x - center.x + token.x,
        y: preview.destination.y - center.y + token.y,
        unit: "pixels",
      },
      distance: { value: preview.distance, unit: "meters" },
      measurement: {
        sceneUnits: token.parent.grid.units,
        gridDistance: token.parent.grid.distance,
        gridSize: token.parent.grid.size,
      },
    },
    ...((segment || plan.actionRequired) &&
    round.firstEditionRemainingActionCount > 0
      ? {
          spend: {
            kind: segment
              ? ("segment-movement" as const)
              : ("action-spend" as const),
            ...(segment
              ? {
                  distance: {
                    value: planInput.distance,
                    unit: "meters" as const,
                  },
                }
              : {}),
            actorUuid: token.actor.uuid,
            combatUuid: combatBinding.uuid,
            combatantUuid: combatBinding.combatantUuid,
            expectedRevision: command.revision,
            actions: { value: 1, unit: "actions" as const },
          },
        }
      : {}),
  });
  if (!renderer) invalid();
  await bindConfidentialMovementRoot(c, `root:${data.rootMessageId}`, {
    authorId: game.user?.id,
    immutable: immutableBinding(value),
    translationReceiptId: crypto.randomUUID(),
  });
  await ChatMessage.create(
    {
      _id: data.rootMessageId,
      content: await renderer(value, token.actor),
      speaker: ChatMessage.getSpeaker({ actor: token.actor }),
      whisper: [
        ...new Set([
          user.id,
          ...(game.users?.contents.filter((u) => u.isGM).map((u) => u.id) ??
            []),
        ]),
      ],
      flags: { [SYSTEM_ID]: { [RELATIVE_MOVEMENT_ROOT_FLAG]: value } },
    },
    { keepId: true },
  );
  return messageRoot(data.rootMessageId).value;
}
export async function executePrivateRelativeMovement(
  command: PrivateMovementRootCommand,
  user: FoundryUser,
): Promise<unknown> {
  requireAuthority();
  const data = object(command.data);
  if (!data || !text(data.method)) invalid();
  if (data.method === "create") return initiate(command, user, data);
  if (!text(data.rootMessageId)) invalid();
  const id = data.rootMessageId,
    c = selectedCombatant(command),
    { message, value } = messageRoot(id);
  await scopeContext(value, c, user);
  if (!user.isGM && value.action.stages[0]?.spec.controllerUserId !== user.id)
    throw new FirstEditionActionError("authority");
  if (data.method === "load") return value;
  if (data.method === "cas") {
    const next = parseFirstEditionActionRoot(data.next);
    if (!next) invalid();
    const stage = next.stages.find(
      (s, i) => canonical(s) !== canonical(value.action.stages[i]),
    );
    if (!stage) invalid();
    const store = localStore(id, c, user);
    await store.authorize(
      {
        rootMessageId: id,
        operationId: value.action.operationId,
        stageId: stage.id,
        authenticatedSenderId: user.id,
      },
      value.action,
      stage,
      stage.state === "claimed" ? "claim" : "record",
    );
    if (
      !["publicroll", "gmroll", "blindroll", "selfroll", "preserve"].includes(
        String(data.scope),
      )
    )
      invalid();
    return store.compareAndSwap(
      id,
      Number(data.revision),
      next,
      data.scope as D6RollMode | "preserve",
    );
  }
  if (data.method === "effect") await effect(id, c, user);
  else if (data.method === "advance") {
    const next = advanceFirstEditionRelativeMovement(value);
    await save(message, next, "preserve", user.id);
  } else if (data.method === "cancel") {
    if (value.action.stages[0]?.spec.controllerUserId !== user.id)
      throw new FirstEditionActionError("authority");
    if (value.action.stages.some((s) => s.state !== "pending"))
      throw new FirstEditionActionError("uncertain");
    await save(
      message,
      { ...value, action: cancelFirstEditionAction(value.action) },
      "preserve",
      user.id,
    );
  } else if (data.method === "present") await present(id);
  else if (data.method === "matching-reward") {
    const receipt = value.action.stages[0]?.receipt;
    if (receipt?.kind !== "d6-roll") invalid();
    const token = await scopeContext(value, c, user);
    const matchingResult = await retryD6MatchingResultReward(
      token.actor,
      value.matchingResult ?? receipt.result,
    );
    await save(message, { ...value, matchingResult }, "preserve", user.id);
  } else if (
    data.method === "follow-up-claim" ||
    data.method === "follow-up-release"
  ) {
    const stepId = String(data.stepId),
      stage = value.action.stages.find((s) => s.id === stepId);
    if (
      stage?.receipt?.kind !== "d6-roll" ||
      stage.spec.controllerUserId !== user.id
    )
      throw new FirstEditionActionError("authority");
    const claims = { ...value.followUps };
    if (data.method === "follow-up-claim") {
      if (claims[stepId]) return false;
      claims[stepId] = user.id;
    } else {
      if (claims[stepId] !== user.id) return false;
      Reflect.deleteProperty(claims, stepId);
    }
    await save(message, { ...value, followUps: claims }, "preserve", user.id);
    return true;
  } else invalid();
  return messageRoot(id).value;
}
export function registerRelativeMovementAuthority(): void {
  registerPrivateMovementRootExecutor(executePrivateRelativeMovement);
}
