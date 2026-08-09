import {
  D6_SETTING_PROFILE_CONTRACT_VERSION,
  SECOND_EDITION_CORE_ATTRIBUTE_IDS,
  SECOND_EDITION_OPTIONAL_ATTRIBUTE_IDS,
  type D6SettingAttributeV2,
  type D6SettingProfileV3,
  type D6ResolvedSettingProfileV3,
  type D6SettingProfileSelectionV3,
  type D6SettingRulesFamily,
  type D6SettingSkillV1,
  type D6System2eSettingProfileRegistry,
  type D6WorldSettingProfilesV3,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { DEFAULT_SKILL_IMAGE } from "../document-default-images";
import { allSkillCatalogEntries } from "../content/skill-catalog";
import { currentFirstEditionGenreProfile } from "./first-edition-genre-profile";
import { firstEditionGenreProfileRegistry } from "../registries/first-edition-genre-profiles";
import {
  currentConfiguredRulesProfile,
  strategyUsesOpenD6,
} from "./rules-profile-library";
import { currentSecondEditionCampaignProfile } from "./campaign-profile";
import {
  normalizeStoredTerminologyOverrides,
  TERMINOLOGY_OVERRIDE_FIELDS,
  terminologyOverridesFromEntries,
  terminologyOverrideValue,
  WORLD_TERMINOLOGY_SETTING,
} from "./terminology-overrides";

export const WORLD_SETTING_PROFILES_SETTING = "worldSettingProfiles";
export const SETTING_PROFILE_EXPORT_KIND =
  "d6-system-2e.setting-profile" as const;
export interface SettingProfileExportV2 {
  readonly kind: typeof SETTING_PROFILE_EXPORT_KIND;
  readonly profile: D6SettingProfileV3;
  readonly version: typeof D6_SETTING_PROFILE_CONTRACT_VERSION;
}
export const DEFAULT_WILD_ONE_SOUND =
  "systems/d6-system-2e/assets/audio/wild-one.mp3";
export const DEFAULT_WILD_SIX_SOUND =
  "systems/d6-system-2e/assets/audio/wild-six.mp3";

const ID_PATTERN = /^[a-z][a-z0-9-]*$/u;
const moduleProfiles = new Map<
  string,
  ReadonlyMap<string, D6SettingProfileV3>
>();
const ALL_ATTRIBUTE_IDS = Object.freeze([
  ...SECOND_EDITION_CORE_ATTRIBUTE_IDS,
  ...SECOND_EDITION_OPTIONAL_ATTRIBUTE_IDS,
  "acumen",
  "charisma",
  "coordination",
  "extranormal",
  "intellect",
  "physique",
  "presence",
  "reflexes",
]);

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function storedProfilesValue(): unknown {
  try {
    return game.settings.get(SYSTEM_ID, WORLD_SETTING_PROFILES_SETTING);
  } catch {
    return undefined;
  }
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function safeId(value: unknown, fallback: string): string {
  const candidate = text(value).toLocaleLowerCase();
  return ID_PATTERN.test(candidate) ? candidate : fallback;
}

export function validSettingProfileAssetPath(
  value: unknown,
  kind: "audio" | "image",
): value is string {
  if (typeof value !== "string") return false;
  const candidate = value.trim();
  if (!candidate) return true;
  if (
    candidate.startsWith("/") ||
    candidate.includes("\\") ||
    candidate.includes("?") ||
    candidate.includes("#") ||
    candidate.includes(":") ||
    candidate.split("/").includes("..")
  ) {
    return false;
  }
  const extension = candidate.split(".").at(-1)?.toLocaleLowerCase() ?? "";
  return kind === "audio"
    ? ["flac", "m4a", "mp3", "ogg", "wav", "webm"].includes(extension)
    : ["avif", "gif", "jpeg", "jpg", "png", "svg", "webp"].includes(extension);
}

function safeAsset(
  value: unknown,
  fallback = "",
  kind: "audio" | "image" = "image",
): string {
  const candidate = text(value);
  return validSettingProfileAssetPath(candidate, kind) ? candidate : fallback;
}

function localized(key: string): string {
  try {
    return game.i18n.localize(key);
  } catch {
    return key;
  }
}

function localizedAttributeLabel(id: string): string {
  const key = `D6E2.Attribute.${id[0]?.toUpperCase() ?? ""}${id.slice(1)}`;
  return localized(key);
}

function defaultAttributes(
  family: D6SettingRulesFamily,
): readonly D6SettingAttributeV2[] {
  const firstEditionLabels = new Map(
    family === "open-d6-first-edition"
      ? currentFirstEditionGenreProfile().attributes.map(({ id, label }) => [
          id,
          localized(label),
        ])
      : [],
  );
  return Object.freeze(
    ALL_ATTRIBUTE_IDS.map((id) =>
      Object.freeze({
        id,
        label: firstEditionLabels.get(id) ?? localizedAttributeLabel(id),
      }),
    ),
  );
}

function defaultSkills(
  family: D6SettingRulesFamily,
): readonly D6SettingSkillV1[] {
  const firstEdition = family === "open-d6-first-edition";
  const genreSkills = firstEdition
    ? ((
        currentFirstEditionGenreProfile() as Partial<
          ReturnType<typeof currentFirstEditionGenreProfile>
        >
      ).skills ?? [])
    : [];
  const entries = genreSkills.length
    ? genreSkills.map((skill) => ({
        attributeId: skill.attributeId,
        description: "",
        img: DEFAULT_SKILL_IMAGE,
        key: skill.key,
        name: skill.name,
        training: "standard" as const,
      }))
    : allSkillCatalogEntries()
        .filter((skill) =>
          skill.profiles.includes(firstEdition ? "open-d6" : "second-edition"),
        )
        .map((skill) => ({
          attributeId: skill.attributeId,
          description: "",
          img: DEFAULT_SKILL_IMAGE,
          key: skill.key,
          name: skill.name,
          training: skill.training ?? ("standard" as const),
        }));
  const unique = new Map<string, D6SettingSkillV1>();
  for (const entry of entries)
    if (!unique.has(entry.key)) unique.set(entry.key, entry);
  return Object.freeze(
    [...unique.values()].map((skill) => Object.freeze(skill)),
  );
}

export function currentSettingRulesFamily(): D6SettingRulesFamily {
  try {
    return strategyUsesOpenD6(currentConfiguredRulesProfile(), "attributes")
      ? "open-d6-first-edition"
      : "d6-system-second-edition";
  } catch {
    return "d6-system-second-edition";
  }
}

export function defaultSettingProfile(
  family: D6SettingRulesFamily,
): D6SettingProfileV3 {
  const firstEdition = family === "open-d6-first-edition";
  return Object.freeze({
    attributes: defaultAttributes(family),
    description: "",
    id: firstEdition ? "open-d6-first-edition" : "d6-system-second-edition",
    label: firstEdition
      ? localized("D6E2.OpenD6Compatible")
      : localized("D6E2.SecondEdition"),
    logo: "systems/d6-system-2e/assets/ui/d6-pause-cube.png",
    logoAsWatermark: true,
    originRulesFamily: family,
    skills: defaultSkills(family),
    terminology: Object.freeze({}),
    version: D6_SETTING_PROFILE_CONTRACT_VERSION,
    wildDie: Object.freeze({
      one: Object.freeze({ kind: "text" as const, value: "1" }),
      oneSound: DEFAULT_WILD_ONE_SOUND,
      six: Object.freeze({
        kind: "image" as const,
        value: "systems/d6-system-2e/assets/dice/wild-six.png",
      }),
      sixSound: DEFAULT_WILD_SIX_SOUND,
    }),
  });
}

export function bundledSettingProfiles(): readonly D6ResolvedSettingProfileV3[] {
  return Object.freeze(
    (["d6-system-second-edition", "open-d6-first-edition"] as const).map(
      (family) =>
        Object.freeze({
          ownerId: SYSTEM_ID,
          profile: defaultSettingProfile(family),
          source: "bundled" as const,
        }),
    ),
  );
}

export function normalizeSettingProfile(
  value: unknown,
  seedFamily: D6SettingRulesFamily = currentSettingRulesFamily(),
): D6SettingProfileV3 {
  const source = record(value);
  const storedFamily = text(source.originRulesFamily ?? source.rulesFamily);
  const originRulesFamily: D6SettingRulesFamily =
    storedFamily === "open-d6-first-edition"
      ? "open-d6-first-edition"
      : storedFamily === "d6-system-second-edition"
        ? "d6-system-second-edition"
        : seedFamily;
  const fallback = defaultSettingProfile(originRulesFamily);
  const allowedAttributeIds = new Set(ALL_ATTRIBUTE_IDS);
  const storedAttributes = Array.isArray(source.attributes)
    ? source.attributes
    : [];
  const attributes = storedAttributes.flatMap((raw) => {
    const attribute = record(raw);
    const id = safeId(attribute.id, "");
    if (!id || !allowedAttributeIds.has(id)) return [];
    return [
      Object.freeze({
        id,
        label: text(attribute.label, localizedAttributeLabel(id)),
      }),
    ];
  });
  for (const attribute of fallback.attributes) {
    if (!attributes.some(({ id }) => id === attribute.id))
      attributes.push(attribute);
  }
  const storedSkills = Array.isArray(source.skills) ? source.skills : [];
  const skills: D6SettingSkillV1[] = [];
  for (const raw of storedSkills) {
    const skill = record(raw);
    const key = safeId(skill.key, "");
    const attributeId = safeId(skill.attributeId, "");
    if (
      !key ||
      !allowedAttributeIds.has(attributeId) ||
      skills.some((entry) => entry.key === key)
    )
      continue;
    const training = ["advanced", "psionic", "standard"].includes(
      text(skill.training),
    )
      ? (text(skill.training) as D6SettingSkillV1["training"])
      : "standard";
    skills.push(
      Object.freeze({
        attributeId,
        description: text(skill.description),
        img: safeAsset(skill.img, DEFAULT_SKILL_IMAGE, "image"),
        key,
        name: text(skill.name, key),
        training,
      }),
    );
  }
  const wildDie = record(source.wildDie);
  const asset = (
    raw: unknown,
    fallbackAsset: D6SettingProfileV3["wildDie"]["one"],
  ) => {
    const value = record(raw);
    const kind = value.kind === "image" ? "image" : "text";
    return Object.freeze({
      kind,
      value:
        kind === "image"
          ? safeAsset(value.value, fallbackAsset.value, "image")
          : text(value.value, fallbackAsset.value),
    });
  };
  return Object.freeze({
    attributes: Object.freeze(attributes),
    description: text(source.description),
    id: safeId(source.id, "world-setting"),
    label: text(source.label, fallback.label),
    logo: safeAsset(source.logo, fallback.logo, "image"),
    logoAsWatermark: source.logoAsWatermark !== false,
    originRulesFamily,
    skills: Object.freeze(
      Array.isArray(source.skills) ? skills : fallback.skills,
    ),
    terminology: Object.freeze(
      normalizeStoredTerminologyOverrides(source.terminology),
    ),
    version: D6_SETTING_PROFILE_CONTRACT_VERSION,
    wildDie: Object.freeze({
      one: asset(wildDie.one, fallback.wildDie.one),
      oneSound: safeAsset(wildDie.oneSound, fallback.wildDie.oneSound, "audio"),
      six: asset(wildDie.six, fallback.wildDie.six),
      sixSound: safeAsset(wildDie.sixSound, fallback.wildDie.sixSound, "audio"),
    }),
  });
}

function uniqueProfileId(
  requested: string,
  profiles: Readonly<Record<string, D6SettingProfileV3>>,
): string {
  if (!profiles[requested]) return requested;
  let suffix = 2;
  while (profiles[`${requested}-${suffix}`]) suffix += 1;
  return `${requested}-${suffix}`;
}

function uniqueWorldSettingProfileId(base: string): string {
  return uniqueProfileId(
    base,
    Object.fromEntries(
      availableSettingProfiles().map(({ profile }) => [profile.id, profile]),
    ),
  );
}

export function normalizeWorldSettingProfiles(
  value: unknown,
  seedFamily: D6SettingRulesFamily = currentSettingRulesFamily(),
): D6WorldSettingProfilesV3 {
  const source = record(value);
  const profiles: Record<string, D6SettingProfileV3> = {};
  const storedProfiles = record(source.profiles);
  for (const raw of Object.values(storedProfiles)) {
    const profile = normalizeSettingProfile(raw, seedFamily);
    const id = uniqueProfileId(profile.id, profiles);
    profiles[id] =
      id === profile.id ? profile : normalizeSettingProfile({ ...profile, id });
  }
  if (Object.keys(profiles).length === 0) {
    const legacy = [
      [source.firstEdition, "open-d6-first-edition"],
      [source.secondEdition, "d6-system-second-edition"],
    ] as const;
    for (const [raw, family] of legacy) {
      if (!raw) continue;
      const profile = normalizeSettingProfile(raw, family);
      const id = uniqueProfileId(profile.id, profiles);
      profiles[id] =
        id === profile.id
          ? profile
          : normalizeSettingProfile({ ...profile, id }, family);
    }
  }
  const requestedActiveId = safeId(source.activeProfileId, "");
  const legacyPreferredId =
    seedFamily === "open-d6-first-edition"
      ? Object.values(profiles).find(
          ({ originRulesFamily }) =>
            originRulesFamily === "open-d6-first-edition",
        )?.id
      : Object.values(profiles).find(
          ({ originRulesFamily }) =>
            originRulesFamily === "d6-system-second-edition",
        )?.id;
  const fallbackId =
    seedFamily === "open-d6-first-edition"
      ? "open-d6-first-edition"
      : "d6-system-second-edition";
  const activeProfileId =
    requestedActiveId.length > 0
      ? requestedActiveId
      : (legacyPreferredId ?? fallbackId);
  return Object.freeze({
    activeProfileId,
    profiles: Object.freeze(profiles),
    version: D6_SETTING_PROFILE_CONTRACT_VERSION,
  });
}

export function storedWorldSettingProfiles(): D6WorldSettingProfilesV3 {
  return normalizeWorldSettingProfiles(storedProfilesValue());
}

function migrateBundledProfileCollisions(
  world: D6WorldSettingProfilesV3,
): D6WorldSettingProfilesV3 {
  const profiles = { ...world.profiles };
  let activeProfileId = world.activeProfileId;
  const reserved = new Set(
    bundledSettingProfiles().map(({ profile }) => profile.id),
  );
  for (const ownerProfiles of moduleProfiles.values()) {
    for (const id of ownerProfiles.keys()) reserved.add(id);
  }
  for (const { profile: bundled } of bundledSettingProfiles()) {
    const stored = profiles[bundled.id];
    if (!stored) continue;
    Reflect.deleteProperty(profiles, bundled.id);
    if (canonicalJson(stored) === canonicalJson(bundled)) continue;
    let id = `${stored.id}-world`;
    let suffix = 2;
    while (reserved.has(id) || profiles[id])
      id = `${stored.id}-world-${suffix++}`;
    profiles[id] = normalizeSettingProfile({ ...stored, id });
    reserved.add(id);
    if (activeProfileId === stored.id) activeProfileId = id;
  }
  return Object.freeze({
    activeProfileId,
    profiles: Object.freeze(profiles),
    version: D6_SETTING_PROFILE_CONTRACT_VERSION,
  });
}

export function availableSettingProfiles(): readonly D6ResolvedSettingProfileV3[] {
  const merged = new Map(
    bundledSettingProfiles().map((entry) => [entry.profile.id, entry]),
  );
  for (const genre of firstEditionGenreProfileRegistry.current()) {
    const labels = new Map(
      genre.attributes.map(({ id, label }) => [id, localized(label)]),
    );
    const genreSkills = genre.skills.length
      ? genre.skills.map((skill) => ({
          attributeId: skill.attributeId,
          description: "",
          img: DEFAULT_SKILL_IMAGE,
          key: skill.key,
          name: skill.name,
          training: "standard" as const,
        }))
      : allSkillCatalogEntries()
          .filter(
            (skill) =>
              skill.profiles.includes("open-d6") &&
              genre.attributes.some(({ id }) => id === skill.attributeId),
          )
          .map((skill) => ({
            attributeId: skill.attributeId,
            description: "",
            img: DEFAULT_SKILL_IMAGE,
            key: skill.key,
            name: skill.name,
            training: skill.training ?? ("standard" as const),
          }));
    const profile = normalizeSettingProfile(
      {
        attributes: ALL_ATTRIBUTE_IDS.map((id) => ({
          id,
          label: labels.get(id) ?? localizedAttributeLabel(id),
        })),
        description: `${genre.label} character vocabulary and skill library.`,
        id: genre.id,
        label: genre.label,
        logo: "systems/d6-system-2e/assets/ui/d6-pause-cube.png",
        logoAsWatermark: true,
        originRulesFamily: "open-d6-first-edition",
        skills: genreSkills,
        terminology: {},
        version: D6_SETTING_PROFILE_CONTRACT_VERSION,
        wildDie: {
          one: { kind: "text", value: "1" },
          oneSound: DEFAULT_WILD_ONE_SOUND,
          six: {
            kind: "image",
            value: "systems/d6-system-2e/assets/dice/wild-six.png",
          },
          sixSound: DEFAULT_WILD_SIX_SOUND,
        },
      },
      "open-d6-first-edition",
    );
    if (!merged.has(profile.id)) {
      merged.set(
        profile.id,
        Object.freeze({
          ownerId: genre.ownerId,
          profile,
          source: "module" as const,
        }),
      );
    }
  }
  for (const [ownerId, profiles] of moduleProfiles) {
    for (const [id, profile] of profiles) {
      if (merged.has(id)) continue;
      merged.set(
        id,
        Object.freeze({ ownerId, profile, source: "module" as const }),
      );
    }
  }
  for (const [id, profile] of Object.entries(
    storedWorldSettingProfiles().profiles,
  )) {
    if (merged.has(id)) continue;
    merged.set(
      id,
      Object.freeze({ ownerId: "world", profile, source: "world" as const }),
    );
  }
  return Object.freeze([...merged.values()]);
}

export function currentSettingProfileSelection(): D6SettingProfileSelectionV3 {
  const requested = storedWorldSettingProfiles().activeProfileId;
  const selected = availableSettingProfiles().find(
    ({ profile }) => profile.id === requested,
  );
  const fallback =
    bundledSettingProfiles().find(
      ({ profile }) => profile.id === "d6-system-second-edition",
    ) ?? bundledSettingProfiles()[0];
  if (!fallback) throw new Error("Missing bundled Setting Profile fallback.");
  return Object.freeze({
    activeProfileId: requested,
    available: Boolean(selected),
    resolved: selected ?? fallback,
  });
}

export function currentResolvedSettingProfile(): D6ResolvedSettingProfileV3 {
  return currentSettingProfileSelection().resolved;
}

export function currentSettingProfile(): D6SettingProfileV3 {
  return currentResolvedSettingProfile().profile;
}

export function hasCustomSettingProfile(): boolean {
  const source = record(storedProfilesValue());
  return (
    Object.keys(record(source.profiles)).length > 0 ||
    Boolean(source.firstEdition ?? source.secondEdition)
  );
}

export function editableCurrentSettingProfile(): D6SettingProfileV3 {
  const current = currentResolvedSettingProfile();
  if (current.source === "world") return current.profile;
  return normalizeSettingProfile({
    ...current.profile,
    id: uniqueWorldSettingProfileId(`${current.profile.id}-customized`),
    label: `${current.profile.label} · ${localized(
      "D6E2.Settings.SettingProfile.Customized",
    )}`,
  });
}

export async function ensureWorldSettingProfilesStored(): Promise<D6WorldSettingProfilesV3> {
  const raw = record(
    game.settings.get(SYSTEM_ID, WORLD_SETTING_PROFILES_SETTING),
  );
  const world = migrateBundledProfileCollisions(
    normalizeWorldSettingProfiles(raw),
  );
  if (
    raw.version !== D6_SETTING_PROFILE_CONTRACT_VERSION ||
    !raw.profiles ||
    canonicalJson(raw) !== canonicalJson(world)
  ) {
    await game.settings.set(SYSTEM_ID, WORLD_SETTING_PROFILES_SETTING, world);
  }
  return world;
}

export async function migrateLegacyWorldTerminologyOverrides(): Promise<boolean> {
  const legacy = normalizeStoredTerminologyOverrides(
    game.settings.get(SYSTEM_ID, WORLD_TERMINOLOGY_SETTING),
  );
  const hasLegacy = TERMINOLOGY_OVERRIDE_FIELDS.some(
    ({ path }) => terminologyOverrideValue(legacy, path).length > 0,
  );
  if (!hasLegacy) return false;
  const profile = currentSettingProfile();
  const terminology = terminologyOverridesFromEntries(
    TERMINOLOGY_OVERRIDE_FIELDS.map(({ path }) => [
      path,
      terminologyOverrideValue(profile.terminology, path) ||
        terminologyOverrideValue(legacy, path),
    ]),
  );
  await saveCurrentSettingProfile({ ...profile, terminology });
  await game.settings.set(SYSTEM_ID, WORLD_TERMINOLOGY_SETTING, {});
  return true;
}

export async function selectSettingProfile(
  id: string,
): Promise<D6SettingProfileV3> {
  const world = storedWorldSettingProfiles();
  const profile = availableSettingProfiles().find(
    ({ profile: candidate }) => candidate.id === id,
  )?.profile;
  if (!profile) throw new RangeError(`Unknown Setting Profile: ${id}`);
  await game.settings.set(SYSTEM_ID, WORLD_SETTING_PROFILES_SETTING, {
    ...world,
    activeProfileId: id,
  });
  Hooks.callAll?.("d6e2SettingProfileChanged", id);
  return profile;
}

export async function saveWorldSettingProfile(
  value: unknown,
): Promise<D6SettingProfileV3> {
  const world = storedWorldSettingProfiles();
  const profile = normalizeSettingProfile(value);
  const immutable = availableSettingProfiles().find(
    ({ profile: candidate, source }) =>
      candidate.id === profile.id && source !== "world",
  );
  if (immutable) {
    throw new RangeError(`Setting Profile ID is immutable: ${profile.id}`);
  }
  await game.settings.set(SYSTEM_ID, WORLD_SETTING_PROFILES_SETTING, {
    ...world,
    profiles: { ...world.profiles, [profile.id]: profile },
  });
  Hooks.callAll?.("d6e2SettingProfilesChanged");
  return profile;
}

export function duplicateSettingProfile(
  source: D6SettingProfileV3 = currentSettingProfile(),
): D6SettingProfileV3 {
  const base = `${source.id}-copy`;
  return normalizeSettingProfile({
    ...source,
    id: uniqueWorldSettingProfileId(base),
    label: `${source.label} · ${localized("D6E2.Settings.SettingProfile.Copy")}`,
  });
}

export function exportSettingProfile(
  profile: D6SettingProfileV3 = currentSettingProfile(),
): SettingProfileExportV2 {
  return Object.freeze({
    kind: SETTING_PROFILE_EXPORT_KIND,
    profile,
    version: D6_SETTING_PROFILE_CONTRACT_VERSION,
  });
}

export function importSettingProfile(value: unknown): D6SettingProfileV3 {
  const envelope = record(value);
  if (
    envelope.kind !== SETTING_PROFILE_EXPORT_KIND ||
    envelope.version !== D6_SETTING_PROFILE_CONTRACT_VERSION
  ) {
    throw new TypeError("Unsupported Setting Profile export.");
  }
  const raw = record(envelope.profile);
  const family = raw.originRulesFamily;
  if (
    raw.version !== D6_SETTING_PROFILE_CONTRACT_VERSION ||
    !ID_PATTERN.test(text(raw.id)) ||
    !text(raw.label) ||
    typeof raw.description !== "string" ||
    typeof raw.logo !== "string" ||
    typeof raw.logoAsWatermark !== "boolean" ||
    (family !== "d6-system-second-edition" &&
      family !== "open-d6-first-edition") ||
    !Array.isArray(raw.attributes) ||
    !Array.isArray(raw.skills) ||
    typeof raw.terminology !== "object" ||
    raw.terminology === null ||
    typeof raw.wildDie !== "object" ||
    raw.wildDie === null
  ) {
    throw new TypeError("Invalid Setting Profile contract.");
  }
  const profile = normalizeSettingProfile(raw, family);
  if (canonicalJson(raw) !== canonicalJson(profile)) {
    throw new TypeError("Setting Profile import would be lossy.");
  }
  return normalizeSettingProfile({
    ...profile,
    id: uniqueWorldSettingProfileId(profile.id),
  });
}

export async function deleteWorldSettingProfile(id: string): Promise<void> {
  const world = storedWorldSettingProfiles();
  if (!world.profiles[id]) {
    throw new RangeError(`Unknown world Setting Profile: ${id}`);
  }
  if (world.activeProfileId === id) {
    throw new RangeError(`Active Setting Profile cannot be deleted: ${id}`);
  }
  const profiles = { ...world.profiles };
  Reflect.deleteProperty(profiles, id);
  await game.settings.set(SYSTEM_ID, WORLD_SETTING_PROFILES_SETTING, {
    ...world,
    profiles,
  });
  Hooks.callAll?.("d6e2SettingProfilesChanged");
}

export async function saveCurrentSettingProfile(
  value: unknown,
): Promise<D6SettingProfileV3> {
  const world = storedWorldSettingProfiles();
  const current = currentResolvedSettingProfile();
  let profile = normalizeSettingProfile(
    value,
    current.profile.originRulesFamily ?? currentSettingRulesFamily(),
  );
  if (current.source !== "world") {
    const requestedId =
      profile.id === current.profile.id
        ? `${profile.id}-customized`
        : profile.id;
    profile = normalizeSettingProfile({
      ...profile,
      id: uniqueWorldSettingProfileId(requestedId),
      label:
        profile.label === current.profile.label
          ? `${profile.label} · ${localized("D6E2.Settings.SettingProfile.Customized")}`
          : profile.label,
    });
  }
  const immutableCollision = availableSettingProfiles().find(
    ({ profile: candidate, source }) =>
      candidate.id === profile.id && source !== "world",
  );
  if (immutableCollision) {
    throw new RangeError(`Setting Profile ID is immutable: ${profile.id}`);
  }
  if (
    profile.id !== world.activeProfileId &&
    world.profiles[profile.id] !== undefined
  ) {
    throw new RangeError(`Setting Profile ID already exists: ${profile.id}`);
  }
  const profiles = { ...world.profiles };
  if (world.activeProfileId !== profile.id)
    Reflect.deleteProperty(profiles, world.activeProfileId);
  profiles[profile.id] = profile;
  await game.settings.set(SYSTEM_ID, WORLD_SETTING_PROFILES_SETTING, {
    activeProfileId: profile.id,
    profiles,
    version: D6_SETTING_PROFILE_CONTRACT_VERSION,
  });
  Hooks.callAll?.("d6e2SettingProfileChanged", profile.id);
  return profile;
}

export async function createSettingProfile(): Promise<D6SettingProfileV3> {
  const world = storedWorldSettingProfiles();
  const id = uniqueWorldSettingProfileId("new-setting");
  const profile = normalizeSettingProfile({
    ...currentSettingProfile(),
    description: "",
    id,
    label: game.i18n.localize("D6E2.Settings.SettingProfile.NewProfile"),
  });
  await game.settings.set(SYSTEM_ID, WORLD_SETTING_PROFILES_SETTING, {
    activeProfileId: id,
    profiles: { ...world.profiles, [id]: profile },
    version: D6_SETTING_PROFILE_CONTRACT_VERSION,
  });
  Hooks.callAll?.("d6e2SettingProfileChanged", id);
  return profile;
}

export async function resetCurrentSettingProfile(): Promise<void> {
  const world = storedWorldSettingProfiles();
  const current = currentResolvedSettingProfile();
  const replacement = defaultSettingProfile(
    current.profile.originRulesFamily ?? currentSettingRulesFamily(),
  );
  const profiles = { ...world.profiles };
  if (current.source === "world")
    Reflect.deleteProperty(profiles, world.activeProfileId);
  await game.settings.set(SYSTEM_ID, WORLD_SETTING_PROFILES_SETTING, {
    activeProfileId: replacement.id,
    profiles,
    version: D6_SETTING_PROFILE_CONTRACT_VERSION,
  });
  Hooks.callAll?.("d6e2SettingProfileChanged", replacement.id);
}

function moduleAssetOwnedBy(ownerId: string, path: string): boolean {
  if (!path) return true;
  return (
    path.startsWith("systems/d6-system-2e/") ||
    path.startsWith("icons/") ||
    path.startsWith(`modules/${ownerId}/`)
  );
}

export function registerSettingProfileContribution(
  ownerId: string,
  value: D6SettingProfileV3,
): void {
  if (!ID_PATTERN.test(ownerId))
    throw new TypeError(`Invalid owner id: ${ownerId}`);
  if (
    (value as { version?: unknown }).version !==
    D6_SETTING_PROFILE_CONTRACT_VERSION
  ) {
    throw new TypeError("Unsupported Setting Profile contract version.");
  }
  const profile = normalizeSettingProfile(value);
  if (canonicalJson(value) !== canonicalJson(profile)) {
    throw new TypeError("Setting Profile contribution would be lossy.");
  }
  const assetPaths = [
    profile.logo,
    profile.wildDie.one.kind === "image" ? profile.wildDie.one.value : "",
    profile.wildDie.oneSound,
    profile.wildDie.six.kind === "image" ? profile.wildDie.six.value : "",
    profile.wildDie.sixSound,
    ...profile.skills.map(({ img }) => img),
  ];
  if (assetPaths.some((path) => !moduleAssetOwnedBy(ownerId, path))) {
    throw new TypeError(
      "Setting Profile assets must belong to the registering owner or the base system.",
    );
  }
  if (
    bundledSettingProfiles().some(
      ({ profile: bundled }) => bundled.id === profile.id,
    )
  ) {
    throw new Error(`Setting Profile id is reserved: ${profile.id}`);
  }
  for (const [registeredOwner, profiles] of moduleProfiles) {
    if (registeredOwner !== ownerId && profiles.has(profile.id)) {
      throw new Error(
        `Setting Profile "${profile.id}" is already registered by "${registeredOwner}".`,
      );
    }
  }
  const ownerProfiles = new Map(moduleProfiles.get(ownerId) ?? []);
  ownerProfiles.set(profile.id, profile);
  moduleProfiles.set(ownerId, ownerProfiles);
  Hooks.callAll?.("d6e2SettingProfilesChanged");
}

export function unregisterSettingProfileOwner(ownerId: string): void {
  if (!moduleProfiles.delete(ownerId)) return;
  Hooks.callAll?.("d6e2SettingProfilesChanged");
}

export function resetSettingProfileRegistryForTests(): void {
  moduleProfiles.clear();
}

export const settingProfileRegistry: D6System2eSettingProfileRegistry =
  Object.freeze({
    current: availableSettingProfiles,
    register: registerSettingProfileContribution,
    unregisterOwner: unregisterSettingProfileOwner,
  });

export function currentSettingSkill(key: string): D6SettingSkillV1 | undefined {
  return currentSettingProfile().skills.find((skill) => skill.key === key);
}

export function currentSettingActiveAttributes(): readonly D6SettingAttributeV2[] {
  const activeIds = new Set(
    currentSettingRulesFamily() === "open-d6-first-edition"
      ? currentFirstEditionGenreProfile().attributes.map(({ id }) => id)
      : currentSecondEditionCampaignProfile().activeAttributeIds,
  );
  return Object.freeze(
    currentSettingProfile().attributes.filter(({ id }) => activeIds.has(id)),
  );
}
