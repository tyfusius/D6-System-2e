import { describe, expect, it } from "vitest";
import {
  createCurrencyWallet,
  currencyDefinitionFingerprint,
  type D6CurrencyDefinitionV1,
} from "@d6-system-2e/core";
import { LEGACY_CURRENCY_DEFINITION } from "../migrations/058-add-currency-denominations";
import {
  expandedSourcePaths,
  explicitSystemSourcePaths,
  hasPreservedActorSource,
  isCompendiumImport,
  newCharacterCreationDefaults,
  newCharacterCurrencyDefaults,
  newCharacterResourceDefaults,
} from "./actor-defaults";

describe("explicit Actor system source preservation", () => {
  it("treats only a populated compendium UUID as an import", () => {
    expect(isCompendiumImport(null)).toBe(false);
    expect(isCompendiumImport("")).toBe(false);
    expect(isCompendiumImport("Compendium.module.pack.Actor.id")).toBe(true);
  });

  it("preserves currency identity for compendium, duplicate, and JSON sources", () => {
    expect(hasPreservedActorSource({})).toBe(false);
    expect(hasPreservedActorSource({ duplicateSource: "Actor.existing" })).toBe(
      true,
    );
    expect(
      hasPreservedActorSource({
        exportSource: { coreVersion: "14.367", world: "western-1876" },
      }),
    ).toBe(true);
    expect(
      hasPreservedActorSource({
        compendiumSource: "Compendium.module.pack.Actor.id",
      }),
    ).toBe(true);
  });

  it("reapplies only caller-provided leaves after creation defaults", () => {
    expect(
      explicitSystemSourcePaths({
        bestiary: { applied: true, sourceBook: "Licensed source" },
        resources: { magicPoints: { initialized: true, value: 10 } },
        scale: 3,
      }),
    ).toEqual({
      "system.bestiary.applied": true,
      "system.bestiary.sourceBook": "Licensed source",
      "system.resources.magicPoints.initialized": true,
      "system.resources.magicPoints.value": 10,
      "system.scale": 3,
    });
  });

  it("expands dotted creation paths before Foundry source updates", () => {
    expect(
      expandedSourcePaths({
        "system.bestiary.sourceBook": "Licensed source",
        "system.resources.heroPoints.value": 2,
        "system.scale": 3,
      }),
    ).toEqual({
      system: {
        bestiary: { sourceBook: "Licensed source" },
        resources: { heroPoints: { value: 2 } },
        scale: 3,
      },
    });
  });
});

describe("new character resource defaults", () => {
  const heroic = {
    heroPointStrategy: "heroic" as const,
    primaryResource: "heroPoints" as const,
  };
  const classic = {
    heroPointStrategy: "classic" as const,
    primaryResource: "experiencePoints" as const,
  };
  const openD6 = {
    heroPointStrategy: null,
    primaryResource: "characterPoints" as const,
  };
  const d6mv = {
    id: "d6mv.meta-currency.hero-and-skill-points" as const,
    heroPointStrategy: "heroic" as const,
    primaryResource: "heroPoints" as const,
  };

  it("uses the Second Edition Hero Point setting", () => {
    expect(newCharacterResourceDefaults(heroic, () => 3)).toEqual({
      "system.resources.heroPoints.value": 3,
    });
  });

  it("starts superheroic characters with the printed three Hero Points", () => {
    expect(newCharacterResourceDefaults(heroic, () => 1, true)).toEqual({
      "system.resources.heroPoints.value": 3,
    });
  });

  it("starts D6MV characters with six Hero Points", () => {
    expect(newCharacterResourceDefaults(d6mv, () => 1)).toEqual({
      "system.resources.heroPoints.value": 6,
    });
  });

  it("uses First Edition Character and Fate Point settings", () => {
    expect(
      newCharacterResourceDefaults(openD6, (key) =>
        key.includes("Character") ? 9 : 2,
      ),
    ).toEqual({
      "system.resources.characterPoints.value": 9,
      "system.resources.fatePoints.value": 2,
    });
  });

  it("starts Classic characters with one shared zero Experience Point balance", () => {
    expect(newCharacterResourceDefaults(classic, () => 5)).toEqual({
      "system.resources.experiencePoints.value": 0,
    });
  });

  it("clamps configured resources to non-negative integers", () => {
    expect(newCharacterResourceDefaults(heroic, () => -2.5)).toEqual({
      "system.resources.heroPoints.value": 0,
    });
  });
});

