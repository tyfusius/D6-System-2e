import {
  D6_FEATURE_CATALOG_CONTRACT_VERSION,
  type D6FeatureCatalogApplicationV1,
  type D6FeatureCatalogIssueCode,
  type D6FeatureCatalogPreviewV1,
  superpowerTalentCostPlan,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { resolvedFeatureDefinition } from "../registries/feature-catalogs";
import { currentOptionalCapabilityRuntime } from "../settings/optional-capabilities";
import { currentSecondEditionCampaignProfile } from "../settings/campaign-profile";
import { withAuthorizedFeatureUpdate } from "./mechanical-edit-guard";

const applyingActors = new WeakSet<object>();

function actorDocument(value: unknown): FoundryActorDocument | null {
  if (typeof value !== "object" || value === null) return null;
  const actor = value as Partial<FoundryActorDocument>;
  return typeof actor.type === "string" && actor.system && actor.items
    ? (value as FoundryActorDocument)
    : null;
}

function emptyPreview(
  definitionId: string,
  focus: string,
  rank: number,
): D6FeatureCatalogPreviewV1 {
  return Object.freeze({
    canApply: false,
    catalogId: "",
    catalogLabel: "",
    creationSkillCostScore: 0,
    definitionId,
    featureLabel: definitionId,
    focus,
    issues: Object.freeze<D6FeatureCatalogIssueCode[]>(["feature-missing"]),
    kind: "perk",
    mechanics: Object.freeze([]),
    ownerId: "",
    rank,
    source: Object.freeze({ book: "", page: 0 }),
    version: D6_FEATURE_CATALOG_CONTRACT_VERSION,
  });
}

function storedDefinitionId(item: FoundryItemDocument): string {
  const value = (
    item as FoundryItemDocument & {
      getFlag?(namespace: string, key: string): unknown;
    }
  ).getFlag?.(SYSTEM_ID, "featureDefinition") as
    { definitionId?: unknown } | undefined;
  return typeof value?.definitionId === "string" ? value.definitionId : "";
}

export function previewFeatureDefinition(
  actorValue: unknown,
  definitionId: string,
  options: Readonly<{ readonly focus?: string; readonly rank?: number }> = {},
): D6FeatureCatalogPreviewV1 {
  const focus = options.focus?.trim() ?? "";
  const rank = Number.isSafeInteger(options.rank) ? Number(options.rank) : 1;
  const resolved = resolvedFeatureDefinition(definitionId);
  if (!resolved) return emptyPreview(definitionId, focus, rank);
  const actor = actorDocument(actorValue);
  const issues = new Set<D6FeatureCatalogIssueCode>();
  if (!actor || !["character", "creature", "npc"].includes(actor.type)) {
    issues.add("actor-type");
  }
  if (actor?.isOwner === false && game.user?.isGM !== true) {
    issues.add("owner-required");
  }
  if (currentOptionalCapabilityRuntime().rankedFeatures.state !== "active") {
    issues.add("module-inactive");
  }
  if (
    resolved.definition.superpower &&
    !currentSecondEditionCampaignProfile().superpowers
  ) {
    issues.add("module-inactive");
  }
  if (rank < resolved.definition.rankMinimum) issues.add("rank-minimum");
  if (
    resolved.definition.rankMaximum !== undefined &&
    rank > resolved.definition.rankMaximum
  ) {
    issues.add("rank-maximum");
  }
  if (resolved.definition.focusRequired && focus.length === 0) {
    issues.add("focus-required");
  }
  if (
    !resolved.definition.repeatable &&
    actor?.items.contents.some(
      (item) => storedDefinitionId(item) === resolved.definition.id,
    )
  ) {
    issues.add("duplicate");
  }
  const ownedDefinitionIds = new Set(
    actor?.items.contents
      .map(storedDefinitionId)
      .filter((id) => id.length > 0) ?? [],
  );
  if (
    resolved.definition.prerequisites?.some(
      (required) => !ownedDefinitionIds.has(required),
    )
  ) {
    issues.add("prerequisite");
  }
  if (
    resolved.definition.conflicts?.some((conflict) =>
      ownedDefinitionIds.has(conflict),
    )
  ) {
    issues.add("conflict");
  }
  const creationSkillDice =
    resolved.definition.kind === "talent"
      ? resolved.definition.creationSkillDice * rank
      : rank;
  const superpower = resolved.definition.superpower
    ? superpowerTalentCostPlan(
        resolved.definition.creationSkillDice,
        rank,
        resolved.definition.superpower.enhancementCostPerRank,
        resolved.definition.superpower.limitationCredit,
      )
    : null;
  return Object.freeze({
    canApply: issues.size === 0,
    catalogId: resolved.catalog.id,
    catalogLabel: resolved.catalog.label,
    creationSkillCostScore: (superpower?.totalCost ?? creationSkillDice) * 3,
    definitionId: resolved.definition.id,
    featureLabel: resolved.definition.label,
    focus,
    issues: Object.freeze([...issues]),
    kind: resolved.definition.kind,
    mechanics: resolved.definition.mechanics,
    ownerId: resolved.catalog.ownerId,
    rank,
    source: resolved.definition.source,
    ...(superpower
      ? {
          superpower: Object.freeze({
            automatic: resolved.definition.superpower?.automatic === true,
            baseCostPerRank: superpower.baseCostPerRank,
            enhancementCostPerRank: superpower.enhancementCostPerRank,
            limitationCredit: superpower.limitationCredit,
            totalCost: superpower.totalCost,
          }),
        }
      : {}),
    version: D6_FEATURE_CATALOG_CONTRACT_VERSION,
  });
}

export function featureDefinitionItemSource(
  resolved: NonNullable<ReturnType<typeof resolvedFeatureDefinition>>,
  preview: D6FeatureCatalogPreviewV1,
): Record<string, unknown> {
  const system: Record<string, unknown> = {
    description: "",
    focus: preview.focus,
    key: resolved.definition.id,
    rank: preview.rank,
    source: {
      book: preview.source.book,
      module: "Perks, Flaws & Talents",
      page: preview.source.page,
    },
  };
  if (resolved.definition.kind === "talent") {
    system.cost =
      preview.superpower?.baseCostPerRank ?? preview.creationSkillCostScore / 3;
    system.repeatable = resolved.definition.repeatable;
    system.superpower = preview.superpower !== undefined;
    system.superpowerAutomatic = preview.superpower?.automatic ?? false;
    system.superpowerEnhancementCost =
      preview.superpower?.enhancementCostPerRank ?? 0;
    system.superpowerLimitationCredit =
      preview.superpower?.limitationCredit ?? 0;
  }
  return {
    flags: {
      [SYSTEM_ID]: {
        featureDefinition: {
          catalogId: resolved.catalog.id,
          catalogVersion: resolved.catalog.version,
          definitionId: resolved.definition.id,
          conflicts: [...(resolved.definition.conflicts ?? [])],
          mechanics: structuredClone(resolved.definition.mechanics),
          ownerId: resolved.catalog.ownerId,
          prerequisites: [...(resolved.definition.prerequisites ?? [])],
          version: D6_FEATURE_CATALOG_CONTRACT_VERSION,
        },
      },
    },
    name: resolved.definition.label,
    system,
    type: resolved.definition.kind,
  };
}

export async function applyFeatureDefinition(
  actorValue: unknown,
  definitionId: string,
  options: Readonly<{ readonly focus?: string; readonly rank?: number }> = {},
): Promise<D6FeatureCatalogApplicationV1> {
  const actor = actorDocument(actorValue);
  if (!actor) throw new Error("D6E2.FeatureCatalog.ActorRequired");
  if (applyingActors.has(actor))
    throw new Error("D6E2.FeatureCatalog.InProgress");
  applyingActors.add(actor);
  try {
    const preview = previewFeatureDefinition(actor, definitionId, options);
    if (!preview.canApply) {
      throw new Error(
        `D6E2.FeatureCatalog.Issue.${preview.issues[0] ?? "feature-missing"}`,
      );
    }
    const resolved = resolvedFeatureDefinition(definitionId);
    if (!resolved) throw new Error("D6E2.FeatureCatalog.Issue.feature-missing");
    const created = await withAuthorizedFeatureUpdate(actor, () =>
      actor.createEmbeddedDocuments("Item", [
        featureDefinitionItemSource(resolved, preview),
      ]),
    );
    const itemId = created[0]?.id;
    if (!itemId) throw new Error("D6E2.FeatureCatalog.ItemCreationFailed");
    return Object.freeze({
      itemId,
      preview,
      version: D6_FEATURE_CATALOG_CONTRACT_VERSION,
    });
  } finally {
    applyingActors.delete(actor);
  }
}
