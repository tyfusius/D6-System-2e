import { requireDestinyValue } from "@d6-system-2e/core";
import type {
  D6ExtraordinaryPowerRollPlanV1,
  D6DestinyTemptationV1,
  D6RollRequestV1,
  D6RollResultV1,
} from "@d6-system-2e/core";
import {
  destinyEnabled,
  refreshDestinyView,
  requestDestiny,
} from "./destiny-service";
import { requireDestinyFramework } from "./destiny-consequence";
import { resolvedExtraordinaryPowerFramework } from "../registries/extraordinary-powers";
import { foundryRandomId } from "./foundry-random-id";

export interface DestinyPowerLifecycle {
  readonly activationId: string;
  previous(index: number): D6RollResultV1 | undefined;
  beforeDice(index: number, request: D6RollRequestV1): Promise<void>;
  unrollable(index: number, result: D6RollResultV1): Promise<void>;
  capture(
    index: number,
    result: D6RollResultV1,
    artifacts: readonly FoundryRoll[],
  ): Promise<void>;
  complete(): Promise<void>;
}

/** Called only by the shared registered/custom power-plan executor, never a direct skill roll. */
export async function prepareDestinyPower(
  actor: FoundryActorDocument,
  frameworkId: string,
  checks: readonly { itemId: string; roleId: string; difficulty: number }[],
  activationId?: string,
  plan?: D6ExtraordinaryPowerRollPlanV1,
): Promise<DestinyPowerLifecycle | undefined> {
  if (
    !resolvedExtraordinaryPowerFramework(frameworkId)?.destinyTemptation ||
    !destinyEnabled()
  )
    return undefined;
  const definition = requireDestinyFramework(frameworkId);
  const id = activationId ?? foundryRandomId();
  const view = await refreshDestinyView();
  let current: D6DestinyTemptationV1 | undefined = view.temptations[id];
  if (
    current &&
    (current.actorId !== actor.id ||
      current.frameworkId !== frameworkId ||
      JSON.stringify(current.checks) !== JSON.stringify(checks))
  )
    throw new Error("D6E2.Destiny.Error.ActivationIdentity");
  if (
    current?.plan &&
    JSON.stringify(current.plan) !==
      JSON.stringify({ ...plan, activationId: id })
  )
    throw new Error("D6E2.Destiny.Error.ActivationIdentity");
  if (current)
    requireDestinyFramework(
      current.frameworkId,
      current.ownerId,
      current.resourceRoleId,
    );
  const skipped: Record<string, D6RollResultV1> = {};
  return {
    activationId: id,
    unrollable: async (index, result) => {
      skipped[index] = result;
      if (current) {
        if (!current.rollRequests?.[index])
          current = (
            await requestDestiny({
              kind: "claim-power-roll",
              activationId: id,
              index,
              request: result.request,
            })
          ).temptations[id];
        current = (
          await requestDestiny(
            { kind: "record-power-roll", activationId: id, index, result },
            [],
          )
        ).temptations[id];
      }
    },
    previous: (index) => current?.rollResults?.[index],
    beforeDice: async (index, request) => {
      requireDestinyFramework(
        frameworkId,
        definition.ownerId,
        requireDestinyValue(definition.destinyTemptation)
          .consequenceResourceRoleId,
      );
      if (!current) {
        const state = await requestDestiny({
          kind: "sample",
          activation: {
            id,
            actorId: actor.id,
            frameworkId,
            ownerId: definition.ownerId,
            resourceRoleId: requireDestinyValue(definition.destinyTemptation)
              .consequenceResourceRoleId,
            checks,
            rollResults: skipped,
            ...(plan ? { plan: { ...plan, activationId: id } } : {}),
          },
        });
        current = state.temptations[id];
      }
      if (current?.rollRequests?.[index])
        throw new Error("D6E2.Destiny.Error.PendingRecovery");
      current = (
        await requestDestiny({
          kind: "claim-power-roll",
          activationId: id,
          index,
          request,
        })
      ).temptations[id];
    },
    capture: async (index, result, artifacts) => {
      current = (
        await requestDestiny(
          { kind: "record-power-roll", activationId: id, index, result },
          artifacts,
        )
      ).temptations[id];
    },
    complete: async () => {
      if (current && !current.completed)
        current = (
          await requestDestiny({ kind: "complete-power", activationId: id })
        ).temptations[id];
    },
  };
}
