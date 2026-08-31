import {
  FREE_D6_CREATION_STRATEGY_ID,
  FREE_D6_DEFAULT_CREATION_POINTS,
  finalizeFreeD6CreationDraft,
  freeD6AttributePipCost,
  freeD6CreationLedger,
  freeD6CreationTransaction,
  freeD6PointUnits,
  freeD6SkillPipCost,
  replaceFreeD6CreationTransaction,
  type D6FreeD6CreationDraftV1,
  type D6FreeD6CreationLedgerV1,
} from "@d6-system-2e/core";
import {
  currentConfiguredRulesProfile,
  profileUsesFreeD6AttributeVocabulary,
} from "../settings/rules-profile-library";
import { withAuthorizedCreationUpdate } from "./mechanical-edit-guard";
import { integer, record, stringValue } from "./sheets/values";

export interface FreeD6CreationViewV1 {
  readonly active: boolean;
  readonly draft: D6FreeD6CreationDraftV1;
  readonly ledger: D6FreeD6CreationLedgerV1;
  readonly strategy: "free-d6-creation-points";
}

export function freeD6CreationStrategyActive(): boolean {
  return (
    currentConfiguredRulesProfile().strategies.creation ===
    FREE_D6_CREATION_STRATEGY_ID
  );
}

export function freeD6CreationStrategyState():
  "active" | "other" | "unavailable" {
  const profile = currentConfiguredRulesProfile();
  if (!profileUsesFreeD6AttributeVocabulary(profile)) return "other";
  return profile.strategies.creation === FREE_D6_CREATION_STRATEGY_ID
    ? "active"
    : "unavailable";
}

function baselineAttributes(
  actor: FoundryActorDocument,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(record(actor.system.attributes)).map(([id, value]) => [
      id,
      integer(record(value).score),
    ]),
  );
}

function baselineSkills(actor: FoundryActorDocument): Record<string, number> {
  return Object.fromEntries(
    actor.items.contents
      .filter((item) => ["skill", "specialization"].includes(item.type))
      .map((item) => [item.id, integer(item.system.score)]),
  );
}

export function initialFreeD6CreationDraft(
  actor: FoundryActorDocument,
  budget = FREE_D6_DEFAULT_CREATION_POINTS,
): D6FreeD6CreationDraftV1 {
  return Object.freeze({
    baselineAttributeScores: Object.freeze(baselineAttributes(actor)),
    baselineSkillScores: Object.freeze(baselineSkills(actor)),
    budgetUnits: freeD6PointUnits(budget),
    finalized: false,
    revision: 0,
    strategyId: FREE_D6_CREATION_STRATEGY_ID,
    templateId: stringValue(
      record(record(actor.system.creation).template).templateId,
    ),
    templatePointUnits: 0,
    transactions: Object.freeze([]),
    version: 1,
  });
}

export function readFreeD6CreationDraft(
  actor: FoundryActorDocument,
): D6FreeD6CreationDraftV1 {
  const raw = record(record(actor.system.creation).freeD6);
  if (
    raw.version !== 1 ||
    raw.strategyId !== FREE_D6_CREATION_STRATEGY_ID ||
    !Number.isSafeInteger(raw.budgetUnits) ||
    !Array.isArray(raw.transactions)
  ) {
    return initialFreeD6CreationDraft(actor);
  }
  return Object.freeze({
    baselineAttributeScores: Object.freeze(
      Object.fromEntries(
        Object.entries(record(raw.baselineAttributeScores)).map(
          ([id, score]) => [id, integer(score)],
        ),
      ),
    ),
    baselineSkillScores: Object.freeze(
      Object.fromEntries(
        Object.entries(record(raw.baselineSkillScores)).map(([id, score]) => [
          id,
          integer(score),
        ]),
      ),
    ),
    budgetUnits: integer(raw.budgetUnits),
    finalized: raw.finalized === true,
    revision: Math.max(0, integer(raw.revision)),
    strategyId: FREE_D6_CREATION_STRATEGY_ID,
    templateId: stringValue(raw.templateId),
    templatePointUnits: integer(raw.templatePointUnits),
    transactions: Object.freeze(
      raw.transactions.map((entry) => {
        const transaction = record(entry);
        return Object.freeze({
          id: stringValue(transaction.id),
          kind: stringValue(
            transaction.kind,
          ) as D6FreeD6CreationDraftV1["transactions"][number]["kind"],
          label: stringValue(transaction.label),
          pointUnits: integer(transaction.pointUnits),
          sourceId: stringValue(transaction.sourceId),
        });
      }),
    ),
    version: 1,
  });
}

