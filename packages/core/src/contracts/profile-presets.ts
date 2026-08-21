import type { D6RulesProfileV3 } from "./rules-profiles";
import type { D6ResolvedSettingProfileV5 } from "./setting-profiles";

export const D6_PROFILE_PRESET_CONTRACT_VERSION = 1 as const;

/** A portable request to select one Rules Profile and one Setting Profile. */
export interface D6ProfilePresetSelectionV1 {
  readonly rulesProfileId: string;
  readonly settingProfileId: string;
  readonly version: typeof D6_PROFILE_PRESET_CONTRACT_VERSION;
}

/** A portable, named recommendation for one atomic profile selection. */
export interface D6ProfilePresetDefinitionV1 {
  readonly description: string;
  readonly id: string;
  readonly label: string;
  readonly selection: D6ProfilePresetSelectionV1;
  readonly version: typeof D6_PROFILE_PRESET_CONTRACT_VERSION;
}

export type D6ProfilePresetSourceV1 = "bundled" | "module";

/** Registry provenance kept outside the portable preset definition. */
export interface D6ResolvedProfilePresetV1 {
  readonly ownerId: string;
  readonly preset: D6ProfilePresetDefinitionV1;
  readonly source: D6ProfilePresetSourceV1;
}

export interface D6System2eProfilePresetRegistry {
  current(): readonly D6ResolvedProfilePresetV1[];
  register(ownerId: string, preset: D6ProfilePresetDefinitionV1): void;
  unregisterOwner(ownerId: string): void;
}

export interface D6ProfilePresetPreviewV1 {
  readonly changedCount: number;
  readonly changes: {
    readonly rulesProfile: boolean;
    readonly settingProfile: boolean;
  };
  readonly previous: D6ProfilePresetSelectionV1;
  readonly requiresReload: boolean;
  readonly selection: D6ProfilePresetSelectionV1;
  readonly unchangedCount: number;
  readonly version: typeof D6_PROFILE_PRESET_CONTRACT_VERSION;
}

export interface D6ProfilePresetActivationResultV1 {
  readonly preview: D6ProfilePresetPreviewV1;
  readonly rulesProfile: D6RulesProfileV3;
  readonly settingProfile: D6ResolvedSettingProfileV5;
}

export interface D6System2eProfilePresetApi {
  activate(
    selection: D6ProfilePresetSelectionV1,
  ): Promise<D6ProfilePresetActivationResultV1>;
  preview(
    selection: D6ProfilePresetSelectionV1,
  ): Promise<D6ProfilePresetPreviewV1>;
}
