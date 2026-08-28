import {
  canPreventBecomingStunned,
  D6_ROLL_CONTRACT_VERSION,
  firstEditionBodyPointWound,
  firstEditionDamageResolution,
  firstEditionStunDamageResolution,
  formatPipScore,
  healthDamageResultForDifference,
  healthDamageResultForStrategyPredicate,
  isFirstEditionWoundLevel,
  isSecondEditionCondition,
  secondEditionDamageResolution,
  type D6RollResultV1,
  type D6ResistanceRollContext,
  type D6HealthDamageStrategyId,
  type D6ScaleRollContext,
  type FirstEditionStunOutcome,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../../constants";
import { spendActorHeroPoint } from "../condition-service";
import {
  currentSecondEditionHyperLethalProfile,
  type SecondEditionHyperLethalProfile,
} from "../../settings/hyper-lethal";
import { record } from "../sheets/values";
import { forfeitWoundedCombatantActions } from "../combat-service";
import {
  currentTerminology,
  terminologyConditionLabel,
  terminologyHealthTrackLabel,
  terminologyWoundLabel,
} from "../../registries/terminology";
import {
  actorResistancePlan,
  resistanceRollContext,
  rollFirstEditionRecoveryCheck,
} from "./roll-service";
import {
  applyFirstEditionStunDamage,
  resolveFirstEditionIncapacitation,
} from "../first-edition-injury-service";
import { actorHeroPointBalance } from "../hero-point-service";
import { currentMetaCurrencyRuntimeStrategy } from "../../settings/roll-outcome";
import {
  actorHealthResolutionStrategy,
  applyActorHealthDamageOutcome,
  currentHealthResolutionStrategy,
  damageActorHealthPool,
  readActorHealth,
  setActorHealthTrack,
} from "../health-runtime";
import { settingHealthStateLabel } from "../../settings/setting-profile";
import { applyActorFirstEditionAccumulatingStun } from "../first-edition-accumulating-stun-service";
import { booleanSetting } from "../../settings/setting-values";
import { FIRST_EDITION_OPTION_KEYS } from "../../settings/settings-catalog";
import { currentConfiguredHealthModel } from "../../settings/health-model-library";
import { currentConfiguredRulesProfile } from "../../settings/rules-profile-library";
import {
  requestActorResistanceRoll,
  validateRequestedResistanceRollArtifacts,
  type RequestedResistanceRollPresentation,
} from "../roll-requests";

let registered = false;

function activeBodyPoints(actor: FoundryActorDocument) {
  const pool = readActorHealth(actor).pool;
  if (!pool)
    throw new Error("D6E2.Combat.FirstEdition.BodyPoints.MaximumRequired");
  return pool;
}

export function skipsFirstEditionBodyPointResistanceRoll(
  damageStrategyId: D6HealthDamageStrategyId,
  resistanceScore: number,
): boolean {
  return (
    (damageStrategyId === "open-d6.damage.body-points" ||
      damageStrategyId === "open-d6.damage.body-points-with-wounds") &&
    Math.max(0, Math.trunc(resistanceScore)) === 0
  );
}

/** Damage totals may include an ordinary result modifier, but a resistance
 * difficulty is never negative. Keep request construction and returned-roll
 * evidence validation on the same normalized value. */
export function damageResistanceDifficulty(damageTotal: number): number {
  return Math.max(0, Math.trunc(damageTotal));
}

export type DamageResolutionStrategy =
  | "open-d6-accumulating-stuns"
  | "open-d6-stun-only"
  | "open-d6-body-points"
  | "open-d6-body-points-with-wounds"
  | "open-d6-wound-levels"
  | "second-edition-conditions"
  | "second-edition-machine-conditions";

export interface DamageResolutionFlag {
  readonly actionsForfeited?: boolean;
  readonly damageKind: "physical" | "stun";
  readonly damageTotal: number;
  readonly bodyPointsCurrent?: number;
  readonly bodyPointsMaximum?: number;
  readonly difference?: number;
  readonly incoming: string;
  readonly incomingLabel?: string;
  readonly conditionLabel?: string;
  readonly nextCondition: string;
  readonly killingBlow?: boolean;
  readonly killingBlowPrevented?: boolean;
  readonly hyperLethalRemoveStunned?: boolean;
  readonly hyperLethalRemoveWounded?: boolean;
  readonly hyperLethalKillingBlows?: boolean;
  readonly previousCondition: string;
  readonly prevented: boolean;
  readonly resistanceComplication: boolean;
  readonly resistanceKind?: "machine" | "personal";
  readonly resistanceRoll?: DamageResolutionResistanceRoll;
  readonly resistanceTotal: number;
  readonly status: "applied";
  readonly strategy: DamageResolutionStrategy;
  readonly stunWound?: FirstEditionStunOutcome;
  readonly stunTotal?: number;
  readonly stunThreshold?: number;
  readonly stunPenaltyDice?: number;
  readonly stunRoundsRemaining?: number;
  readonly targetActorId: string;
  readonly targetName: string;
  readonly version: 1;
  readonly unconsciousMinutes?: number;
}

interface DamageResolutionResistanceRoll extends RequestedResistanceRollPresentation {
  readonly armorContributors: readonly {
    readonly label: string;
    readonly scoreLabel: string;
  }[];
  readonly baseLabel: string;
  readonly baseScoreLabel: string;
  readonly protectionLabel: string;
  readonly protectionScoreLabel: string;
}

export function damageResolutionResistanceRoll(
  roll: RequestedResistanceRollPresentation,
  context: D6ResistanceRollContext,
): DamageResolutionResistanceRoll {
  return Object.freeze({
    ...roll,
    armorContributors: Object.freeze(
      context.armorContributors.map((item) =>
        Object.freeze({
          label: item.label,
          scoreLabel: formatPipScore(item.score),
        }),
      ),
    ),
    baseLabel: context.baseLabel,
    baseScoreLabel: formatPipScore(context.brawnScore),
    protectionLabel: context.protectionLabel,
    protectionScoreLabel: formatPipScore(context.armorScore),
  });
}

type DamageResolutionStatus = "applied" | "resolving" | null;

export type DamageConditionSeverity =
  "critical" | "fatal" | "minor" | "safe" | "wounded";

export function damageConditionSeverity(
  condition: string,
): DamageConditionSeverity {
  if (condition === "dead" || condition === "mortally-wounded") return "fatal";
  if (condition === "incapacitated") return "critical";
  if (condition === "wounded" || condition === "severely-wounded")
    return "wounded";
  if (condition === "staggered" || condition === "stunned") return "minor";
  return "safe";
}

function damageConditionIcon(severity: DamageConditionSeverity): string {
  if (severity === "fatal") return "fa-skull-crossbones";
  if (severity === "critical") return "fa-heart-crack";
  if (severity === "wounded") return "fa-droplet";
  if (severity === "minor") return "fa-burst";
  return "fa-shield-heart";
}

function notifyAppliedCondition(
  targetName: string,
  condition: string,
  strategy: DamageResolutionStrategy,
  label?: string,
): void {
  const message = game.i18n.format("D6E2.Combat.Damage.AppliedNotification", {
    condition: label ?? damageConditionLabel(strategy, condition),
    target: targetName,
  });
  if (
    ["critical", "fatal", "wounded"].includes(
      damageConditionSeverity(condition),
    )
  ) {
    ui.notifications.warn(message);
  } else {
    ui.notifications.info(message);
  }
}

function rollResult(value: unknown): D6RollResultV1 | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("contractVersion" in value) ||
    value.contractVersion !== D6_ROLL_CONTRACT_VERSION ||
    !("request" in value) ||
    typeof value.request !== "object" ||
    value.request === null
  ) {
    return null;
  }
  return value as D6RollResultV1;
}

