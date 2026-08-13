import {
  D6_BESTIARY_CONTRACT_VERSION,
  type D6BestiaryCreationV1,
  type D6BestiaryIssueCode,
  type D6BestiaryPreviewV1,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { missingSkillSources } from "../content/skill-catalog";
import { resolvedBestiaryEntry } from "../registries/bestiary";
import { contentPackageRegistry } from "../registries/content-packages";
import {
  campaignOptionalAttributeIds,
  currentSecondEditionCampaignProfile,
} from "../settings/campaign-profile";
import { currentActiveAttributeDefinitions } from "../settings/attributes";
import {
  availableRulesProfiles,
  currentConfiguredRulesProfile,
  rulesProfileDiagnostics,
  selectRulesProfile,
  strategyUsesOpenD6,
} from "../settings/rules-profile-library";
import {
  availableSettingProfiles,
  currentResolvedSettingProfile,
} from "../settings/setting-profile";
import { activateProfilePreset } from "./profile-preset-service";
import {
  bestiaryDocumentSource,
  resolvedWorldBestiaryEntry,
} from "./bestiary-document-repository";

const creatingEntries = new Set<string>();

function resolvedEntry(entryId: string) {
  return resolvedWorldBestiaryEntry(entryId) ?? resolvedBestiaryEntry(entryId);
}

type BestiaryRulesFamily = "d6-system-second-edition" | "open-d6-first-edition";

function profileMatchesRulesFamily(
  profile: ReturnType<typeof currentConfiguredRulesProfile>,
  family: BestiaryRulesFamily,
): boolean {
  const usesOpenD6Attributes = strategyUsesOpenD6(profile, "attributes");
  return family === "open-d6-first-edition"
    ? usesOpenD6Attributes
    : !usesOpenD6Attributes;
}

function rulesProfileCompatibility(
  ownerId: string,
  family: BestiaryRulesFamily,
): D6BestiaryPreviewV1["rulesProfile"] {
  const active = currentConfiguredRulesProfile();
  const compatibleProfiles = availableRulesProfiles().filter(
    (profile) =>
      profileMatchesRulesFamily(profile, family) &&
      rulesProfileDiagnostics(profile).length === 0,
  );
  const options = compatibleProfiles.map(({ id, label }) =>
    Object.freeze({ id, label }),
  );
  const preferredId = contentPackageRegistry
    .current()
    .find(
      (candidate) => candidate.ownerId === ownerId,
    )?.recommendedPrimaryProfile;
  const activeCompatible =
    profileMatchesRulesFamily(active, family) &&
    rulesProfileDiagnostics(active).length === 0;
  const suggested =
    (activeCompatible
      ? options.find(({ id }) => id === active.id)
      : undefined) ??
    options.find(({ id }) => id === preferredId) ??
    options.at(0);
  return Object.freeze({
    active: Object.freeze({ id: active.id, label: active.label }),
    compatible: activeCompatible,
    options: Object.freeze(options),
    ...(suggested ? { suggested } : {}),
  });
}

function settingProfileCompatibility(
  ownerId: string,
  attributeIds: readonly string[],
): D6BestiaryPreviewV1["settingProfile"] {
  const active = currentResolvedSettingProfile().profile;
  const supports = (profile: typeof active): boolean => {
    const vocabulary = new Set(profile.attributes.map(({ id }) => id));
    return attributeIds.every((id) => vocabulary.has(id));
  };
  const recommendedId = contentPackageRegistry
    .current()
    .find(
      (candidate) => candidate.ownerId === ownerId,
    )?.recommendedSettingProfile;
  const recommended = availableSettingProfiles().find(
    ({ profile }) => profile.id === recommendedId && supports(profile),
  )?.profile;
  const compatible = supports(active);
  const suggested = compatible ? active : recommended;
  return Object.freeze({
    active: Object.freeze({ id: active.id, label: active.label }),
    compatible,
    ...(suggested
      ? {
          suggested: Object.freeze({
            id: suggested.id,
            label: suggested.label,
          }),
        }
      : {}),
  });
}

function emptyPreview(entryId: string): D6BestiaryPreviewV1 {
  const active = currentConfiguredRulesProfile();
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
    rulesProfile: Object.freeze({
      active: Object.freeze({ id: active.id, label: active.label }),
      compatible: false,
      options: Object.freeze([]),
    }),
    settingProfile: Object.freeze({
      active: Object.freeze({ id: "", label: "" }),
      compatible: false,
    }),
    rulesFamily: "d6-system-second-edition",
    scale: 0,
    source: Object.freeze({ book: "", page: 0 }),
    version: D6_BESTIARY_CONTRACT_VERSION,
  });
}

