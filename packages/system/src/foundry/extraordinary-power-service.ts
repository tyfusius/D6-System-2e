import {
  D6_EXTRAORDINARY_POWER_FRAMEWORK_CONTRACT_VERSION,
  D6_EXTRAORDINARY_POWER_ROLL_PLAN_CONTRACT_VERSION,
  type D6ExtraordinaryPowerActivationResultV1,
  type D6ExtraordinaryPowerRollPlanResultV1,
  type D6ExtraordinaryPowerRollPlanV1,
  type D6ExtraordinaryPowerStateV1,
} from "@d6-system-2e/core";
import {
  currentCombinedPipScore,
  currentEffectivePipScore,
} from "../settings/pip-rules";
import {
  extraordinaryPowerFrameworkRegistry,
  resolvedExtraordinaryPowerFramework,
} from "../registries/extraordinary-powers";
import { withAuthorizedExtraordinaryPowerUpdate } from "./mechanical-edit-guard";
import {
  postExtraordinaryPowerRollSummary,
  type ExtraordinaryPowerSummaryPublication,
} from "./extraordinary-power-roll-summary";
import {
  rollExtraordinaryPowerSkill,
  rollExtraordinaryPowerSkillDirect,
} from "./rolls/roll-service";
import { integer, record, stringValue } from "./sheets/values";

interface StoredFrameworkState {
  readonly consequenceValues: Record<string, number>;
  readonly maintainedPowerIds: readonly string[];
  readonly powerBindings: Record<string, string>;
  readonly skillBindings: Record<string, string>;
}

const queues = new WeakMap<object, Promise<void>>();
const summaryPresentations = new WeakMap<
  D6ExtraordinaryPowerRollPlanResultV1,
  Readonly<{
    actor: FoundryActorDocument;
    label: string;
    publication: ExtraordinaryPowerSummaryPublication;
    steps: readonly Readonly<{ difficulty: number; label: string }>[];
  }>
>();

function frameworkStorageKey(frameworkId: string): string {
  return frameworkId.replaceAll("%", "%25").replaceAll(".", "%2E");
}

function dynamicStorageKey(id: string): string {
  return id.replaceAll("%", "%25").replaceAll(".", "%2E");
}

function dynamicRuntimeKey(id: string): string {
  return id.replaceAll("%2E", ".").replaceAll("%25", "%");
}

function actorDocument(value: object): FoundryActorDocument {
  const actor = value as Partial<FoundryActorDocument>;
  if (
    typeof actor.id !== "string" ||
    typeof actor.system !== "object" ||
    typeof actor.update !== "function" ||
    typeof actor.items !== "object"
  ) {
    throw new TypeError(
      "Extraordinary powers require a Foundry Actor document.",
    );
  }
  return actor as FoundryActorDocument;
}

function framework(frameworkId: string) {
  const resolved = resolvedExtraordinaryPowerFramework(frameworkId);
  if (!resolved)
    throw new RangeError(
      `Unknown extraordinary-power framework ${frameworkId}.`,
    );
  return resolved;
}

function storedFramework(
  actor: FoundryActorDocument,
  frameworkId: string,
): StoredFrameworkState {
  const frameworks = record(
    record(actor.system.extraordinaryPowers).frameworks,
  );
  const stored = record(
    frameworks[frameworkStorageKey(frameworkId)] ?? frameworks[frameworkId],
  );
  const stringEntries = (value: unknown): Record<string, string> =>
    Object.fromEntries(
      Object.entries(record(value)).flatMap(([key, entry]) =>
        typeof entry === "string" && entry
          ? [[dynamicRuntimeKey(key), entry]]
          : [],
      ),
    );
  const consequenceValues = Object.fromEntries(
    Object.entries(record(stored.consequenceValues)).flatMap(([key, value]) =>
      Number.isSafeInteger(value) && Number(value) >= 0
        ? [[dynamicRuntimeKey(key), Number(value)]]
        : [],
    ),
  );
  return Object.freeze({
    consequenceValues,
    maintainedPowerIds: Object.freeze(
      Array.isArray(stored.maintainedPowerIds)
        ? stored.maintainedPowerIds.filter(
            (value): value is string =>
              typeof value === "string" && value.length > 0,
          )
        : [],
    ),
    powerBindings: stringEntries(stored.powerBindings),
    skillBindings: stringEntries(stored.skillBindings),
  });
}

