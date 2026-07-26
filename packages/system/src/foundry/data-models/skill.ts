import { dieCodeField, migrationField } from "./fields";

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
      rating: dieCodeField(0),
      training: new StringField({
        choices: ["standard", "advanced"],
        initial: "standard",
        nullable: false,
        required: true,
      }),
    };
  }
}
