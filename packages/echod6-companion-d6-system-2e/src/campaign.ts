import type { D6SystemPublicApi } from "./d6-system-api";

export const MODULE_ID = "echod6-companion-d6-system-2e";

export const ECHO_CAMPAIGN_PACKAGE = Object.freeze({
  apiCompatibility: Object.freeze({ maximum: 2, minimum: 2 }),
  compatibleGenreIds: Object.freeze(["space"]),
  contractVersion: 1,
  id: MODULE_ID,
  kind: "companion",
  label: "Echo D6",
  rulesFamily: "open-d6-first-edition",
  version: "1.0.0",
});

export function isEchoSelected(api: D6SystemPublicApi): boolean {
  const selection = api.campaignPackages.selection?.();
  return selection?.valid === true && selection.companion?.id === MODULE_ID;
}
