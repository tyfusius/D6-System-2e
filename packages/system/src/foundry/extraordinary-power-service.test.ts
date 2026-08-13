import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  extraordinaryPowerFrameworkRegistry,
  resetExtraordinaryPowerFrameworkRegistryForTests,
} from "../registries/extraordinary-powers";
import {
  activateExtraordinaryPower,
  bindExtraordinaryPowerItem,
  bindMatchingExtraordinaryPowerItems,
  bindExtraordinaryPowerSkill,
  deactivateExtraordinaryPower,
  readActorExtraordinaryPowers,
  setExtraordinaryPowerConsequence,
  unbindExtraordinaryPowerItem,
  unbindExtraordinaryPowerSkill,
} from "./extraordinary-power-service";

const rollQueue = vi.hoisted(() => [] as ({ success: boolean } | null)[]);
const rollSkill = vi.hoisted(() => vi.fn());
const difficultyDialog = vi.hoisted(() => vi.fn(() => Promise.resolve(17)));
vi.mock("./rolls/roll-service", () => ({
  rollExtraordinaryPowerSkill: rollSkill,
}));

function registerFramework(): void {
  extraordinaryPowerFrameworkRegistry.register("test-companion", {
    activation: {
      actionPenalty: "one-per-skill-check",
      strategy: "all-required-skills",
      usesWildDie: true,
    },
    id: "test.framework",
    label: "Test Framework",
    maintenance: {
      actionPenalty: "one-per-maintained-power",
      strategy: "active-toggle",
    },
    powers: [
      {
        checks: [{ difficulty: 10, skillRoleId: "focus" }],
        id: "test.prerequisite",
        label: "Prerequisite",
        maintenance: "none",
      },
      {
        checks: [
          { difficulty: 12, skillRoleId: "focus" },
          { difficulty: 15, skillRoleId: "shape" },
        ],
        id: "test.maintained",
        label: "Maintained",
        maintenance: "active-toggle",
        prerequisites: ["test.prerequisite"],
      },
    ],
    resourceRoles: [
      {
        binding: "actor-extension-number",
        extensionKey: "strain",
        id: "strain",
        kind: "consequence-track",
        label: "Strain",
      },
    ],
    skillRoles: [
      { id: "focus", label: "Focus" },
      { id: "shape", label: "Shape" },
    ],
    version: 1,
  });
}

function actor() {
  const items = new Map(
    [
      ["focus-skill", "Focus", "skill", 3],
      ["shape-skill", "Shape", "skill", 4],
      ["prerequisite-item", "Prerequisite", "manifestation", 0],
      ["maintained-item", "Maintained", "manifestation", 0],
    ].map(([id, name, type, score]) => [
      id,
      {
        id,
        name,
        system: {
          attributeId: "extranormal",
          key:
            id === "focus-skill"
              ? "test-focus"
              : id === "shape-skill"
                ? "test-shape"
                : id === "prerequisite-item"
                  ? "test.prerequisite"
                  : "test.maintained",
          score,
        },
        type,
      },
    ]),
  );
  const document = {
    id: "actor-1",
    isOwner: true,
    items: {
      contents: [...items.values()],
      get: (id: string) => items.get(id),
    },
    name: "Test Actor",
    system: {
      attributes: { extranormal: { score: 6 } },
      extraordinaryPowers: { frameworks: {} as Record<string, unknown> },
    },
    update: vi.fn((changes: Record<string, unknown>) => {
      const value = changes["system.extraordinaryPowers.frameworks"];
      if (typeof value === "object" && value !== null) {
        document.system.extraordinaryPowers.frameworks = value as Record<
          string,
          unknown
        >;
      }
      return Promise.resolve(document);
    }),
  };
  return document;
}

async function fullyBind(hero: ReturnType<typeof actor>): Promise<void> {
  await bindExtraordinaryPowerSkill(
    hero,
    "test.framework",
    "focus",
    "focus-skill",
  );
  await bindExtraordinaryPowerSkill(
    hero,
    "test.framework",
    "shape",
    "shape-skill",
  );
  await bindExtraordinaryPowerItem(
    hero,
    "test.framework",
    "test.prerequisite",
    "prerequisite-item",
  );
  await bindExtraordinaryPowerItem(
    hero,
    "test.framework",
    "test.maintained",
    "maintained-item",
  );
}

