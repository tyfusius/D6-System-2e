import type { ActorSource, ItemSource } from "@d6-system-2e/core";
import { migrationRunner } from "../migrations";
import { SYSTEM_NAME } from "../constants";

interface MigratableItemDocument {
  readonly id: string;
  readonly system: Record<string, unknown>;
  readonly type: string;
  toObject(): ItemSource;
  update(
    changes: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
}

interface MigratableActorDocument {
  readonly id: string;
  readonly system: Record<string, unknown>;
  readonly type: string;
  toObject(): ActorSource;
  update(
    changes: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
  updateEmbeddedDocuments(
    documentName: "Item",
    changes: readonly Record<string, unknown>[],
    options?: Record<string, unknown>,
  ): Promise<unknown>;
}

function documentVersion(system: Record<string, unknown>): number {
  const metadata = system._migration;
  if (typeof metadata !== "object" || metadata === null) return 0;
  const schema = (metadata as Record<string, unknown>).schema;
  return Number.isSafeInteger(schema) ? Number(schema) : 0;
}

export async function migrateD6System2eWorld(): Promise<void> {
  if (game.user?.isGM !== true) return;
  const context = {
    foundryVersion: game.version ?? "",
    systemVersion: game.system.version ?? "",
  };
  let migratedDocuments = 0;

  for (const actor of game.actors?.contents ?? []) {
    const document = actor as MigratableActorDocument;
    const result = await migrationRunner.migrateActor(
      document.toObject(),
      context,
    );
    const embeddedUpdates = result.source.items
      .filter((item) => item._id)
      .filter((item) => {
        const original = document
          .toObject()
          .items.find((candidate) => candidate._id === item._id);
        return (
          original !== undefined &&
          documentVersion(original.system) < documentVersion(item.system)
        );
      })
      .map((item) => ({ _id: item._id, system: item.system }));
    if (embeddedUpdates.length > 0) {
      await document.updateEmbeddedDocuments("Item", embeddedUpdates, {
        d6System2eMigration: true,
        diff: false,
      });
      migratedDocuments += embeddedUpdates.length;
    }
    if (documentVersion(document.system) < result.report.toVersion) {
      await document.update(
        { system: result.source.system },
        { d6System2eMigration: true, diff: false },
      );
      migratedDocuments += 1;
    }
  }

  for (const item of game.items?.contents ?? []) {
    const document = item as MigratableItemDocument;
    const result = await migrationRunner.migrateItem(
      document.toObject(),
      context,
    );
    if (documentVersion(document.system) < result.report.toVersion) {
      await document.update(
        { system: result.source.system },
        { d6System2eMigration: true, diff: false },
      );
      migratedDocuments += 1;
    }
  }

  if (migratedDocuments > 0) {
    console.info(
      `${SYSTEM_NAME} | Migrated ${migratedDocuments} document(s) to schema ${migrationRunner.latestVersion}`,
    );
  }
}
