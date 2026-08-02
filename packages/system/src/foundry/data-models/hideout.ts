import { migrationField } from "./fields";

const { ArrayField, HTMLField, NumberField, SchemaField, StringField } =
  foundry.data.fields;

export class HideoutDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema(): Record<string, object> {
    return {
      _migration: migrationField(),
      acquisition: new StringField({
        choices: ["gm-granted", "talent-purchased", "pooled"],
        initial: "gm-granted",
        nullable: false,
        required: true,
      }),
      biography: new HTMLField({
        initial: "",
        nullable: false,
        required: true,
      }),
      featureLimit: new NumberField({
        initial: 4,
        integer: true,
        min: 0,
        nullable: false,
        required: true,
      }),
      features: new ArrayField(
        new SchemaField({
          catalogId: new StringField({
            initial: "",
            nullable: false,
            required: true,
          }),
          catalogVersion: new NumberField({
            initial: 0,
            integer: true,
            min: 0,
            nullable: false,
            required: true,
          }),
          description: new StringField({
            initial: "",
            nullable: false,
            required: true,
          }),
          featureId: new StringField({
            initial: "",
            nullable: false,
            required: true,
          }),
          instanceId: new StringField({
            initial: "",
            nullable: false,
            required: true,
          }),
          label: new StringField({
            initial: "",
            nullable: false,
            required: true,
          }),
          sourceBook: new StringField({
            initial: "",
            nullable: false,
            required: true,
          }),
          sourcePage: new NumberField({
            initial: 0,
            integer: true,
            min: 0,
            nullable: false,
            required: true,
          }),
        }),
        { initial: [], nullable: false, required: true },
      ),
      locationDetails: new StringField({
        initial: "",
        nullable: false,
        required: true,
      }),
      locationType: new StringField({
        choices: ["urban", "country", "wild", "custom"],
        initial: "urban",
        nullable: false,
        required: true,
      }),
      members: new ArrayField(
        new SchemaField({
          actorId: new StringField({
            initial: "",
            nullable: false,
            required: true,
          }),
          name: new StringField({
            initial: "",
            nullable: false,
            required: true,
          }),
        }),
        { initial: [], nullable: false, required: true },
      ),
      ownershipKind: new StringField({
        choices: ["individual", "group"],
        initial: "individual",
        nullable: false,
        required: true,
      }),
      relocation: new SchemaField({
        monthsCompleted: new NumberField({
          initial: 0,
          integer: true,
          min: 0,
          nullable: false,
          required: true,
        }),
        monthsOverride: new NumberField({
          initial: 0,
          integer: true,
          min: 0,
          nullable: false,
          required: true,
        }),
        notes: new StringField({
          initial: "",
          nullable: false,
          required: true,
        }),
        state: new StringField({
          choices: [
            "ready",
            "compromised",
            "destroyed",
            "relocating",
            "rebuilding",
          ],
          initial: "ready",
          nullable: false,
          required: true,
        }),
      }),
    };
  }
}
