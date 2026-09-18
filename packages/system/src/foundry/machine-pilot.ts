import {
  formatPipScore,
  machinePilotPlan,
  type D6ActorReadModelV1,
} from "@d6-system-2e/core";
import { DEFAULT_DOCUMENT_IMAGES } from "../document-default-images";
import { actorReadModel } from "./read-models/actor";
import { currentConfiguredRulesProfile } from "../settings/rules-profile-library";
import { currentEffectivePipScore } from "../settings/pip-rules";
import { record, stringValue, integer } from "./sheets/values";

export interface MachinePilotSource {
  readonly id: string;
  readonly kind: "attribute" | "skill";
  readonly label: string;
  readonly score: number;
  readonly rollable: boolean;
}
export function machineCrew(
  machine: FoundryActorDocument,
): readonly FoundryActorDocument[] {
  const members = record(machine.system.crew).members;
  if (!Array.isArray(members)) return [];
  const ids = new Set(
    members.map((value) => stringValue(record(value).actorId)),
  );
  return [...ids].flatMap((id) => {
    const actor = game.actors?.get(id);
    return actor && ["character", "creature", "npc"].includes(actor.type)
      ? [actor]
      : [];
  });
}
export function canControlMachinePilotActor(
  actor: FoundryActorDocument,
): boolean {
  return !!game.user && (game.user.isGM || actor.isOwner === true);
}
export function machinePilotSources(
  actor: FoundryActorDocument,
): readonly MachinePilotSource[] {
  const model: D6ActorReadModelV1 = actorReadModel(actor);
  return [
    ...model.attributes.map((source) => ({
      ...source,
      kind: "attribute" as const,
    })),
    ...model.skills.map((source) => ({ ...source, kind: "skill" as const })),
  ].sort((a, b) => a.label.localeCompare(b.label));
}
export function machinePilotSelection(machine: FoundryActorDocument) {
  const crew = record(machine.system.crew);
  return {
    actorId: stringValue(crew.pilotActorId),
    skillId: stringValue(crew.pilotSkillId),
    attributeId: stringValue(crew.pilotAttributeId),
  };
}
export function machinePilotFamily(): "open-d6" | "second-edition" | null {
  const strategies = currentConfiguredRulesProfile().strategies;
  if (
    Object.values(strategies).some(
      (id) => id.startsWith("d6mv.") || id.startsWith("free-d6."),
    )
  )
    return null;
  return strategies.attributes === "open-d6.attributes.six-attribute"
    ? "open-d6"
    : strategies.attributes === "d6e2.attributes.campaign-profile"
      ? "second-edition"
      : null;
}
export function resolveMachinePilot(machine: FoundryActorDocument) {
  const selected = machinePilotSelection(machine);
  const crew = machineCrew(machine);
  const pilot = crew.find((actor) => actor.id === selected.actorId);
  const source =
    pilot && canControlMachinePilotActor(pilot)
      ? machinePilotSources(pilot).find((entry) =>
          selected.skillId
            ? entry.kind === "skill" && entry.id === selected.skillId
            : entry.kind === "attribute" && entry.id === selected.attributeId,
        )
      : undefined;
  const family = machinePilotFamily();
  const reason = !["vehicle", "starship"].includes(machine.type)
    ? "PilotMachineRequired"
    : !selected.actorId
      ? "NoPilot"
      : !pilot
        ? "PilotUnavailable"
        : !canControlMachinePilotActor(machine) ||
            !canControlMachinePilotActor(pilot)
          ? "PilotNotAuthorized"
          : !source?.rollable
            ? "PilotSourceUnavailable"
            : !family
              ? "PilotRulesUnavailable"
              : "";
  const plan = family
    ? machinePilotPlan({
        family,
        kind: machine.type === "starship" ? "starship" : "vehicle",
        maneuverabilityScore: currentEffectivePipScore(
          integer(
            record(record(machine.system.attributes).maneuverability).score,
          ),
        ),
        assignedCrewCount: crew.length,
        minimumCrew: integer(record(machine.system.crew).minimum),
      })
    : undefined;
  return { selected, crew, pilot, source, reason, plan };
}
export function requireMachinePilot(machine: FoundryActorDocument) {
  const state = resolveMachinePilot(machine);
  if (state.reason || !state.pilot || !state.source || !state.plan)
    throw new Error(`D6E2.Machine.${state.reason || "PilotSourceUnavailable"}`);
  return {
    ...state,
    pilot: state.pilot,
    source: state.source,
    plan: state.plan,
  };
}
export async function configureMachinePilot(
  machine: FoundryActorDocument,
  actorId: string,
  kind: "attribute" | "skill",
  sourceId: string,
): Promise<void> {
  if (
    !["vehicle", "starship"].includes(machine.type) ||
    !canControlMachinePilotActor(machine)
  )
    throw new Error("D6E2.Machine.PilotNotAuthorized");
  const pilot = machineCrew(machine).find((actor) => actor.id === actorId);
  if (!pilot || !canControlMachinePilotActor(pilot))
    throw new Error("D6E2.Machine.PilotUnavailable");
  const source = machinePilotSources(pilot).find(
    (entry) => entry.kind === kind && entry.id === sourceId && entry.rollable,
  );
  if (!source) throw new Error("D6E2.Machine.PilotSourceUnavailable");
  await machine.update({
    "system.crew.pilotActorId": pilot.id,
    "system.crew.pilotSkillId": kind === "skill" ? source.id : "",
    "system.crew.pilotAttributeId": kind === "attribute" ? source.id : "",
  });
}
export async function clearMachinePilot(
  machine: FoundryActorDocument,
): Promise<void> {
  if (
    !["vehicle", "starship"].includes(machine.type) ||
    !canControlMachinePilotActor(machine)
  )
    throw new Error("D6E2.Machine.PilotNotAuthorized");
  await machine.update({
    "system.crew.pilotActorId": "",
    "system.crew.pilotSkillId": "",
    "system.crew.pilotAttributeId": "",
  });
}
export function machinePilotContext(machine: FoundryActorDocument) {
  const state = resolveMachinePilot(machine);
  const hasAssignableCrew = state.crew.some(canControlMachinePilotActor);
  return {
    assigned: !!state.selected.actorId,
    actorId: state.selected.actorId,
    name:
      state.pilot?.name ??
      game.i18n.localize(
        state.selected.actorId
          ? "D6E2.Machine.PilotUnavailable"
          : "D6E2.Machine.NoPilot",
      ),
    img: state.pilot?.img ?? DEFAULT_DOCUMENT_IMAGES.actorCharacter,
    skillLabel: state.source?.label ?? "—",
    scoreLabel: state.source
      ? formatPipScore(
          Math.max(0, state.source.score + (state.plan?.modifierScore ?? 0)),
        )
      : "—",
    canConfigure: canControlMachinePilotActor(machine),
    canAssign: canControlMachinePilotActor(machine) && hasAssignableCrew,
    assignmentUnavailableReason: hasAssignableCrew
      ? ""
      : game.i18n.localize("D6E2.Machine.PilotAddCrewFirst"),
    canRoll: !state.reason,
    unavailableReason: state.reason
      ? game.i18n.localize(`D6E2.Machine.${state.reason}`)
      : "",
    rollHelp: state.plan
      ? game.i18n.format(
          state.plan.family === "open-d6"
            ? "D6E2.Machine.PilotHelpOpenD6"
            : state.plan.kind === "starship"
              ? "D6E2.Machine.PilotHelpStarship"
              : "D6E2.Machine.PilotHelpVehicle",
          {
            maneuverability: formatPipScore(state.plan.maneuverabilityScore),
            crewPenalty: formatPipScore(state.plan.crewPenaltyScore),
          },
        )
      : "",
    rollLabel: game.i18n.localize(
      state.plan?.family === "open-d6"
        ? "D6E2.Machine.RollManeuver"
        : machine.type === "vehicle"
          ? "D6E2.Machine.RollDrive"
          : "D6E2.Machine.RollPilot",
    ),
  };
}

export function validateMachinePilotSnapshot(
  machine: FoundryActorDocument,
  expected: ReturnType<typeof requireMachinePilot>,
): void {
  const current = requireMachinePilot(machine);
  if (
    current.pilot.id !== expected.pilot.id ||
    current.source.kind !== expected.source.kind ||
    current.source.id !== expected.source.id ||
    current.source.score !== expected.source.score ||
    JSON.stringify(current.plan) !== JSON.stringify(expected.plan)
  )
    throw new Error("D6E2.Machine.PilotChanged");
}
