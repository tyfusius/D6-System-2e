import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  D6LegacyExtraordinaryPowerActorWritePlanV1,
  ItemSource,
} from "@d6-system-2e/core";
vi.mock("../foundry/extraordinary-power-service", () => ({
  bindExtraordinaryPowerItem: vi.fn(() => Promise.resolve({})),
  bindExtraordinaryPowerSkill: vi.fn(() => Promise.resolve({})),
  setExtraordinaryPowerConsequence: vi.fn(() => Promise.resolve({})),
}));
import { writeLegacyExtraordinaryPowerActors } from "./legacy-extraordinary-power-writer";

const item: ItemSource = {
  _id: "SkillItem000001",
  system: { key: "force-control", score: 9 },
  type: "skill",
};

function plan(id: string): D6LegacyExtraordinaryPowerActorWritePlanV1 {
  return {
    actor: {
      _id: id,
      flags: {
        "d6-system-2e": {
          legacyImport: { sourceUuid: `Actor.${id}`, sourceVersion: "1.0.7" },
        },
      },
      items: [],
      name: id,
      system: {
        extraordinaryPowers: {
          frameworks: { "star-wars-d6%2Eforce": {} },
        },
      },
      type: "character",
    },
    items: [item],
    source: {
      frameworkId: "star-wars-d6.force",
      system: "od6s",
      uuid: `Actor.${id}`,
      version: "1.0.7",
    },
  };
}

function actor(
  id: string,
  sourceUuid = `Actor.${id}`,
  itemIds: readonly string[] = ["SkillItem000001"],
  includeFramework = true,
  mutateEmbeddedSources = false,
) {
  let storedSource: unknown;
  let storedItemIds = [...itemIds];
  const createEmbeddedDocuments = vi.fn(
    (_documentName: string, sources: readonly ItemSource[]) => {
      if (mutateEmbeddedSources) {
        for (const source of sources) {
          (source.system as Record<string, unknown>).normalizedByFoundry = true;
        }
      }
      return Promise.resolve([{ id: "SkillItem000001" }]);
    },
  );
  const deleteActor = vi.fn(() => Promise.resolve(undefined));
  const system: Record<string, unknown> = includeFramework
    ? {
        extraordinaryPowers: {
          frameworks: { "star-wars-d6%2Eforce": {} },
        },
      }
    : {};
  return {
    createEmbeddedDocuments,
    delete: deleteActor,
    id,
    isOwner: true,
    items: {
      contents: [],
      get: (itemId: string) =>
        storedItemIds.includes(itemId)
          ? ({ id: itemId } as FoundryItemDocument)
          : undefined,
    },
    system,
    update: vi.fn((changes: Record<string, unknown>) => {
      const frameworks = changes["system.extraordinaryPowers.frameworks"];
      if (
        frameworks &&
        typeof frameworks === "object" &&
        Object.keys(frameworks).length > 0
      ) {
        system.extraordinaryPowers = { frameworks };
      }
      return Promise.resolve(undefined);
    }),
    toObject: () =>
      storedSource ?? {
        flags: {
          "d6-system-2e": {
            legacyImport: { sourceUuid, sourceVersion: "1.0.7" },
          },
        },
        items: [],
        system,
        type: "character",
      },
    test: {
      createEmbeddedDocuments,
      deleteActor,
      setItemIds: (ids: readonly string[]) => {
        storedItemIds = [...ids];
      },
      setSource: (source: unknown) => {
        storedSource = structuredClone(source);
      },
    },
  } as unknown as FoundryActorDocument & {
    test: {
      createEmbeddedDocuments: typeof createEmbeddedDocuments;
      deleteActor: typeof deleteActor;
      setItemIds(ids: readonly string[]): void;
      setSource(source: unknown): void;
    };
  };
}

