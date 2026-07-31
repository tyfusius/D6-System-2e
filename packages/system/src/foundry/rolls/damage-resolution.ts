import {
  canPreventBecomingStunned,
  D6_ROLL_CONTRACT_VERSION,
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
} from "../condition-service";
import { currentEditionCapabilityProfile } from "../../settings/edition-capabilities";
import { integer, record } from "../sheets/values";
import { rollResistanceAgainst } from "./roll-service";
import {
  applyFirstEditionStunDamage,
  resolveFirstEditionIncapacitation,
} from "../first-edition-injury-service";

let registered = false;

interface DamageResolutionFlag {
  readonly damageKind: "physical" | "stun";
  readonly damageTotal: number;
  readonly difference?: number;
  readonly incoming:
    | FirstEditionDamageOutcome
    | FirstEditionStunOutcome
    | SecondEditionDamageOutcome;
  readonly nextCondition: FirstEditionWoundLevel | SecondEditionCondition;
  readonly previousCondition: FirstEditionWoundLevel | SecondEditionCondition;
  readonly prevented: boolean;
  readonly resistanceComplication: boolean;
  readonly resistanceTotal: number;
  readonly status: "applied";
  readonly strategy:
    "open-d6-stun-only" | "open-d6-wound-levels" | "second-edition-conditions";
  readonly stunWound?: FirstEditionStunOutcome;
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
    "D6E2.Combat.Damage.ComparisonSummary",
    {
      damage: flag.damageTotal,
      resistance: flag.resistanceTotal,
      target: flag.targetName,
    },
  );
  summary.append(comparison);

  const outcome = document.createElement("span");
  outcome.textContent =
    flag.damageKind === "stun"
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
    ui.notifications.warn(
      game.i18n.localize("D6E2.Combat.Damage.PersonalTargetRequired"),
    );
    return;
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
    const resistance = await rollResistanceAgainst(
      target,
      scale,
      damageResult.total,
    );
    if (!resistance) {
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
    const health = record(target.system.health);
    const damageStrategy = currentEditionCapabilityProfile().damage.strategy;
    if (damageStrategy === "open-d6-wounds-or-body-points") {
      const previousWound = isFirstEditionWoundLevel(health.firstEditionWound)
        ? health.firstEditionWound
        : "healthy";
      if (damageKind === "stun") {
        const resolution = firstEditionStunDamageResolution(
          damageResult.total,
          resistance.total,
        );
        await applyFirstEditionStunDamage(target, resolution);
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
          strategy: "open-d6-stun-only",
          stunWound: resolution.reducedWound,
          targetActorId: target.id,
          targetName: target.name,
          unconsciousMinutes: resolution.unconsciousMinutes,
          version: 1,
        };
        await message.update({
          [`flags.${SYSTEM_ID}.damageResolution`]: flag,
        });
        ui.notifications.info(
          resolution.reducedWound === "none"
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
        resistance.total,
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
    const resolution = secondEditionDamageResolution(
      damageResult.total,
      resistance.total,
      resistance.wildOutcome === "complication",
      previousCondition,
    );
    const heroPoints = integer(
      record(record(target.system.resources).heroPoints).value,
    );
    const prevent =
      canPreventBecomingStunned(previousCondition, resolution.nextCondition) &&
      heroPoints > 0 &&
      (await promptStunnedPrevention()) === "prevent";
    const applied = await setActorCondition(target, resolution.nextCondition, {
      preventStunnedWithHeroPoint: prevent,
    });
    const flag: DamageResolutionFlag = {
      damageKind: "physical",
      damageTotal: resolution.damageTotal,
      incoming: resolution.incoming,
      nextCondition: applied.current,
      previousCondition,
      prevented: applied.prevented,
      resistanceComplication: resolution.resistanceComplication,
      resistanceTotal: resolution.resistanceTotal,
      status: "applied",
      strategy: "second-edition-conditions",
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
