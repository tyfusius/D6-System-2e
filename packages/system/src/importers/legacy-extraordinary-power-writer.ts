import type {
  ActorSource,
  D6LegacyExtraordinaryPowerActorWritePlanV1,
  D6LegacyExtraordinaryPowerWriteReportV1,
} from "@d6-system-2e/core";
import {
  bindExtraordinaryPowerItem,
  bindExtraordinaryPowerSkill,
  setExtraordinaryPowerConsequence,
} from "../foundry/extraordinary-power-service";

export interface LegacyExtraordinaryPowerWriteRepository {
  createActor(source: ActorSource): Promise<FoundryActorDocument>;
  existingActor(id: string): FoundryActorDocument | undefined;
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function sourceUuid(actor: FoundryActorDocument): string | undefined {
  const source = actor.toObject();
  const value = record(
    record(record(source.flags)?.["d6-system-2e"])?.legacyImport,
  )?.sourceUuid;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isCompleteExistingActor(
  actor: FoundryActorDocument,
  plan: D6LegacyExtraordinaryPowerActorWritePlanV1,
): boolean {
  const storageKey = plan.source.frameworkId
    ?.replaceAll("%", "%25")
    .replaceAll(".", "%2E");
  const framework = storageKey
    ? record(
        record(record(actor.system.extraordinaryPowers)?.frameworks)?.[
          storageKey
        ],
      )
    : {};
  return (
    sourceUuid(actor) === plan.source.uuid &&
    framework !== undefined &&
    plan.items.every(
      (item) => typeof item._id === "string" && actor.items.get(item._id),
    )
  );
}

function actorId(plan: D6LegacyExtraordinaryPowerActorWritePlanV1): string {
  if (typeof plan.actor._id !== "string" || plan.actor._id.length === 0) {
    throw new TypeError(
      "Every legacy Actor write plan requires a preserved _id.",
    );
  }
  return plan.actor._id;
}

function plannedFrameworks(
  plan: D6LegacyExtraordinaryPowerActorWritePlanV1,
): JsonRecord {
  return (
    record(record(plan.actor.system.extraordinaryPowers)?.frameworks) ?? {}
  );
}

async function persistFrameworkBindings(
  actor: FoundryActorDocument,
  plan: D6LegacyExtraordinaryPowerActorWritePlanV1,
  planned: JsonRecord,
): Promise<number> {
  if (!plan.source.frameworkId) return 0;
  const storageKey = plan.source.frameworkId
    .replaceAll("%", "%25")
    .replaceAll(".", "%2E");
  const framework = record(planned[storageKey]) ?? {};
  await actor.update(
    { "system.extraordinaryPowers.frameworks": {} },
    { d6System2eMigration: true },
  );
  let writes = 0;
  for (const [roleId, itemId] of Object.entries(
    record(framework.skillBindings) ?? {},
  )) {
    if (typeof itemId !== "string") continue;
    await bindExtraordinaryPowerSkill(
      actor,
      plan.source.frameworkId,
      roleId,
      itemId,
    );
    writes += 1;
  }
  for (const [powerId, itemId] of Object.entries(
    record(framework.powerBindings) ?? {},
  )) {
    if (typeof itemId !== "string") continue;
    await bindExtraordinaryPowerItem(
      actor,
      plan.source.frameworkId,
      powerId,
      itemId,
    );
    writes += 1;
  }
  for (const [resourceId, value] of Object.entries(
    record(framework.consequenceValues) ?? {},
  )) {
    if (!Number.isSafeInteger(value)) continue;
    await setExtraordinaryPowerConsequence(
      actor,
      plan.source.frameworkId,
      resourceId,
      Number(value),
    );
    writes += 1;
  }
  return writes;
}

function defaultRepository(): LegacyExtraordinaryPowerWriteRepository {
  return Object.freeze({
    createActor: async (source: ActorSource): Promise<FoundryActorDocument> => {
      const created = await Actor.create(source, { keepId: true });
      if (!created)
        throw new Error("Foundry did not return the created Actor.");
      return created;
    },
    existingActor: (id: string) => game.actors?.get(id),
  });
}

export function preflightLegacyExtraordinaryPowerActors(
  plans: readonly D6LegacyExtraordinaryPowerActorWritePlanV1[],
  repository: LegacyExtraordinaryPowerWriteRepository = defaultRepository(),
): Readonly<{
  idempotentSkips: readonly string[];
  unresolved: readonly string[];
}> {
  const ids = plans.map(actorId);
  if (new Set(ids).size !== ids.length) {
    throw new TypeError("Legacy Actor write plans must use unique Actor IDs.");
  }
  const idempotentSkips: string[] = [];
  const unresolved = plans.flatMap((plan) => plan.unresolved ?? []);
  if (unresolved.length === 0) {
    for (const plan of plans) {
      const id = actorId(plan);
      const existing = repository.existingActor(id);
      if (existing) {
        if (isCompleteExistingActor(existing, plan)) idempotentSkips.push(id);
        else unresolved.push(`actor-id-conflict:${id}`);
      }
    }
  }
  return Object.freeze({
    idempotentSkips: Object.freeze(idempotentSkips.sort()),
    unresolved: Object.freeze(unresolved.sort()),
  });
}

export async function writeLegacyExtraordinaryPowerActors(
  plans: readonly D6LegacyExtraordinaryPowerActorWritePlanV1[],
  repository: LegacyExtraordinaryPowerWriteRepository = defaultRepository(),
): Promise<D6LegacyExtraordinaryPowerWriteReportV1> {
  if (game.user?.isGM !== true) {
    throw new Error("Only a GM may run a legacy Actor import.");
  }
  const created: FoundryActorDocument[] = [];
  const preflight = preflightLegacyExtraordinaryPowerActors(plans, repository);
  const idempotentSkips = [...preflight.idempotentSkips];
  const unresolved = [...preflight.unresolved];
  let createdItems = 0;
  let frameworkWrites = 0;
  try {
    const ordered = [...plans].sort((left, right) =>
      actorId(left).localeCompare(actorId(right)),
    );
    if (unresolved.length > 0) {
      return Object.freeze({
        createdActors: Object.freeze([]),
        createdItems: 0,
        format: "d6-system-2e.legacy-extraordinary-power-write.v1",
        idempotentSkips: Object.freeze([]),
        rolledBackActors: Object.freeze([]),
        status: "failed",
        targetWrites: 0,
        unresolved: Object.freeze(unresolved),
      });
    }
    for (const plan of ordered) {
      const id = actorId(plan);
      if (repository.existingActor(id)) continue;
      const frameworkPlan = structuredClone(plannedFrameworks(plan));
      const actor = await repository.createActor(plan.actor);
      created.push(actor);
      if (actor.id !== id) throw new Error(`Actor ID ${id} was not preserved.`);
      if (plan.items.length > 0) {
        const embedded = await actor.createEmbeddedDocuments(
          "Item",
          plan.items,
          {
            d6System2eMigration: true,
            keepId: true,
          },
        );
        if (embedded.length !== plan.items.length) {
          throw new Error(
            `Actor ${id} created an incomplete embedded Item set.`,
          );
        }
        const expected = new Set(
          plan.items.flatMap((item) => (item._id ? [item._id] : [])),
        );
        if (
          expected.size !== plan.items.length ||
          embedded.some((item) => !expected.has(item.id))
        ) {
          throw new Error(
            `Actor ${id} did not preserve every embedded Item ID.`,
          );
        }
        createdItems += embedded.length;
      }
      frameworkWrites += await persistFrameworkBindings(
        actor,
        plan,
        frameworkPlan,
      );
    }
    return Object.freeze({
      createdActors: Object.freeze(created.map(({ id }) => id)),
      createdItems,
      format: "d6-system-2e.legacy-extraordinary-power-write.v1",
      idempotentSkips: Object.freeze(idempotentSkips),
      rolledBackActors: Object.freeze([]),
      status: "complete",
      targetWrites: created.length + createdItems + frameworkWrites,
      unresolved: Object.freeze(unresolved),
    });
  } catch (error) {
    const rolledBack: string[] = [];
    for (const actor of [...created].reverse()) {
      await actor.delete();
      rolledBack.push(actor.id);
    }
    return Object.freeze({
      createdActors: Object.freeze([]),
      createdItems: 0,
      format: "d6-system-2e.legacy-extraordinary-power-write.v1",
      idempotentSkips: Object.freeze(idempotentSkips),
      rolledBackActors: Object.freeze(rolledBack),
      status: "failed",
      targetWrites:
        created.length + createdItems + frameworkWrites + rolledBack.length,
      unresolved: Object.freeze([
        ...unresolved,
        `write-failed:${error instanceof Error ? error.message : String(error)}`,
      ]),
    });
  }
}
