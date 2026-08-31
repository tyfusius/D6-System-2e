export const D6_CONSEQUENCE_SUITE_CONTRACT_VERSION = 1 as const;

export type D6ConsequenceChannelKind = "counter" | "physical-health";

export interface D6ConsequenceChannelDefinitionV1 {
  readonly id: string;
  readonly kind: D6ConsequenceChannelKind;
  readonly label: string;
  readonly penaltyStrategyId: string;
  readonly recoveryStrategyId: string;
  readonly resolutionStrategyId: string;
  readonly terminalStrategyId: string;
}

export interface D6ConsequenceSuiteV1 {
  readonly channels: readonly D6ConsequenceChannelDefinitionV1[];
  readonly id: string;
  readonly label: string;
  readonly stackingStrategyId: string;
  readonly version: typeof D6_CONSEQUENCE_SUITE_CONTRACT_VERSION;
}

export interface D6ActorConsequenceChannelStateV1 {
  readonly channelId: string;
  readonly level: number;
  readonly revision: number;
  readonly source: string;
  readonly unconscious: boolean;
}

export interface D6ActorConsequenceStateV1 {
  readonly channels: Readonly<Record<string, D6ActorConsequenceChannelStateV1>>;
  readonly version: typeof D6_CONSEQUENCE_SUITE_CONTRACT_VERSION;
}

export interface D6ConsequencePenaltyEffectV1 {
  readonly channelId: string;
  readonly label: string;
  readonly penaltyScore: number;
  readonly scope: "all-rolls" | "none";
  readonly stackingGroup: string;
}

export interface D6ConsequencePenaltyProjectionV1 {
  readonly effects: readonly D6ConsequencePenaltyEffectV1[];
  readonly totalPenaltyScore: number;
}

export interface D6System2eConsequenceSuiteRegistry {
  current(): readonly D6ConsequenceSuiteV1[];
  register(ownerId: string, suite: D6ConsequenceSuiteV1): void;
  unregisterOwner(ownerId: string): void;
}
