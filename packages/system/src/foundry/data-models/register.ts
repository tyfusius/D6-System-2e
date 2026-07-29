import { CharacterDataModel } from "./character";
import {
  AdvantageDataModel,
  ArmorDataModel,
  AssetDataModel,
  DisadvantageDataModel,
  FlawDataModel,
  GearDataModel,
  PerkDataModel,
  SpecialAbilityDataModel,
  SpecializationDataModel,
  TalentDataModel,
  TroubleDataModel,
  WeaponDataModel,
} from "./item-types";
import { SkillDataModel } from "./skill";
import { StarshipDataModel, VehicleDataModel } from "./machine";

export function registerD6System2eDataModels(): void {
  CONFIG.Actor.dataModels.character = CharacterDataModel;
  CONFIG.Actor.dataModels.creature = CharacterDataModel;
  CONFIG.Actor.dataModels.npc = CharacterDataModel;
  CONFIG.Actor.dataModels.starship = StarshipDataModel;
  CONFIG.Actor.dataModels.vehicle = VehicleDataModel;
  CONFIG.Item.dataModels.skill = SkillDataModel;
  CONFIG.Item.dataModels.specialization = SpecializationDataModel;
  CONFIG.Item.dataModels.advantage = AdvantageDataModel;
  CONFIG.Item.dataModels.disadvantage = DisadvantageDataModel;
  CONFIG.Item.dataModels.specialability = SpecialAbilityDataModel;
  CONFIG.Item.dataModels.perk = PerkDataModel;
  CONFIG.Item.dataModels.flaw = FlawDataModel;
  CONFIG.Item.dataModels.talent = TalentDataModel;
  CONFIG.Item.dataModels.trouble = TroubleDataModel;
  CONFIG.Item.dataModels.asset = AssetDataModel;
  CONFIG.Item.dataModels.gear = GearDataModel;
  CONFIG.Item.dataModels.weapon = WeaponDataModel;
  CONFIG.Item.dataModels.armor = ArmorDataModel;
  CONFIG.Item.dataModels.action = SpecialAbilityDataModel;
  CONFIG.Item.dataModels["character-template"] = SpecialAbilityDataModel;
  CONFIG.Item.dataModels.cybernetic = GearDataModel;
  CONFIG.Item.dataModels["item-group"] = GearDataModel;
  CONFIG.Item.dataModels.manifestation = SpecialAbilityDataModel;
  CONFIG.Item.dataModels["species-template"] = SpecialAbilityDataModel;
  CONFIG.Item.dataModels["starship-gear"] = GearDataModel;
  CONFIG.Item.dataModels["starship-weapon"] = WeaponDataModel;
  CONFIG.Item.dataModels.vehicle = GearDataModel;
  CONFIG.Item.dataModels["vehicle-gear"] = GearDataModel;
  CONFIG.Item.dataModels["vehicle-weapon"] = WeaponDataModel;
}
