import {
  D6_SETTING_PROFILE_CONTRACT_VERSION,
  SECOND_EDITION_CORE_ATTRIBUTE_IDS,
  SECOND_EDITION_OPTIONAL_ATTRIBUTE_IDS,
  type D6SettingAttributeV2,
  type D6SettingProfileV5,
  type D6SettingProfilePaletteV1,
  type D6ResolvedSettingProfileV5,
  type D6SettingProfileSelectionV5,
  type D6SettingRulesFamily,
  type D6SettingSkillV1,
  type D6System2eSettingProfileRegistry,
  type D6WorldSettingProfilesV5,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { DEFAULT_SKILL_IMAGE } from "../document-default-images";
import { allSkillCatalogEntries } from "../content/skill-catalog";
import { currentFirstEditionGenreProfile } from "./first-edition-genre-profile";
import { firstEditionGenreProfileRegistry } from "../registries/first-edition-genre-profiles";
import { themeRegistry } from "../registries/themes";
import {
  currentConfiguredRulesProfile,
  strategyUsesOpenD6,
} from "./rules-profile-library";
import {
  D6_SYSTEM_2E_OPEN_D6_PROFILE_LOGO,
  resolveSettingProfilePalette,
} from "./presentation-theme";
import { currentSecondEditionCampaignProfile } from "./campaign-profile";
import {
  D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY,
  normalizedSettingProfileTypography,
  resolveSettingProfileTypography,
  validateSettingProfileTypography,
  settingProfileFontDependencies,
} from "./setting-profile-typography";
import {
  normalizeStoredTerminologyOverrides,
  TERMINOLOGY_OVERRIDE_FIELDS,
  terminologyOverridesFromEntries,
  terminologyOverrideValue,
  WORLD_TERMINOLOGY_SETTING,
} from "./terminology-overrides";
import {
  FREE_D6_ATTRIBUTE_IDS,
  FREE_D6_SETTING_SKILLS,
  profileUsesFreeD6AttributeVocabulary,
} from "./free-d6-profile";
import {
  D6MV_ATTRIBUTES,
  D6MV_SETTING_SKILLS,
  profileUsesD6MvRules,
} from "./d6mv-profile";

export const WORLD_SETTING_PROFILES_SETTING = "worldSettingProfiles";
export const SETTING_PROFILE_EXPORT_KIND =
  "d6-system-2e.setting-profile" as const;
export interface SettingProfileExportV2 {
  readonly fontDependencies?: ReturnType<typeof settingProfileFontDependencies>;
  readonly kind: typeof SETTING_PROFILE_EXPORT_KIND;
  readonly profile: D6SettingProfileV5;
  readonly version: typeof D6_SETTING_PROFILE_CONTRACT_VERSION;
}
export const DEFAULT_WILD_ONE_SOUND =
  "systems/d6-system-2e/assets/audio/wild-one.mp3";
export const DEFAULT_WILD_SIX_SOUND =
  "systems/d6-system-2e/assets/audio/wild-six.mp3";

const ID_PATTERN = /^[a-z][a-z0-9-]*$/u;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/iu;
export const D6_SYSTEM_2E_CLASSIC_SETTING_PALETTE = Object.freeze({
  accent: "#c89b45",
  accentBright: "#f0c96c",
  background: "#0a0d12",
  muted: "#9a968d",
  text: "#eeeae0",
}) satisfies D6SettingProfilePaletteV1;
/** The dominant cyan-blue sampled from the permitted OpenD6 source mark. */
export const D6_SYSTEM_2E_OPEN_D6_SETTING_PALETTE = Object.freeze({
  accent: "#00aeee",
  accentBright: "#6ddaff",
  background: "#07131b",
  muted: "#a7bcc6",
  text: "#edfaff",
}) satisfies D6SettingProfilePaletteV1;
const FIRST_PARTY_OPEN_D6_GENRE_PROFILE_IDS = new Set([
  "open-d6-adventure-d6-system-2e",
  "open-d6-fantasy-d6-system-2e",
  "open-d6-space-d6-system-2e",
]);
const moduleProfiles = new Map<
  string,
  ReadonlyMap<string, D6SettingProfileV5>
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
const ALLOWED_ATTRIBUTE_IDS = new Set<string>([
  ...ALL_ATTRIBUTE_IDS,
  ...FREE_D6_ATTRIBUTE_IDS,
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

function relativeLuminance(value: string): number {
  const channels = [
    value.slice(1, 3),
    value.slice(3, 5),
    value.slice(5, 7),
  ].map((channel) => {
    const normalized = Number.parseInt(channel, 16) / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return (
    0.2126 * (channels[0] ?? 0) +
    0.7152 * (channels[1] ?? 0) +
    0.0722 * (channels[2] ?? 0)
  );
}

export function settingProfileColorContrast(
  foreground: string,
  background: string,
): number {
  const left = relativeLuminance(foreground);
  const right = relativeLuminance(background);
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}

export type SettingProfilePaletteValidation = Readonly<{
  field?: keyof D6SettingProfilePaletteV1;
  ratio?: number;
  surface?: "background" | "panel" | "panelRaised";
  threshold?: number;
  valid: boolean;
  reason?: "contrast" | "hex";
}>;

export function synchronizedSettingProfileColor(
  source: "hex" | "picker",
  value: string,
): string | undefined {
  const candidate = value.trim().toLocaleLowerCase();
  return /^#[0-9a-f]{6}$/u.test(candidate) || source === "picker"
    ? candidate
    : undefined;
}

function mixWithWhite(value: string, whiteWeight: number): string {
  const channel = (offset: number): number =>
    Math.round(
      Number.parseInt(value.slice(offset, offset + 2), 16) * (1 - whiteWeight) +
        255 * whiteWeight,
    );
  return `#${[channel(1), channel(3), channel(5)]
    .map((entry) => entry.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function validateSettingProfilePalette(
  value: unknown,
): SettingProfilePaletteValidation {
  const source = record(value);
  for (const field of [
    "accent",
    "accentBright",
    "background",
    "muted",
    "text",
  ] as const) {
    if (
      typeof source[field] !== "string" ||
      !HEX_COLOR_PATTERN.test(source[field])
    ) {
      return Object.freeze({ field, reason: "hex", valid: false });
    }
  }
  const palette = source as unknown as D6SettingProfilePaletteV1;
  if (
    canonicalJson(palette) ===
    canonicalJson(D6_SYSTEM_2E_CLASSIC_SETTING_PALETTE)
  ) {
    // The established Classic muted token predates palette authoring and does
    // not clear the derived raised-panel threshold. Preserve that exact
    // first-party palette without weakening validation for authored colors.
    return Object.freeze({ valid: true });
  }
  const surfaces = [
    ["background", palette.background],
    ["panel", mixWithWhite(palette.background, 0.14)],
    ["panelRaised", mixWithWhite(palette.background, 0.22)],
  ] as const;
  for (const field of ["text", "muted"] as const) {
    const threshold = 4.5;
    for (const [surface, color] of surfaces) {
      const ratio = settingProfileColorContrast(palette[field], color);
      if (ratio < threshold) {
        return Object.freeze({
          field,
          ratio,
          surface,
          threshold,
          reason: "contrast",
          valid: false,
        });
      }
    }
  }
  for (const field of ["accent", "accentBright"] as const) {
    const threshold = 3;
    const ratio = settingProfileColorContrast(
      palette[field],
      palette.background,
    );
    if (ratio < threshold) {
      return Object.freeze({
        field,
        ratio,
        surface: "background",
        threshold,
        reason: "contrast",
        valid: false,
      });
    }
  }
  return Object.freeze({ valid: true });
}

function normalizedPalette(
  value: unknown,
): D6SettingProfilePaletteV1 | undefined {
  if (value === undefined) return undefined;
  const validation = validateSettingProfilePalette(value);
  if (!validation.valid) return undefined;
  const source = record(value);
  return Object.freeze({
    accent: String(source.accent).toLocaleLowerCase(),
    accentBright: String(source.accentBright).toLocaleLowerCase(),
    background: String(source.background).toLocaleLowerCase(),
    muted: String(source.muted).toLocaleLowerCase(),
    text: String(source.text).toLocaleLowerCase(),
  });
}

function assertValidExplicitPalette(value: unknown): void {
  const source = record(value);
  if (!("palette" in source) || source.palette === undefined) return;
  const validation = validateSettingProfilePalette(source.palette);
  if (!validation.valid) {
    throw new TypeError(
      `Setting Profile palette ${validation.field ?? "value"} is invalid (${validation.reason ?? "unknown"}).`,
    );
  }
}

function assertValidExplicitTypography(value: unknown): void {
  const source = record(value);
  if (!("typography" in source) || source.typography === undefined) return;
  const validation = validateSettingProfileTypography(source.typography);
  if (!validation.valid && validation.reason !== "unavailable") {
    throw new TypeError(
      `Setting Profile typography ${validation.role ?? "value"} is ${validation.reason ?? "invalid"}.`,
    );
  }
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
): D6SettingProfileV5 {
  const firstEdition = family === "open-d6-first-edition";
  return Object.freeze({
    attributes: defaultAttributes(family),
    description: "",
    healthLabels: Object.freeze({}),
    id: firstEdition ? "open-d6-first-edition" : "d6-system-second-edition",
    label: firstEdition
      ? localized("D6E2.OpenD6Compatible")
      : localized("D6E2.SecondEdition"),
    logo: firstEdition
      ? D6_SYSTEM_2E_OPEN_D6_PROFILE_LOGO
      : "systems/d6-system-2e/assets/ui/d6-pause-mark.svg",
    logoAsWatermark: false,
    originRulesFamily: family,
    palette: firstEdition
      ? D6_SYSTEM_2E_OPEN_D6_SETTING_PALETTE
      : D6_SYSTEM_2E_CLASSIC_SETTING_PALETTE,
    typography: D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY,
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

export function bundledSettingProfiles(): readonly D6ResolvedSettingProfileV5[] {
  const freeD6 = Object.freeze({
    ...defaultSettingProfile("open-d6-first-edition"),
    attributes: Object.freeze(
      FREE_D6_ATTRIBUTE_IDS.map((id) =>
        Object.freeze({ id, label: localizedAttributeLabel(id) }),
      ),
    ),
    description: localized("D6E2.Settings.SettingProfile.FreeD6Help"),
    id: "free-d6",
    label: localized("D6E2.Settings.GameMode.FreeD6"),
    skills: FREE_D6_SETTING_SKILLS,
  });
  const d6mv = Object.freeze({
    ...defaultSettingProfile("d6-system-second-edition"),
    attributes: D6MV_ATTRIBUTES,
    description: localized("D6E2.Settings.SettingProfile.D6MVHelp"),
    id: "d6mv",
    label: localized("D6E2.Settings.GameMode.D6MV"),
    skills: D6MV_SETTING_SKILLS,
    terminology: Object.freeze({
      resources: Object.freeze({ experiencePoints: "Skill Points" }),
    }),
  });
  return Object.freeze([
    ...(["d6-system-second-edition", "open-d6-first-edition"] as const).map(
      (family) =>
        Object.freeze({
          ownerId: SYSTEM_ID,
          profile: defaultSettingProfile(family),
          source: "bundled" as const,
        }),
    ),
    Object.freeze({
      ownerId: SYSTEM_ID,
      profile: freeD6,
      source: "bundled" as const,
    }),
    Object.freeze({
      ownerId: SYSTEM_ID,
      profile: d6mv,
      source: "bundled" as const,
    }),
  ]);
}

export function normalizeSettingProfile(
  value: unknown,
  seedFamily: D6SettingRulesFamily = currentSettingRulesFamily(),
): D6SettingProfileV5 {
  const source = record(value);
  const storedFamily = text(source.originRulesFamily ?? source.rulesFamily);
  const originRulesFamily: D6SettingRulesFamily =
    storedFamily === "open-d6-first-edition"
      ? "open-d6-first-edition"
      : storedFamily === "d6-system-second-edition"
        ? "d6-system-second-edition"
        : seedFamily;
  const fallback = defaultSettingProfile(originRulesFamily);
  const allowedAttributeIds = ALLOWED_ATTRIBUTE_IDS;
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
  const preservesFreeD6Vocabulary = FREE_D6_ATTRIBUTE_IDS.every((id) =>
    attributes.some((attribute) => attribute.id === id),
  );
  if (!preservesFreeD6Vocabulary) {
    for (const attribute of fallback.attributes) {
      if (!attributes.some(({ id }) => id === attribute.id))
        attributes.push(attribute);
    }
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
    fallbackAsset: D6SettingProfileV5["wildDie"]["one"],
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
  const healthLabels = Object.freeze(
    Object.fromEntries(
      Object.entries(record(source.healthLabels)).flatMap(([modelId, raw]) => {
        if (!/^[a-z][a-z0-9.-]*$/u.test(modelId)) return [];
        const labels = record(raw);
        const states = Object.freeze(
          Object.fromEntries(
            Object.entries(record(labels.states)).flatMap(([stateId, label]) =>
              /^[a-z][a-z0-9.-]*$/u.test(stateId)
                ? [[stateId, text(label)]]
                : [],
            ),
          ),
        );
        return [
          [modelId, Object.freeze({ states, track: text(labels.track) })],
        ];
      }),
    ),
  );
  const palette = normalizedPalette(source.palette);
  const typography = normalizedSettingProfileTypography(source.typography);
  return Object.freeze({
    attributes: Object.freeze(attributes),
    description: text(source.description),
    healthLabels,
    id: safeId(source.id, "world-setting"),
    label: text(source.label, fallback.label),
    logo: safeAsset(source.logo, fallback.logo, "image"),
    logoAsWatermark: source.logoAsWatermark !== false,
    originRulesFamily,
    ...(palette ? { palette } : {}),
    ...(typography ? { typography } : {}),
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
  profiles: Readonly<Record<string, D6SettingProfileV5>>,
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
): D6WorldSettingProfilesV5 {
  const source = record(value);
  const profiles: Record<string, D6SettingProfileV5> = {};
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

export function storedWorldSettingProfiles(): D6WorldSettingProfilesV5 {
  return normalizeWorldSettingProfiles(storedProfilesValue());
}

function migrateBundledProfileCollisions(
  world: D6WorldSettingProfilesV5,
): D6WorldSettingProfilesV5 {
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
    const comparable =
      stored.palette === undefined || stored.typography === undefined
        ? {
            ...stored,
            ...(stored.palette === undefined && bundled.palette !== undefined
              ? { palette: bundled.palette }
              : {}),
            ...(stored.typography === undefined &&
            bundled.typography !== undefined
              ? { typography: bundled.typography }
              : {}),
          }
        : stored;
    if (canonicalJson(comparable) === canonicalJson(bundled)) continue;
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

export function availableSettingProfiles(): readonly D6ResolvedSettingProfileV5[] {
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
        logo:
          genre.id === genre.ownerId &&
          FIRST_PARTY_OPEN_D6_GENRE_PROFILE_IDS.has(genre.id)
            ? D6_SYSTEM_2E_OPEN_D6_PROFILE_LOGO
            : "systems/d6-system-2e/assets/ui/d6-pause-mark.svg",
        logoAsWatermark: false,
        originRulesFamily: "open-d6-first-edition",
        ...(genre.id === genre.ownerId &&
        FIRST_PARTY_OPEN_D6_GENRE_PROFILE_IDS.has(genre.id)
          ? { palette: D6_SYSTEM_2E_OPEN_D6_SETTING_PALETTE }
          : {}),
        ...(genre.id === genre.ownerId &&
        FIRST_PARTY_OPEN_D6_GENRE_PROFILE_IDS.has(genre.id)
          ? { typography: D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY }
          : {}),
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

export function currentSettingProfileSelection(): D6SettingProfileSelectionV5 {
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

export function currentResolvedSettingProfile(): D6ResolvedSettingProfileV5 {
  return currentSettingProfileSelection().resolved;
}

export function currentSettingProfile(): D6SettingProfileV5 {
  return currentResolvedSettingProfile().profile;
}

export function settingHealthTrackLabel(
  modelId: string,
  inheritedDefault: string,
  profile: D6SettingProfileV5 = currentSettingProfile(),
): string {
  const override = profile.healthLabels[modelId]?.track;
  return override?.trim().length ? override : localized(inheritedDefault);
}

export function settingHealthStateLabel(
  modelId: string,
  stateId: string,
  inheritedDefault: string,
  profile: D6SettingProfileV5 = currentSettingProfile(),
): string {
  const override = profile.healthLabels[modelId]?.states[stateId];
  return override?.trim().length ? override : localized(inheritedDefault);
}

export function hasCustomSettingProfile(): boolean {
  const source = record(storedProfilesValue());
  return (
    Object.keys(record(source.profiles)).length > 0 ||
    Boolean(source.firstEdition ?? source.secondEdition)
  );
}

export function editableCurrentSettingProfile(): D6SettingProfileV5 {
  const current = currentResolvedSettingProfile();
  if (current.source === "world") return current.profile;
  return normalizeSettingProfile({
    ...current.profile,
    id: uniqueWorldSettingProfileId(`${current.profile.id}-customized`),
    label: `${current.profile.label} · ${localized(
      "D6E2.Settings.SettingProfile.Customized",
    )}`,
    typography: Object.freeze({
      body: resolveSettingProfileTypography(current.profile.typography).body
        .effectiveId,
      display: resolveSettingProfileTypography(current.profile.typography)
        .display.effectiveId,
    }),
  });
}

export async function ensureWorldSettingProfilesStored(): Promise<D6WorldSettingProfilesV5> {
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
): Promise<D6SettingProfileV5> {
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
): Promise<D6SettingProfileV5> {
  assertValidExplicitPalette(value);
  assertValidExplicitTypography(value);
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
  source: D6SettingProfileV5 = currentSettingProfile(),
): D6SettingProfileV5 {
  const base = `${source.id}-copy`;
  return normalizeSettingProfile({
    ...source,
    id: uniqueWorldSettingProfileId(base),
    label: `${source.label} · ${localized("D6E2.Settings.SettingProfile.Copy")}`,
  });
}

export function exportSettingProfile(
  profile: D6SettingProfileV5 = currentSettingProfile(),
): SettingProfileExportV2 {
  return Object.freeze({
    ...(profile.typography
      ? { fontDependencies: settingProfileFontDependencies(profile.typography) }
      : {}),
    kind: SETTING_PROFILE_EXPORT_KIND,
    profile,
    version: D6_SETTING_PROFILE_CONTRACT_VERSION,
  });
}

export function importSettingProfile(value: unknown): D6SettingProfileV5 {
  const envelope = record(value);
  if (
    envelope.kind !== SETTING_PROFILE_EXPORT_KIND ||
    envelope.version !== D6_SETTING_PROFILE_CONTRACT_VERSION
  ) {
    throw new TypeError("Unsupported Setting Profile export.");
  }
  const raw = record(envelope.profile);
  assertValidExplicitPalette(raw);
  assertValidExplicitTypography(raw);
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
  const comparableRaw = {
    ...raw,
    ...(raw.palette === undefined
      ? {}
      : { palette: normalizedPalette(raw.palette) }),
    ...(raw.typography === undefined
      ? {}
      : { typography: normalizedSettingProfileTypography(raw.typography) }),
  };
  if (canonicalJson(comparableRaw) !== canonicalJson(profile)) {
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
): Promise<D6SettingProfileV5> {
  assertValidExplicitPalette(value);
  assertValidExplicitTypography(value);
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

export async function createSettingProfile(): Promise<D6SettingProfileV5> {
  const world = storedWorldSettingProfiles();
  const id = uniqueWorldSettingProfileId("new-setting");
  const current = currentSettingProfile();
  const profile = normalizeSettingProfile({
    ...current,
    description: "",
    id,
    label: game.i18n.localize("D6E2.Settings.SettingProfile.NewProfile"),
    logoAsWatermark: false,
    palette:
      current.palette ??
      resolveSettingProfilePalette(themeRegistry.current(), current) ??
      D6_SYSTEM_2E_CLASSIC_SETTING_PALETTE,
    typography: Object.freeze({
      body: resolveSettingProfileTypography(current.typography).body
        .effectiveId,
      display: resolveSettingProfileTypography(current.typography).display
        .effectiveId,
    }),
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
  value: D6SettingProfileV5,
): void {
  assertValidExplicitPalette(value);
  assertValidExplicitTypography(value);
  if (!ID_PATTERN.test(ownerId))
    throw new TypeError(`Invalid owner id: ${ownerId}`);
  if (
    (value as { version?: unknown }).version !==
    D6_SETTING_PROFILE_CONTRACT_VERSION
  ) {
    throw new TypeError("Unsupported Setting Profile contract version.");
  }
  const profile = normalizeSettingProfile(value);
  const comparableValue = {
    ...value,
    ...(value.palette === undefined
      ? {}
      : { palette: normalizedPalette(value.palette) }),
    ...(value.typography === undefined
      ? {}
      : {
          typography: normalizedSettingProfileTypography(value.typography),
        }),
  };
  if (canonicalJson(comparableValue) !== canonicalJson(profile)) {
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
  const settingProfile = currentSettingProfile();
  if (profileUsesD6MvRules(currentConfiguredRulesProfile())) {
    const ids = new Set<string>(D6MV_ATTRIBUTES.map(({ id }) => id));
    return Object.freeze(
      settingProfile.attributes.filter(({ id }) => ids.has(id)),
    );
  }
  if (profileUsesFreeD6AttributeVocabulary(currentConfiguredRulesProfile())) {
    const freeD6Ids = new Set<string>(FREE_D6_ATTRIBUTE_IDS);
    return Object.freeze(
      settingProfile.attributes.filter(({ id }) => freeD6Ids.has(id)),
    );
  }
  const activeIds = new Set(
    currentSettingRulesFamily() === "open-d6-first-edition"
      ? currentFirstEditionGenreProfile().attributes.map(({ id }) => id)
      : currentSecondEditionCampaignProfile().activeAttributeIds,
  );
  return Object.freeze(
    settingProfile.attributes.filter(({ id }) => activeIds.has(id)),
  );
}
