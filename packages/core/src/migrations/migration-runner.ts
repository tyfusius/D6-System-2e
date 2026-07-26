import type {
  ActorSource,
  ItemSource,
  Migration,
  MigrationContext,
  MigrationMetadata,
  MigrationResult,
  SystemDataSource,
} from "./migration";

type Clone = <T>(value: T) => T;

export class MigrationRunner {
  readonly #clone: Clone;
  readonly #migrations: readonly Migration[];

  constructor(
    migrations: readonly Migration[],
    clone: Clone = structuredClone,
  ) {
    this.#clone = clone;
    this.#migrations = [...migrations].sort(
      (left, right) => left.version - right.version,
    );
    this.#validateVersions();
  }

  get latestVersion(): number {
    return this.#migrations.at(-1)?.version ?? 0;
  }

  migrationsAfter(version: number): readonly Migration[] {
    return this.#migrations.filter((migration) => migration.version > version);
  }

  async migrateActor(
    source: ActorSource,
    context: MigrationContext,
  ): Promise<MigrationResult<ActorSource>> {
    const actor = this.#clone(source);
    const fromVersion = this.#version(actor.system);
    const migrations = this.migrationsAfter(fromVersion);

    for (const migration of migrations) {
      await migration.updateActor?.(actor);
      for (const item of actor.items) {
        await migration.updateItem?.(item, actor);
      }
    }

    this.#record(actor.system, migrations, context);
    for (const item of actor.items)
      this.#record(item.system, migrations, context);
    return this.#result(actor, fromVersion, migrations);
  }

  async migrateItem(
    source: ItemSource,
    context: MigrationContext,
  ): Promise<MigrationResult<ItemSource>> {
    const item = this.#clone(source);
    const fromVersion = this.#version(item.system);
    const migrations = this.migrationsAfter(fromVersion);
    for (const migration of migrations) await migration.updateItem?.(item);
    this.#record(item.system, migrations, context);
    return this.#result(item, fromVersion, migrations);
  }

  #record(
    target: SystemDataSource,
    migrations: readonly Migration[],
    context: MigrationContext,
  ): void {
    const latest = migrations.at(-1);
    if (!latest) return;
    target._migration = Object.freeze({
      foundry: context.foundryVersion,
      schema: latest.version,
      system: context.systemVersion,
    });
  }

  #result<T>(
    source: T,
    fromVersion: number,
    migrations: readonly Migration[],
  ): MigrationResult<T> {
    const applied = Object.freeze(migrations.map(({ version }) => version));
    return Object.freeze({
      report: Object.freeze({
        applied,
        fromVersion,
        toVersion: migrations.at(-1)?.version ?? fromVersion,
      }),
      source,
    });
  }

  #validateVersions(): void {
    const seen = new Set<number>();
    for (const migration of this.#migrations) {
      if (!Number.isSafeInteger(migration.version) || migration.version <= 0) {
        throw new RangeError(
          `Migration "${migration.name}" must use a positive integer version.`,
        );
      }
      if (seen.has(migration.version)) {
        throw new Error(`Duplicate migration version ${migration.version}.`);
      }
      seen.add(migration.version);
    }
  }

  #version(system: SystemDataSource): number {
    const metadata: MigrationMetadata | undefined = system._migration;
    return Number.isSafeInteger(metadata?.schema) && (metadata?.schema ?? 0) > 0
      ? (metadata?.schema ?? 0)
      : 0;
  }
}
