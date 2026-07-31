import {
  secondEditionNarrativeArcValidation,
  type D6MilestoneBalanceV1,
  type D6NarrativeAdvancementResultV1,
  type D6NarrativeArcProposalV1,
  type SecondEditionNarrativeArc,
  type SecondEditionNarrativeArcStatus,
  type SecondEditionNarrativeRewardKind,
} from "@d6-system-2e/core";
import { currentEditionCapabilityProfile } from "../settings/edition-capabilities";
import {
  currentCombinedPipScore,
  currentEffectivePipScore,
} from "../settings/pip-rules";
import { withAuthorizedAdvancementUpdate } from "./mechanical-edit-guard";
import { integer, record, stringValue } from "./sheets/values";
import { advancedSkillIssues } from "./skill-module";

const MILESTONE_PATH = "system.advancement.milestone";
const NARRATIVE_ARCS_PATH = "system.advancement.narrativeArcs";

function actorDocument(value: object): FoundryActorDocument {
  const actor = value as Partial<FoundryActorDocument>;
  if (
    typeof actor.id !== "string" ||
    typeof actor.system !== "object" ||
    typeof actor.update !== "function"
  ) {
    throw new TypeError(
      "The Second Edition advancement API requires a Foundry Actor document.",
    );
  }
  return actor as FoundryActorDocument;
}

function requireStrategy(
  strategy: "second-edition-milestone" | "second-edition-narrative",
): void {
  if (currentEditionCapabilityProfile().advancement.strategy !== strategy) {
    throw new Error("D6E2.Advancement.ProfileRequired");
  }
}

function requireOwner(actor: FoundryActorDocument): void {
  if (game.user?.isGM !== true && actor.isOwner !== true) {
    throw new Error("D6E2.Advancement.OwnerRequired");
  }
}

function requireAdvanceMode(actor: FoundryActorDocument): void {
  if (
    game.user?.isGM !== true &&
    record(actor.system.sheetMode).value !== "advance"
  ) {
    throw new Error("D6E2.Advancement.AdvanceModeRequired");
  }
}

function requireGM(): void {
  if (game.user?.isGM !== true) {
    throw new Error("D6E2.Advancement.GMRequired");
  }
}

export function readMilestoneBalance(actorValue: object): D6MilestoneBalanceV1 {
  const actor = actorDocument(actorValue);
  const milestone = record(record(actor.system.advancement).milestone);
  return Object.freeze({
    attributeDice: Math.max(0, integer(milestone.attributeDice)),
    skillPips: Math.max(0, integer(milestone.skillPips)),
  });
}

export async function awardMilestone(
  actorValue: object,
): Promise<D6MilestoneBalanceV1> {
  const actor = actorDocument(actorValue);
  requireStrategy("second-edition-milestone");
  requireGM();
  const current = readMilestoneBalance(actor);
  const next = Object.freeze({
    attributeDice: current.attributeDice + 1,
    skillPips: current.skillPips + 9,
  });
  await withAuthorizedAdvancementUpdate(actor, () =>
    actor.update({ [MILESTONE_PATH]: next }),
  );
  return next;
}

export async function exchangeMilestoneForPerk(
  actorValue: object,
  perkId: string | null,
  nameValue = "",
): Promise<D6MilestoneBalanceV1> {
  const actor = actorDocument(actorValue);
  requireStrategy("second-edition-milestone");
  requireOwner(actor);
  requireAdvanceMode(actor);
  if (currentEditionCapabilityProfile().rankedFeatures.state !== "active") {
    throw new Error("D6E2.Advancement.PerkModuleRequired");
  }
  const current = readMilestoneBalance(actor);
  if (current.attributeDice < 1 || current.skillPips < 9) {
    throw new Error("D6E2.Advancement.MilestoneBundleRequired");
  }
  const existing = perkId ? actor.items.get(perkId) : undefined;
  if (perkId && existing?.type !== "perk") {
    throw new Error("D6E2.Advancement.PerkRequired");
  }
  const name = nameValue.trim();
  if (!existing && name.length === 0) {
    throw new Error("D6E2.Advancement.PerkNameRequired");
  }
  const next = Object.freeze({
    attributeDice: current.attributeDice - 1,
    skillPips: current.skillPips - 9,
  });
  await withAuthorizedAdvancementUpdate(actor, () =>
    actor.update({ [MILESTONE_PATH]: next }),
  );
  try {
    if (existing) {
      await withAuthorizedAdvancementUpdate(existing, () =>
        existing.update({ "system.rank": integer(existing.system.rank) + 1 }),
      );
    } else {
      await withAuthorizedAdvancementUpdate(actor, () =>
        actor.createEmbeddedDocuments("Item", [
          {
            name,
            type: "perk",
            system: {
              focus: "",
              key: `milestone-perk-${name.toLocaleLowerCase().replace(/[^a-z0-9]+/gu, "-")}`,
              rank: 1,
              source: {
                book: "D6 System: Second Edition",
                module: "Milestone Character Advancement",
                page: 91,
              },
            },
          },
        ]),
      );
    }
  } catch (error) {
    await withAuthorizedAdvancementUpdate(actor, () =>
      actor.update({ [MILESTONE_PATH]: current }),
    );
    throw error;
  }
  return next;
}

