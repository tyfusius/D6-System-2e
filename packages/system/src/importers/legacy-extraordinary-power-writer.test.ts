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
          legacyImport: { sourceUuid: `Actor.${id}` },
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
) {
  const createEmbeddedDocuments = vi.fn(() =>
    Promise.resolve([{ id: "SkillItem000001" }]),
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
        itemIds.includes(itemId)
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
    toObject: () => ({
      flags: { "d6-system-2e": { legacyImport: { sourceUuid } } },
      items: [],
      system,
      type: "character",
    }),
    test: { createEmbeddedDocuments, deleteActor },
  } as unknown as FoundryActorDocument & {
    test: {
      createEmbeddedDocuments: typeof createEmbeddedDocuments;
      deleteActor: typeof deleteActor;
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
      createActor: vi.fn(() => {
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
      unresolved: ["actor-id-conflict:ActorFixture001"],
    });
  });

  it("does not treat a provenance match with missing Items as complete", async () => {
    const report = await writeLegacyExtraordinaryPowerActors(
      [plan("ActorFixture001")],
      {
        createActor: vi.fn(),
        existingActor: () => actor("ActorFixture001", undefined, []),
      },
    );
    expect(report).toMatchObject({
      status: "failed",
      targetWrites: 0,
      unresolved: ["actor-id-conflict:ActorFixture001"],
    });
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
