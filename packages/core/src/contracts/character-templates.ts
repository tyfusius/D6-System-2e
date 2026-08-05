export const D6_CHARACTER_TEMPLATE_CONTRACT_VERSION = 2 as const;

export type D6CharacterTemplateRulesFamily =
  "d6-system-second-edition" | "open-d6-first-edition";

export type D6CharacterTemplateItemKind =
  | "advantage"
  | "armor"
  | "asset"
  | "cybernetic"
  | "disadvantage"
  | "flaw"
  | "gear"
  | "manifestation"
  | "perk"
  | "skill"
  | "specialability"
  | "specialization"
  | "talent"
  | "trouble"
  | "weapon";

export interface D6CharacterTemplateItemV1 {
  readonly img?: string;
  readonly name: string;
  readonly sourceUuid?: string;
  readonly system: Readonly<Record<string, unknown>>;
  readonly type: D6CharacterTemplateItemKind;
}

export interface D6CharacterTemplateSuperpowerV1 {
  readonly definitionId: string;
  readonly focus?: string;
  readonly rank: number;
}

export interface D6CharacterTemplateSuperheroicV1 {
  /** Printed pp. 238–239 templates use exactly 10D of starting Superpowers. */
  readonly superpowerCreationDice: 10;
  readonly superpowers: readonly D6CharacterTemplateSuperpowerV1[];
}

export interface D6CharacterTemplateV1 {
  readonly attributeScores: Readonly<Record<string, number>>;
  readonly firstEdition?: Readonly<{
    readonly biography?: string;
    readonly characterPoints?: number;
    readonly fatePoints?: number;
    readonly move?: number;
  }>;
  readonly id: string;
  readonly items?: readonly D6CharacterTemplateItemV1[];
  readonly label: string;
  readonly rulesFamily: D6CharacterTemplateRulesFamily;
  readonly source: Readonly<{ readonly book: string; readonly page: number }>;
  readonly suggestedSkillKeys: readonly string[];
  readonly superheroic?: D6CharacterTemplateSuperheroicV1;
  /** Printed Attribute dice deliberately left for the player to assign. */
  readonly unassignedAttributeScore?: number;
  readonly version: typeof D6_CHARACTER_TEMPLATE_CONTRACT_VERSION;
}

export interface D6CharacterTemplateCatalogV1 {
  readonly id: string;
  readonly label: string;
  readonly templates: readonly D6CharacterTemplateV1[];
  readonly version: typeof D6_CHARACTER_TEMPLATE_CONTRACT_VERSION;
}

export interface D6ResolvedCharacterTemplateCatalogV1 extends D6CharacterTemplateCatalogV1 {
  readonly ownerId: string;
}

export interface D6System2eCharacterTemplateRegistry {
  current(): readonly D6ResolvedCharacterTemplateCatalogV1[];
  register(ownerId: string, catalog: D6CharacterTemplateCatalogV1): void;
  unregisterOwner(ownerId: string): void;
}

export type D6CharacterTemplateIssueCode =
  | "actor-type"
  | "already-applied"
  | "attribute-budget"
  | "attribute-ids"
  | "attribute-score"
  | "creation-inactive"
  | "owner-required"
  | "rules-family"
  | "superheroic-profile"
  | "superpower-budget"
  | "superpower-invalid"
  | "superpower-missing"
  | "suggested-skill-missing"
  | "template-missing";

export interface D6CharacterTemplatePreviewV1 {
  readonly attributeChanges: readonly {
    readonly attributeId: string;
    readonly currentScore: number;
    readonly nextScore: number;
  }[];
  readonly canApply: boolean;
  readonly catalogId: string;
  readonly catalogLabel: string;
  readonly itemAdditions: readonly {
    readonly name: string;
    readonly type: D6CharacterTemplateItemKind;
  }[];
  readonly issues: readonly D6CharacterTemplateIssueCode[];
  readonly ownerId: string;
  readonly source: Readonly<{ readonly book: string; readonly page: number }>;
  readonly suggestedSkills: readonly {
    readonly key: string;
    readonly name: string;
  }[];
  readonly rulesFamily: D6CharacterTemplateRulesFamily | "superheroic";
  readonly superpowerAdditions: readonly {
    readonly definitionId: string;
    readonly focus: string;
    readonly name: string;
    readonly rank: number;
    readonly totalCost: number;
  }[];
  readonly superpowerCreationDice: number;
  readonly templateId: string;
  readonly templateLabel: string;
  readonly templateVersion: number;
  readonly unassignedAttributeScore: number;
  readonly version: typeof D6_CHARACTER_TEMPLATE_CONTRACT_VERSION;
}

export interface D6CharacterTemplateApplicationV1 {
  readonly actorId: string;
  readonly createdItemIds: readonly string[];
  readonly preview: D6CharacterTemplatePreviewV1;
  readonly version: typeof D6_CHARACTER_TEMPLATE_CONTRACT_VERSION;
}

export interface D6System2eCharacterTemplateApi {
  apply(
    actor: unknown,
    templateId: string,
  ): Promise<D6CharacterTemplateApplicationV1>;
  preview(actor: unknown, templateId: string): D6CharacterTemplatePreviewV1;
}
