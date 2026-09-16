import { afterEach, describe, expect, it, vi } from "vitest";
import {
  initializeEquipmentCurrencyValue,
  initializeEquipmentProvenance,
} from "./equipment-defaults";

afterEach(() => vi.unstubAllGlobals());

describe("new equipment provenance defaults", () => {
  it("inherits the selected campaign era for a new equipment Item", () => {
    vi.stubGlobal("game", {
      settings: { get: () => "modern" },
    });
    const updateSource = vi.fn<(changes: Record<string, unknown>) => void>();
    initializeEquipmentProvenance(
      { updateSource },
      { system: {}, type: "gear" },
    );
    const changes = updateSource.mock.calls[0]?.[0];
    expect(changes?.["system.equipmentProvenance"]).toMatchObject({
      era: "modern",
      catalogId: "",
      catalogVersion: 0,
    });
  });

  it("preserves explicit imported provenance and ignores other Items", () => {
    vi.stubGlobal("game", { settings: { get: () => "science-fiction" } });
    const updateSource = vi.fn<(changes: Record<string, unknown>) => void>();
    initializeEquipmentProvenance(
      { updateSource },
      {
        system: { equipmentProvenance: { era: "medieval" } },
        type: "weapon",
      },
    );
    initializeEquipmentProvenance(
      { updateSource },
      { system: {}, type: "skill" },
    );
    expect(updateSource).not.toHaveBeenCalled();
  });
});

describe("new equipment currency defaults", () => {
  it("initializes a newly created equipment price in the current value system", () => {
    vi.stubGlobal("game", {
      settings: {
        get: (_scope: string, key: string) =>
          key === "worldSettingProfileSelection"
            ? { profileId: "test" }
            : key === "worldSettingProfiles"
              ? {
                  version: 6,
                  activeProfileId: "test",
                  profiles: {
                    test: {
                      currency: {
                        denominations: [
                          {
                            displayPrecision: 0,
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
                        id: "test-money",
                        revision: 1,
                        version: 1,
                      },
                      id: "test",
                      version: 6,
                    },
                  },
                }
              : undefined,
      },
    });
    const updateSource = vi.fn<(changes: Record<string, unknown>) => void>();
    initializeEquipmentCurrencyValue(
      { system: { value: 0 }, updateSource },
      { system: { currencyValue: {}, value: 0 }, type: "gear" },
    );

    expect(updateSource).toHaveBeenCalledOnce();
    expect(
      updateSource.mock.calls[0]?.[0]["system.currencyValue"],
    ).toMatchObject({
      amountSmallestUnit: "0",
      definitionId: "test-money",
      status: "active",
    });
  });

  it("preserves supplied, imported, and already exact prices", () => {
    vi.stubGlobal("game", { settings: { get: () => undefined } });
    const updateSource = vi.fn<(changes: Record<string, unknown>) => void>();
    initializeEquipmentCurrencyValue(
      { system: { value: 0 }, updateSource },
      { system: { value: 25 }, type: "weapon" },
    );
    expect(
      updateSource.mock.calls[0]?.[0]["system.currencyValue"],
    ).toMatchObject({
      amountSmallestUnit: "25",
      definitionId: "default-currency",
    });
    updateSource.mockClear();
    initializeEquipmentCurrencyValue(
      { system: { value: 0 }, updateSource },
      {
        _stats: { compendiumSource: "Compendium.test.gear.Item.supplied" },
        system: {},
        type: "gear",
      },
    );
    expect(
      updateSource.mock.calls[0]?.[0]["system.currencyValue"],
    ).toMatchObject({
      amountSmallestUnit: "0",
      definitionId: "default-currency",
    });
    updateSource.mockClear();
    initializeEquipmentCurrencyValue(
      { system: { value: 0 }, updateSource },
      { system: { value: 0 }, type: "gear" },
      { d6System2eMigration: true },
    );
    expect(
      updateSource.mock.calls[0]?.[0]["system.currencyValue"],
    ).toMatchObject({
      amountSmallestUnit: "0",
      definitionId: "default-currency",
    });
    updateSource.mockClear();
    initializeEquipmentCurrencyValue(
      { system: { value: 0 }, updateSource },
      {
        system: { currencyValue: { amountSmallestUnit: "2500" }, value: 25 },
        type: "gear",
      },
    );
    expect(updateSource).not.toHaveBeenCalled();
  });
});
