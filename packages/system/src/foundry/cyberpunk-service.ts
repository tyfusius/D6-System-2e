import {
  augmentationAcquisitionDifficulty,
  augmentationCapacity,
  augmentationFirewall,
  augmentationInstallDifficulty,
  augmentationInstallMinutes,
  personalFirewall,
} from "@d6-system-2e/core";
import { currentSecondEditionCampaignProfile } from "../settings/campaign-profile";
import { currentEffectivePipScore } from "../settings/pip-rules";
import { integer, record, stringValue } from "./sheets/values";
import {
  completeNextCombatantAction,
  readCombatantRound,
} from "./combat-service";

function actorDocument(value: object): FoundryActorDocument {
  if (!("items" in value) || !("system" in value)) {
    throw new TypeError("Cyberpunk rules require a Foundry Actor document.");
  }
  return value as FoundryActorDocument;
}

interface CyberpunkCombatant {
  readonly actor?: { readonly id: string } | null;
  readonly id: string;
}

interface CyberpunkCombat {
  readonly id: string;
  readonly combatants: { readonly contents: readonly CyberpunkCombatant[] };
  readonly round?: number;
  readonly turn?: number;
  readonly turns: readonly CyberpunkCombatant[];
}

function activeCombat(): CyberpunkCombat | undefined {
  return (game as FoundryGame & { readonly combat?: CyberpunkCombat }).combat;
}

function attributeScore(actor: FoundryActorDocument, id: string): number {
  return currentEffectivePipScore(
    integer(record(record(actor.system.attributes)[id]).score),
  );
}

function activeWindow(value: unknown): boolean {
  const window = record(value);
  const combat = activeCombat();
  if (stringValue(window.combatId) !== combat?.id) return false;
  const round = integer(combat.round);
  const turn = integer(combat.turn);
  const untilRound = integer(window.untilRound);
  const untilTurn = integer(window.untilTurn);
  return round < untilRound || (round === untilRound && turn <= untilTurn);
}

export function cyberpunkModuleActive(): boolean {
  return currentSecondEditionCampaignProfile().cyberpunk;
}

export function cyberneticDisabled(item: FoundryItemDocument): boolean {
  return activeWindow(item.system.disabled);
}

export function readActorCyberpunk(actorValue: object) {
  const actor = actorDocument(actorValue);
  const hardening = activeWindow(record(actor.system.cyberpunk).hardening);
  const cybernetics = actor.items.contents.filter(
    (item) => item.type === "cybernetic",
  );
  const installed = cybernetics.filter(
    (item) => item.system.installed === true,
  );
  const cyberwareCount = installed.filter(
    (item) => stringValue(item.system.augmentationKind) !== "bioware",
  ).length;
  const biowareCount = installed.length - cyberwareCount;
  const knowledgeCapacity = augmentationCapacity(
    attributeScore(actor, "knowledge"),
  );
  const brawnCapacity = augmentationCapacity(attributeScore(actor, "brawn"));
  const technicalFirewall = personalFirewall(
    attributeScore(actor, "technical"),
  );
  return Object.freeze({
    actorId: actor.id,
    biowareCount,
    brawnCapacity,
    cyberwareCount,
    firewall: technicalFirewall + (hardening ? 5 : 0),
    firewallBase: technicalFirewall,
    hardened: hardening,
    knowledgeCapacity,
    augmentations: Object.freeze(
      cybernetics.map((item) => {
        const kind =
          stringValue(item.system.augmentationKind) === "bioware"
            ? "bioware"
            : "cyberware";
        const previousCount =
          kind === "bioware" ? biowareCount : cyberwareCount;
        const rank = Math.max(1, integer(item.system.rank));
        return Object.freeze({
          acquisitionDifficulty: augmentationAcquisitionDifficulty(rank),
          disabled: cyberneticDisabled(item),
          firewall: augmentationFirewall(rank),
          id: item.id,
          installed: item.system.installed === true,
          installDifficulty: augmentationInstallDifficulty(previousCount),
          installMinutes: augmentationInstallMinutes(previousCount),
          kind,
          linkedTalentId: stringValue(item.system.linkedTalentId),
          name: item.name,
          rank,
        });
      }),
    ),
  });
}

export async function hardenActorFirewall(actorValue: object): Promise<void> {
  const actor = actorDocument(actorValue);
  if (actor.isOwner !== true) throw new Error("D6E2.Cyberpunk.OwnerRequired");
  if (!cyberpunkModuleActive())
    throw new Error("D6E2.Cyberpunk.ModuleRequired");
  const combat = activeCombat();
  const combatant = combat?.combatants.contents.find(
    (candidate) => candidate.actor?.id === actor.id,
  );
  if (!combat || !combatant) throw new Error("D6E2.Cyberpunk.CombatRequired");
  const roundState = readCombatantRound(actor);
  if (!roundState?.currentAction) {
    throw new Error("D6E2.Cyberpunk.DeclaredActionRequired");
  }
  await completeNextCombatantAction(actor, roundState.revision);
  const turn = combat.turns.findIndex(
    (candidate) => candidate.id === combatant.id,
  );
  if (turn !== integer(combat.turn)) {
    throw new Error("D6E2.Cyberpunk.ActiveTurnRequired");
  }
  await actor.update({
    "system.cyberpunk.hardening": {
      combatId: combat.id,
      untilRound: integer(combat.round) + 1,
      untilTurn: Math.max(0, turn),
    },
  });
}

export function canInstallAugmentation(
  actorValue: object,
  itemValue: object,
): boolean {
  const actor = actorDocument(actorValue);
  const item = itemValue as FoundryItemDocument;
  const state = readActorCyberpunk(actor);
  return stringValue(item.system.augmentationKind) === "bioware"
    ? state.biowareCount < state.brawnCapacity
    : state.cyberwareCount < state.knowledgeCapacity;
}
