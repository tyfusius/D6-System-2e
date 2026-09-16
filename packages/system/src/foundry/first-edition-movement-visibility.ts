import { parseFirstEditionBodyPointRoot } from "../application/first-edition-body-point-root";
import { parseFirstEditionRelativeMovement } from "../application/first-edition-relative-movement";
import { parseFirstEditionWoundRoot } from "../application/first-edition-wound-root";
import { parseMedicalConsumableRoot } from "../application/medical-consumable-root";
import { SYSTEM_ID } from "../constants";
import { destinyNativeAuthor } from "./destiny-crypto";

/** Native whispers exempt their author from content filtering. A protected
 * GM-authored Movement root can instead carry its initiating owner's Self Roll.
 * Narrow that author's presentation to the stored recipients, without changing
 * author identity, permissions, authority, or native visibility of other rolls. */
export function excludesMovementSelfRollViewer(
  message: FoundryChatMessageDocument,
  userId = game.user?.id,
): boolean {
  if (!userId || !message.whisper?.length || message.whisper.includes(userId))
    return false;
  const movement = parseFirstEditionRelativeMovement(
    message.getFlag(SYSTEM_ID, "firstEditionRelativeMovement"),
  );
  const wound = parseFirstEditionWoundRoot(
    message.getFlag(SYSTEM_ID, "firstEditionWoundRoot"),
  );
  const bodyPoint = parseFirstEditionBodyPointRoot(
    message.getFlag(SYSTEM_ID, "firstEditionBodyPointRoot"),
  );
  const medical = parseMedicalConsumableRoot(
    message.getFlag(SYSTEM_ID, "medicalConsumableRoot"),
  );
  const root = movement ?? wound ?? bodyPoint ?? medical;
  if (root?.action.rootMessageId !== message.id) return false;
  const authorId = destinyNativeAuthor(message);
  if (
    !game.users?.get(authorId)?.isGM ||
    (movement && root.action.coordinatorUserId !== authorId)
  )
    return false;
  if (
    wound &&
    message.getFlag(SYSTEM_ID, "woundRootRollMode") === "selfroll" &&
    wound.initiatorUserId !== authorId
  )
    return true;
  if (
    bodyPoint &&
    message.getFlag(SYSTEM_ID, "bodyPointRootRollMode") === "selfroll" &&
    bodyPoint.initiatorUserId !== authorId
  )
    return true;
  if (medical?.rollMode === "selfroll" && medical.initiatorUserId !== authorId)
    return true;
  return root.action.stages.some(
    (stage) =>
      stage.spec.controllerUserId !== authorId &&
      ((stage.claim?.kind === "d6-roll" &&
        stage.claim.request.rollMode === "selfroll") ||
        (stage.receipt?.kind === "d6-roll" &&
          stage.receipt.result.request.rollMode === "selfroll")),
  );
}
interface NativeChatMessage extends FoundryChatMessageDocument {
  readonly isContentVisible: boolean;
}
const wrappedClasses = new WeakSet<object>();
const hooked = new WeakSet<object>();

/** Called during system init, before restored ChatMessage construction/render. */
export function registerMovementMessageVisibility(): void {
  const config = CONFIG as typeof CONFIG & {
    ChatMessage?: { documentClass: FoundryConstructor<NativeChatMessage> };
  };
  const Base = config.ChatMessage?.documentClass;
  if (!Base || !config.ChatMessage) return;
  if (!wrappedClasses.has(Base)) {
    class MovementChatMessage extends Base {
      override get isContentVisible(): boolean {
        return !excludesMovementSelfRollViewer(this) && super.isContentVisible;
      }
    }
    config.ChatMessage.documentClass = MovementChatMessage;
    wrappedClasses.add(MovementChatMessage);
  }
  if (hooked.has(Hooks)) return;
  hooked.add(Hooks);
  // Use DSN's supported pre-process hook, including when ghost dice are enabled.
  // A non-recipient must not regain a Self Roll animation through DSN settings.
  Hooks.on("diceSoNiceMessagePreProcess", (id: unknown, context: unknown) => {
    if (typeof id !== "string" || !context || typeof context !== "object")
      return;
    const message = game.messages?.get(id);
    if (message && excludesMovementSelfRollViewer(message))
      (context as { willTrigger3DRoll: boolean }).willTrigger3DRoll = false;
  });
}
