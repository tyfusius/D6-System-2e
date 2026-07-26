import { dieCodeField, migrationField } from "./fields";

const { HTMLField, NumberField, SchemaField, StringField } =
  foundry.data.fields;

export class CharacterDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema(): Record<string, object> {
    return {
      _migration: migrationField(),
      attributes: new SchemaField({
        agility: dieCodeField(1, 1, 5),
        brawn: dieCodeField(1, 1, 5),
        charm: dieCodeField(0, 0, 5),
        knowledge: dieCodeField(1, 1, 5),
        magic: dieCodeField(0, 0, 5),
        mechanical: dieCodeField(0, 0, 5),
        mysticism: dieCodeField(0, 0, 5),
        perception: dieCodeField(1, 1, 5),
        technical: dieCodeField(0, 0, 5),
      }),
      biography: new HTMLField({
        initial: "",
        nullable: false,
        required: true,
      }),
      health: new SchemaField({
        condition: new StringField({
          choices: ["healthy"],
          initial: "healthy",
          nullable: false,
          required: true,
        }),
      }),
      resources: new SchemaField({
        heroPoints: new SchemaField({
          value: new NumberField({
            initial: 1,
            integer: true,
            min: 0,
            nullable: false,
            required: true,
          }),
        }),
      }),
    };
  }
}
