import {
  clearSecretIdentityName,
  gainSecretIdentitySuspicion,
  makeSecretIdentityPublic,
  reinforceSecretIdentity,
  spendSecretIdentityHeroPoint,
  superpowerTalentCostPlan,
  type SecretIdentityState,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { currentSecondEditionCampaignProfile } from "../settings/campaign-profile";
import { withAuthorizedSuperheroicUpdate } from "./mechanical-edit-guard";
import {
  actorHeroPointBalance,
  transactActorHeroPoints,
} from "./hero-point-service";
import {
  grantSuperheroicCombatantAction,
  readCombatantRound,
} from "./combat-service";
import { integer, record, stringValue } from "./sheets/values";

function actorDocument(value: object): FoundryActorDocument {
  const actor = value as Partial<FoundryActorDocument>;
  if (
    actor.type !== "character" ||
    typeof actor.update !== "function" ||
    typeof actor.system !== "object"
  ) {
    throw new TypeError("Superheroic rules require a Character Actor.");
  }
  return actor as FoundryActorDocument;
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

function assertOwner(actor: FoundryActorDocument): void {
  if (game.user?.isGM !== true && actor.isOwner !== true) {
    throw new Error("D6E2.Superheroic.OwnerRequired");
  }
}

function assertModule(key: "heroPoints" | "secretIdentities"): void {
  const campaign = currentSecondEditionCampaignProfile();
  if (
    (key === "heroPoints" && !campaign.superheroicHeroPoints) ||
    (key === "secretIdentities" && !campaign.secretIdentities)
  ) {
    throw new Error("D6E2.Superheroic.ModuleRequired");
  }
}

export function readActorSecretIdentity(
  actorValue: object,
): SecretIdentityState {
  const actor = actorDocument(actorValue);
  const identity = record(record(actor.system.superheroic).secretIdentity);
  const status = stringValue(identity.status);
  return Object.freeze({
    heroicIdentity: stringValue(identity.heroicIdentity),
    heroPoints: Math.min(3, Math.max(0, integer(identity.heroPoints))),
    secretIdentity: stringValue(identity.secretIdentity),
    status: status === "exposed" || status === "public" ? status : "active",
    suspicion: Math.max(0, integer(identity.suspicion)),
  });
}

async function updateIdentity(
  actor: FoundryActorDocument,
  state: SecretIdentityState,
): Promise<SecretIdentityState> {
  await withAuthorizedSuperheroicUpdate(actor, () =>
    actor.update({ "system.superheroic.secretIdentity": state }),
  );
  return state;
}

async function audit(
  actor: FoundryActorDocument,
  action: string,
  details: string,
  roll?: FoundryRoll,
): Promise<void> {
  await ChatMessage.create({
    content: `<div class="od6chat-roll"><strong>${escaped(actor.name)}: ${escaped(game.i18n.localize(action))}</strong><span>${escaped(details)}</span><small>${escaped(game.i18n.localize("D6E2.RulesReference"))}: D6 System: Second Edition, pp. 207–211</small></div>`,
    flags: {
      [SYSTEM_ID]: {
        kind: "superheroicFoundation",
        action,
        sourcePages: [207, 208, 209, 210, 211],
        version: 1,
      },
    },
    ...(roll ? { rolls: [roll] } : {}),
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}

export async function reinforceActorSecretIdentity(
  actorValue: object,
): Promise<SecretIdentityState> {
  const actor = actorDocument(actorValue);
  assertModule("secretIdentities");
  if (game.user?.isGM !== true) {
    throw new Error("D6E2.Superheroic.GMRequired");
  }
  const state = await updateIdentity(
    actor,
    reinforceSecretIdentity(readActorSecretIdentity(actor)),
  );
  await audit(
    actor,
    "D6E2.Superheroic.Reinforce",
    game.i18n.localize("D6E2.Superheroic.ReinforceAudit"),
  );
  return state;
}

export async function spendActorSecretIdentityHeroPoint(
  actorValue: object,
): Promise<SecretIdentityState> {
  const actor = actorDocument(actorValue);
  assertModule("secretIdentities");
  assertOwner(actor);
  const state = await updateIdentity(
    actor,
    spendSecretIdentityHeroPoint(readActorSecretIdentity(actor)),
  );
  await audit(
    actor,
    "D6E2.Superheroic.SpendIdentityPoint",
    game.i18n.localize("D6E2.Superheroic.SpendIdentityPointAudit"),
  );
  return state;
}

export async function addActorSecretIdentitySuspicion(
  actorValue: object,
  clue: boolean,
): Promise<SecretIdentityState> {
  const actor = actorDocument(actorValue);
  assertModule("secretIdentities");
  assertOwner(actor);
  const roll = await new Roll("1d6").evaluate();
  const result = gainSecretIdentitySuspicion(
    readActorSecretIdentity(actor),
    Math.max(1, Math.min(6, Math.trunc(roll.total))),
    clue,
  );
  await updateIdentity(actor, result.state);
  await audit(
    actor,
    clue ? "D6E2.Superheroic.TakeClue" : "D6E2.Superheroic.AddSuspicion",
    game.i18n.format(
      result.exposed
        ? "D6E2.Superheroic.SuspicionExposedAudit"
        : "D6E2.Superheroic.SuspicionSafeAudit",
      { roll: result.roll, suspicion: result.state.suspicion },
    ),
    roll,
  );
  return result.state;
}

export async function clearActorSecretIdentity(
  actorValue: object,
): Promise<SecretIdentityState> {
  const actor = actorDocument(actorValue);
  assertModule("secretIdentities");
  if (game.user?.isGM !== true) throw new Error("D6E2.Superheroic.GMRequired");
  const state = await updateIdentity(
    actor,
    clearSecretIdentityName(readActorSecretIdentity(actor)),
  );
  await audit(actor, "D6E2.Superheroic.ClearName", "Suspicion 0");
  return state;
}

export async function makeActorIdentityPublic(
  actorValue: object,
): Promise<SecretIdentityState> {
  const actor = actorDocument(actorValue);
  assertModule("secretIdentities");
  if (game.user?.isGM !== true) throw new Error("D6E2.Superheroic.GMRequired");
  const state = await updateIdentity(
    actor,
    makeSecretIdentityPublic(readActorSecretIdentity(actor)),
  );
  await audit(
    actor,
    "D6E2.Superheroic.GoPublic",
    game.i18n.localize("D6E2.Superheroic.GoPublicAudit"),
  );
  return state;
}

export async function addSuperheroicAction(actorValue: object): Promise<void> {
  const actor = actorDocument(actorValue);
  assertModule("heroPoints");
  assertOwner(actor);
  const round = readCombatantRound(actor);
  if (!round) throw new Error("D6E2.Combat.Error.NotInCombat");
  if (actorHeroPointBalance(actor) < 1) {
    throw new Error("D6E2.Roll.HeroPoint.Insufficient");
  }
  await transactActorHeroPoints(actor, 1, 0);
  try {
    await grantSuperheroicCombatantAction(actor, round.revision);
  } catch (error) {
    await transactActorHeroPoints(actor, 0, 1);
    throw error;
  }
  await audit(
    actor,
    "D6E2.Superheroic.ExtraAction",
    game.i18n.localize("D6E2.Superheroic.ExtraActionAudit"),
  );
}

export async function relyOnActorSuperpower(
  actorValue: object,
  talentId: string,
): Promise<void> {
  const actor = actorDocument(actorValue);
  assertOwner(actor);
  if (!currentSecondEditionCampaignProfile().superpowers) {
    throw new Error("D6E2.Superheroic.ModuleRequired");
  }
  const talent = actor.items.contents.find(
    (item) =>
      item.id === talentId &&
      item.type === "talent" &&
      item.system.superpower === true,
  );
  if (!talent) throw new Error("D6E2.Superpowers.TalentRequired");
  const plan = superpowerTalentCostPlan(
    integer(talent.system.cost),
    integer(talent.system.rank),
    integer(talent.system.superpowerEnhancementCost),
    integer(talent.system.superpowerLimitationCredit),
  );
  await ChatMessage.create({
    content: `<div class="od6chat-roll"><strong>${escaped(actor.name)}: ${escaped(talent.name)}</strong><span>${escaped(game.i18n.localize("D6E2.Superpowers.RelianceAudit"))}</span><small>${escaped(game.i18n.localize("D6E2.Superpowers.Cost"))}: ${plan.totalCost}D · ${escaped(game.i18n.localize("D6E2.RulesReference"))}: D6 System: Second Edition, pp. 212–226</small></div>`,
    flags: {
      [SYSTEM_ID]: {
        kind: "superpowerReliance",
        sourcePages: [212, 213, 223, 224, 225, 226],
        talentId,
        totalCost: plan.totalCost,
        version: 1,
      },
    },
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}

export async function transferSuperheroicHeroPoint(
  actorValue: object,
  targetValue: object,
): Promise<void> {
  const actor = actorDocument(actorValue);
  const target = actorDocument(targetValue);
  assertModule("heroPoints");
  assertOwner(actor);
  if (game.user?.isGM !== true && target.isOwner !== true) {
    throw new Error("D6E2.Superheroic.TargetOwnerRequired");
  }
  if (actor.id === target.id) throw new Error("D6E2.Superheroic.AllyRequired");
  if (actorHeroPointBalance(target) >= 3) {
    throw new Error("D6E2.Superheroic.TargetBelowThreeRequired");
  }
  await transactActorHeroPoints(actor, 1, 0);
  try {
    await transactActorHeroPoints(target, 0, 1);
  } catch (error) {
    await transactActorHeroPoints(actor, 0, 1);
    throw error;
  }
  await audit(
    actor,
    "D6E2.Superheroic.TransferHeroPoint",
    `${actor.name} → ${target.name}`,
  );
}

export async function boostSuperheroicTalent(
  actorValue: object,
  itemId: string,
): Promise<void> {
  const actor = actorDocument(actorValue);
  assertModule("heroPoints");
  assertOwner(actor);
  const item = actor.items.get(itemId);
  if (item?.type !== "talent") {
    throw new Error("D6E2.Superheroic.TalentRequired");
  }
  if (actorHeroPointBalance(actor) < 1) {
    throw new Error("D6E2.Roll.HeroPoint.Insufficient");
  }
  const rank = Math.max(1, integer(item.system.rank));
  await transactActorHeroPoints(actor, 1, 0);
  await audit(
    actor,
    "D6E2.Superheroic.BoostTalent",
    game.i18n.format("D6E2.Superheroic.BoostTalentAudit", {
      name: item.name,
      rank,
      boosted: rank + 1,
    }),
  );
}