function narrativeStatus(value: unknown): SecondEditionNarrativeArcStatus {
  return ["draft", "approved", "completed"].includes(String(value))
    ? (value as SecondEditionNarrativeArcStatus)
    : "draft";
}

function narrativeKind(value: unknown): SecondEditionNarrativeRewardKind {
  return value === "attribute" || value === "perk" ? value : "skill";
}

export function readNarrativeArcs(
  actorValue: object,
): readonly SecondEditionNarrativeArc[] {
  const actor = actorDocument(actorValue);
  const advancement = record(actor.system.advancement);
  const arcs = Array.isArray(advancement.narrativeArcs)
    ? advancement.narrativeArcs
    : [];
  return Object.freeze(
    arcs
      .map((value): SecondEditionNarrativeArc | null => {
        const arc = record(value);
        const steps = Array.isArray(arc.steps) ? arc.steps : [];
        const rewardKind = narrativeKind(arc.rewardKind);
        const normalized = Object.freeze({
          id: stringValue(arc.id),
          rewardId: stringValue(arc.rewardId),
          rewardKind,
          rewardName: stringValue(arc.rewardName),
          status: narrativeStatus(arc.status),
          steps: Object.freeze(
            steps.map((stepValue) => {
              const step = record(stepValue);
              return Object.freeze({
                complete: step.complete === true,
                description: stringValue(step.description),
                id: stringValue(step.id),
              });
            }),
          ),
          targetScore: Math.max(
            rewardKind === "perk" ? 1 : 3,
            integer(arc.targetScore),
          ),
          title: stringValue(arc.title),
        }) satisfies SecondEditionNarrativeArc;
        return normalized.id.length > 0 ? normalized : null;
      })
      .filter((arc): arc is SecondEditionNarrativeArc => arc !== null),
  );
}

function currentReward(
  actor: FoundryActorDocument,
  kind: SecondEditionNarrativeRewardKind,
  id: string,
  newPerkName = "",
): {
  readonly name: string;
  readonly score: number;
  readonly storedScore: number;
} {
  if (kind === "attribute") {
    const attribute = record(record(actor.system.attributes)[id]);
    if (!Object.hasOwn(attribute, "score")) {
      throw new Error("D6E2.Advancement.NarrativeRewardRequired");
    }
    const storedScore = integer(attribute.score);
    const attributeLabel = `${id.slice(0, 1).toUpperCase()}${id.slice(1)}`;
    return {
      name: game.i18n.localize(`D6E2.Attribute.${attributeLabel}`),
      score: currentEffectivePipScore(storedScore),
      storedScore,
    };
  }
  if (kind === "perk") {
    if (currentEditionCapabilityProfile().rankedFeatures.state !== "active") {
      throw new Error("D6E2.Advancement.PerkModuleRequired");
    }
    if (id.length === 0) {
      const name = newPerkName.trim();
      if (name.length === 0) {
        throw new Error("D6E2.Advancement.PerkNameRequired");
      }
      return { name, score: 0, storedScore: 0 };
    }
    const item = actor.items.get(id);
    if (item?.type !== "perk") {
      throw new Error("D6E2.Advancement.NarrativeRewardRequired");
    }
    const rank = Math.max(1, integer(item.system.rank));
    return { name: item.name, score: rank, storedScore: rank };
  }
  const item = actor.items.get(id);
  if (item?.type !== "skill") {
    throw new Error("D6E2.Advancement.NarrativeRewardRequired");
  }
  const storedScore = integer(item.system.score);
  if (item.system.training === "advanced") {
    return {
      name: item.name,
      score: currentEffectivePipScore(storedScore),
      storedScore,
    };
  }
  const attributeId = stringValue(item.system.attributeId);
  const attributeScore = integer(
    record(record(actor.system.attributes)[attributeId]).score,
  );
  return {
    name: item.name,
    score: currentCombinedPipScore(attributeScore, storedScore),
    storedScore,
  };
}