function skillScore(actor: FoundryActorDocument, itemId: string): number {
  const item = actor.items.get(itemId);
  if (item?.type !== "skill") return 0;
  if (
    item.system.training === "advanced" ||
    item.system.training === "psionic"
  ) {
    return currentEffectivePipScore(integer(item.system.score));
  }
  const attribute = record(
    record(actor.system.attributes)[stringValue(item.system.attributeId)],
  );
  return currentCombinedPipScore(
    integer(attribute.score),
    integer(item.system.score),
  );
}

export function readActorExtraordinaryPowers(
  actorValue: object,
  frameworkId: string,
): D6ExtraordinaryPowerStateV1 {
  const actor = actorDocument(actorValue);
  const definition = framework(frameworkId);
  const stored = storedFramework(actor, frameworkId);
  const boundPowerIds = new Set(
    Object.entries(stored.powerBindings).flatMap(([powerId, itemId]) =>
      actor.items.get(itemId)?.type === "manifestation" ? [powerId] : [],
    ),
  );
  const skillBindings = definition.skillRoles.map((role) => {
    const itemId = stored.skillBindings[role.id] ?? "";
    const item = actor.items.get(itemId);
    const available = item?.type === "skill";
    return Object.freeze({
      available,
      itemId: available ? itemId : "",
      label: available ? item.name : role.label,
      roleId: role.id,
      score: available ? skillScore(actor, itemId) : 0,
    });
  });
  const availableRoleIds = new Set(
    skillBindings
      .filter(({ available }) => available)
      .map(({ roleId }) => roleId),
  );
  const maintainedPowerIds = stored.maintainedPowerIds.filter((powerId) =>
    definition.powers.some(
      ({ id, maintenance }) =>
        id === powerId &&
        maintenance === "active-toggle" &&
        boundPowerIds.has(id),
    ),
  );
  return Object.freeze({
    contractVersion: D6_EXTRAORDINARY_POWER_FRAMEWORK_CONTRACT_VERSION,
    frameworkId,
    frameworkLabel: definition.label,
    maintainedPowerIds: Object.freeze(maintainedPowerIds),
    powers: Object.freeze(
      definition.powers.map((power) => {
        const missingRoleIds = power.checks
          .map(({ skillRoleId }) => skillRoleId)
          .filter((roleId) => !availableRoleIds.has(roleId));
        const missingPowerIds = (power.prerequisites ?? []).filter(
          (powerId) => !boundPowerIds.has(powerId),
        );
        const boundItemId = stored.powerBindings[power.id] ?? "";
        const bound = actor.items.get(boundItemId)?.type === "manifestation";
        return Object.freeze({
          available:
            bound &&
            missingRoleIds.length === 0 &&
            missingPowerIds.length === 0,
          boundItemId: bound ? boundItemId : "",
          id: power.id,
          label: power.label,
          maintained: maintainedPowerIds.includes(power.id),
          missingPowerIds: Object.freeze(missingPowerIds),
          missingRoleIds: Object.freeze(missingRoleIds),
        });
      }),
    ),
    resources: Object.freeze(
      definition.resourceRoles.map((role) =>
        Object.freeze({
          id: role.id,
          kind: role.kind,
          label: role.label,
          ...(role.kind === "consequence-track"
            ? { value: stored.consequenceValues[role.id] ?? 0 }
            : {}),
        }),
      ),
    ),
    skillBindings: Object.freeze(skillBindings),
  });
}

