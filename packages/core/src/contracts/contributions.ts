export interface D6System2eTerminologyContribution {
  readonly attributes?: Readonly<Record<string, string>>;
  readonly characterSheetLabel?: string;
  readonly resources?: Readonly<{
    readonly characterPoints?: string;
    readonly fatePoints?: string;
    readonly heroPoints?: string;
  }>;
  readonly systemLabel?: string;
}

export interface D6System2eResolvedTerminology {
  readonly attributes: Readonly<Record<string, string>>;
  readonly characterSheetLabel?: string;
  readonly resources: Readonly<{
    readonly characterPoints?: string;
    readonly fatePoints?: string;
    readonly heroPoints?: string;
  }>;
  readonly systemLabel?: string;
}

export interface D6System2eThemeDiceDefinition {
  readonly body: string;
  readonly colorsetId: string;
  readonly edge: string;
  readonly face: string;
  readonly name: string;
  readonly systemId: string;
  readonly wildDieLabels?: readonly string[];
}

export interface D6System2eThemeDefinition {
  readonly cssClass: string;
  readonly dice?: D6System2eThemeDiceDefinition;
  readonly id: string;
  readonly label: string;
  readonly tokens: Readonly<{
    readonly accent: string;
    readonly accentBright: string;
    readonly background: string;
    readonly muted: string;
    readonly text: string;
  }>;
}

export const D6_EQUIPMENT_ERAS = Object.freeze([
  "medieval",
  "modern",
  "science-fiction",
] as const);

export type D6EquipmentEra = (typeof D6_EQUIPMENT_ERAS)[number];
export type D6EquipmentEraSelection = D6EquipmentEra | "none";
export type D6EquipmentKind = "armor" | "gear" | "weapon";

export interface D6System2eEquipmentCatalogEntry {
  readonly era: D6EquipmentEra;
  readonly id: string;
  readonly kind: D6EquipmentKind;
  readonly name: string;
  readonly source: Readonly<{ readonly book: string; readonly page: number }>;
  readonly system: Readonly<Record<string, unknown>>;
}

export interface D6System2eEquipmentCatalogDefinition {
  readonly entries: readonly D6System2eEquipmentCatalogEntry[];
  readonly id: string;
  readonly label: string;
  readonly version: number;
}

export interface D6System2eResolvedEquipmentCatalog extends D6System2eEquipmentCatalogDefinition {
  readonly ownerId: string;
}

export interface D6System2eEquipmentCatalogRegistry {
  current(): readonly D6System2eResolvedEquipmentCatalog[];
  register(
    ownerId: string,
    definition: D6System2eEquipmentCatalogDefinition,
  ): void;
  unregisterOwner(ownerId: string): void;
}

export interface D6System2eTerminologyRegistry {
  current(): D6System2eResolvedTerminology;
  register(
    ownerId: string,
    contribution: D6System2eTerminologyContribution,
  ): void;
  unregisterOwner(ownerId: string): void;
}

export interface D6System2eThemeRegistry {
  current(): readonly D6System2eThemeDefinition[];
  register(ownerId: string, definition: D6System2eThemeDefinition): void;
  unregisterOwner(ownerId: string): void;
}