function messageElement(value: unknown): HTMLElement | null {
  if (value instanceof HTMLElement) return value;
  if (Array.isArray(value) && value[0] instanceof HTMLElement) return value[0];
  return null;
}

export function damageScaleContext(
  result: D6RollResultV1,
): D6ScaleRollContext | null {
  const scale = result.request.context?.scale;
  return result.request.kind === "damage" && scale?.application === "damage"
    ? scale
    : null;
}

function isPersonalDamageTarget(actor: FoundryActorDocument): boolean {
  return ["character", "creature", "npc"].includes(actor.type);
}

function isMachineDamageTarget(actor: FoundryActorDocument): boolean {
  return ["starship", "vehicle"].includes(actor.type);
}

function targetActor(scale: D6ScaleRollContext): FoundryActorDocument | null {
  const tokenActor =
    scale.targetTokenId === undefined
      ? undefined
      : canvas.tokens?.placeables.find(
          (token) => token.id === scale.targetTokenId,
        )?.actor;
  return tokenActor ?? game.actors?.get(scale.targetActorId) ?? null;
}

function usesSecondEditionConditionTerminology(
  strategy: DamageResolutionStrategy,
): boolean {
  return (
    strategy === "second-edition-conditions" ||
    strategy === "second-edition-machine-conditions"
  );
}

export function damageConditionLabel(
  strategy: DamageResolutionStrategy,
  condition: string,
): string {
  if (
    usesSecondEditionConditionTerminology(strategy) &&
    isSecondEditionCondition(condition)
  ) {
    return terminologyConditionLabel(currentTerminology(), condition);
  }
  if (isFirstEditionWoundLevel(condition)) {
    return terminologyWoundLabel(currentTerminology(), condition);
  }
  const suffix = condition
    .split("-")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("");
  return game.i18n.localize(`D6E2.Condition.${suffix}`);
}

function projectedHealthStateLabel(
  projection: ReturnType<typeof readActorHealth>,
  stateId: string,
): string {
  const inherited =
    projection.modelId === "d6e2.health.condition-track" &&
    isSecondEditionCondition(stateId)
      ? terminologyConditionLabel(currentTerminology(), stateId)
      : projection.modelId === "open-d6.health.wound-track" &&
          isFirstEditionWoundLevel(stateId)
        ? terminologyWoundLabel(currentTerminology(), stateId)
        : (projection.track?.states.find(({ id }) => id === stateId)?.label ??
          stateId);
  return settingHealthStateLabel(projection.modelId, stateId, inherited);
}

export function damageOutcomeLabel(
  strategy: DamageResolutionStrategy,
  outcome: string,
): string {
  if (outcome === "none") return game.i18n.localize("D6E2.Combat.Damage.None");
  if (
    usesSecondEditionConditionTerminology(strategy) &&
    isSecondEditionCondition(outcome)
  ) {
    return terminologyConditionLabel(currentTerminology(), outcome);
  }
  if (isFirstEditionWoundLevel(outcome)) {
    return terminologyWoundLabel(currentTerminology(), outcome);
  }
  const suffix = outcome
    .split("-")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("");
  return game.i18n.localize(`D6E2.Condition.${suffix}`);
}

function firstEditionDamageKind(result: D6RollResultV1): "physical" | "stun" {
  const sourceTokenId = result.request.context?.scale?.sourceTokenId;
  const actor =
    (sourceTokenId
      ? canvas.tokens?.placeables.find((token) => token.id === sourceTokenId)
          ?.actor
      : undefined) ?? game.actors?.get(result.request.source.actorId);
  const itemId = result.request.source.itemId;
  const item = itemId ? actor?.items.get(itemId) : undefined;
  const damageType =
    typeof item?.system.damageType === "string"
      ? item.system.damageType.trim().toLocaleLowerCase()
      : "";
  return damageType.includes("stun") ? "stun" : "physical";
}

export function initiatingActionDamageKind(
  result: D6RollResultV1,
): "physical" | "stun" {
  return currentHealthResolutionStrategy().family === "conditions"
    ? "physical"
    : firstEditionDamageKind(result);
}

export function damageResolutionStatus(value: unknown): DamageResolutionStatus {
  if (
    typeof value !== "object" ||
    value === null ||
    !("status" in value) ||
    !("version" in value) ||
    value.version !== 1
  ) {
    return null;
  }
  return value.status === "applied" || value.status === "resolving"
    ? value.status
    : null;
}

function appliedFlag(value: unknown): DamageResolutionFlag | null {
  if (damageResolutionStatus(value) !== "applied") return null;
  return value as DamageResolutionFlag;
}

function appendResistanceFace(
  container: HTMLElement,
  value: number,
  options: {
    readonly characterPoint?: boolean;
    readonly discarded?: boolean;
    readonly wild?: boolean;
  } = {},
): void {
  const face = document.createElement("span");
  face.textContent = String(value);
  if (options.characterPoint) face.classList.add("is-character-point");
  if (options.discarded) face.classList.add("is-discarded");
  if (options.wild) {
    face.classList.add("is-wild");
    if (value === 1) face.classList.add("is-one");
    if (value === 6) face.classList.add("is-six");
    face.title = game.i18n.localize("D6E2.Roll.WildDie");
  }
  container.append(face);
}