async function queued<T>(actor: object, work: () => Promise<T>): Promise<T> {
  const previous = queues.get(actor) ?? Promise.resolve();
  let release = (): void => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  queues.set(actor, tail);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (queues.get(actor) === tail) queues.delete(actor);
  }
}

async function persist(
  actor: FoundryActorDocument,
  frameworkId: string,
  value: StoredFrameworkState,
): Promise<void> {
  const storedValue = {
    ...value,
    consequenceValues: Object.fromEntries(
      Object.entries(value.consequenceValues).map(([key, entry]) => [
        dynamicStorageKey(key),
        entry,
      ]),
    ),
    powerBindings: Object.fromEntries(
      Object.entries(value.powerBindings).map(([key, entry]) => [
        dynamicStorageKey(key),
        entry,
      ]),
    ),
    skillBindings: Object.fromEntries(
      Object.entries(value.skillBindings).map(([key, entry]) => [
        dynamicStorageKey(key),
        entry,
      ]),
    ),
  };
  const frameworks = {
    ...record(record(actor.system.extraordinaryPowers).frameworks),
    [frameworkStorageKey(frameworkId)]: storedValue,
  };
  await withAuthorizedExtraordinaryPowerUpdate(actor, () =>
    actor.update({ "system.extraordinaryPowers.frameworks": frameworks }),
  );
}

function requireOwner(actor: FoundryActorDocument): void {
  if (actor.isOwner !== true)
    throw new Error("D6E2.ExtraordinaryPower.OwnerRequired");
}

async function resolvedCheckDifficulty(
  powerLabel: string,
  roleLabel: string,
  check: Readonly<{ difficulty: number; difficultyMode?: "fixed" | "prompt" }>,
): Promise<number | null> {
  if (check.difficultyMode !== "prompt") return check.difficulty;
  return foundry.applications.api.DialogV2.wait<number | null>({
    buttons: [
      {
        action: "cancel",
        callback: () => null,
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "roll",
        callback: (_event, button) => {
          const control = button.form?.elements.namedItem(
            "extraordinaryPowerDifficulty",
          );
          return control instanceof HTMLInputElement
            ? Math.max(0, Math.trunc(control.valueAsNumber || 0))
            : check.difficulty;
        },
        default: true,
        label: game.i18n.localize("D6E2.Roll.Action"),
      },
    ],
    classes: ["d6e2", "od6roll-dialog"],
    content: `<div class="od6-dialog-shell"><p>${game.i18n.format("D6E2.ExtraordinaryPower.VariableDifficultyHelp", { power: powerLabel, role: roleLabel })}</p><label><span>${game.i18n.localize("D6E2.Roll.Difficulty")}</span><input type="number" name="extraordinaryPowerDifficulty" value="${check.difficulty}" min="0" step="1" /></label></div>`,
    modal: true,
    rejectClose: false,
    window: {
      title: game.i18n.localize(
        "D6E2.ExtraordinaryPower.VariableDifficultyTitle",
      ),
    },
  });
}

export async function bindExtraordinaryPowerSkill(
  actorValue: object,
  frameworkId: string,
  roleId: string,
  itemId: string,
): Promise<D6ExtraordinaryPowerStateV1> {
  const actor = actorDocument(actorValue);
  requireOwner(actor);
  const definition = framework(frameworkId);
  if (!definition.skillRoles.some(({ id }) => id === roleId)) {
    throw new RangeError(`Unknown extraordinary-power role ${roleId}.`);
  }
  if (actor.items.get(itemId)?.type !== "skill") {
    throw new RangeError(
      `Extraordinary-power role ${roleId} requires an embedded Skill.`,
    );
  }
  return queued(actor, async () => {
    const stored = storedFramework(actor, frameworkId);
    await persist(actor, frameworkId, {
      ...stored,
      skillBindings: { ...stored.skillBindings, [roleId]: itemId },
    });
    return readActorExtraordinaryPowers(actor, frameworkId);
  });
}

