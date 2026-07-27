import type { SecondEditionCondition } from "../domain/combat";

export interface D6ConditionCommandOptions {
  readonly preventStunnedWithHeroPoint?: boolean;
}

export interface D6ConditionCommandResultV1 {
  readonly current: SecondEditionCondition;
  readonly heroPointSpent: 0 | 1;
  readonly previous: SecondEditionCondition;
  readonly prevented: boolean;
}

export interface D6System2eHealthApi {
  condition(
    actor: object,
    proposed: SecondEditionCondition,
    options?: D6ConditionCommandOptions,
  ): Promise<D6ConditionCommandResultV1>;
}
