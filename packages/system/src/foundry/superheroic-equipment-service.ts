import {
  superpowerTalentCostPlan,
  superheroicEquipmentRebuildDays,
  superheroicEquipmentStateAfterComplication,
  superheroicEquipmentUsePenaltyScore,
  type D6RollResultV1,
  type SuperheroicEquipmentPowerSnapshot,
  type SuperheroicEquipmentState,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { currentSecondEditionCampaignProfile } from "../settings/campaign-profile";
import { rollAttribute, rollSkill } from "./rolls/roll-service";
import { integer, record, stringValue } from "./sheets/values";

function actorDocument(value: object): FoundryActorDocument {
  const actor = value as Partial<FoundryActorDocument>;
  if (
    actor.type !== "character" ||
    typeof actor.update !== "function" ||
    typeof actor.system !== "object"
  ) {
    throw new TypeError("Gadgets & Gear require a Character Actor.");
  }
  return actor as FoundryActorDocument;
}

function assertOwner(actor: FoundryActorDocument): void {
  if (game.user?.isGM !== true && actor.isOwner !== true) {
    throw new Error("D6E2.GadgetsGear.Error.OwnerRequired");
  }
}

function assertModule(): void {
  if (!currentSecondEditionCampaignProfile().gadgetsGear) {
    throw new Error("D6E2.GadgetsGear.Error.ModuleRequired");
  }
}

function equipment(
  actor: FoundryActorDocument,
  itemId: string,
  kind?: "gadget" | "gear",
): FoundryItemDocument {
  const item = actor.items.get(itemId);
  if (
    item?.type !== "gear" ||
    (kind !== undefined && item.system.superheroicEquipmentKind !== kind)
  ) {
    throw new Error(
      kind === "gadget"
        ? "D6E2.GadgetsGear.Error.GadgetRequired"
        : "D6E2.GadgetsGear.Error.GearRequired",
    );
  }
  return item;
}

function escaped(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

function storedPowers(
  item: FoundryItemDocument,
): readonly SuperheroicEquipmentPowerSnapshot[] {
  const stored = item.system.superheroicPowerSnapshots;
  if (!Array.isArray(stored)) return Object.freeze([]);
  return Object.freeze(
    stored.flatMap((value) => {
      const source = record(value);
      const sourceItemId = stringValue(source.sourceItemId);
      const name = stringValue(source.name);
      if (!sourceItemId || !name) return [];
      return [
        Object.freeze({
          automatic: source.automatic === true,
          name,
          sourceItemId,
          totalCost: Math.max(1, integer(source.totalCost)),
        }),
      ];
    }),
  );
}

export function readActorSuperheroicEquipmentPowers(
  actorValue: object,
  itemId: string,
): readonly SuperheroicEquipmentPowerSnapshot[] {
  const actor = actorDocument(actorValue);
  const item = equipment(actor, itemId, "gear");
  const creatorActorId = stringValue(item.system.superheroicCreatorActorId);
  if (creatorActorId !== actor.id) return storedPowers(item);
  const ids = Array.isArray(item.system.superheroicPowerTalentIds)
    ? item.system.superheroicPowerTalentIds.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const live = ids.flatMap((talentId) => {
    const talent = actor.items.get(talentId);
    if (talent?.type !== "talent" || talent.system.superpower !== true)
      return [];
    const cost = superpowerTalentCostPlan(
      integer(talent.system.cost),
      integer(talent.system.rank),
      integer(talent.system.superpowerEnhancementCost),
      integer(talent.system.superpowerLimitationCredit),
    );
    return [
      Object.freeze({
        automatic: talent.system.superpowerAutomatic === true,
        name: talent.name,
        sourceItemId: talent.id,
        totalCost: cost.totalCost,
      }),
    ];
  });
  return live.length > 0 ? Object.freeze(live) : storedPowers(item);
}

export function actorSuperheroicEquipmentRebuildDays(
  actorValue: object,
  itemId: string,
): number | null {
  const actor = actorDocument(actorValue);
  const item = equipment(actor, itemId, "gear");
  return superheroicEquipmentRebuildDays(
    readActorSuperheroicEquipmentPowers(actor, itemId),
    item.system.superheroicRebuildDisabled === true,
  );
}

async function auditState(
  actor: FoundryActorDocument,
  item: FoundryItemDocument,
  action: string,
): Promise<void> {
  await ChatMessage.create({
    content: `<div class="od6chat-roll"><strong>${escaped(actor.name)}: ${escaped(item.name)}</strong><span>${escaped(game.i18n.localize(action))}</span><small>${escaped(game.i18n.localize("D6E2.RulesReference"))}: D6 System: Second Edition, pp. 227–228</small></div>`,
    flags: {
      [SYSTEM_ID]: {
        action,
        itemId: item.id,
        kind: "superheroicEquipmentState",
        sourcePages: [227, 228],
        version: 1,
      },
    },
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}

export async function useActorGadget(
  actorValue: object,
  itemId: string,
): Promise<D6RollResultV1 | null> {
  const actor = actorDocument(actorValue);
  assertModule();
  assertOwner(actor);
  const item = equipment(actor, itemId, "gadget");
  const targetKind = stringValue(item.system.gadgetTargetKind, "skill");
  const targetId = stringValue(item.system.gadgetTargetId);
  const result =
    targetKind === "attribute"
      ? await rollAttribute(actor, targetId, {
          forceTotalResolution: true,
          gadgetBonus: { itemId },
        })
      : await rollSkill(actor, targetId, {
          forceTotalResolution: true,
          gadgetBonus: { itemId },
        });
  if (result && "resolution" in result) {
    throw new Error("D6E2.GadgetsGear.NumericResolutionRequired");
  }
  if (result?.wildOutcome === "complication") {
    const state = superheroicEquipmentStateAfterComplication(
      stringValue(item.system.superheroicEquipmentState) === "destroyed"
        ? "destroyed"
        : "ready",
    );
    await item.update({ "system.superheroicEquipmentState": state });
    await auditState(actor, item, "D6E2.GadgetsGear.Malfunctioned");
  }
  return result;
}

export async function relyOnActorGearPower(
  actorValue: object,
  itemId: string,
  sourceItemId: string,
): Promise<void> {
  const actor = actorDocument(actorValue);
  assertModule();
  assertOwner(actor);
  const item = equipment(actor, itemId, "gear");
  if (item.system.equipped !== true) {
    throw new Error("D6E2.GadgetsGear.Error.EquippedRequired");
  }
  if (item.system.superheroicEquipmentState !== "ready") {
    throw new Error("D6E2.GadgetsGear.Error.ReadyRequired");
  }
  const power = readActorSuperheroicEquipmentPowers(actor, itemId).find(
    (candidate) => candidate.sourceItemId === sourceItemId,
  );
  if (!power) throw new Error("D6E2.GadgetsGear.Error.PowerRequired");
  const penaltyScore = superheroicEquipmentUsePenaltyScore(
    stringValue(item.system.superheroicCreatorActorId),
    actor.id,
  );
  await ChatMessage.create({
    content: `<div class="od6chat-roll"><strong>${escaped(actor.name)}: ${escaped(item.name)} · ${escaped(power.name)}</strong><span>${escaped(game.i18n.localize("D6E2.GadgetsGear.PowerUseAudit"))}${penaltyScore ? ` · −1D ${escaped(game.i18n.localize("D6E2.GadgetsGear.BorrowedPenalty"))}` : ""}</span><small>${escaped(game.i18n.localize("D6E2.Superpowers.Cost"))}: ${power.totalCost}D · ${escaped(game.i18n.localize("D6E2.RulesReference"))}: D6 System: Second Edition, pp. 227–228</small></div>`,
    flags: {
      [SYSTEM_ID]: {
        equipmentId: item.id,
        kind: "superheroicGearPower",
        penaltyScore,
        sourceItemId: power.sourceItemId,
        sourcePages: [227, 228],
        version: 1,
      },
    },
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}

export async function setActorSuperheroicEquipmentState(
  actorValue: object,
  itemId: string,
  nextState: SuperheroicEquipmentState,
): Promise<void> {
  const actor = actorDocument(actorValue);
  assertModule();
  if (game.user?.isGM !== true) {
    throw new Error("D6E2.GadgetsGear.Error.GMRequired");
  }
  const item = equipment(actor, itemId);
  const current = stringValue(item.system.superheroicEquipmentState, "ready");
  if (
    current === "destroyed" &&
    nextState === "ready" &&
    item.system.superheroicRebuildDisabled === true
  ) {
    throw new Error("D6E2.GadgetsGear.Error.RebuildDisabled");
  }
  await item.update({ "system.superheroicEquipmentState": nextState });
  await auditState(
    actor,
    item,
    nextState === "ready"
      ? current === "destroyed"
        ? "D6E2.GadgetsGear.Rebuilt"
        : "D6E2.GadgetsGear.Repaired"
      : nextState === "destroyed"
        ? "D6E2.GadgetsGear.Destroyed"
        : "D6E2.GadgetsGear.Malfunctioned",
  );
}
