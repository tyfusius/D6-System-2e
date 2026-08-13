import { SYSTEM_ID } from "../constants";
import { currentTerminology } from "../registries/terminology";
import { booleanSetting } from "../settings/setting-values";
import { SHARED_SETTING_KEYS } from "../settings/settings-catalog";
import { integer, record, stringValue } from "./sheets/values";

const SOCKET_TIMEOUT_MS = 75_000;
const RECIPIENT_APPROVAL_TIMEOUT_MS = 60_000;
const EQUIPMENT_TYPES = new Set(["armor", "cybernetic", "gear", "weapon"]);

export interface D6EconomyRecipient {
  readonly actorId: string;
  readonly kind: "pc" | "scene-npc";
  readonly label: string;
  readonly sceneId?: string;
  readonly sourceTokenId?: string;
  readonly targetTokenId?: string;
}

interface EconomySpendRequest {
  readonly amount: number;
  readonly note: string;
  readonly sourceActorId: string;
  readonly type: "spend";
}

interface EconomyCurrencyTransferRequest {
  readonly amount: number;
  readonly recipient: D6EconomyRecipient;
  readonly sourceActorId: string;
  readonly type: "currency-transfer";
}

interface EconomyItemTransferRequest {
  readonly itemId: string;
  readonly quantity: number;
  readonly recipient: D6EconomyRecipient;
  readonly sourceActorId: string;
  readonly type: "item-transfer";
}

interface EconomyItemDropRequest {
  readonly itemId: string;
  readonly quantity: number;
  readonly sourceActorId: string;
  readonly type: "item-drop";
}

export type D6EconomyRequest =
  | EconomyCurrencyTransferRequest
  | EconomyItemDropRequest
  | EconomyItemTransferRequest
  | EconomySpendRequest;

interface EconomySocketRequest {
  readonly request: D6EconomyRequest;
  readonly requestId: string;
  readonly requesterUserId: string;
  readonly type: "economy-request";
}

interface EconomySocketResponse {
  readonly error?: string;
  readonly requestId: string;
  readonly requesterUserId: string;
  readonly type: "economy-response";
}

interface EconomyApprovalRequest {
  readonly gmUserId: string;
  readonly request: EconomyCurrencyTransferRequest | EconomyItemTransferRequest;
  readonly requestId: string;
  readonly requesterName: string;
  readonly requesterUserId: string;
  readonly sourceName: string;
  readonly targetUserId: string;
  readonly type: "economy-approval-request";
}

interface EconomyApprovalResponse {
  readonly accepted: boolean;
  readonly requestId: string;
  readonly requesterUserId: string;
  readonly targetUserId: string;
  readonly type: "economy-approval-response";
}

type EconomySocketMessage =
  | EconomyApprovalRequest
  | EconomyApprovalResponse
  | EconomySocketRequest
  | EconomySocketResponse;

const pending = new Map<
  string,
  { readonly reject: (error: Error) => void; readonly resolve: () => void }
>();
const pendingApprovals = new Map<
  string,
  {
    readonly reject: (error: Error) => void;
    readonly requesterUserId: string;
    readonly resolve: (accepted: boolean) => void;
    readonly targetUserId: string;
  }
>();
let transactionQueue: Promise<void> = Promise.resolve();

function localized(key: string): string {
  return game.i18n.localize(key);
}

function nonBlank(value: unknown, fallback: string): string {
  const normalized = stringValue(value).trim();
  return normalized.length > 0 ? normalized : fallback;
}

export function characterCurrencyTransactionsEnabled(): boolean {
  return booleanSetting(
    SHARED_SETTING_KEYS.characterCurrencyTransactions,
    false,
  );
}

export function characterEquipmentTransfersEnabled(): boolean {
  return booleanSetting(SHARED_SETTING_KEYS.characterEquipmentTransfers, false);
}

