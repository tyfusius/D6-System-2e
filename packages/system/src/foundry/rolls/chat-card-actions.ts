import {
  D6_ROLL_CONTRACT_VERSION,
  type D6RollResultV1,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../../constants";
import { doubleDownFailedRoll, rerollFailedRoll } from "./roll-service";
import { claimRollFollowUp, releaseRollFollowUp } from "./roll-authority";
import { currentSecondEditionCampaignProfile } from "../../settings/campaign-profile";
import { currentDefenseRuntimeStrategy } from "../../settings/defenses";
import {
  d6OrdinaryAttackThreadFromMessage,
  executeD6OrdinaryWildFeint,
} from "./ordinary-attack-thread";

let registered = false;

interface DoublingDownNarrationSelection {
  readonly narration: string;
}

export interface SuccessfulWeaponDamageFollowUp {
  readonly actorId: string;
  readonly targetActorId: string;
  readonly targetName: string;
  readonly targetTokenId?: string;
  readonly weaponId: string;
}

export function successfulWeaponDamageFollowUp(
  result: D6RollResultV1,
): SuccessfulWeaponDamageFollowUp | null {
  const attack = result.request.context?.weaponAttack;
  if (!attack) return null;
  if (
    result.success !== true ||
    result.request.kind !== "weapon-attack" ||
    result.request.source.itemId !== attack.weaponId ||
    attack.targetActorId.length === 0 ||
    attack.targetName.trim().length === 0 ||
    attack.weaponId.length === 0
  ) {
    return null;
  }
  return Object.freeze({
    actorId: result.request.source.actorId,
    targetActorId: attack.targetActorId,
    targetName: attack.targetName,
    ...(attack.targetTokenId === undefined
      ? {}
      : { targetTokenId: attack.targetTokenId }),
    weaponId: attack.weaponId,
  });
}

export function doublingDownNarrationResult(value: unknown): string | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("narration" in value) ||
    typeof value.narration !== "string"
  ) {
    return null;
  }
  return value.narration;
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

export function hasD6OrdinaryWildFeintAudit(
  message: FoundryChatMessageDocument,
): boolean {
  return (d6OrdinaryAttackThreadFromMessage(message)?.audits.length ?? 0) > 0;
}

function actingActor(result: D6RollResultV1): FoundryActorDocument | null {
  return (
    game.actors?.contents.find(
      (candidate) => candidate.id === result.request.source.actorId,
    ) ?? null
  );
}

async function promptDoublingDownNarration(): Promise<string | null> {
  const result =
    await foundry.applications.api.DialogV2.wait<DoublingDownNarrationSelection | null>(
      {
        buttons: [
          {
            action: "cancel",
            callback: () => null,
            label: game.i18n.localize("D6E2.Cancel"),
          },
          {
            action: "retry",
            callback: (_event, button) => {
              const narration = button.form?.elements.namedItem("narration");
              return {
                narration:
                  narration instanceof HTMLTextAreaElement
                    ? narration.value.trim()
                    : "",
              };
            },
            default: true,
            icon: "fa-solid fa-arrows-rotate",
            label: game.i18n.localize("D6E2.Roll.DoublingDown.Confirm"),
          },
        ],
        classes: ["d6e2", "od6roll-dialog", "d6e2-doubling-down-dialog"],
        content: `<div class="od6-dialog-shell">
        <p>${game.i18n.localize("D6E2.Roll.DoublingDown.Help")}</p>
        <label>
          <span>${game.i18n.localize("D6E2.Roll.DoublingDown.Narration")}</span>
          <textarea name="narration" rows="3" maxlength="500"></textarea>
        </label>
        <small>${game.i18n.localize("D6E2.Roll.DoublingDown.Reference")}</small>
      </div>`,
        modal: true,
        rejectClose: false,
        window: {
          icon: "fa-solid fa-arrows-rotate",
          title: game.i18n.localize("D6E2.Roll.DoublingDown.Action"),
        },
      },
    );
  return doublingDownNarrationResult(result);
}

