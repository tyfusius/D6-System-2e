export interface D6System2eDocumentTerminology {
  readonly plural?: string;
  readonly singular?: string;
}

export interface D6System2eTerminologyContribution {
  readonly actors?: Readonly<{
    readonly character?: D6System2eDocumentTerminology;
    readonly creature?: D6System2eDocumentTerminology;
    readonly hideout?: D6System2eDocumentTerminology;
    readonly npc?: D6System2eDocumentTerminology;
    readonly starship?: D6System2eDocumentTerminology;
    readonly vehicle?: D6System2eDocumentTerminology;
  }>;
  readonly attributes?: Readonly<Record<string, string>>;
  readonly characterSheetLabel?: string;
  readonly conditions?: Readonly<{
    readonly states?: Readonly<{
      readonly dead?: string;
      readonly healthy?: string;
      readonly incapacitated?: string;
      readonly mortallyWounded?: string;
      readonly staggered?: string;
      readonly stunned?: string;
      readonly wounded?: string;
    }>;
    readonly track?: string;
  }>;
  readonly wounds?: Readonly<{
    readonly states?: Readonly<{
      readonly dead?: string;
      readonly healthy?: string;
      readonly incapacitated?: string;
      readonly mortallyWounded?: string;
      readonly severelyWounded?: string;
      readonly stunned?: string;
      readonly wounded?: string;
    }>;
    readonly track?: string;
  }>;
  readonly bodyPoints?: Readonly<{
    readonly current?: string;
    readonly maximum?: string;
    readonly track?: string;
  }>;
  readonly details?: Readonly<{
    readonly allegiance?: string;
    readonly currency?: string;
  }>;
  readonly machines?: Readonly<{
    readonly interstellarDrive?: string;
    readonly starshipToughness?: string;
    readonly vehicleToughness?: string;
  }>;
  readonly manifestations?: Readonly<{
    readonly plural?: string;
    readonly singular?: string;
  }>;
  readonly items?: Readonly<{
    readonly action?: D6System2eDocumentTerminology;
    readonly advancedSkill?: D6System2eDocumentTerminology;
    readonly advantage?: D6System2eDocumentTerminology;
    readonly armor?: D6System2eDocumentTerminology;
    readonly asset?: D6System2eDocumentTerminology;
    readonly characterTemplate?: D6System2eDocumentTerminology;
    readonly cybernetic?: D6System2eDocumentTerminology;
    readonly disadvantage?: D6System2eDocumentTerminology;
    readonly flaw?: D6System2eDocumentTerminology;
    readonly gear?: D6System2eDocumentTerminology;
    readonly group?: D6System2eDocumentTerminology;
    readonly manifestation?: D6System2eDocumentTerminology;
    readonly perk?: D6System2eDocumentTerminology;
    readonly skill?: D6System2eDocumentTerminology;
    readonly specialAbility?: string;
    readonly specialization?: D6System2eDocumentTerminology;
    readonly speciesTemplate?: D6System2eDocumentTerminology;
    readonly starshipGear?: D6System2eDocumentTerminology;
    readonly starshipWeapon?: D6System2eDocumentTerminology;
    readonly talent?: D6System2eDocumentTerminology;
    readonly trouble?: D6System2eDocumentTerminology;
    readonly vehicle?: D6System2eDocumentTerminology;
    readonly vehicleGear?: D6System2eDocumentTerminology;
    readonly vehicleWeapon?: D6System2eDocumentTerminology;
    readonly weapon?: D6System2eDocumentTerminology;
  }>;
  readonly metaphysics?: Readonly<{
    readonly attribute?: string;
    readonly extranormal?: string;
    readonly skills?: Readonly<{
      readonly channel?: string;
      readonly sense?: string;
      readonly transform?: string;
    }>;
  }>;
  readonly resources?: Readonly<{
    readonly characterPoints?: string;
    readonly experiencePoints?: string;
    readonly fatePoints?: string;
    readonly heroPoints?: string;
  }>;
  readonly systemLabel?: string;
}

