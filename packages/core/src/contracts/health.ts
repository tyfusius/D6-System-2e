import type {
  SecondEditionCondition,
  SecondEditionPosture,
} from "../domain/combat";

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

export interface D6System2eHealthApi {
  condition(
    actor: object,
    proposed: SecondEditionCondition,
    options?: D6ConditionCommandOptions,
  ): Promise<D6ConditionCommandResultV1>;
  posture(
    actor: object,
    proposed: SecondEditionPosture,
  ): Promise<D6PostureCommandResultV1>;
}
