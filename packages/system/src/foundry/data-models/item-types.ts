import {
  commonItemFields,
  equipmentFields,
  pipScoreValueField,
} from "./fields";

const { BooleanField, NumberField, SchemaField, StringField } =
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

function sourceReference(module: string, page: number): object {
  return new SchemaField({
    book: new StringField({
      initial: "D6 System: Second Edition",
      nullable: false,
      required: true,
    }),
    module: new StringField({
      initial: module,
      nullable: false,
      required: true,
    }),
    page: new NumberField({
      initial: page,
      integer: true,
      min: 0,
      nullable: false,
      required: true,
    }),
  });
}

function rankedFeatureSchema(
  initialKey: string,
  kind: "flaw" | "perk" | "talent",
): Record<string, object> {
  const fields: Record<string, object> = {
    ...commonItemFields(initialKey),
    focus: new StringField({
      initial: "",
      nullable: false,
      required: true,
    }),
    rank: new NumberField({
      initial: 1,
      integer: true,
      min: 1,
      nullable: false,
      required: true,
    }),
    source: sourceReference("Perks, Flaws & Talents", 101),
  };
  if (kind === "talent") {
    fields.cost = new NumberField({
      initial: 0,
      integer: true,
      min: 0,
      nullable: false,
      required: true,
    });
    fields.repeatable = new BooleanField({
      initial: false,
      nullable: false,
      required: true,
    });
  }
  return fields;
}

function narrativeFeatureSchema(
  initialKey: string,
  page: number,
): Record<string, object> {
  return {
    ...commonItemFields(initialKey),
    source: sourceReference("Troubles and Assets", page),
    trigger: new StringField({
      initial: "",
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

export class ManifestationDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema(): Record<string, object> {
    return {
      ...commonItemFields("new-manifestation"),
      castingTime: new StringField({
        choices: [
          "action",
          "two-turns",
          "four-turns",
          "hour",
          "day",
          "week",
          "month",
          "year",
        ],
        initial: "action",
        nullable: false,
        required: true,
      }),
      duration: new StringField({
        choices: [
          "instant",
          "round",
          "ten-minutes",
          "hour",
          "day",
          "week",
          "month",
          "year",
          "century",
          "permanent",
        ],
        initial: "instant",
        nullable: false,
        required: true,
      }),
      power: new NumberField({
        initial: 1,
        integer: true,
        min: 1,
        nullable: false,
        required: true,
      }),
      range: new StringField({
        choices: [
          "melee",
          "senses",
          "mile",
          "locale",
          "hundred-miles",
          "unlimited",
        ],
        initial: "melee",
        nullable: false,
        required: true,
      }),
      resistance: new StringField({
        choices: ["none", "partial", "complete"],
        initial: "partial",
        nullable: false,
        required: true,
      }),
      school: new StringField({
        choices: ["alteration", "apportation", "conjuration", "divination"],
        initial: "alteration",
        nullable: false,
        required: true,
      }),
      target: new StringField({
        choices: [
          "self",
          "one",
          "two-three",
          "four-six",
          "small-crowd",
          "large-crowd",
          "object",
          "large-object",
          "environment",
          "large-environment",
        ],
        initial: "one",
        nullable: false,
        required: true,
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

export class PerkDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema(): Record<string, object> {
    return rankedFeatureSchema("new-perk", "perk");
  }
}

export class FlawDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema(): Record<string, object> {
    return rankedFeatureSchema("new-flaw", "flaw");
  }
}

export class TalentDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema(): Record<string, object> {
    return rankedFeatureSchema("new-talent", "talent");
  }
}

export class TroubleDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema(): Record<string, object> {
    return narrativeFeatureSchema("new-trouble", 130);
  }
}

export class AssetDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema(): Record<string, object> {
    return narrativeFeatureSchema("new-asset", 131);
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
      attackBonus: pipScoreValueField(0),
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