function changedArc(
  arc: SecondEditionNarrativeArc,
): D6NarrativeAdvancementResultV1 {
  return Object.freeze({ arc, changed: true });
}

function requireNarrativeRewardPermitted(
  actor: FoundryActorDocument,
  kind: SecondEditionNarrativeRewardKind,
  id: string,
  targetScore: number,
): void {
  if (kind === "attribute" && targetScore > 15) {
    throw new Error("D6E2.Advancement.MaximumReached");
  }
  if (kind !== "skill") return;
  const item = actor.items.get(id);
  if (
    item?.type === "skill" &&
    item.system.training === "advanced" &&
    advancedSkillIssues(actor, item, targetScore).length > 0
  ) {
    throw new Error("D6E2.Advancement.AdvancedSkillPrerequisite");
  }
}

async function writeArcs(
  actor: FoundryActorDocument,
  arcs: readonly SecondEditionNarrativeArc[],
): Promise<void> {
  await withAuthorizedAdvancementUpdate(actor, () =>
    actor.update({ [NARRATIVE_ARCS_PATH]: arcs }),
  );
}

export async function proposeNarrativeArc(
  actorValue: object,
  proposal: D6NarrativeArcProposalV1,
): Promise<D6NarrativeAdvancementResultV1> {
  const actor = actorDocument(actorValue);
  requireStrategy("second-edition-narrative");
  requireOwner(actor);
  requireAdvanceMode(actor);
  const title = proposal.title.trim();
  if (title.length === 0) {
    throw new Error("D6E2.Advancement.NarrativeTitleRequired");
  }
  const reward = currentReward(
    actor,
    proposal.rewardKind,
    proposal.rewardId,
    proposal.rewardName,
  );
  const targetScore = reward.score + (proposal.rewardKind === "perk" ? 1 : 3);
  requireNarrativeRewardPermitted(
    actor,
    proposal.rewardKind,
    proposal.rewardId,
    targetScore,
  );
  const requiredSteps =
    proposal.rewardKind === "perk"
      ? targetScore
      : Math.max(1, Math.floor(targetScore / 3));
  const descriptions = proposal.steps
    .map((step) => step.trim())
    .filter((step) => step.length > 0);
  if (descriptions.length !== requiredSteps) {
    throw new Error("D6E2.Advancement.NarrativeStepCount");
  }
  const arcId = globalThis.crypto.randomUUID();
  const arc = Object.freeze({
    id: arcId,
    rewardId: proposal.rewardId,
    rewardKind: proposal.rewardKind,
    rewardName: reward.name,
    status: "draft" as const,
    steps: Object.freeze(
      descriptions.map((description, index) =>
        Object.freeze({
          complete: false,
          description,
          id: `${arcId}-step-${index + 1}`,
        }),
      ),
    ),
    targetScore,
    title,
  }) satisfies SecondEditionNarrativeArc;
  await writeArcs(actor, [...readNarrativeArcs(actor), arc]);
  return changedArc(arc);
}

export async function approveNarrativeArc(
  actorValue: object,
  arcId: string,
): Promise<D6NarrativeAdvancementResultV1> {
  const actor = actorDocument(actorValue);
  requireStrategy("second-edition-narrative");
  requireGM();
  const arcs = readNarrativeArcs(actor);
  const current = arcs.find((arc) => arc.id === arcId);
  if (current?.status !== "draft") {
    throw new Error("D6E2.Advancement.NarrativeDraftRequired");
  }
  currentReward(
    actor,
    current.rewardKind,
    current.rewardId,
    current.rewardName,
  );
  if (!secondEditionNarrativeArcValidation(current).valid) {
    throw new Error("D6E2.Advancement.NarrativeInvalid");
  }
  const next = Object.freeze({ ...current, status: "approved" as const });
  await writeArcs(
    actor,
    arcs.map((arc) => (arc.id === arcId ? next : arc)),
  );
  return changedArc(next);
}

export async function toggleNarrativeArcStep(
  actorValue: object,
  arcId: string,
  stepId: string,
): Promise<D6NarrativeAdvancementResultV1> {
  const actor = actorDocument(actorValue);
  requireStrategy("second-edition-narrative");
  requireOwner(actor);
  requireAdvanceMode(actor);
  const arcs = readNarrativeArcs(actor);
  const current = arcs.find((arc) => arc.id === arcId);
  if (current?.status !== "approved") {
    throw new Error("D6E2.Advancement.NarrativeApprovedRequired");
  }
  if (!current.steps.some((step) => step.id === stepId)) {
    throw new Error("D6E2.Advancement.NarrativeStepRequired");
  }
  const next = Object.freeze({
    ...current,
    steps: Object.freeze(
      current.steps.map((step) =>
        step.id === stepId
          ? Object.freeze({ ...step, complete: !step.complete })
          : step,
      ),
    ),
  });
  await writeArcs(
    actor,
    arcs.map((arc) => (arc.id === arcId ? next : arc)),
  );
  return changedArc(next);
}