function appendIntegratedResistanceRoll(
  summary: HTMLElement,
  roll: DamageResolutionResistanceRoll,
): void {
  const section = document.createElement("section");
  section.className = "od6chat-integrated-resistance";

  const header = document.createElement("div");
  header.className = "od6chat-integrated-resistance-header";
  const label = document.createElement("span");
  label.textContent = game.i18n.localize("D6E2.Combat.Resistance");
  const pool = document.createElement("strong");
  pool.textContent = `${roll.pool.dice}D${roll.pool.pips > 0 ? `+${roll.pool.pips}` : ""}`;
  header.append(label, pool);
  section.append(header);

  const breakdown = document.createElement("div");
  breakdown.className = "od6chat-integrated-resistance-breakdown";
  const breakdownValue = document.createElement("strong");
  breakdownValue.textContent = `${roll.baseLabel} ${roll.baseScoreLabel}${roll.protectionScoreLabel === "0D" ? "" : ` + ${roll.protectionLabel} ${roll.protectionScoreLabel}`}`;
  const contributors = document.createElement("small");
  contributors.textContent =
    roll.armorContributors.length > 0
      ? roll.armorContributors
          .map((item) => `${item.label} +${item.scoreLabel}`)
          .join(" · ")
      : game.i18n.localize("D6E2.Combat.NoArmorContribution");
  breakdown.append(breakdownValue, contributors);
  section.append(breakdown);

  const dice = document.createElement("div");
  dice.className = "od6chat-dice od6chat-integrated-resistance-dice";
  dice.setAttribute("aria-label", game.i18n.localize("D6E2.Roll.DiceResults"));
  const highestDiscardedIndex =
    roll.wildOutcome === "penalty"
      ? roll.baseFaces.indexOf(Math.max(...roll.baseFaces))
      : -1;
  roll.baseFaces.forEach((face, index) =>
    appendResistanceFace(dice, face, {
      discarded: index === highestDiscardedIndex,
    }),
  );
  roll.wildFaces.forEach((face, index) =>
    appendResistanceFace(dice, face, {
      discarded:
        index === 0 &&
        (roll.wildOutcome === "penalty" ||
          (roll.wildPolicy === "second-edition-classic" &&
            roll.wildOutcome === "complication")),
      wild: true,
    }),
  );
  roll.characterPointFaces.forEach((face) =>
    appendResistanceFace(dice, face, { characterPoint: true }),
  );
  if (roll.resultModifier !== 0) {
    const modifier = document.createElement("span");
    modifier.className = "is-modifier";
    modifier.textContent =
      roll.resultModifier > 0
        ? `+${roll.resultModifier}`
        : String(roll.resultModifier);
    dice.append(modifier);
  }
  section.append(dice);

  const total = document.createElement("div");
  total.className = "od6chat-total od6chat-integrated-resistance-total";
  const totalValue = document.createElement("strong");
  totalValue.textContent = String(roll.total);
  const totalLabel = document.createElement("span");
  totalLabel.textContent = game.i18n.localize("D6E2.Roll.Total");
  total.append(totalValue, totalLabel);
  section.append(total);

  const status = document.createElement("p");
  const successful = roll.total >= roll.difficulty;
  status.className = `od6chat-status ${successful ? "is-success" : "is-failure"}`;
  status.textContent = `${game.i18n.localize(successful ? "D6E2.Roll.Success" : "D6E2.Roll.Failure")} · ${game.i18n.localize("D6E2.Roll.Difficulty")} ${roll.difficulty}`;
  section.append(status);
  summary.append(section);
}

