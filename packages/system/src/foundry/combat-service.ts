import {
  D6_COMBAT_CONTRACT_VERSION,
  combatRoundActionPenaltyScore,
  combatRoundPenaltyLabel,
  combatRoundMovementSkillPenaltyScore,
  combatRoundPenaltyScore,
  commitFirstEditionActions,
  completeNextCombatAction,
  createCombatantRoundState,
  enterSecondEditionFullDefense,
  recordSecondEditionFeint,
  clearSecondEditionFeint,
  currentCombatAction,
  declareCombatActions,
  firstEditionCommitmentFromState,
  forfeitRemainingCombatActions,
  formatPipScore,
  isSecondEditionCondition,
  secondEditionConditionAllowsActions,
  secondEditionDeclarationPlan,
  secondEditionMovementPlan,
  secondEditionFullDefensePlan,
  secondEditionFeintDefensePenalty,
  canSecondEditionActionFeint,
  secondEditionStaticDefense,
  specializationScore,
  recordFirstEditionActiveDefense,
  spendFirstEditionAction,
  type D6CombatActionKind,
  type D6CombatCommandResultV1,
  type D6CombatantRoundReadModelV1,
  type D6CombatantRoundStateV1,
  type D6CombatDeclarationV1,
  type D6FirstEditionActionCommitmentV1,
  type D6FirstEditionActionDeclarationV1,
  type D6FirstEditionActiveDefenseResultV1,
  type D6FirstEditionActiveDefenseV1,
  type D6SecondEditionFeintV1,
  type D6SecondEditionFullDefenseV1,
  type SecondEditionCondition,
  type SecondEditionMovementMode,
  type SecondEditionPosture,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import {
  currentCombinedPipScore,
  currentEffectivePipScore,
} from "../settings/pip-rules";
import { integer, record, stringValue } from "./sheets/values";
import { currentEditionCapabilityProfile } from "../settings/edition-capabilities";
import { currentSecondEditionCampaignProfile } from "../settings/campaign-profile";
import { readActorEnvironmentEffect } from "./environment-state";

const ROUND_ACTION_FLAG = "roundAction";

interface CombatantLike {
  readonly actor?: object | null;
  readonly actorId?: string;
  readonly id: string;
  getFlag(namespace: string, key: string): unknown;
  update(changes: Record<string, unknown>): Promise<unknown>;
}

interface CombatLike {
  readonly combatants: {
    readonly contents: readonly CombatantLike[];
  };
  readonly round?: number;
}

export interface CombatDeclarationOption {
  readonly group: "attribute" | "skill" | "weapon";
  readonly kind: "attribute" | "attack" | "skill";
  readonly label: string;
  readonly score: number;
  readonly scoreLabel: string;
  readonly sourceId: string;
  readonly value: string;
}

function activeCombat(): CombatLike | undefined {
  return (game as FoundryGame & { readonly combat?: CombatLike }).combat;
}

function actorId(actor: object): string {
  const id = (actor as { readonly id?: unknown }).id;
  return typeof id === "string" ? id : "";
}

function actorUuid(actor: object): string {
  const uuid = (actor as { readonly uuid?: unknown }).uuid;
  return typeof uuid === "string" ? uuid : "";
}

function actorIsOwner(actor: object): boolean {
  return (
    game.user?.isGM === true ||
    (actor as { readonly isOwner?: unknown }).isOwner === true
  );
}

function actorPosture(actor: object): SecondEditionPosture {
  const posture = (
    actor as { readonly system?: { readonly movement?: { posture?: unknown } } }
  ).system?.movement?.posture;
  return posture === "prone" ? "prone" : "standing";
}

function actorCondition(actor: object): SecondEditionCondition {
  const value = (
    actor as { readonly system?: { readonly health?: { condition?: unknown } } }
  ).system?.health?.condition;
  return isSecondEditionCondition(value) ? value : "healthy";
}

function actorItems(actor: object): readonly FoundryItemDocument[] {
  const contents = (
    actor as {
      readonly items?: { readonly contents?: readonly FoundryItemDocument[] };
    }
  ).items?.contents;
  return contents ?? [];
}

function attributeLabel(id: string): string {
  const key = `D6E2.Attribute.${id
    .split("-")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("")}`;
  const localized = game.i18n.localize(key);
  return localized === key ? id : localized;
}

function skillScore(actor: object, item: FoundryItemDocument): number {
  const attributes = record(
    (actor as { readonly system?: { readonly attributes?: unknown } }).system
      ?.attributes,
  );
  const attributeId = stringValue(item.system.attributeId);
  const attributeScore = integer(record(attributes[attributeId]).score);
  if (item.type === "specialization") {
    const parentSkillId = stringValue(item.system.parentSkillId);
    const parentSkillKey = stringValue(item.system.parentSkillKey);
    const parent = actorItems(actor).find(
      (candidate) =>
        candidate.type === "skill" &&
        (candidate.id === parentSkillId ||
          (parentSkillKey.length > 0 &&
            stringValue(candidate.system.key) === parentSkillKey)),
    );
    const parentScore =
      parent?.system.training === "advanced"
        ? currentEffectivePipScore(integer(parent.system.score))
        : currentCombinedPipScore(
            attributeScore,
            integer(parent?.system.score),
          );
    return specializationScore(
      parentScore,
      currentEffectivePipScore(integer(item.system.score)),
    );
  }
  return item.system.training === "advanced"
    ? currentEffectivePipScore(integer(item.system.score))
    : currentCombinedPipScore(attributeScore, integer(item.system.score));
}

function weaponAttackScore(actor: object, weapon: FoundryItemDocument): number {
  const items = actorItems(actor);
  const attackSkillKey = stringValue(weapon.system.attackSkillKey);
  const linkedSkill = items.find(
    (candidate) =>
      candidate.type === "skill" &&
      stringValue(candidate.system.key) === attackSkillKey,
  );
  const attributeId = linkedSkill
    ? stringValue(linkedSkill.system.attributeId)
    : stringValue(weapon.system.attackAttributeId) || "agility";
  const attributes = record(
    (actor as { readonly system?: { readonly attributes?: unknown } }).system
      ?.attributes,
  );
  const attributeScore = integer(record(attributes[attributeId]).score);
  const base = linkedSkill
    ? skillScore(actor, linkedSkill)
    : currentEffectivePipScore(attributeScore);
  return base + currentEffectivePipScore(integer(weapon.system.attackBonus));
}

export function combatDeclarationOptions(
  actor: object,
): readonly CombatDeclarationOption[] {
  const attributes = record(
    (actor as { readonly system?: { readonly attributes?: unknown } }).system
      ?.attributes,
  );
  const attributeOptions = Object.entries(attributes).flatMap(
    ([sourceId, source]) => {
      const score = currentEffectivePipScore(integer(record(source).score));
      return score < 3
        ? []
        : [
            {
              group: "attribute" as const,
              kind: "attribute" as const,
              label: attributeLabel(sourceId),
              score,
              scoreLabel: formatPipScore(score),
              sourceId,
              value: `attribute:${sourceId}`,
            },
          ];
    },
  );
  const skillOptions = actorItems(actor)
    .filter((item) => ["skill", "specialization"].includes(item.type))
    .flatMap((item) => {
      const score = skillScore(actor, item);
      return score < 3
        ? []
        : [
            {
              group: "skill" as const,
              kind: "skill" as const,
              label: item.name,
              score,
              scoreLabel: formatPipScore(score),
              sourceId: item.id,
              value: `skill:${item.id}`,
            },
          ];
    });
  const weaponOptions = actorItems(actor)
    .filter((item) => item.type === "weapon")
    .flatMap((item) => {
      const score = weaponAttackScore(actor, item);
      return score < 3
        ? []
        : [
            {
              group: "weapon" as const,
              kind: "attack" as const,
              label: item.name,
              score,
              scoreLabel: formatPipScore(score),
              sourceId: item.id,
              value: `attack:${item.id}`,
            },
          ];
    });
  return Object.freeze([
    ...attributeOptions.sort((left, right) =>
      left.label.localeCompare(right.label),
    ),
    ...skillOptions.sort((left, right) =>
      left.label.localeCompare(right.label),
    ),
    ...weaponOptions.sort((left, right) =>
      left.label.localeCompare(right.label),
    ),
  ]);
}

async function updateActorPosture(
  actor: object,
  posture: SecondEditionPosture,
): Promise<void> {
  if (actorPosture(actor) === posture) return;
  const update = (
    actor as {
      readonly update?: (changes: Record<string, unknown>) => Promise<unknown>;
    }
  ).update;
  if (typeof update !== "function") return;
  await update.call(actor, { "system.movement.posture": posture });
}

function activeCombatant(actor: object): CombatantLike | undefined {
  const id = actorId(actor);
  const uuid = actorUuid(actor);
  return activeCombat()?.combatants.contents.find(
    (combatant) =>
      combatant.actor === actor ||
      (combatant.actor != null &&
        uuid.length > 0 &&
        actorUuid(combatant.actor) === uuid) ||
      (combatant.actor == null && combatant.actorId === id),
  );
}

function isActionKind(value: unknown): value is D6CombatActionKind {
  return ["attribute", "attack", "move", "other", "skill"].includes(
    String(value),
  );
}

function isMovementMode(value: unknown): value is SecondEditionMovementMode {
  return ["hold", "walk", "run", "crawl", "stand"].includes(String(value));
}

function roundNumber(): number {
  const value = activeCombat()?.round;
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

function storedState(combatant: CombatantLike): D6CombatantRoundStateV1 {
  const source = combatant.getFlag(SYSTEM_ID, ROUND_ACTION_FLAG);
  if (
    typeof source !== "object" ||
    source === null ||
    (source as { readonly contractVersion?: unknown }).contractVersion !==
      D6_COMBAT_CONTRACT_VERSION ||
    (source as { readonly round?: unknown }).round !== roundNumber()
  ) {
    return createCombatantRoundState(roundNumber());
  }
  const candidate = source as {
    readonly actionForfeiture?: unknown;
    readonly actions?: unknown;
    readonly completedActionIds?: unknown;
    readonly revision?: unknown;
    readonly round: number;
    readonly secondEditionFullDefense?: unknown;
    readonly secondEditionFeint?: unknown;
  };
  const actions = Array.isArray(candidate.actions)
    ? candidate.actions.flatMap((action) => {
        if (typeof action !== "object" || action === null) return [];
        const value = action as Record<string, unknown>;
        if (
          typeof value.id !== "string" ||
          typeof value.label !== "string" ||
          !isActionKind(value.kind)
        ) {
          return [];
        }
        return [
          {
            ...(Number.isSafeInteger(value.baseScore)
              ? { baseScore: Number(value.baseScore) }
              : {}),
            ...(Number.isSafeInteger(value.effectiveScore)
              ? { effectiveScore: Number(value.effectiveScore) }
              : {}),
            id: value.id,
            kind: value.kind,
            label: value.label,
            ...(typeof value.sourceId === "string"
              ? { sourceId: value.sourceId }
              : {}),
            ...(value.endProne === true ? { endProne: true } : {}),
            ...(value.kind === "move" && isMovementMode(value.movementMode)
              ? { movementMode: value.movementMode }
              : {}),
          },
        ];
      })
    : [];
  const actionIds = new Set(actions.map((action) => action.id));
  const completedActionIds = Array.isArray(candidate.completedActionIds)
    ? candidate.completedActionIds.filter(
        (id): id is string => typeof id === "string" && actionIds.has(id),
      )
    : [];
  const actionForfeiture =
    typeof candidate.actionForfeiture === "object" &&
    candidate.actionForfeiture !== null &&
    (candidate.actionForfeiture as { readonly reason?: unknown }).reason ===
      "wounded" &&
    (candidate.actionForfeiture as { readonly sourcePage?: unknown })
      .sourcePage === 33
      ? Object.freeze({ reason: "wounded" as const, sourcePage: 33 as const })
      : undefined;
  const firstEditionCommitment = parseFirstEditionCommitment(
    (source as { readonly firstEditionCommitment?: unknown })
      .firstEditionCommitment,
  );
  const firstEditionActiveDefense = parseFirstEditionActiveDefense(
    (source as { readonly firstEditionActiveDefense?: unknown })
      .firstEditionActiveDefense,
  );
  const secondEditionFullDefense = parseSecondEditionFullDefense(
    candidate.secondEditionFullDefense,
  );
  const secondEditionFeint = parseSecondEditionFeint(
    candidate.secondEditionFeint,
  );
  return Object.freeze({
    ...(actionForfeiture === undefined ? {} : { actionForfeiture }),
    actions: Object.freeze(actions),
    completedActionIds: Object.freeze(completedActionIds),
    contractVersion: D6_COMBAT_CONTRACT_VERSION,
    ...(firstEditionActiveDefense === undefined
      ? {}
      : { firstEditionActiveDefense }),
    ...(firstEditionCommitment === undefined ? {} : { firstEditionCommitment }),
    ...(secondEditionFullDefense === undefined
      ? {}
      : { secondEditionFullDefense }),
    ...(secondEditionFeint === undefined ? {} : { secondEditionFeint }),
    revision:
      Number.isInteger(candidate.revision) && Number(candidate.revision) >= 0
        ? Number(candidate.revision)
        : 0,
    round: candidate.round,
  });
}

function parseSecondEditionFullDefense(
  value: unknown,
): D6SecondEditionFullDefenseV1 | undefined {
  const source = record(value);
  if (
    source.sourcePage !== 163 ||
    !["acrobaticsBonus", "dodge", "meleeBonus", "parry"].every((key) =>
      Number.isSafeInteger(source[key]),
    )
  )
    return undefined;
  return Object.freeze({
    acrobaticsBonus: Number(source.acrobaticsBonus),
    dodge: Number(source.dodge),
    meleeBonus: Number(source.meleeBonus),
    parry: Number(source.parry),
    sourcePage: 163,
  });
}

function parseSecondEditionFeint(
  value: unknown,
): D6SecondEditionFeintV1 | undefined {
  const source = record(value);
  if (
    ![162, 163].includes(Number(source.sourcePage)) ||
    !Number.isSafeInteger(source.defensePenalty) ||
    typeof source.targetActorId !== "string" ||
    typeof source.targetName !== "string"
  )
    return undefined;
  return Object.freeze({
    defensePenalty: Number(source.defensePenalty),
    sourcePage: Number(source.sourcePage) as 162 | 163,
    targetActorId: source.targetActorId,
    targetName: source.targetName,
    ...(typeof source.targetTokenId === "string"
      ? { targetTokenId: source.targetTokenId }
      : {}),
  });
}

function parseFirstEditionActiveDefense(
  value: unknown,
): D6FirstEditionActiveDefenseV1 | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const source = value as Record<string, unknown>;
  if (
    !["block", "dodge", "parry"].includes(String(source.kind)) ||
    !["full", "partial"].includes(String(source.mode)) ||
    typeof source.sourceId !== "string" ||
    typeof source.label !== "string" ||
    !Number.isSafeInteger(source.total) ||
    Number(source.total) < 0 ||
    !Number.isSafeInteger(source.difficulty) ||
    Number(source.difficulty) < 0
  ) {
    return undefined;
  }
  return Object.freeze({
    difficulty: Number(source.difficulty),
    kind: source.kind as D6FirstEditionActiveDefenseV1["kind"],
    label: source.label,
    mode: source.mode as D6FirstEditionActiveDefenseV1["mode"],
    sourceId: source.sourceId,
    total: Number(source.total),
  });
}

function parseFirstEditionCommitment(
  value: unknown,
): D6FirstEditionActionCommitmentV1 | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const source = value as Record<string, unknown>;
  if (
    !Number.isSafeInteger(source.plannedActionCount) ||
    !Number.isSafeInteger(source.actionAllotment) ||
    !Number.isSafeInteger(source.spentActionCount) ||
    !["none", "partial-defense", "full-defense"].includes(
      String(source.defense),
    )
  ) {
    return undefined;
  }
  const commitment: D6FirstEditionActionCommitmentV1 = {
    actionAllotment: Number(source.actionAllotment),
    defense: source.defense as D6FirstEditionActionCommitmentV1["defense"],
    plannedActionCount: Number(source.plannedActionCount),
    spentActionCount: Number(source.spentActionCount),
  };
  try {
    firstEditionCommitmentFromState(commitment);
    return Object.freeze(commitment);
  } catch {
    return undefined;
  }
}

