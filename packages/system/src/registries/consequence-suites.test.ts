import { afterEach, describe, expect, it } from "vitest";
import {
  consequenceSuiteRegistry,
  resetConsequenceSuiteRegistryForTests,
  resolvedConsequenceSuite,
} from "./consequence-suites";

describe("consequence suite registry", () => {
  afterEach(resetConsequenceSuiteRegistryForTests);

  it("publishes the physical-only and FreeD6 multi-channel suites", () => {
    expect(
      resolvedConsequenceSuite(
        "free-d6.consequences.physical-and-fatigue",
      )?.channels.map(({ id }) => id),
    ).toEqual(["d6e2.consequence.physical", "free-d6.consequence.fatigue"]);
    expect(
      resolvedConsequenceSuite("d6e2.consequences.physical-only"),
    ).not.toBeNull();
  });

  it("keeps owner removal bounded and makes unavailable selections observable", () => {
    consequenceSuiteRegistry.register("provider", {
      channels: [
        {
          id: "provider.consequence.stress",
          kind: "counter",
          label: "Stress",
          penaltyStrategyId: "provider.penalty",
          recoveryStrategyId: "provider.recovery",
          resolutionStrategyId: "provider.resolution",
          terminalStrategyId: "provider.terminal",
        },
      ],
      id: "provider.consequences.stress",
      label: "Stress",
      stackingStrategyId: "provider.stacking",
      version: 1,
    });
    consequenceSuiteRegistry.unregisterOwner("provider");
    expect(resolvedConsequenceSuite("provider.consequences.stress")).toBeNull();
    expect(
      resolvedConsequenceSuite("free-d6.consequences.physical-and-fatigue"),
    ).not.toBeNull();
  });

  it("rejects duplicate channels and cross-owner replacement", () => {
    expect(() =>
      consequenceSuiteRegistry.register("provider", {
        channels: [
          {
            id: "provider.consequence.same",
            kind: "counter",
            label: "One",
            penaltyStrategyId: "provider.penalty",
            recoveryStrategyId: "provider.recovery",
            resolutionStrategyId: "provider.resolution",
            terminalStrategyId: "provider.terminal",
          },
          {
            id: "provider.consequence.same",
            kind: "counter",
            label: "Two",
            penaltyStrategyId: "provider.penalty",
            recoveryStrategyId: "provider.recovery",
            resolutionStrategyId: "provider.resolution",
            terminalStrategyId: "provider.terminal",
          },
        ],
        id: "provider.consequences.same",
        label: "Same",
        stackingStrategyId: "provider.stacking",
        version: 1,
      }),
    ).toThrow("duplicate channel IDs");
  });
});
