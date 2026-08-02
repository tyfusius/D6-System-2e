import {
  nemesisEncounterPointPool,
  nemesisExperienceAward,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { currentSecondEditionCampaignProfile } from "../settings/campaign-profile";
import { withAuthorizedSuperheroicUpdate } from "./mechanical-edit-guard";
import { transactActorHeroPoints } from "./hero-point-service";
import { integer, record, stringValue } from "./sheets/values";

export interface SuperheroicRelationshipState {
  readonly companionName: string;
  readonly companionNotes: string;
  readonly heroActorId: string;
  readonly mentorActorId: string;
  readonly nemesisActive: boolean;
  readonly nemesisEncounter: number;
  readonly nemesisExperience: number;
  readonly nemesisPoints: number;
  readonly nemesisScope: "group" | "individual";
  readonly notes: string;
  readonly sidekickActive: boolean;
  readonly sidekickRequirementsConfirmed: boolean;
  readonly sidekickStatus: "active" | "independent" | "removed";
}

function actorDocument(value: object): FoundryActorDocument {
  const actor = value as Partial<FoundryActorDocument>;
  if (actor.type !== "character" || typeof actor.update !== "function") {
    throw new TypeError("Superheroic relationships require a Character Actor.");
  }
  return actor as FoundryActorDocument;
}

function assertModule(): void {
  if (!currentSecondEditionCampaignProfile().nemesisCompanionsSidekicks) {
    throw new Error("D6E2.SuperheroicRelationships.ModuleRequired");
  }
}

function escaped(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
}

async function audit(
  actor: FoundryActorDocument,
  key: string,
  details: string,
  roll?: FoundryRoll,
): Promise<void> {
  await ChatMessage.create({
    content: `<div class="od6chat-roll"><strong>${escaped(actor.name)}: ${escaped(game.i18n.localize(key))}</strong><span>${escaped(details)}</span><small>${escaped(game.i18n.localize("D6E2.RulesReference"))}: D6 System: Second Edition, pp. 235–237</small></div>`,
    flags: {
      [SYSTEM_ID]: {
        action: key,
        kind: "superheroicRelationships",
        sourcePages: [235, 236, 237],
        version: 1,
      },
    },
    ...(roll ? { rolls: [roll] } : {}),
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}

export function readActorSuperheroicRelationships(
  actorValue: object,
): SuperheroicRelationshipState {
  const actor = actorDocument(actorValue);
  const state = record(record(actor.system.superheroic).relationships);
  const sidekickStatus = stringValue(state.sidekickStatus);
  return Object.freeze({
    companionName: stringValue(state.companionName),
    companionNotes: stringValue(state.companionNotes),
    heroActorId: stringValue(state.heroActorId),
    mentorActorId: stringValue(state.mentorActorId),
    nemesisActive: state.nemesisActive === true,
    nemesisEncounter: Math.max(0, integer(state.nemesisEncounter)),
    nemesisExperience: Math.max(0, integer(state.nemesisExperience)),
    nemesisPoints: Math.max(0, integer(state.nemesisPoints)),
    nemesisScope: state.nemesisScope === "group" ? "group" : "individual",
    notes: stringValue(state.notes),
    sidekickActive: state.sidekickActive === true,
    sidekickRequirementsConfirmed: state.sidekickRequirementsConfirmed === true,
    sidekickStatus:
      sidekickStatus === "independent" || sidekickStatus === "removed"
        ? sidekickStatus
        : "active",
  });
}

export async function configureActorSuperheroicRelationships(
  actorValue: object,
  input: SuperheroicRelationshipState & { readonly sidekickCreation: boolean },
): Promise<SuperheroicRelationshipState> {
  const actor = actorDocument(actorValue);
  assertModule();
  if (game.user?.isGM !== true) throw new Error("D6E2.Superheroic.GMRequired");
  const next = Object.freeze({
    ...readActorSuperheroicRelationships(actor),
    companionName: input.companionName.trim(),
    companionNotes: input.companionNotes.trim(),
    heroActorId: input.heroActorId,
    mentorActorId: input.mentorActorId,
    nemesisActive: input.nemesisActive,
    nemesisScope: input.nemesisScope,
    notes: input.notes.trim(),
    sidekickActive: input.sidekickActive,
    sidekickRequirementsConfirmed: input.sidekickRequirementsConfirmed,
    sidekickStatus: input.sidekickStatus,
  });
  await withAuthorizedSuperheroicUpdate(actor, () =>
    actor.update({
      "system.creation.sidekick": input.sidekickCreation,
      "system.superheroic.relationships": next,
    }),
  );
  ui.notifications.info(
    game.i18n.localize("D6E2.SuperheroicRelationships.Saved"),
  );
  return next;
}

export async function resetActorSuperheroicRelationships(
  actorValue: object,
): Promise<SuperheroicRelationshipState> {
  const actor = actorDocument(actorValue);
  assertModule();
  if (game.user?.isGM !== true) throw new Error("D6E2.Superheroic.GMRequired");
  const next: SuperheroicRelationshipState = Object.freeze({
    companionName: "",
    companionNotes: "",
    heroActorId: "",
    mentorActorId: "",
    nemesisActive: false,
    nemesisEncounter: 0,
    nemesisExperience: 0,
    nemesisPoints: 0,
    nemesisScope: "individual",
    notes: "",
    sidekickActive: false,
    sidekickRequirementsConfirmed: false,
    sidekickStatus: "active",
  });
  await withAuthorizedSuperheroicUpdate(actor, () =>
    actor.update({
      "system.creation.sidekick": false,
      "system.superheroic.relationships": next,
    }),
  );
  ui.notifications.info(
    game.i18n.localize("D6E2.SuperheroicRelationships.ResetComplete"),
  );
  return next;
}

export async function beginActorNemesisEncounter(
  actorValue: object,
): Promise<number> {
  const actor = actorDocument(actorValue);
  assertModule();
  if (game.user?.isGM !== true) throw new Error("D6E2.Superheroic.GMRequired");
  const state = readActorSuperheroicRelationships(actor);
  if (!state.nemesisActive)
    throw new Error("D6E2.SuperheroicRelationships.NemesisRequired");
  const roll = await new Roll("1d6").evaluate();
  const points = nemesisEncounterPointPool(
    Math.max(1, Math.min(6, Math.trunc(roll.total))),
  );
  await withAuthorizedSuperheroicUpdate(actor, () =>
    actor.update({
      "system.superheroic.relationships.nemesisEncounter":
        state.nemesisEncounter + 1,
      "system.superheroic.relationships.nemesisPoints": points,
    }),
  );
  await audit(
    actor,
    "D6E2.SuperheroicRelationships.BeginEncounter",
    game.i18n.format("D6E2.SuperheroicRelationships.BeginEncounterAudit", {
      points,
    }),
    roll,
  );
  return points;
}

export async function recoverActorCompanionHeroPoint(
  actorValue: object,
): Promise<number> {
  const actor = actorDocument(actorValue);
  assertModule();
  if (game.user?.isGM !== true && actor.isOwner !== true) {
    throw new Error("D6E2.Superheroic.OwnerRequired");
  }
  const state = readActorSuperheroicRelationships(actor);
  if (!state.companionName.trim())
    throw new Error("D6E2.SuperheroicRelationships.CompanionRequired");
  const balance = await transactActorHeroPoints(actor, 0, 1);
  await audit(
    actor,
    "D6E2.SuperheroicRelationships.RecoverCompanion",
    game.i18n.format("D6E2.SuperheroicRelationships.RecoverCompanionAudit", {
      name: state.companionName,
    }),
  );
  return balance;
}

export async function resolveActorNemesisDefeat(
  actorValue: object,
): Promise<number> {
  const actor = actorDocument(actorValue);
  assertModule();
  if (game.user?.isGM !== true) throw new Error("D6E2.Superheroic.GMRequired");
  const state = readActorSuperheroicRelationships(actor);
  const hero = game.actors?.get(state.heroActorId);
  if (!state.nemesisActive || hero?.type !== "character") {
    throw new Error("D6E2.SuperheroicRelationships.LinkedHeroRequired");
  }
  const balance = await transactActorHeroPoints(hero, 0, 1);
  await audit(
    actor,
    "D6E2.SuperheroicRelationships.ResolveNemesis",
    game.i18n.format("D6E2.SuperheroicRelationships.ResolveNemesisAudit", {
      hero: hero.name,
    }),
  );
  return balance;
}

export function registerSuperheroicRelationshipHooks(): void {
  Hooks.on("preUpdateActor", (...args: unknown[]) => {
    const document = args[0] as FoundryActorDocument;
    const changes = record(args[1]);
    const options = record(args[2]);
    if (game.user?.isGM !== true || options.d6e2NemesisExperienceSync === true)
      return;
    if (!currentSecondEditionCampaignProfile().nemesisCompanionsSidekicks)
      return;
    const flattened = changes["system.resources.experiencePoints.value"];
    const nested = record(
      record(record(changes.system).resources).experiencePoints,
    ).value;
    const next =
      typeof flattened === "number"
        ? flattened
        : typeof nested === "number"
          ? nested
          : undefined;
    if (next === undefined) return;
    const previous = integer(
      record(record(document.system.resources).experiencePoints).value,
    );
    const award = nemesisExperienceAward(previous, next);
    if (award <= 0) return;
    for (const candidate of game.actors?.contents ?? []) {
      if (candidate.type !== "character") continue;
      const state = readActorSuperheroicRelationships(candidate);
      if (!state.nemesisActive || state.heroActorId !== document.id) continue;
      const currentXp = integer(
        record(record(candidate.system.resources).experiencePoints).value,
      );
      void withAuthorizedSuperheroicUpdate(candidate, () =>
        candidate.update(
          {
            "system.resources.experiencePoints.value": currentXp + award,
            "system.superheroic.relationships.nemesisExperience":
              state.nemesisExperience + award,
          },
          { d6e2NemesisExperienceSync: true },
        ),
      );
    }
  });
}
