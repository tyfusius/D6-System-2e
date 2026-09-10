import type { D6ProfileApi } from "./d6-system-api";
import { MODULE_ID } from "./module";
import { WESTERN1876_DISPLAY_FONT } from "./font";
import { WESTERN1876_GENRE } from "./genre";
import { create1876OutlawSettingProfile } from "./outlaw";
import {
  create1876Preset,
  create1876RulesProfile,
  create1876SettingProfile,
} from "./profiles";

/** Registration makes options available. Campaign Setup owns explicit selection. */
export function register1876Contributions(
  api: D6ProfileApi,
  localize: (key: string) => string,
): void {
  api.settingProfileFontRegistry.register(MODULE_ID, WESTERN1876_DISPLAY_FONT);
  api.firstEditionGenreProfiles.register(MODULE_ID, WESTERN1876_GENRE);
  api.rulesProfileRegistry.register(
    MODULE_ID,
    create1876RulesProfile(localize),
  );
  api.settingProfileRegistry.register(
    MODULE_ID,
    create1876SettingProfile(localize),
  );
  api.settingProfileRegistry.register(
    MODULE_ID,
    create1876OutlawSettingProfile(localize),
  );
  api.profilePresetRegistry.register(MODULE_ID, create1876Preset(localize));
}
