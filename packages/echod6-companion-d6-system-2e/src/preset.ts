import type { D6SystemPublicApi, RulesPresetResult } from "./d6-system-api";

export function applyEchoPreset(
  api: D6SystemPublicApi,
): Promise<RulesPresetResult> {
  return api.rules.applyPreset("open-d6");
}
