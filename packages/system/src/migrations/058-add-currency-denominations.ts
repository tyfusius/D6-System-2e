import {
  createCurrencyWallet,
  exactLegacyCurrencyValue,
  type ActorSource,
  type D6CurrencyDefinitionV1,
  type D6CurrencyValueV1,
  type D6CurrencyWalletV1,
  type ItemSource,
  type Migration,
} from "@d6-system-2e/core";
import { isD6EquipmentItemType } from "../equipment-item-types";

export const LEGACY_CURRENCY_DEFINITION: D6CurrencyDefinitionV1 = Object.freeze(
  {
    denominations: Object.freeze([
      Object.freeze({
        displayPrecision: 0,
        id: "currency",
        pluralName: "Currency",
        ratioToParent: "1",
        singularName: "Currency",
        symbol: "",
      }),
    ]),
    id: "default-currency",
    revision: 1,
    version: 1,
  },
);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function preservedDecimal(value: unknown): string {
  return typeof value === "number" || typeof value === "string"
    ? String(value)
    : "";
}

/** Foundry's DataModel cleaner mutates source objects during initialization. */
export function mutableCurrencyDocumentSource<
  T extends D6CurrencyValueV1 | D6CurrencyWalletV1,
>(value: T): T {
  return structuredClone(value);
}

export function addCurrencyWalletDefault(source: ActorSource): void {
  if (source.type !== "character") return;
  const profile = record(source.system.profile);
  if (Object.keys(record(profile.currencyWallet)).length > 0) return;
  const raw = profile.currency;
  if (typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0) {
    profile.currencyWallet = mutableCurrencyDocumentSource(
      createCurrencyWallet(LEGACY_CURRENCY_DEFINITION, {
        currency: raw.toString(),
      }),
    );
  } else {
    profile.currencyWallet = mutableCurrencyDocumentSource({
      ...createCurrencyWallet(LEGACY_CURRENCY_DEFINITION),
      legacyDecimal: preservedDecimal(raw),
      status: "unresolved-legacy" as const,
    });
  }
  source.system.profile = profile;
}

export function addCurrencyValueDefault(source: ItemSource): void {
  if (!isD6EquipmentItemType(source.type)) return;
  if (Object.keys(record(source.system.currencyValue)).length > 0) return;
  source.system.currencyValue = mutableCurrencyDocumentSource(
    exactLegacyCurrencyValue(LEGACY_CURRENCY_DEFINITION, source.system.value),
  );
}

export const addCurrencyDenominationsMigration: Migration = Object.freeze({
  name: "Add exact denomination wallets and prices while preserving legacy values",
  updateActor: addCurrencyWalletDefault,
  updateItem: addCurrencyValueDefault,
  version: 58,
});
