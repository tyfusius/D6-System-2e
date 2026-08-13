import {
  D6_EXTRAORDINARY_POWER_FRAMEWORK_CONTRACT_VERSION,
  type D6ExtraordinaryPowerDefinitionV1,
  type D6ExtraordinaryPowerFrameworkV1,
  type D6ExtraordinaryPowerResourceRoleV1,
  type D6ResolvedExtraordinaryPowerFrameworkV1,
  type D6System2eExtraordinaryPowerFrameworkRegistry,
} from "@d6-system-2e/core";

const frameworks = new Map<string, D6ResolvedExtraordinaryPowerFrameworkV1>();
const ID_PATTERN = /^[a-z][a-z0-9.-]*$/u;
const MAINTENANCE_STRATEGIES = ["active-toggle", "none"] as const;
const RESOURCE_KINDS = ["consequence-track", "roll-amplifier"] as const;
const RESOURCE_BINDINGS = ["actor-extension-number", "fate-points"] as const;

function stableId(value: string, field: string): string {
  const normalized = value.trim();
  if (!ID_PATTERN.test(normalized)) {
    throw new TypeError(`${field} must be a stable lowercase ID.`);
  }
  return normalized;
}

function label(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${field} must not be empty.`);
  return normalized;
}

function normalizeResource(
  resource: D6ExtraordinaryPowerResourceRoleV1,
): D6ExtraordinaryPowerResourceRoleV1 {
  const id = stableId(resource.id, "Extraordinary-power resource role ID");
  if (
    !RESOURCE_KINDS.includes(resource.kind) ||
    !RESOURCE_BINDINGS.includes(resource.binding)
  ) {
    throw new TypeError(`Resource role ${id} uses an unsupported strategy.`);
  }
  if (
    resource.kind === "roll-amplifier" &&
    resource.binding !== "fate-points"
  ) {
    throw new TypeError(`Resource role ${id} has an incompatible binding.`);
  }
  if (
    resource.kind === "consequence-track" &&
    resource.binding !== "actor-extension-number"
  ) {
    throw new TypeError(`Resource role ${id} has an incompatible binding.`);
  }
  const extensionKey = resource.extensionKey?.trim();
  if (
    (resource.binding === "actor-extension-number" && !extensionKey) ||
    (resource.binding !== "actor-extension-number" && extensionKey)
  ) {
    throw new TypeError(`Resource role ${id} has invalid extension storage.`);
  }
  return Object.freeze({
    binding: resource.binding,
    ...(extensionKey
      ? {
          extensionKey: stableId(
            extensionKey,
            `Resource role ${id} extension key`,
          ),
        }
      : {}),
    id,
    kind: resource.kind,
    label: label(resource.label, `Resource role ${id} label`),
  });
}

function normalizePower(
  power: D6ExtraordinaryPowerDefinitionV1,
  skillRoleIds: ReadonlySet<string>,
): D6ExtraordinaryPowerDefinitionV1 {
  const id = stableId(power.id, "Extraordinary power ID");
  if (!MAINTENANCE_STRATEGIES.includes(power.maintenance)) {
    throw new TypeError(
      `Power ${id} uses an unsupported maintenance strategy.`,
    );
  }
  if (power.checks.length === 0) {
    throw new TypeError(`Extraordinary power ${id} requires a skill check.`);
  }
  const checks = power.checks.map((check) => {
    const skillRoleId = stableId(
      check.skillRoleId,
      `Power ${id} skill role ID`,
    );
    if (!skillRoleIds.has(skillRoleId)) {
      throw new TypeError(
        `Power ${id} uses unknown skill role ${skillRoleId}.`,
      );
    }
    if (!Number.isSafeInteger(check.difficulty) || check.difficulty < 0) {
      throw new TypeError(
        `Power ${id} difficulty must be a non-negative integer.`,
      );
    }
    if (
      check.difficultyMode !== undefined &&
      !["fixed", "prompt"].includes(check.difficultyMode)
    ) {
      throw new TypeError(`Power ${id} uses an invalid difficulty mode.`);
    }
    return Object.freeze({
      difficulty: check.difficulty,
      ...(check.difficultyMode && check.difficultyMode !== "fixed"
        ? { difficultyMode: check.difficultyMode }
        : {}),
      skillRoleId,
    });
  });
  if (
    new Set(checks.map(({ skillRoleId }) => skillRoleId)).size !== checks.length
  ) {
    throw new TypeError(`Power ${id} repeats a skill role.`);
  }
  const prerequisites = (power.prerequisites ?? []).map((entry) =>
    stableId(entry, `Power ${id} prerequisite ID`),
  );
  if (
    prerequisites.includes(id) ||
    new Set(prerequisites).size !== prerequisites.length
  ) {
    throw new TypeError(`Power ${id} has invalid prerequisites.`);
  }
  return Object.freeze({
    checks: Object.freeze(checks),
    id,
    ...(power.itemKey
      ? { itemKey: stableId(power.itemKey, `Power ${id} Item key`) }
      : {}),
    label: label(power.label, `Power ${id} label`),
    maintenance: power.maintenance,
    ...(prerequisites.length
      ? { prerequisites: Object.freeze(prerequisites) }
      : {}),
  });
}

function normalizeFramework(
  ownerId: string,
  framework: D6ExtraordinaryPowerFrameworkV1,
): D6ResolvedExtraordinaryPowerFrameworkV1 {
  const owner = stableId(ownerId, "Extraordinary-power framework owner ID");
  const id = stableId(framework.id, "Extraordinary-power framework ID");
  const contractVersion: unknown = Reflect.get(framework, "version");
  if (contractVersion !== D6_EXTRAORDINARY_POWER_FRAMEWORK_CONTRACT_VERSION) {
    throw new RangeError(
      `Framework ${id} uses an unsupported contract version.`,
    );
  }
  const activationStrategy: unknown = Reflect.get(
    framework.activation,
    "strategy",
  );
  const activationActionPenalty: unknown = Reflect.get(
    framework.activation,
    "actionPenalty",
  );
  const maintenanceActionPenalty: unknown = Reflect.get(
    framework.maintenance,
    "actionPenalty",
  );
  if (
    activationStrategy !== "all-required-skills" ||
    activationActionPenalty !== "one-per-skill-check" ||
    typeof framework.activation.usesWildDie !== "boolean" ||
    maintenanceActionPenalty !== "one-per-maintained-power" ||
    !MAINTENANCE_STRATEGIES.includes(framework.maintenance.strategy)
  ) {
    throw new TypeError(
      `Framework ${id} uses an unsupported execution strategy.`,
    );
  }
  const skillRoles = framework.skillRoles.map((role) =>
    Object.freeze({
      id: stableId(role.id, `Framework ${id} skill role ID`),
      ...(role.itemKey
        ? {
            itemKey: stableId(
              role.itemKey,
              `Framework ${id} skill role Item key`,
            ),
          }
        : {}),
      label: label(role.label, `Framework ${id} skill role label`),
    }),
  );
  if (
    skillRoles.length === 0 ||
    new Set(skillRoles.map(({ id: roleId }) => roleId)).size !==
      skillRoles.length
  ) {
    throw new TypeError(`Framework ${id} requires unique skill roles.`);
  }
  const resourceRoles = framework.resourceRoles.map(normalizeResource);
  if (
    new Set(resourceRoles.map(({ id: roleId }) => roleId)).size !==
    resourceRoles.length
  ) {
    throw new TypeError(`Framework ${id} repeats a resource role.`);
  }
  const skillRoleIds = new Set(skillRoles.map(({ id: roleId }) => roleId));
  const powers = framework.powers.map((power) =>
    normalizePower(power, skillRoleIds),
  );
  const powerIds = new Set(powers.map(({ id: powerId }) => powerId));
  if (powerIds.size !== powers.length) {
    throw new TypeError(`Framework ${id} repeats a power ID.`);
  }
  for (const power of powers) {
    const missing = power.prerequisites?.find((entry) => !powerIds.has(entry));
    if (missing)
      throw new TypeError(
        `Power ${power.id} requires unknown power ${missing}.`,
      );
  }
  return Object.freeze({
    activation: Object.freeze({
      actionPenalty: "one-per-skill-check" as const,
      strategy: "all-required-skills" as const,
      usesWildDie: framework.activation.usesWildDie,
    }),
    id,
    label: label(framework.label, `Framework ${id} label`),
    maintenance: Object.freeze({
      actionPenalty: "one-per-maintained-power" as const,
      strategy: framework.maintenance.strategy,
    }),
    ownerId: owner,
    powers: Object.freeze(powers),
    resourceRoles: Object.freeze(resourceRoles),
    skillRoles: Object.freeze(skillRoles),
    version: D6_EXTRAORDINARY_POWER_FRAMEWORK_CONTRACT_VERSION,
  });
}

export const extraordinaryPowerFrameworkRegistry: D6System2eExtraordinaryPowerFrameworkRegistry =
  Object.freeze({
    current: () => Object.freeze([...frameworks.values()]),
    register: (ownerId: string, framework: D6ExtraordinaryPowerFrameworkV1) => {
      const normalized = normalizeFramework(ownerId, framework);
      const existing = frameworks.get(normalized.id);
      if (existing && existing.ownerId !== normalized.ownerId) {
        throw new Error(
          `Extraordinary-power framework ${normalized.id} is already owned by ${existing.ownerId}.`,
        );
      }
      frameworks.set(normalized.id, normalized);
    },
    unregisterOwner: (ownerId: string) => {
      for (const [frameworkId, framework] of frameworks) {
        if (framework.ownerId === ownerId) frameworks.delete(frameworkId);
      }
    },
  });

export function resolvedExtraordinaryPowerFramework(
  frameworkId: string,
): D6ResolvedExtraordinaryPowerFrameworkV1 | null {
  return frameworks.get(frameworkId) ?? null;
}

export function resetExtraordinaryPowerFrameworkRegistryForTests(): void {
  frameworks.clear();
}