function renderAppliedSummary(
  card: HTMLElement,
  flag: DamageResolutionFlag,
): void {
  if (card.querySelector("[data-damage-resolution-summary]")) return;
  const summary = document.createElement("section");
  const severity = damageConditionSeverity(flag.nextCondition);
  summary.className = `od6chat-damage-resolution is-${severity}`;
  summary.dataset.damageResolutionSummary = "true";
  summary.dataset.damageCondition = flag.nextCondition;
  summary.setAttribute("role", "status");
  summary.setAttribute("aria-atomic", "true");
  summary.setAttribute("aria-live", "polite");

  const banner = document.createElement("div");
  banner.className = "od6chat-damage-result";

  const resultIcon = document.createElement("i");
  resultIcon.className = `fa-solid ${damageConditionIcon(severity)}`;
  resultIcon.setAttribute("aria-hidden", "true");

  const resultCopy = document.createElement("div");
  const resultLabel = document.createElement("span");
  resultLabel.className = "od6chat-damage-result-label";
  resultLabel.textContent = game.i18n.localize(
    "D6E2.Combat.Damage.ConditionApplied",
  );
  const resultCondition = document.createElement("strong");
  resultCondition.className = "od6chat-damage-result-condition";
  resultCondition.textContent =
    flag.conditionLabel ??
    damageConditionLabel(flag.strategy, flag.nextCondition);
  const resultTarget = document.createElement("span");
  resultTarget.className = "od6chat-damage-result-target";
  resultTarget.textContent = flag.targetName;
  resultCopy.append(resultLabel, resultCondition, resultTarget);
  banner.append(resultIcon, resultCopy);
  summary.append(banner);

  if (flag.resistanceRoll) {
    appendIntegratedResistanceRoll(summary, flag.resistanceRoll);
  }

  const heading = document.createElement("strong");
  heading.className = "od6chat-damage-resolution-heading";
  heading.textContent = game.i18n.localize("D6E2.Combat.Damage.Applied");
  summary.append(heading);

  const comparison = document.createElement("span");
  comparison.textContent = game.i18n.format(
    flag.resistanceKind === "machine"
      ? "D6E2.Combat.Damage.MachineComparisonSummary"
      : "D6E2.Combat.Damage.ComparisonSummary",
    {
      damage: flag.damageTotal,
      resistance: flag.resistanceTotal,
      target: flag.targetName,
    },
  );
  summary.append(comparison);

  const outcome = document.createElement("span");
  outcome.textContent =
    flag.killingBlow === true
      ? game.i18n.format(
          flag.killingBlowPrevented === true
            ? "D6E2.Combat.HyperLethal.KillingBlowSurvivedSummary"
            : "D6E2.Combat.HyperLethal.KillingBlowSummary",
          {
            condition:
              flag.conditionLabel ??
              damageConditionLabel(flag.strategy, flag.nextCondition),
          },
        )
      : flag.damageKind === "stun"
        ? flag.stunWound === "none"
          ? game.i18n.localize("D6E2.Combat.Damage.StunNoneSummary")
          : game.i18n.format("D6E2.Combat.Damage.StunSummary", {
              duration: flag.unconsciousMinutes ?? 0,
              result: damageOutcomeLabel(
                flag.strategy,
                flag.stunWound ?? "none",
              ),
            })
        : game.i18n.format(
            flag.prevented
              ? "D6E2.Combat.Damage.PreventedSummary"
              : flag.resistanceComplication &&
                  flag.incoming === "mortally-wounded"
                ? "D6E2.Combat.Damage.ComplicationSummary"
                : "D6E2.Combat.Damage.OutcomeSummary",
            {
              condition:
                flag.conditionLabel ??
                damageConditionLabel(flag.strategy, flag.nextCondition),
              incoming:
                flag.incomingLabel ??
                damageOutcomeLabel(flag.strategy, flag.incoming),
              prevented: damageConditionLabel(flag.strategy, "stunned"),
            },
          );
  summary.append(outcome);
  if (
    flag.bodyPointsCurrent !== undefined &&
    flag.bodyPointsMaximum !== undefined
  ) {
    const bodyPoints = document.createElement("span");
    bodyPoints.textContent = game.i18n.format(
      "D6E2.Combat.FirstEdition.BodyPoints.ChatSummary",
      {
        current: flag.bodyPointsCurrent,
        maximum: flag.bodyPointsMaximum,
        track:
          flag.strategy === "open-d6-body-points"
            ? terminologyHealthTrackLabel(
                currentTerminology(),
                "open-d6.damage.body-points",
              )
            : game.i18n.localize("D6E2.Combat.FirstEdition.BodyPoints.Track"),
      },
    );
    summary.append(bodyPoints);
  }
  if (
    flag.strategy === "open-d6-accumulating-stuns" &&
    flag.stunTotal !== undefined &&
    flag.stunThreshold !== undefined
  ) {
    const stuns = document.createElement("span");
    stuns.textContent = game.i18n.format(
      "D6E2.Combat.FirstEdition.AccumulatingStuns.ChatSummary",
      {
        penalty: flag.stunPenaltyDice ?? 0,
        rounds: flag.stunRoundsRemaining ?? 0,
        threshold: flag.stunThreshold,
        total: flag.stunTotal,
      },
    );
    summary.append(stuns);
  }
  if (
    flag.hyperLethalRemoveStunned === true ||
    flag.hyperLethalRemoveWounded === true ||
    flag.hyperLethalKillingBlows === true
  ) {
    const track = document.createElement("span");
    track.textContent = game.i18n.format(
      "D6E2.Combat.HyperLethal.TrackSummary",
      {
        options: [
          ...(flag.hyperLethalRemoveStunned === true
            ? [game.i18n.localize("D6E2.Combat.HyperLethal.RemovedStunned")]
            : []),
          ...(flag.hyperLethalRemoveWounded === true
            ? [game.i18n.localize("D6E2.Combat.HyperLethal.RemovedWounded")]
            : []),
          ...(flag.hyperLethalKillingBlows === true
            ? [game.i18n.localize("D6E2.Combat.HyperLethal.KillingBlowsActive")]
            : []),
        ].join(" · "),
      },
    );
    summary.append(track);
  }
  if (flag.actionsForfeited === true) {
    const forfeiture = document.createElement("span");
    forfeiture.textContent = game.i18n.localize(
      "D6E2.Combat.Damage.ActionsForfeitedSummary",
    );
    summary.append(forfeiture);
  }
  card.append(summary);
}

function renderResolveAction(
  card: HTMLElement,
  message: FoundryChatMessageDocument,
  result: D6RollResultV1,
  scale: D6ScaleRollContext,
): void {
  if (
    game.user?.isGM !== true ||
    card.querySelector('[data-action="resolveDamage"]')
  ) {
    return;
  }
  const actions = document.createElement("div");
  actions.className = "od6chat-actions";
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = "resolveDamage";
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-heart-pulse";
  icon.setAttribute("aria-hidden", "true");
  const damageKind =
    result.request.context?.explosive?.damageKind ??
    initiatingActionDamageKind(result);
  button.append(
    icon,
    ` ${game.i18n.localize(
      damageKind === "stun"
        ? "D6E2.Combat.Damage.ResolveStun"
        : "D6E2.Combat.Damage.Resolve",
    )}`,
  );
  button.addEventListener("click", () => {
    void resolveDamage(message, button, result, scale, damageKind);
  });
  actions.append(button);
  card.append(actions);
}

async function promptStunnedPrevention(): Promise<"accept" | "prevent"> {
  const condition = terminologyConditionLabel(currentTerminology(), "stunned");
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/actor/character/prevent-stunned.hbs`,
    { condition },
  );
  const result = await foundry.applications.api.DialogV2.wait<
    "accept" | "prevent"
  >({
    buttons: [
      {
        action: "accept",
        callback: () => "accept",
        label: game.i18n.format("D6E2.Condition.AcceptStunned", { condition }),
      },
      {
        action: "prevent",
        callback: () => "prevent",
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-bolt",
        label: game.i18n.localize("D6E2.Condition.PreventStunned"),
      },
    ],
    classes: ["d6e2", "od6roll-dialog", "d6e2-hero-point-dialog"],
    content,
    modal: true,
    rejectClose: false,
    window: {
      icon: "fa-solid fa-heart-pulse",
      title: game.i18n.format("D6E2.Condition.StunnedIncoming", { condition }),
    },
  });
  return result === "prevent" ? "prevent" : "accept";
}

async function promptKillingBlowSurvival(): Promise<"accept" | "survive"> {
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/actor/character/survive-killing-blow.hbs`,
    {},
  );
  const result = await foundry.applications.api.DialogV2.wait<
    "accept" | "survive"
  >({
    buttons: [
      {
        action: "accept",
        callback: () => "accept",
        label: game.i18n.localize("D6E2.Combat.HyperLethal.AcceptKillingBlow"),
      },
      {
        action: "survive",
        callback: () => "survive",
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-bolt",
        label: game.i18n.localize("D6E2.Combat.HyperLethal.SurviveKillingBlow"),
      },
    ],
    classes: ["d6e2", "od6roll-dialog", "d6e2-hero-point-dialog"],
    content,
    modal: true,
    rejectClose: false,
    window: {
      icon: "fa-solid fa-skull-crossbones",
      title: game.i18n.localize("D6E2.Combat.HyperLethal.KillingBlowIncoming"),
    },
  });
  return result === "survive" ? "survive" : "accept";
}