function readModel(
  actor: object,
  combatant: CombatantLike,
  state = storedState(combatant),
): D6CombatantRoundReadModelV1 {
  const currentAction = currentCombatAction(state);
  const firstEditionCommitment = state.firstEditionCommitment
    ? firstEditionCommitmentFromState(state.firstEditionCommitment)
    : undefined;
  return Object.freeze({
    ...state,
    active: true,
    actorId: actorId(actor),
    combatantId: combatant.id,
    complete:
      state.actionForfeiture !== undefined ||
      (state.actions.length > 0 && currentAction === undefined),
    ...(currentAction === undefined ? {} : { currentAction }),
    currentSegment: Math.min(
      state.completedActionIds.length + 1,
      Math.max(state.actions.length, 1),
    ),
    firstEditionActionPenaltyScore: firstEditionCommitment?.penaltyScore ?? 0,
    firstEditionRemainingActionCount:
      firstEditionCommitment?.remainingActionCount ?? 0,
    actionPenaltyScore: combatRoundActionPenaltyScore(state),
    movementSkillPenaltyScore: combatRoundMovementSkillPenaltyScore(state),
    penaltyLabel: combatRoundPenaltyLabel(state),
    penaltyScore: combatRoundPenaltyScore(state),
  });
}

function assertAuthorized(actor: object): void {
  if (!actorIsOwner(actor)) throw new Error("D6E2.Combat.Error.NotAuthorized");
}