function anyCharacterTransactionEnabled(): boolean {
  return (
    characterCurrencyTransactionsEnabled() ||
    characterEquipmentTransfersEnabled()
  );
}

export function economyCurrencyLabel(): string {
  return nonBlank(
    currentTerminology().details.currency,
    localized("D6E2.Economy.DefaultCurrency"),
  );
}

export function actorCurrency(actor: FoundryActorDocument): number {
  return Math.max(0, integer(record(record(actor.system).profile).currency));
}

export function canTransferEquipmentItem(item: FoundryItemDocument): boolean {
  return (
    EQUIPMENT_TYPES.has(item.type) &&
    integer(record(item.system).quantity) > 0 &&
    !(item.type === "cybernetic" && record(item.system).installed === true)
  );
}

function actorIdForToken(token: FoundryTokenPlaceable): string | undefined {
  return token.actor?.id;
}

function activeRecipientOwners(
  actor: FoundryActorDocument,
): readonly FoundryUser[] {
  return Object.freeze(
    (game.users?.contents ?? [])
      .filter(
        (user) =>
          user.active &&
          !user.isGM &&
          (user.character?.id === actor.id ||
            actor.testUserPermission(user, "OWNER")),
      )
      .sort((left, right) => {
        const leftAssigned = left.character?.id === actor.id ? 0 : 1;
        const rightAssigned = right.character?.id === actor.id ? 0 : 1;
        if (leftAssigned !== rightAssigned) return leftAssigned - rightAssigned;
        return nonBlank(left.name, left.id).localeCompare(
          nonBlank(right.name, right.id),
        );
      }),
  );
}

export function economyRecipients(
  sender: FoundryActorDocument,
): readonly D6EconomyRecipient[] {
  if (!anyCharacterTransactionEnabled()) return Object.freeze([]);
  const currentUser = game.user;
  if (!currentUser || (!currentUser.isGM && sender.isOwner !== true)) {
    return Object.freeze([]);
  }
  const recipients = new Map<string, D6EconomyRecipient>();
  const playerActors = (game.users?.contents ?? []).flatMap((user) =>
    user.character?.type === "character" ? [user.character] : [],
  );
  for (const actor of playerActors) {
    if (
      actor.id === sender.id ||
      recipients.has(actor.id) ||
      activeRecipientOwners(actor).length === 0
    )
      continue;
    recipients.set(
      actor.id,
      Object.freeze({ actorId: actor.id, kind: "pc", label: actor.name }),
    );
  }

  const sceneId = canvas.scene?.id;
  const tokens = canvas.tokens?.placeables ?? [];
  const sourceToken = tokens.find(
    (token) => actorIdForToken(token) === sender.id && token.visible === true,
  );
  if (!sceneId || !sourceToken) return Object.freeze([...recipients.values()]);
  for (const token of tokens) {
    const actor = token.actor;
    if (
      token.visible !== true ||
      !actor ||
      actor.id === sender.id ||
      !["character", "creature"].includes(actor.type) ||
      recipients.has(actor.id)
    ) {
      continue;
    }
    recipients.set(
      actor.id,
      Object.freeze({
        actorId: actor.id,
        kind: "scene-npc",
        label: nonBlank(token.name, actor.name),
        sceneId,
        sourceTokenId: sourceToken.id,
        targetTokenId: token.id,
      }),
    );
  }
  return Object.freeze(
    [...recipients.values()].sort((left, right) =>
      left.label.localeCompare(right.label),
    ),
  );
}

function recipientValue(recipient: D6EconomyRecipient): string {
  return encodeURIComponent(JSON.stringify(recipient));
}

