import {
  MODEL_B_STIM_EFFECT_ID,
  MODEL_B_STIM_SECONDS_PER_ROUND,
} from "@d6-system-2e/core";
import type { D6RollMode } from "@d6-system-2e/core";
import type {
  FirstEditionActionRoot,
  FirstEditionActorBinding,
  FirstEditionStageSpec,
} from "./first-edition-action-contract";
import {
  appendFirstEditionActionStages,
  completeFirstEditionAction,
  createFirstEditionActionRoot,
  FirstEditionActionError,
  parseFirstEditionActionRoot,
} from "./first-edition-action-root";
import {
  canonical,
  keys,
  object,
  text,
} from "./first-edition-action-validation";

export interface MedicalConsumableItemBindingV1 {
  readonly actorUuid: string;
  readonly itemId: string;
  readonly itemUuid: string;
  readonly beforeQuantity: number;
}

export interface MedicalConsumableRootV1 {
  readonly version: 1;
  readonly useId: string;
  readonly initiatorUserId: string;
  readonly item: MedicalConsumableItemBindingV1;
  readonly injury: "wounded" | "severely-wounded";
  readonly rollMode: D6RollMode;
  readonly action: FirstEditionActionRoot;
}

function effectSpec(value: MedicalConsumableRootV1): FirstEditionStageSpec {
  const duration = value.action.stages[0]?.receipt;
  const patient = value.action.subjects.find(
    ({ role }) => role === "patient",
  )?.actor;
  const administrator = value.action.subjects.find(
    ({ role }) => role === "administrator",
  )?.actor;
  if (
    duration?.kind !== "plain-d6" ||
    duration.total < 1 ||
    duration.total > 6 ||
    !patient ||
    !administrator
  )
    throw new FirstEditionActionError("invalid");
  return {
    kind: "effect",
    subject: patient,
    controllerUserId: value.action.stages[0]?.spec.controllerUserId ?? "",
    plan: {
      kind: "medical-consumable-use",
      actorUuid: patient.actorUuid,
      administratorActorUuid: administrator.actorUuid,
      itemUuid: value.item.itemUuid,
      useId: value.useId,
      effectId: MODEL_B_STIM_EFFECT_ID,
      durationRoll: duration.total,
      durationSeconds: duration.total * MODEL_B_STIM_SECONDS_PER_ROUND,
      actionCost: { value: 1, unit: "actions" },
      doseCost: { value: 1, unit: "doses" },
      beforeQuantity: { value: value.item.beforeQuantity, unit: "doses" },
      physiology: "biological",
      injury: value.injury,
    },
  };
}

export function createMedicalConsumableRoot(input: {
  readonly rootMessageId: string;
  readonly useId: string;
  readonly initiatorUserId: string;
  readonly coordinatorUserId: string;
  readonly controllerUserId: string;
  readonly administrator: FirstEditionActorBinding;
  readonly patient: FirstEditionActorBinding;
  readonly item: MedicalConsumableItemBindingV1;
  readonly injury: MedicalConsumableRootV1["injury"];
  readonly rollMode: D6RollMode;
  readonly runtime: FirstEditionActionRoot["runtime"];
}): MedicalConsumableRootV1 {
  if (
    !input.useId ||
    !["publicroll", "gmroll", "selfroll", "blindroll"].includes(
      input.rollMode,
    ) ||
    input.item.actorUuid !== input.administrator.actorUuid ||
    input.item.beforeQuantity < 1 ||
    !Number.isSafeInteger(input.item.beforeQuantity) ||
    input.runtime.damageStrategyId !== "open-d6.damage.wounds" ||
    input.runtime.healthModelId !== "open-d6.health.wound-track"
  )
    throw new FirstEditionActionError("invalid");
  return {
    version: 1,
    useId: input.useId,
    initiatorUserId: input.initiatorUserId,
    item: structuredClone(input.item),
    injury: input.injury,
    rollMode: input.rollMode,
    action: createFirstEditionActionRoot({
      rootMessageId: input.rootMessageId,
      operationId: input.useId,
      coordinatorUserId: input.coordinatorUserId,
      initiation: "medical-consumable",
      runtime: input.runtime,
      subjects: [
        { role: "administrator", actor: input.administrator },
        { role: "patient", actor: input.patient },
      ],
      stages: [
        {
          id: `${input.useId}:duration`,
          spec: {
            kind: "plain-d6",
            subject: input.administrator,
            controllerUserId: input.controllerUserId,
            purpose: "duration",
            unit: "rounds",
            dice: 1,
          },
        },
      ],
    }),
  };
}

