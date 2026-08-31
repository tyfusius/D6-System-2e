import type {
  AdvancementKind,
  SecondEditionNarrativeArc,
  SecondEditionNarrativeRewardKind,
} from "../domain/advancement";

export interface D6AdvancementResultV1 {
  readonly cost: number;
  readonly kind: AdvancementKind;
  readonly remaining: number;
  readonly remainingCharacterPoints: number;
  readonly resource:
    | "character-points"
    | "experience-points"
    | "hero-points"
    | "milestone-attribute-dice"
    | "milestone-skill-pips";
  readonly score: number;
  readonly strategy:
    | "open-d6-character-points"
    | "d6mv-split-resources"
    | "second-edition-experience-points"
    | "second-edition-milestone";
}

export interface D6MilestoneBalanceV1 {
  readonly attributeDice: number;
  readonly skillPips: number;
}

export interface D6NarrativeArcProposalV1 {
  readonly rewardId: string;
  readonly rewardKind: SecondEditionNarrativeRewardKind;
  readonly rewardName?: string;
  readonly steps: readonly string[];
  readonly title: string;
}

export interface D6NarrativeAdvancementResultV1 {
  readonly arc: SecondEditionNarrativeArc;
  readonly changed: boolean;
}

export interface D6System2eAdvancementApi {
  attribute(actor: object, attributeId: string): Promise<D6AdvancementResultV1>;
  item(actor: object, itemId: string): Promise<D6AdvancementResultV1>;
  specialization(
    actor: object,
    parentSkillId: string,
    name: string,
  ): Promise<D6AdvancementResultV1>;
  readonly milestone: {
    award(actor: object): Promise<D6MilestoneBalanceV1>;
    exchangeForPerk(
      actor: object,
      perkId: string | null,
      name?: string,
    ): Promise<D6MilestoneBalanceV1>;
    read(actor: object): D6MilestoneBalanceV1;
  };
  readonly narrative: {
    approve(
      actor: object,
      arcId: string,
    ): Promise<D6NarrativeAdvancementResultV1>;
    complete(
      actor: object,
      arcId: string,
    ): Promise<D6NarrativeAdvancementResultV1>;
    propose(
      actor: object,
      proposal: D6NarrativeArcProposalV1,
    ): Promise<D6NarrativeAdvancementResultV1>;
    read(actor: object): readonly SecondEditionNarrativeArc[];
    remove(actor: object, arcId: string): Promise<boolean>;
    toggleStep(
      actor: object,
      arcId: string,
      stepId: string,
    ): Promise<D6NarrativeAdvancementResultV1>;
  };
}