function assertRevision(
  state: D6CombatantRoundStateV1,
  expectedRevision: number,
): void {
  if (state.revision !== expectedRevision) {
    throw new Error("D6E2.Combat.Error.RevisionConflict");
  }
}

async function persist(
  actor: object,
  combatant: CombatantLike,
  state: D6CombatantRoundStateV1,
): Promise<D6CombatCommandResultV1> {
  // Foundry recursively merges nested flag objects. An omitted optional field
  // therefore does not remove an older value; persist null to clear the stored
  // First Edition commitment while keeping the public contract omission-based.
  const persistedState = {
    ...state,
    ...(state.firstEditionCommitment === undefined
      ? { firstEditionCommitment: null }
      : {}),
    ...(state.firstEditionActiveDefense === undefined
      ? { firstEditionActiveDefense: null }
      : {}),
    ...(state.actionForfeiture === undefined ? { actionForfeiture: null } : {}),
    ...(state.secondEditionFullDefense === undefined
      ? { secondEditionFullDefense: null }
      : {}),
    ...(state.secondEditionFeint === undefined
      ? { secondEditionFeint: null }
      : {}),
  };
  await combatant.update({
    [`flags.${SYSTEM_ID}.${ROUND_ACTION_FLAG}`]: persistedState,
  });
  return Object.freeze({
    changed: true,
    state: readModel(actor, combatant, state),
  });
}

