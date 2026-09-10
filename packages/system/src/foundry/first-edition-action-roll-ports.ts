import type {
  FirstEditionActionRoot,
  FirstEditionActionStage,
  FirstEditionRollRuntime,
  FirstEditionStageReceipt,
} from "../application/first-edition-action-contract";
import {
  createFirstEditionRollPorts,
  type FirstEditionActionStorePorts,
  type FirstEditionStageBinding,
} from "../application/first-edition-action-ports";
import { FirstEditionActionError } from "../application/first-edition-action-root";
import {
  hydrateD6FoundryRolls,
  serializeD6FoundryRolls,
} from "./initiating-action-message";
import {
  persistFreeD6FeatureRollAudit,
  privacySafeFreeD6FeatureRollResult,
} from "./free-d6-feature-service";
import { privacySafeDistinctionRollResult } from "./distinction-automation-service";

/** Inactive wrapper seam. The consumer supplies its existing authority,
 * persistence and strategy dispatch; this adapter elects nobody and opens no UI. */
export function createFoundryFirstEditionRollPorts(
  binding: FirstEditionStageBinding,
  actor: FoundryActorDocument & { readonly uuid: string },
  ports: FirstEditionActionStorePorts & {
    runtime(): FirstEditionRollRuntime;
    present(
      root: FirstEditionActionRoot,
      stage: FirstEditionActionStage,
      receipt: Exclude<FirstEditionStageReceipt, { kind: "effect" }>,
    ): Promise<void>;
  },
) {
  const sanitize = <
    T extends {
      request: Parameters<
        typeof privacySafeFreeD6FeatureRollResult
      >[0]["request"];
    },
  >(
    value: T,
  ): T =>
    privacySafeDistinctionRollResult(privacySafeFreeD6FeatureRollResult(value));
  return createFirstEditionRollPorts<FoundryRoll>(binding, {
    ...ports,
    authorize: async (command, root, stage, phase) => {
      if (
        actor.id !== stage.spec.subject.actorId ||
        actor.uuid !== stage.spec.subject.actorUuid
      )
        throw new FirstEditionActionError("authority");
      await ports.authorize(command, root, stage, phase);
    },
    sanitizeRequest: (request) => sanitize({ request }).request,
    sanitizeResult: sanitize,
    serialize: serializeD6FoundryRolls,
    validateArtifacts: async (artifacts) => {
      await hydrateD6FoundryRolls(artifacts);
    },
    audit: (result, rootMessageId, stageId) =>
      persistFreeD6FeatureRollAudit(actor, rootMessageId, result, stageId),
  });
}