describe("extraordinary-power runtime", () => {
  beforeEach(() => {
    resetExtraordinaryPowerFrameworkRegistryForTests();
    registerFramework();
    rollQueue.length = 0;
    rollSkill.mockReset();
    rollSkill.mockImplementation(() =>
      Promise.resolve(rollQueue.shift() ?? null),
    );
    vi.stubGlobal("game", {
      i18n: {
        format: (key: string) => key,
        localize: (key: string) => key,
      },
    });
    vi.stubGlobal("foundry", {
      applications: {
        api: {
          DialogV2: { wait: difficultyDialog },
        },
      },
    });
  });
  afterEach(resetExtraordinaryPowerFrameworkRegistryForTests);

  it("persists explicit bindings and consequence values across reads", async () => {
    const hero = actor();
    await fullyBind(hero);
    const state = await setExtraordinaryPowerConsequence(
      hero,
      "test.framework",
      "strain",
      2,
    );
    expect(state.skillBindings).toMatchObject([
      { available: true, itemId: "focus-skill", roleId: "focus", score: 9 },
      { available: true, itemId: "shape-skill", roleId: "shape", score: 9 },
    ]);
    expect(state.resources[0]).toMatchObject({ id: "strain", value: 2 });
    expect(state.powers.every(({ available }) => available)).toBe(true);
    expect(readActorExtraordinaryPowers(hero, "test.framework")).toEqual(state);
    expect(hero.system.extraordinaryPowers.frameworks).toHaveProperty(
      "test%2Eframework",
    );
    const stored = hero.system.extraordinaryPowers.frameworks[
      "test%2Eframework"
    ] as { powerBindings: Record<string, string> };
    expect(stored.powerBindings).toHaveProperty(
      "test%2Eprerequisite",
      "prerequisite-item",
    );
  });

  it("binds matching embedded Skills and Manifestations by registered Item key", async () => {
    const hero = actor();
    extraordinaryPowerFrameworkRegistry.unregisterOwner("test-companion");
    extraordinaryPowerFrameworkRegistry.register("test-companion", {
      activation: {
        actionPenalty: "one-per-skill-check",
        strategy: "all-required-skills",
        usesWildDie: true,
      },
      id: "test.framework",
      label: "Test Framework",
      maintenance: {
        actionPenalty: "one-per-maintained-power",
        strategy: "active-toggle",
      },
      powers: [
        {
          checks: [{ difficulty: 10, skillRoleId: "focus" }],
          id: "test.prerequisite",
          label: "Prerequisite",
          maintenance: "none",
        },
      ],
      resourceRoles: [],
      skillRoles: [{ id: "focus", itemKey: "test-focus", label: "Focus" }],
      version: 1,
    });
    await expect(
      bindMatchingExtraordinaryPowerItems(hero, [
        "focus-skill",
        "prerequisite-item",
      ]),
    ).resolves.toBe(2);
    expect(readActorExtraordinaryPowers(hero, "test.framework")).toMatchObject({
      powers: [{ available: true, boundItemId: "prerequisite-item" }],
      skillBindings: [
        { available: true, itemId: "focus-skill", roleId: "focus" },
      ],
    });
  });

  it("requires every role and prerequisite binding", async () => {
    const hero = actor();
    await bindExtraordinaryPowerSkill(
      hero,
      "test.framework",
      "focus",
      "focus-skill",
    );
    await bindExtraordinaryPowerItem(
      hero,
      "test.framework",
      "test.maintained",
      "maintained-item",
    );
    await expect(
      activateExtraordinaryPower(hero, "test.framework", "test.maintained"),
    ).rejects.toThrow("D6E2.ExtraordinaryPower.BindingsRequired");
    expect(rollSkill).not.toHaveBeenCalled();
  });

  it("rolls all checks with one shared penalty and persists successful maintenance", async () => {
    const hero = actor();
    await fullyBind(hero);
    rollQueue.push({ success: true }, { success: true });
    const result = await activateExtraordinaryPower(
      hero,
      "test.framework",
      "test.maintained",
    );
    expect(result.activated).toBe(true);
    expect(result.state.maintainedPowerIds).toEqual(["test.maintained"]);
    expect(rollSkill).toHaveBeenNthCalledWith(
      1,
      hero,
      "focus-skill",
      expect.objectContaining({
        checkCount: 2,
        checkIndex: 1,
        frameworkPenaltyScore: 3,
      }),
      12,
      "Maintained",
    );
    await expect(
      activateExtraordinaryPower(hero, "test.framework", "test.maintained"),
    ).rejects.toThrow("D6E2.ExtraordinaryPower.AlreadyMaintained");
    expect(
      (
        await deactivateExtraordinaryPower(
          hero,
          "test.framework",
          "test.maintained",
        )
      ).maintainedPowerIds,
    ).toEqual([]);
  });

  it("stops on failure without persisting maintenance", async () => {
    const hero = actor();
    await fullyBind(hero);
    rollQueue.push({ success: false });
    const result = await activateExtraordinaryPower(
      hero,
      "test.framework",
      "test.maintained",
    );
    expect(result.activated).toBe(false);
    expect(result.state.maintainedPowerIds).toEqual([]);
    expect(rollSkill).toHaveBeenCalledOnce();
  });

  it("prompts for a variable difficulty before rolling", async () => {
    const hero = actor();
    extraordinaryPowerFrameworkRegistry.unregisterOwner("test-companion");
    extraordinaryPowerFrameworkRegistry.register("test-companion", {
      activation: {
        actionPenalty: "one-per-skill-check",
        strategy: "all-required-skills",
        usesWildDie: true,
      },
      id: "test.framework",
      label: "Test Framework",
      maintenance: {
        actionPenalty: "one-per-maintained-power",
        strategy: "active-toggle",
      },
      powers: [
        {
          checks: [
            {
              difficulty: 11,
              difficultyMode: "prompt",
              skillRoleId: "focus",
            },
          ],
          id: "test.prerequisite",
          label: "Variable Power",
          maintenance: "none",
        },
      ],
      resourceRoles: [],
      skillRoles: [{ id: "focus", label: "Focus" }],
      version: 1,
    });
    await bindExtraordinaryPowerSkill(
      hero,
      "test.framework",
      "focus",
      "focus-skill",
    );
    await bindExtraordinaryPowerItem(
      hero,
      "test.framework",
      "test.prerequisite",
      "prerequisite-item",
    );
    rollQueue.push({ success: true });
    await activateExtraordinaryPower(
      hero,
      "test.framework",
      "test.prerequisite",
    );
    expect(difficultyDialog).toHaveBeenCalledOnce();
    expect(rollSkill).toHaveBeenCalledWith(
      hero,
      "focus-skill",
      expect.any(Object),
      17,
      "Variable Power",
    );
  });

  it("clears bindings and deactivates maintained powers that become invalid", async () => {
    const hero = actor();
    await fullyBind(hero);
    rollQueue.push({ success: true }, { success: true });
    await activateExtraordinaryPower(hero, "test.framework", "test.maintained");

    const withoutSkill = await unbindExtraordinaryPowerSkill(
      hero,
      "test.framework",
      "shape",
    );
    expect(withoutSkill.maintainedPowerIds).toEqual([]);
    expect(withoutSkill.skillBindings[1]).toMatchObject({
      available: false,
      itemId: "",
      roleId: "shape",
    });

    const withoutPower = await unbindExtraordinaryPowerItem(
      hero,
      "test.framework",
      "test.maintained",
    );
    expect(
      withoutPower.powers.find(({ id }) => id === "test.maintained"),
    ).toMatchObject({ available: false, boundItemId: "" });
  });

  it("rejects non-owners and invalid consequence values", async () => {
    const hero = actor();
    hero.isOwner = false;
    await expect(
      bindExtraordinaryPowerSkill(
        hero,
        "test.framework",
        "focus",
        "focus-skill",
      ),
    ).rejects.toThrow("D6E2.ExtraordinaryPower.OwnerRequired");
    hero.isOwner = true;
    await expect(
      setExtraordinaryPowerConsequence(hero, "test.framework", "strain", -1),
    ).rejects.toThrow("nonnegative integer");
  });
});
