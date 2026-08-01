import { afterEach, describe, expect, it, vi } from "vitest";
import {
  changesAttributeScore,
  changesProtectedFirstEditionResource,
  changesProtectedSecondEditionAdvancementResource,
  changesRankedFeatureMechanics,
  changesSkillScore,
  mayDirectEditMechanicalScore,
  registerMechanicalEditGuards,
  usesPersonalMechanicalEditGuard,
  withAuthorizedHealthUpdate,
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
});