function parseRecipient(value: string): D6EconomyRecipient | null {
  try {
    const parsed = JSON.parse(
      decodeURIComponent(value),
    ) as Partial<D6EconomyRecipient>;
    if (
      typeof parsed.actorId !== "string" ||
      typeof parsed.label !== "string" ||
      (parsed.kind !== "pc" && parsed.kind !== "scene-npc")
    ) {
      return null;
    }
    return Object.freeze({
      actorId: parsed.actorId,
      kind: parsed.kind,
      label: parsed.label,
      ...(typeof parsed.sceneId === "string"
        ? { sceneId: parsed.sceneId }
        : {}),
      ...(typeof parsed.sourceTokenId === "string"
        ? { sourceTokenId: parsed.sourceTokenId }
        : {}),
      ...(typeof parsed.targetTokenId === "string"
        ? { targetTokenId: parsed.targetTokenId }
        : {}),
    });
  } catch {
    return null;
  }
}

async function economyDialog(options: {
  readonly actor: FoundryActorDocument;
  readonly item?: FoundryItemDocument;
  readonly mode: "currency-transfer" | "item-transfer" | "spend";
  readonly recipients?: readonly D6EconomyRecipient[];
}): Promise<D6EconomyRequest | null> {
  const balance = actorCurrency(options.actor);
  const quantity = options.item
    ? Math.max(1, integer(record(options.item.system).quantity))
    : 1;
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/actor/character/economy-dialog.hbs`,
    {
      balance,
      currencyLabel: economyCurrencyLabel(),
      item: options.item ? { name: options.item.name, quantity } : null,
      maximum: options.item ? quantity : balance,
      mode: options.mode,
      recipients: (options.recipients ?? []).map((recipient) => ({
        ...recipient,
        encoded: recipientValue(recipient),
      })),
      showRecipient:
        options.mode !== "spend" && (options.recipients?.length ?? 0) > 0,
    },
  );
  const itemDropButton =
    options.mode === "item-transfer"
      ? [
          {
            action: "item-drop",
            callback: (_event: Event, button: FoundryDialogButton) => {
              const amount = Number(
                (
                  button.form?.elements.namedItem(
                    "amount",
                  ) as HTMLInputElement | null
                )?.value,
              );
              if (!Number.isSafeInteger(amount) || amount < 1) return null;
              return {
                itemId: options.item?.id ?? "",
                quantity: amount,
                sourceActorId: options.actor.id,
                type: "item-drop",
              } satisfies EconomyItemDropRequest;
            },
            class: "is-danger",
            icon: "fa-solid fa-trash",
            label: localized("D6E2.Economy.DropItem"),
          },
        ]
      : [];
  const primaryButton =
    options.mode !== "item-transfer" || (options.recipients?.length ?? 0) > 0
      ? [
          {
            action: options.mode,
            callback: (_event: Event, button: FoundryDialogButton) => {
              const amount = Number(
                (
                  button.form?.elements.namedItem(
                    "amount",
                  ) as HTMLInputElement | null
                )?.value,
              );
              if (!Number.isSafeInteger(amount) || amount < 1) return null;
              if (options.mode === "spend") {
                const note = stringValue(
                  (
                    button.form?.elements.namedItem(
                      "note",
                    ) as HTMLInputElement | null
                  )?.value,
                ).trim();
                return {
                  amount,
                  note,
                  sourceActorId: options.actor.id,
                  type: "spend",
                } satisfies EconomySpendRequest;
              }
              const encoded = (
                button.form?.elements.namedItem(
                  "recipient",
                ) as HTMLSelectElement | null
              )?.value;
              const recipient = encoded ? parseRecipient(encoded) : null;
              if (!recipient) return null;
              return options.mode === "currency-transfer"
                ? ({
                    amount,
                    recipient,
                    sourceActorId: options.actor.id,
                    type: "currency-transfer",
                  } satisfies EconomyCurrencyTransferRequest)
                : ({
                    itemId: options.item?.id ?? "",
                    quantity: amount,
                    recipient,
                    sourceActorId: options.actor.id,
                    type: "item-transfer",
                  } satisfies EconomyItemTransferRequest);
            },
            class: "od6roll-submit",
            default: true,
            icon:
              options.mode === "spend"
                ? "fa-solid fa-coins"
                : "fa-solid fa-arrow-right-arrow-left",
            label: localized(
              options.mode === "spend"
                ? "D6E2.Economy.Spend"
                : options.mode === "currency-transfer"
                  ? "D6E2.Economy.TransferCurrency"
                  : "D6E2.Economy.TransferItem",
            ),
          },
        ]
      : [];
  const result =
    await foundry.applications.api.DialogV2.wait<D6EconomyRequest | null>({
      buttons: [
        {
          action: "cancel",
          callback: () => null,
          label: localized("D6E2.Cancel"),
        },
        ...itemDropButton,
        ...primaryButton,
      ],
      classes: ["d6e2", "od6roll-dialog", "d6e2-economy-dialog"],
      content,
      modal: true,
      position: { width: 520 },
      rejectClose: false,
      window: {
        icon:
          options.mode === "spend"
            ? "fa-solid fa-coins"
            : "fa-solid fa-arrow-right-arrow-left",
        title: localized(
          options.mode === "spend"
            ? "D6E2.Economy.SpendTitle"
            : options.mode === "currency-transfer"
              ? "D6E2.Economy.TransferCurrencyTitle"
              : "D6E2.Economy.TransferItemTitle",
        ),
      },
    });
  return result ?? null;
}

async function recipientApprovalDialog(
  message: EconomyApprovalRequest,
  source: FoundryActorDocument,
  target: FoundryActorDocument,
): Promise<boolean> {
  const item =
    message.request.type === "item-transfer"
      ? source.items.get(message.request.itemId)
      : undefined;
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/actor/character/economy-approval-dialog.hbs`,
    {
      amount:
        message.request.type === "currency-transfer"
          ? message.request.amount
          : message.request.quantity,
      currencyLabel: economyCurrencyLabel(),
      itemName: item?.name,
      requesterName: message.requesterName,
      sourceName: message.sourceName,
      targetName: target.name,
      type: message.request.type,
    },
  );
  const result = await foundry.applications.api.DialogV2.wait<boolean>({
    buttons: [
      {
        action: "decline",
        callback: () => false,
        class: "is-danger",
        icon: "fa-solid fa-xmark",
        label: localized("D6E2.Economy.DeclineTransfer"),
      },
      {
        action: "accept",
        callback: () => true,
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-check",
        label: localized("D6E2.Economy.AcceptTransfer"),
      },
    ],
    classes: [
      "d6e2",
      "od6roll-dialog",
      "d6e2-economy-dialog",
      "d6e2-economy-approval-dialog",
    ],
    content,
    modal: true,
    position: { width: 520 },
    rejectClose: false,
    window: {
      icon: "fa-solid fa-hand-holding-hand",
      title: localized("D6E2.Economy.ApprovalTitle"),
    },
  });
  return result === true;
}

