import { describe, expect, it } from "vitest";
import type { ActorSource, ItemSource } from "@d6-system-2e/core";
import {
  addContainerCurrencyHolder,
  addStorageRootCurrencyHolder,
} from "./059-add-storage-currency-holders";

describe("migration 059 storage currency holders", () => {
  it("adds an empty holder source to supported non-character roots only", () => {
    for (const type of ["vehicle", "starship", "storage-location"]) {
      const actor = { items: [], system: {}, type } as ActorSource;
      addStorageRootCurrencyHolder(actor);
      expect(actor.system.currencyWallet).toEqual({});
    }
    const character = {
      items: [],
      system: { profile: { currencyWallet: { existing: true } } },
      type: "character",
    } as unknown as ActorSource;
    addStorageRootCurrencyHolder(character);
    expect(character.system.currencyWallet).toBeUndefined();
  });

  it("adds storage only to configured equipment containers and preserves authored wallets", () => {
    const container = {
      system: { storageInterior: { configured: true } },
      type: "gear",
    } as unknown as ItemSource;
    addContainerCurrencyHolder(container);
    expect(container.system.currencyWallet).toEqual({});
    const ordinary = {
      system: { storageInterior: { configured: false } },
      type: "gear",
    } as unknown as ItemSource;
    addContainerCurrencyHolder(ordinary);
    expect(ordinary.system.currencyWallet).toBeUndefined();
    const authored = {
      system: {
        currencyWallet: { counts: { dollar: "7" } },
        storageInterior: { configured: true },
      },
      type: "gear",
    } as unknown as ItemSource;
    addContainerCurrencyHolder(authored);
    expect(authored.system.currencyWallet).toEqual({ counts: { dollar: "7" } });
  });
});
