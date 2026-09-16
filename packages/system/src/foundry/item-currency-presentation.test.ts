import { describe, expect, it } from "vitest";
import {
  currencyDefinitionFingerprint,
  exactLegacyCurrencyValue,
  type D6CurrencyDefinitionV1,
} from "@d6-system-2e/core";
import { LEGACY_CURRENCY_DEFINITION } from "../migrations/058-add-currency-denominations";
import { itemCurrencyPresentation } from "./item-currency-presentation";

const dollars = {
  denominations: [
    {
      displayPrecision: 2,
      id: "dollar",
      pluralName: "Dollars",
      ratioToParent: "1",
      singularName: "Dollar",
      symbol: "$",
    },
    {
      displayPrecision: 0,
      id: "cent",
      pluralName: "Cents",
      ratioToParent: "100",
      singularName: "Cent",
      symbol: "¢",
    },
  ],
  id: "default-currency",
  revision: 2,
  version: 1,
} satisfies D6CurrencyDefinitionV1;

describe("Item currency presentation", () => {
  it("shows an active stale price with its stored amount and stored denomination", () => {
    const value = exactLegacyCurrencyValue(LEGACY_CURRENCY_DEFINITION, 100);
    expect(value.status).toBe("active");

    expect(
      itemCurrencyPresentation(
        { currentDefinition: dollars, stale: true, value },
        "",
      ),
    ).toMatchObject({
      denominationOptions: [
        { id: "currency", label: "Currency", selected: true },
      ],
      exactValueLabel: "100 Currency",
      inputAmount: "100",
      selectedDenominationId: "currency",
      stale: true,
      status: "active",
    });
  });

  it("uses the current definition after an exact migration", () => {
    const value = {
      amountSmallestUnit: "25",
      definition: dollars,
      definitionFingerprint: currencyDefinitionFingerprint(dollars),
      definitionId: dollars.id,
      definitionRevision: dollars.revision,
      status: "active" as const,
      version: 1 as const,
    };

    expect(
      itemCurrencyPresentation(
        { currentDefinition: dollars, stale: false, value },
        "",
      ),
    ).toMatchObject({
      denominationOptions: [
        { id: "dollar", label: "$ Dollars", selected: false },
        { id: "cent", label: "¢ Cents", selected: true },
      ],
      inputAmount: "25",
      selectedDenominationId: "cent",
      stale: false,
    });
  });
});