function assertActiveResponsiveCombat(): void {
  if (!currentSecondEditionCampaignProfile().activeResponsiveCombat) {
    throw new Error("D6E2.Combat.ActiveResponsive.ModuleRequired");
  }
}

function effectiveCoreSkillScore(actor: object, key: string): number {
  const skill = actorItems(actor).find(
    (item) => item.type === "skill" && stringValue(item.system.key) === key,
  );
  return skill ? skillScore(actor, skill) : 0;
}

export async function enterSecondEditionCombatantFullDefense(
  actor: object,
  expectedRevision: number,
): Promise<D6CombatCommandResultV1> {
  assertAuthorized(actor);
  assertActiveResponsiveCombat();
  const combatant = activeCombatant(actor);
  if (!combatant) throw new Error("D6E2.Combat.Error.NotInCombat");
  const current = storedState(combatant);
  assertRevision(current, expectedRevision);
  const attributes = record(
    (actor as { readonly system?: { readonly attributes?: unknown } }).system
      ?.attributes,
  );
  const plan = secondEditionFullDefensePlan(
    secondEditionStaticDefense(
      currentEffectivePipScore(integer(record(attributes.perception).score)),
    ),
    secondEditionStaticDefense(
      currentEffectivePipScore(integer(record(attributes.agility).score)),
    ),
    effectiveCoreSkillScore(actor, "acrobatics"),
    effectiveCoreSkillScore(actor, "melee"),
  );
  return persist(
    actor,
    combatant,
    enterSecondEditionFullDefense(current, plan),
  );
}

