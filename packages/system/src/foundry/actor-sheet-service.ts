import type { D6ActorSheetOpenOptionsV1 } from "@d6-system-2e/core";

function actorSheet(actorValue: object): FoundryActorSheet {
  const sheet = (actorValue as { readonly sheet?: unknown }).sheet;
  if (
    typeof sheet !== "object" ||
    sheet === null ||
    !("render" in sheet) ||
    typeof sheet.render !== "function" ||
    !("tabGroups" in sheet) ||
    typeof sheet.tabGroups !== "object" ||
    sheet.tabGroups === null
  ) {
    throw new TypeError("D6E2.Sheet.Error.Unavailable");
  }
  return sheet as FoundryActorSheet;
}

export function openActorSheet(
  actorValue: object,
  options: D6ActorSheetOpenOptionsV1 = {},
): void {
  const sheet = actorSheet(actorValue);
  if (options.tab) sheet.tabGroups.primary = options.tab;
  sheet.render(true);
}
