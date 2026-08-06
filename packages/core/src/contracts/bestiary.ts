export const D6_BESTIARY_CONTRACT_VERSION = 1 as const;

export type D6BestiaryItemKind =
  "armor" | "gear" | "manifestation" | "specialability" | "weapon";

export interface D6BestiaryItemV1 {
  readonly img?: string;
  readonly name: string;
  readonly system: Readonly<Record<string, unknown>>;
  readonly type: D6BestiaryItemKind;
}

export interface D6BestiaryEntryV1 {
  readonly attributeScores: Readonly<Record<string, number>>;
  readonly biography?: string;
  readonly defenseOverrides: Readonly<{
    readonly dodge: number;
    readonly parry: number;
  }>;
  readonly id: string;
  readonly img?: string;
  readonly items?: readonly D6BestiaryItemV1[];
  readonly label: string;
  readonly magicPoints?: number;
  /** Defaults to Second Edition for version-1 catalogs created before dual-mode bestiaries. */
  readonly rulesFamily?: "d6-system-second-edition" | "open-d6-first-edition";
  readonly scale?: number;
  /** Combined printed Skill scores keyed by the system's stable Skill key. */
  readonly skillScores?: Readonly<Record<string, number>>;
  readonly source: Readonly<{ readonly book: string; readonly page: number }>;
  readonly version: typeof D6_BESTIARY_CONTRACT_VERSION;
}

export interface D6BestiaryCatalogV1 {
  readonly entries: readonly D6BestiaryEntryV1[];
  readonly id: string;
  readonly label: string;
  readonly version: typeof D6_BESTIARY_CONTRACT_VERSION;
}

export interface D6ResolvedBestiaryCatalogV1 extends D6BestiaryCatalogV1 {
  readonly ownerId: string;
}

export interface D6System2eBestiaryRegistry {
  current(): readonly D6ResolvedBestiaryCatalogV1[];
  register(ownerId: string, catalog: D6BestiaryCatalogV1): void;
  unregisterOwner(ownerId: string): void;
}

export type D6BestiaryIssueCode =
  | "attribute-inactive"
  | "entry-missing"
  | "first-edition-profile"
  | "gm-required"
  | "magic-points-inactive";

export interface D6BestiaryPreviewV1 {
  readonly attributeScores: readonly {
    readonly attributeId: string;
    readonly score: number;
  }[];
  readonly canCreate: boolean;
  readonly catalogId: string;
  readonly catalogLabel: string;
  readonly defenseOverrides: Readonly<{
    readonly dodge: number;
    readonly parry: number;
  }>;
  readonly entryId: string;
  readonly entryLabel: string;
  readonly itemAdditions: readonly {
    readonly name: string;
    readonly type: D6BestiaryItemKind;
  }[];
  readonly issues: readonly D6BestiaryIssueCode[];
  readonly magicPoints: number;
  readonly ownerId: string;
  readonly rulesFamily: "d6-system-second-edition" | "open-d6-first-edition";
  readonly scale: number;
  readonly source: Readonly<{ readonly book: string; readonly page: number }>;
  readonly version: typeof D6_BESTIARY_CONTRACT_VERSION;
}

export interface D6BestiaryCreationV1 {
  readonly actorId: string;
  readonly preview: D6BestiaryPreviewV1;
  readonly version: typeof D6_BESTIARY_CONTRACT_VERSION;
}

export interface D6System2eBestiaryApi {
  create(entryId: string): Promise<D6BestiaryCreationV1>;
  preview(entryId: string): D6BestiaryPreviewV1;
}
