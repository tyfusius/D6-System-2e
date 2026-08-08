import {
  D6_CHARACTER_TEMPLATE_CONTRACT_VERSION,
  type D6CharacterTemplateApplicationV1,
  type D6CharacterTemplateIssueCode,
  type D6CharacterTemplatePreviewV1,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { DEFAULT_SKILL_IMAGE } from "../document-default-images";
import { allSkillCatalogEntries } from "../content/skill-catalog";
import { resolvedCharacterTemplate } from "../registries/character-templates";
import { resolvedFeatureDefinition } from "../registries/feature-catalogs";
import { currentSecondEditionCampaignProfile } from "../settings/campaign-profile";
import {
  currentConfiguredRulesProfile,
  strategyUsesOpenD6,
} from "../settings/rules-profile-library";
import { currentFirstEditionGenreProfile } from "../settings/first-edition-genre-profile";
import { currentAttributeCreationRuntime } from "../settings/attributes";
import {
  currentSettingActiveAttributes,
  currentSettingProfile,
} from "../settings/setting-profile";
import {
  featureDefinitionItemSource,
  previewFeatureDefinition,
} from "./feature-catalog-service";
import { withAuthorizedTemplateUpdate } from "./mechanical-edit-guard";
import { integer, record, stringValue } from "./sheets/values";

const applyingActors = new WeakSet<object>();
const ADVISORY_TEMPLATE_ISSUES = new Set<D6CharacterTemplateIssueCode>([
  "attribute-budget",
  "suggested-skill-missing",
]);

function actorDocument(value: unknown): FoundryActorDocument | null {
  if (typeof value !== "object" || value === null) return null;
  const actor = value as Partial<FoundryActorDocument>;
  return typeof actor.type === "string" && actor.system && actor.items
    ? (value as FoundryActorDocument)
    : null;
}

function emptyPreview(templateId: string): D6CharacterTemplatePreviewV1 {
  return Object.freeze({
    attributeChanges: Object.freeze([]),
    canApply: false,
    catalogId: "",
    catalogLabel: "",
    itemAdditions: Object.freeze([]),
    issues: Object.freeze<D6CharacterTemplateIssueCode[]>(["template-missing"]),
    ownerId: "",
    source: Object.freeze({ book: "", page: 0 }),
    suggestedSkills: Object.freeze([]),
    rulesFamily: "d6-system-second-edition",
    superpowerAdditions: Object.freeze([]),
    superpowerCreationDice: 0,
    templateId,
    templateLabel: templateId,
    templateVersion: D6_CHARACTER_TEMPLATE_CONTRACT_VERSION,
    unassignedAttributeScore: 0,
    version: D6_CHARACTER_TEMPLATE_CONTRACT_VERSION,
  });
}

function storedFeatureDefinitionId(item: FoundryItemDocument): string {
  const stored = (
    item as FoundryItemDocument & {
      getFlag?(namespace: string, key: string): unknown;
    }
  ).getFlag?.(SYSTEM_ID, "featureDefinition") as
    { definitionId?: unknown } | undefined;
  return typeof stored?.definitionId === "string" ? stored.definitionId : "";
}

function suggestedSkillSource(
  rulesFamily: "d6-system-second-edition" | "open-d6-first-edition",
  key: string,
): Record<string, unknown> | null {
  let settingProfile: ReturnType<typeof currentSettingProfile> | undefined;
  try {
    settingProfile = currentSettingProfile();
  } catch {
    // Isolated domain tests can exercise template resolution without settings.
  }
  const settingEntry = settingProfile?.skills.find(
    (skill) => skill.key === key,
  );
  if (settingEntry) {
    return {
      img: settingEntry.img,
      name: settingEntry.name,
      system: {
        attributeId: settingEntry.attributeId,
        description: settingEntry.description,
        key: settingEntry.key,
        score: 0,
        source: {
          book: settingProfile?.label ?? "",
          module: settingProfile?.id ?? "",
          page: 0,
        },
        training: settingEntry.training,
      },
      type: "skill",
    };
  }
  if (rulesFamily === "open-d6-first-edition") {
    const profile = currentFirstEditionGenreProfile();
    const entry = profile.skills.find((skill) => skill.key === key);
    if (!entry) return null;
    return {
      img: DEFAULT_SKILL_IMAGE,
      name: entry.name,
      system: {
        attributeId: entry.attributeId,
        description: "",
        key: entry.key,
        score: 0,
        source: {
          book: entry.source.book,
          module: profile.genreId,
          page: entry.source.page,
        },
        training: "standard",
      },
      type: "skill",
    };
  }
  const entry = allSkillCatalogEntries().find(
    (skill) => skill.profiles.includes("second-edition") && skill.key === key,
  );
  if (!entry) return null;
  return {
    img: DEFAULT_SKILL_IMAGE,
    name: entry.name,
    system: {
      attributeId: entry.attributeId,
      description: "",
      key: entry.key,
      score: 0,
      source: {
        book: "D6 System: Second Edition",
        module: entry.module,
        page: entry.sourcePage,
      },
      training: entry.training ?? "standard",
    },
    type: "skill",
  };
}

export function previewCharacterTemplate(
  actorValue: unknown,
  templateId: string,
): D6CharacterTemplatePreviewV1 {
  const resolved = resolvedCharacterTemplate(templateId);
  if (!resolved) return emptyPreview(templateId);
  const actor = actorDocument(actorValue);
  const issues = new Set<D6CharacterTemplateIssueCode>();
  if (actor?.type !== "character") issues.add("actor-type");
  const system = record(actor?.system);
  const attributes = record(system.attributes);
  const creation = record(system.creation);
  if (creation.active !== true) issues.add("creation-inactive");
  if (record(creation.template).applied === true) issues.add("already-applied");
  if (actor?.isOwner === false && game.user?.isGM !== true) {
    issues.add("owner-required");
  }
  const firstEdition = strategyUsesOpenD6(
    currentConfiguredRulesProfile(),
    "attributes",
  );
  const campaign = currentSecondEditionCampaignProfile();
  const attributeRuntime = currentAttributeCreationRuntime();
  const superheroic = resolved.template.superheroic;
  if (
    superheroic &&
    (!campaign.superheroicSkills ||
      !campaign.superpowers ||
      campaign.superpowerCreationDice !== 10 ||
      campaign.creation.attributeBudgetScore !== 45 ||
      campaign.creation.skillBudgetScore !== 24 ||
      !campaign.activeAttributeIds.includes("charm"))
  ) {
    issues.add("superheroic-profile");
  }
  const templateAttributeIds = Object.keys(
    resolved.template.attributeScores,
  ).sort();
  const orderedActiveAttributeIds = currentSettingActiveAttributes().map(
    ({ id }) => id,
  );
  const activeAttributeIds = [...orderedActiveAttributeIds].sort();
  const recognizedAttributeIds = new Set(
    currentSettingProfile().attributes.map(({ id }) => id),
  );
  if (templateAttributeIds.some((id) => !recognizedAttributeIds.has(id))) {
    issues.add("attribute-ids");
  }
  const activeAttributeIdSet = new Set(activeAttributeIds);
  const attributeScoreEntries = Object.entries(
    resolved.template.attributeScores,
  ).filter(([attributeId]) => activeAttributeIdSet.has(attributeId));
  const attributeScores = orderedActiveAttributeIds.map(
    (attributeId) =>
      resolved.template.attributeScores[attributeId] ??
      integer(record(attributes[attributeId]).score),
  );
  if (
    attributeScoreEntries.some(
      ([attributeId, score]) =>
        score > 15 ||
        score < (firstEdition && attributeId === "extranormal" ? 0 : 3),
    )
  ) {
    issues.add("attribute-score");
  }
  if (
    attributeScores.reduce((total, score) => total + score, 0) +
      (resolved.template.unassignedAttributeScore ?? 0) !==
    attributeRuntime.attributeBudgetScore
  ) {
    issues.add("attribute-budget");
  }

  const skills = new Map(
    (actor?.items.contents ?? [])
      .filter(
        (item) => item.type === "skill" && item.system.training !== "advanced",
      )
      .map((item) => [stringValue(item.system.key), item.name] as const)
      .filter(([key]) => key.length > 0),
  );
  const suggestedSkills = resolved.template.suggestedSkillKeys.flatMap(
    (key) => {
      const name =
        skills.get(key) ??
        stringValue(
          suggestedSkillSource(resolved.template.rulesFamily, key)?.name,
        );
      if (!name) {
        issues.add("suggested-skill-missing");
        return [];
      }
      return [{ key, name }];
    },
  );
  const selectedDefinitionIds = new Set(
    superheroic?.superpowers.map(({ definitionId }) => definitionId) ?? [],
  );
  const ownedDefinitionIds = new Set(
    (actor?.items.contents ?? [])
      .map(storedFeatureDefinitionId)
      .filter((id) => id.length > 0),
  );
  if (
    superheroic &&
    actor?.items.contents.some(
      (item) => item.type === "talent" && item.system.superpower === true,
    )
  ) {
    issues.add("superpower-budget");
  }
  const superpowerAdditions = (superheroic?.superpowers ?? []).flatMap(
    (selection) => {
      const definition = resolvedFeatureDefinition(selection.definitionId);
      if (!definition) {
        issues.add("superpower-missing");
        return [];
      }
      const featurePreview = previewFeatureDefinition(
        actor,
        selection.definitionId,
        {
          ...(selection.focus ? { focus: selection.focus } : {}),
          rank: selection.rank,
        },
      );
      const prerequisitesSatisfied =
        definition.definition.prerequisites?.every(
          (id) => ownedDefinitionIds.has(id) || selectedDefinitionIds.has(id),
        ) ?? true;
      const conflictsAbsent =
        definition.definition.conflicts?.every(
          (id) => !ownedDefinitionIds.has(id) && !selectedDefinitionIds.has(id),
        ) ?? true;
      const blockingIssues = featurePreview.issues.filter(
        (issue) => issue !== "prerequisite" || !prerequisitesSatisfied,
      );
      if (
        definition.definition.kind !== "talent" ||
        !definition.definition.superpower ||
        !featurePreview.superpower ||
        blockingIssues.length > 0 ||
        !conflictsAbsent
      ) {
        issues.add("superpower-invalid");
        return [];
      }
      return [
        Object.freeze({
          definitionId: selection.definitionId,
          focus: selection.focus?.trim() ?? "",
          name: definition.definition.label,
          rank: selection.rank,
          totalCost: featurePreview.superpower.totalCost,
        }),
      ];
    },
  );
  if (
    superheroic &&
    superpowerAdditions.reduce(
      (total, addition) => total + addition.totalCost,
      0,
    ) !== superheroic.superpowerCreationDice
  ) {
    issues.add("superpower-budget");
  }

  return Object.freeze({
    attributeChanges: Object.freeze(
      orderedActiveAttributeIds.map((attributeId) =>
        Object.freeze({
          attributeId,
          currentScore: integer(record(attributes[attributeId]).score),
          nextScore:
            resolved.template.attributeScores[attributeId] ??
            integer(record(attributes[attributeId]).score),
        }),
      ),
    ),
    canApply: [...issues].every((issue) => ADVISORY_TEMPLATE_ISSUES.has(issue)),
    catalogId: resolved.catalog.id,
    catalogLabel: resolved.catalog.label,
    itemAdditions: Object.freeze(
      (resolved.template.items ?? []).map((item) =>
        Object.freeze({ name: item.name, type: item.type }),
      ),
    ),
    issues: Object.freeze([...issues]),
    ownerId: resolved.catalog.ownerId,
    source: resolved.template.source,
    suggestedSkills: Object.freeze(
      suggestedSkills.map((skill) => Object.freeze(skill)),
    ),
    rulesFamily: superheroic ? "superheroic" : resolved.template.rulesFamily,
    superpowerAdditions: Object.freeze(superpowerAdditions),
    superpowerCreationDice: superheroic?.superpowerCreationDice ?? 0,
    templateId: resolved.template.id,
    templateLabel: resolved.template.label,
    templateVersion: resolved.template.version,
    unassignedAttributeScore: resolved.template.unassignedAttributeScore ?? 0,
    version: D6_CHARACTER_TEMPLATE_CONTRACT_VERSION,
  });
}

export async function applyCharacterTemplate(
  actorValue: unknown,
  templateId: string,
): Promise<D6CharacterTemplateApplicationV1> {
  const actor = actorDocument(actorValue);
  if (!actor) throw new Error("D6E2.Template.ActorRequired");
  if (applyingActors.has(actor)) throw new Error("D6E2.Template.InProgress");
  applyingActors.add(actor);
  try {
    const preview = previewCharacterTemplate(actor, templateId);
    if (!preview.canApply) {
      throw new Error(
        `D6E2.Template.Issue.${preview.issues[0] ?? "template-missing"}`,
      );
    }
    const resolved = resolvedCharacterTemplate(templateId);
    if (!resolved) throw new Error("D6E2.Template.Issue.template-missing");
    const existingSkills = new Map(
      actor.items.contents
        .filter((item) => item.type === "skill")
        .map((item) => [stringValue(item.system.key), item] as const)
        .filter(([key]) => key.length > 0),
    );
    const itemSources: Record<string, unknown>[] = [];
    const skillUpdates: {
      readonly id: string;
      readonly previousScore: number;
      readonly score: number;
    }[] = [];
    for (const item of resolved.template.items ?? []) {
      const key = stringValue(item.system.key);
      const existing =
        item.type === "skill" ? existingSkills.get(key) : undefined;
      if (existing) {
        skillUpdates.push({
          id: existing.id,
          previousScore: integer(existing.system.score),
          score: integer(item.system.score),
        });
        continue;
      }
      itemSources.push({
        ...(item.img ? { img: item.img } : {}),
        flags: {
          [SYSTEM_ID]: {
            characterTemplate: {
              catalogId: resolved.catalog.id,
              templateId: resolved.template.id,
              version: D6_CHARACTER_TEMPLATE_CONTRACT_VERSION,
            },
          },
        },
        name: item.name,
        system: structuredClone(item.system),
        type: item.type,
      });
      if (item.type === "skill" && key)
        existingSkills.set(key, item as unknown as FoundryItemDocument);
    }
    for (const key of resolved.template.suggestedSkillKeys) {
      if (existingSkills.has(key)) continue;
      const source = suggestedSkillSource(resolved.template.rulesFamily, key);
      if (!source) continue;
      source.flags = {
        [SYSTEM_ID]: {
          characterTemplate: {
            catalogId: resolved.catalog.id,
            templateId: resolved.template.id,
            version: D6_CHARACTER_TEMPLATE_CONTRACT_VERSION,
          },
        },
      };
      itemSources.push(source);
      existingSkills.set(key, source as unknown as FoundryItemDocument);
    }
    const superpowerSources = (resolved.template.superheroic?.superpowers ?? [])
      .map((selection) => {
        const definition = resolvedFeatureDefinition(selection.definitionId);
        if (!definition) return null;
        const featurePreview = previewFeatureDefinition(
          actor,
          selection.definitionId,
          {
            ...(selection.focus ? { focus: selection.focus } : {}),
            rank: selection.rank,
          },
        );
        if (!featurePreview.superpower) return null;
        const source = featureDefinitionItemSource(definition, featurePreview);
        const flags = source.flags as Record<string, Record<string, unknown>>;
        flags[SYSTEM_ID] = {
          ...flags[SYSTEM_ID],
          characterTemplate: {
            catalogId: resolved.catalog.id,
            templateId: resolved.template.id,
            version: D6_CHARACTER_TEMPLATE_CONTRACT_VERSION,
          },
        };
        return source;
      })
      .filter((source): source is Record<string, unknown> => source !== null);
    itemSources.push(...superpowerSources);
    const specializationSources = itemSources.filter(
      (source) => source.type === "specialization",
    );
    const primarySources = itemSources.filter(
      (source) => source.type !== "specialization",
    );
    const createdIds: string[] = [];
    try {
      const createdPrimary =
        primarySources.length > 0
          ? await withAuthorizedTemplateUpdate(actor, () =>
              actor.createEmbeddedDocuments("Item", primarySources),
            )
          : [];
      createdIds.push(...createdPrimary.map((item) => item.id));
      if (createdPrimary.length !== primarySources.length) {
        throw new Error("D6E2.Template.ItemCreationFailed");
      }
      const parentSkillIds = new Map(
        [...existingSkills.entries()].map(([key, item]) => [key, item.id]),
      );
      for (const [index, source] of primarySources.entries()) {
        if (source.type !== "skill") continue;
        const key = stringValue(record(source.system).key);
        const id = createdPrimary[index]?.id;
        if (key && id) parentSkillIds.set(key, id);
      }
      const linkedSpecializations = specializationSources.map((source) => {
        const system = structuredClone(record(source.system));
        const parentSkillKey = stringValue(system.parentSkillKey);
        const parentSkillId = parentSkillIds.get(parentSkillKey);
        if (!parentSkillId) {
          throw new Error("D6E2.Template.ItemCreationFailed");
        }
        system.parentSkillId = parentSkillId;
        return { ...source, system };
      });
      const createdSpecializations =
        linkedSpecializations.length > 0
          ? await withAuthorizedTemplateUpdate(actor, () =>
              actor.createEmbeddedDocuments("Item", linkedSpecializations),
            )
          : [];
      createdIds.push(...createdSpecializations.map((item) => item.id));
      if (createdSpecializations.length !== linkedSpecializations.length) {
        throw new Error("D6E2.Template.ItemCreationFailed");
      }
    } catch (error) {
      if (createdIds.length > 0) {
        await withAuthorizedTemplateUpdate(actor, () =>
          (
            actor as FoundryActorDocument & {
              deleteEmbeddedDocuments(
                name: "Item",
                ids: readonly string[],
              ): Promise<unknown>;
            }
          ).deleteEmbeddedDocuments("Item", createdIds),
        );
      }
      throw error;
    }
    const changes: Record<string, unknown> = {};
    const projectedAttributeIds = new Set(
      currentSettingActiveAttributes().map(({ id }) => id),
    );
    for (const [attributeId, score] of Object.entries(
      resolved.template.attributeScores,
    ).filter(([attributeId]) => projectedAttributeIds.has(attributeId))) {
      changes[`system.attributes.${attributeId}.score`] = score;
    }
    if (resolved.template.rulesFamily === "open-d6-first-edition") {
      const firstEdition = resolved.template.firstEdition;
      if (firstEdition?.biography !== undefined) {
        changes["system.biography"] = firstEdition.biography;
      }
      if (firstEdition?.characterPoints !== undefined) {
        changes["system.resources.characterPoints.value"] =
          firstEdition.characterPoints;
      }
      if (firstEdition?.fatePoints !== undefined) {
        changes["system.resources.fatePoints.value"] = firstEdition.fatePoints;
      }
      if (firstEdition?.move !== undefined) {
        changes["system.movement.base"] = firstEdition.move;
      }
    }
    Object.assign(changes, {
      "system.creation.template.applied": true,
      "system.creation.template.catalogId": resolved.catalog.id,
      "system.creation.template.label": resolved.template.label,
      "system.creation.template.ownerId": resolved.catalog.ownerId,
      "system.creation.template.sourceBook": resolved.template.source.book,
      "system.creation.template.sourcePage": resolved.template.source.page,
      "system.creation.template.suggestedSkillKeys": [
        ...resolved.template.suggestedSkillKeys,
      ],
      "system.creation.template.rulesFamily": resolved.template.superheroic
        ? "superheroic"
        : resolved.template.rulesFamily,
      "system.creation.template.superpowerCreationDice":
        resolved.template.superheroic?.superpowerCreationDice ?? 0,
      "system.creation.template.superpowerDefinitionIds": [
        ...(resolved.template.superheroic?.superpowers.map(
          ({ definitionId }) => definitionId,
        ) ?? []),
      ],
      "system.creation.template.templateId": resolved.template.id,
      "system.creation.template.version": resolved.template.version,
    });
    let updatedSkills = false;
    try {
      if (skillUpdates.length > 0) {
        await withAuthorizedTemplateUpdate(actor, () =>
          actor.updateEmbeddedDocuments(
            "Item",
            skillUpdates.map(({ id, score }) => ({
              _id: id,
              "system.score": score,
            })),
          ),
        );
        updatedSkills = true;
      }
      await withAuthorizedTemplateUpdate(actor, () => actor.update(changes));
    } catch (error) {
      if (updatedSkills) {
        await withAuthorizedTemplateUpdate(actor, () =>
          actor.updateEmbeddedDocuments(
            "Item",
            skillUpdates.map(({ id, previousScore }) => ({
              _id: id,
              "system.score": previousScore,
            })),
          ),
        );
      }
      if (createdIds.length > 0) {
        try {
          await withAuthorizedTemplateUpdate(actor, () =>
            (
              actor as FoundryActorDocument & {
                deleteEmbeddedDocuments(
                  name: "Item",
                  ids: readonly string[],
                ): Promise<unknown>;
              }
            ).deleteEmbeddedDocuments("Item", createdIds),
          );
        } catch (rollbackError) {
          throw new Error("D6E2.Template.RollbackFailed", {
            cause: rollbackError,
          });
        }
      }
      throw error;
    }
    return Object.freeze({
      actorId: actor.id,
      createdItemIds: Object.freeze([...createdIds]),
      preview,
      version: D6_CHARACTER_TEMPLATE_CONTRACT_VERSION,
    });
  } finally {
    applyingActors.delete(actor);
  }
}
