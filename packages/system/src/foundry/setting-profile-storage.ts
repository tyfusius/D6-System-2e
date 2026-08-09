import type { D6SettingProfileV3 } from "@d6-system-2e/core";
import { validSettingProfileAssetPath } from "../settings/setting-profile";

const SETTING_PROFILE_FOLDER = "Setting Profiles";

export interface SettingProfileAssetDiagnostic {
  readonly code: "invalid-path" | "missing-asset";
  readonly field: string;
  readonly kind: "audio" | "image";
  readonly path: string;
}

export type SettingProfileAssetProbe = (path: string) => Promise<boolean>;

function safePathSegment(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9-]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return normalized.length > 0 ? normalized : fallback;
}

export function settingProfileDirectory(
  profileId: string,
  worldId = game.world?.id ?? "world",
): string {
  const resolvedWorldId = worldId.length > 0 ? worldId : "world";
  return `worlds/${resolvedWorldId}/${SETTING_PROFILE_FOLDER}/${safePathSegment(profileId, "setting")}`;
}

async function ensureDirectory(path: string): Promise<void> {
  const FilePicker = foundry.applications.apps.FilePicker.implementation;
  try {
    await FilePicker.browse("data", path);
  } catch {
    try {
      await FilePicker.createDirectory("data", path, {});
    } catch {
      // Another client may have created the directory while this request was
      // pending. A successful browse proves the intended workspace exists.
      await FilePicker.browse("data", path);
    }
  }
}

export async function ensureSettingProfileDirectory(
  profileId: string,
): Promise<string> {
  const worldRoot = `worlds/${game.world?.id ?? "world"}`;
  const profileRoot = `${worldRoot}/${SETTING_PROFILE_FOLDER}`;
  const profileDirectory = settingProfileDirectory(profileId);
  await ensureDirectory(profileRoot);
  await ensureDirectory(profileDirectory);
  return profileDirectory;
}

function assetReferences(
  profile: Pick<D6SettingProfileV3, "logo" | "skills" | "wildDie">,
): readonly Readonly<{
  field: string;
  kind: "audio" | "image";
  path: string;
}>[] {
  const references: {
    field: string;
    kind: "audio" | "image";
    path: string;
  }[] = [];
  if (profile.logo)
    references.push({ field: "logo", kind: "image", path: profile.logo });
  for (const [index, skill] of profile.skills.entries()) {
    if (skill.img)
      references.push({
        field: `skills.${index}.img`,
        kind: "image",
        path: skill.img,
      });
  }
  for (const face of ["one", "six"] as const) {
    const asset = profile.wildDie[face];
    if (asset.kind === "image" && asset.value) {
      references.push({
        field: `wildDie.${face}.value`,
        kind: "image",
        path: asset.value,
      });
    }
    const sound = profile.wildDie[`${face}Sound`];
    if (sound) {
      references.push({
        field: `wildDie.${face}Sound`,
        kind: "audio",
        path: sound,
      });
    }
  }
  return Object.freeze(references.map((reference) => Object.freeze(reference)));
}

async function defaultAssetProbe(path: string): Promise<boolean> {
  try {
    const response = await fetch(path, { cache: "no-store", method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function settingProfileAssetDiagnostics(
  profile: Pick<D6SettingProfileV3, "logo" | "skills" | "wildDie">,
  probe: SettingProfileAssetProbe = defaultAssetProbe,
): Promise<readonly SettingProfileAssetDiagnostic[]> {
  const diagnostics: SettingProfileAssetDiagnostic[] = [];
  const availability = new Map<string, Promise<boolean>>();
  for (const reference of assetReferences(profile)) {
    if (!validSettingProfileAssetPath(reference.path, reference.kind)) {
      diagnostics.push(
        Object.freeze({ ...reference, code: "invalid-path" as const }),
      );
      continue;
    }
    let pending = availability.get(reference.path);
    if (!pending) {
      pending = probe(reference.path);
      availability.set(reference.path, pending);
    }
    if (!(await pending)) {
      diagnostics.push(
        Object.freeze({ ...reference, code: "missing-asset" as const }),
      );
    }
  }
  return Object.freeze(diagnostics);
}