export async function bindExtraordinaryPowerItem(
  actorValue: object,
  frameworkId: string,
  powerId: string,
  itemId: string,
): Promise<D6ExtraordinaryPowerStateV1> {
  const actor = actorDocument(actorValue);
  requireOwner(actor);
  const definition = framework(frameworkId);
  if (!definition.powers.some(({ id }) => id === powerId)) {
    throw new RangeError(`Unknown extraordinary power ${powerId}.`);
  }
  if (actor.items.get(itemId)?.type !== "manifestation") {
    throw new RangeError(
      `Extraordinary power ${powerId} requires an embedded Manifestation.`,
    );
  }
  return queued(actor, async () => {
    const stored = storedFramework(actor, frameworkId);
    await persist(actor, frameworkId, {
      ...stored,
      powerBindings: { ...stored.powerBindings, [powerId]: itemId },
    });
    return readActorExtraordinaryPowers(actor, frameworkId);
  });
}

export async function bindMatchingExtraordinaryPowerItems(
  actorValue: object,
  itemIds: readonly string[],
): Promise<number> {
  const actor = actorDocument(actorValue);
  requireOwner(actor);
  const items = itemIds.flatMap((itemId) => {
    const item = actor.items.get(itemId);
    return item ? [item] : [];
  });
  if (items.length === 0) return 0;
  return queued(actor, async () => {
    const frameworks = {
      ...record(record(actor.system.extraordinaryPowers).frameworks),
    };
    let bindings = 0;
    for (const definition of extraordinaryPowerFrameworkRegistry.current()) {
      const stored = storedFramework(actor, definition.id);
      const skillBindings = { ...stored.skillBindings };
      const powerBindings = { ...stored.powerBindings };
      let frameworkChanged = false;
      for (const item of items) {
        const itemKey = stringValue(item.system.key);
        if (!itemKey) continue;
        if (item.type === "skill") {
          const role = definition.skillRoles.find(
            ({ itemKey: roleItemKey }) => roleItemKey === itemKey,
          );
          if (role && skillBindings[role.id] !== item.id) {
            skillBindings[role.id] = item.id;
            bindings += 1;
            frameworkChanged = true;
          }
        }
        if (item.type === "manifestation") {
          const power = definition.powers.find(
            ({ id, itemKey: powerItemKey }) => (powerItemKey ?? id) === itemKey,
          );
          if (power && powerBindings[power.id] !== item.id) {
            powerBindings[power.id] = item.id;
            bindings += 1;
            frameworkChanged = true;
          }
        }
      }
      if (frameworkChanged) {
        frameworks[frameworkStorageKey(definition.id)] = {
          ...stored,
          powerBindings,
          skillBindings,
        };
      }
    }
    if (bindings > 0) {
      await withAuthorizedExtraordinaryPowerUpdate(actor, () =>
        actor.update({ "system.extraordinaryPowers.frameworks": frameworks }),
      );
    }
    return bindings;
  });
}

export async function unbindExtraordinaryPowerSkill(
  actorValue: object,
  frameworkId: string,
  roleId: string,
): Promise<D6ExtraordinaryPowerStateV1> {
  const actor = actorDocument(actorValue);
  requireOwner(actor);
  const definition = framework(frameworkId);
  if (!definition.skillRoles.some(({ id }) => id === roleId)) {
    throw new RangeError(`Unknown extraordinary-power role ${roleId}.`);
  }
  return queued(actor, async () => {
    const stored = storedFramework(actor, frameworkId);
    const skillBindings = { ...stored.skillBindings, [roleId]: "" };
    const invalidatedPowerIds = new Set(
      definition.powers
        .filter(({ checks }) =>
          checks.some(({ skillRoleId }) => skillRoleId === roleId),
        )
        .map(({ id }) => id),
    );
    await persist(actor, frameworkId, {
      ...stored,
      maintainedPowerIds: stored.maintainedPowerIds.filter(
        (powerId) => !invalidatedPowerIds.has(powerId),
      ),
      skillBindings,
    });
    return readActorExtraordinaryPowers(actor, frameworkId);
  });
}

