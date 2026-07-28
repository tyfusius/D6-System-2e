import {
  D6_ROLL_CONTRACT_VERSION,
  type D6RollResultV1,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../../constants";
import { doubleDownFailedRoll, rerollFailedRoll } from "./roll-service";
import { claimRollFollowUp, releaseRollFollowUp } from "./roll-authority";

let registered = false;

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

function actingActor(result: D6RollResultV1): FoundryActorDocument | null {
  return (
    game.actors?.contents.find(
      (candidate) => candidate.id === result.request.source.actorId,
    ) ?? null
  );
}

async function promptDoublingDownNarration(): Promise<string | null> {
  const result = await foundry.applications.api.DialogV2.wait<string | null>({
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
          return narration instanceof HTMLTextAreaElement
            ? narration.value.trim()
            : "";
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
  });
  return result ?? null;
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
    const result = rollResult(message.getFlag(SYSTEM_ID, "roll"));
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
