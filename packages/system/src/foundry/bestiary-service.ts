import {
  D6_BESTIARY_CONTRACT_VERSION,
  type D6BestiaryCreationV1,
  type D6BestiaryIssueCode,
  type D6BestiaryPreviewV1,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { missingSkillSources } from "../content/skill-catalog";
import { resolvedBestiaryEntry } from "../registries/bestiary";
import {
  campaignOptionalAttributeIds,
  currentSecondEditionCampaignProfile,
} from "../settings/campaign-profile";
import {
  currentActiveAttributeDefinitions,
  currentAttributeRuntimeStrategy,
} from "../settings/attributes";

interface BestiaryActorDocument extends FoundryActorDocument {
  delete(): Promise<unknown>;
}

interface ActorDocumentClass {
  create(
    source: Record<string, unknown>,
  ): Promise<BestiaryActorDocument | null>;
}

const creatingEntries = new Set<string>();

function emptyPreview(entryId: string): D6BestiaryPreviewV1 {
  return Object.freeze({
    attributeScores: Object.freeze([]),
    canCreate: false,
    catalogId: "",
    catalogLabel: "",
    defenseOverrides: Object.freeze({ dodge: 0, parry: 0 }),
    entryId,
    entryLabel: entryId,
    itemAdditions: Object.freeze([]),
    issues: Object.freeze<D6BestiaryIssueCode[]>(["entry-missing"]),
    magicPoints: 0,
    ownerId: "",
    rulesFamily: "d6-system-second-edition",
    scale: 0,
    source: Object.freeze({ book: "", page: 0 }),
    version: D6_BESTIARY_CONTRACT_VERSION,
  });
}

export function previewBestiaryEntry(entryId: string): D6BestiaryPreviewV1 {
  const resolved = resolvedBestiaryEntry(entryId);
  if (!resolved) return emptyPreview(entryId);
  const issues = new Set<D6BestiaryIssueCode>();
  if (game.user?.isGM !== true) issues.add("gm-required");
  const firstEdition = currentAttributeRuntimeStrategy().family === "open-d6";
  const activeRulesFamily = firstEdition
    ? "open-d6-first-edition"
    : "d6-system-second-edition";
  const entryRulesFamily =
    resolved.entry.rulesFamily ?? "d6-system-second-edition";
  if (entryRulesFamily !== activeRulesFamily)
    issues.add("first-edition-profile");
  const campaign = currentSecondEditionCampaignProfile();
  const activeAttributes = new Set(
    currentActiveAttributeDefinitions().map(({ id }) => id),
  );
  if (
    Object.keys(resolved.entry.attributeScores).some(
      (attributeId) => !activeAttributes.has(attributeId),
    )
  ) {
    issues.add("attribute-inactive");
  }
  if ((resolved.entry.magicPoints ?? 0) > 0 && !campaign.magicPointsCasting) {
    issues.add("magic-points-inactive");
  }
  return Object.freeze({
    attributeScores: Object.freeze(
      Object.entries(resolved.entry.attributeScores).map(
        ([attributeId, score]) => Object.freeze({ attributeId, score }),
      ),
    ),
    canCreate: issues.size === 0,
    catalogId: resolved.catalog.id,
    catalogLabel: resolved.catalog.label,
    defenseOverrides: resolved.entry.defenseOverrides,
    entryId: resolved.entry.id,
    entryLabel: resolved.entry.label,
    itemAdditions: Object.freeze(
      (resolved.entry.items ?? []).map((item) =>
        Object.freeze({ name: item.name, type: item.type }),
      ),
    ),
    issues: Object.freeze([...issues]),
    magicPoints: resolved.entry.magicPoints ?? 0,
    ownerId: resolved.catalog.ownerId,
    rulesFamily: entryRulesFamily,
    scale: resolved.entry.scale ?? 0,
    source: resolved.entry.source,
    version: D6_BESTIARY_CONTRACT_VERSION,
  });
}

function activeSkillModules(): ReadonlySet<string> {
  const campaign = currentSecondEditionCampaignProfile();
  return new Set([
    ...(campaign.fantasySkills ? ["fantasy"] : []),
    ...(campaign.scienceFictionSkills ? ["science-fiction"] : []),
    ...(campaign.superheroicSkills ? ["superheroic"] : []),
    ...(campaign.freeformSkillBasedMagic ? ["freeform-magic"] : []),
    ...(campaign.magicPointsCasting ? ["magic-points"] : []),
  ]);
}

export async function createBestiaryCreature(
  entryId: string,
): Promise<D6BestiaryCreationV1> {
  if (creatingEntries.has(entryId)) throw new Error("D6E2.Bestiary.InProgress");
  creatingEntries.add(entryId);
  try {
    const preview = previewBestiaryEntry(entryId);
    if (!preview.canCreate) {
      throw new Error(
        `D6E2.Bestiary.Issue.${preview.issues[0] ?? "entry-missing"}`,
      );
    }
    const resolved = resolvedBestiaryEntry(entryId);
    if (!resolved) throw new Error("D6E2.Bestiary.Issue.entry-missing");
    const campaign = currentSecondEditionCampaignProfile();
    const firstEdition = preview.rulesFamily === "open-d6-first-edition";
    const contributedItems = (resolved.entry.items ?? []).map((item) => ({
      ...(item.img ? { img: item.img } : {}),
      flags: {
        [SYSTEM_ID]: {
          bestiary: {
            catalogId: resolved.catalog.id,
            entryId: resolved.entry.id,
            version: D6_BESTIARY_CONTRACT_VERSION,
          },
        },
      },
      name: item.name,
      system: structuredClone(item.system),
      type: item.type,
    }));
    const skillItems = missingSkillSources(
      new Set(),
      firstEdition ? "open-d6" : "second-edition",
      firstEdition ? new Set() : campaignOptionalAttributeIds(campaign),
      firstEdition ? new Set() : activeSkillModules(),
    ).map((source) => {
      const system = source.system as Record<string, unknown>;
      const key = typeof system.key === "string" ? system.key : "";
      const attributeId =
        typeof system.attributeId === "string" ? system.attributeId : "";
      const combined = resolved.entry.skillScores?.[key];
      return combined === undefined
        ? source
        : {
            ...source,
            system: {
              ...system,
              score: Math.max(
                0,
                combined - (resolved.entry.attributeScores[attributeId] ?? 0),
              ),
            },
          };
    });
    const attributes = Object.fromEntries(
      Object.entries(resolved.entry.attributeScores).map(
        ([attributeId, score]) => [attributeId, { score }],
      ),
    );
    const actorClass = Actor as ActorDocumentClass;
    const bestiary = {
      applied: true,
      catalogId: resolved.catalog.id,
      entryId: resolved.entry.id,
      label: resolved.entry.label,
      ownerId: resolved.catalog.ownerId,
      sourceBook: resolved.entry.source.book,
      sourcePage: resolved.entry.source.page,
      version: D6_BESTIARY_CONTRACT_VERSION,
    };
    const actor = await actorClass.create({
      ...(resolved.entry.img ? { img: resolved.entry.img } : {}),
      items: [...skillItems, ...contributedItems],
      name: resolved.entry.label,
      system: {
        attributes,
        bestiary,
        biography: resolved.entry.biography ?? "",
        defenses: {
          dodgeOverride: resolved.entry.defenseOverrides.dodge,
          parryOverride: resolved.entry.defenseOverrides.parry,
        },
        resources: {
          magicPoints: {
            initialized: preview.magicPoints > 0,
            value: preview.magicPoints,
          },
        },
        scale: preview.scale,
      },
      type: "creature",
    });
    if (!actor) throw new Error("D6E2.Bestiary.CreationFailed");
    // Foundry v14 constructs TypeDataModel defaults before preCreateActor. New
    // migration-backed fields can consequently retain those defaults even when
    // they were explicit in the creation source. Reassert the complete values
    // through the normal persisted update boundary before returning the actor.
    try {
      await actor.update({
        "system.bestiary": bestiary,
        "system.scale": preview.scale,
      });
    } catch (error) {
      await actor.delete();
      throw error;
    }
    return Object.freeze({
      actorId: actor.id,
      preview,
      version: D6_BESTIARY_CONTRACT_VERSION,
    });
  } finally {
    creatingEntries.delete(entryId);
  }
}
