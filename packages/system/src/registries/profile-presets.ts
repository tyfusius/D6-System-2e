import {
  D6_PROFILE_PRESET_CONTRACT_VERSION,
  type D6ProfilePresetDefinitionV1,
  type D6ResolvedProfilePresetV1,
  type D6System2eProfilePresetRegistry,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";

const ID_PATTERN = /^[a-z][a-z0-9-]*$/u;
const modulePresets = new Map<
  string,
  ReadonlyMap<string, D6ProfilePresetDefinitionV1>
>();

function localized(key: string): string {
  try {
    return game.i18n.localize(key);
  } catch {
    return key;
  }
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

function validateSelection(value: unknown): void {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("Invalid Profile Preset selection contract.");
  }
  const selection = value as Record<string, unknown>;
  if (
    selection.version !== D6_PROFILE_PRESET_CONTRACT_VERSION ||
    typeof selection.rulesProfileId !== "string" ||
    !ID_PATTERN.test(selection.rulesProfileId) ||
    typeof selection.settingProfileId !== "string" ||
    !ID_PATTERN.test(selection.settingProfileId)
  ) {
    throw new TypeError("Invalid Profile Preset selection contract.");
  }
}

function validatePreset(value: unknown): void {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("Invalid Profile Preset definition contract.");
  }
  const preset = value as Record<string, unknown>;
  if (
    preset.version !== D6_PROFILE_PRESET_CONTRACT_VERSION ||
    typeof preset.id !== "string" ||
    !ID_PATTERN.test(preset.id) ||
    typeof preset.label !== "string" ||
    !preset.label.trim() ||
    typeof preset.description !== "string"
  ) {
    throw new TypeError("Invalid Profile Preset definition contract.");
  }
  validateSelection(preset.selection);
}

function frozenPreset(
  value: D6ProfilePresetDefinitionV1,
): D6ProfilePresetDefinitionV1 {
  validatePreset(value);
  const normalized = Object.freeze({
    description: value.description.trim(),
    id: value.id,
    label: value.label.trim(),
    selection: Object.freeze({ ...value.selection }),
    version: D6_PROFILE_PRESET_CONTRACT_VERSION,
  });
  if (canonicalJson(value) !== canonicalJson(normalized)) {
    throw new TypeError("Profile Preset contribution would be lossy.");
  }
  return normalized;
}

export function bundledProfilePresets(): readonly D6ResolvedProfilePresetV1[] {
  return Object.freeze([
    Object.freeze({
      ownerId: SYSTEM_ID,
      preset: Object.freeze({
        description: localized("D6E2.Settings.ProfilePreset.SecondEditionHelp"),
        id: "second-edition-default",
        label: localized("D6E2.Settings.ProfilePreset.SecondEdition"),
        selection: Object.freeze({
          rulesProfileId: "second-edition",
          settingProfileId: "d6-system-second-edition",
          version: D6_PROFILE_PRESET_CONTRACT_VERSION,
        }),
        version: D6_PROFILE_PRESET_CONTRACT_VERSION,
      }),
      source: "bundled" as const,
    }),
    Object.freeze({
      ownerId: SYSTEM_ID,
      preset: Object.freeze({
        description: localized("D6E2.Settings.ProfilePreset.OpenD6Help"),
        id: "open-d6-default",
        label: localized("D6E2.Settings.ProfilePreset.OpenD6"),
        selection: Object.freeze({
          rulesProfileId: "open-d6",
          settingProfileId: "open-d6-first-edition",
          version: D6_PROFILE_PRESET_CONTRACT_VERSION,
        }),
        version: D6_PROFILE_PRESET_CONTRACT_VERSION,
      }),
      source: "bundled" as const,
    }),
    Object.freeze({
      ownerId: SYSTEM_ID,
      preset: Object.freeze({
        description: localized("D6E2.Settings.ProfilePreset.D6MVHelp"),
        id: "d6mv-default",
        label: localized("D6E2.Settings.ProfilePreset.D6MV"),
        selection: Object.freeze({
          rulesProfileId: "d6mv",
          settingProfileId: "d6mv",
          version: D6_PROFILE_PRESET_CONTRACT_VERSION,
        }),
        version: D6_PROFILE_PRESET_CONTRACT_VERSION,
      }),
      source: "bundled" as const,
    }),
    Object.freeze({
      ownerId: SYSTEM_ID,
      preset: Object.freeze({
        description: localized("D6E2.Settings.ProfilePreset.FreeD6Help"),
        id: "free-d6-default",
        label: localized("D6E2.Settings.ProfilePreset.FreeD6"),
        selection: Object.freeze({
          rulesProfileId: "free-d6",
          settingProfileId: "free-d6",
          version: D6_PROFILE_PRESET_CONTRACT_VERSION,
        }),
        version: D6_PROFILE_PRESET_CONTRACT_VERSION,
      }),
      source: "bundled" as const,
    }),
  ]);
}

export function availableProfilePresets(): readonly D6ResolvedProfilePresetV1[] {
  const resolved = [...bundledProfilePresets()];
  for (const [ownerId, presets] of [...modulePresets].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    for (const preset of [...presets.values()].sort((left, right) =>
      left.label.localeCompare(right.label),
    )) {
      resolved.push(Object.freeze({ ownerId, preset, source: "module" }));
    }
  }
  return Object.freeze(resolved);
}

export function registerProfilePresetContribution(
  ownerId: string,
  value: D6ProfilePresetDefinitionV1,
): void {
  if (!ID_PATTERN.test(ownerId))
    throw new TypeError(`Invalid owner id: ${ownerId}`);
  const preset = frozenPreset(value);
  if (
    bundledProfilePresets().some(({ preset: entry }) => entry.id === preset.id)
  )
    throw new Error(`Profile Preset id is reserved: ${preset.id}`);
  for (const [registeredOwner, presets] of modulePresets) {
    if (registeredOwner !== ownerId && presets.has(preset.id)) {
      throw new Error(
        `Profile Preset "${preset.id}" is already registered by "${registeredOwner}".`,
      );
    }
  }
  const ownerPresets = new Map(modulePresets.get(ownerId) ?? []);
  ownerPresets.set(preset.id, preset);
  modulePresets.set(ownerId, ownerPresets);
  Hooks.callAll?.("d6e2ProfilePresetsChanged");
}

export function unregisterProfilePresetOwner(ownerId: string): void {
  if (!modulePresets.delete(ownerId)) return;
  Hooks.callAll?.("d6e2ProfilePresetsChanged");
}

export function resetProfilePresetRegistryForTests(): void {
  modulePresets.clear();
}

export const profilePresetRegistry: D6System2eProfilePresetRegistry =
  Object.freeze({
    current: availableProfilePresets,
    register: registerProfilePresetContribution,
    unregisterOwner: unregisterProfilePresetOwner,
  });