export async function unbindExtraordinaryPowerItem(
  actorValue: object,
  frameworkId: string,
  powerId: string,
): Promise<D6ExtraordinaryPowerStateV1> {
  const actor = actorDocument(actorValue);
  requireOwner(actor);
  const definition = framework(frameworkId);
  if (!definition.powers.some(({ id }) => id === powerId)) {
    throw new RangeError(`Unknown extraordinary power ${powerId}.`);
  }
  return queued(actor, async () => {
    const stored = storedFramework(actor, frameworkId);
    const powerBindings = { ...stored.powerBindings, [powerId]: "" };
    await persist(actor, frameworkId, {
      ...stored,
      maintainedPowerIds: stored.maintainedPowerIds.filter(
        (id) => id !== powerId,
      ),
      powerBindings,
    });
    return readActorExtraordinaryPowers(actor, frameworkId);
  });
}

export async function setExtraordinaryPowerConsequence(
  actorValue: object,
  frameworkId: string,
  resourceRoleId: string,
  value: number,
): Promise<D6ExtraordinaryPowerStateV1> {
  const actor = actorDocument(actorValue);
  requireOwner(actor);
  const role = framework(frameworkId).resourceRoles.find(
    ({ id }) => id === resourceRoleId,
  );
  if (role?.kind !== "consequence-track") {
    throw new RangeError(
      `Unknown extraordinary-power consequence ${resourceRoleId}.`,
    );
  }
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(
      "An extraordinary-power consequence must be a nonnegative integer.",
    );
  }
  return queued(actor, async () => {
    const stored = storedFramework(actor, frameworkId);
    await persist(actor, frameworkId, {
      ...stored,
      consequenceValues: {
        ...stored.consequenceValues,
        [resourceRoleId]: value,
      },
    });
    return readActorExtraordinaryPowers(actor, frameworkId);
  });
}

export async function deactivateExtraordinaryPower(
  actorValue: object,
  frameworkId: string,
  powerId: string,
): Promise<D6ExtraordinaryPowerStateV1> {
  const actor = actorDocument(actorValue);
  requireOwner(actor);
  framework(frameworkId);
  return queued(actor, async () => {
    const stored = storedFramework(actor, frameworkId);
    await persist(actor, frameworkId, {
      ...stored,
      maintainedPowerIds: stored.maintainedPowerIds.filter(
        (id) => id !== powerId,
      ),
    });
    return readActorExtraordinaryPowers(actor, frameworkId);
  });
}

export async function rollExtraordinaryPowerRoleSkill(
  actorValue: object,
  frameworkId: string,
  roleId: string,
): Promise<D6ExtraordinaryPowerRollPlanResultV1["rolls"][number] | null> {
  const actor = actorDocument(actorValue);
  requireOwner(actor);
  const definition = framework(frameworkId);
  if (!definition.skillRoles.some(({ id }) => id === roleId)) {
    throw new RangeError(`Unknown extraordinary-power Skill role ${roleId}.`);
  }
  const state = readActorExtraordinaryPowers(actor, frameworkId);
  const binding = state.skillBindings.find(
    ({ roleId: candidateRoleId }) => candidateRoleId === roleId,
  );
  if (binding?.available !== true) {
    throw new Error("D6E2.ExtraordinaryPower.BindingsRequired");
  }
  return rollExtraordinaryPowerSkillDirect(actor, binding.itemId, {
    checkCount: 1,
    checkIndex: 1,
    frameworkId,
    frameworkPenaltyScore: 0,
    maintainedPowerCount: state.maintainedPowerIds.length,
    powerId: "direct-skill-roll",
    roleId,
  });
}

