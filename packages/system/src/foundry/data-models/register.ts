import { CharacterDataModel } from "./character";
import {
  AdvantageDataModel,
  ArmorDataModel,
  DisadvantageDataModel,
  GearDataModel,
  SpecialAbilityDataModel,
  SpecializationDataModel,
  WeaponDataModel,
} from "./item-types";
import { SkillDataModel } from "./skill";

export function registerD6System2eDataModels(): void {
  CONFIG.Actor.dataModels.character = CharacterDataModel;
  CONFIG.Item.dataModels.skill = SkillDataModel;
  CONFIG.Item.dataModels.specialization = SpecializationDataModel;
  CONFIG.Item.dataModels.advantage = AdvantageDataModel;
  CONFIG.Item.dataModels.disadvantage = DisadvantageDataModel;
  CONFIG.Item.dataModels.specialability = SpecialAbilityDataModel;
  CONFIG.Item.dataModels.gear = GearDataModel;
  CONFIG.Item.dataModels.weapon = WeaponDataModel;
  CONFIG.Item.dataModels.armor = ArmorDataModel;
}
