export const D6_FIRST_EDITION_GENRE_PROFILE_CONTRACT_VERSION = 1 as const;

export interface D6FirstEditionAttributeV1 {
  readonly id: string;
  readonly label: string;
}

export interface D6FirstEditionSkillV1 {
  readonly attributeId: string;
  readonly key: string;
  readonly name: string;
  readonly source: Readonly<{ readonly book: string; readonly page: number }>;
}

export interface D6FirstEditionGenreProfileV1 {
  readonly attributeBudgetScore: number;
  readonly attributes: readonly D6FirstEditionAttributeV1[];
  readonly genreId: string;
  readonly id: string;
  readonly label: string;
  readonly roles: Readonly<{
    readonly initiative: string;
    readonly knowledge: string;
    readonly strength: string;
  }>;
  readonly skillBudgetScore: number;
  readonly skills: readonly D6FirstEditionSkillV1[];
  readonly version: typeof D6_FIRST_EDITION_GENRE_PROFILE_CONTRACT_VERSION;
}

export interface D6ResolvedFirstEditionGenreProfileV1 extends D6FirstEditionGenreProfileV1 {
  readonly ownerId: string;
}

export interface D6System2eFirstEditionGenreProfileRegistry {
  current(): readonly D6ResolvedFirstEditionGenreProfileV1[];
  register(ownerId: string, profile: D6FirstEditionGenreProfileV1): void;
  unregisterOwner(ownerId: string): void;
}