export async function activateExtraordinaryPower(
  actorValue: object,
  frameworkId: string,
  powerId: string,
): Promise<D6ExtraordinaryPowerActivationResultV1> {
  const actor = actorDocument(actorValue);
  requireOwner(actor);
  const definition = framework(frameworkId);
  const power = definition.powers.find(({ id }) => id === powerId);
  const initial = readActorExtraordinaryPowers(actor, frameworkId);
  const statePower = initial.powers.find(({ id }) => id === powerId);
  if (!power || !statePower)
    throw new RangeError(`Unknown extraordinary power ${powerId}.`);
  if (!statePower.available)
    throw new Error("D6E2.ExtraordinaryPower.BindingsRequired");
  if (statePower.maintained)
    throw new Error("D6E2.ExtraordinaryPower.AlreadyMaintained");
  if (!definition.activation.usesWildDie) {
    throw new Error("D6E2.ExtraordinaryPower.WildDieStrategyUnsupported");
  }
  const steps = [];
  for (const check of power.checks) {
    const roleLabel =
      definition.skillRoles.find(({ id }) => id === check.skillRoleId)?.label ??
      check.skillRoleId;
    const difficulty = await resolvedCheckDifficulty(
      power.label,
      roleLabel,
      check,
    );
    if (difficulty === null) {
      return Object.freeze({
        activated: false,
        contractVersion: D6_EXTRAORDINARY_POWER_FRAMEWORK_CONTRACT_VERSION,
        frameworkId,
        powerId,
        rolls: Object.freeze([]),
        state: initial,
      });
    }
    steps.push(Object.freeze({ difficulty, skillRoleId: check.skillRoleId }));
  }
  const result = await executeExtraordinaryPowerRollPlan(actor, {
    contractVersion: D6_EXTRAORDINARY_POWER_ROLL_PLAN_CONTRACT_VERSION,
    frameworkId,
    label: power.label,
    powerId,
    steps,
  });
  return Object.freeze({
    activated: result.activated,
    contractVersion: D6_EXTRAORDINARY_POWER_FRAMEWORK_CONTRACT_VERSION,
    frameworkId,
    powerId,
    rolls: result.rolls,
    state: result.state,
  });
}

interface ResolvedRollPlan {
  readonly actor: FoundryActorDocument;
  readonly frameworkId: string;
  readonly label: string;
  readonly powerId?: string;
  readonly registeredPowerId?: string;
  readonly state: D6ExtraordinaryPowerStateV1;
  readonly steps: readonly Readonly<{
    readonly difficulty: number;
    readonly itemId: string;
    readonly roleId: string;
  }>[];
}

export interface ExtraordinaryPowerRollProgress {
  readonly activeIndex?: number;
  readonly checkCount: number;
  readonly completedRolls: readonly D6ExtraordinaryPowerRollPlanResultV1["rolls"][number][];
  readonly status: "finalizing" | "interrupted" | "rolling";
}

export interface ExtraordinaryPowerPresentationFailure {
  readonly error: unknown;
  readonly kind: "progress" | "summary";
}

export interface ExecuteExtraordinaryPowerRollPlanOptions {
  readonly onProgress?: (
    progress: ExtraordinaryPowerRollProgress,
  ) => Promise<void> | void;
  readonly onPresentationFailure?: (
    failure: ExtraordinaryPowerPresentationFailure,
  ) => Promise<void> | void;
}

async function reportPresentationFailure(
  options: ExecuteExtraordinaryPowerRollPlanOptions,
  failure: ExtraordinaryPowerPresentationFailure,
): Promise<void> {
  try {
    await options.onPresentationFailure?.(failure);
  } catch {
    // Presentation reporting is never authoritative for completed rolls.
  }
}

async function projectProgress(
  options: ExecuteExtraordinaryPowerRollPlanOptions,
  progress: ExtraordinaryPowerRollProgress,
): Promise<void> {
  try {
    await options.onProgress?.(progress);
  } catch (error) {
    await reportPresentationFailure(options, { error, kind: "progress" });
  }
}

