import {
  canPreventBecomingStunned,
  D6_ROLL_CONTRACT_VERSION,
  firstEditionBodyPointWound,
  firstEditionDamageResolution,
  firstEditionStunDamageResolution,
  isFirstEditionWoundLevel,
  isSecondEditionCondition,
  secondEditionDamageResolution,
  type D6RollResultV1,
  type D6ScaleRollContext,
  type FirstEditionDamageOutcome,
  type FirstEditionWoundLevel,
  type FirstEditionStunOutcome,
  type SecondEditionCondition,
  type SecondEditionDamageOutcome,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../../constants";
import {
  setActorCondition,
  setActorFirstEditionWound,
  spendActorHeroPoint,
} from "../condition-service";
import { currentEditionCapabilityProfile } from "../../settings/edition-capabilities";
import {
  currentSecondEditionHyperLethalProfile,
  type SecondEditionHyperLethalProfile,
} from "../../settings/hyper-lethal";
import { record } from "../sheets/values";
import { forfeitWoundedCombatantActions } from "../combat-service";
import {
  actorResistancePlan,
  rollFirstEditionRecoveryCheck,
  rollResistanceAgainst,
} from "./roll-service";
import {
  applyFirstEditionStunDamage,
  resolveFirstEditionIncapacitation,
} from "../first-edition-injury-service";
import { actorHeroPointBalance } from "../hero-point-service";
import { currentSecondEditionHeroPointStrategy } from "../../settings/hero-points";
import { currentFirstEditionDamageMode } from "../../settings/setting-values";
import {
  damageActorFirstEditionBodyPoints,
  readActorFirstEditionBodyPoints,
} from "../first-edition-body-point-service";
import { applyActorFirstEditionAccumulatingStun } from "../first-edition-accumulating-stun-service";
import { booleanSetting } from "../../settings/setting-values";
import { FIRST_EDITION_OPTION_KEYS } from "../../settings/settings-catalog";

let registered = false;

export function skipsFirstEditionBodyPointResistanceRoll(
  damageStrategy: string,
  damageMode: string,
  resistanceScore: number,
): boolean {
  return (
    damageStrategy === "open-d6-wounds-or-body-points" &&
    damageMode !== "wounds" &&
    Math.max(0, Math.trunc(resistanceScore)) === 0
  );
}

interface DamageResolutionFlag {
  readonly actionsForfeited?: boolean;
  readonly damageKind: "physical" | "stun";
  readonly damageTotal: number;
  readonly bodyPointsCurrent?: number;
  readonly bodyPointsMaximum?: number;
  readonly difference?: number;
  readonly incoming:
    | FirstEditionDamageOutcome
    | FirstEditionWoundLevel
    | FirstEditionStunOutcome
    | SecondEditionDamageOutcome;
  readonly nextCondition: FirstEditionWoundLevel | SecondEditionCondition;
  readonly killingBlow?: boolean;
  readonly killingBlowPrevented?: boolean;
  readonly hyperLethalRemoveStunned?: boolean;
  readonly hyperLethalRemoveWounded?: boolean;
  readonly hyperLethalKillingBlows?: boolean;
  readonly previousCondition: FirstEditionWoundLevel | SecondEditionCondition;
  readonly prevented: boolean;
  readonly resistanceComplication: boolean;
  readonly resistanceKind?: "machine" | "personal";
  readonly resistanceTotal: number;
  readonly status: "applied";
  readonly strategy:
    | "open-d6-accumulating-stuns"
    | "open-d6-stun-only"
    | "open-d6-body-points"
    | "open-d6-body-points-with-wounds"
    | "open-d6-wound-levels"
    | "second-edition-conditions"
    | "second-edition-machine-conditions";
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

type DamageResolutionStatus = "applied" | "resolving" | null;

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

function conditionLabel(
  condition: FirstEditionWoundLevel | SecondEditionCondition,
): string {
  const suffix = condition
    .split("-")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("");
  return game.i18n.localize(`D6E2.Condition.${suffix}`);
}

function outcomeLabel(
  outcome:
    | FirstEditionDamageOutcome
    | FirstEditionWoundLevel
    | FirstEditionStunOutcome
    | SecondEditionDamageOutcome,
): string {
  if (outcome === "none") return game.i18n.localize("D6E2.Combat.Damage.None");
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

function renderAppliedSummary(
  card: HTMLElement,
  flag: DamageResolutionFlag,
): void {
  if (card.querySelector("[data-damage-resolution-summary]")) return;
  const summary = document.createElement("section");
  summary.className = "od6chat-damage-resolution";
  summary.dataset.damageResolutionSummary = "true";

  const heading = document.createElement("strong");
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
          { condition: conditionLabel(flag.nextCondition) },
        )
      : flag.damageKind === "stun"
        ? flag.stunWound === "none"
          ? game.i18n.localize("D6E2.Combat.Damage.StunNoneSummary")
          : game.i18n.format("D6E2.Combat.Damage.StunSummary", {
              duration: flag.unconsciousMinutes ?? 0,
              result: outcomeLabel(flag.stunWound ?? "none"),
            })
        : game.i18n.format(
            flag.prevented
              ? "D6E2.Combat.Damage.PreventedSummary"
              : flag.resistanceComplication &&
                  flag.incoming === "mortally-wounded"
                ? "D6E2.Combat.Damage.ComplicationSummary"
                : "D6E2.Combat.Damage.OutcomeSummary",
            {
              condition: conditionLabel(flag.nextCondition),
              incoming: outcomeLabel(flag.incoming),
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
    currentEditionCapabilityProfile().damage.strategy ===
    "open-d6-wounds-or-body-points"
      ? firstEditionDamageKind(result)
      : "physical";
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
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/actor/character/prevent-stunned.hbs`,
    {},
  );
  const result = await foundry.applications.api.DialogV2.wait<
    "accept" | "prevent"
  >({
    buttons: [
      {
        action: "accept",
        callback: () => "accept",
        label: game.i18n.localize("D6E2.Condition.AcceptStunned"),
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
      title: game.i18n.localize("D6E2.Condition.StunnedIncoming"),
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
      currentEditionCapabilityProfile().damage.strategy !==
        "second-edition-condition-track"
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
    const damageStrategy = currentEditionCapabilityProfile().damage.strategy;
    const firstEditionDamageMode = currentFirstEditionDamageMode();
    const skipResistanceRoll =
      isPersonalDamageTarget(target) &&
      skipsFirstEditionBodyPointResistanceRoll(
        damageStrategy,
        firstEditionDamageMode,
        actorResistancePlan(target).score,
      );
    const resistance = skipResistanceRoll
      ? null
      : await rollResistanceAgainst(target, scale, damageResult.total);
    if (!resistance && !skipResistanceRoll) {
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
    const resistanceTotal = resistance?.total ?? 0;
    const health = record(target.system.health);
    if (damageStrategy === "open-d6-wounds-or-body-points") {
      const accumulatingStuns = booleanSetting(
        FIRST_EDITION_OPTION_KEYS.trackStuns,
        false,
      );
      if (firstEditionDamageMode !== "wounds" && damageKind === "stun") {
        const previousBodyPoints = readActorFirstEditionBodyPoints(target);
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
        const applied = await damageActorFirstEditionBodyPoints(
          target,
          difference,
        );
        let accumulating;
        if (
          difference > 0 &&
          !["mortally-wounded", "dead"].includes(applied.wound)
        ) {
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
          nextCondition: applied.wound,
          previousCondition: previousWound,
          prevented: false,
          resistanceComplication: false,
          resistanceTotal: resistanceTotal + strengthTotal,
          status: "applied",
          strategy:
            accumulatingStuns && accumulating
              ? "open-d6-accumulating-stuns"
              : firstEditionDamageMode === "body-points-with-wounds"
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
      if (firstEditionDamageMode !== "wounds" && damageKind === "physical") {
        const previousBodyPoints = readActorFirstEditionBodyPoints(target);
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
        const applied = await damageActorFirstEditionBodyPoints(
          target,
          damageResult.total - resistanceTotal,
        );
        const combined = firstEditionDamageMode === "body-points-with-wounds";
        const flag: DamageResolutionFlag = {
          bodyPointsCurrent: applied.current,
          bodyPointsMaximum: applied.maximum,
          damageKind,
          damageTotal: damageResult.total,
          difference: damageResult.total - resistanceTotal,
          incoming: applied.wound === "healthy" ? "none" : applied.wound,
          nextCondition: applied.wound,
          previousCondition: previousWound,
          prevented: false,
          resistanceComplication: false,
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
          }),
        );
        return;
      }
      const previousWound = isFirstEditionWoundLevel(health.firstEditionWound)
        ? health.firstEditionWound
        : "healthy";
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
        previousWound,
      );
      const applied = await setActorFirstEditionWound(
        target,
        resolution.nextWound,
      );
      const flag: DamageResolutionFlag = {
        damageKind,
        damageTotal: resolution.damageTotal,
        difference: resolution.difference,
        incoming: resolution.incoming,
        nextCondition: applied.current,
        previousCondition: previousWound,
        prevented: false,
        resistanceComplication: false,
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
      if (applied.current === "incapacitated") {
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
      ui.notifications.info(
        game.i18n.format("D6E2.Combat.Damage.AppliedNotification", {
          condition: conditionLabel(applied.current),
          target: target.name,
        }),
      );
      return;
    }
    const previousCondition = isSecondEditionCondition(health.condition)
      ? health.condition
      : "healthy";
    const machine = isMachineDamageTarget(target);
    const hyperLethal: SecondEditionHyperLethalProfile = machine
      ? Object.freeze({})
      : currentSecondEditionHyperLethalProfile();
    const initialResolution = secondEditionDamageResolution(
      damageResult.total,
      resistanceTotal,
      resistance?.wildOutcome === "complication",
      previousCondition,
      hyperLethal,
    );
    const heroPoints = machine ? 0 : actorHeroPointBalance(target);
    const killingBlowPrevented =
      !machine &&
      currentSecondEditionHeroPointStrategy() === "heroic" &&
      initialResolution.killingBlow &&
      heroPoints > 0 &&
      (await promptKillingBlowSurvival()) === "survive";
    if (killingBlowPrevented) await spendActorHeroPoint(target);
    const resolution = killingBlowPrevented
      ? secondEditionDamageResolution(
          damageResult.total,
          resistanceTotal,
          resistance?.wildOutcome === "complication",
          previousCondition,
          { ...hyperLethal, killingBlows: false },
        )
      : initialResolution;
    const prevent =
      !machine &&
      canPreventBecomingStunned(previousCondition, resolution.nextCondition) &&
      heroPoints - (killingBlowPrevented ? 1 : 0) > 0 &&
      (await promptStunnedPrevention()) === "prevent";
    const applied = await setActorCondition(target, resolution.nextCondition, {
      preventStunnedWithHeroPoint: prevent,
    });
    const actionForfeiture =
      !machine && !applied.prevented && applied.current === "wounded"
        ? await forfeitWoundedCombatantActions(target)
        : null;
    const flag: DamageResolutionFlag = {
      ...(actionForfeiture?.state?.actionForfeiture?.reason === "wounded"
        ? { actionsForfeited: true }
        : {}),
      damageKind: "physical",
      damageTotal: resolution.damageTotal,
      incoming: resolution.incoming,
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
      nextCondition: applied.current,
      previousCondition,
      prevented: applied.prevented,
      resistanceComplication: resolution.resistanceComplication,
      resistanceKind: machine ? "machine" : "personal",
      resistanceTotal: resolution.resistanceTotal,
      status: "applied",
      strategy: machine
        ? "second-edition-machine-conditions"
        : "second-edition-conditions",
      targetActorId: target.id,
      targetName: target.name,
      version: 1,
    };
    await message.update({
      [`flags.${SYSTEM_ID}.damageResolution`]: flag,
    });
    ui.notifications.info(
      game.i18n.format("D6E2.Combat.Damage.AppliedNotification", {
        condition: conditionLabel(applied.current),
        target: target.name,
      }),
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
