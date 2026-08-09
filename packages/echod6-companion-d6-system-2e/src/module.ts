import type { D6SystemPublicApi } from "./d6-system-api";

export const MODULE_ID = "echod6-companion-d6-system-2e";
export const ECHO_SETTING_PROFILE_ID = "echo-d6";

export function isEchoSettingSelected(api: D6SystemPublicApi): boolean {
  const selection = api.setting.selection();
  return (
    selection.available && selection.activeProfileId === ECHO_SETTING_PROFILE_ID
  );
}
