import type {
  FirstEditionWoundLevel,
  SecondEditionCondition,
  SecondEditionPosture,
} from "../domain/combat";
import type { FirstEditionBodyPointState } from "../domain/first-edition-body-points";
import type {
  D6HealthDamageStrategyId,
  D6HealthModelKind,
  D6HealthTrackStateV2,
} from "./health-models";

export const D6_ACTOR_HEALTH_PROJECTION_VERSION = 2 as const;

export interface D6ActorHealthProjectionV1 {
  readonly contractVersion: typeof D6_ACTOR_HEALTH_PROJECTION_VERSION;
  readonly damageStrategyId: D6HealthDamageStrategyId;
  readonly kind: D6HealthModelKind;
  readonly modelId: string;
  readonly modelLabel: string;
  readonly pool?: FirstEditionBodyPointState;
  readonly track?: {
    readonly currentState: D6HealthTrackStateV2;
    readonly currentStateId: string;
    readonly states: readonly D6HealthTrackStateV2[];
  };
}

export interface D6HealthProjectionCommandResultV1 {
  readonly current: D6ActorHealthProjectionV1;
  readonly previous: D6ActorHealthProjectionV1;
}

export interface D6HealthTrackCommandResultV1 extends D6HealthProjectionCommandResultV1 {
  readonly heroPointSpent: 0 | 1;
  readonly prevented: boolean;
}

export interface D6ConditionCommandOptions {
  readonly preventStunnedWithHeroPoint?: boolean;
}

export interface D6ConditionCommandResultV1 {
  readonly current: SecondEditionCondition;
  readonly heroPointSpent: 0 | 1;
  readonly previous: SecondEditionCondition;
  readonly prevented: boolean;
}

export interface D6PostureCommandResultV1 {
  readonly current: SecondEditionPosture;
  readonly previous: SecondEditionPosture;
}

export interface D6FirstEditionWoundCommandResultV1 {
  readonly current: FirstEditionWoundLevel;
  readonly previous: FirstEditionWoundLevel;
}

export interface D6System2eHealthApi {
  bodyPoints(
    actor: object,
    proposed: FirstEditionBodyPointState,
  ): Promise<FirstEditionBodyPointState>;
  condition(
    actor: object,
    proposed: SecondEditionCondition,
    options?: D6ConditionCommandOptions,
  ): Promise<D6ConditionCommandResultV1>;
  damagePool(
    actor: object,
    amount: number,
  ): Promise<D6HealthProjectionCommandResultV1>;
  healPool(
    actor: object,
    amount: number,
  ): Promise<D6HealthProjectionCommandResultV1>;
  posture(
    actor: object,
    proposed: SecondEditionPosture,
  ): Promise<D6PostureCommandResultV1>;
  read(actor: object): D6ActorHealthProjectionV1;
  setPool(
    actor: object,
    proposed: FirstEditionBodyPointState,
  ): Promise<D6HealthProjectionCommandResultV1>;
  setTrack(
    actor: object,
    proposedStateId: string,
    options?: D6ConditionCommandOptions,
  ): Promise<D6HealthTrackCommandResultV1>;
  wound(
    actor: object,
    proposed: FirstEditionWoundLevel,
  ): Promise<D6FirstEditionWoundCommandResultV1>;
}
