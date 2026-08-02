import { migrationField, pipScoreValueField } from "./fields";
import { convertLegacySkillScore } from "../../migrations/003-canonical-pip-scores";

const { ArrayField, HTMLField, NumberField, SchemaField, StringField } =
  foundry.data.fields;

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
      prerequisiteSkillKeys: new ArrayField(
        new StringField({
          initial: "",
          nullable: false,
          required: true,
        }),
        {
          initial: [],
          nullable: false,
          required: true,
        },
      ),
      score: pipScoreValueField(0),
      source: new SchemaField({
        book: new StringField({
          initial: "",
          nullable: false,
          required: true,
        }),
        module: new StringField({
          initial: "",
          nullable: false,
          required: true,
        }),
        page: new NumberField({
          initial: 0,
          integer: true,
          min: 0,
          nullable: false,
          required: true,
        }),
      }),
      training: new StringField({
        choices: ["standard", "advanced", "psionic"],
        initial: "standard",
        nullable: false,
        required: true,
      }),
      psionicTraining: new StringField({
        choices: ["none", "self-study", "teacher"],
        initial: "none",
        nullable: false,
        required: true,
      }),
    };
  }
}
