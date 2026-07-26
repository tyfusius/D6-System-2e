import { CharacterDataModel } from "./character";
import { SkillDataModel } from "./skill";

export function registerD6System2eDataModels(): void {
  CONFIG.Actor.dataModels.character = CharacterDataModel;
  CONFIG.Item.dataModels.skill = SkillDataModel;
}