async function promptIncapacitationCheck(): Promise<
  "stamina" | "willpower" | null
> {
  const result = await foundry.applications.api.DialogV2.wait<
    "stamina" | "willpower" | null
  >({
    buttons: [
      {
        action: "cancel",
        callback: () => null,
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "stamina",
        callback: () => "stamina",
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-dumbbell",
        label: game.i18n.localize("D6E2.Skill.Stamina"),
      },
      {
        action: "willpower",
        callback: () => "willpower",
        icon: "fa-solid fa-brain",
        label: game.i18n.localize("D6E2.Skill.Willpower"),
      },
    ],
    classes: ["d6e2", "od6roll-dialog"],
    content: `<div class="od6-dialog-shell"><p>${game.i18n.localize(
      "D6E2.Combat.FirstEdition.Consciousness.IncapacitationHelp",
    )}</p></div>`,
    modal: true,
    rejectClose: false,
    window: {
      icon: "fa-solid fa-person-falling",
      title: game.i18n.localize(
        "D6E2.Combat.FirstEdition.Consciousness.IncapacitationTitle",
      ),
    },
  });
  return result ?? null;
}

async function resolveDamage(
  message: FoundryChatMessageDocument,
  button: HTMLButtonElement,
  damageResult: D6RollResultV1,
  scale: D6ScaleRollContext,
  damageKind: "physical" | "stun",
  resistanceRequest: {
    readonly createdAt?: number;
    readonly deferLocal?: boolean;
    readonly expiresAt?: number;
    readonly id?: string;
    readonly visibility?: "hidden" | "private" | "public";
  } = {},
): Promise<void> {
  if (button.dataset.pending === "true") return;
  if (
    damageResolutionStatus(message.getFlag(SYSTEM_ID, "damageResolution")) !==
    null
  ) {
    button.disabled = true;
    return;
  }
  const target = targetActor(scale);
  if (!target) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Combat.Damage.TargetMissing"),
    );
    return;
  }
  if (!isPersonalDamageTarget(target)) {
    if (
      !isMachineDamageTarget(target) ||
      currentHealthResolutionStrategy().family !== "conditions"
    ) {
      ui.notifications.warn(
        game.i18n.localize("D6E2.Combat.Damage.PersonalTargetRequired"),
      );
      return;
    }
  }
  button.dataset.pending = "true";
  button.disabled = true;
  button.textContent = game.i18n.localize("D6E2.Combat.Damage.Resolving");
  try {
    await message.update({
      [`flags.${SYSTEM_ID}.damageResolution`]: {
        status: "resolving",
        userId: game.user?.id ?? "",
        version: 1,
      },
    });
    const healthStrategy = actorHealthResolutionStrategy(target);
    const activeHealth = readActorHealth(target);
    const skipResistanceRoll =
      isPersonalDamageTarget(target) &&
      skipsFirstEditionBodyPointResistanceRoll(
        healthStrategy.id,
        actorResistancePlan(target).score,
      );
    const resistanceDifficulty = damageResistanceDifficulty(damageResult.total);
    const resistance = skipResistanceRoll
      ? null
      : await requestActorResistanceRoll(
          target,
          scale,
          resistanceDifficulty,
          resistanceRequest,
        );
    if (resistance?.status !== "rolled" && !skipResistanceRoll) {
      await message.update({
        [`flags.${SYSTEM_ID}.damageResolution`]: null,
      });
      button.disabled = false;
      delete button.dataset.pending;
      button.textContent = game.i18n.localize(
        damageKind === "stun"
          ? "D6E2.Combat.Damage.ResolveStun"
          : "D6E2.Combat.Damage.Resolve",
      );
      return;
    }
    if (
      !skipResistanceRoll &&
      (resistance?.resistanceRoll === undefined ||
        resistance.resistanceRoll.total !== resistance.total ||
        resistance.resistanceRoll.difficulty !== resistanceDifficulty)
    ) {
      await message.update({
        [`flags.${SYSTEM_ID}.damageResolution`]: null,
      });
      throw new Error("D6E2.Combat.Damage.ResistanceEvidenceMissing");
    }
    if (resistance?.resistanceRoll) {
      await validateRequestedResistanceRollArtifacts(
        resistance.resistanceRoll,
        {
          actorId: target.id,
          difficulty: resistanceDifficulty,
          requestId:
            resistanceRequest.id ?? resistance.resistanceRoll.requestId,
        },
      );
    }
    const context = skipResistanceRoll ? null : resistanceRollContext(target);
    if (!skipResistanceRoll && context === null) {
      await message.update({
        [`flags.${SYSTEM_ID}.damageResolution`]: null,
      });
      throw new Error("D6E2.Combat.Damage.ResistanceEvidenceMissing");
    }
    const resistanceRoll =
      resistance?.resistanceRoll && context
        ? damageResolutionResistanceRoll(resistance.resistanceRoll, context)
        : undefined;
    const resistanceTotal = resistance?.total ?? 0;
    const health = record(target.system.health);
    if (healthStrategy.family !== "conditions") {
      const accumulatingStuns = booleanSetting(
        FIRST_EDITION_OPTION_KEYS.trackStuns,
        false,
      );
      if (healthStrategy.family === "body-points" && damageKind === "stun") {
        const previousBodyPoints = activeBodyPoints(target);
        if (previousBodyPoints.maximum <= 0) {
          await message.update({
            [`flags.${SYSTEM_ID}.damageResolution`]: null,
          });
          throw new Error(
            "D6E2.Combat.FirstEdition.BodyPoints.MaximumRequired",
          );
        }
        const netBeforeStrength = Math.max(
          0,
          damageResult.total - resistanceTotal,
        );
        const strength =
          netBeforeStrength > 0
            ? await rollFirstEditionRecoveryCheck(
                target,
                game.i18n.localize(
                  "D6E2.Combat.FirstEdition.BodyPoints.StunResistance",
                ),
                "brawn",
                netBeforeStrength,
                undefined,
                undefined,
                true,
              )
            : null;
        if (netBeforeStrength > 0 && !strength) {
          await message.update({
            [`flags.${SYSTEM_ID}.damageResolution`]: null,
          });
          return;
        }
        const strengthTotal = Math.max(0, Math.trunc(strength?.total ?? 0));
        const difference = Math.max(0, netBeforeStrength - strengthTotal);
        const previousWound = firstEditionBodyPointWound(
          previousBodyPoints.current,
          previousBodyPoints.maximum,
        );
        const healthCommand = await damageActorHealthPool(target, difference);
        const applied = healthCommand.current.pool;
        if (!applied)
          throw new Error(
            "D6E2.Combat.FirstEdition.BodyPoints.MaximumRequired",
          );
        const appliedWound = healthCommand.current.track?.currentStateId;
        const wound = isFirstEditionWoundLevel(appliedWound)
          ? appliedWound
          : firstEditionBodyPointWound(applied.current, applied.maximum);
        let accumulating;
        if (difference > 0 && !["mortally-wounded", "dead"].includes(wound)) {
          const stunResolution = {
            damageTotal: damageResult.total,
            difference,
            reducedWound: "stunned",
            resistanceTotal: resistanceTotal + strengthTotal,
            unconsciousMinutes: difference,
          } as const;
          if (accumulatingStuns) {
            accumulating = await applyActorFirstEditionAccumulatingStun(
              target,
              stunResolution,
            );
          } else {
            await applyFirstEditionStunDamage(target, stunResolution);
          }
        }
        const flag: DamageResolutionFlag = {
          bodyPointsCurrent: applied.current,
          bodyPointsMaximum: applied.maximum,
          damageKind,
          damageTotal: damageResult.total,
          difference,
          incoming: difference > 0 ? "stunned" : "none",
          nextCondition: wound,
          previousCondition: previousWound,
          prevented: false,
          resistanceComplication: false,
          ...(resistanceRoll === undefined ? {} : { resistanceRoll }),
          resistanceTotal: resistanceTotal + strengthTotal,
          status: "applied",
          strategy:
            accumulatingStuns && accumulating
              ? "open-d6-accumulating-stuns"
              : healthStrategy.woundDerivation
                ? "open-d6-body-points-with-wounds"
                : "open-d6-body-points",
          ...(accumulating
            ? {
                stunTotal: accumulating.state.total,
                stunThreshold: accumulating.threshold,
                stunPenaltyDice: accumulating.state.penaltyDice,
                stunRoundsRemaining: accumulating.state.roundsRemaining,
              }
            : {}),
          stunWound: difference > 0 ? "stunned" : "none",
          targetActorId: target.id,
          targetName: target.name,
          unconsciousMinutes: accumulating?.unconsciousMinutes ?? difference,
          version: 1,
        };
        await message.update({
          [`flags.${SYSTEM_ID}.damageResolution`]: flag,
        });
        return;
      }
      if (
        healthStrategy.family === "body-points" &&
        damageKind === "physical"
      ) {
        const previousBodyPoints = activeBodyPoints(target);
        if (previousBodyPoints.maximum <= 0) {
          await message.update({
            [`flags.${SYSTEM_ID}.damageResolution`]: null,
          });
          throw new Error(
            "D6E2.Combat.FirstEdition.BodyPoints.MaximumRequired",
          );
        }
        const previousWound = firstEditionBodyPointWound(
          previousBodyPoints.current,
          previousBodyPoints.maximum,
        );
        const healthCommand = await damageActorHealthPool(
          target,
          damageResult.total - resistanceTotal,
        );
        const applied = healthCommand.current.pool;
        if (!applied)
          throw new Error(
            "D6E2.Combat.FirstEdition.BodyPoints.MaximumRequired",
          );
        const appliedStateId = healthCommand.current.track?.currentStateId;
        const appliedWound = isFirstEditionWoundLevel(appliedStateId)
          ? appliedStateId
          : firstEditionBodyPointWound(applied.current, applied.maximum);
        const combined = healthStrategy.woundDerivation;
        const flag: DamageResolutionFlag = {
          bodyPointsCurrent: applied.current,
          bodyPointsMaximum: applied.maximum,
          damageKind,
          damageTotal: damageResult.total,
          difference: damageResult.total - resistanceTotal,
          incoming: appliedWound === "healthy" ? "none" : appliedWound,
          nextCondition: appliedWound,
          previousCondition: previousWound,
          prevented: false,
          resistanceComplication: false,
          ...(resistanceRoll === undefined ? {} : { resistanceRoll }),
          resistanceTotal,
          status: "applied",
          strategy: combined
            ? "open-d6-body-points-with-wounds"
            : "open-d6-body-points",
          targetActorId: target.id,
          targetName: target.name,
          version: 1,
        };
        await message.update({
          [`flags.${SYSTEM_ID}.damageResolution`]: flag,
        });
        ui.notifications.info(
          game.i18n.format("D6E2.Combat.FirstEdition.BodyPoints.Applied", {
            current: applied.current,
            maximum: applied.maximum,
            target: target.name,
            track: healthStrategy.woundDerivation
              ? game.i18n.localize("D6E2.Combat.FirstEdition.BodyPoints.Track")
              : terminologyHealthTrackLabel(
                  currentTerminology(),
                  "open-d6.damage.body-points",
                ),
          }),
        );
        return;
      }
      const previousWound = isFirstEditionWoundLevel(health.firstEditionWound)
        ? health.firstEditionWound
        : "healthy";
      const customWoundTrack =
        activeHealth.kind === "track" &&
        activeHealth.modelId !== "open-d6.health.wound-track";
      const previousWoundState = customWoundTrack
        ? (activeHealth.track?.currentStateId ?? "healthy")
        : previousWound;
      if (damageKind === "stun") {
        const resolution = firstEditionStunDamageResolution(
          damageResult.total,
          resistanceTotal,
        );
        const accumulating = accumulatingStuns
          ? await applyActorFirstEditionAccumulatingStun(target, resolution)
          : undefined;
        if (!accumulating) {
          await applyFirstEditionStunDamage(target, resolution);
        }
        const flag: DamageResolutionFlag = {
          damageKind,
          damageTotal: resolution.damageTotal,
          difference: resolution.difference,
          incoming: resolution.reducedWound,
          nextCondition: previousWound,
          previousCondition: previousWound,
          prevented: false,
          resistanceComplication: false,
          ...(resistanceRoll === undefined ? {} : { resistanceRoll }),
          resistanceTotal: resolution.resistanceTotal,
          status: "applied",
          strategy: accumulating
            ? "open-d6-accumulating-stuns"
            : "open-d6-stun-only",
          ...(accumulating
            ? {
                stunTotal: accumulating.state.total,
                stunThreshold: accumulating.threshold,
                stunPenaltyDice: accumulating.state.penaltyDice,
                stunRoundsRemaining: accumulating.state.roundsRemaining,
              }
            : {}),
          stunWound: resolution.reducedWound,
          targetActorId: target.id,
          targetName: target.name,
          unconsciousMinutes:
            accumulating?.unconsciousMinutes ?? resolution.unconsciousMinutes,
          version: 1,
        };
        await message.update({
          [`flags.${SYSTEM_ID}.damageResolution`]: flag,
        });
        ui.notifications.info(
          accumulating
            ? game.i18n.format(
                "D6E2.Combat.FirstEdition.AccumulatingStuns.AppliedNotification",
                {
                  target: target.name,
                  threshold: accumulating.threshold,
                  total: accumulating.state.total,
                },
              )
            : resolution.reducedWound === "none"
              ? game.i18n.format("D6E2.Combat.Damage.StunNoneNotification", {
                  target: target.name,
                })
              : game.i18n.format("D6E2.Combat.Damage.StunAppliedNotification", {
                  duration: resolution.unconsciousMinutes,
                  target: target.name,
                }),
        );
        return;
      }
      const resolution = firstEditionDamageResolution(
        damageResult.total,
        resistanceTotal,
        customWoundTrack ? "healthy" : previousWound,
      );
      const configuredModel = currentConfiguredHealthModel(
        currentConfiguredRulesProfile(),
      );
      const incoming =
        customWoundTrack && configuredModel.kind === "track"
          ? healthDamageResultForDifference(
              configuredModel,
              resolution.difference,
            )
          : resolution.incoming;
      if (!incoming) throw new Error("D6E2.Condition.Invalid");
      const healthCommand = customWoundTrack
        ? await applyActorHealthDamageOutcome(target, incoming)
        : await setActorHealthTrack(target, resolution.nextWound);
      const appliedStateId = healthCommand.current.track?.currentStateId;
      if (
        !appliedStateId ||
        (!customWoundTrack && !isFirstEditionWoundLevel(appliedStateId))
      )
        throw new Error("D6E2.Condition.Invalid");
      const flag: DamageResolutionFlag = {
        conditionLabel: projectedHealthStateLabel(
          healthCommand.current,
          appliedStateId,
        ),
        damageKind,
        damageTotal: resolution.damageTotal,
        difference: resolution.difference,
        incoming,
        ...(customWoundTrack && configuredModel.kind === "track"
          ? {
              incomingLabel: game.i18n.localize(
                configuredModel.track.damageResults.find(
                  ({ id }) => id === incoming,
                )?.label ?? incoming,
              ),
            }
          : {}),
        nextCondition: appliedStateId,
        previousCondition: previousWoundState,
        prevented: false,
        resistanceComplication: false,
        ...(resistanceRoll === undefined ? {} : { resistanceRoll }),
        resistanceTotal: resolution.resistanceTotal,
        status: "applied",
        strategy: "open-d6-wound-levels",
        targetActorId: target.id,
        targetName: target.name,
        version: 1,
      };
      await message.update({
        [`flags.${SYSTEM_ID}.damageResolution`]: flag,
      });
      if (!customWoundTrack && appliedStateId === "incapacitated") {
        try {
          const skill = await promptIncapacitationCheck();
          if (skill) await resolveFirstEditionIncapacitation(target, skill);
        } catch (error) {
          ui.notifications.warn(
            game.i18n.localize(
              error instanceof Error ? error.message : String(error),
            ),
          );
        }
      }
      notifyAppliedCondition(
        target.name,
        appliedStateId,
        "open-d6-wound-levels",
        flag.conditionLabel,
      );
      return;
    }
    const previousCondition = isSecondEditionCondition(health.condition)
      ? health.condition
      : "healthy";
    const machine = isMachineDamageTarget(target);
    const customConditionTrack =
      !machine &&
      activeHealth.kind === "track" &&
      activeHealth.modelId !== "d6e2.health.condition-track";
    const previousConditionState = customConditionTrack
      ? (activeHealth.track?.currentStateId ?? "healthy")
      : previousCondition;
    const hyperLethal: SecondEditionHyperLethalProfile = machine
      ? Object.freeze({})
      : currentSecondEditionHyperLethalProfile();
    const initialResolution = secondEditionDamageResolution(
      damageResult.total,
      resistanceTotal,
      resistance?.wildOutcome === "complication",
      customConditionTrack ? "healthy" : previousCondition,
      hyperLethal,
    );
    const heroPoints = machine ? 0 : actorHeroPointBalance(target);
    const killingBlowPrevented =
      !machine &&
      currentMetaCurrencyRuntimeStrategy().surviveKillingBlow &&
      initialResolution.killingBlow &&
      heroPoints > 0 &&
      (await promptKillingBlowSurvival()) === "survive";
    if (killingBlowPrevented) await spendActorHeroPoint(target);
    const resolution = killingBlowPrevented
      ? secondEditionDamageResolution(
          damageResult.total,
          resistanceTotal,
          resistance?.wildOutcome === "complication",
          customConditionTrack ? "healthy" : previousCondition,
          { ...hyperLethal, killingBlows: false },
        )
      : initialResolution;
    const configuredModel = currentConfiguredHealthModel(
      currentConfiguredRulesProfile(),
    );
    const authoredIncoming =
      customConditionTrack && configuredModel.kind === "track"
        ? configuredModel.track.damageResults.every(
            ({ rule }) => rule.kind === "difference-band",
          )
          ? healthDamageResultForDifference(
              configuredModel,
              resolution.damageTotal - resolution.resistanceTotal,
            )
          : healthDamageResultForStrategyPredicate(
              configuredModel,
              `d6e2.${resolution.incoming}`,
            )
        : resolution.incoming;
    if (!authoredIncoming) {
      throw new Error("D6E2.Condition.Invalid");
    }
    const prevent =
      !machine &&
      !customConditionTrack &&
      canPreventBecomingStunned(previousCondition, resolution.nextCondition) &&
      heroPoints - (killingBlowPrevented ? 1 : 0) > 0 &&
      (await promptStunnedPrevention()) === "prevent";
    const healthCommand = customConditionTrack
      ? await applyActorHealthDamageOutcome(target, authoredIncoming)
      : await setActorHealthTrack(target, resolution.nextCondition, {
          preventStunnedWithHeroPoint: prevent,
        });
    const appliedStateId = healthCommand.current.track?.currentStateId;
    if (
      !appliedStateId ||
      (!customConditionTrack && !isSecondEditionCondition(appliedStateId))
    )
      throw new Error("D6E2.Condition.Invalid");
    const actionForfeiture =
      !machine &&
      !customConditionTrack &&
      !healthCommand.prevented &&
      appliedStateId === "wounded"
        ? await forfeitWoundedCombatantActions(target)
        : null;
    const strategy: DamageResolutionStrategy = machine
      ? "second-edition-machine-conditions"
      : "second-edition-conditions";
    const flag: DamageResolutionFlag = {
      ...(actionForfeiture?.state?.actionForfeiture?.reason === "wounded"
        ? { actionsForfeited: true }
        : {}),
      damageKind: "physical",
      damageTotal: resolution.damageTotal,
      conditionLabel: projectedHealthStateLabel(
        healthCommand.current,
        appliedStateId,
      ),
      incoming: authoredIncoming,
      ...(customConditionTrack && configuredModel.kind === "track"
        ? {
            incomingLabel: game.i18n.localize(
              configuredModel.track.damageResults.find(
                ({ id }) => id === authoredIncoming,
              )?.label ?? authoredIncoming,
            ),
          }
        : {}),
      ...(initialResolution.killingBlow
        ? {
            killingBlow: true,
            killingBlowPrevented,
          }
        : {}),
      ...(hyperLethal.removeStunned === true
        ? { hyperLethalRemoveStunned: true }
        : {}),
      ...(hyperLethal.removeWounded === true
        ? { hyperLethalRemoveWounded: true }
        : {}),
      ...(hyperLethal.killingBlows === true
        ? { hyperLethalKillingBlows: true }
        : {}),
      nextCondition: appliedStateId,
      previousCondition: previousConditionState,
      prevented: healthCommand.prevented,
      resistanceComplication: resolution.resistanceComplication,
      resistanceKind: machine ? "machine" : "personal",
      ...(resistanceRoll === undefined ? {} : { resistanceRoll }),
      resistanceTotal: resolution.resistanceTotal,
      status: "applied",
      strategy,
      targetActorId: target.id,
      targetName: target.name,
      version: 1,
    };
    await message.update({
      [`flags.${SYSTEM_ID}.damageResolution`]: flag,
    });
    notifyAppliedCondition(
      target.name,
      appliedStateId,
      strategy,
      flag.conditionLabel,
    );
  } catch (error) {
    await message.update({
      [`flags.${SYSTEM_ID}.damageResolution`]: null,
    });
    const key = error instanceof Error ? error.message : String(error);
    ui.notifications.warn(game.i18n.localize(key));
    button.disabled = false;
    delete button.dataset.pending;
    button.textContent = game.i18n.localize(
      damageKind === "stun"
        ? "D6E2.Combat.Damage.ResolveStun"
        : "D6E2.Combat.Damage.Resolve",
    );
  }
}