export function freeD6CreationView(
  actor: FoundryActorDocument,
): FreeD6CreationViewV1 {
  const draft = readFreeD6CreationDraft(actor);
  return Object.freeze({
    active:
      actor.type === "character" &&
      record(actor.system.creation).active === true,
    draft,
    ledger: freeD6CreationLedger(draft),
    strategy: "free-d6-creation-points",
  });
}

async function persistDraft(
  actor: FoundryActorDocument,
  draft: D6FreeD6CreationDraftV1,
  extra: Readonly<Record<string, unknown>> = {},
): Promise<void> {
  await withAuthorizedCreationUpdate(actor, () =>
    actor.update({ "system.creation.freeD6": draft, ...extra }),
  );
}

export async function setFreeD6CreationBudget(
  actor: FoundryActorDocument,
  budget: number,
): Promise<void> {
  if (game.user?.isGM !== true) throw new Error("D6E2.Creation.GMRequired");
  const current = readFreeD6CreationDraft(actor);
  const next = Object.freeze({
    ...current,
    budgetUnits: freeD6PointUnits(budget),
    revision: current.revision + 1,
  });
  freeD6CreationLedger(next);
  await persistDraft(actor, next);
}

export async function adjustFreeD6CreationAttribute(
  actor: FoundryActorDocument,
  attributeId: string,
  nextScore: number,
): Promise<void> {
  const current = readFreeD6CreationDraft(actor);
  const baseline = current.baselineAttributeScores[attributeId] ?? 0;
  if (nextScore < baseline) {
    throw new Error("D6E2.Creation.Error.BelowTemplateBaseline");
  }
  const delta = nextScore - baseline;
  const id = `attribute:${attributeId}`;
  const transaction =
    delta === 0
      ? null
      : freeD6CreationTransaction({
          id,
          kind: "attribute",
          label: attributeId,
          points: freeD6AttributePipCost(delta),
          sourceId: attributeId,
        });
  const next = replaceFreeD6CreationTransaction(
    current,
    transaction,
    id,
    current.revision,
  );
  if (freeD6CreationLedger(next).remainingUnits < 0) {
    throw new Error("D6E2.Creation.AttributeBudgetExceeded");
  }
  await persistDraft(actor, next, {
    [`system.attributes.${attributeId}.score`]: nextScore,
  });
}

export async function adjustFreeD6CreationSkill(
  actor: FoundryActorDocument,
  item: FoundryItemDocument,
  nextScore: number,
): Promise<void> {
  const current = readFreeD6CreationDraft(actor);
  const baseline = current.baselineSkillScores[item.id] ?? 0;
  if (nextScore < baseline) {
    throw new Error("D6E2.Creation.Error.BelowTemplateBaseline");
  }
  const delta = nextScore - baseline;
  const id = `skill:${item.id}`;
  const transaction =
    delta === 0
      ? null
      : freeD6CreationTransaction({
          id,
          kind: item.type === "specialization" ? "specialization" : "skill",
          label: item.name,
          points: freeD6SkillPipCost(delta),
          sourceId: item.id,
        });
  const next = replaceFreeD6CreationTransaction(
    current,
    transaction,
    id,
    current.revision,
  );
  if (freeD6CreationLedger(next).remainingUnits < 0) {
    throw new Error("D6E2.Creation.SkillBudgetExceeded");
  }
  const previousScore = integer(item.system.score);
  await withAuthorizedCreationUpdate(actor, async () => {
    await item.update({ "system.score": nextScore });
    try {
      await actor.update({ "system.creation.freeD6": next });
    } catch (error) {
      await item.update({ "system.score": previousScore });
      throw error;
    }
  });
}

export async function recordFreeD6CreationItemCost(
  actor: FoundryActorDocument,
  input: Readonly<{
    readonly id: string;
    readonly kind: "advanced-skill" | "specialization";
    readonly label: string;
    readonly points: number;
    readonly sourceId: string;
  }>,
): Promise<void> {
  const current = readFreeD6CreationDraft(actor);
  const transaction = freeD6CreationTransaction(input);
  const next = replaceFreeD6CreationTransaction(
    current,
    transaction,
    input.id,
    current.revision,
  );
  if (freeD6CreationLedger(next).remainingUnits < 0) {
    throw new Error("D6E2.Creation.SkillBudgetExceeded");
  }
  await persistDraft(actor, next);
}

export async function finalizeFreeD6Creation(
  actor: FoundryActorDocument,
): Promise<void> {
  const current = readFreeD6CreationDraft(actor);
  const finalized = finalizeFreeD6CreationDraft(current, current.revision);
  const ledger = freeD6CreationLedger(current);
  if (ledger.characterPointSeedUnits % 2 !== 0) {
    throw new Error("D6E2.Creation.Error.FractionalCharacterPoints");
  }
  await persistDraft(actor, finalized, {
    "system.creation.active": false,
    "system.resources.characterPoints.value":
      ledger.characterPointSeedUnits / 2,
  });
}