export async function completeNarrativeArc(
  actorValue: object,
  arcId: string,
): Promise<D6NarrativeAdvancementResultV1> {
  const actor = actorDocument(actorValue);
  requireStrategy("second-edition-narrative");
  requireGM();
  const arcs = readNarrativeArcs(actor);
  const current = arcs.find((arc) => arc.id === arcId);
  if (!current || !secondEditionNarrativeArcValidation(current).complete) {
    throw new Error("D6E2.Advancement.NarrativeIncomplete");
  }
  const reward = currentReward(
    actor,
    current.rewardKind,
    current.rewardId,
    current.rewardName,
  );
  const increase = current.rewardKind === "perk" ? 1 : 3;
  if (reward.score + increase !== current.targetScore) {
    throw new Error("D6E2.Advancement.NarrativeRewardChanged");
  }
  requireNarrativeRewardPermitted(
    actor,
    current.rewardKind,
    current.rewardId,
    current.targetScore,
  );
  const next = Object.freeze({ ...current, status: "completed" as const });
  const nextArcs = arcs.map((arc) => (arc.id === arcId ? next : arc));
  if (current.rewardKind === "attribute") {
    await withAuthorizedAdvancementUpdate(actor, () =>
      actor.update({
        [`system.attributes.${current.rewardId}.score`]: reward.storedScore + 3,
        [NARRATIVE_ARCS_PATH]: nextArcs,
      }),
    );
  } else if (current.rewardKind === "skill") {
    const item = actor.items.get(current.rewardId);
    if (!item) throw new Error("D6E2.Advancement.NarrativeRewardRequired");
    await withAuthorizedAdvancementUpdate(item, () =>
      item.update({ "system.score": reward.storedScore + 3 }),
    );
    try {
      await writeArcs(actor, nextArcs);
    } catch (error) {
      await withAuthorizedAdvancementUpdate(item, () =>
        item.update({ "system.score": reward.storedScore }),
      );
      throw error;
    }
  } else if (current.rewardId.length > 0) {
    const item = actor.items.get(current.rewardId);
    if (item?.type !== "perk") {
      throw new Error("D6E2.Advancement.NarrativeRewardRequired");
    }
    await withAuthorizedAdvancementUpdate(item, () =>
      item.update({ "system.rank": current.targetScore }),
    );
    try {
      await writeArcs(actor, nextArcs);
    } catch (error) {
      await withAuthorizedAdvancementUpdate(item, () =>
        item.update({ "system.rank": reward.storedScore }),
      );
      throw error;
    }
  } else {
    const [created] = await withAuthorizedAdvancementUpdate(actor, () =>
      actor.createEmbeddedDocuments("Item", [
        {
          name: current.rewardName,
          type: "perk",
          system: {
            focus: "",
            key: `narrative-perk-${current.rewardName.toLocaleLowerCase().replace(/[^a-z0-9]+/gu, "-")}`,
            rank: current.targetScore,
            source: {
              book: "D6 System: Second Edition",
              module: "Narrative Advancement",
              page: 92,
            },
          },
        },
      ]),
    );
    if (!created) throw new Error("D6E2.Advancement.NarrativeRewardRequired");
    const completed = Object.freeze({ ...next, rewardId: created.id });
    try {
      await writeArcs(
        actor,
        arcs.map((arc) => (arc.id === arcId ? completed : arc)),
      );
    } catch (error) {
      await withAuthorizedAdvancementUpdate(actor, () =>
        actor.deleteEmbeddedDocuments("Item", [created.id]),
      );
      throw error;
    }
    return changedArc(completed);
  }
  return changedArc(next);
}

export async function removeNarrativeArc(
  actorValue: object,
  arcId: string,
): Promise<boolean> {
  const actor = actorDocument(actorValue);
  requireStrategy("second-edition-narrative");
  requireOwner(actor);
  requireAdvanceMode(actor);
  const arcs = readNarrativeArcs(actor);
  const current = arcs.find((arc) => arc.id === arcId);
  if (!current) return false;
  if (current.status === "approved" && game.user?.isGM !== true) {
    throw new Error("D6E2.Advancement.GMRequired");
  }
  await writeArcs(
    actor,
    arcs.filter((arc) => arc.id !== arcId),
  );
  return true;
}