describe("new character creation defaults", () => {
  it("starts a new native Second Edition character in creation", () => {
    expect(newCharacterCreationDefaults("character", false)).toEqual({
      "system.creation.active": true,
      "system.creation.specializationSlots": 0,
    });
  });

  it("starts a new native OpenD6 character in creation", () => {
    expect(newCharacterCreationDefaults("character", false)).toEqual({
      "system.creation.active": true,
      "system.creation.specializationSlots": 0,
    });
  });

  it("does not activate creation for imports or NPCs", () => {
    expect(newCharacterCreationDefaults("character", true)).toEqual({});
    expect(newCharacterCreationDefaults("npc", false)).toEqual({});
  });
});

describe("new character currency defaults", () => {
  const western1876: D6CurrencyDefinitionV1 = {
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
    id: "western-1876-dollar",
    revision: 1,
    version: 1,
  };

  it("replaces a native creation's initialized empty wallet with the active definition", () => {
    const changes = newCharacterCurrencyDefaults(
      "character",
      false,
      {},
      {
        profile: {
          currency: 0,
          currencyWallet: {},
        },
      },
      western1876,
    );
    expect(changes).toMatchObject({
      "system.profile.currencyWallet": {
        counts: { cent: "0", dollar: "0" },
        definitionFingerprint: currencyDefinitionFingerprint(western1876),
        definitionId: "western-1876-dollar",
        definitionRevision: 1,
        status: "active",
      },
    });
  });

  it("also recognizes a value-neutral legacy wallet synthesized before the hook", () => {
    expect(
      newCharacterCurrencyDefaults(
        "character",
        false,
        {},
        {
          profile: {
            currency: 0,
            currencyWallet: createCurrencyWallet(LEGACY_CURRENCY_DEFINITION),
          },
        },
        western1876,
      ),
    ).toMatchObject({
      "system.profile.currencyWallet": {
        counts: { cent: "0", dollar: "0" },
        definitionId: "western-1876-dollar",
      },
    });
  });

  it("preserves supplied current wallets and skips imports and other Actor types", () => {
    const supplied = createCurrencyWallet(western1876, { dollar: "12" });
    const system = {
      profile: { currency: 12, currencyWallet: supplied },
    };
    expect(
      newCharacterCurrencyDefaults(
        "character",
        false,
        system,
        system,
        western1876,
      ),
    ).toEqual({});
    expect(
      newCharacterCurrencyDefaults(
        "character",
        true,
        system,
        system,
        western1876,
      ),
    ).toEqual({});
    expect(
      newCharacterCurrencyDefaults("npc", false, system, system, western1876),
    ).toEqual({});
  });

  it("preserves an ambiguous supplied nonzero historical wallet", () => {
    expect(
      newCharacterCurrencyDefaults(
        "character",
        false,
        {
          profile: {
            currency: 1000,
            currencyWallet: createCurrencyWallet(LEGACY_CURRENCY_DEFINITION, {
              currency: "1000",
            }),
          },
        },
        {
          profile: {
            currency: 1000,
            currencyWallet: createCurrencyWallet(LEGACY_CURRENCY_DEFINITION, {
              currency: "1000",
            }),
          },
        },
        western1876,
      ),
    ).toEqual({});
  });

  it("preserves a nonzero scalar even when no initialized wallet is present", () => {
    expect(
      newCharacterCurrencyDefaults(
        "character",
        false,
        {},
        { profile: { currency: 1000, currencyWallet: {} } },
        western1876,
      ),
    ).toEqual({});
  });

  it("preserves an explicitly supplied zero historical wallet", () => {
    const supplied = {
      profile: {
        currency: 0,
        currencyWallet: createCurrencyWallet(LEGACY_CURRENCY_DEFINITION),
      },
    };
    expect(
      newCharacterCurrencyDefaults(
        "character",
        false,
        supplied,
        supplied,
        western1876,
      ),
    ).toEqual({});
  });
});
