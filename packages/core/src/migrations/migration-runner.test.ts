import { describe, expect, it } from "vitest";
import type { ActorSource, Migration } from "./migration";
import { MigrationRunner } from "./migration-runner";

const context = Object.freeze({
  foundryVersion: "14.365",
  systemVersion: "0.1.0-alpha.1",
});

function actor(): ActorSource {
  return {
    _id: "actor-1",
    items: [{ _id: "item-1", system: { unknownItemKey: true }, type: "skill" }],
    system: { unknownActorKey: { preserved: true } },
    type: "character",
  };
}

describe("MigrationRunner", () => {
  it("orders migrations and records metadata after success", async () => {
    const migrations: readonly Migration[] = [
      {
        name: "second",
        version: 2,
        updateActor: (source) => {
          source.second = true;
        },
      },
      {
        name: "first",
        version: 1,
        updateActor: (source) => {
          source.first = true;
        },
        updateItem: (source) => {
          source.migrated = true;
        },
      },
    ];
    const result = await new MigrationRunner(migrations).migrateActor(
      actor(),
      context,
    );

    expect(result.report).toEqual({
      applied: [1, 2],
      fromVersion: 0,
      toVersion: 2,
    });
    expect(result.source.system).toMatchObject({
      _migration: { foundry: "14.365", schema: 2, system: "0.1.0-alpha.1" },
      unknownActorKey: { preserved: true },
    });
    expect(result.source.items[0]).toMatchObject({
      migrated: true,
      system: {
        _migration: { foundry: "14.365", schema: 2, system: "0.1.0-alpha.1" },
        unknownItemKey: true,
      },
    });
  });

  it("does not mutate the input", async () => {
    const source = actor();
    await new MigrationRunner([
      {
        name: "change",
        version: 1,
        updateActor: (candidate) => {
          candidate.changed = true;
        },
      },
    ]).migrateActor(source, context);
    expect(source).toEqual(actor());
  });

  it("is idempotent for a current source", async () => {
    const source = actor();
    source.system._migration = {
      foundry: "14.365",
      schema: 1,
      system: "0.1.0-alpha.1",
    };
    const embeddedItem = source.items[0];
    if (!embeddedItem) throw new Error("fixture must contain an embedded Item");
    embeddedItem.system._migration = {
      foundry: "14.365",
      schema: 1,
      system: "0.1.0-alpha.1",
    };
    const result = await new MigrationRunner([
      {
        name: "already applied",
        version: 1,
        updateActor: () => {
          throw new Error("must not run");
        },
      },
    ]).migrateActor(source, context);
    expect(result.report.applied).toEqual([]);
    expect(result.source).toEqual(source);
  });

  it("migrates an older embedded item even when its Actor is current", async () => {
    const source = actor();
    source.system._migration = {
      foundry: "14.365",
      schema: 1,
      system: "0.1.0-alpha.1",
    };
    const result = await new MigrationRunner([
      {
        name: "item migration",
        version: 1,
        updateItem: (item) => {
          item.migrated = true;
        },
      },
    ]).migrateActor(source, context);

    expect(result.source.items[0]).toMatchObject({
      migrated: true,
      system: {
        _migration: {
          foundry: "14.365",
          schema: 1,
          system: "0.1.0-alpha.1",
        },
      },
    });
    expect(result.report.applied).toEqual([1]);
  });

  it("does not record success or mutate the input when a migration fails", async () => {
    const source = actor();
    const runner = new MigrationRunner([
      {
        name: "fails",
        version: 1,
        updateActor: (candidate) => {
          candidate.partial = true;
          throw new Error("failure");
        },
      },
    ]);
    await expect(runner.migrateActor(source, context)).rejects.toThrow(
      "failure",
    );
    expect(source.system._migration).toBeUndefined();
    expect(source).toEqual(actor());
  });

  it("rejects invalid and duplicate migration versions", () => {
    expect(() => new MigrationRunner([{ name: "zero", version: 0 }])).toThrow(
      RangeError,
    );
    expect(
      () =>
        new MigrationRunner([
          { name: "one", version: 1 },
          { name: "duplicate", version: 1 },
        ]),
    ).toThrow("Duplicate migration version 1");
  });
});