describe("legacy extraordinary-power Actor writer", () => {
  beforeEach(() => {
    vi.stubGlobal("game", { actors: { get: vi.fn() }, user: { isGM: true } });
  });

  it("preserves IDs and reports a repeat as an idempotent skip", async () => {
    const created = actor("ActorFixture001");
    const existing = new Map<string, FoundryActorDocument>();
    const repository = {
      createActor: vi.fn((source) => {
        created.test.setSource(source);
        existing.set(created.id, created);
        return Promise.resolve(created);
      }),
      existingActor: (id: string) => existing.get(id),
    };
    const first = await writeLegacyExtraordinaryPowerActors(
      [plan(created.id)],
      repository,
    );
    const second = await writeLegacyExtraordinaryPowerActors(
      [plan(created.id)],
      repository,
    );
    expect(first).toMatchObject({
      createdActors: [created.id],
      createdItems: 1,
      status: "complete",
      targetWrites: 2,
    });
    expect(created.toObject()).toMatchObject({
      _id: created.id,
      flags: {
        "d6-system-2e": {
          legacyImport: {
            integrity: { revision: 1 },
            sourceUuid: `Actor.${created.id}`,
            sourceVersion: "1.0.7",
          },
        },
      },
      name: created.id,
    });
    expect(created.test.createEmbeddedDocuments).toHaveBeenCalledWith(
      "Item",
      [item],
      {
        d6System2eMigration: true,
        keepId: true,
      },
    );
    expect(second).toMatchObject({
      createdActors: [],
      idempotentSkips: [created.id],
      status: "complete",
      targetWrites: 0,
    });
  });

  it("preserves a reused plan when Foundry mutates embedded Item sources", async () => {
    const created = actor(
      "ActorFixture001",
      undefined,
      undefined,
      undefined,
      true,
    );
    const existing = new Map<string, FoundryActorDocument>();
    const repository = {
      createActor: vi.fn((source) => {
        created.test.setSource(source);
        existing.set(created.id, created);
        return Promise.resolve(created);
      }),
      existingActor: (id: string) => existing.get(id),
    };
    const reusedPlan = plan(created.id);
    const originalPlan = JSON.stringify(reusedPlan);

    const first = await writeLegacyExtraordinaryPowerActors(
      [reusedPlan],
      repository,
    );
    const second = await writeLegacyExtraordinaryPowerActors(
      [reusedPlan],
      repository,
    );

    expect(first).toMatchObject({
      createdActors: [created.id],
      createdItems: 1,
      status: "complete",
      targetWrites: 2,
    });
    expect(second).toMatchObject({
      createdActors: [],
      createdItems: 0,
      idempotentSkips: [created.id],
      status: "complete",
      targetWrites: 0,
    });
    const embeddedCall = created.test.createEmbeddedDocuments.mock.calls[0];
    if (!embeddedCall) throw new Error("Expected an embedded Item write.");
    const embeddedSources = embeddedCall[1];
    expect(embeddedSources).not.toBe(reusedPlan.items);
    expect(embeddedSources[0]).not.toBe(reusedPlan.items[0]);
    expect(embeddedSources[0]).toMatchObject({
      system: { normalizedByFoundry: true },
    });
    expect(JSON.stringify(reusedPlan)).toBe(originalPlan);
    expect(repository.createActor).toHaveBeenCalledOnce();
    expect(created.test.createEmbeddedDocuments).toHaveBeenCalledOnce();
  });

  it("rolls back all Actors created by the transaction after a failure", async () => {
    const first = actor("ActorFixture001");
    const second = actor("ActorFixture002");
    second.test.createEmbeddedDocuments.mockRejectedValueOnce(
      new Error("fixture embedded failure"),
    );
    const created = [first, second];
    const report = await writeLegacyExtraordinaryPowerActors(
      created.map(({ id }) => plan(id)),
      {
        createActor: () => {
          const next = created.shift();
          if (!next) throw new Error("fixture Actor queue exhausted");
          return Promise.resolve(next);
        },
        existingActor: () => undefined,
      },
    );
    expect(report).toMatchObject({
      createdActors: [],
      rolledBackActors: ["ActorFixture002", "ActorFixture001"],
      status: "failed",
    });
    expect(first.test.deleteActor).toHaveBeenCalledOnce();
    expect(second.test.deleteActor).toHaveBeenCalledOnce();
  });

  it("does not overwrite an unrelated Actor with the same ID", async () => {
    const report = await writeLegacyExtraordinaryPowerActors(
      [plan("ActorFixture001")],
      {
        createActor: vi.fn(),
        existingActor: () => actor("ActorFixture001", "Actor.SomeoneElse"),
      },
    );
    expect(report).toMatchObject({
      status: "failed",
      targetWrites: 0,
      unresolved: ["actor-source-uuid-conflict:ActorFixture001"],
    });
  });

  it("does not treat a provenance match with missing Items as complete", async () => {
    const created = actor("ActorFixture001");
    const repository = {
      createActor: vi.fn((source) => {
        created.test.setSource(source);
        return Promise.resolve(created);
      }),
      existingActor: vi.fn(() => undefined as FoundryActorDocument | undefined),
    };
    const first = await writeLegacyExtraordinaryPowerActors(
      [plan("ActorFixture001")],
      repository,
    );
    expect(first.status).toBe("complete");
    created.test.setItemIds([]);
    repository.existingActor.mockReturnValue(created);
    const repeat = await writeLegacyExtraordinaryPowerActors(
      [plan("ActorFixture001")],
      repository,
    );
    expect(repeat).toMatchObject({
      status: "failed",
      targetWrites: 0,
      unresolved: ["actor-embedded-item-conflict:ActorFixture001"],
    });
  });

  it("does not treat a provenance match with a missing framework as complete", async () => {
    const created = actor("ActorFixture001", undefined, undefined, false);
    const repository = {
      createActor: vi.fn((source) => {
        created.test.setSource(source);
        return Promise.resolve(created);
      }),
      existingActor: vi.fn(() => undefined as FoundryActorDocument | undefined),
    };
    const reusedPlan = plan(created.id);
    const first = await writeLegacyExtraordinaryPowerActors(
      [reusedPlan],
      repository,
    );
    expect(first.status).toBe("complete");
    repository.existingActor.mockReturnValue(created);

    const repeat = await writeLegacyExtraordinaryPowerActors(
      [reusedPlan],
      repository,
    );

    expect(repeat).toMatchObject({
      status: "failed",
      targetWrites: 0,
      unresolved: ["actor-framework-conflict:ActorFixture001"],
    });
  });

  it("conflicts when an imported Actor source or source version changes", async () => {
    const created = actor("ActorFixture001");
    const repository = {
      createActor: vi.fn((source) => {
        created.test.setSource(source);
        return Promise.resolve(created);
      }),
      existingActor: vi.fn(() => undefined as FoundryActorDocument | undefined),
    };
    const original = plan(created.id);
    expect(
      (await writeLegacyExtraordinaryPowerActors([original], repository))
        .status,
    ).toBe("complete");
    repository.existingActor.mockReturnValue(created);
    const changedSource = {
      ...original,
      actor: { ...original.actor, name: "Changed Actor" },
    };
    const changedVersion = {
      ...original,
      source: { ...original.source, version: "1.0.8" },
    };
    expect(
      await writeLegacyExtraordinaryPowerActors([changedSource], repository),
    ).toMatchObject({
      status: "failed",
      unresolved: ["actor-fingerprint-conflict:ActorFixture001"],
    });
    expect(
      await writeLegacyExtraordinaryPowerActors([changedVersion], repository),
    ).toMatchObject({
      status: "failed",
      unresolved: ["actor-source-version-conflict:ActorFixture001"],
    });
  });

  it("retains the original failure and reports Actor rollback deletion failure", async () => {
    const created = actor("ActorFixture001");
    created.test.createEmbeddedDocuments.mockRejectedValueOnce(
      new Error("embedded write failed"),
    );
    created.test.deleteActor.mockRejectedValueOnce(
      new Error("Actor deletion failed"),
    );
    const report = await writeLegacyExtraordinaryPowerActors(
      [plan(created.id)],
      {
        createActor: vi.fn((source) => {
          created.test.setSource(source);
          return Promise.resolve(created);
        }),
        existingActor: () => undefined,
      },
    );
    expect(report.createdActors).toEqual([created.id]);
    expect(report.unresolved[0]).toBe("write-failed:embedded write failed");
    expect(report.rollbackFailures).toEqual([
      "rollback-failed:Actor.ActorFixture001:Actor deletion failed",
    ]);
    expect(report.unresolved).toContain(report.rollbackFailures[0]);
  });

  it("refuses a transaction when a projection reports an unresolved embedded Item", async () => {
    const unresolvedPlan = {
      ...plan("ActorFixture001"),
      unresolved: [
        "unsupported-embedded-item:Actor.ActorFixture001.Item.Unknown001:mystery",
      ],
    };
    const repository = { createActor: vi.fn(), existingActor: vi.fn() };
    const report = await writeLegacyExtraordinaryPowerActors(
      [unresolvedPlan],
      repository,
    );
    expect(report).toMatchObject({
      createdActors: [],
      status: "failed",
      targetWrites: 0,
      unresolved: unresolvedPlan.unresolved,
    });
    expect(repository.existingActor).not.toHaveBeenCalled();
    expect(repository.createActor).not.toHaveBeenCalled();
  });
});