export function previewBestiaryEntry(entryId: string): D6BestiaryPreviewV1 {
  const resolved = resolvedEntry(entryId);
  if (!resolved) return emptyPreview(entryId);
  const issues = new Set<D6BestiaryIssueCode>();
  if (game.user?.isGM !== true) issues.add("gm-required");
  const entryRulesFamily =
    resolved.entry.rulesFamily ?? "d6-system-second-edition";
  const rulesProfile = rulesProfileCompatibility(
    resolved.catalog.ownerId,
    entryRulesFamily,
  );
  const settingProfile = settingProfileCompatibility(
    resolved.catalog.ownerId,
    Object.keys(resolved.entry.attributeScores),
  );
  if (!rulesProfile.compatible) issues.add("rules-profile-incompatible");
  if (!settingProfile.compatible) issues.add("setting-profile-incompatible");
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
    rulesProfile,
    settingProfile,
    rulesFamily: entryRulesFamily,
    scale: resolved.entry.scale ?? 0,
    source: resolved.entry.source,
    version: D6_BESTIARY_CONTRACT_VERSION,
  });
}

export async function activateBestiaryProfiles(
  entryId: string,
  rulesProfileId: string,
  settingProfileId: string,
): Promise<D6BestiaryPreviewV1> {
  if (game.user?.isGM !== true)
    throw new Error("D6E2.Bestiary.Issue.gm-required");
  const preview = previewBestiaryEntry(entryId);
  if (
    !preview.rulesProfile.options.some(({ id }) => id === rulesProfileId) ||
    preview.settingProfile.suggested?.id !== settingProfileId
  ) {
    throw new Error("D6E2.Bestiary.ProfileUnavailable");
  }
  await activateProfilePreset({
    rulesProfileId,
    settingProfileId,
    version: 1,
  });
  return previewBestiaryEntry(entryId);
}

export async function activateBestiaryRulesProfile(
  entryId: string,
  profileId: string,
): Promise<D6BestiaryPreviewV1> {
  if (game.user?.isGM !== true)
    throw new Error("D6E2.Bestiary.Issue.gm-required");
  const preview = previewBestiaryEntry(entryId);
  if (!preview.rulesProfile.options.some(({ id }) => id === profileId)) {
    throw new Error("D6E2.Bestiary.ProfileUnavailable");
  }
  await selectRulesProfile(profileId);
  return previewBestiaryEntry(entryId);
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
    const resolved = resolvedEntry(entryId);
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
    const actorClass = Actor;
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
    const documentSource = bestiaryDocumentSource(entryId);
    const actorSource = documentSource
      ? (structuredClone(documentSource) as unknown as Record<string, unknown>)
      : {
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
        };
    delete actorSource._id;
    delete actorSource.folder;
    delete actorSource.ownership;
    delete actorSource._stats;
    const sourceSystem =
      typeof actorSource.system === "object" && actorSource.system !== null
        ? (actorSource.system as Record<string, unknown>)
        : {};
    actorSource.system = { ...sourceSystem, bestiary };
    const actor = await actorClass.create(actorSource);
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
