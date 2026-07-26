type DataField = object;

const { NumberField, SchemaField, StringField } = foundry.data.fields;

export function pipScoreField(
  initial: number,
  minimum = 0,
  maximum?: number,
): DataField {
  return new SchemaField({
    score: pipScoreValueField(initial, minimum, maximum),
  });
}

export function pipScoreValueField(
  initial: number,
  minimum = 0,
  maximum?: number,
): DataField {
  return new NumberField({
    initial,
    integer: true,
    max: maximum,
    min: minimum,
    nullable: false,
    required: true,
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
