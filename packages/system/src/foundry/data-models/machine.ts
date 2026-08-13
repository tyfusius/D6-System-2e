import { migrationField, pipScoreField, scaleSideField } from "./fields";

const { ArrayField, HTMLField, NumberField, SchemaField, StringField } =
  foundry.data.fields;

function crewMembersField(): object {
  return new ArrayField(
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
    {
      initial: [],
      nullable: false,
      required: true,
    },
  );
}

function conditionField(): object {
  return new StringField({
    choices: [
      "healthy",
      "staggered",
      "stunned",
      "wounded",
      "incapacitated",
      "mortally-wounded",
      "dead",
    ],
    initial: "healthy",
    nullable: false,
    required: true,
  });
}

function sharedMachineSchema(): Record<string, object> {
  return {
    _migration: migrationField(),
    biography: new HTMLField({
      initial: "",
      nullable: false,
      required: true,
    }),
    health: new SchemaField({
      condition: conditionField(),
    }),
    scale: new NumberField({
      initial: 0,
      integer: true,
      nullable: false,
      required: true,
    }),
    scaleSide: scaleSideField(),
  };
}

export class VehicleDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema(): Record<string, object> {
    return {
      ...sharedMachineSchema(),
      armor: pipScoreField(0),
      attributes: new SchemaField({
        hull: pipScoreField(3, 3),
        maneuverability: pipScoreField(3, 3),
      }),
      crew: new SchemaField({
        members: crewMembersField(),
      }),
      passengers: new NumberField({
        initial: 0,
        integer: true,
        min: 0,
        nullable: false,
        required: true,
      }),
    };
  }
}

export class StarshipDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema(): Record<string, object> {
    return {
      ...sharedMachineSchema(),
      attributes: new SchemaField({
        engines: pipScoreField(3, 3),
        hull: pipScoreField(3, 3),
        maneuverability: pipScoreField(3, 3),
        navicomp: pipScoreField(3, 3),
      }),
      crew: new SchemaField({
        members: crewMembersField(),
        minimum: new NumberField({
          initial: 1,
          integer: true,
          min: 1,
          nullable: false,
          required: true,
        }),
      }),
      interstellarDrive: new NumberField({
        initial: 0,
        min: 0,
        nullable: false,
        required: true,
      }),
      shields: pipScoreField(0),
    };
  }
}
