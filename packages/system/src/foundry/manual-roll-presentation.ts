import { SYSTEM_ID } from "../constants";

export const MANUAL_ROLL_CLASS = "od6-manual-roll";
export const MANUAL_ROLL_ICON_CLASS = "od6-manual-roll-icon";

function messageElement(value: unknown): HTMLElement | null {
  if (value instanceof HTMLElement) return value;
  if (Array.isArray(value) && value[0] instanceof HTMLElement) return value[0];
  return null;
}

function messageContent(element: HTMLElement): HTMLElement | null {
  if (element.matches(".message-content")) return element;
  return element.querySelector<HTMLElement>(":scope > .message-content");
}

function directNativeRolls(content: HTMLElement): HTMLElement[] {
  const hasNarration = Array.from(content.childNodes).some(
    (node) => node.nodeType === 3 && Boolean(node.textContent?.trim()),
  );
  const children = Array.from(content.children);
  if (
    hasNarration ||
    children.length === 0 ||
    children.some(
      (child) =>
        !(child instanceof HTMLElement) ||
        !child.matches('.dice-roll[data-action="expandRoll"]'),
    )
  )
    return [];
  const rolls = children as HTMLElement[];
  return rolls.every((roll) => {
    const result = roll.querySelector<HTMLElement>(":scope > .dice-result");
    return (
      !!result &&
      !!result.querySelector<HTMLElement>(":scope > .dice-formula") &&
      !!result.querySelector<HTMLElement>(":scope > .dice-total")
    );
  })
    ? rolls
    : [];
}

function addManualRollIcon(roll: HTMLElement): void {
  roll.classList.add(MANUAL_ROLL_CLASS);
  const formula = roll.querySelector<HTMLElement>(
    ":scope > .dice-result > .dice-formula",
  );
  if (!formula || formula.querySelector(`:scope > .${MANUAL_ROLL_ICON_CLASS}`))
    return;
  const label = game.i18n.localize("D6E2.Roll.Manual");
  const icon = formula.ownerDocument.createElement("span");
  icon.className = MANUAL_ROLL_ICON_CLASS;
  icon.setAttribute("role", "img");
  icon.setAttribute("aria-label", label);
  icon.setAttribute("title", label);
  const glyph = formula.ownerDocument.createElement("i");
  glyph.className = "fa-solid fa-hand";
  glyph.setAttribute("aria-hidden", "true");
  icon.append(glyph);
  formula.prepend(icon);
}

/** Decorate only a pure native roll message. D6 structured cards and messages
 * with narration or module-owned wrappers keep their existing presentation. */
export function decorateManualRollMessage(
  message: FoundryChatMessageDocument,
  html: unknown,
): number {
  if (message.getFlag(SYSTEM_ID, "roll") !== undefined) return 0;
  const element = messageElement(html);
  const content = element ? messageContent(element) : null;
  if (!content) return 0;
  const rolls = directNativeRolls(content);
  for (const roll of rolls) addManualRollIcon(roll);
  return rolls.length;
}

let registered = false;
export function registerManualRollPresentation(): void {
  if (registered) return;
  registered = true;
  Hooks.on("renderChatMessageHTML", (message: unknown, html: unknown) => {
    decorateManualRollMessage(message as FoundryChatMessageDocument, html);
  });
}

export function resetManualRollPresentationForTests(): void {
  registered = false;
}