export interface D6System2eResolvedTerminology {
  readonly actors: Readonly<{
    readonly character?: D6System2eDocumentTerminology;
    readonly creature?: D6System2eDocumentTerminology;
    readonly hideout?: D6System2eDocumentTerminology;
    readonly npc?: D6System2eDocumentTerminology;
    readonly starship?: D6System2eDocumentTerminology;
    readonly vehicle?: D6System2eDocumentTerminology;
  }>;
  readonly attributes: Readonly<Record<string, string>>;
  readonly characterSheetLabel?: string;
  readonly conditions: Readonly<{
    readonly states: Readonly<{
      readonly dead?: string;
      readonly healthy?: string;
      readonly incapacitated?: string;
      readonly mortallyWounded?: string;
      readonly staggered?: string;
      readonly stunned?: string;
      readonly wounded?: string;
    }>;
    readonly track?: string;
  }>;
  readonly wounds: Readonly<{
    readonly states: Readonly<{
      readonly dead?: string;
      readonly healthy?: string;
      readonly incapacitated?: string;
      readonly mortallyWounded?: string;
      readonly severelyWounded?: string;
      readonly stunned?: string;
      readonly wounded?: string;
    }>;
    readonly track?: string;
  }>;
  readonly bodyPoints: Readonly<{
    readonly current?: string;
    readonly maximum?: string;
    readonly track?: string;
  }>;
  readonly details: Readonly<{
    readonly allegiance?: string;
    readonly currency?: string;
  }>;
  readonly machines: Readonly<{
    readonly interstellarDrive?: string;
    readonly starshipToughness?: string;
    readonly vehicleToughness?: string;
  }>;
  readonly manifestations: Readonly<{
    readonly plural?: string;
    readonly singular?: string;
  }>;
  readonly items: Readonly<{
    readonly action?: D6System2eDocumentTerminology;
    readonly advancedSkill?: D6System2eDocumentTerminology;
    readonly advantage?: D6System2eDocumentTerminology;
    readonly armor?: D6System2eDocumentTerminology;
    readonly asset?: D6System2eDocumentTerminology;
    readonly characterTemplate?: D6System2eDocumentTerminology;
    readonly cybernetic?: D6System2eDocumentTerminology;
    readonly disadvantage?: D6System2eDocumentTerminology;
    readonly flaw?: D6System2eDocumentTerminology;
    readonly gear?: D6System2eDocumentTerminology;
    readonly group?: D6System2eDocumentTerminology;
    readonly manifestation?: D6System2eDocumentTerminology;
    readonly perk?: D6System2eDocumentTerminology;
    readonly skill?: D6System2eDocumentTerminology;
    readonly specialAbility?: string;
    readonly specialization?: D6System2eDocumentTerminology;
    readonly speciesTemplate?: D6System2eDocumentTerminology;
    readonly starshipGear?: D6System2eDocumentTerminology;
    readonly starshipWeapon?: D6System2eDocumentTerminology;
    readonly talent?: D6System2eDocumentTerminology;
    readonly trouble?: D6System2eDocumentTerminology;
    readonly vehicle?: D6System2eDocumentTerminology;
    readonly vehicleGear?: D6System2eDocumentTerminology;
    readonly vehicleWeapon?: D6System2eDocumentTerminology;
    readonly weapon?: D6System2eDocumentTerminology;
  }>;
  readonly metaphysics: Readonly<{
    readonly attribute?: string;
    readonly extranormal?: string;
    readonly skills: Readonly<{
      readonly channel?: string;
      readonly sense?: string;
      readonly transform?: string;
    }>;
  }>;
  readonly resources: Readonly<{
    readonly characterPoints?: string;
    readonly experiencePoints?: string;
    readonly fatePoints?: string;
    readonly heroPoints?: string;
  }>;
  readonly systemLabel?: string;
}

export interface D6System2eThemeDiceDefinition {
  readonly body: string;
  readonly colorsetId: string;
  readonly edge: string;
  readonly face: string;
  readonly name: string;
  readonly systemId: string;
  readonly wildDie?: Readonly<{
    readonly body: string;
    readonly colorsetId: string;
    readonly edge: string;
    readonly face: string;
  }>;
  readonly wildDieLabels?: readonly string[];
}

export interface D6System2eThemeDefinition {
  readonly cssClass: string;
  readonly dice?: D6System2eThemeDiceDefinition;
  readonly id: string;
  readonly label: string;
  readonly pauseIcon?: string;
  readonly tokens: Readonly<{
    readonly accent: string;
    readonly accentBright: string;
    readonly background: string;
    readonly muted: string;
    readonly text: string;
  }>;
}

export const D6_EQUIPMENT_ERAS = Object.freeze([
  "medieval",
  "modern",
  "science-fiction",
] as const);

export type D6EquipmentEra = (typeof D6_EQUIPMENT_ERAS)[number];
export type D6EquipmentEraSelection = D6EquipmentEra | "none";
export type D6EquipmentKind = "armor" | "gear" | "weapon";

export interface D6System2eEquipmentCatalogEntry {
  readonly era: D6EquipmentEra;
  readonly id: string;
  readonly kind: D6EquipmentKind;
  readonly name: string;
  readonly source: Readonly<{ readonly book: string; readonly page: number }>;
  readonly system: Readonly<Record<string, unknown>>;
}

export interface D6System2eEquipmentCatalogDefinition {
  readonly entries: readonly D6System2eEquipmentCatalogEntry[];
  readonly id: string;
  readonly label: string;
  readonly version: number;
}

export interface D6System2eResolvedEquipmentCatalog extends D6System2eEquipmentCatalogDefinition {
  readonly ownerId: string;
}

export interface D6System2eEquipmentCatalogRegistry {
  current(): readonly D6System2eResolvedEquipmentCatalog[];
  register(
    ownerId: string,
    definition: D6System2eEquipmentCatalogDefinition,
  ): void;
  unregisterOwner(ownerId: string): void;
}

export interface D6System2eTerminologyRegistry {
  current(): D6System2eResolvedTerminology;
  register(
    ownerId: string,
    contribution: D6System2eTerminologyContribution,
  ): void;
  unregisterOwner(ownerId: string): void;
}

export interface D6System2eThemeRegistry {
  current(): readonly D6System2eThemeDefinition[];
  register(ownerId: string, definition: D6System2eThemeDefinition): void;
  unregisterOwner(ownerId: string): void;
}