export async function recordSecondEditionCombatantFeint(
  actor: object,
  targetTokenId: string,
  expectedRevision: number,
): Promise<D6CombatCommandResultV1> {
  assertAuthorized(actor);
  assertActiveResponsiveCombat();
  const combatant = activeCombatant(actor);
  if (!combatant) throw new Error("D6E2.Combat.Error.NotInCombat");
  const current = storedState(combatant);
  assertRevision(current, expectedRevision);
  const meleeScore = effectiveCoreSkillScore(actor, "melee");
  if (!canSecondEditionActionFeint(meleeScore)) {
    throw new Error("D6E2.Combat.ActiveResponsive.MeleeFourRequired");
  }
  const token = canvas.tokens?.placeables.find(
    ({ id }) => id === targetTokenId,
  );
  if (!token?.actor || token.actor.id === actorId(actor)) {
    throw new Error("D6E2.Combat.ActiveResponsive.TargetRequired");
  }
  return persist(
    actor,
    combatant,
    recordSecondEditionFeint(current, {
      defensePenalty: secondEditionFeintDefensePenalty(meleeScore),
      sourcePage: 163,
      targetActorId: token.actor.id,
      targetName: token.name ?? token.actor.name,
      targetTokenId,
    }),
  );
}

export async function clearSecondEditionCombatantFeint(
  actor: object,
): Promise<D6CombatCommandResultV1> {
  const combatant = activeCombatant(actor);
  if (!combatant) return Object.freeze({ changed: false, state: null });
  const current = storedState(combatant);
  const next = clearSecondEditionFeint(current);
  return next === current
    ? Object.freeze({
        changed: false,
        state: readModel(actor, combatant, current),
      })
    : persist(actor, combatant, next);
}