export interface ExplosiveThreadDamageOutcome {
  readonly conditionLabel: string;
  readonly flag: DamageResolutionFlag;
  readonly resistanceTotal: number;
}

export type InitiatingActionDamageOutcome = ExplosiveThreadDamageOutcome;

/** Reuse the complete ordinary Damage/Resistance/Health authority path while
 * persisting presentation into the explosive root thread instead of creating a
 * target-specific Damage ChatMessage. The resistance request remains an
 * explicit reopenable prompt; closing it returns no outcome and applies no
 * injury. */
export async function resolveExplosiveThreadDamageTarget(
  damageResult: D6RollResultV1,
  scale: D6ScaleRollContext,
  damageKind: "physical" | "stun",
  resistanceRequest: {
    readonly createdAt: number;
    readonly id: string;
    readonly visibility: "hidden" | "private" | "public";
  },
): Promise<ExplosiveThreadDamageOutcome | null> {
  let stored: unknown = null;
  const message = {
    getFlag: (scope: string, key: string): unknown =>
      scope === SYSTEM_ID && key === "damageResolution" ? stored : undefined,
    update: (changes: Record<string, unknown>): Promise<void> => {
      const key = `flags.${SYSTEM_ID}.damageResolution`;
      if (key in changes) stored = changes[key];
      return Promise.resolve();
    },
  } as unknown as FoundryChatMessageDocument;
  const button = {
    dataset: {},
    disabled: false,
    textContent: "",
  } as HTMLButtonElement;
  await resolveDamage(message, button, damageResult, scale, damageKind, {
    ...resistanceRequest,
    deferLocal: true,
  });
  const flag = appliedFlag(stored);
  if (!flag) return null;
  return Object.freeze({
    conditionLabel:
      flag.conditionLabel ??
      damageConditionLabel(flag.strategy, flag.nextCondition),
    flag,
    resistanceTotal: flag.resistanceTotal,
  });
}

/** Neutral initiating-action adapter retained alongside the explosive name for
 * compatibility. Ordinary attacks use the same complete rules authority while
 * projecting the outcome into their initiating root. */
export const resolveInitiatingActionDamageTarget =
  resolveExplosiveThreadDamageTarget;

export function registerDamageResolutionChatActions(): void {
  if (registered) return;
  Hooks.on("renderChatMessageHTML", (...args: unknown[]) => {
    const message = args[0] as FoundryChatMessageDocument | undefined;
    const html = messageElement(args[1]);
    if (!message || !html) return;
    const card = html.matches(".od6chat-roll")
      ? html
      : html.querySelector<HTMLElement>(".od6chat-roll");
    if (!card) return;
    const result = rollResult(message.getFlag(SYSTEM_ID, "roll"));
    const scale = result ? damageScaleContext(result) : null;
    if (!result || !scale?.targetActorId) return;
    const storedResolution = message.getFlag(SYSTEM_ID, "damageResolution");
    const flag = appliedFlag(storedResolution);
    if (flag) {
      renderAppliedSummary(card, flag);
      return;
    }
    if (damageResolutionStatus(storedResolution) === "resolving") return;
    renderResolveAction(card, message, result, scale);
  });
  registered = true;
}