function electedGm(): FoundryUser | undefined {
  return (game.users?.contents ?? [])
    .filter((user) => user.active && user.isGM)
    .sort((left, right) => left.id.localeCompare(right.id))[0];
}

async function validateSceneRecipient(
  sender: FoundryActorDocument,
  target: FoundryActorDocument,
  recipient: D6EconomyRecipient,
): Promise<void> {
  if (
    !recipient.sceneId ||
    !recipient.sourceTokenId ||
    !recipient.targetTokenId
  ) {
    throw new Error("D6E2.Economy.Error.InvalidRecipient");
  }
  const [sourceToken, targetToken] = (await Promise.all([
    fromUuid(`Scene.${recipient.sceneId}.Token.${recipient.sourceTokenId}`),
    fromUuid(`Scene.${recipient.sceneId}.Token.${recipient.targetTokenId}`),
  ])) as readonly [
    { readonly actor?: FoundryActorDocument; readonly hidden?: boolean } | null,
    { readonly actor?: FoundryActorDocument; readonly hidden?: boolean } | null,
  ];
  if (
    sourceToken?.actor?.id !== sender.id ||
    targetToken?.actor?.id !== target.id ||
    targetToken.hidden === true
  ) {
    throw new Error("D6E2.Economy.Error.InvalidRecipient");
  }
}

