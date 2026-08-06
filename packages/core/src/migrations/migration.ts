export interface MigrationMetadata {
  foundry: string;
  schema: number;
  system: string;
}

export interface SystemDataSource {
  _migration?: MigrationMetadata;
  [key: string]: unknown;
}

export interface ItemSource {
  _id?: string;
  system: SystemDataSource;
  type: string;
  [key: string]: unknown;
}

export interface ActorSource {
  _id?: string;
  items: ItemSource[];
  system: SystemDataSource;
  type: string;
  [key: string]: unknown;
}

export interface MigrationContext {
  readonly foundryVersion: string;
  readonly systemVersion: string;
}

export interface Migration {
  readonly name: string;
  readonly version: number;
  updateActor?(source: ActorSource): void | Promise<void>;
  updateItem?(source: ItemSource, actor?: ActorSource): void | Promise<void>;
}

export interface MigrationReport {
  readonly applied: readonly number[];
  readonly fromVersion: number;
  readonly toVersion: number;
}

export interface MigrationResult<T> {
  readonly report: MigrationReport;
  readonly source: T;
}
