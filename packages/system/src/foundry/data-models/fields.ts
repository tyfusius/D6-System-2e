type DataField = object;

const { BooleanField, HTMLField, NumberField, SchemaField, StringField } =
  foundry.data.fields;

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

export function commonItemFields(
  initialKey: string,
): Record<string, DataField> {
  return {
    _migration: migrationField(),
    description: new HTMLField({
      initial: "",
      nullable: false,
      required: true,
    }),
    key: new StringField({
      initial: initialKey,
      nullable: false,
      required: true,
    }),
  };
}

export function equipmentFields(): Record<string, DataField> {
  return {
    context: new StringField({
      choices: ["personal", "vehicle", "starship"],
      initial: "personal",
      nullable: false,
      required: true,
    }),
    equipped: new BooleanField({
      initial: false,
      nullable: false,
      required: true,
    }),
    mass: new NumberField({
      initial: 0,
      min: 0,
      nullable: false,
      required: true,
    }),
    quantity: new NumberField({
      initial: 1,
      integer: true,
      min: 0,
      nullable: false,
      required: true,
    }),
    value: new NumberField({
      initial: 0,
      min: 0,
      nullable: false,
      required: true,
    }),
  };
}
