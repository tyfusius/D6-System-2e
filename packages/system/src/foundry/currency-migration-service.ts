import {
  currencyDefinitionFingerprint,
  currencyWalletFingerprint,
  type D6CurrencyValueV1,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { isD6EquipmentItemType } from "../equipment-item-types";
import { mutableCurrencyDocumentSource } from "../migrations/058-add-currency-denominations";
import {
  actorCurrencyWalletState,
  currentCurrencyDefinition,
  currencyWalletChanges,
  previewCurrencyValueMigration,
  previewCurrencyWalletStateMigration,
  previewWalletMigration,
  storageCurrencyWalletState,
} from "./currency-state";
import { runGridStorageAuthorityEffect } from "./grid-storage-state.js";
import {
  containerCurrencyHolderRef,
  rootCurrencyHolderRef,
  writeCurrencyHolderWalletMigration,
} from "./currency-holder-service.js";

export interface D6CurrencyMigrationRow {
  readonly documentId: string;
  readonly documentName: string;
  readonly documentType: "actor-wallet" | "item-price" | "storage-wallet";
  readonly exact: boolean;
  readonly ownerLabel: string;
  readonly reason: string;
  readonly searchText: string;
  readonly selectionKey: string;
  readonly sourceValue: string;
  readonly targetValue: string;
}

export interface D6CurrencyMigrationPreview {
  readonly definitionFingerprint: string;
  readonly rows: readonly D6CurrencyMigrationRow[];
}

function walletDisplay(wallet: {
  readonly counts: Readonly<Record<string, string>>;
  readonly definition: {
    readonly denominations: readonly {
      readonly id: string;
      readonly pluralName: string;
      readonly singularName: string;
      readonly symbol: string;
    }[];
  };
}): string {
  const parts = wallet.definition.denominations.flatMap((entry) => {
    const count = wallet.counts[entry.id] ?? "0";
    if (count === "0") return [];
    const name = count === "1" ? entry.singularName : entry.pluralName;
    return [`${entry.symbol ? `${entry.symbol} ` : ""}${count} ${name}`];
  });
  if (parts.length > 0) return parts.join(" · ");
  const main = wallet.definition.denominations[0];
  return main ? `0 ${main.pluralName}` : "0";
}

function valueDisplay(value: D6CurrencyValueV1): string {
  if (value.status === "unresolved-legacy")
    return `${value.legacyDecimal ?? ""} (${game.i18n.localize("D6E2.Currency.UnresolvedShort")})`;
  const smallest = value.definition.denominations.at(-1);
  return smallest
    ? `${smallest.symbol ? `${smallest.symbol} ` : ""}${value.amountSmallestUnit} ${smallest.pluralName}`
    : value.amountSmallestUnit;
}

function itemDocuments(): readonly FoundryItemDocument[] {
  const world = game.items?.contents ?? [];
  const embedded = (game.actors?.contents ?? []).flatMap(
    (actor) => actor.items.contents,
  );
  const unique = new Map<string, FoundryItemDocument>();
  for (const item of [...world, ...embedded]) {
    if (isD6EquipmentItemType(item.type))
      unique.set(item.uuid ?? item.id, item);
  }
  return Object.freeze([...unique.values()]);
}

function itemOwnerLabel(item: FoundryItemDocument): string {
  return (
    item.parent?.name ?? game.i18n.localize("D6E2.CurrencyMigration.WorldItems")
  );
}

const STORAGE_ROOT_TYPES = new Set(["vehicle", "starship", "storage-location"]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function storageWalletRow(
  document: FoundryActorDocument | FoundryItemDocument,
  ownerLabel: string,
): D6CurrencyMigrationRow | null {
  const state = storageCurrencyWalletState(document);
  if (!state.stale && !state.unresolvedLegacy) return null;
  const preview = previewCurrencyWalletStateMigration(state);
  const documentId = document.uuid ?? document.id;
  return Object.freeze({
    documentId,
    documentName: document.name,
    documentType: "storage-wallet" as const,
    exact: preview.exact,
    ownerLabel,
    reason: preview.reason ?? "exact",
    searchText: `${document.name} ${ownerLabel}`,
    selectionKey: `storage-wallet:${documentId}`,
    sourceValue: state.invalidStoredWallet
      ? game.i18n.localize("D6E2.Currency.InvalidStoredWallet")
      : walletDisplay(preview.source),
    targetValue: preview.target ? walletDisplay(preview.target) : "",
  });
}

function hasPendingCurrencyTransfer(): boolean {
  const wallets = (game.actors?.contents ?? []).flatMap((actor) => {
    if (actor.type === "character") return [actorCurrencyWalletState(actor)];
    if (
      STORAGE_ROOT_TYPES.has(actor.type) &&
      record(record(actor.system).storage).configured === true
    )
      return [storageCurrencyWalletState(actor)];
    return [];
  });
  for (const item of itemDocuments())
    if (record(record(item.system).storageInterior).configured === true)
      wallets.push(storageCurrencyWalletState(item));
  return wallets.some((state) =>
    Object.values(state.wallet.operationReceipts).some(
      ({ status }) => status === "pending-transfer",
    ),
  );
}

export function previewCurrentCurrencyMigrations(): D6CurrencyMigrationPreview {
  const rows: D6CurrencyMigrationRow[] = [];
  for (const actor of game.actors?.contents ?? []) {
    if (actor.type !== "character") continue;
    const state = actorCurrencyWalletState(actor);
    if (!state.stale && !state.unresolvedLegacy) continue;
    const preview = previewWalletMigration(actor);
    rows.push(
      Object.freeze({
        documentId: actor.id,
        documentName: actor.name,
        documentType: "actor-wallet" as const,
        exact: preview.exact,
        ownerLabel: actor.name,
        reason: preview.reason ?? "exact",
        searchText: `${actor.name} ${actor.name}`,
        selectionKey: `actor-wallet:${actor.id}`,
        sourceValue: state.invalidStoredWallet
          ? game.i18n.localize("D6E2.Currency.InvalidStoredWallet")
          : walletDisplay(preview.source),
        targetValue: preview.target ? walletDisplay(preview.target) : "",
      }),
    );
  }
  for (const actor of game.actors?.contents ?? []) {
    if (
      !STORAGE_ROOT_TYPES.has(actor.type) ||
      record(record(actor.system).storage).configured !== true
    )
      continue;
    const row = storageWalletRow(actor, actor.name);
    if (row) rows.push(row);
  }
  for (const item of itemDocuments()) {
    if (record(record(item.system).storageInterior).configured !== true)
      continue;
    const row = storageWalletRow(item, itemOwnerLabel(item));
    if (row) rows.push(row);
  }
  for (const item of itemDocuments()) {
    try {
      const preview = previewCurrencyValueMigration(item);
      if (
        preview.exact &&
        preview.source.definitionFingerprint ===
          preview.target?.definitionFingerprint
      )
        continue;
      const ownerLabel = itemOwnerLabel(item);
      rows.push(
        Object.freeze({
          documentId: item.uuid ?? item.id,
          documentName: item.name,
          documentType: "item-price" as const,
          exact: preview.exact,
          ownerLabel,
          reason: preview.reason ?? "exact",
          searchText: `${item.name} ${ownerLabel}`,
          selectionKey: `item-price:${item.uuid ?? item.id}`,
          sourceValue: valueDisplay(preview.source),
          targetValue: preview.target ? valueDisplay(preview.target) : "",
        }),
      );
    } catch {
      // Invalid legacy records remain visible in their original system.value field.
    }
  }
  const definition = currentCurrencyDefinition();
  return Object.freeze({
    definitionFingerprint: currencyDefinitionFingerprint(definition),
    rows: Object.freeze(rows),
  });
}

export async function applyCurrentCurrencyMigrations(
  expected: D6CurrencyMigrationPreview,
  selectedMigrationKeys: readonly string[],
): Promise<readonly D6CurrencyMigrationRow[]> {
  return runGridStorageAuthorityEffect(async () => {
    if (!game.user?.isGM) throw new Error("D6E2.Economy.Error.NotAuthorized");
    if (hasPendingCurrencyTransfer())
      throw new Error("D6E2.Economy.Error.StaleBalance");
    const current = previewCurrentCurrencyMigrations();
    if (current.definitionFingerprint !== expected.definitionFingerprint)
      throw new Error("D6E2.Economy.Error.StaleDefinition");
    const expectedRows = JSON.stringify(expected.rows);
    if (JSON.stringify(current.rows) !== expectedRows)
      throw new Error("D6E2.Economy.Error.StaleBalance");
    const selected = new Set(selectedMigrationKeys);
    if (selected.size !== selectedMigrationKeys.length)
      throw new Error("D6E2.Economy.Error.DuplicateRequest");
    const exactKeys = new Set(
      current.rows.filter((row) => row.exact).map((row) => row.selectionKey),
    );
    if ([...selected].some((key) => !exactKeys.has(key)))
      throw new Error("D6E2.Economy.Error.StaleBalance");
    const applied: D6CurrencyMigrationRow[] = [];
    for (const row of current.rows) {
      if (!row.exact || !selected.has(row.selectionKey)) continue;
      if (row.documentType === "actor-wallet") {
        const actor = game.actors?.get(row.documentId);
        if (!actor) continue;
        const target = previewWalletMigration(actor).target;
        if (!target) continue;
        await actor.update(currencyWalletChanges(target));
        applied.push(row);
        continue;
      }
      const document = await fromUuid(row.documentId);
      if (!document || typeof document !== "object" || !("update" in document))
        continue;
      if (row.documentType === "storage-wallet") {
        const holder = document as FoundryActorDocument | FoundryItemDocument;
        const state = storageCurrencyWalletState(holder);
        const target = previewCurrencyWalletStateMigration(state).target;
        if (!target) continue;
        const storedInstanceId = record(holder.system).storageInstanceId;
        const containerParent =
          "parent" in holder &&
          (holder as { readonly parent?: unknown }).parent;
        const reference = containerParent
          ? containerCurrencyHolderRef(
              typeof storedInstanceId === "string" ? storedInstanceId : "",
            )
          : rootCurrencyHolderRef(
              holder as FoundryActorDocument & { readonly uuid: string },
            );
        await writeCurrencyHolderWalletMigration(
          reference,
          currencyWalletFingerprint(state.wallet),
          target,
        );
        applied.push(row);
        continue;
      }
      const target = previewCurrencyValueMigration(
        document as FoundryItemDocument,
      ).target;
      if (!target) continue;
      await (document as FoundryItemDocument).update({
        "system.currencyValue": mutableCurrencyDocumentSource(
          target satisfies D6CurrencyValueV1,
        ),
      });
      applied.push(row);
    }
    return Object.freeze(applied);
  });
}

export async function openCurrencyMigrationDialog(): Promise<boolean> {
  if (!game.user?.isGM) throw new Error("D6E2.Economy.Error.NotAuthorized");
  const preview = previewCurrentCurrencyMigrations();
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/settings/currency-migration-preview.hbs`,
    {
      exactCount: preview.rows.filter((row) => row.exact).length,
      rows: preview.rows,
      unresolvedCount: preview.rows.filter((row) => !row.exact).length,
    },
  );
  const selected = await foundry.applications.api.DialogV2.wait<
    readonly string[] | null
  >({
    buttons: [
      {
        action: "cancel",
        callback: () => null,
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "apply",
        callback: (_event, button) => {
          const form = button.form;
          if (!form) return [];
          return new FormData(form)
            .getAll("selectedMigration")
            .flatMap((entry) => (typeof entry === "string" ? [entry] : []));
        },
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-check",
        label: game.i18n.localize("D6E2.CurrencyMigration.ApplyExact"),
      },
    ],
    classes: ["d6e2", "od6roll-dialog", "d6e2-currency-migration-dialog"],
    content,
    modal: true,
    position: { width: 620 },
    rejectClose: false,
    render: (_event, dialog) => {
      const root = (dialog as { readonly element?: HTMLElement }).element;
      if (!root) return;
      const filter = root.querySelector<HTMLInputElement>(
        "[data-currency-migration-filter]",
      );
      const rows = Array.from(
        root.querySelectorAll<HTMLElement>("[data-currency-migration-search]"),
      );
      const empty = root.querySelector<HTMLElement>(
        "[data-currency-migration-empty]",
      );
      const status = root.querySelector<HTMLElement>(
        "[data-currency-migration-status]",
      );
      const update = (): void => {
        const query = filter?.value.trim().toLocaleLowerCase() ?? "";
        let shown = 0;
        for (const row of rows) {
          const matches =
            query.length === 0 ||
            (row.dataset.currencyMigrationSearch ?? "")
              .toLocaleLowerCase()
              .includes(query);
          row.hidden = !matches;
          if (matches) shown += 1;
        }
        const selected = root.querySelectorAll<HTMLInputElement>(
          'input[name="selectedMigration"]:checked',
        ).length;
        if (empty) empty.hidden = query.length === 0 || shown > 0;
        if (status)
          status.textContent = game.i18n.format(
            "D6E2.CurrencyMigration.FilterStatus",
            { selected, shown, total: rows.length },
          );
      };
      filter?.addEventListener("input", update);
      filter?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        event.stopPropagation();
      });
      root.addEventListener("change", (event) => {
        const target = event.target as HTMLInputElement | null;
        if (target?.name === "selectedMigration") update();
      });
      update();
    },
    window: {
      icon: "fa-solid fa-coins",
      title: game.i18n.localize("D6E2.CurrencyMigration.Title"),
    },
  });
  if (selected === null) return false;
  await applyCurrentCurrencyMigrations(preview, selected);
  return true;
}
