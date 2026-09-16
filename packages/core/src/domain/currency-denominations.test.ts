import { describe, expect, it } from "vitest";
import type {
  D6CurrencyDefinitionV1,
  D6CurrencyOperationReceiptV1,
} from "../contracts/currency-denominations";
import {
  createCurrencyWallet,
  currencyDefinitionFingerprint,
  currencyWalletFingerprint,
  currencyUnitFactors,
  exactLegacyCurrencyValue,
  planCurrencyExchange,
  planCurrencyHolderTransfer,
  planCurrencyValueMigration,
  planCurrencyWalletMigration,
} from "./currency-denominations";

function definition(
  revision = 1,
  ratios: readonly [string, string][] = [
    ["dollar", "1"],
    ["cent", "100"],
  ],
): D6CurrencyDefinitionV1 {
  return {
    denominations: ratios.map(([id, ratioToParent]) => ({
      displayPrecision: 0,
      id,
      pluralName: `${id}s`,
      ratioToParent,
      singularName: id,
      symbol: id === "dollar" ? "$" : "¢",
    })),
    id: "table-currency",
    revision,
    version: 1,
  };
}

describe("exact currency denomination math", () => {
  it("composes a multilevel chain without floating point", () => {
    const fantasy = definition(1, [
      ["gold", "1"],
      ["silver", "100"],
      ["bronze", "20"],
    ]);
    expect(currencyUnitFactors(fantasy)).toEqual({
      bronze: 1n,
      gold: 2_000n,
      silver: 20n,
    });
    expect(
      createCurrencyWallet(fantasy, { bronze: "7", gold: "2", silver: "3" })
        .totalSmallestUnit,
    ).toBe("4067");
  });

  it("keeps a one-unit wallet and integer legacy balance compatible", () => {
    const credits = definition(1, [["credit", "1"]]);
    const wallet = createCurrencyWallet(credits, { credit: "1876" });
    expect(wallet.counts).toEqual({ credit: "1876" });
    expect(wallet.totalSmallestUnit).toBe("1876");
    expect(exactLegacyCurrencyValue(credits, 12)).toMatchObject({
      amountSmallestUnit: "12",
      status: "active",
    });
  });

  it("keeps label-only edits value-compatible and fingerprints structural edits", () => {
    const dollars = definition();
    const relabeled = {
      ...dollars,
      denominations: dollars.denominations.map((entry) => ({
        ...entry,
        pluralName: `New ${entry.pluralName}`,
        singularName: `New ${entry.singularName}`,
        symbol: "¤",
      })),
    };
    expect(currencyDefinitionFingerprint(relabeled)).toBe(
      currencyDefinitionFingerprint(dollars),
    );
    expect(
      currencyDefinitionFingerprint({
        ...dollars,
        denominations: dollars.denominations.map((entry, index) =>
          index === 1 ? { ...entry, ratioToParent: "20" } : entry,
        ),
      }),
    ).not.toBe(currencyDefinitionFingerprint(dollars));
  });

  it("retains completed operation IDs beyond the former 64-entry window", () => {
    const dollars = definition();
    const ids = Array.from({ length: 65 }, (_, index) => `operation-${index}`);
    const wallet = createCurrencyWallet(dollars, {}, ids);
    expect(wallet.recentOperationIds).toEqual(ids);
  });

  it("allows opaque pending receipts while preserving legacy recovery metadata", () => {
    const dollars = definition();
    const receipt = {
      createdAt: 1_876,
      intent: "transfer-intent",
      recoveryRequest: '{"type":"currency-transfer"}',
      requesterUserId: "player-1",
      status: "pending-transfer" as const,
    };
    expect(
      createCurrencyWallet(dollars, {}, [], { "transfer-1": receipt })
        .operationReceipts["transfer-1"],
    ).toEqual(receipt);
    const opaqueReceipt = {
      createdAt: 1_877,
      intent: "a".repeat(64),
      status: "pending-transfer" as const,
    };
    expect(
      createCurrencyWallet(dollars, {}, [], { "transfer-2": opaqueReceipt })
        .operationReceipts["transfer-2"],
    ).toEqual(opaqueReceipt);
    expect(() =>
      createCurrencyWallet(dollars, {}, [], {
        "transfer-1": {
          intent: "transfer-intent",
          status: "pending-transfer",
        },
      } as unknown as Readonly<Record<string, D6CurrencyOperationReceiptV1>>),
    ).toThrow("currency.operation.receipt");
  });

  it("exchanges whole destination units and retains the exact source remainder", () => {
    const dollars = definition();
    const wallet = createCurrencyWallet(dollars, { cent: "287", dollar: "1" });
    const preview = planCurrencyExchange(dollars, wallet, {
      definitionFingerprint: currencyDefinitionFingerprint(dollars),
      definitionRevision: 1,
      expectedTotalSmallestUnit: "387",
      expectedWalletFingerprint: currencyWalletFingerprint(wallet),
      fromDenominationId: "cent",
      quantity: "250",
      requestId: "exchange-1",
      toDenominationId: "dollar",
      version: 1,
    });
    expect(preview).toMatchObject({
      exactValueSmallestUnit: "250",
      receivedCount: "2",
      remainderCount: "50",
      remainderSmallestUnit: "50",
    });
    expect(preview.after.counts).toEqual({ cent: "87", dollar: "3" });
    expect(preview.after.totalSmallestUnit).toBe("387");
  });

  it("rejects stale balances, stale rates, and exchanges with no whole destination unit", () => {
    const dollars = definition();
    const wallet = createCurrencyWallet(dollars, { cent: "99" });
    const base = {
      definitionFingerprint: currencyDefinitionFingerprint(dollars),
      definitionRevision: 1,
      expectedTotalSmallestUnit: "99",
      expectedWalletFingerprint: currencyWalletFingerprint(wallet),
      fromDenominationId: "cent",
      quantity: "99",
      requestId: "exchange-1",
      toDenominationId: "dollar",
      version: 1 as const,
    };
    expect(() => planCurrencyExchange(dollars, wallet, base)).toThrow(
      "currency.exchange.no-whole-destination-unit",
    );
    expect(() =>
      planCurrencyExchange(dollars, wallet, {
        ...base,
        expectedTotalSmallestUnit: "100",
      }),
    ).toThrow("currency.exchange.stale-balance");
    expect(() =>
      planCurrencyExchange(dollars, wallet, {
        ...base,
        definitionFingerprint: "stale",
      }),
    ).toThrow("currency.exchange.stale-definition");

    const reviewed = createCurrencyWallet(dollars, { cent: "100" });
    const sameTotalDifferentCounts = createCurrencyWallet(dollars, {
      dollar: "1",
    });
    expect(() =>
      planCurrencyExchange(dollars, sameTotalDifferentCounts, {
        ...base,
        expectedTotalSmallestUnit: "100",
        expectedWalletFingerprint: currencyWalletFingerprint(reviewed),
      }),
    ).toThrow("currency.exchange.stale-balance");
  });

  it("converts exact subunit prices and preserves nonrepresentable legacy fractions", () => {
    const dollars = definition();
    expect(exactLegacyCurrencyValue(dollars, "0.25")).toMatchObject({
      amountSmallestUnit: "25",
      status: "active",
    });
    expect(exactLegacyCurrencyValue(dollars, "0.001")).toMatchObject({
      amountSmallestUnit: "0",
      legacyDecimal: "0.001",
      status: "unresolved-legacy",
    });
    expect(
      exactLegacyCurrencyValue(dollars, Number.MAX_SAFE_INTEGER + 1),
    ).toMatchObject({
      legacyDecimal: String(Number.MAX_SAFE_INTEGER + 1),
      status: "unresolved-legacy",
    });
    expect(
      exactLegacyCurrencyValue(dollars, String(Number.MAX_SAFE_INTEGER + 1)),
    ).toMatchObject({ status: "active" });
  });

  it("moves one denomination exactly between distinct holders and rejects stale replay", () => {
    const dollars = definition();
    const source = createCurrencyWallet(dollars, {
      cent: "75",
      dollar: "3",
    });
    const target = createCurrencyWallet(dollars, {
      cent: "5",
      dollar: "1",
    });
    const request = {
      amount: "25",
      definitionFingerprint: source.definitionFingerprint,
      definitionRevision: source.definitionRevision,
      denominationId: "cent",
      expectedSourceTotalSmallestUnit: source.totalSmallestUnit,
      expectedSourceWalletFingerprint: currencyWalletFingerprint(source),
      expectedTargetTotalSmallestUnit: target.totalSmallestUnit,
      expectedTargetWalletFingerprint: currencyWalletFingerprint(target),
      source: {
        id: "Actor.source",
        kind: "root" as const,
        version: 1 as const,
      },
      target: {
        id: "pouch-a",
        kind: "container" as const,
        version: 1 as const,
      },
      version: 1 as const,
    };
    const plan = planCurrencyHolderTransfer(dollars, source, target, request);
    expect(plan).toMatchObject({
      amount: "25",
      denominationId: "cent",
      valueSmallestUnit: "25",
    });
    expect(plan.sourceAfter.counts).toEqual({ cent: "50", dollar: "3" });
    expect(plan.targetAfter.counts).toEqual({ cent: "30", dollar: "1" });
    expect(
      BigInt(plan.sourceAfter.totalSmallestUnit) +
        BigInt(plan.targetAfter.totalSmallestUnit),
    ).toBe(BigInt(source.totalSmallestUnit) + BigInt(target.totalSmallestUnit));
    expect(() =>
      planCurrencyHolderTransfer(dollars, plan.sourceAfter, target, request),
    ).toThrow("currency.holder-transfer.stale-balance");
    expect(() =>
      planCurrencyHolderTransfer(dollars, source, target, {
        ...request,
        target: request.source,
      }),
    ).toThrow("currency.holder-transfer.same-holder");
  });

  it("previews an exact definition revision migration and refuses a lossy one", () => {
    const oldDefinition = definition();
    const wallet = createCurrencyWallet(oldDefinition, {
      cent: "50",
      dollar: "1",
    });
    const finer = definition(2, [
      ["dollar", "1"],
      ["cent", "100"],
      ["mill", "10"],
    ]);
    const exact = planCurrencyWalletMigration(wallet, finer);
    expect(exact).toMatchObject({ exact: true });
    expect(exact.target?.counts).toEqual({
      cent: "50",
      dollar: "1",
      mill: "0",
    });
    expect(exact.target?.totalSmallestUnit).toBe("1500");

    const price = exactLegacyCurrencyValue(oldDefinition, "0.01");
    const thirds = definition(2, [
      ["dollar", "1"],
      ["third", "3"],
    ]);
    expect(planCurrencyValueMigration(price, thirds)).toMatchObject({
      exact: false,
      reason: "nonrepresentable-value",
    });

    const changedMain = {
      ...oldDefinition,
      denominations: oldDefinition.denominations.map((entry, index) =>
        index === 0 ? { ...entry, id: "foreign-credit" } : entry,
      ),
      revision: 2,
    };
    expect(planCurrencyWalletMigration(wallet, changedMain)).toMatchObject({
      exact: false,
    });
  });
});