export function advanceMedicalConsumableRoot(
  value: MedicalConsumableRootV1,
): MedicalConsumableRootV1 {
  if (
    value.action.status !== "open" ||
    value.action.stages.some(({ state }) => state !== "recorded")
  )
    return value;
  if (value.action.stages.some(({ spec }) => spec.kind === "effect"))
    return { ...value, action: completeFirstEditionAction(value.action) };
  return {
    ...value,
    action: appendFirstEditionActionStages(value.action, [
      { id: `${value.useId}:effect`, spec: effectSpec(value) },
    ]),
  };
}

export function medicalConsumableRootCanCancel(
  value: MedicalConsumableRootV1,
): boolean {
  return (
    value.action.status === "open" &&
    value.action.stages.every(({ state }) => state === "pending")
  );
}

export function parseMedicalConsumableRoot(
  raw: unknown,
): MedicalConsumableRootV1 | null {
  try {
    const value = object(raw);
    const item = object(value?.item);
    const action = parseFirstEditionActionRoot(value?.action);
    if (
      !value ||
      !keys(value, [
        "version",
        "useId",
        "initiatorUserId",
        "item",
        "injury",
        "rollMode",
        "action",
      ]) ||
      value.version !== 1 ||
      !text(value.useId) ||
      !text(value.initiatorUserId) ||
      !item ||
      !keys(item, ["actorUuid", "itemId", "itemUuid", "beforeQuantity"]) ||
      !text(item.actorUuid) ||
      !text(item.itemId) ||
      !text(item.itemUuid) ||
      !Number.isSafeInteger(item.beforeQuantity) ||
      Number(item.beforeQuantity) < 1 ||
      !["wounded", "severely-wounded"].includes(String(value.injury)) ||
      !["publicroll", "gmroll", "selfroll", "blindroll"].includes(
        String(value.rollMode),
      ) ||
      action?.initiation !== "medical-consumable" ||
      action.operationId !== value.useId
    )
      return null;
    const root = value as unknown as MedicalConsumableRootV1;
    const administrator = action.subjects.find(
      ({ role }) => role === "administrator",
    )?.actor;
    const patient = action.subjects.find(
      ({ role }) => role === "patient",
    )?.actor;
    if (!administrator || !patient) return null;
    const expected = createMedicalConsumableRoot({
      rootMessageId: action.rootMessageId,
      useId: root.useId,
      initiatorUserId: root.initiatorUserId,
      coordinatorUserId: action.coordinatorUserId,
      controllerUserId: action.stages[0]?.spec.controllerUserId ?? "",
      administrator,
      patient,
      item: root.item,
      injury: root.injury,
      rollMode: root.rollMode,
      runtime: action.runtime,
    });
    const first = action.stages[0];
    if (
      !first ||
      canonical(first.spec) !== canonical(expected.action.stages[0]?.spec) ||
      action.stages.length > 2
    )
      return null;
    const effect = action.stages[1];
    if (
      effect &&
      (first.state !== "recorded" ||
        effect.id !== `${root.useId}:effect` ||
        canonical(effect.spec) !== canonical(effectSpec(root)))
    )
      return null;
    if (action.status === "complete" && effect?.receipt?.kind !== "effect")
      return null;
    return root;
  } catch {
    return null;
  }
}
