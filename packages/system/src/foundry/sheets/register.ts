import { SYSTEM_ID } from "../../constants";
import { D6System2eCharacterSheet } from "./character-sheet";
import { D6System2eItemSheet } from "./item-sheet";
import { D6System2eMachineSheet } from "./machine-sheet";

const ITEM_TYPES = [
  "action",
  "advantage",
  "armor",
  "asset",
  "character-template",
  "cybernetic",
  "disadvantage",
  "flaw",
  "gear",
  "item-group",
  "manifestation",
  "perk",
  "skill",
  "specialability",
  "specialization",
  "talent",
  "trouble",
  "species-template",
  "starship-gear",
  "starship-weapon",
  "vehicle",
  "vehicle-gear",
  "vehicle-weapon",
  "weapon",
] as const;

export function registerD6System2eSheets(): void {
  const sheets = foundry.applications.apps.DocumentSheetConfig;
  sheets.registerSheet(Actor, SYSTEM_ID, D6System2eCharacterSheet, {
    label: "D6E2.Actor.Character",
    makeDefault: true,
    types: ["character", "creature", "npc"],
  });
  sheets.registerSheet(Actor, SYSTEM_ID, D6System2eMachineSheet, {
    label: "D6E2.Actor.Machine",
    makeDefault: true,
    types: ["starship", "vehicle"],
  });
  sheets.registerSheet(Item, SYSTEM_ID, D6System2eItemSheet, {
    label: "D6E2.Item.Sheet",
    makeDefault: true,
    types: ITEM_TYPES,
  });
}
