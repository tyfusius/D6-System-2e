type DataField = object;

const {
  BooleanField,
  HTMLField,
  NumberField,
  ObjectField,
  SchemaField,
  StringField,
} = foundry.data.fields;

function nullableMeasurementField(): DataField {
  return new NumberField({
    initial: null,
    integer: true,
    min: 0,
    nullable: true,
    required: true,
  });
}

export function storageRootFields(): Record<string, DataField> {
  return {
    storage: new SchemaField({
      version: new NumberField({
        initial: 1,
        integer: true,
        min: 1,
        max: 1,
        nullable: false,
        required: true,
      }),
      configured: new BooleanField({
        initial: false,
        nullable: false,
        required: true,
      }),
      publicSummary: new StringField({
        choices: ["none", "availability-only", "coarse-percent"],
        initial: "none",
        nullable: false,
        required: true,
      }),
    }),
  };
}

export function currencyHolderField(): DataField {
  return new ObjectField({
    initial: {},
    nullable: false,
    required: true,
  });
}

export function storagePhysicalFields(): Record<string, DataField> {
  return {
    hasStorage: new BooleanField({
      initial: false,
      nullable: false,
      required: true,
    }),
    storageInstanceId: new StringField({
      initial: "",
      nullable: false,
      required: true,
    }),
    storagePhysical: new SchemaField({
      version: new NumberField({
        initial: 1,
        integer: true,
        min: 1,
        max: 1,
        nullable: false,
        required: true,
      }),
      provenance: new StringField({
        choices: ["unknown", "preset", "measured"],
        initial: "unknown",
        nullable: false,
        required: true,
      }),
      presetId: new StringField({
        initial: "",
        nullable: false,
        required: true,
      }),
      widthMm: nullableMeasurementField(),
      depthMm: nullableMeasurementField(),
      heightMm: nullableMeasurementField(),
      unitTareWeightGrams: nullableMeasurementField(),
      unitExteriorVolumeMillilitres: nullableMeasurementField(),
      rotatable: new BooleanField({
        initial: true,
        nullable: false,
        required: true,
      }),
      footprintsByScale: new ObjectField({
        initial: {},
        nullable: false,
        required: true,
      }),
      stack: new SchemaField({
        mode: new StringField({
          choices: ["single", "bounded"],
          initial: "single",
          nullable: false,
          required: true,
        }),
        maxQuantityPerPlacement: new NumberField({
          initial: 1,
          integer: true,
          min: 1,
          nullable: false,
          required: true,
        }),
      }),
    }),
    storageInterior: new SchemaField({
      version: new NumberField({
        initial: 1,
        integer: true,
        min: 1,
        max: 1,
        nullable: false,
        required: true,
      }),
      configured: new BooleanField({
        initial: false,
        nullable: false,
        required: true,
      }),
      label: new StringField({
        initial: "",
        nullable: false,
        required: true,
      }),
      scaleId: new StringField({
        initial: "",
        nullable: false,
        required: true,
      }),
      scaleLabel: new StringField({
        initial: "",
        nullable: false,
        required: true,
      }),
      columns: new NumberField({
        initial: 1,
        integer: true,
        min: 1,
        nullable: false,
        required: true,
      }),
      rows: new NumberField({
        initial: 1,
        integer: true,
        min: 1,
        nullable: false,
        required: true,
      }),
      cellWidthMm: new NumberField({
        initial: 100,
        integer: true,
        min: 1,
        nullable: false,
        required: true,
      }),
      cellDepthMm: new NumberField({
        initial: 100,
        integer: true,
        min: 1,
        nullable: false,
        required: true,
      }),
      maxAggregateWeightGrams: nullableMeasurementField(),
      maxOccupiedVolumeMillilitres: nullableMeasurementField(),
      maxDirectChildren: nullableMeasurementField(),
      access: new StringField({
        choices: ["open", "closed", "locked"],
        initial: "open",
        nullable: false,
        required: true,
      }),
    }),
  };
}

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

export function scaleSideField(): DataField {
  return new StringField({
    choices: ["human", "larger", "smaller", "unresolved"],
    initial: "human",
    nullable: false,
    required: true,
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
    ...storagePhysicalFields(),
    currencyWallet: currencyHolderField(),
    equipmentProvenance: new SchemaField({
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
      entryId: new StringField({
        initial: "",
        nullable: false,
        required: true,
      }),
      era: new StringField({
        choices: ["none", "medieval", "modern", "science-fiction"],
        initial: "none",
        nullable: false,
        required: true,
      }),
      ownerId: new StringField({
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
    currencyValue: new ObjectField({
      initial: {},
      nullable: false,
      required: true,
    }),
  };
}
