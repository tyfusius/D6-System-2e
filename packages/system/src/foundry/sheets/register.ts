import { SYSTEM_ID } from "../../constants";
import { D6System2eCharacterSheet } from "./character-sheet";
import { D6System2eItemSheet } from "./item-sheet";

const ITEM_TYPES = [
  "advantage",
  "armor",
  "disadvantage",
  "gear",
  "skill",
  "specialability",
  "specialization",
  "weapon",
] as const;

export function registerD6System2eSheets(): void {
  const sheets = foundry.applications.apps.DocumentSheetConfig;
  sheets.registerSheet(Actor, SYSTEM_ID, D6System2eCharacterSheet, {
    label: "D6E2.Actor.Character",
    makeDefault: true,
    types: ["character"],
  });
  sheets.registerSheet(Item, SYSTEM_ID, D6System2eItemSheet, {
    label: "D6E2.Item.Sheet",
    makeDefault: true,
    types: ITEM_TYPES,
  });
}
