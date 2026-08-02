import {
  D6_PSIONIC_DISCIPLINES,
  D6_PSIONICS_CONTRACT_VERSION,
  type D6PsionicDiscipline,
  type D6PsionicsStateV1,
  type D6PsionicTrainingMethod,
} from "@d6-system-2e/core";
import { psionicPowerRegistry } from "../registries/psionics";
import { currentSecondEditionCampaignProfile } from "../settings/campaign-profile";
import { currentEffectivePipScore } from "../settings/pip-rules";
import {
  withAuthorizedAdvancementUpdate,
  withAuthorizedPsionicsUpdate,
} from "./mechanical-edit-guard";
import { integer, record, stringValue } from "./sheets/values";

const WINDOW_SECONDS = 24 * 60 * 60;

function actorDocument(value: object): FoundryActorDocument {
  if (!("items" in value) || !("system" in value)) {
    throw new TypeError("Psionics requires a Foundry Actor document.");
  }
  return value as FoundryActorDocument;
}

export function psionicWorldTime(): number {
  const value = Number(
    (game as unknown as { readonly time?: { readonly worldTime?: number } })
      .time?.worldTime,
  );
  return Number.isFinite(value) && value >= 0 ? value : Date.now() / 1000;
}

function disciplineItem(actor: FoundryActorDocument, id: D6PsionicDiscipline) {
  return actor.items.contents.find(
    (item) =>
      item.type === "skill" &&
      stringValue(item.system.key) === `psionics-${id}` &&
      stringValue(item.system.training) === "psionic",
  );
}

export function psionicAttempts(
  actor: FoundryActorDocument,
  now = psionicWorldTime(),
) {
  const attempts = record(actor.system.psionics).attempts;
  if (!Array.isArray(attempts)) return Object.freeze([]);
  return Object.freeze(
    attempts.flatMap((value) => {
      const attempt = record(value);
      const powerId = stringValue(attempt.powerId);
      const worldTime = Number(attempt.worldTime);
      return powerId &&
        Number.isFinite(worldTime) &&
        worldTime >= now - WINDOW_SECONDS
        ? [Object.freeze({ powerId, worldTime })]
        : [];
    }),
  );
}

export function readActorPsionics(actorValue: object): D6PsionicsStateV1 {
  const actor = actorDocument(actorValue);
  const disciplines = D6_PSIONIC_DISCIPLINES.map((id) => {
    const item = disciplineItem(actor, id);
    const score = currentEffectivePipScore(integer(item?.system.score));
    const method = stringValue(item?.system.psionicTraining);
    return Object.freeze({
      id,
      itemId: item?.id ?? "",
      score,
      trained: score >= 3,
      ...(method === "self-study" || method === "teacher"
        ? { trainingMethod: method }
        : {}),
    });
  });
  const byId = new Map(
    disciplines.map((discipline) => [discipline.id, discipline]),
  );
  const attempts = psionicAttempts(actor);
  const powers = psionicPowerRegistry.current().flatMap((catalog) =>
    catalog.powers.map((power) => {
      const required = power.disciplines.map((id) => byId.get(id));
      return Object.freeze({
        ...power,
        available: required.every((discipline) => discipline?.trained === true),
        catalogId: catalog.id,
        ownerId: catalog.ownerId,
        poolScore: required.reduce(
          (total, discipline) => total + (discipline?.score ?? 0),
          0,
        ),
        recentAttempts: attempts.filter(({ powerId }) => powerId === power.id)
          .length,
      });
    }),
  );
  return Object.freeze({
    contractVersion: D6_PSIONICS_CONTRACT_VERSION,
    disciplines: Object.freeze(disciplines),
    powers: Object.freeze(powers),
  });
}

export async function trainPsionicDiscipline(
  actorValue: object,
  discipline: D6PsionicDiscipline,
  method: D6PsionicTrainingMethod,
): Promise<D6PsionicsStateV1> {
  const actor = actorDocument(actorValue);
  if (actor.isOwner !== true) throw new Error("D6E2.Psionics.OwnerRequired");
  if (!currentSecondEditionCampaignProfile().psionics) {
    throw new Error("D6E2.Psionics.ModuleRequired");
  }
  if (!D6_PSIONIC_DISCIPLINES.includes(discipline)) {
    throw new RangeError(`Unknown psionic discipline ${discipline}.`);
  }
  if (!new Set<string>(["self-study", "teacher"]).has(method)) {
    throw new RangeError("Unknown psionic training method.");
  }
  const item = disciplineItem(actor, discipline);
  if (!item) throw new Error("D6E2.Psionics.SynchronizeRequired");
  if (integer(item.system.score) !== 0) {
    throw new Error("D6E2.Psionics.FirstDieOnly");
  }
  await withAuthorizedAdvancementUpdate(item, () =>
    item.update({
      "system.psionicTraining": method,
      "system.score": 3,
    }),
  );
  return readActorPsionics(actor);
}

export async function recordPsionicAttempt(
  actor: FoundryActorDocument,
  powerId: string,
  now = psionicWorldTime(),
): Promise<void> {
  const attempts = [
    ...psionicAttempts(actor, now),
    { powerId, worldTime: now },
  ];
  await withAuthorizedPsionicsUpdate(actor, () =>
    actor.update({ "system.psionics.attempts": attempts }),
  );
}
