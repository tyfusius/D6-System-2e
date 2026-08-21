import { afterEach, describe, expect, it, vi } from "vitest";
import {
  changesAttributeScore,
  changesProtectedCurrency,
  changesProtectedFirstEditionResource,
  changesProtectedSecondEditionAdvancementResource,
  changesRankedFeatureMechanics,
  changesSkillScore,
  characterSheetModeUpdateAuthorization,
  mayDirectEditMechanicalScore,
  registerMechanicalEditGuards,
  usesPersonalMechanicalEditGuard,
  withAuthorizedHealthUpdate,
  withAuthorizedDirectSheetResourceUpdate,
  withAuthorizedOpenD6ResourceUpdate,
  withAuthorizedSheetModeUpdate,
  withAuthorizedExtraordinaryPowerUpdate,
  withAuthorizedTemplateUpdate,
} from "./mechanical-edit-guard";

describe("mechanical score edit guards", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("recognizes flattened and nested attribute score changes", () => {
    expect(
      changesAttributeScore({ "system.attributes.agility.score": 10 }),
    ).toBe(true);
    expect(
      changesAttributeScore({
        system: { attributes: { agility: { score: 10 } } },
      }),
    ).toBe(true);
    expect(
      changesAttributeScore({
        system: { attributes: { agility: { label: "Agility" } } },
      }),
    ).toBe(false);
  });

  it("recognizes flattened and nested skill score changes", () => {
    expect(changesSkillScore({ "system.score": 4 })).toBe(true);
    expect(changesSkillScore({ system: { score: 4 } })).toBe(true);
    expect(changesSkillScore({ system: { description: "safe" } })).toBe(false);
  });

  it("recognizes ranked-feature creation values without treating prose as mechanics", () => {
    expect(changesRankedFeatureMechanics({ "system.rank": 2 })).toBe(true);
    expect(
      changesRankedFeatureMechanics({
        system: { cost: 2, repeatable: true },
      }),
    ).toBe(true);
    expect(
      changesRankedFeatureMechanics({ system: { focus: "Piloting" } }),
    ).toBe(false);
  });

  it("recognizes protected First Edition resource changes", () => {
    expect(
      changesProtectedFirstEditionResource({
        "system.resources.characterPoints.value": 3,
      }),
    ).toBe(true);
    expect(
      changesProtectedFirstEditionResource({
        system: { resources: { fatePoints: { value: 2 } } },
      }),
    ).toBe(true);
    expect(
      changesProtectedFirstEditionResource({
        system: { resources: { heroPoints: { value: 2 } } },
      }),
    ).toBe(false);
  });

  it("recognizes flattened and nested Experience Point changes", () => {
    expect(
      changesProtectedSecondEditionAdvancementResource({
        "system.resources.experiencePoints.value": 6,
      }),
    ).toBe(true);
    expect(
      changesProtectedSecondEditionAdvancementResource({
        system: { resources: { experiencePoints: { value: 4 } } },
      }),
    ).toBe(true);
    expect(
      changesProtectedSecondEditionAdvancementResource({
        system: { resources: { heroPoints: { value: 2 } } },
      }),
    ).toBe(false);
  });

  it("recognizes changed currency without treating an injected unchanged value as an edit", () => {
    const currentSystem = { profile: { currency: 25 } };
    expect(
      changesProtectedCurrency(
        { "system.profile.currency": 30 },
        currentSystem,
      ),
    ).toBe(true);
    expect(
      changesProtectedCurrency(
        { system: { profile: { currency: 25 } } },
        currentSystem,
      ),
    ).toBe(false);
  });

  it("ignores unchanged protected resources injected beside another Actor update", () => {
    const currentSystem = {
      resources: {
        characterPoints: { value: 5 },
        experiencePoints: { value: 0 },
        fatePoints: { value: 1 },
      },
    };
    const injectedResources = {
      system: {
        resources: {
          characterPoints: { value: 5 },
          experiencePoints: { value: 0 },
          fatePoints: { value: 1 },
        },
        sheetMode: { value: "advance" },
      },
    };
    expect(
      changesProtectedFirstEditionResource(injectedResources, currentSystem),
    ).toBe(false);
    expect(
      changesProtectedSecondEditionAdvancementResource(
        injectedResources,
        currentSystem,
      ),
    ).toBe(false);
    expect(
      changesProtectedFirstEditionResource(
        {
          system: {
            resources: {
              characterPoints: { value: 4 },
            },
          },
        },
        currentSystem,
      ),
    ).toBe(true);
  });

  it("allows direct mechanical edits only to a GM in Free Edit", () => {
    expect(mayDirectEditMechanicalScore("freeedit", true)).toBe(true);
    expect(mayDirectEditMechanicalScore("normal", true)).toBe(false);
    expect(mayDirectEditMechanicalScore("advance", true)).toBe(false);
    expect(mayDirectEditMechanicalScore("freeedit", false)).toBe(false);
  });

  it("authorizes only role-valid isolated character sheet mode updates", () => {
    expect(
      characterSheetModeUpdateAuthorization(
        { "system.sheetMode.value": "advance" },
        false,
      ),
    ).toBe(true);
    expect(
      characterSheetModeUpdateAuthorization(
        { system: { sheetMode: { value: "normal" } } },
        false,
      ),
    ).toBe(true);
    expect(
      characterSheetModeUpdateAuthorization(
        { system: { sheetMode: { value: "freeedit" } } },
        false,
      ),
    ).toBe(false);
    expect(
      characterSheetModeUpdateAuthorization(
        { system: { sheetMode: { value: "freeedit" } } },
        true,
      ),
    ).toBe(true);
    expect(
      characterSheetModeUpdateAuthorization(
        {
          system: {
            attributes: { agility: { score: 12 } },
            sheetMode: { value: "advance" },
          },
        },
        false,
      ),
    ).toBe(false);
  });

  it("admits Foundry-cleaned mode updates only when injected typed-model fields are unchanged", () => {
    const currentSystem = {
      advancement: { milestone: { skillPips: 2 } },
      creation: { active: false },
      resources: { experiencePoints: { value: 12 } },
      sheetMode: { value: "normal" },
    };
    const cleanedModeUpdate = {
      _id: "actor-id",
      system: {
        advancement: { milestone: { skillPips: 2 } },
        creation: { active: false },
        resources: { experiencePoints: { value: 12 } },
        sheetMode: { value: "freeedit" },
      },
    };
    expect(
      characterSheetModeUpdateAuthorization(
        cleanedModeUpdate,
        true,
        currentSystem,
      ),
    ).toBe(true);
    expect(
      characterSheetModeUpdateAuthorization(
        {
          ...cleanedModeUpdate,
          system: {
            ...cleanedModeUpdate.system,
            resources: { experiencePoints: { value: 11 } },
          },
        },
        true,
        currentSystem,
      ),
    ).toBe(false);
  });

  it("treats an injected unchanged mode as neutral during a real resource update", () => {
    const currentSystem = {
      resources: { experiencePoints: { value: 0 } },
      sheetMode: { value: "normal" },
    };
    expect(
      characterSheetModeUpdateAuthorization(
        {
          system: {
            resources: { experiencePoints: { value: 37 } },
            sheetMode: { value: "normal" },
          },
        },
        true,
        currentSystem,
      ),
    ).toBeUndefined();
  });

  it("routes a cleaned resource update past mode detection to its role guard", () => {
    type ActorGuard = (
      actor: unknown,
      changes: unknown,
      options: unknown,
      userId: unknown,
    ) => boolean | undefined;
    let actorGuard: ActorGuard | undefined;
    const users = new Map([
      ["player-1", { isGM: false }],
      ["gm-1", { isGM: true }],
    ]);
    vi.stubGlobal("Hooks", {
      on: (name: string, callback: unknown) => {
        if (name === "preUpdateActor") actorGuard = callback as ActorGuard;
      },
    });
    vi.stubGlobal("game", {
      user: { isGM: false },
      users: { get: (id: string) => users.get(id) },
    });
    registerMechanicalEditGuards();
    const actor = {
      system: {
        resources: { experiencePoints: { value: 0 } },
        sheetMode: { value: "normal" },
      },
      type: "character",
    } as unknown as FoundryActorDocument;
    const cleanedUpdate = {
      system: {
        resources: { experiencePoints: { value: 37 } },
        sheetMode: { value: "normal" },
      },
    };

    expect(actorGuard?.(actor, cleanedUpdate, {}, "player-1")).toBe(false);
    expect(actorGuard?.(actor, cleanedUpdate, {}, "gm-1")).toBeUndefined();
  });

  it("admits only the scoped GM sheet resource transaction", async () => {
    type ActorGuard = (
      actor: unknown,
      changes: unknown,
      options: unknown,
      userId: unknown,
    ) => boolean | undefined;
    let actorGuard: ActorGuard | undefined;
    vi.stubGlobal("Hooks", {
      on: (name: string, callback: unknown) => {
        if (name === "preUpdateActor") actorGuard = callback as ActorGuard;
      },
    });
    vi.stubGlobal("game", {
      user: { isGM: true },
      users: { get: () => ({ isGM: true }) },
    });
    registerMechanicalEditGuards();
    const actor = {
      system: {
        attributes: { brawn: { score: 12 } },
        resources: { experiencePoints: { value: 0 } },
        sheetMode: { value: "normal" },
      },
      type: "character",
    } as unknown as FoundryActorDocument;
    const cleanedUpdate = {
      system: {
        attributes: { brawn: { score: 12 } },
        resources: { experiencePoints: { value: 37 } },
        sheetMode: { value: "normal" },
      },
    };

    expect(actorGuard?.(actor, cleanedUpdate, {}, "gm-1")).toBe(false);
    await withAuthorizedDirectSheetResourceUpdate(actor, () => {
      expect(actorGuard?.(actor, cleanedUpdate, {}, "gm-1")).toBeUndefined();
      return Promise.resolve();
    });
    expect(actorGuard?.(actor, cleanedUpdate, {}, "gm-1")).toBe(false);
  });

  it("admits only the system-scoped mode transaction after Foundry cleans it", async () => {
    type ActorGuard = (
      actor: unknown,
      changes: unknown,
      options: unknown,
      userId: unknown,
    ) => boolean | undefined;
    let actorGuard: ActorGuard | undefined;
    vi.stubGlobal("Hooks", {
      on: (name: string, callback: unknown) => {
        if (name === "preUpdateActor") actorGuard = callback as ActorGuard;
      },
    });
    vi.stubGlobal("game", {
      user: { isGM: true },
      users: { get: () => ({ isGM: true }) },
    });
    registerMechanicalEditGuards();
    const actor = {
      system: {
        attributes: { brawn: { score: 12 } },
        sheetMode: { value: "freeedit" },
      },
      type: "character",
    } as unknown as FoundryActorDocument;
    const cleanedUpdate = {
      system: {
        attributes: { brawn: { score: 13 } },
        sheetMode: { value: "normal" },
      },
    };

    expect(actorGuard?.(actor, cleanedUpdate, {}, "gm-1")).toBe(false);
    await withAuthorizedSheetModeUpdate(actor, () => {
      expect(actorGuard?.(actor, cleanedUpdate, {}, "gm-1")).toBeUndefined();
      return Promise.resolve();
    });
    expect(actorGuard?.(actor, cleanedUpdate, {}, "gm-1")).toBe(false);
  });

  it("does not apply character advancement locks to machine Actors", () => {
    expect(usesPersonalMechanicalEditGuard("character")).toBe(true);
    expect(usesPersonalMechanicalEditGuard("creature")).toBe(true);
    expect(usesPersonalMechanicalEditGuard("npc")).toBe(true);
    expect(usesPersonalMechanicalEditGuard("starship")).toBe(false);
    expect(usesPersonalMechanicalEditGuard("vehicle")).toBe(false);
  });

  it("admits an owner health transaction even when Foundry injects protected scores", async () => {
    type ActorGuard = (
      actor: unknown,
      changes: unknown,
      options: unknown,
      userId: unknown,
    ) => boolean | undefined;
    let actorGuard: ActorGuard | undefined;
    vi.stubGlobal("Hooks", {
      on: (name: string, callback: unknown) => {
        if (name === "preUpdateActor") actorGuard = callback as ActorGuard;
      },
    });
    vi.stubGlobal("game", {
      user: { isGM: false },
      users: { get: () => ({ isGM: false }) },
    });
    registerMechanicalEditGuards();
    const actor = {
      system: {
        attributes: { brawn: { score: 12 } },
        sheetMode: { value: "freeedit" },
      },
      type: "character",
    } as unknown as FoundryActorDocument;
    const injectedUpdate = {
      system: {
        attributes: { brawn: { score: 12 } },
        health: { firstEditionStuns: { total: 0 } },
      },
    };
    expect(actorGuard?.(actor, injectedUpdate, {}, "player-1")).toBe(false);
    await withAuthorizedHealthUpdate(actor, () => {
      expect(actorGuard?.(actor, injectedUpdate, {}, "player-1")).toBe(
        undefined,
      );
      return Promise.resolve();
    });
    expect(actorGuard?.(actor, injectedUpdate, {}, "player-1")).toBe(false);
  });

  it("admits only the scoped Open D6 roll-resource transaction", async () => {
    type ActorGuard = (
      actor: unknown,
      changes: unknown,
      options: unknown,
      userId: unknown,
    ) => boolean | undefined;
    let actorGuard: ActorGuard | undefined;
    vi.stubGlobal("Hooks", {
      on: (name: string, callback: unknown) => {
        if (name === "preUpdateActor") actorGuard = callback as ActorGuard;
      },
    });
    vi.stubGlobal("game", {
      user: { isGM: false },
      users: { get: () => ({ isGM: false }) },
    });
    registerMechanicalEditGuards();
    const actor = {
      system: {
        resources: {
          characterPoints: { value: 4 },
          fatePoints: { value: 2 },
        },
        sheetMode: { value: "normal" },
      },
      type: "character",
    } as unknown as FoundryActorDocument;
    const changes = {
      "system.resources.characterPoints.value": 3,
      "system.resources.fatePoints.value": 1,
    };
    expect(actorGuard?.(actor, changes, {}, "player-1")).toBe(false);
    await withAuthorizedOpenD6ResourceUpdate(actor, () => {
      expect(actorGuard?.(actor, changes, {}, "player-1")).toBeUndefined();
      return Promise.resolve();
    });
    expect(actorGuard?.(actor, changes, {}, "player-1")).toBe(false);
  });

  it("allows only a GM to directly change currency", () => {
    type ActorGuard = (
      actor: unknown,
      changes: unknown,
      options: unknown,
      userId: unknown,
    ) => boolean | undefined;
    let actorGuard: ActorGuard | undefined;
    const users = new Map([
      ["player-1", { isGM: false }],
      ["gm-1", { isGM: true }],
    ]);
    vi.stubGlobal("Hooks", {
      on: (name: string, callback: unknown) => {
        if (name === "preUpdateActor") actorGuard = callback as ActorGuard;
      },
    });
    vi.stubGlobal("game", {
      user: { isGM: false },
      users: { get: (id: string) => users.get(id) },
    });
    registerMechanicalEditGuards();
    const actor = {
      system: {
        profile: { currency: 10 },
        sheetMode: { value: "normal" },
      },
      type: "character",
    } as unknown as FoundryActorDocument;
    const changes = { "system.profile.currency": 20 };

    expect(actorGuard?.(actor, changes, {}, "player-1")).toBe(false);
    expect(actorGuard?.(actor, changes, {}, "gm-1")).toBeUndefined();
  });

  it("admits only the scoped extraordinary-power transaction", async () => {
    type ActorGuard = (
      actor: unknown,
      changes: unknown,
      options: unknown,
      userId: unknown,
    ) => boolean | undefined;
    let actorGuard: ActorGuard | undefined;
    vi.stubGlobal("Hooks", {
      on: (name: string, callback: unknown) => {
        if (name === "preUpdateActor") actorGuard = callback as ActorGuard;
      },
    });
    vi.stubGlobal("game", {
      user: { isGM: false },
      users: { get: () => ({ isGM: false }) },
    });
    registerMechanicalEditGuards();
    const actor = {
      system: {
        extraordinaryPowers: { frameworks: {} },
        sheetMode: { value: "normal" },
      },
      type: "character",
    } as unknown as FoundryActorDocument;
    const changes = {
      "system.extraordinaryPowers.frameworks": {
        synthetic: { maintainedPowerIds: ["focus"] },
      },
    };
    expect(actorGuard?.(actor, changes, {}, "player-1")).toBe(false);
    await withAuthorizedExtraordinaryPowerUpdate(actor, () => {
      expect(actorGuard?.(actor, changes, {}, "player-1")).toBeUndefined();
      return Promise.resolve();
    });
    expect(actorGuard?.(actor, changes, {}, "player-1")).toBe(false);
  });

  it("admits only the scoped template Attribute transaction", async () => {
    type ActorGuard = (
      actor: unknown,
      changes: unknown,
      options: unknown,
      userId: unknown,
    ) => boolean | undefined;
    let actorGuard: ActorGuard | undefined;
    vi.stubGlobal("Hooks", {
      on: (name: string, callback: unknown) => {
        if (name === "preUpdateActor") actorGuard = callback as ActorGuard;
      },
    });
    vi.stubGlobal("game", {
      user: { isGM: false },
      users: { get: () => ({ isGM: false }) },
    });
    registerMechanicalEditGuards();
    const actor = {
      system: {
        attributes: { agility: { score: 3 } },
        sheetMode: { value: "normal" },
      },
      type: "character",
    } as unknown as FoundryActorDocument;
    const changes = { "system.attributes.agility.score": 15 };
    expect(actorGuard?.(actor, changes, {}, "player-1")).toBe(false);
    await withAuthorizedTemplateUpdate(actor, () => {
      expect(actorGuard?.(actor, changes, {}, "player-1")).toBeUndefined();
      return Promise.resolve();
    });
    expect(actorGuard?.(actor, changes, {}, "player-1")).toBe(false);
  });

  it("allows a GM to save reusable mechanical Items with Foundry's null parent", () => {
    type ItemGuard = (
      item: unknown,
      changes: unknown,
      options: unknown,
      userId: unknown,
    ) => boolean | undefined;
    let createGuard: ItemGuard | undefined;
    let updateGuard: ItemGuard | undefined;
    vi.stubGlobal("Hooks", {
      on: (name: string, callback: unknown) => {
        if (name === "preCreateItem") createGuard = callback as ItemGuard;
        if (name === "preUpdateItem") updateGuard = callback as ItemGuard;
      },
    });
    vi.stubGlobal("game", {
      user: { isGM: true },
      users: { get: () => ({ isGM: true }) },
    });
    registerMechanicalEditGuards();
    const specialization = {
      parent: null,
      system: { score: 0 },
      type: "specialization",
    } as unknown as FoundryItemDocument;

    expect(createGuard?.(specialization, {}, {}, "gm-1")).toBeUndefined();
    expect(
      updateGuard?.(specialization, { system: { score: 0 } }, {}, "gm-1"),
    ).toBeUndefined();
  });
});
