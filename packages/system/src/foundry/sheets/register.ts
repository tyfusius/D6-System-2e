import { SYSTEM_ID } from "../../constants";
import { D6System2eCharacterSheet } from "./character-sheet";
import { D6System2eSkillSheet } from "./skill-sheet";

export function registerD6System2eSheets(): void {
  const sheets = foundry.applications.apps.DocumentSheetConfig;
  sheets.registerSheet(Actor, SYSTEM_ID, D6System2eCharacterSheet, {
    label: "D6E2.Actor.Character",
    makeDefault: true,
    types: ["character"],
  });
  sheets.registerSheet(Item, SYSTEM_ID, D6System2eSkillSheet, {
    label: "D6E2.Item.Skill",
    makeDefault: true,
    types: ["skill"],
  });
}
