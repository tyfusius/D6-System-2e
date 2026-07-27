import {
  D6_ROLL_CONTRACT_VERSION,
  type D6RollResultV1,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../../constants";
import { rerollFailedRoll } from "./roll-service";

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

async function handleReroll(
  message: FoundryChatMessageDocument,
  button: HTMLButtonElement,
  result: D6RollResultV1,
): Promise<void> {
  const actor = game.actors?.contents.find(
    (candidate) => candidate.id === result.request.source.actorId,
  );
  if (actor?.isOwner !== true) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Roll.HeroPoint.OwnerRequired"),
    );
    return;
  }
  button.disabled = true;
  button.dataset.pending = "true";
  try {
    await message.update({
      [`flags.${SYSTEM_ID}.heroPointRerollUsed`]: true,
    });
    const rerolled = await rerollFailedRoll(actor, result);
    if (!rerolled) {
      await message.update({
        [`flags.${SYSTEM_ID}.heroPointRerollUsed`]: false,
      });
      button.disabled = false;
      delete button.dataset.pending;
    }
  } catch (error) {
    await message.update({
      [`flags.${SYSTEM_ID}.heroPointRerollUsed`]: false,
    });
    button.disabled = false;
    delete button.dataset.pending;
    const key = error instanceof Error ? error.message : String(error);
    ui.notifications.warn(game.i18n.localize(key));
  }
}

export function registerRollChatCardActions(): void {
  if (registered) return;
  Hooks.on("renderChatMessageHTML", (...args: unknown[]) => {
    const message = args[0] as FoundryChatMessageDocument | undefined;
    const html = messageElement(args[1]);
    if (!message || !html) return;
    const button = html.querySelector<HTMLButtonElement>(
      '[data-action="heroPointReroll"]',
    );
    if (!button) return;
    if (message.getFlag(SYSTEM_ID, "heroPointRerollUsed") === true) {
      button.disabled = true;
      button.classList.add("is-used");
      return;
    }
    const result = rollResult(message.getFlag(SYSTEM_ID, "roll"));
    if (!result) {
      button.disabled = true;
      return;
    }
    button.addEventListener(
      "click",
      () => void handleReroll(message, button, result),
      { once: true },
    );
  });
  registered = true;
}