function resolveRollPlan(
  actorValue: object,
  plan: D6ExtraordinaryPowerRollPlanV1,
): ResolvedRollPlan {
  const actor = actorDocument(actorValue);
  requireOwner(actor);
  const contractVersion = (plan as { readonly contractVersion: unknown })
    .contractVersion;
  if (contractVersion !== D6_EXTRAORDINARY_POWER_ROLL_PLAN_CONTRACT_VERSION) {
    throw new RangeError("D6E2.ExtraordinaryPower.RollPlanVersionUnsupported");
  }
  const definition = framework(plan.frameworkId);
  if (!definition.activation.usesWildDie) {
    throw new Error("D6E2.ExtraordinaryPower.WildDieStrategyUnsupported");
  }
  const label = plan.label.trim();
  if (!label || label.length > 160) {
    throw new RangeError("D6E2.ExtraordinaryPower.RollPlanLabelInvalid");
  }
  if (plan.steps.length === 0) {
    throw new RangeError("D6E2.ExtraordinaryPower.RollPlanEmpty");
  }
  const state = readActorExtraordinaryPowers(actor, definition.id);
  const bindings = new Map(
    state.skillBindings.map((binding) => [binding.roleId, binding]),
  );
  const roleIds = new Set<string>();
  const steps = plan.steps.map((step) => {
    const role = definition.skillRoles.find(
      ({ id }) => id === step.skillRoleId,
    );
    if (!role || roleIds.has(step.skillRoleId)) {
      throw new RangeError("D6E2.ExtraordinaryPower.RollPlanRoleInvalid");
    }
    roleIds.add(step.skillRoleId);
    if (!Number.isSafeInteger(step.difficulty) || step.difficulty < 0) {
      throw new RangeError("D6E2.ExtraordinaryPower.RollPlanDifficultyInvalid");
    }
    const binding = bindings.get(step.skillRoleId);
    const item = binding?.available
      ? actor.items.get(binding.itemId)
      : undefined;
    if (item?.type !== "skill") {
      throw new Error("D6E2.ExtraordinaryPower.BindingsRequired");
    }
    return Object.freeze({
      difficulty: step.difficulty,
      itemId: item.id,
      roleId: step.skillRoleId,
    });
  });
  const sourcePower = plan.powerId
    ? definition.powers.find(({ id }) => id === plan.powerId)
    : undefined;
  if (plan.powerId && !sourcePower) {
    throw new RangeError(`Unknown extraordinary power ${plan.powerId}.`);
  }
  const statePower = sourcePower
    ? state.powers.find(({ id }) => id === sourcePower.id)
    : undefined;
  if (sourcePower && statePower?.available !== true) {
    throw new Error("D6E2.ExtraordinaryPower.BindingsRequired");
  }
  if (sourcePower && statePower?.maintained) {
    throw new Error("D6E2.ExtraordinaryPower.AlreadyMaintained");
  }
  const matchesRegisteredPower =
    sourcePower?.checks.length === steps.length &&
    sourcePower.checks.every((check, index) => {
      const step = steps[index];
      return (
        check.skillRoleId === step?.roleId &&
        (check.difficultyMode === "prompt" ||
          check.difficulty === step.difficulty)
      );
    });
  const registeredPowerId = matchesRegisteredPower ? sourcePower.id : undefined;
  return Object.freeze({
    actor,
    frameworkId: definition.id,
    label,
    ...(plan.powerId ? { powerId: plan.powerId } : {}),
    ...(registeredPowerId ? { registeredPowerId } : {}),
    state,
    steps: Object.freeze(steps),
  });
}

