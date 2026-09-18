import { documentUpdateTouches } from "./document-update-paths";
import { SYSTEM_ID } from "../constants";
import {
  currentTerminology,
  terminologyActorLabel,
  terminologyItemDocumentLabel,
  type TerminologyActorType,
} from "../registries/terminology";
import { booleanSetting } from "../settings/setting-values";
import { SHARED_SETTING_KEYS } from "../settings/settings-catalog";
import { foundryRandomId } from "./foundry-random-id";
import { registerFoundryPendingInteraction } from "./pending-interactions";
import {
  registerD6PendingInteraction,
  resetD6PendingInteractionsForTests,
  resolveD6PendingInteraction,
} from "../application/pending-interactions";
import { integer, record, stringValue } from "./sheets/values";
import { assertGridStorageLegacyMutationAllowed } from "./grid-storage-legacy-guard";
import {
  currencyInteger,
  currencyWalletFingerprint,
  planCurrencyExchange,
  type D6CurrencyDefinitionV1,
  type D6CurrencyExchangePreviewV1,
  type D6CurrencyExchangeRequestV1,
  type D6CurrencyHolderRefV1,
  type D6CurrencyHolderTransferRequestV1,
  type D6CurrencyOperationReceiptV1,
} from "@d6-system-2e/core";
import {
  actorCurrencyWalletState,
  currencyWalletChanges,
  walletWithOperation,
  walletWithUpdatedOperation,
} from "./currency-state";
import {
  activeCurrencyHolderControllers,
  executeCurrencyHolderTransfer,
  resolveCurrencyHolder,
  resetCurrencyHolderServiceForTests,
  synchronizePendingCurrencyHolderTransfers,
  userMayControlCurrencyHolder,
} from "./currency-holder-service";

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
  readonly amount: number | string;
  readonly definitionFingerprint?: string;
  readonly denominationId?: string;
  readonly expectedTotalSmallestUnit?: string;
  readonly note: string;
  readonly sourceActorId: string;
  readonly type: "spend";
}

interface EconomyCurrencyTransferRequest {
  readonly amount: number | string;
  readonly definitionFingerprint?: string;
  readonly denominationId?: string;
  readonly expectedTotalSmallestUnit?: string;
  readonly recipient: D6EconomyRecipient;
  readonly sourceActorId: string;
  readonly type: "currency-transfer";
}

interface EconomyCurrencyExchangeRequest extends Omit<
  D6CurrencyExchangeRequestV1,
  "requestId"
> {
  readonly sourceActorId: string;
  readonly type: "currency-exchange";
}

