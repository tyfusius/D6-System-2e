type DataField = object;

const { NumberField, SchemaField, StringField } = foundry.data.fields;

export function dieCodeField(
  initialDice: number,
  minimumDice = 0,
  maximumDice?: number,
): DataField {
  return new SchemaField({
    dice: new NumberField({
      initial: initialDice,
      integer: true,
      max: maximumDice,
      min: minimumDice,
      nullable: false,
      required: true,
    }),
    pips: new NumberField({
      initial: 0,
      integer: true,
      min: 0,
      nullable: false,
      required: true,
    }),
  });
}

export function migrationField(): DataField {
  return new SchemaField({
    foundry: new StringField({
      initial: "",
      nullable: false,
      required: true,
    }),
    schema: new NumberField({
      initial: 1,
      integer: true,
      min: 0,
      nullable: false,
      required: true,
    }),
    system: new StringField({
      initial: "",
      nullable: false,
      required: true,
    }),
  });
}