export async function recordSecondEditionWildDieFeint(
  actor: object,
  targetTokenId: string,
): Promise<D6CombatCommandResultV1> {
  assertAuthorized(actor);
  assertActiveResponsiveCombat();
  const combatant = activeCombatant(actor);
  if (!combatant) throw new Error("D6E2.Combat.Error.NotInCombat");
  const current = storedState(combatant);
  const token = canvas.tokens?.placeables.find(
    ({ id }) => id === targetTokenId,
  );
  if (!token?.actor || token.actor.id === actorId(actor)) {
    throw new Error("D6E2.Combat.ActiveResponsive.TargetRequired");
  }
  return persist(
    actor,
    combatant,
    recordSecondEditionFeint(
      current,
      {
        defensePenalty: secondEditionFeintDefensePenalty(
          effectiveCoreSkillScore(actor, "melee"),
        ),
        sourcePage: 162,
        targetActorId: token.actor.id,
        targetName: token.name ?? token.actor.name,
        targetTokenId,
      },
      false,
    ),
  );
}

export async function forfeitWoundedCombatantActions(
  actor: object,
): Promise<D6CombatCommandResultV1> {
  if (
    currentEditionCapabilityProfile().actionEconomy.strategy !==
    "second-edition-action-segments"
  ) {
    return Object.freeze({ changed: false, state: readCombatantRound(actor) });
  }
  const combatant = activeCombatant(actor);
  if (!combatant) return Object.freeze({ changed: false, state: null });
  const current = storedState(combatant);
  if (current.round < 1 || current.actionForfeiture) {
    return Object.freeze({
      changed: false,
      state: readModel(actor, combatant, current),
    });
  }
  return persist(actor, combatant, forfeitRemainingCombatActions(current));
}

