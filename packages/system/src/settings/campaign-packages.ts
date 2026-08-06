import type { D6CampaignPackageResolutionV1 } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { campaignPackageRegistry } from "../registries/campaign-packages";
import { stringSetting } from "./setting-values";

export const FIRST_EDITION_GENRE_PACKAGE_SETTING = "firstEditionGenrePackage";
export const FIRST_EDITION_COMPANION_PACKAGE_SETTING =
  "firstEditionCompanionPackage";

export function currentFirstEditionCampaignPackages(): D6CampaignPackageResolutionV1 {
  return campaignPackageRegistry.resolve({
    companionId: stringSetting(FIRST_EDITION_COMPANION_PACKAGE_SETTING, ""),
    genreId: stringSetting(FIRST_EDITION_GENRE_PACKAGE_SETTING, ""),
  });
}

export function registerCampaignPackageSettings(onChange: () => void): void {
  for (const key of [
    FIRST_EDITION_GENRE_PACKAGE_SETTING,
    FIRST_EDITION_COMPANION_PACKAGE_SETTING,
  ]) {
    game.settings.register(SYSTEM_ID, key, {
      config: false,
      default: "",
      hint: key,
      name: key,
      onChange,
      scope: "world",
      type: String,
    });
  }
}