async function consumeFollowUp(
  message: FoundryChatMessageDocument,
  button: HTMLButtonElement,
  actor: FoundryActorDocument,
  operation: () => Promise<D6RollResultV1 | null>,
): Promise<void> {
  const buttons = Array.from(
    button
      .closest(".od6chat-roll")
      ?.querySelectorAll<HTMLButtonElement>(".od6chat-actions button") ?? [],
  );
  for (const candidate of buttons) {
    candidate.disabled = true;
    candidate.dataset.pending = "true";
  }
  try {
    const claimed = await claimRollFollowUp(message, actor);
    if (!claimed) {
      ui.notifications.warn(
        game.i18n.localize("D6E2.Roll.FollowUp.AlreadyUsed"),
      );
      for (const candidate of buttons) {
        candidate.disabled = false;
        delete candidate.dataset.pending;
      }
      return;
    }
    const followUp = await operation();
    if (followUp) return;
    await releaseRollFollowUp(message, actor);
  } catch (error) {
    await releaseRollFollowUp(message, actor);
    const key = error instanceof Error ? error.message : String(error);
    ui.notifications.warn(game.i18n.localize(key));
  }
  for (const candidate of buttons) {
    candidate.disabled = false;
    delete candidate.dataset.pending;
  }
}

async function handleHeroPointReroll(
  message: FoundryChatMessageDocument,
  button: HTMLButtonElement,
  actor: FoundryActorDocument,
  result: D6RollResultV1,
): Promise<void> {
  if (button.dataset.pending === "true") return;
  button.dataset.pending = "true";
  button.disabled = true;
  await consumeFollowUp(message, button, actor, () =>
    rerollFailedRoll(actor, result),
  );
}

async function handleDoublingDown(
  message: FoundryChatMessageDocument,
  button: HTMLButtonElement,
  actor: FoundryActorDocument,
  result: D6RollResultV1,
): Promise<void> {
  if (button.dataset.pending === "true") return;
  button.dataset.pending = "true";
  button.disabled = true;
  const narration = await promptDoublingDownNarration();
  if (narration === null) {
    button.disabled = false;
    delete button.dataset.pending;
    return;
  }
  await consumeFollowUp(message, button, actor, () =>
    doubleDownFailedRoll(actor, result, narration),
  );
}

export function registerRollChatCardActions(): void {
  if (registered) return;
  Hooks.on("renderChatMessageHTML", (...args: unknown[]) => {
    const message = args[0] as FoundryChatMessageDocument | undefined;
    const html = messageElement(args[1]);
    if (!message || !html) return;
    const result = rollResult(message.getFlag(SYSTEM_ID, "roll"));
    if (
      result &&
      currentSecondEditionCampaignProfile().activeResponsiveCombat &&
      currentDefenseRuntimeStrategy().feint === "second-edition-penalty"
    ) {
      const attack = result.request.context?.weaponAttack;
      if (attack?.attackKind === "melee") {
        let actions = html.querySelector<HTMLElement>(".od6chat-actions");
        if (!actions) {
          const card = html.querySelector<HTMLElement>(".od6chat-roll");
          if (card) {
            actions = document.createElement("div");
            actions.className = "od6chat-actions";
            card.append(actions);
          }
        }
        if (!actions) return;
        const attacker = actingActor(result);
        if (
          result.wildFaces[0] === 6 &&
          attacker?.isOwner === true &&
          !hasD6OrdinaryWildFeintAudit(message)
        ) {
          const feint = document.createElement("button");
          feint.type = "button";
          feint.dataset.action = "wildDieFeint";
          feint.innerHTML = `<i class="fa-solid fa-mask" aria-hidden="true"></i> ${game.i18n.localize("D6E2.Combat.ActiveResponsive.Feint")}`;
          feint.addEventListener(
            "click",
            () =>
              void (async () => {
                await executeD6OrdinaryWildFeint(message);
                feint.disabled = true;
              })(),
          );
          actions.append(feint);
        }
      }
    }
    const buttons = Array.from(
      html.querySelectorAll<HTMLButtonElement>(
        '[data-action="heroPointReroll"], [data-action="doubleDown"]',
      ),
    );
    if (buttons.length === 0) return;
    if (
      message.getFlag(SYSTEM_ID, "rollFollowUpUsed") === true ||
      message.getFlag(SYSTEM_ID, "heroPointRerollUsed") === true
    ) {
      for (const button of buttons) {
        button.disabled = true;
        button.classList.add("is-used");
      }
      return;
    }
    const actor = result ? actingActor(result) : null;
    if (!result || actor?.isOwner !== true) {
      for (const button of buttons) button.disabled = true;
      return;
    }
    for (const button of buttons) {
      if (button.dataset.action === "heroPointReroll") {
        button.addEventListener(
          "click",
          () => void handleHeroPointReroll(message, button, actor, result),
        );
      } else {
        button.addEventListener(
          "click",
          () => void handleDoublingDown(message, button, actor, result),
        );
      }
    }
  });
  registered = true;
}
