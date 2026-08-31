import type {
  D6ResolvedSettingProfileFontV1,
  D6SettingProfileFontDefinitionV1,
  D6SettingProfileFontRole,
  D6SettingProfileTypographyV1,
  D6System2eSettingProfileFontRegistry,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";

export const WORLD_SETTING_PROFILE_FONTS_SETTING = "worldSettingProfileFonts";

const FONT_ID_PATTERN = /^[a-z][a-z0-9-]*$/u;
const FONT_REF_PATTERN =
  /^(?:system\/[a-z][a-z0-9-]*|world\/[a-z][a-z0-9-]*|module\/[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*)$/u;
const FONT_PATH_PATTERN = /\.(?:otf|ttf|woff2?)$/iu;
const SYSTEM_FONTS = Object.freeze([
  Object.freeze({
    family: '"Avenir Next Condensed", "Arial Narrow", "Segoe UI", sans-serif',
    id: "d6-display",
    label: "D6 Condensed",
    roles: Object.freeze(["display"] as const),
  }),
  Object.freeze({
    family: '"Avenir Next", "Segoe UI Variable", "Segoe UI", sans-serif',
    id: "d6-interface",
    label: "D6 Humanist",
    roles: Object.freeze(["body"] as const),
  }),
  Object.freeze({
    family:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    id: "system-sans",
    label: "System Sans",
    roles: Object.freeze(["body", "display"] as const),
  }),
]);

export const D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY = Object.freeze({
  body: "system/d6-interface",
  display: "system/d6-display",
}) satisfies D6SettingProfileTypographyV1;

const moduleFonts = new Map<
  string,
  Map<string, D6SettingProfileFontDefinitionV1>
>();

export interface SettingProfileTypographyEditorSubscriber {
  applySettingProfileTypographyReplacement(
    removedRef: string,
    replacements: Readonly<Partial<Record<D6SettingProfileFontRole, string>>>,
  ): void;
  refreshSettingProfileFontAvailability(): Promise<void> | void;
}

const settingProfileTypographyEditorSubscribers =
  new Set<SettingProfileTypographyEditorSubscriber>();

export function subscribeSettingProfileTypographyEditor(
  subscriber: SettingProfileTypographyEditorSubscriber,
): () => void {
  settingProfileTypographyEditorSubscribers.add(subscriber);
  return () => settingProfileTypographyEditorSubscribers.delete(subscriber);
}

export async function notifySettingProfileFontAvailabilityChanged(): Promise<void> {
  await Promise.allSettled(
    [...settingProfileTypographyEditorSubscribers].map(
      async (subscriber) =>
        await subscriber.refreshSettingProfileFontAvailability(),
    ),
  );
}

export function resetSettingProfileTypographyEditorSubscribersForTests(): void {
  settingProfileTypographyEditorSubscribers.clear();
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function validLocalFontPath(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const path = value.trim();
  return (
    path.length > 0 &&
    FONT_PATH_PATTERN.test(path) &&
    !path.startsWith("/") &&
    !path.includes("..") &&
    !/[\\:?#[\]{}();'"<>]/u.test(path) &&
    !/^data:|^https?:/iu.test(path)
  );
}

function normalizeRoles(value: unknown): readonly D6SettingProfileFontRole[] {
  const roles = Array.isArray(value)
    ? value.filter(
        (role): role is D6SettingProfileFontRole =>
          role === "body" || role === "display",
      )
    : [];
  return Object.freeze([...new Set(roles)].sort());
}

export function validateSettingProfileFontDefinition(
  value: unknown,
): D6SettingProfileFontDefinitionV1 {
  const source = record(value);
  const id = typeof source.id === "string" ? source.id.trim() : "";
  const label = typeof source.label === "string" ? source.label.trim() : "";
  const path = typeof source.path === "string" ? source.path.trim() : "";
  const roles = normalizeRoles(source.roles);
  if (!FONT_ID_PATTERN.test(id)) throw new TypeError("Invalid font id.");
  if (!label || label.length > 120) throw new TypeError("Invalid font label.");
  if (!validLocalFontPath(path))
    throw new TypeError("Invalid local font path.");
  if (roles.length === 0)
    throw new TypeError("A font must allow at least one role.");
  if (source.version !== 1)
    throw new TypeError("Unsupported font definition version.");
  return Object.freeze({ id, label, path, roles, version: 1 });
}

function storedWorldFonts(): readonly D6SettingProfileFontDefinitionV1[] {
  try {
    const source = record(
      game.settings.get(SYSTEM_ID, WORLD_SETTING_PROFILE_FONTS_SETTING),
    );
    return Object.values(record(source.fonts)).flatMap((value) => {
      try {
        return [validateSettingProfileFontDefinition(value)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export function availableSettingProfileFonts(): readonly (D6ResolvedSettingProfileFontV1 & {
  readonly family: string;
})[] {
  const fonts = new Map<
    string,
    D6ResolvedSettingProfileFontV1 & { family: string }
  >();
  for (const font of SYSTEM_FONTS) {
    const ref = `system/${font.id}`;
    fonts.set(
      ref,
      Object.freeze({
        ...font,
        ownerId: SYSTEM_ID,
        ref,
        source: "system",
        version: 1,
      }),
    );
  }
  for (const [ownerId, definitions] of moduleFonts) {
    for (const definition of definitions.values()) {
      const resolved = resolvedAssetFont(definition, ownerId, "module");
      if (!fonts.has(resolved.ref)) fonts.set(resolved.ref, resolved);
    }
  }
  for (const definition of storedWorldFonts()) {
    const resolved = resolvedAssetFont(definition, "world", "world");
    if (!fonts.has(resolved.ref)) fonts.set(resolved.ref, resolved);
  }
  return Object.freeze([...fonts.values()]);
}

function internalFamily(ref: string): string {
  return `"d6e2-local-${ref.replace(/[^a-z0-9-]/gu, "-")}"`;
}

function resolvedAssetFont(
  definition: D6SettingProfileFontDefinitionV1,
  ownerId: string,
  source: "module" | "world",
): D6ResolvedSettingProfileFontV1 & { family: string } {
  const ref =
    source === "module"
      ? `module/${ownerId}/${definition.id}`
      : `world/${definition.id}`;
  return Object.freeze({
    ...definition,
    family: internalFamily(ref),
    ownerId,
    ref,
    source,
  });
}

export function registerSettingProfileFontContribution(
  ownerId: string,
  value: D6SettingProfileFontDefinitionV1,
): void {
  if (!/^[a-z][a-z0-9-]*$/u.test(ownerId))
    throw new TypeError("Invalid font owner id.");
  const definition = validateSettingProfileFontDefinition(value);
  if (!definition.path?.startsWith(`modules/${ownerId}/`)) {
    throw new TypeError("Contributed font assets must belong to their module.");
  }
  const ref = `module/${ownerId}/${definition.id}`;
  if (availableSettingProfileFonts().some((font) => font.ref === ref)) {
    throw new Error(`Font id is already registered: ${definition.id}`);
  }
  const entries = new Map(moduleFonts.get(ownerId) ?? []);
  entries.set(definition.id, definition);
  moduleFonts.set(ownerId, entries);
  Hooks.callAll?.("d6e2SettingProfileFontsChanged");
  void notifySettingProfileFontAvailabilityChanged();
}

export function unregisterSettingProfileFontOwner(ownerId: string): void {
  if (!moduleFonts.delete(ownerId)) return;
  Hooks.callAll?.("d6e2SettingProfileFontsChanged");
  void notifySettingProfileFontAvailabilityChanged();
}

export async function addWorldSettingProfileFont(input: {
  readonly label: string;
  readonly path: string;
  readonly roles?: readonly D6SettingProfileFontRole[];
}): Promise<D6SettingProfileFontDefinitionV1> {
  const base =
    input.label
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "") || "local-font";
  const used = new Set(storedWorldFonts().map(({ id }) => id));
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  const definition = validateSettingProfileFontDefinition({
    id,
    label: input.label,
    path: input.path,
    roles: input.roles ?? ["display"],
    version: 1,
  });
  const stored = record(
    game.settings.get(SYSTEM_ID, WORLD_SETTING_PROFILE_FONTS_SETTING),
  );
  await game.settings.set(SYSTEM_ID, WORLD_SETTING_PROFILE_FONTS_SETTING, {
    fonts: { ...record(stored.fonts), [id]: definition },
    version: 1,
  });
  await notifySettingProfileFontAvailabilityChanged();
  return definition;
}

export function resolveSettingProfileTypography(
  value: D6SettingProfileTypographyV1 | undefined,
): Readonly<
  Record<
    D6SettingProfileFontRole,
    Readonly<{
      available: boolean;
      effectiveId: string;
      family: string;
      requestedId: string;
    }>
  >
> {
  const requested = value ?? D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY;
  const fonts = availableSettingProfileFonts();
  const resolve = (role: D6SettingProfileFontRole) => {
    const requestedId = requested[role];
    const fallbackId = D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY[role];
    const selected = fonts.find(
      ({ ref, roles }) => ref === requestedId && roles.includes(role),
    );
    const fallback = fonts.find(({ ref }) => ref === fallbackId);
    if (!fallback) throw new Error(`Missing system font: ${fallbackId}`);
    return Object.freeze({
      available: Boolean(selected),
      effectiveId: selected?.ref ?? fallback.ref,
      family: selected?.family ?? fallback.family,
      requestedId,
    });
  };
  return Object.freeze({ body: resolve("body"), display: resolve("display") });
}

export type SettingProfileTypographyValidation = Readonly<{
  role?: D6SettingProfileFontRole;
  reason?: "malformed" | "unavailable" | "unsupported-role";
  valid: boolean;
}>;

export function validateSettingProfileTypography(
  value: unknown,
): SettingProfileTypographyValidation {
  const source = record(value);
  for (const role of ["display", "body"] as const) {
    const id = source[role];
    if (typeof id !== "string" || !FONT_REF_PATTERN.test(id))
      return Object.freeze({ role, reason: "malformed", valid: false });
    const definition = availableSettingProfileFonts().find(
      (font) => font.ref === id,
    );
    if (!definition)
      return Object.freeze({ role, reason: "unavailable", valid: false });
    if (!definition.roles.includes(role))
      return Object.freeze({ role, reason: "unsupported-role", valid: false });
  }
  return Object.freeze({ valid: true });
}

export function normalizedSettingProfileTypography(
  value: unknown,
): D6SettingProfileTypographyV1 | undefined {
  if (value === undefined) return undefined;
  const source = record(value);
  const body =
    typeof source.body === "string" && FONT_REF_PATTERN.test(source.body)
      ? source.body
      : D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY.body;
  const display =
    typeof source.display === "string" && FONT_REF_PATTERN.test(source.display)
      ? source.display
      : D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY.display;
  return Object.freeze({ body, display });
}

export function settingProfileTypographyProperties(
  value: D6SettingProfileTypographyV1 | undefined,
): Readonly<Record<string, string>> {
  const resolved = resolveSettingProfileTypography(value);
  return Object.freeze({
    "--d6e2-profile-font-body": resolved.body.family,
    "--d6e2-profile-font-display": resolved.display.family,
  });
}

export function settingProfileFontDependencies(
  value: D6SettingProfileTypographyV1 | undefined,
): readonly Readonly<{
  label: string;
  ref: string;
  roles: readonly D6SettingProfileFontRole[];
  source: "module" | "system" | "world";
}>[] {
  const refs = new Set(Object.values(value ?? {}));
  return Object.freeze(
    availableSettingProfileFonts()
      .filter(({ ref }) => refs.has(ref))
      .map(({ label, ref, roles, source }) =>
        Object.freeze({ label, ref, roles, source }),
      ),
  );
}

export function settingProfileFontUsage(
  ref: string,
): readonly Readonly<{ profileId: string; role: D6SettingProfileFontRole }>[] {
  try {
    const source = record(game.settings.get(SYSTEM_ID, "worldSettingProfiles"));
    return Object.entries(record(source.profiles)).flatMap(
      ([profileId, raw]) => {
        const typography = record(record(raw).typography);
        return (["display", "body"] as const).flatMap((role) =>
          typography[role] === ref ? [Object.freeze({ profileId, role })] : [],
        );
      },
    );
  } catch {
    return [];
  }
}

export async function removeWorldSettingProfileFont(
  ref: string,
  replacements: Readonly<
    Partial<Record<D6SettingProfileFontRole, string>>
  > = {},
): Promise<void> {
  if (!ref.startsWith("world/"))
    throw new TypeError("Only world fonts can be removed.");
  const id = ref.slice("world/".length);
  const library = record(
    game.settings.get(SYSTEM_ID, WORLD_SETTING_PROFILE_FONTS_SETTING),
  );
  const fonts = { ...record(library.fonts) };
  if (!(id in fonts)) throw new RangeError(`Unknown world font: ${ref}`);
  const world = record(game.settings.get(SYSTEM_ID, "worldSettingProfiles"));
  const originalProfiles = record(world.profiles);
  const profiles = structuredClone(originalProfiles);
  const usages = settingProfileFontUsage(ref);
  for (const usage of usages) {
    const replacement = replacements[usage.role];
    if (!replacement)
      throw new RangeError(`Replacement required for ${usage.role}.`);
    const existingTypography = {
      ...D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY,
      ...record(record(profiles[usage.profileId]).typography),
    };
    const validation = validateSettingProfileTypography({
      body: usage.role === "body" ? replacement : existingTypography.body,
      display:
        usage.role === "display" ? replacement : existingTypography.display,
    });
    if (!validation.valid) throw new TypeError("Invalid replacement font.");
    const profile = record(profiles[usage.profileId]);
    profiles[usage.profileId] = {
      ...profile,
      typography: { ...record(profile.typography), [usage.role]: replacement },
    };
  }
  Reflect.deleteProperty(fonts, id);
  if (usages.length === 0) {
    await game.settings.set(SYSTEM_ID, WORLD_SETTING_PROFILE_FONTS_SETTING, {
      ...library,
      fonts,
    });
    return;
  }
  await game.settings.set(SYSTEM_ID, "worldSettingProfiles", {
    ...world,
    profiles,
  });
  try {
    await game.settings.set(SYSTEM_ID, WORLD_SETTING_PROFILE_FONTS_SETTING, {
      ...library,
      fonts,
    });
  } catch (error) {
    await game.settings.set(SYSTEM_ID, "worldSettingProfiles", {
      ...world,
      profiles: originalProfiles,
    });
    throw error;
  }
}

export function applySettingProfileTypographyReplacement(
  value: D6SettingProfileTypographyV1,
  removedRef: string,
  replacements: Readonly<Partial<Record<D6SettingProfileFontRole, string>>>,
): D6SettingProfileTypographyV1 {
  const next = { ...value };
  for (const role of ["display", "body"] as const) {
    const replacement = replacements[role];
    if (next[role] === removedRef && replacement) next[role] = replacement;
  }
  return next;
}

export function synchronizeOpenSettingProfileTypographyDrafts(
  removedRef: string,
  replacements: Readonly<Partial<Record<D6SettingProfileFontRole, string>>>,
): void {
  for (const subscriber of [...settingProfileTypographyEditorSubscribers]) {
    subscriber.applySettingProfileTypographyReplacement(
      removedRef,
      replacements,
    );
  }
}

export async function removeWorldSettingProfileFontAndSynchronizeDrafts(
  ref: string,
  replacements: Readonly<
    Partial<Record<D6SettingProfileFontRole, string>>
  > = {},
): Promise<void> {
  await removeWorldSettingProfileFont(ref, replacements);
  synchronizeOpenSettingProfileTypographyDrafts(ref, {
    body: replacements.body ?? D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY.body,
    display:
      replacements.display ?? D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY.display,
  });
  await notifySettingProfileFontAvailabilityChanged();
}

interface TypographyRoot {
  readonly dataset: Record<string, string | undefined>;
  readonly style: Pick<CSSStyleDeclaration, "removeProperty" | "setProperty">;
}

export function replaceAppliedSettingProfileTypography(
  root: TypographyRoot,
  value: D6SettingProfileTypographyV1 | undefined,
): boolean {
  const properties = settingProfileTypographyProperties(value);
  const signature = JSON.stringify(Object.entries(properties).sort());
  if (root.dataset.d6System2eTypographySignature === signature) return false;
  for (const property of (
    root.dataset.d6System2eTypographyProperties ?? ""
  ).split(","))
    if (property) root.style.removeProperty(property);
  for (const [property, family] of Object.entries(properties))
    root.style.setProperty(property, family);
  root.dataset.d6System2eTypographyProperties = Object.keys(properties)
    .sort()
    .join(",");
  root.dataset.d6System2eTypographySignature = signature;
  return true;
}

const loadedFaces = new Map<string, FontFace>();
let loadGeneration = 0;

function fontSet(): FontFaceSet & {
  add(face: FontFace): void;
  delete(face: FontFace): boolean;
} {
  return document.fonts as FontFaceSet & {
    add(face: FontFace): void;
    delete(face: FontFace): boolean;
  };
}

async function loadRegisteredFont(
  font: D6ResolvedSettingProfileFontV1 & { readonly family: string },
): Promise<boolean> {
  if (!font.path) return true;
  if (loadedFaces.has(font.ref)) return true;
  try {
    const face = new FontFace(
      font.family.slice(1, -1),
      `url("${foundry.utils.getRoute(font.path)}")`,
    );
    await face.load();
    fontSet().add(face);
    loadedFaces.set(font.ref, face);
    return true;
  } catch {
    return false;
  }
}

/** Resolve and load one editor/library font without ever painting invisible text. */
export async function loadSettingProfileFontForRole(
  ref: string,
  role: D6SettingProfileFontRole,
): Promise<
  Readonly<{
    available: boolean;
    effectiveId: string;
    family: string;
    requestedId: string;
  }>
> {
  const fonts = availableSettingProfileFonts();
  const fallbackId = D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY[role];
  const fallback = fonts.find(({ ref: fontRef }) => fontRef === fallbackId);
  if (!fallback) throw new Error(`Missing system font: ${fallbackId}`);
  const selected = fonts.find(
    ({ ref: fontRef, roles }) => fontRef === ref && roles.includes(role),
  );
  const available = Boolean(selected && (await loadRegisteredFont(selected)));
  return Object.freeze({
    available,
    effectiveId: available && selected ? selected.ref : fallback.ref,
    family: available && selected ? selected.family : fallback.family,
    requestedId: ref,
  });
}

/** Keep role fallbacks painted until every selected local face has loaded. */
export async function synchronizeSettingProfileTypography(
  root: TypographyRoot,
  value: D6SettingProfileTypographyV1 | undefined,
): Promise<void> {
  const generation = ++loadGeneration;
  const requested = value ?? D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY;
  const available = availableSettingProfileFonts();
  const pending = (["display", "body"] as const).flatMap((role) => {
    const font = available.find(
      ({ ref, roles }) => ref === requested[role] && roles.includes(role),
    );
    return font?.path ? [font] : [];
  });
  const safeInitial = {
    body: pending.some(({ ref }) => ref === requested.body)
      ? D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY.body
      : requested.body,
    display: pending.some(({ ref }) => ref === requested.display)
      ? D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY.display
      : requested.display,
  };
  replaceAppliedSettingProfileTypography(root, safeInitial);
  const needed = new Set(pending.map(({ ref }) => ref));
  for (const [ref, face] of loadedFaces) {
    if (needed.has(ref)) continue;
    fontSet().delete(face);
    loadedFaces.delete(ref);
  }
  const loaded = await Promise.all(
    pending.map((font) => loadRegisteredFont(font)),
  );
  if (generation !== loadGeneration) return;
  const finalValue = { ...requested };
  pending.forEach((font, index) => {
    if (loaded[index]) return;
    if (finalValue.display === font.ref)
      finalValue.display = D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY.display;
    if (finalValue.body === font.ref)
      finalValue.body = D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY.body;
  });
  replaceAppliedSettingProfileTypography(root, finalValue);
}

export const settingProfileFontRegistry: D6System2eSettingProfileFontRegistry =
  Object.freeze({
    current: availableSettingProfileFonts,
    register: registerSettingProfileFontContribution,
    unregisterOwner: unregisterSettingProfileFontOwner,
  });

export function resetSettingProfileFontRegistryForTests(): void {
  moduleFonts.clear();
  loadedFaces.clear();
  loadGeneration = 0;
}

const D6_OWNED_APPLICATION_ROOTS = [
  ".application.d6e2",
  ".application.od6-pc-quickbar",
  ".application.od6-active-tasks-quickbar",
  ".application.d6e2-force-roll-builder",
  ".application.d6e2-bestiary-browser",
  ".application.od6-chase-tracker",
  ".application.od6-environment-manager",
].join(",");

export function applyD6SettingProfileTypographyScope(
  element: HTMLElement,
): boolean {
  const root = element.matches(D6_OWNED_APPLICATION_ROOTS)
    ? element
    : element.querySelector<HTMLElement>(D6_OWNED_APPLICATION_ROOTS);
  const chat = element.matches(".od6chat-roll")
    ? element
    : element.querySelector<HTMLElement>(".od6chat-roll");
  let changed = false;
  for (const target of [root, chat]) {
    if (!target || target.classList.contains("d6e2-typography-scope")) continue;
    target.classList.add("d6e2-typography-scope");
    changed = true;
  }
  return changed;
}

export function registerSettingProfileTypographyScopes(): void {
  Hooks.on("renderApplicationV2", (...args: unknown[]) => {
    const element = args.find(
      (value): value is HTMLElement => value instanceof HTMLElement,
    );
    if (element) applyD6SettingProfileTypographyScope(element);
  });
  Hooks.on("renderChatMessageHTML", (...args: unknown[]) => {
    const element = args.find(
      (value): value is HTMLElement => value instanceof HTMLElement,
    );
    if (element) applyD6SettingProfileTypographyScope(element);
  });
}