async function validateRecipient(
  sender: FoundryActorDocument,
  recipient: D6EconomyRecipient,
  requester: FoundryUser,
): Promise<FoundryActorDocument> {
  const target = game.actors?.get(recipient.actorId);
  if (
    !target ||
    target.id === sender.id ||
    !["character", "creature"].includes(target.type)
  ) {
    throw new Error("D6E2.Economy.Error.InvalidRecipient");
  }
  if (recipient.kind === "scene-npc") {
    await validateSceneRecipient(sender, target, recipient);
    return target;
  }
  const isPlayerCharacter = (game.users?.contents ?? []).some(
    (user) => user.character?.id === target.id,
  );
  if (!requester.isGM && !isPlayerCharacter) {
    throw new Error("D6E2.Economy.Error.InvalidRecipient");
  }
  return target;
}

async function validateTransferProposal(
  request: EconomyCurrencyTransferRequest | EconomyItemTransferRequest,
  requester: FoundryUser,
): Promise<{
  readonly item?: FoundryItemDocument;
  readonly source: FoundryActorDocument;
  readonly target: FoundryActorDocument;
}> {
  if (
    request.type === "item-transfer"
      ? !characterEquipmentTransfersEnabled()
      : !characterCurrencyTransactionsEnabled()
  ) {
    throw new Error(
      request.type === "item-transfer"
        ? "D6E2.Economy.Error.EquipmentDisabled"
        : "D6E2.Economy.Error.CurrencyDisabled",
    );
  }
  const source = game.actors?.get(request.sourceActorId);
  if (
    source?.type !== "character" ||
    (!requester.isGM && !source.testUserPermission(requester, "OWNER"))
  ) {
    throw new Error("D6E2.Economy.Error.NotAuthorized");
  }
  const target = await validateRecipient(source, request.recipient, requester);
  if (request.type === "currency-transfer") {
    if (!Number.isSafeInteger(request.amount) || request.amount < 1)
      throw new Error("D6E2.Economy.Error.InvalidAmount");
    if (request.amount > actorCurrency(source))
      throw new Error("D6E2.Economy.Error.InsufficientFunds");
    return { source, target };
  }
  const item = source.items.get(request.itemId);
  if (
    !item ||
    !canTransferEquipmentItem(item) ||
    !Number.isSafeInteger(request.quantity) ||
    request.quantity < 1
  ) {
    throw new Error("D6E2.Economy.Error.InvalidItem");
  }
  if (request.quantity > Math.max(0, integer(record(item.system).quantity))) {
    throw new Error("D6E2.Economy.Error.InsufficientQuantity");
  }
  return { item, source, target };
}

function transferRequest(
  request: D6EconomyRequest,
): request is EconomyCurrencyTransferRequest | EconomyItemTransferRequest {
  return (
    request.type === "currency-transfer" || request.type === "item-transfer"
  );
}

function economyAuditRecipients(
  requester: FoundryUser,
  target?: FoundryActorDocument,
): readonly string[] {
  const recipients = new Set<string>([requester.id]);
  for (const user of game.users?.contents ?? []) {
    if (!user.isGM && target?.testUserPermission(user, "OWNER") === true) {
      recipients.add(user.id);
    }
  }
  for (const user of game.users?.contents ?? []) {
    if (user.isGM) recipients.add(user.id);
  }
  // Foundry normalizes the whisper collection in place while creating the
  // message, so this adapter must hand it a fresh mutable array.
  return [...recipients];
}