export function readCombatantRound(
  actor: object,
): D6CombatantRoundReadModelV1 | null {
  const combatant = activeCombatant(actor);
  return combatant ? readModel(actor, combatant) : null;
}

export async function declareCombatantActions(
  actor: object,
  declaration: D6CombatDeclarationV1,
): Promise<D6CombatCommandResultV1> {
  assertAuthorized(actor);
  const combatant = activeCombatant(actor);
  if (!combatant) throw new Error("D6E2.Combat.Error.NotInCombat");
  const current = storedState(combatant);
  assertRevision(current, declaration.expectedRevision);
  if (declaration.actions.length < 1) {
    throw new Error("D6E2.Combat.Error.ActionRequired");
  }
  const movement = declaration.actions.find(
    (action) => action.kind === "move" && action.movementMode !== undefined,
  );
  if (movement?.movementMode !== undefined) {
    secondEditionMovementPlan(
      movement.movementMode,
      actorPosture(actor),
      movement.endProne === true,
    );
  }
  const options = combatDeclarationOptions(actor);
  const pools = declaration.actions.flatMap((action) => {
    if (!["attribute", "attack", "skill"].includes(action.kind)) return [];
    const option = options.find(
      (candidate) =>
        candidate.kind === action.kind &&
        candidate.sourceId === action.sourceId,
    );
    if (!option) throw new Error("D6E2.Combat.Error.InvalidActionSource");
    return [
      {
        id: option.sourceId,
        kind: option.kind,
        label: option.label,
        score: option.score,
      },
    ];
  });
  const condition = actorCondition(actor);
  if (!secondEditionConditionAllowsActions(condition)) {
    throw new Error("D6E2.Combat.Error.ConditionCannotAct");
  }
  const movementMode = movement?.movementMode ?? "hold";
  const plan = secondEditionDeclarationPlan(
    declaration.actions.length,
    condition,
    movementMode,
    pools,
    currentEditionCapabilityProfile().environments.state === "active"
      ? (readActorEnvironmentEffect(actor as FoundryActorDocument)
          ?.penaltyScore ?? 0)
      : 0,
  );
  if (!plan.legal) {
    throw new Error("D6E2.Combat.Error.DeclarationPoolBelowOneDie");
  }
  let poolIndex = 0;
  const actions = declaration.actions.map((action, index) => {
    const pool = ["attribute", "attack", "skill"].includes(action.kind)
      ? plan.pools[poolIndex++]
      : undefined;
    const option =
      pool === undefined
        ? undefined
        : options.find(
            (candidate) =>
              candidate.kind === action.kind &&
              candidate.sourceId === action.sourceId,
          );
    return {
      ...(pool === undefined
        ? {}
        : {
            baseScore: pool.score,
            effectiveScore: pool.effectiveScore,
            sourceId: pool.id,
          }),
      id: `${current.round}-${current.revision + 1}-${index + 1}`,
      kind: action.kind,
      label: option?.label ?? action.label.trim(),
      ...(action.endProne === true ? { endProne: true } : {}),
      ...(action.kind === "move" && action.movementMode !== undefined
        ? { movementMode: action.movementMode }
        : {}),
    };
  });
  return persist(actor, combatant, declareCombatActions(current, actions));
}

function assertFirstEditionActionEconomy(): void {
  if (
    currentEditionCapabilityProfile().actionEconomy.strategy !==
    "open-d6-flexible-action-allotment"
  ) {
    throw new Error("D6E2.Combat.Error.FirstEditionActionEconomyInactive");
  }
}

function assertFirstEditionActiveDefenses(): void {
  if (
    currentEditionCapabilityProfile().defenses.strategy !==
    "active-defense-scheduler"
  ) {
    throw new Error("D6E2.Combat.Error.FirstEditionActiveDefensesInactive");
  }
}

