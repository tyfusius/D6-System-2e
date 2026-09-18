import { formatPipScore } from "@d6-system-2e/core";
import {
  canControlMachinePilotActor,
  configureMachinePilot,
  machineCrew,
  machinePilotSelection,
  machinePilotSources,
} from "./machine-pilot";

function escape(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c] ?? c,
  );
}
async function choose(
  label: string,
  choices: readonly { id: string; label: string }[],
  selected: string,
): Promise<string | null> {
  return foundry.applications.api.DialogV2.wait<string | null>({
    buttons: [
      {
        action: "cancel",
        callback: () => null,
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "select",
        callback: (_event, button) => {
          const control = button.form?.elements.namedItem("pilotSelection");
          return control instanceof HTMLSelectElement ? control.value : null;
        },
        class: "od6roll-submit",
        default: true,
        label: game.i18n.localize("D6E2.Machine.PilotSelect"),
      },
    ],
    classes: ["d6e2", "od6roll-dialog", "d6e2-machine-crew-dialog"],
    content: `<div class="od6-dialog-shell"><label><span>${escape(game.i18n.localize(label))}</span><select name="pilotSelection">${choices.map((choice) => `<option value="${escape(choice.id)}"${choice.id === selected ? " selected" : ""}>${escape(choice.label)}</option>`).join("")}</select></label></div>`,
    modal: true,
    rejectClose: false,
    window: {
      icon: "fa-solid fa-user-astronaut",
      title: game.i18n.localize("D6E2.Machine.AssignPilot"),
    },
  });
}
export async function openMachinePilotConfiguration(
  machine: FoundryActorDocument,
): Promise<void> {
  if (!canControlMachinePilotActor(machine))
    throw new Error("D6E2.Machine.PilotNotAuthorized");
  const candidates = machineCrew(machine)
    .filter(canControlMachinePilotActor)
    .toSorted((a, b) => a.name.localeCompare(b.name));
  if (!candidates.length) throw new Error("D6E2.Machine.PilotAddCrewFirst");
  const selected = machinePilotSelection(machine);
  const actorId = await choose(
    "D6E2.Machine.Pilot",
    candidates.map((actor) => ({ id: actor.id, label: actor.name })),
    selected.actorId,
  );
  if (!actorId) return;
  const pilot = candidates.find((actor) => actor.id === actorId);
  if (!pilot) throw new Error("D6E2.Machine.PilotUnavailable");
  const sources = machinePilotSources(pilot).filter(
    (source) => source.rollable,
  );
  if (!sources.length) throw new Error("D6E2.Machine.PilotSourceUnavailable");
  const previous =
    actorId === selected.actorId
      ? selected.skillId
        ? `skill:${selected.skillId}`
        : `attribute:${selected.attributeId}`
      : "";
  const choice = await choose(
    "D6E2.Machine.PilotSkill",
    sources.map((source) => ({
      id: `${source.kind}:${source.id}`,
      label: `${game.i18n.localize(source.kind === "attribute" ? "D6E2.Combat.ActionKindAttribute" : "D6E2.Item.Skill")} · ${source.label} · ${formatPipScore(source.score)}`,
    })),
    previous,
  );
  if (!choice) return;
  const source = sources.find(
    (source) => `${source.kind}:${source.id}` === choice,
  );
  if (!source) throw new Error("D6E2.Machine.PilotSourceUnavailable");
  await configureMachinePilot(machine, actorId, source.kind, source.id);
}
