import { describe, expect, it } from "vitest";
import { synchronizedCurrencyPluralName } from "./currency-name-sync";

const placeholders = [
  { pluralName: "Currency", singularName: "Currency" },
  {
    pluralName: "New denominations",
    singularName: "New denomination",
  },
] as const;

describe("currency denomination name synchronization", () => {
  it("replaces untouched placeholder plurals when a singular name is authored", () => {
    expect(
      synchronizedCurrencyPluralName(
        placeholders[0],
        "Dollar",
        "Currency",
        placeholders,
      ),
    ).toBe("Dollars");
    expect(
      synchronizedCurrencyPluralName(
        placeholders[1],
        "Cent",
        "New denominations",
        placeholders,
      ),
    ).toBe("Cents");
  });

  it("preserves an explicitly authored plural", () => {
    expect(
      synchronizedCurrencyPluralName(
        placeholders[0],
        "Dollar",
        "Bucks",
        placeholders,
      ),
    ).toBe("Bucks");
  });

  it("does not rewrite a plural after the default placeholder is gone", () => {
    expect(
      synchronizedCurrencyPluralName(
        { pluralName: "Dollars", singularName: "Dollar" },
        "Credit",
        "Dollars",
        placeholders,
      ),
    ).toBe("Dollars");
  });
});
