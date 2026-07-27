import {
  commonItemFields,
  equipmentFields,
  pipScoreValueField,
} from "./fields";

const { NumberField, SchemaField, StringField } = foundry.data.fields;

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

const ITEM_CONTEXTS = ["personal", "vehicle", "starship"] as const;

function traitSchema(initialKey: string): Record<string, object> {
  return {
    ...commonItemFields(initialKey),
    activation: new StringField({
      initial: "",
      nullable: false,
      required: true,
    }),
    cost: new NumberField({
      initial: 0,
      min: 0,
      nullable: false,
      required: true,
    }),
    frequency: new StringField({
      choices: ["always", "scene", "session", "limited"],
      initial: "always",
      nullable: false,
      required: true,
    }),
    rank: new NumberField({
      initial: 1,
      integer: true,
      min: 0,
      nullable: false,
      required: true,
    }),
  };
}

export class SpecializationDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema(): Record<string, object> {
    return {
      ...commonItemFields("new-specialization"),
      attributeId: new StringField({
        choices: ATTRIBUTE_IDS,
        initial: "agility",
        nullable: false,
        required: true,
      }),
      parentSkillId: new StringField({
        initial: "",
        nullable: false,
        required: true,
      }),
      parentSkillKey: new StringField({
        initial: "",
        nullable: false,
        required: true,
      }),
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
    };
  }
}

export class AdvantageDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema(): Record<string, object> {
    return traitSchema("new-advantage");
  }
}

export class DisadvantageDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema(): Record<string, object> {
    return traitSchema("new-disadvantage");
  }
}

export class SpecialAbilityDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema(): Record<string, object> {
    return traitSchema("new-special-ability");
  }
}

export class GearDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema(): Record<string, object> {
    return {
      ...commonItemFields("new-gear"),
      ...equipmentFields(),
      availability: new StringField({
        initial: "",
        nullable: false,
        required: true,
      }),
      legality: new StringField({
        initial: "",
        nullable: false,
        required: true,
      }),
    };
  }
}

export class WeaponDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema(): Record<string, object> {
    return {
      ...commonItemFields("new-weapon"),
      ...equipmentFields(),
      ammunition: new SchemaField({
        current: new NumberField({
          initial: 0,
          integer: true,
          min: 0,
          nullable: false,
          required: true,
        }),
        maximum: new NumberField({
          initial: 0,
          integer: true,
          min: 0,
          nullable: false,
          required: true,
        }),
      }),
      attackAttributeId: new StringField({
        choices: ATTRIBUTE_IDS,
        initial: "agility",
        nullable: false,
        required: true,
      }),
      attackSkillKey: new StringField({
        initial: "",
        nullable: false,
        required: true,
      }),
      damage: pipScoreValueField(0),
      damageType: new StringField({
        initial: "",
        nullable: false,
        required: true,
      }),
      range: new SchemaField({
        long: new NumberField({
          initial: 0,
          min: 0,
          nullable: false,
          required: true,
        }),
        medium: new NumberField({
          initial: 0,
          min: 0,
          nullable: false,
          required: true,
        }),
        short: new NumberField({
          initial: 0,
          min: 0,
          nullable: false,
          required: true,
        }),
      }),
      scale: new NumberField({
        initial: 0,
        integer: true,
        nullable: false,
        required: true,
      }),
    };
  }
}

export class ArmorDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema(): Record<string, object> {
    return {
      ...commonItemFields("new-armor"),
      ...equipmentFields(),
      context: new StringField({
        choices: ITEM_CONTEXTS,
        initial: "personal",
        nullable: false,
        required: true,
      }),
      coverage: new StringField({
        initial: "",
        nullable: false,
        required: true,
      }),
      energyResistance: pipScoreValueField(0),
      physicalResistance: pipScoreValueField(0),
      stackingTag: new StringField({
        initial: "",
        nullable: false,
        required: true,
      }),
    };
  }
}