export async function executeExtraordinaryPowerRollPlan(
  actorValue: object,
  plan: D6ExtraordinaryPowerRollPlanV1,
  options: ExecuteExtraordinaryPowerRollPlanOptions = {},
): Promise<D6ExtraordinaryPowerRollPlanResultV1> {
  const resolved = resolveRollPlan(actorValue, plan);
  const frameworkPenaltyScore = Math.max(0, resolved.steps.length - 1) * 3;
  const rolls = [];
  let cancelled = false;
  for (const [index, step] of resolved.steps.entries()) {
    await projectProgress(options, {
      activeIndex: index,
      checkCount: resolved.steps.length,
      completedRolls: Object.freeze([...rolls]),
      status: "rolling",
    });
    const roll = await rollExtraordinaryPowerSkill(
      resolved.actor,
      step.itemId,
      {
        checkCount: resolved.steps.length,
        checkIndex: index + 1,
        frameworkId: resolved.frameworkId,
        frameworkPenaltyScore,
        maintainedPowerCount: resolved.state.maintainedPowerIds.length,
        powerId: resolved.registeredPowerId ?? "custom-roll-plan",
        roleId: step.roleId,
      },
      step.difficulty,
      resolved.label,
    );
    if (!roll) {
      cancelled = true;
      await projectProgress(options, {
        activeIndex: index,
        checkCount: resolved.steps.length,
        completedRolls: Object.freeze([...rolls]),
        status: "interrupted",
      });
      break;
    }
    rolls.push(roll);
    await projectProgress(options, {
      ...(index + 1 < resolved.steps.length ? { activeIndex: index + 1 } : {}),
      checkCount: resolved.steps.length,
      completedRolls: Object.freeze([...rolls]),
      status: index + 1 < resolved.steps.length ? "rolling" : "finalizing",
    });
  }
  const overallSuccess =
    !cancelled &&
    rolls.length === resolved.steps.length &&
    rolls.every(({ success }) => success === true);
  const sourcePower = resolved.registeredPowerId
    ? framework(resolved.frameworkId).powers.find(
        ({ id }) => id === resolved.registeredPowerId,
      )
    : undefined;
  const activated =
    overallSuccess && sourcePower?.maintenance === "active-toggle";
  const registeredPowerId = resolved.registeredPowerId;
  if (activated && registeredPowerId) {
    await queued(resolved.actor, async () => {
      const stored = storedFramework(resolved.actor, resolved.frameworkId);
      await persist(resolved.actor, resolved.frameworkId, {
        ...stored,
        maintainedPowerIds: [
          ...new Set([...stored.maintainedPowerIds, registeredPowerId]),
        ],
      });
    });
  }
  const result = Object.freeze({
    activated,
    contractVersion: D6_EXTRAORDINARY_POWER_ROLL_PLAN_CONTRACT_VERSION,
    frameworkId: resolved.frameworkId,
    overallSuccess,
    ...(resolved.registeredPowerId
      ? { powerId: resolved.registeredPowerId }
      : {}),
    rolls: Object.freeze(rolls),
    state: readActorExtraordinaryPowers(resolved.actor, resolved.frameworkId),
    status: cancelled ? "cancelled" : "completed",
  });
  const summary = Object.freeze({
    actor: resolved.actor,
    label: resolved.label,
    publication: { completedAudienceIndexes: new Set<number>() },
    steps: Object.freeze(
      resolved.steps.map(({ difficulty, roleId }) => ({
        difficulty,
        label:
          framework(resolved.frameworkId).skillRoles.find(
            ({ id }) => id === roleId,
          )?.label ?? roleId,
      })),
    ),
  });
  summaryPresentations.set(result, summary);
  try {
    await postExtraordinaryPowerRollSummary(
      summary.actor,
      summary.label,
      result.rolls,
      summary.steps,
      result.overallSuccess,
      result.status,
      summary.publication,
    );
  } catch (error) {
    await reportPresentationFailure(options, { error, kind: "summary" });
  }
  return result;
}

export async function retryExtraordinaryPowerRollSummary(
  result: D6ExtraordinaryPowerRollPlanResultV1,
): Promise<void> {
  const summary = summaryPresentations.get(result);
  if (!summary) throw new Error("D6E2.ExtraordinaryPower.SummaryInvalid");
  await postExtraordinaryPowerRollSummary(
    summary.actor,
    summary.label,
    result.rolls,
    summary.steps,
    result.overallSuccess,
    result.status,
    summary.publication,
  );
}
