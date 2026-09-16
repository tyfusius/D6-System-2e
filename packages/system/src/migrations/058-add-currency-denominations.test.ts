import { describe, expect, it } from "vitest";
import {
  createCurrencyWallet,
  type ActorSource,
  type D6CurrencyDefinitionV1,
  type D6CurrencyValueV1,
  type ItemSource,
} from "@d6-system-2e/core";
import {
  addCurrencyValueDefault,
  addCurrencyWalletDefault,
  LEGACY_CURRENCY_DEFINITION,
} from "./058-add-currency-denominations";
import { D6_EQUIPMENT_ITEM_TYPES } from "../equipment-item-types";

describe("migration 058 exact currency persistence", () => {
  it("copies a legacy integer balance into the one-unit wallet without removing it", () => {
    const actor = {
      items: [],
      system: { profile: { currency: 1876 } },
      type: "character",
    } as unknown as ActorSource;
    addCurrencyWalletDefault(actor);
    expect(actor.system.profile).toMatchObject({
      currency: 1876,
      currencyWallet: {
        counts: { currency: "1876" },
        status: "active",
        totalSmallestUnit: "1876",
      },
    });
  });

  it("hands Foundry recursively mutable sources while domain values stay immutable", () => {
    const immutableWallet = createCurrencyWallet(LEGACY_CURRENCY_DEFINITION, {
      currency: "5",
    });
    expect(Object.isFrozen(immutableWallet)).toBe(true);
    expect(Object.isFrozen(immutableWallet.counts)).toBe(true);

    const actor = {
      items: [],
      system: { profile: { currency: 5 } },
      type: "character",
    } as unknown as ActorSource;
    const item = {
      system: { value: 0.25 },
      type: "gear",
    } as unknown as ItemSource;
    addCurrencyWalletDefault(actor);
    addCurrencyValueDefault(item);
    const wallet = (actor.system.profile as { currencyWallet: unknown })
      .currencyWallet as {
      counts: Record<string, string>;
      definition: D6CurrencyDefinitionV1;
    };
    const value = item.system.currencyValue as {
      amountSmallestUnit: string;
      definition: D6CurrencyValueV1["definition"];
    };

    expect(Object.isFrozen(wallet)).toBe(false);
    expect(Object.isFrozen(wallet.counts)).toBe(false);
    expect(Object.isFrozen(wallet.definition.denominations)).toBe(false);
    expect(Object.isFrozen(value)).toBe(false);
    expect(Object.isFrozen(value.definition)).toBe(false);
    expect(() => {
      wallet.counts = { ...wallet.counts };
      value.definition = { ...value.definition };
    }).not.toThrow();
  });

  it("preserves a fractional legacy price and marks it unresolved instead of rounding", () => {
    const item = {
      system: { value: 0.25 },
      type: "gear",
    } as unknown as ItemSource;
    addCurrencyValueDefault(item);
    expect(item.system.value).toBe(0.25);
    expect(item.system.currencyValue).toMatchObject({
      amountSmallestUnit: "0",
      legacyDecimal: "0.25",
      status: "unresolved-legacy",
    });
  });

  it("does not certify an unsafe numeric legacy price as exact", () => {
    const item = {
      system: { value: Number.MAX_SAFE_INTEGER + 1 },
      type: "gear",
    } as unknown as ItemSource;
    addCurrencyValueDefault(item);
    expect(item.system.currencyValue).toMatchObject({
      amountSmallestUnit: "0",
      status: "unresolved-legacy",
    });
  });

  it("adds price state to every equipment type supported by immediate editing", () => {
    for (const type of D6_EQUIPMENT_ITEM_TYPES) {
      const item = { system: { value: 2 }, type } as unknown as ItemSource;
      addCurrencyValueDefault(item);
      expect(item.system.currencyValue).toMatchObject({
        amountSmallestUnit: "2",
        status: "active",
      });
    }
  });

  it("is idempotent and never replaces already-authored wallet or price records", () => {
    const actor = {
      items: [],
      system: { profile: { currency: 5, currencyWallet: { authored: true } } },
      type: "character",
    } as unknown as ActorSource;
    const item = {
      system: { currencyValue: { authored: true }, value: 2.5 },
      type: "weapon",
    } as unknown as ItemSource;
    addCurrencyWalletDefault(actor);
    addCurrencyValueDefault(item);
    expect(actor.system.profile).toMatchObject({
      currency: 5,
      currencyWallet: { authored: true },
    });
    expect(item.system).toMatchObject({
      currencyValue: { authored: true },
      value: 2.5,
    });
  });
});
