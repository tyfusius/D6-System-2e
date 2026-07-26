import { migrationField, pipScoreValueField } from "./fields";
import { convertLegacySkillScore } from "../../migrations/003-canonical-pip-scores";

const { HTMLField, StringField } = foundry.data.fields;

const ATTRIBUTE_IDS = [
  "agility",
  "brawn",
  "charm",
  "knowledge",
  "magic",
  "mechanical",
  "mysticism",
  "perception",
  "technical",
] as const;

export class SkillDataModel extends foundry.abstract.TypeDataModel {
  static migrateData(source: Record<string, unknown>): Record<string, unknown> {
    convertLegacySkillScore(source);
    return source;
  }

  static defineSchema(): Record<string, object> {
    return {
      _migration: migrationField(),
      attributeId: new StringField({
        choices: ATTRIBUTE_IDS,
        initial: "agility",
        nullable: false,
        required: true,
      }),
      description: new HTMLField({
        initial: "",
        nullable: false,
        required: true,
      }),
      key: new StringField({
        initial: "new-skill",
        nullable: false,
        required: true,
      }),
      score: pipScoreValueField(0),
      training: new StringField({
        choices: ["standard", "advanced"],
        initial: "standard",
        nullable: false,
        required: true,
      }),
    };
  }
}
