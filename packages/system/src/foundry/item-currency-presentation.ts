import type {
  D6CurrencyDefinitionV1,
  D6CurrencyValueV1,
} from "@d6-system-2e/core";

export interface D6ItemCurrencyPresentation {
  readonly amountSmallestUnit: string;
  readonly denominationOptions: readonly {
    readonly id: string;
    readonly label: string;
    readonly selected: boolean;
  }[];
  readonly exactValueLabel: string;
  readonly inputAmount: string;
  readonly legacyDecimal: string;
  readonly selectedDenominationId: string;
  readonly stale: boolean;
  readonly status: D6CurrencyValueV1["status"];
}

export function itemCurrencyPresentation(
  state: {
    readonly currentDefinition: D6CurrencyDefinitionV1;
    readonly stale: boolean;
    readonly value: D6CurrencyValueV1;
  },
  legacyFallback: string,
): D6ItemCurrencyPresentation | null {
  const displayDefinition = state.stale
    ? state.value.definition
    : state.currentDefinition;
  const smallestDenomination = displayDefinition.denominations.at(-1);
  if (!smallestDenomination) return null;
  return Object.freeze({
    amountSmallestUnit: state.value.amountSmallestUnit,
    denominationOptions: Object.freeze(
      displayDefinition.denominations.map((entry) =>
        Object.freeze({
          id: entry.id,
          label: entry.symbol
            ? `${entry.symbol} ${entry.pluralName}`
            : entry.pluralName,
          selected: entry.id === smallestDenomination.id,
        }),
      ),
    ),
    exactValueLabel: `${state.value.amountSmallestUnit} ${smallestDenomination.pluralName}`,
    inputAmount:
      state.value.status === "active"
        ? state.value.amountSmallestUnit
        : (state.value.legacyDecimal ?? legacyFallback),
    legacyDecimal: state.value.legacyDecimal ?? "",
    selectedDenominationId: smallestDenomination.id,
    stale: state.stale,
    status: state.value.status,
  });
}