export async function commitFirstEditionCombatantActions(
  actor: object,
  declaration: D6FirstEditionActionDeclarationV1,
): Promise<D6CombatCommandResultV1> {
  assertAuthorized(actor);
  assertFirstEditionActionEconomy();
  const combatant = activeCombatant(actor);
  if (!combatant) throw new Error("D6E2.Combat.Error.NotInCombat");
  const current = storedState(combatant);
  assertRevision(current, declaration.expectedRevision);
  if (
    (current.firstEditionCommitment?.spentActionCount ?? 0) > 0 &&
    game.user?.isGM !== true
  ) {
    throw new Error("D6E2.Combat.Error.DeclarationLocked");
  }
  return persist(
    actor,
    combatant,
    commitFirstEditionActions(
      current,
      declaration.plannedActionCount,
      declaration.actionAllotment,
      declaration.defense,
      declaration.spentActionCount,
    ),
  );
}

export async function spendFirstEditionCombatantAction(
  actor: object,
  expectedRevision: number,
): Promise<D6CombatCommandResultV1> {
  assertAuthorized(actor);
  assertFirstEditionActionEconomy();
  const combatant = activeCombatant(actor);
  if (!combatant) throw new Error("D6E2.Combat.Error.NotInCombat");
  const current = storedState(combatant);
  assertRevision(current, expectedRevision);
  return persist(actor, combatant, spendFirstEditionAction(current));
}

export async function recordFirstEditionCombatantDefense(
  actor: object,
  result: D6FirstEditionActiveDefenseResultV1,
): Promise<D6CombatCommandResultV1> {
  assertAuthorized(actor);
  assertFirstEditionActionEconomy();
  assertFirstEditionActiveDefenses();
  const combatant = activeCombatant(actor);
  if (!combatant) throw new Error("D6E2.Combat.Error.NotInCombat");
  const current = storedState(combatant);
  assertRevision(current, result.expectedRevision);
  if (current.firstEditionActiveDefense && game.user?.isGM !== true) {
    throw new Error("D6E2.Combat.Error.FirstEditionDefenseLocked");
  }
  const defense: D6FirstEditionActiveDefenseV1 = {
    difficulty: result.difficulty,
    kind: result.kind,
    label: result.label,
    mode: result.mode,
    sourceId: result.sourceId,
    total: result.total,
  };
  return persist(
    actor,
    combatant,
    recordFirstEditionActiveDefense(current, defense, result.consumeAction),
  );
}

export async function completeNextCombatantAction(
  actor: object,
  expectedRevision: number,
): Promise<D6CombatCommandResultV1> {
  assertAuthorized(actor);
  const combatant = activeCombatant(actor);
  if (!combatant) throw new Error("D6E2.Combat.Error.NotInCombat");
  const current = storedState(combatant);
  assertRevision(current, expectedRevision);
  const currentAction = currentCombatAction(current);
  const movementPlan =
    currentAction?.kind === "move" && currentAction.movementMode !== undefined
      ? secondEditionMovementPlan(
          currentAction.movementMode,
          actorPosture(actor),
          currentAction.endProne === true,
        )
      : undefined;
  const next = completeNextCombatAction(current);
  if (next === current) {
    return Object.freeze({
      changed: false,
      state: readModel(actor, combatant),
    });
  }
  const result = await persist(actor, combatant, next);
  if (movementPlan) {
    await updateActorPosture(actor, movementPlan.postureAfter);
  }
  return result;
}

export async function resetCombatantActions(
  actor: object,
  expectedRevision: number,
): Promise<D6CombatCommandResultV1> {
  assertAuthorized(actor);
  const combatant = activeCombatant(actor);
  if (!combatant) throw new Error("D6E2.Combat.Error.NotInCombat");
  const current = storedState(combatant);
  assertRevision(current, expectedRevision);
  if (
    (current.completedActionIds.length > 0 ||
      (current.firstEditionCommitment?.spentActionCount ?? 0) > 0) &&
    game.user?.isGM !== true
  ) {
    throw new Error("D6E2.Combat.Error.ResetRequiresGM");
  }
  const reset = {
    ...createCombatantRoundState(current.round),
    revision: current.revision + 1,
  };
  return persist(actor, combatant, reset);
}