export interface EconomyCurrencyHolderTransferRequest {
  readonly holderTransfer: D6CurrencyHolderTransferRequestV1;
  readonly sourceActorId: string;
  readonly targetActorId: string;
  readonly type: "currency-holder-transfer";
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
  | EconomyCurrencyExchangeRequest
  | EconomyCurrencyHolderTransferRequest
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
  readonly amount: string | number;
  readonly approvalType:
    "currency-holder-transfer" | "currency-transfer" | "item-transfer";
  readonly assetLabel: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly gmUserId: string;
  readonly requestId: string;
  readonly requesterName: string;
  readonly requesterUserId: string;
  readonly sourceName: string;
  readonly sourceActorId: string;
  readonly targetActorId: string;
  readonly targetHolder?: D6CurrencyHolderRefV1;
  readonly targetName: string;
  readonly targetUserId: string;
  readonly type: "economy-approval-request";
  readonly version: number;
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
const registeredTransferRecoveries = new Set<string>();
let transferRecoveryHooksRegistered = false;

type ExchangeApproval = "auto" | "manual" | "requester-gm";

function localized(key: string): string {
  return game.i18n.localize(key);
}

function nonBlank(value: unknown, fallback: string): string {
  const normalized = stringValue(value).trim();
  return normalized.length > 0 ? normalized : fallback;
}

function economyRequestId(): string {
  return foundryRandomId();
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

export function currencyExchangeAutoApprovalEnabled(): boolean {
  return booleanSetting(
    SHARED_SETTING_KEYS.currencyExchangeAutoApproval,
    false,
  );
}

function denominationLabel(
  denomination: ReturnType<
    typeof actorCurrencyWalletState
  >["currentDefinition"]["denominations"][number],
  definition?: D6CurrencyDefinitionV1,
): string {
  if (
    definition?.id === "default-currency" &&
    definition.denominations.length === 1 &&
    denomination.id === "currency"
  )
    return economyCurrencyLabel();
  return denomination.symbol
    ? `${denomination.symbol} ${denomination.pluralName}`
    : denomination.pluralName;
}

function constrainDialogToViewport(
  dialog: { setPosition(position?: Record<string, unknown>): unknown },
  root: HTMLElement,
): void {
  const bounds = root.getBoundingClientRect();
  if (bounds.height <= 0) return;
  const viewportHeight =
    root.ownerDocument.documentElement.clientHeight || window.innerHeight;
  const margin = 16;
  const availableHeight = Math.max(0, viewportHeight - margin * 2);
  if (bounds.top >= margin && bounds.bottom <= viewportHeight - margin) return;
  const height = Math.min(bounds.height, availableHeight);
  const top = Math.min(
    Math.max(bounds.top, margin),
    Math.max(margin, viewportHeight - margin - height),
  );
  dialog.setPosition({
    ...(bounds.height > availableHeight ? { height } : {}),
    top,
  });
}

function currencyExchangePreview(
  actor: FoundryActorDocument,
  fromDenominationId: string,
  toDenominationId: string,
  quantity: string,
  requestId = "preview",
): D6CurrencyExchangePreviewV1 {
  const state = actorCurrencyWalletState(actor);
  return planCurrencyExchange(state.currentDefinition, state.wallet, {
    definitionFingerprint: state.wallet.definitionFingerprint,
    definitionRevision: state.wallet.definitionRevision,
    expectedTotalSmallestUnit: state.wallet.totalSmallestUnit,
    expectedWalletFingerprint: currencyWalletFingerprint(state.wallet),
    fromDenominationId,
    quantity,
    requestId,
    toDenominationId,
    version: 1,
  });
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

export function actorCurrency(actor: FoundryActorDocument): number | string {
  const state = actorCurrencyWalletState(actor);
  if (state.unresolvedLegacy && !state.invalidStoredWallet) {
    const legacyDecimal = state.wallet.legacyDecimal?.trim();
    if (legacyDecimal) return legacyDecimal;
  }
  const main = state.wallet.definition.denominations[0];
  if (!main) return 0;
  const count = currencyInteger(state.wallet.counts[main.id] ?? "0");
  return count <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(count)
    : Number.MAX_SAFE_INTEGER;
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

function economyRecipientTypeLabel(recipient: D6EconomyRecipient): string {
  const actor =
    game.actors?.get(recipient.actorId) ??
    canvas.tokens?.placeables.find(
      (token) => token.id === recipient.targetTokenId,
    )?.actor;
  const actorType = actor?.type;
  const type = (
    ["character", "creature", "hideout", "npc", "starship", "vehicle"] as const
  ).find((candidate) => candidate === actorType);
  const resolvedType: TerminologyActorType =
    type ?? (recipient.kind === "pc" ? "character" : "npc");
  return terminologyActorLabel(
    currentTerminology(),
    resolvedType,
    "singular",
    game.i18n.localize(`TYPES.Actor.${resolvedType}`),
  );
}

function economyItemTypeLabel(item: FoundryItemDocument | undefined): string {
  return item
    ? terminologyItemDocumentLabel(
        currentTerminology(),
        item.type,
        "singular",
        game.i18n.localize(`TYPES.Item.${item.type}`),
      )
    : "";
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
  const currencyState =
    options.mode === "item-transfer"
      ? null
      : actorCurrencyWalletState(options.actor);
  const balance = actorCurrency(options.actor);
  const quantity = options.item
    ? Math.max(1, integer(record(options.item.system).quantity))
    : 1;
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/actor/character/economy-dialog.hbs`,
    {
      balance,
      currencyLabel: economyCurrencyLabel(),
      spendHelp: localized(
        currencyState?.wallet.definition.denominations.length === 1
          ? "D6E2.Economy.SpendSingleUnitHelp"
          : "D6E2.Economy.SpendHelp",
      ),
      transferHelp: localized(
        options.mode === "currency-transfer"
          ? "D6E2.Economy.CurrencyTransferHelp"
          : "D6E2.Economy.TransferHelp",
      ),
      currencyWallet: currencyState
        ? {
            approvalState:
              game.user?.isGM === true
                ? "gm"
                : currencyExchangeAutoApprovalEnabled()
                  ? "auto-approved"
                  : "gm-approval-required",
            denominations: currencyState.wallet.definition.denominations.map(
              (denomination, index) => ({
                count: currencyState.wallet.counts[denomination.id] ?? "0",
                id: denomination.id,
                isMain: index === 0,
                label: denominationLabel(
                  denomination,
                  currencyState.wallet.definition,
                ),
              }),
            ),
            multiple: currencyState.wallet.definition.denominations.length > 1,
            stale: currencyState.stale,
            totalSmallestUnit: currencyState.wallet.totalSmallestUnit,
            unresolvedLegacy: currencyState.unresolvedLegacy,
          }
        : null,
      item: options.item ? { name: options.item.name, quantity } : null,
      maximum: options.item ? quantity : balance,
      mode: options.mode,
      recipients: (options.recipients ?? []).map((recipient) => ({
        ...recipient,
        encoded: recipientValue(recipient),
        typeLabel: economyRecipientTypeLabel(recipient),
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
  const exchangeButton =
    options.mode === "spend" &&
    currencyState?.stale === false &&
    !currencyState.unresolvedLegacy &&
    currencyState.currentDefinition.denominations.length > 1
      ? [
          {
            action: "currency-exchange",
            callback: (_event: Event, button: FoundryDialogButton) => {
              const form = button.form;
              const currencyAction = stringValue(
                (
                  form?.elements.namedItem(
                    "currencyAction",
                  ) as HTMLSelectElement | null
                )?.value,
              );
              if (currencyAction !== "exchange") return null;
              const quantity = stringValue(
                (form?.elements.namedItem("amount") as HTMLInputElement | null)
                  ?.value,
              );
              const fromDenominationId = stringValue(
                (
                  form?.elements.namedItem(
                    "denominationId",
                  ) as HTMLSelectElement | null
                )?.value,
              );
              const toDenominationId = stringValue(
                (
                  form?.elements.namedItem(
                    "toDenominationId",
                  ) as HTMLSelectElement | null
                )?.value,
              );
              try {
                currencyExchangePreview(
                  options.actor,
                  fromDenominationId,
                  toDenominationId,
                  quantity,
                );
              } catch {
                return null;
              }
              return {
                definitionFingerprint:
                  currencyState.wallet.definitionFingerprint,
                definitionRevision: currencyState.wallet.definitionRevision,
                expectedTotalSmallestUnit:
                  currencyState.wallet.totalSmallestUnit,
                expectedWalletFingerprint: currencyWalletFingerprint(
                  currencyState.wallet,
                ),
                fromDenominationId,
                quantity,
                sourceActorId: options.actor.id,
                toDenominationId,
                type: "currency-exchange",
                version: 1,
              } satisfies EconomyCurrencyExchangeRequest;
            },
            icon: "fa-solid fa-right-left",
            label: localized("D6E2.Economy.Exchange"),
          },
        ]
      : [];
  const primaryButton =
    (options.mode !== "item-transfer" ||
      (options.recipients?.length ?? 0) > 0) &&
    (options.mode === "item-transfer" ||
      (currencyState?.stale === false && !currencyState.unresolvedLegacy))
      ? [
          {
            action: options.mode,
            callback: (_event: Event, button: FoundryDialogButton) => {
              const amountText = stringValue(
                (
                  button.form?.elements.namedItem(
                    "amount",
                  ) as HTMLInputElement | null
                )?.value,
              );
              const amount =
                options.mode === "item-transfer"
                  ? Number(amountText)
                  : amountText;
              if (
                options.mode === "item-transfer" &&
                (!Number.isSafeInteger(amount) || Number(amount) < 1)
              )
                return null;
              const denominationId = stringValue(
                (
                  button.form?.elements.namedItem(
                    "denominationId",
                  ) as HTMLSelectElement | null
                )?.value,
              );
              if (options.mode === "spend") {
                if (!currencyState) return null;
                const currencyAction = stringValue(
                  (
                    button.form?.elements.namedItem(
                      "currencyAction",
                    ) as HTMLSelectElement | null
                  )?.value,
                );
                if (
                  currencyState.currentDefinition.denominations.length > 1 &&
                  currencyAction !== "spend"
                )
                  return null;
                const note = stringValue(
                  (
                    button.form?.elements.namedItem(
                      "note",
                    ) as HTMLInputElement | null
                  )?.value,
                ).trim();
                return {
                  amount,
                  definitionFingerprint:
                    currencyState.wallet.definitionFingerprint,
                  denominationId,
                  expectedTotalSmallestUnit:
                    currencyState.wallet.totalSmallestUnit,
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
              if (options.mode === "currency-transfer") {
                if (!currencyState) return null;
                return {
                  amount,
                  definitionFingerprint:
                    currencyState.wallet.definitionFingerprint,
                  denominationId,
                  expectedTotalSmallestUnit:
                    currencyState.wallet.totalSmallestUnit,
                  recipient,
                  sourceActorId: options.actor.id,
                  type: "currency-transfer",
                } satisfies EconomyCurrencyTransferRequest;
              }
              return {
                itemId: options.item?.id ?? "",
                quantity: Number(amount),
                recipient,
                sourceActorId: options.actor.id,
                type: "item-transfer",
              } satisfies EconomyItemTransferRequest;
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
        ...exchangeButton,
        ...primaryButton,
      ],
      classes: ["d6e2", "od6roll-dialog", "d6e2-economy-dialog"],
      content,
      modal: true,
      position: { width: 520 },
      rejectClose: false,
      render: (_event, dialog) => {
        if (options.mode !== "spend" || !currencyState) return;
        const application = dialog as unknown as {
          readonly element?: HTMLElement;
          setPosition(position?: Record<string, unknown>): unknown;
        };
        const root = application.element;
        if (!root) return;
        let previousExchangeMode: boolean | undefined;
        const update = (): void => {
          const exchangeMode =
            root.querySelector<HTMLSelectElement>("[name=currencyAction]")
              ?.value === "exchange";
          root
            .querySelectorAll<HTMLElement>(
              "[data-currency-exchange-panel], [data-currency-exchange-only]",
            )
            .forEach((panel) => {
              panel.hidden = !exchangeMode;
            });
          root
            .querySelectorAll<HTMLElement>("[data-currency-spend-only]")
            .forEach((panel) => {
              panel.hidden = exchangeMode;
            });
          const spendButton = root.querySelector<HTMLButtonElement>(
            'button[data-action="spend"]',
          );
          const exchangeButton = root.querySelector<HTMLButtonElement>(
            'button[data-action="currency-exchange"]',
          );
          if (spendButton) {
            spendButton.hidden = exchangeMode;
            spendButton.disabled = exchangeMode;
          }
          if (exchangeButton) {
            exchangeButton.hidden = !exchangeMode;
            exchangeButton.disabled = !exchangeMode;
          }
          const help = root.querySelector<HTMLElement>(
            "[data-currency-intent-help]",
          );
          if (help)
            help.textContent = exchangeMode
              ? localized("D6E2.Economy.ExchangeHelp")
              : localized(
                  currencyState.wallet.definition.denominations.length === 1
                    ? "D6E2.Economy.SpendSingleUnitHelp"
                    : "D6E2.Economy.SpendHelp",
                );
          if (previousExchangeMode !== exchangeMode) {
            previousExchangeMode = exchangeMode;
            requestAnimationFrame(() =>
              constrainDialogToViewport(application, root),
            );
          }
          if (!exchangeMode) return;
          const amount =
            root.querySelector<HTMLInputElement>("[name=amount]")?.value ?? "";
          const from =
            root.querySelector<HTMLSelectElement>("[name=denominationId]")
              ?.value ?? "";
          const to =
            root.querySelector<HTMLSelectElement>("[name=toDenominationId]")
              ?.value ?? "";
          const status = root.querySelector<HTMLElement>(
            "[data-currency-preview-status]",
          );
          try {
            const preview = currencyExchangePreview(
              options.actor,
              from,
              to,
              amount,
            );
            if (status)
              status.textContent = localized("D6E2.Economy.PreviewReady");
            for (const [selector, value] of [
              ["[data-currency-preview-value]", preview.exactValueSmallestUnit],
              ["[data-currency-preview-received]", preview.receivedCount],
              ["[data-currency-preview-remainder]", preview.remainderCount],
            ] as const) {
              const output = root.querySelector<HTMLElement>(selector);
              if (output) output.textContent = value;
            }
            for (const denomination of currencyState.currentDefinition
              .denominations) {
              const before = root.querySelector<HTMLElement>(
                `[data-currency-before="${CSS.escape(denomination.id)}"]`,
              );
              const after = root.querySelector<HTMLElement>(
                `[data-currency-after="${CSS.escape(denomination.id)}"]`,
              );
              if (before)
                before.textContent =
                  preview.before.counts[denomination.id] ?? "0";
              if (after)
                after.textContent =
                  preview.after.counts[denomination.id] ?? "0";
            }
          } catch {
            if (status)
              status.textContent = localized("D6E2.Economy.PreviewUnavailable");
          }
        };
        root.addEventListener("input", update);
        root.addEventListener("change", update);
        update();
      },
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
  target: FoundryActorDocument,
): Promise<boolean | null> {
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/actor/character/economy-approval-dialog.hbs`,
    {
      amount: message.amount,
      currencyLabel: economyCurrencyLabel(),
      denominationLabel: message.assetLabel || economyCurrencyLabel(),
      itemName:
        message.approvalType === "item-transfer"
          ? message.assetLabel
          : undefined,
      itemTypeLabel: "",
      requesterName: message.requesterName,
      sourceName: message.sourceName,
      targetName: message.targetName || target.name,
      type:
        message.approvalType === "currency-holder-transfer"
          ? "currency-transfer"
          : message.approvalType,
    },
  );
  const result = await foundry.applications.api.DialogV2.wait<boolean | null>({
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
  return result ?? null;
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
    currencyRequestState(request, source);
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
  assertGridStorageLegacyMutationAllowed(item);
  if (request.quantity > Math.max(0, integer(record(item.system).quantity))) {
    throw new Error("D6E2.Economy.Error.InsufficientQuantity");
  }
  return { item, source, target };
}

function transferRequest(
  request: D6EconomyRequest,
): request is
  | EconomyCurrencyHolderTransferRequest
  | EconomyCurrencyTransferRequest
  | EconomyItemTransferRequest {
  return (
    request.type === "currency-holder-transfer" ||
    request.type === "currency-transfer" ||
    request.type === "item-transfer"
  );
}

function currencyRequestState(
  request:
    | EconomyCurrencyExchangeRequest
    | EconomyCurrencyTransferRequest
    | EconomySpendRequest,
  source: FoundryActorDocument,
): {
  readonly amount: bigint;
  readonly denominationId: string;
  readonly state: ReturnType<typeof actorCurrencyWalletState>;
} {
  const state = actorCurrencyWalletState(source);
  if (state.stale) throw new Error("D6E2.Economy.Error.StaleDefinition");
  if (state.unresolvedLegacy)
    throw new Error("D6E2.Economy.Error.UnresolvedLegacyValue");
  if (
    request.definitionFingerprint !== undefined &&
    request.definitionFingerprint !== state.wallet.definitionFingerprint
  )
    throw new Error("D6E2.Economy.Error.StaleDefinition");
  if (
    request.expectedTotalSmallestUnit !== undefined &&
    request.expectedTotalSmallestUnit !== state.wallet.totalSmallestUnit
  )
    throw new Error("D6E2.Economy.Error.StaleBalance");
  const main = state.currentDefinition.denominations[0];
  const denominationId =
    "denominationId" in request && request.denominationId
      ? request.denominationId
      : "fromDenominationId" in request
        ? request.fromDenominationId
        : main?.id;
  if (!denominationId || !Object.hasOwn(state.wallet.counts, denominationId))
    throw new Error("D6E2.Economy.Error.UnknownDenomination");
  const amount =
    "quantity" in request
      ? currencyInteger(request.quantity, { positive: true })
      : currencyInteger(String(request.amount), { positive: true });
  return { amount, denominationId, state };
}

function changedCount(
  state: ReturnType<typeof actorCurrencyWalletState>,
  denominationId: string,
  delta: bigint,
): Readonly<Record<string, string>> {
  const before = currencyInteger(state.wallet.counts[denominationId] ?? "0");
  const after = before + delta;
  if (after < 0n)
    throw new Error(
      state.currentDefinition.denominations.length > 1
        ? "D6E2.Economy.Error.InsufficientDenomination"
        : "D6E2.Economy.Error.InsufficientFunds",
    );
  return Object.freeze({
    ...state.wallet.counts,
    [denominationId]: after.toString(),
  });
}

function currencyOperationIntent(request: D6EconomyRequest): string {
  if (request.type === "currency-holder-transfer")
    return JSON.stringify([
      1,
      request.type,
      request.sourceActorId,
      request.targetActorId,
      request.holderTransfer,
    ]);
  if (request.type === "spend")
    return JSON.stringify([
      1,
      request.type,
      request.sourceActorId,
      request.definitionFingerprint ?? "",
      request.denominationId ?? "",
      String(request.amount),
      request.expectedTotalSmallestUnit ?? "",
      request.note,
    ]);
  if (request.type === "currency-exchange")
    return JSON.stringify([
      1,
      request.type,
      request.sourceActorId,
      request.definitionFingerprint,
      request.definitionRevision,
      request.expectedTotalSmallestUnit,
      request.expectedWalletFingerprint,
      request.fromDenominationId,
      request.toDenominationId,
      request.quantity,
    ]);
  if (request.type === "currency-transfer")
    return JSON.stringify([
      1,
      request.type,
      request.sourceActorId,
      request.recipient.actorId,
      request.recipient.kind,
      request.definitionFingerprint ?? "",
      request.denominationId ?? "",
      String(request.amount),
      request.expectedTotalSmallestUnit ?? "",
    ]);
  return JSON.stringify([
    1,
    request.type,
    request.sourceActorId,
    request.type === "item-transfer" ? request.recipient.actorId : "",
    request.itemId,
    request.quantity,
  ]);
}

function requiredRecoveryString(value: unknown, maximumLength = 128): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximumLength
  )
    throw new Error("D6E2.Economy.Error.DuplicateRequest");
  return value;
}

function parsePendingCurrencyTransfer(
  receipt: D6CurrencyOperationReceiptV1,
  sourceActorId: string,
): EconomyCurrencyTransferRequest {
  if (
    receipt.status !== "pending-transfer" ||
    typeof receipt.recoveryRequest !== "string"
  )
    throw new Error("D6E2.Economy.Error.DuplicateRequest");
  let parsed: unknown;
  try {
    parsed = JSON.parse(receipt.recoveryRequest) as unknown;
  } catch {
    throw new Error("D6E2.Economy.Error.DuplicateRequest");
  }
  const raw = record(parsed);
  const recipient = record(raw.recipient);
  const amount = raw.amount;
  const kind = recipient.kind;
  if (
    raw.type !== "currency-transfer" ||
    raw.sourceActorId !== sourceActorId ||
    (typeof amount !== "string" && typeof amount !== "number") ||
    (typeof amount === "number" && !Number.isFinite(amount)) ||
    typeof recipient.actorId !== "string" ||
    recipient.actorId.length < 1 ||
    recipient.actorId.length > 128 ||
    (kind !== "pc" && kind !== "scene-npc") ||
    typeof recipient.label !== "string" ||
    recipient.label.length < 1 ||
    recipient.label.length > 256
  )
    throw new Error("D6E2.Economy.Error.DuplicateRequest");
  const request = {
    amount,
    ...(raw.definitionFingerprint === undefined
      ? {}
      : {
          definitionFingerprint: requiredRecoveryString(
            raw.definitionFingerprint,
            128,
          ),
        }),
    ...(raw.denominationId === undefined
      ? {}
      : { denominationId: requiredRecoveryString(raw.denominationId, 64) }),
    ...(raw.expectedTotalSmallestUnit === undefined
      ? {}
      : {
          expectedTotalSmallestUnit: requiredRecoveryString(
            raw.expectedTotalSmallestUnit,
            80,
          ),
        }),
    recipient: {
      actorId: recipient.actorId,
      kind,
      label: recipient.label,
      ...(recipient.sceneId === undefined
        ? {}
        : { sceneId: requiredRecoveryString(recipient.sceneId) }),
      ...(recipient.sourceTokenId === undefined
        ? {}
        : { sourceTokenId: requiredRecoveryString(recipient.sourceTokenId) }),
      ...(recipient.targetTokenId === undefined
        ? {}
        : { targetTokenId: requiredRecoveryString(recipient.targetTokenId) }),
    },
    sourceActorId,
    type: "currency-transfer" as const,
  } satisfies EconomyCurrencyTransferRequest;
  if (currencyOperationIntent(request) !== receipt.intent)
    throw new Error("D6E2.Economy.Error.DuplicateRequest");
  return request;
}

function pendingTransferReceipt(
  request: EconomyCurrencyTransferRequest,
  operationId: string,
  requesterUserId: string,
): D6CurrencyOperationReceiptV1 | undefined {
  const source = game.actors?.get(request.sourceActorId);
  if (source?.type !== "character") return undefined;
  const receipt =
    actorCurrencyWalletState(source).wallet.operationReceipts[operationId];
  if (
    receipt?.status !== "pending-transfer" ||
    receipt.requesterUserId !== requesterUserId ||
    receipt.intent !== currencyOperationIntent(request)
  )
    return undefined;
  try {
    parsePendingCurrencyTransfer(receipt, source.id);
    return receipt;
  } catch {
    return undefined;
  }
}

function assertFreshOperation(
  wallet: ReturnType<typeof actorCurrencyWalletState>["wallet"],
  operationId: string,
): void {
  if (
    wallet.recentOperationIds.includes(operationId) ||
    Object.hasOwn(wallet.operationReceipts, operationId)
  )
    throw new Error("D6E2.Economy.Error.DuplicateRequest");
}

async function createTransactionReceiptSafe(
  request: D6EconomyRequest,
  requester: FoundryUser,
  source: FoundryActorDocument,
  target?: FoundryActorDocument,
  item?: FoundryItemDocument,
  currencyDetails?: Readonly<{
    exactValueSmallestUnit: string;
    receivedCount: string;
    remainderCount: string;
  }>,
  routeLabels?: Readonly<{ sourceName: string; targetName: string }>,
): Promise<void> {
  try {
    await createTransactionReceipt(
      request,
      requester,
      source,
      target,
      item,
      currencyDetails,
      routeLabels,
    );
  } catch (error) {
    console.error(
      "D6 System | Currency transaction committed but receipt creation failed",
      error,
    );
  }
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
  currencyDetails?: Readonly<{
    exactValueSmallestUnit: string;
    receivedCount: string;
    remainderCount: string;
  }>,
  routeLabels?: Readonly<{ sourceName: string; targetName: string }>,
): Promise<void> {
  const currencyState =
    request.type === "item-drop" || request.type === "item-transfer"
      ? null
      : actorCurrencyWalletState(source);
  const denomination =
    currencyState && "denominationId" in request
      ? currencyState.currentDefinition.denominations.find(
          ({ id }) => id === request.denominationId,
        )
      : undefined;
  const exchangeFrom =
    request.type === "currency-exchange"
      ? currencyState?.currentDefinition.denominations.find(
          ({ id }) => id === request.fromDenominationId,
        )
      : undefined;
  const exchangeTo =
    request.type === "currency-exchange"
      ? currencyState?.currentDefinition.denominations.find(
          ({ id }) => id === request.toDenominationId,
        )
      : undefined;
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/chat/economy-audit.hbs`,
    {
      amount:
        request.type === "currency-holder-transfer"
          ? request.holderTransfer.amount
          : "amount" in request
            ? request.amount
            : request.quantity,
      currencyLabel: economyCurrencyLabel(),
      denominationLabel: denomination
        ? denominationLabel(denomination, currencyState?.currentDefinition)
        : "",
      exchangeFromLabel: exchangeFrom
        ? denominationLabel(exchangeFrom, currencyState?.currentDefinition)
        : "",
      exchangeToLabel: exchangeTo
        ? denominationLabel(exchangeTo, currencyState?.currentDefinition)
        : "",
      exactValueSmallestUnit: currencyDetails?.exactValueSmallestUnit ?? "",
      itemName: item?.name,
      itemTypeLabel: economyItemTypeLabel(item),
      note: request.type === "spend" ? request.note : "",
      requesterName: nonBlank(
        requester.name,
        localized("D6E2.Economy.UnknownUser"),
      ),
      sourceName: routeLabels?.sourceName ?? source.name,
      receivedCount: currencyDetails?.receivedCount ?? "",
      remainderCount: currencyDetails?.remainderCount ?? "",
      targetName: routeLabels?.targetName ?? target?.name,
      type:
        request.type === "currency-holder-transfer"
          ? "currency-transfer"
          : request.type,
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
  operationId = economyRequestId(),
  requireElectedAuthority = false,
  exchangeApproval?: ExchangeApproval,
  receiptRequester = requester,
  targetControllerUserId: string | null = null,
): Promise<void> {
  if (
    requireElectedAuthority &&
    !requester.isGM &&
    electedGm()?.id !== game.user?.id
  )
    throw new Error("D6E2.Economy.Error.GmUnavailable");
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
  if (request.type === "currency-holder-transfer") {
    const sourceHolder = await resolveCurrencyHolder(
      request.holderTransfer.source,
    );
    const targetHolder = await resolveCurrencyHolder(
      request.holderTransfer.target,
    );
    if (
      sourceHolder.ownerRoot.id !== request.sourceActorId ||
      targetHolder.ownerRoot.id !== request.targetActorId
    )
      throw new Error("D6E2.Economy.Error.NotAuthorized");
    const result = await executeCurrencyHolderTransfer(
      request.holderTransfer,
      requester,
      operationId,
      targetControllerUserId,
    );
    await createTransactionReceiptSafe(
      {
        amount: request.holderTransfer.amount,
        definitionFingerprint: request.holderTransfer.definitionFingerprint,
        denominationId: request.holderTransfer.denominationId,
        expectedTotalSmallestUnit:
          request.holderTransfer.expectedSourceTotalSmallestUnit,
        recipient: {
          actorId: targetHolder.ownerRoot.id,
          kind: "pc",
          label: targetHolder.ownerRoot.name,
        },
        sourceActorId: sourceHolder.ownerRoot.id,
        type: "currency-transfer",
      },
      receiptRequester,
      sourceHolder.ownerRoot,
      targetHolder.ownerRoot,
      undefined,
      undefined,
      { sourceName: result.sourceLabel, targetName: result.targetLabel },
    );
    return;
  }
  const source = game.actors?.get(request.sourceActorId);
  if (
    source?.type !== "character" ||
    (!requester.isGM && !source.testUserPermission(requester, "OWNER"))
  ) {
    throw new Error("D6E2.Economy.Error.NotAuthorized");
  }
  if (request.type === "spend") {
    const { amount, denominationId, state } = currencyRequestState(
      request,
      source,
    );
    assertFreshOperation(state.wallet, operationId);
    const wallet = walletWithOperation(
      state.wallet,
      operationId,
      changedCount(state, denominationId, -amount),
      { intent: currencyOperationIntent(request), status: "complete" },
    );
    await source.update(currencyWalletChanges(wallet));
    await createTransactionReceiptSafe(request, requester, source);
    return;
  }

  if (request.type === "currency-exchange") {
    if (
      !requester.isGM &&
      exchangeApproval !== "manual" &&
      !currencyExchangeAutoApprovalEnabled()
    )
      throw new Error("D6E2.Economy.Error.GmUnavailable");
    const { state } = currencyRequestState(request, source);
    assertFreshOperation(state.wallet, operationId);
    const preview = planCurrencyExchange(
      state.currentDefinition,
      state.wallet,
      {
        ...request,
        requestId: operationId,
      },
    );
    const wallet = walletWithOperation(
      preview.after,
      operationId,
      preview.after.counts,
      { intent: currencyOperationIntent(request), status: "complete" },
    );
    await source.update(currencyWalletChanges(wallet));
    await createTransactionReceiptSafe(
      request,
      requester,
      source,
      undefined,
      undefined,
      preview,
    );
    return;
  }

  if (request.type === "currency-transfer") {
    const target = await validateRecipient(
      source,
      request.recipient,
      requester,
    );
    const intent = currencyOperationIntent(request);
    const initialSourceState = actorCurrencyWalletState(source);
    const existingSourceReceipt =
      initialSourceState.wallet.operationReceipts[operationId];
    if (
      initialSourceState.wallet.recentOperationIds.includes(operationId) ||
      (existingSourceReceipt &&
        (existingSourceReceipt.intent !== intent ||
          existingSourceReceipt.status === "complete"))
    )
      throw new Error("D6E2.Economy.Error.DuplicateRequest");
    let sourcePendingWallet = initialSourceState.wallet;
    let denominationId: string;
    let amount: bigint;
    if (existingSourceReceipt?.status === "pending-transfer") {
      if (initialSourceState.stale)
        throw new Error("D6E2.Economy.Error.StaleDefinition");
      if (initialSourceState.unresolvedLegacy)
        throw new Error("D6E2.Economy.Error.UnresolvedLegacyValue");
      const main = initialSourceState.currentDefinition.denominations[0];
      denominationId = request.denominationId ?? main?.id ?? "";
      if (!Object.hasOwn(initialSourceState.wallet.counts, denominationId))
        throw new Error("D6E2.Economy.Error.UnknownDenomination");
      amount = currencyInteger(String(request.amount), { positive: true });
    } else {
      const sourceRequest = currencyRequestState(request, source);
      amount = sourceRequest.amount;
      denominationId = sourceRequest.denominationId;
    }
    const targetState = actorCurrencyWalletState(target);
    if (
      targetState.stale ||
      targetState.unresolvedLegacy ||
      targetState.wallet.definitionFingerprint !==
        sourcePendingWallet.definitionFingerprint
    )
      throw new Error("D6E2.Economy.Error.IncompatibleWallet");
    const targetReceipt = targetState.wallet.operationReceipts[operationId];
    if (targetReceipt) {
      if (
        !existingSourceReceipt ||
        targetReceipt.intent !== intent ||
        targetReceipt.status !== "complete"
      )
        throw new Error("D6E2.Economy.Error.DuplicateRequest");
    } else {
      if (targetState.wallet.recentOperationIds.includes(operationId))
        throw new Error("D6E2.Economy.Error.DuplicateRequest");
    }
    if (!existingSourceReceipt) {
      const recoveryRequest = JSON.stringify(request);
      if (
        recoveryRequest.length < 1 ||
        recoveryRequest.length > 4096 ||
        requester.id.length < 1 ||
        requester.id.length > 128
      )
        throw new Error("D6E2.Economy.Error.TransactionFailed");
      sourcePendingWallet = walletWithOperation(
        initialSourceState.wallet,
        operationId,
        changedCount(initialSourceState, denominationId, -amount),
        {
          createdAt: Date.now(),
          intent,
          recoveryRequest,
          requesterUserId: requester.id,
          status: "pending-transfer",
        },
      );
      await source.update(currencyWalletChanges(sourcePendingWallet));
    }
    if (!targetReceipt) {
      const targetWallet = walletWithOperation(
        targetState.wallet,
        operationId,
        changedCount(targetState, denominationId, amount),
        { intent, status: "complete" },
      );
      await target.update(currencyWalletChanges(targetWallet));
    }
    const finalSourceState = actorCurrencyWalletState(source);
    const sourceWallet = walletWithUpdatedOperation(
      finalSourceState.wallet,
      operationId,
      { intent, status: "complete" },
    );
    await source.update(currencyWalletChanges(sourceWallet));
    await createTransactionReceiptSafe(
      request,
      receiptRequester,
      source,
      target,
    );
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
  assertGridStorageLegacyMutationAllowed(item);
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
    await createTransactionReceiptSafe(
      request,
      requester,
      source,
      undefined,
      item,
    );
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
  await createTransactionReceiptSafe(request, requester, source, target, item);
}

async function requestRecipientApproval(
  request:
    | EconomyCurrencyHolderTransferRequest
    | EconomyCurrencyTransferRequest
    | EconomyItemTransferRequest,
  requester: FoundryUser,
  requestId: string,
): Promise<string | null> {
  const gm = electedGm();
  if (!gm || game.user?.id !== gm.id)
    throw new Error("D6E2.Economy.Error.GmUnavailable");
  let source: FoundryActorDocument;
  let target: FoundryActorDocument;
  let sourceName: string;
  let targetName: string;
  let assetLabel = "";
  let amount: string | number;
  let controller: FoundryUser | undefined;
  if (request.type === "currency-holder-transfer") {
    const sourceHolder = await resolveCurrencyHolder(
      request.holderTransfer.source,
    );
    const targetHolder = await resolveCurrencyHolder(
      request.holderTransfer.target,
    );
    if (
      sourceHolder.ownerRoot.id !== request.sourceActorId ||
      targetHolder.ownerRoot.id !== request.targetActorId ||
      !sourceHolder.reachable ||
      !targetHolder.reachable ||
      !userMayControlCurrencyHolder(sourceHolder, requester)
    )
      throw new Error("D6E2.Economy.Error.NotAuthorized");
    if (userMayControlCurrencyHolder(targetHolder, requester)) return null;
    if (request.holderTransfer.target.kind !== "root")
      throw new Error("D6E2.Economy.Error.InvalidRecipient");
    controller = activeCurrencyHolderControllers(targetHolder)[0];
    source = sourceHolder.ownerRoot;
    target = targetHolder.ownerRoot;
    sourceName = sourceHolder.label;
    targetName = targetHolder.label;
    const denomination =
      sourceHolder.state.wallet.definition.denominations.find(
        ({ id }) => id === request.holderTransfer.denominationId,
      );
    assetLabel = denomination
      ? denominationLabel(denomination, sourceHolder.state.wallet.definition)
      : request.holderTransfer.denominationId;
    amount = request.holderTransfer.amount;
  } else {
    const proposal = await validateTransferProposal(request, requester);
    source = proposal.source;
    target = proposal.target;
    if (request.recipient.kind !== "pc") return null;
    controller = activeRecipientOwners(target)[0];
    sourceName = source.name;
    targetName = target.name;
    amount =
      request.type === "currency-transfer" ? request.amount : request.quantity;
    if (request.type === "item-transfer") {
      assetLabel = proposal.item?.name ?? localized("D6E2.Economy.Item");
    } else {
      const state = actorCurrencyWalletState(source);
      const denomination = state.wallet.definition.denominations.find(
        ({ id }) => id === request.denominationId,
      );
      assetLabel = denomination
        ? denominationLabel(denomination, state.wallet.definition)
        : economyCurrencyLabel();
    }
  }
  if (!controller) throw new Error("D6E2.Economy.Error.RecipientUnavailable");
  const createdAt = Date.now();
  const expiresAt = createdAt + RECIPIENT_APPROVAL_TIMEOUT_MS;
  const accepted = await new Promise<boolean>((resolve, reject) => {
    pendingApprovals.set(requestId, {
      reject,
      requesterUserId: requester.id,
      resolve,
      targetUserId: controller.id,
    });
    window.setTimeout(() => {
      if (!pendingApprovals.delete(requestId)) return;
      resolveD6PendingInteraction(requestId);
      reject(new Error("D6E2.Economy.Error.ApprovalTimeout"));
    }, RECIPIENT_APPROVAL_TIMEOUT_MS);
    registerD6PendingInteraction({
      actorId: target.id,
      actorImg: target.img,
      actorName: target.name,
      controllerName: controller.name ?? controller.id,
      controllerUserId: controller.id,
      createdAt,
      expiresAt,
      id: requestId,
      kind: "economy-approval",
      label: localized("D6E2.Economy.ApprovalTitle"),
      subjectLabel: target.name,
    });
    game.socket?.emit(`system.${SYSTEM_ID}`, {
      amount,
      approvalType: request.type,
      assetLabel,
      createdAt,
      expiresAt,
      gmUserId: gm.id,
      requestId,
      requesterName: nonBlank(
        requester.name,
        localized("D6E2.Economy.UnknownUser"),
      ),
      requesterUserId: requester.id,
      sourceName,
      sourceActorId: source.id,
      targetActorId: target.id,
      ...(request.type === "currency-holder-transfer"
        ? { targetHolder: request.holderTransfer.target }
        : {}),
      targetName,
      targetUserId: controller.id,
      type: "economy-approval-request",
      version: 1,
    } satisfies EconomyApprovalRequest);
  });
  if (!accepted) throw new Error("D6E2.Economy.Error.RecipientDeclined");
  return controller.id;
}

async function requestGmExchangeApproval(
  request: EconomyCurrencyExchangeRequest,
  requester: FoundryUser,
  requestId: string,
): Promise<"auto" | "manual" | "requester-gm"> {
  if (requester.isGM) return "requester-gm";
  if (currencyExchangeAutoApprovalEnabled()) return "auto";
  const gm = electedGm();
  if (!gm || game.user?.id !== gm.id)
    throw new Error("D6E2.Economy.Error.GmUnavailable");
  const source = game.actors?.get(request.sourceActorId);
  if (
    source?.type !== "character" ||
    !source.testUserPermission(requester, "OWNER")
  )
    throw new Error("D6E2.Economy.Error.NotAuthorized");
  const state = actorCurrencyWalletState(source);
  const preview = planCurrencyExchange(state.currentDefinition, state.wallet, {
    ...request,
    requestId,
  });
  const denominations = new Map(
    state.currentDefinition.denominations.map((entry) => [entry.id, entry]),
  );
  const fallbackDenomination = state.currentDefinition.denominations[0];
  if (!fallbackDenomination)
    throw new Error("currency.definition.denominations");
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/actor/character/currency-exchange-approval.hbs`,
    {
      actorName: source.name,
      after: state.currentDefinition.denominations.map((entry) => ({
        count: preview.after.counts[entry.id] ?? "0",
        id: entry.id,
        label: denominationLabel(entry, state.currentDefinition),
      })),
      before: state.currentDefinition.denominations.map((entry) => ({
        count: preview.before.counts[entry.id] ?? "0",
        id: entry.id,
        label: denominationLabel(entry, state.currentDefinition),
      })),
      exactValueSmallestUnit: preview.exactValueSmallestUnit,
      fromLabel: denominationLabel(
        denominations.get(request.fromDenominationId) ?? fallbackDenomination,
        state.currentDefinition,
      ),
      quantity: request.quantity,
      remainderCount: preview.remainderCount,
      requesterName: nonBlank(
        requester.name,
        localized("D6E2.Economy.UnknownUser"),
      ),
      toLabel: denominationLabel(
        denominations.get(request.toDenominationId) ?? fallbackDenomination,
        state.currentDefinition,
      ),
    },
  );
  const accepted = await foundry.applications.api.DialogV2.wait<boolean>({
    buttons: [
      {
        action: "reject",
        callback: () => false,
        label: localized("D6E2.Economy.Reject"),
      },
      {
        action: "approve",
        callback: () => true,
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-check",
        label: localized("D6E2.Economy.Approve"),
      },
    ],
    classes: ["d6e2", "od6roll-dialog", "d6e2-economy-dialog"],
    content,
    modal: true,
    position: { width: 520 },
    rejectClose: false,
    window: {
      icon: "fa-solid fa-coins",
      title: localized("D6E2.Economy.ExchangeApprovalTitle"),
    },
  });
  if (!accepted) throw new Error("D6E2.Economy.Error.ExchangeDeclined");
  return "manual";
}

async function materializeHolderTransferTarget(
  request: EconomyCurrencyHolderTransferRequest,
): Promise<EconomyCurrencyHolderTransferRequest> {
  const target = await resolveCurrencyHolder(request.holderTransfer.target);
  if (target.ownerRoot.id !== request.targetActorId)
    throw new Error("D6E2.Economy.Error.NotAuthorized");
  return {
    ...request,
    holderTransfer: {
      ...request.holderTransfer,
      expectedTargetTotalSmallestUnit: target.state.wallet.totalSmallestUnit,
      expectedTargetWalletFingerprint: currencyWalletFingerprint(
        target.state.wallet,
      ),
    },
  };
}

async function approveAndExecute(
  request: D6EconomyRequest,
  requester: FoundryUser,
  requestId: string,
): Promise<void> {
  const preparedRequest =
    request.type === "currency-holder-transfer"
      ? await materializeHolderTransferTarget(request)
      : request;
  let targetControllerUserId: string | null = null;
  if (
    transferRequest(preparedRequest) &&
    !(
      preparedRequest.type === "currency-transfer" &&
      pendingTransferReceipt(preparedRequest, requestId, requester.id)
    )
  ) {
    targetControllerUserId = await requestRecipientApproval(
      preparedRequest,
      requester,
      requestId,
    );
  }
  let exchangeApproval: ExchangeApproval | undefined;
  if (preparedRequest.type === "currency-exchange") {
    exchangeApproval = await requestGmExchangeApproval(
      preparedRequest,
      requester,
      requestId,
    );
    if (exchangeApproval === "auto" && !currencyExchangeAutoApprovalEnabled())
      exchangeApproval = await requestGmExchangeApproval(
        preparedRequest,
        requester,
        requestId,
      );
    if (
      exchangeApproval !== "requester-gm" &&
      electedGm()?.id !== game.user?.id
    )
      throw new Error("D6E2.Economy.Error.GmUnavailable");
  }
  await enqueue(
    preparedRequest,
    requester,
    requestId,
    exchangeApproval,
    requester,
    targetControllerUserId,
  );
}

function enqueue(
  request: D6EconomyRequest,
  requester: FoundryUser,
  operationId: string,
  exchangeApproval?: ExchangeApproval,
  receiptRequester?: FoundryUser,
  targetControllerUserId: string | null = null,
): Promise<void> {
  const operation = transactionQueue.then(() =>
    executeRequest(
      request,
      requester,
      operationId,
      true,
      exchangeApproval,
      receiptRequester,
      targetControllerUserId,
    ),
  );
  transactionQueue = operation.catch(() => undefined);
  return operation;
}

function transferRecoveryInteractionId(
  actorId: string,
  operationId: string,
): string {
  return `currency-transfer-recovery:${actorId}:${operationId}`;
}

function clearRegisteredTransferRecoveries(): void {
  for (const id of registeredTransferRecoveries)
    resolveD6PendingInteraction(id);
  registeredTransferRecoveries.clear();
}

export function synchronizePendingCurrencyTransfers(): void {
  const gm = electedGm();
  if (!gm || game.user?.id !== gm.id) {
    clearRegisteredTransferRecoveries();
    return;
  }
  const desired = new Set<string>();
  for (const source of game.actors?.contents ?? []) {
    if (source.type !== "character") continue;
    const state = actorCurrencyWalletState(source);
    if (state.invalidStoredWallet) continue;
    for (const [operationId, receipt] of Object.entries(
      state.wallet.operationReceipts,
    )) {
      if (receipt.status !== "pending-transfer") continue;
      let request: EconomyCurrencyTransferRequest;
      try {
        request = parsePendingCurrencyTransfer(receipt, source.id);
      } catch {
        continue;
      }
      const id = transferRecoveryInteractionId(source.id, operationId);
      desired.add(id);
      const denominationId =
        request.denominationId ?? state.wallet.definition.denominations[0]?.id;
      const denomination = state.wallet.definition.denominations.find(
        (entry) => entry.id === denominationId,
      );
      const denominationName = denomination
        ? denominationLabel(denomination, state.wallet.definition)
        : (denominationId ?? economyCurrencyLabel());
      const targetName =
        game.actors?.get(request.recipient.actorId)?.name ??
        request.recipient.label;
      registerD6PendingInteraction({
        actorId: source.id,
        actorImg: source.img,
        actorName: source.name,
        controllerName: gm.name ?? gm.id,
        controllerUserId: gm.id,
        createdAt: receipt.createdAt ?? Date.now(),
        id,
        kind: "economy-approval",
        label: `${localized("D6E2.Economy.TransferCurrency")}: ${String(request.amount)} ${denominationName} → ${targetName}`,
        reopen: async () => {
          const currentGm = electedGm();
          if (!currentGm || game.user?.id !== currentGm.id)
            throw new Error("D6E2.Economy.Error.GmUnavailable");
          const currentSource = game.actors?.get(source.id);
          const currentReceipt = currentSource
            ? actorCurrencyWalletState(currentSource).wallet.operationReceipts[
                operationId
              ]
            : undefined;
          if (currentReceipt?.status !== "pending-transfer") return "resolved";
          const currentRequest = parsePendingCurrencyTransfer(
            currentReceipt,
            source.id,
          );
          const originalRequester = game.users?.get(
            currentReceipt.requesterUserId ?? "",
          );
          await enqueue(
            currentRequest,
            currentGm,
            operationId,
            undefined,
            originalRequester ?? currentGm,
          );
          registeredTransferRecoveries.delete(id);
          return "resolved";
        },
        subjectLabel: `${source.name} → ${targetName}`,
      });
      registeredTransferRecoveries.add(id);
    }
  }
  for (const id of registeredTransferRecoveries) {
    if (desired.has(id)) continue;
    resolveD6PendingInteraction(id);
    registeredTransferRecoveries.delete(id);
  }
}

export async function submitEconomyRequest(
  request: D6EconomyRequest,
): Promise<void> {
  const requester = game.user;
  if (!requester) throw new Error("D6E2.Economy.Error.UserRequired");
  if (requester.isGM)
    return approveAndExecute(request, requester, economyRequestId());
  const gm = electedGm();
  if (!gm) throw new Error("D6E2.Economy.Error.GmUnavailable");
  const requestId = economyRequestId();
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
  assertGridStorageLegacyMutationAllowed(item);
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
      gm?.id !== message.gmUserId ||
      message.version !== 1 ||
      ![
        "currency-holder-transfer",
        "currency-transfer",
        "item-transfer",
      ].includes(message.approvalType) ||
      (typeof message.amount !== "string" &&
        typeof message.amount !== "number") ||
      typeof message.sourceActorId !== "string" ||
      typeof message.targetActorId !== "string" ||
      !Number.isFinite(message.createdAt) ||
      !Number.isFinite(message.expiresAt) ||
      message.expiresAt <= Date.now() ||
      message.expiresAt - message.createdAt > RECIPIENT_APPROVAL_TIMEOUT_MS
    )
      return;
    const source = game.actors?.get(message.sourceActorId);
    const target = game.actors?.get(message.targetActorId);
    if (!source || !target) return;
    if (message.approvalType === "currency-holder-transfer") {
      if (
        message.targetHolder?.kind !== "root" ||
        message.targetHolder.id !== target.uuid ||
        !target.testUserPermission(currentUser, "OWNER")
      )
        return;
    } else if (!target.testUserPermission(currentUser, "OWNER")) return;
    const respond = (accepted: boolean): void => {
      game.socket?.emit(`system.${SYSTEM_ID}`, {
        accepted,
        requestId: message.requestId,
        requesterUserId: message.requesterUserId,
        targetUserId: currentUser.id,
        type: "economy-approval-response",
      } satisfies EconomyApprovalResponse);
    };
    await registerFoundryPendingInteraction(
      {
        actorId: target.id,
        actorImg: target.img,
        actorName: target.name,
        controllerName: currentUser.name ?? currentUser.id,
        controllerUserId: currentUser.id,
        createdAt: message.createdAt,
        expiresAt: message.expiresAt,
        id: message.requestId,
        kind: "economy-approval",
        label: localized("D6E2.Economy.ApprovalTitle"),
        onExpire: () => respond(false),
        reopen: async () => {
          const accepted = await recipientApprovalDialog(message, target);
          if (accepted === null) return "dismissed";
          respond(accepted);
          return "resolved";
        },
        subjectLabel: target.name,
      },
      { automaticEligible: true },
    );
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
    resolveD6PendingInteraction(message.requestId);
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
  synchronizePendingCurrencyTransfers();
  const synchronizeHolders = (): void => {
    void synchronizePendingCurrencyHolderTransfers().catch(() => undefined);
  };
  synchronizeHolders();
  if (transferRecoveryHooksRegistered) return;
  transferRecoveryHooksRegistered = true;
  const synchronize = (): void => {
    synchronizePendingCurrencyTransfers();
    synchronizeHolders();
  };
  Hooks.on("createActor", synchronize);
  Hooks.on("deleteActor", synchronize);
  Hooks.on("updateActor", (_actor: unknown, changes: unknown) => {
    if (
      documentUpdateTouches(changes, [
        "name",
        "img",
        "type",
        "ownership",
        "items",
        "system.profile",
        "system.currencyWallet",
        "system.storage",
      ])
    )
      synchronize();
  });
  Hooks.on("updateUser", synchronize);
  Hooks.on("createItem", synchronizeHolders);
  Hooks.on("deleteItem", synchronizeHolders);
  Hooks.on("updateItem", (_item: unknown, changes: unknown) => {
    if (
      documentUpdateTouches(changes, [
        "name",
        "type",
        "ownership",
        "system.currencyWallet",
        "system.storageInterior",
        "system.storageInstanceId",
        "system.storagePhysical",
        "system.hasStorage",
        "system.gearCategory",
        "system.quantity",
      ])
    )
      synchronizeHolders();
  });
}

export const __testing = Object.freeze({
  activeRecipientOwners,
  approveAndExecute,
  economyDialog,
  economyAuditRecipients,
  executeRequest,
  parseRecipient,
  receive,
  recipientValue,
  synchronizePendingCurrencyTransfers,
  resetQueue(): void {
    pending.clear();
    pendingApprovals.clear();
    transactionQueue = Promise.resolve();
    registeredTransferRecoveries.clear();
    transferRecoveryHooksRegistered = false;
    resetCurrencyHolderServiceForTests();
    resetD6PendingInteractionsForTests();
  },
});
