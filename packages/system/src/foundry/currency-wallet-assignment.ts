import { currencyDefinitionFingerprint } from "@d6-system-2e/core";
import {
  actorCurrencyWalletState,
  currentDefinitionWalletReplacementChanges,
  currencyWalletEditFingerprint,
  type D6CurrencyWalletState,
} from "./currency-state";
import { withAuthorizedDirectSheetResourceUpdate } from "./mechanical-edit-guard";

interface CurrencyWalletAssignmentResult {
  readonly counts: Readonly<Record<string, string>>;
  readonly kind: "assign";
}

type CurrencyWalletAssignmentPrompt = (
  state: D6CurrencyWalletState,
) => Promise<Readonly<Record<string, string>> | null>;

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function htmlEscape(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

function validatedAssignment(
  value: unknown,
  state: D6CurrencyWalletState,
): Readonly<Record<string, string>> | null {
  const result = record(value);
  const counts = record(result?.counts);
  if (result?.kind !== "assign" || !counts) return null;
  const denominationIds = state.currentDefinition.denominations.map(
    ({ id }) => id,
  );
  if (
    Object.keys(counts).length !== denominationIds.length ||
    !denominationIds.every((id) => typeof counts[id] === "string")
  )
    return null;
  return Object.freeze(
    Object.fromEntries(denominationIds.map((id) => [id, counts[id] as string])),
  );
}

export async function promptCurrentCurrencyWalletAssignment(
  state: D6CurrencyWalletState,
): Promise<Readonly<Record<string, string>> | null> {
  const storedCounts = state.unresolvedLegacy
    ? `${htmlEscape(state.wallet.legacyDecimal ?? "")} — ${htmlEscape(
        game.i18n.localize("D6E2.Currency.UnresolvedShort"),
      )}`
    : state.wallet.definition.denominations
        .map((entry) => {
          const count = state.wallet.counts[entry.id] ?? "0";
          return `${htmlEscape(count)} ${htmlEscape(entry.pluralName)}`;
        })
        .join(", ");
  const fields = state.currentDefinition.denominations
    .map(
      (entry) => `<label class="d6e2-currency-assignment-row">
        <span>${htmlEscape(
          entry.symbol
            ? `${entry.symbol} ${entry.pluralName}`
            : entry.pluralName,
        )}</span>
        <input type="number" name="currencyCount.${htmlEscape(
          entry.id,
        )}" value="0" min="0" step="1">
      </label>`,
    )
    .join("");
  const result = await foundry.applications.api.DialogV2.wait<unknown>({
    buttons: [
      {
        action: "cancel",
        callback: () => false,
        default: true,
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "assign",
        callback: (_event, button) => {
          const form = button.form;
          if (!form) return false;
          const data = new FormData(form);
          return {
            counts: Object.fromEntries(
              state.currentDefinition.denominations.map((entry) => {
                const value = data.get(`currencyCount.${entry.id}`);
                return [entry.id, typeof value === "string" ? value : ""];
              }),
            ),
            kind: "assign",
          } satisfies CurrencyWalletAssignmentResult;
        },
        class: "od6roll-submit",
        icon: "fa-solid fa-coins",
        label: game.i18n.localize("D6E2.Currency.AssignCurrentConfirm"),
      },
    ],
    classes: ["d6e2", "od6roll-dialog", "d6e2-economy-dialog"],
    content: `<div class="od6-dialog-shell d6e2-economy-dialog-content">
      <p class="d6e2-currency-warning">${htmlEscape(
        game.i18n.localize("D6E2.Currency.AssignCurrentHelp"),
      )}</p>
      <p class="d6e2-currency-assignment-stored"><strong>${htmlEscape(
        game.i18n.localize("D6E2.Currency.StoredWallet"),
      )}:</strong> ${storedCounts || "0"}</p>
      <fieldset class="d6e2-currency-assignment-fields">
        <legend>${htmlEscape(
          game.i18n.localize("D6E2.Currency.CurrentWallet"),
        )}</legend>
        ${fields}
      </fieldset>
    </div>`,
    modal: true,
    position: { width: 520 },
    rejectClose: false,
    window: {
      icon: "fa-solid fa-coins",
      title: game.i18n.localize("D6E2.Currency.AssignCurrent"),
    },
  });
  return validatedAssignment(result, state);
}

export async function assignCurrentCurrencyWalletFromDialog(
  actor: FoundryActorDocument,
  editable: boolean,
  operationId: string,
  prompt: CurrencyWalletAssignmentPrompt = promptCurrentCurrencyWalletAssignment,
): Promise<boolean> {
  if (game.user?.isGM !== true || !editable) return false;
  const state = actorCurrencyWalletState(actor);
  if (state.invalidStoredWallet || (!state.stale && !state.unresolvedLegacy))
    return false;
  const assigned = await prompt(state);
  if (!assigned) return false;
  const rechecked = actorCurrencyWalletState(actor);
  if (
    currencyWalletEditFingerprint(rechecked.wallet) !==
      currencyWalletEditFingerprint(state.wallet) ||
    currencyDefinitionFingerprint(rechecked.currentDefinition) !==
      currencyDefinitionFingerprint(state.currentDefinition)
  )
    throw new Error("D6E2.Economy.Error.StaleBalance");
  const changes = currentDefinitionWalletReplacementChanges(
    rechecked,
    assigned,
    operationId,
  );
  await withAuthorizedDirectSheetResourceUpdate(actor, () =>
    actor.update(changes),
  );
  return true;
}
