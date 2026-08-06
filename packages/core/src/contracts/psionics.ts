import type { D6RollResultV1 } from "./roll";

export const D6_PSIONICS_CONTRACT_VERSION = 1 as const;
export const D6_PSIONIC_DISCIPLINES = Object.freeze([
  "kinesis",
  "perceive",
  "reform",
] as const);

export type D6PsionicDiscipline = (typeof D6_PSIONIC_DISCIPLINES)[number];
export type D6PsionicTrainingMethod = "self-study" | "teacher";

export interface D6PsionicPowerV1 {
  readonly baseDifficulty: number;
  readonly disciplines: readonly D6PsionicDiscipline[];
  readonly id: string;
  readonly label: string;
  readonly scalingDifficultyPerAttempt?: number;
  readonly source: { readonly book: string; readonly page: number };
}

export interface D6PsionicPowerCatalogV1 {
  readonly catalogVersion: typeof D6_PSIONICS_CONTRACT_VERSION;
  readonly id: string;
  readonly powers: readonly D6PsionicPowerV1[];
}

export interface D6ResolvedPsionicPowerCatalogV1 extends D6PsionicPowerCatalogV1 {
  readonly ownerId: string;
}

export interface D6System2ePsionicPowerRegistry {
  current(): readonly D6ResolvedPsionicPowerCatalogV1[];
  register(ownerId: string, catalog: D6PsionicPowerCatalogV1): void;
  unregisterOwner(ownerId: string): void;
}

export interface D6PsionicDisciplineStateV1 {
  readonly id: D6PsionicDiscipline;
  readonly itemId: string;
  readonly score: number;
  readonly trained: boolean;
  readonly trainingMethod?: D6PsionicTrainingMethod;
}

export interface D6PsionicPowerStateV1 extends D6PsionicPowerV1 {
  readonly available: boolean;
  readonly catalogId: string;
  readonly ownerId: string;
  readonly poolScore: number;
  readonly recentAttempts: number;
}

export interface D6PsionicsStateV1 {
  readonly contractVersion: typeof D6_PSIONICS_CONTRACT_VERSION;
  readonly disciplines: readonly D6PsionicDisciplineStateV1[];
  readonly powers: readonly D6PsionicPowerStateV1[];
}

export interface D6PsionicPowerRollOptionsV1 {
  readonly difficultyModifier?: number;
}

export interface D6System2ePsionicsApi {
  read(actor: object): D6PsionicsStateV1;
  roll(
    actor: object,
    powerId: string,
    options?: D6PsionicPowerRollOptionsV1,
  ): Promise<D6RollResultV1 | null>;
  train(
    actor: object,
    discipline: D6PsionicDiscipline,
    method: D6PsionicTrainingMethod,
  ): Promise<D6PsionicsStateV1>;
}