async function createTransactionReceipt(
  request: D6EconomyRequest,
  requester: FoundryUser,
  source: FoundryActorDocument,
  target?: FoundryActorDocument,
  item?: FoundryItemDocument,
): Promise<void> {
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/chat/economy-audit.hbs`,
    {
      amount: "amount" in request ? request.amount : request.quantity,
      currencyLabel: economyCurrencyLabel(),
      itemName: item?.name,
      note: request.type === "spend" ? request.note : "",
      requesterName: nonBlank(
        requester.name,
        localized("D6E2.Economy.UnknownUser"),
      ),
      sourceName: source.name,
      targetName: target?.name,
      type: request.type,
    },
  );
  await ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker({ actor: source }),
    whisper: economyAuditRecipients(requester, target),
  });
}

async function executeRequest(
  request: D6EconomyRequest,
  requester: FoundryUser,
): Promise<void> {
  if (
    request.type === "item-transfer" || request.type === "item-drop"
      ? !characterEquipmentTransfersEnabled()
      : !characterCurrencyTransactionsEnabled()
  ) {
    throw new Error(
      request.type === "item-transfer" || request.type === "item-drop"
        ? "D6E2.Economy.Error.EquipmentDisabled"
        : "D6E2.Economy.Error.CurrencyDisabled",
    );
  }
  const source = game.actors?.get(request.sourceActorId);
  if (
    source?.type !== "character" ||
    (!requester.isGM && !source.testUserPermission(requester, "OWNER"))
  ) {
    throw new Error("D6E2.Economy.Error.NotAuthorized");
  }
  if (
    "amount" in request &&
    (!Number.isSafeInteger(request.amount) || request.amount < 1)
  ) {
    throw new Error("D6E2.Economy.Error.InvalidAmount");
  }
  if (request.type === "spend") {
    const before = actorCurrency(source);
    if (request.amount > before)
      throw new Error("D6E2.Economy.Error.InsufficientFunds");
    await source.update({ "system.profile.currency": before - request.amount });
    await createTransactionReceipt(request, requester, source);
    return;
  }

  if (request.type === "currency-transfer") {
    const target = await validateRecipient(
      source,
      request.recipient,
      requester,
    );
    const sourceBefore = actorCurrency(source);
    const targetBefore = actorCurrency(target);
    if (request.amount > sourceBefore)
      throw new Error("D6E2.Economy.Error.InsufficientFunds");
    await source.update({
      "system.profile.currency": sourceBefore - request.amount,
    });
    try {
      await target.update({
        "system.profile.currency": targetBefore + request.amount,
      });
    } catch (error) {
      await source.update({ "system.profile.currency": sourceBefore });
      throw error;
    }
    await createTransactionReceipt(request, requester, source, target);
    return;
  }

  const item = source.items.get(request.itemId);
  if (
    !item ||
    !canTransferEquipmentItem(item) ||
    !Number.isSafeInteger(request.quantity) ||
    request.quantity < 1
  ) {
    throw new Error("D6E2.Economy.Error.InvalidItem");
  }
  const available = Math.max(0, integer(record(item.system).quantity));
  if (request.quantity > available) {
    throw new Error("D6E2.Economy.Error.InsufficientQuantity");
  }
  if (request.type === "item-drop") {
    if (request.quantity === available) {
      await source.deleteEmbeddedDocuments("Item", [item.id]);
    } else {
      await item.update({ "system.quantity": available - request.quantity });
    }
    await createTransactionReceipt(request, requester, source, undefined, item);
    return;
  }

  const target = await validateRecipient(source, request.recipient, requester);
  const rawSource = structuredClone(item.toObject()) as unknown as Record<
    string,
    unknown
  >;
  Reflect.deleteProperty(rawSource, "_id");
  const transferredSystem = record(rawSource.system);
  transferredSystem.quantity = request.quantity;
  transferredSystem.equipped = false;
  rawSource.system = transferredSystem;
  const created = await target.createEmbeddedDocuments("Item", [rawSource]);
  try {
    if (request.quantity === available) {
      await source.deleteEmbeddedDocuments("Item", [item.id]);
    } else {
      await item.update({ "system.quantity": available - request.quantity });
    }
  } catch (error) {
    await target.deleteEmbeddedDocuments(
      "Item",
      created.map((createdItem) => createdItem.id),
    );
    throw error;
  }
  await createTransactionReceipt(request, requester, source, target, item);
}

async function requestRecipientApproval(
  request: EconomyCurrencyTransferRequest | EconomyItemTransferRequest,
  requester: FoundryUser,
  requestId: string,
): Promise<void> {
  const gm = electedGm();
  if (!gm || game.user?.id !== gm.id)
    throw new Error("D6E2.Economy.Error.GmUnavailable");
  const { source, target } = await validateTransferProposal(request, requester);
  if (request.recipient.kind !== "pc") return;
  const controller = activeRecipientOwners(target)[0];
  if (!controller) throw new Error("D6E2.Economy.Error.RecipientUnavailable");
  const accepted = await new Promise<boolean>((resolve, reject) => {
    pendingApprovals.set(requestId, {
      reject,
      requesterUserId: requester.id,
      resolve,
      targetUserId: controller.id,
    });
    window.setTimeout(() => {
      if (!pendingApprovals.delete(requestId)) return;
      reject(new Error("D6E2.Economy.Error.ApprovalTimeout"));
    }, RECIPIENT_APPROVAL_TIMEOUT_MS);
    game.socket?.emit(`system.${SYSTEM_ID}`, {
      gmUserId: gm.id,
      request,
      requestId,
      requesterName: nonBlank(
        requester.name,
        localized("D6E2.Economy.UnknownUser"),
      ),
      requesterUserId: requester.id,
      sourceName: source.name,
      targetUserId: controller.id,
      type: "economy-approval-request",
    } satisfies EconomyApprovalRequest);
  });
  if (!accepted) throw new Error("D6E2.Economy.Error.RecipientDeclined");
}

async function approveAndExecute(
  request: D6EconomyRequest,
  requester: FoundryUser,
  requestId: string,
): Promise<void> {
  if (transferRequest(request)) {
    await requestRecipientApproval(request, requester, requestId);
  }
  await enqueue(request, requester);
}

function enqueue(
  request: D6EconomyRequest,
  requester: FoundryUser,
): Promise<void> {
  const operation = transactionQueue.then(() =>
    executeRequest(request, requester),
  );
  transactionQueue = operation.catch(() => undefined);
  return operation;
}

export async function submitEconomyRequest(
  request: D6EconomyRequest,
): Promise<void> {
  const requester = game.user;
  if (!requester) throw new Error("D6E2.Economy.Error.UserRequired");
  if (requester.isGM)
    return approveAndExecute(request, requester, crypto.randomUUID());
  const gm = electedGm();
  if (!gm) throw new Error("D6E2.Economy.Error.GmUnavailable");
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    pending.set(requestId, { reject, resolve });
    window.setTimeout(() => {
      if (!pending.delete(requestId)) return;
      reject(new Error("D6E2.Economy.Error.GmTimeout"));
    }, SOCKET_TIMEOUT_MS);
    game.socket?.emit(`system.${SYSTEM_ID}`, {
      request,
      requestId,
      requesterUserId: requester.id,
      type: "economy-request",
    } satisfies EconomySocketMessage);
  });
}

export async function spendCharacterCurrency(
  actor: FoundryActorDocument,
): Promise<boolean> {
  if (!characterCurrencyTransactionsEnabled())
    throw new Error("D6E2.Economy.Error.CurrencyDisabled");
  const request = await economyDialog({
    actor,
    mode: "spend",
  });
  if (!request) return false;
  await submitEconomyRequest(request);
  return true;
}

export async function transferCharacterCurrency(
  actor: FoundryActorDocument,
): Promise<boolean> {
  if (!characterCurrencyTransactionsEnabled())
    throw new Error("D6E2.Economy.Error.CurrencyDisabled");
  const recipients = economyRecipients(actor);
  if (recipients.length === 0)
    throw new Error("D6E2.Economy.Error.NoRecipients");
  const request = await economyDialog({
    actor,
    mode: "currency-transfer",
    recipients,
  });
  if (!request) return false;
  await submitEconomyRequest(request);
  return true;
}

export async function transferCharacterEquipment(
  actor: FoundryActorDocument,
  item: FoundryItemDocument,
): Promise<boolean> {
  if (!characterEquipmentTransfersEnabled())
    throw new Error("D6E2.Economy.Error.EquipmentDisabled");
  if (!canTransferEquipmentItem(item))
    throw new Error("D6E2.Economy.Error.InvalidItem");
  const recipients = economyRecipients(actor);
  const request = await economyDialog({
    actor,
    item,
    mode: "item-transfer",
    recipients,
  });
  if (!request) return false;
  await submitEconomyRequest(request);
  return true;
}

async function receive(value: unknown): Promise<void> {
  if (!value || typeof value !== "object" || !("type" in value)) return;
  const message = value as EconomySocketMessage;
  if (message.type === "economy-response") {
    if (message.requesterUserId !== game.user?.id) return;
    const resolver = pending.get(message.requestId);
    if (!resolver) return;
    pending.delete(message.requestId);
    if (message.error) resolver.reject(new Error(message.error));
    else resolver.resolve();
    return;
  }
  if (message.type === "economy-approval-request") {
    const currentUser = game.user;
    const gm = electedGm();
    if (
      !currentUser ||
      currentUser.isGM ||
      currentUser.id !== message.targetUserId ||
      gm?.id !== message.gmUserId
    )
      return;
    const source = game.actors?.get(message.request.sourceActorId);
    const target = game.actors?.get(message.request.recipient.actorId);
    if (!source || !target?.testUserPermission(currentUser, "OWNER")) return;
    const accepted = await recipientApprovalDialog(message, source, target);
    game.socket?.emit(`system.${SYSTEM_ID}`, {
      accepted,
      requestId: message.requestId,
      requesterUserId: message.requesterUserId,
      targetUserId: currentUser.id,
      type: "economy-approval-response",
    } satisfies EconomyApprovalResponse);
    return;
  }
  if (message.type === "economy-approval-response") {
    if (!game.user?.isGM || electedGm()?.id !== game.user.id) return;
    const resolver = pendingApprovals.get(message.requestId);
    if (
      resolver?.requesterUserId !== message.requesterUserId ||
      resolver.targetUserId !== message.targetUserId
    )
      return;
    pendingApprovals.delete(message.requestId);
    resolver.resolve(message.accepted);
    return;
  }
  if (!game.user?.isGM || electedGm()?.id !== game.user.id) return;
  const requester = game.users?.get(message.requesterUserId);
  let error: string | undefined;
  try {
    if (!requester?.active) throw new Error("D6E2.Economy.Error.NotAuthorized");
    await approveAndExecute(message.request, requester, message.requestId);
  } catch (caught) {
    error =
      caught instanceof Error
        ? caught.message
        : "D6E2.Economy.Error.TransactionFailed";
  }
  game.socket?.emit(`system.${SYSTEM_ID}`, {
    ...(error ? { error } : {}),
    requestId: message.requestId,
    requesterUserId: message.requesterUserId,
    type: "economy-response",
  } satisfies EconomySocketMessage);
}

export function registerEconomySocket(): void {
  game.socket?.on(
    `system.${SYSTEM_ID}`,
    (value: unknown) => void receive(value),
  );
}

export const __testing = Object.freeze({
  activeRecipientOwners,
  economyAuditRecipients,
  executeRequest,
  parseRecipient,
  receive,
  recipientValue,
  resetQueue(): void {
    pending.clear();
    pendingApprovals.clear();
    transactionQueue = Promise.resolve();
  },
});
