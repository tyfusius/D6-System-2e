export const D6_EXTRAORDINARY_POWER_FRAMEWORK_CONTRACT_VERSION = 1 as const;
export const D6_EXTRAORDINARY_POWER_ROLL_PLAN_CONTRACT_VERSION = 1 as const;

export type D6ExtraordinaryPowerActivationStrategyV1 = "all-required-skills";
export type D6ExtraordinaryPowerActionPenaltyStrategyV1 =
  "one-per-maintained-power" | "one-per-skill-check";
export type D6ExtraordinaryPowerMaintenanceStrategyV1 =
  "active-toggle" | "none";
export type D6ExtraordinaryPowerResourceKindV1 =
  "consequence-track" | "roll-amplifier";
export type D6ExtraordinaryPowerResourceBindingV1 =
  "actor-extension-number" | "fate-points";

export interface D6ExtraordinaryPowerSkillRoleV1 {
  readonly id: string;
  readonly itemKey?: string;
  readonly label: string;
}

export interface D6ExtraordinaryPowerResourceRoleV1 {
  readonly binding: D6ExtraordinaryPowerResourceBindingV1;
  readonly extensionKey?: string;
  readonly id: string;
  readonly kind: D6ExtraordinaryPowerResourceKindV1;
  readonly label: string;
}

export interface D6ExtraordinaryPowerSkillCheckV1 {
  readonly difficulty: number;
  readonly difficultyMode?: "fixed" | "prompt";
  readonly skillRoleId: string;
}

export interface D6ExtraordinaryPowerDefinitionV1 {
  readonly checks: readonly D6ExtraordinaryPowerSkillCheckV1[];
  readonly id: string;
  readonly itemKey?: string;
  readonly label: string;
  readonly maintenance: D6ExtraordinaryPowerMaintenanceStrategyV1;
  readonly prerequisites?: readonly string[];
}

/**
 * Declarative only. A contribution describes data an engine-owned runtime may
 * execute; it cannot supply callbacks, mutate settings, or activate profiles.
 */
export interface D6ExtraordinaryPowerFrameworkV1 {
  readonly activation: Readonly<{
    readonly actionPenalty: "one-per-skill-check";
    readonly strategy: D6ExtraordinaryPowerActivationStrategyV1;
    readonly usesWildDie: boolean;
  }>;
  readonly id: string;
  readonly label: string;
  readonly maintenance: Readonly<{
    readonly actionPenalty: "one-per-maintained-power";
    readonly strategy: D6ExtraordinaryPowerMaintenanceStrategyV1;
  }>;
  readonly powers: readonly D6ExtraordinaryPowerDefinitionV1[];
  readonly resourceRoles: readonly D6ExtraordinaryPowerResourceRoleV1[];
  readonly skillRoles: readonly D6ExtraordinaryPowerSkillRoleV1[];
  readonly version: typeof D6_EXTRAORDINARY_POWER_FRAMEWORK_CONTRACT_VERSION;
}

export interface D6ResolvedExtraordinaryPowerFrameworkV1 extends D6ExtraordinaryPowerFrameworkV1 {
  readonly ownerId: string;
}

export interface D6System2eExtraordinaryPowerFrameworkRegistry {
  current(): readonly D6ResolvedExtraordinaryPowerFrameworkV1[];
  register(ownerId: string, framework: D6ExtraordinaryPowerFrameworkV1): void;
  unregisterOwner(ownerId: string): void;
}

export interface D6ExtraordinaryPowerSkillBindingV1 {
  readonly available: boolean;
  readonly itemId: string;
  readonly label: string;
  readonly roleId: string;
  readonly score: number;
}

export interface D6ExtraordinaryPowerStateV1 {
  readonly contractVersion: typeof D6_EXTRAORDINARY_POWER_FRAMEWORK_CONTRACT_VERSION;
  readonly frameworkId: string;
  readonly frameworkLabel: string;
  readonly maintainedPowerIds: readonly string[];
  readonly powers: readonly Readonly<{
    readonly available: boolean;
    readonly boundItemId: string;
    readonly id: string;
    readonly label: string;
    readonly maintained: boolean;
    readonly missingPowerIds: readonly string[];
    readonly missingRoleIds: readonly string[];
  }>[];
  readonly resources: readonly Readonly<{
    readonly id: string;
    readonly kind: D6ExtraordinaryPowerResourceKindV1;
    readonly label: string;
    readonly value?: number;
  }>[];
  readonly skillBindings: readonly D6ExtraordinaryPowerSkillBindingV1[];
}

export interface D6ExtraordinaryPowerActivationResultV1 {
  readonly activated: boolean;
  readonly contractVersion: typeof D6_EXTRAORDINARY_POWER_FRAMEWORK_CONTRACT_VERSION;
  readonly frameworkId: string;
  readonly powerId: string;
  readonly rolls: readonly D6RollResultV1[];
  readonly state: D6ExtraordinaryPowerStateV1;
}

export interface D6ExtraordinaryPowerRollStepV1 {
  readonly difficulty: number;
  readonly skillRoleId: string;
}

export interface D6ExtraordinaryPowerRollPlanV1 {
  readonly contractVersion: typeof D6_EXTRAORDINARY_POWER_ROLL_PLAN_CONTRACT_VERSION;
  readonly frameworkId: string;
  readonly label: string;
  readonly powerId?: string;
  readonly steps: readonly D6ExtraordinaryPowerRollStepV1[];
}

export interface D6ExtraordinaryPowerRollPlanResultV1 {
  readonly activated: boolean;
  readonly contractVersion: typeof D6_EXTRAORDINARY_POWER_ROLL_PLAN_CONTRACT_VERSION;
  readonly frameworkId: string;
  readonly overallSuccess: boolean;
  readonly powerId?: string;
  readonly rolls: readonly D6RollResultV1[];
  readonly state: D6ExtraordinaryPowerStateV1;
  readonly status: "cancelled" | "completed";
}

export interface D6System2eExtraordinaryPowersApi {
  activate(
    actor: object,
    frameworkId: string,
    powerId: string,
  ): Promise<D6ExtraordinaryPowerActivationResultV1>;
  bindPower(
    actor: object,
    frameworkId: string,
    powerId: string,
    itemId: string,
  ): Promise<D6ExtraordinaryPowerStateV1>;
  bindSkill(
    actor: object,
    frameworkId: string,
    roleId: string,
    itemId: string,
  ): Promise<D6ExtraordinaryPowerStateV1>;
  deactivate(
    actor: object,
    frameworkId: string,
    powerId: string,
  ): Promise<D6ExtraordinaryPowerStateV1>;
  execute(
    actor: object,
    plan: D6ExtraordinaryPowerRollPlanV1,
  ): Promise<D6ExtraordinaryPowerRollPlanResultV1>;
  read(actor: object, frameworkId: string): D6ExtraordinaryPowerStateV1;
  setConsequence(
    actor: object,
    frameworkId: string,
    resourceRoleId: string,
    value: number,
  ): Promise<D6ExtraordinaryPowerStateV1>;
  unbindPower(
    actor: object,
    frameworkId: string,
    powerId: string,
  ): Promise<D6ExtraordinaryPowerStateV1>;
  unbindSkill(
    actor: object,
    frameworkId: string,
    roleId: string,
  ): Promise<D6ExtraordinaryPowerStateV1>;
}
import type { D6RollResultV1 } from "./roll";
