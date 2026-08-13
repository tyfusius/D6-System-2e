import {
  D6_EXTRAORDINARY_POWER_FRAMEWORK_CONTRACT_VERSION,
  type D6ExtraordinaryPowerActivationResultV1,
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
import { rollExtraordinaryPowerSkill } from "./rolls/roll-service";
import { integer, record, stringValue } from "./sheets/values";

interface StoredFrameworkState {
  readonly consequenceValues: Record<string, number>;
  readonly maintainedPowerIds: readonly string[];
  readonly powerBindings: Record<string, string>;
  readonly skillBindings: Record<string, string>;
}

const queues = new WeakMap<object, Promise<void>>();

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
  const skillItems = new Map(
    initial.skillBindings.map((binding) => [binding.roleId, binding.itemId]),
  );
  const frameworkPenaltyScore = Math.max(0, power.checks.length - 1) * 3;
  const rolls = [];
  for (const [index, check] of power.checks.entries()) {
    const itemId = skillItems.get(check.skillRoleId) ?? "";
    const roleLabel =
      definition.skillRoles.find(({ id }) => id === check.skillRoleId)?.label ??
      check.skillRoleId;
    const difficulty = await resolvedCheckDifficulty(
      power.label,
      roleLabel,
      check,
    );
    if (difficulty === null) break;
    const roll = await rollExtraordinaryPowerSkill(
      actor,
      itemId,
      {
        checkCount: power.checks.length,
        checkIndex: index + 1,
        frameworkId,
        frameworkPenaltyScore,
        maintainedPowerCount: initial.maintainedPowerIds.length,
        powerId,
        roleId: check.skillRoleId,
      },
      difficulty,
      power.label,
    );
    if (!roll) break;
    rolls.push(roll);
    if (roll.success !== true) break;
  }
  const activated =
    rolls.length === power.checks.length &&
    rolls.every(({ success }) => success === true);
  if (activated && power.maintenance === "active-toggle") {
    await queued(actor, async () => {
      const stored = storedFramework(actor, frameworkId);
      await persist(actor, frameworkId, {
        ...stored,
        maintainedPowerIds: [
          ...new Set([...stored.maintainedPowerIds, powerId]),
        ],
      });
    });
  }
  return Object.freeze({
    activated,
    contractVersion: D6_EXTRAORDINARY_POWER_FRAMEWORK_CONTRACT_VERSION,
    frameworkId,
    powerId,
    rolls: Object.freeze(rolls),
    state: readActorExtraordinaryPowers(actor, frameworkId),
  });
}
