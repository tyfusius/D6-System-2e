import { DEFAULT_DOCUMENT_IMAGES } from "../document-default-images";

export { DEFAULT_DOCUMENT_IMAGES } from "../document-default-images";

const FOUNDRY_ACTOR_PLACEHOLDERS = new Set<string>([
  "",
  "icons/svg/mystery-man.svg",
]);
const FOUNDRY_ITEM_PLACEHOLDERS = new Set<string>([
  "",
  "icons/svg/dice-target.svg",
  "icons/svg/item-bag.svg",
]);
const SYSTEM_WEAPON_PLACEHOLDERS = new Set<string>([
  DEFAULT_DOCUMENT_IMAGES.itemMeleeWeapon,
  DEFAULT_DOCUMENT_IMAGES.itemRangedWeapon,
  DEFAULT_DOCUMENT_IMAGES.itemThrownExplosive,
]);

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function sourceImage(source: unknown, document: unknown): string {
  const sourceRecord = record(source);
  if (typeof sourceRecord?.img === "string") return sourceRecord.img;
  const documentRecord = record(document);
  return typeof documentRecord?.img === "string" ? documentRecord.img : "";
}

function sourceType(source: unknown, document: unknown): string {
  const sourceRecord = record(source);
  if (typeof sourceRecord?.type === "string") return sourceRecord.type;
  const documentRecord = record(document);
  return typeof documentRecord?.type === "string" ? documentRecord.type : "";
}

function sourceSystem(
  source: unknown,
  document: unknown,
): Record<string, unknown> {
  return (
    record(record(source)?.system) ?? record(record(document)?.system) ?? {}
  );
}

function updateDocumentSource(document: unknown, img: string): void {
  const sourceDocument = document as Partial<FoundrySourceDocument>;
  if (typeof sourceDocument.updateSource === "function") {
    sourceDocument.updateSource({ img });
  }
}

export function actorDefaultImage(actorType: string): string {
  switch (actorType) {
    case "creature":
      return DEFAULT_DOCUMENT_IMAGES.actorCreature;
    case "hideout":
      return DEFAULT_DOCUMENT_IMAGES.actorHideout;
    case "starship":
      return DEFAULT_DOCUMENT_IMAGES.actorStarship;
    case "vehicle":
      return DEFAULT_DOCUMENT_IMAGES.actorVehicle;
    case "character":
    case "npc":
    default:
      return DEFAULT_DOCUMENT_IMAGES.actorCharacter;
  }
}

function numberAt(source: Record<string, unknown>, path: string): number {
  if (typeof source[path] === "number") return source[path];
  let value: unknown = source;
  for (const segment of path.split(".")) {
    value = record(value)?.[segment];
  }
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringAt(source: Record<string, unknown>, path: string): string {
  if (typeof source[path] === "string") return source[path];
  let value: unknown = source;
  for (const segment of path.split(".")) {
    value = record(value)?.[segment];
  }
  return typeof value === "string" ? value : "";
}

export function weaponDefaultImage(system: Record<string, unknown>): string {
  if (stringAt(system, "weaponKind") === "thrown-explosive") {
    return DEFAULT_DOCUMENT_IMAGES.itemThrownExplosive;
  }
  if (
    ["range.short", "range.medium", "range.long"].some(
      (path) => numberAt(system, path) > 0,
    )
  ) {
    return DEFAULT_DOCUMENT_IMAGES.itemRangedWeapon;
  }
  return DEFAULT_DOCUMENT_IMAGES.itemMeleeWeapon;
}

export function itemDefaultImage(
  itemType: string,
  system: Record<string, unknown> = {},
): string {
  switch (itemType) {
    case "skill":
    case "specialization":
      return DEFAULT_DOCUMENT_IMAGES.itemSkill;
    case "weapon":
      return weaponDefaultImage(system);
    case "starship-weapon":
    case "vehicle-weapon":
      return DEFAULT_DOCUMENT_IMAGES.itemRangedWeapon;
    case "armor":
      return DEFAULT_DOCUMENT_IMAGES.itemArmor;
    case "cybernetic":
      return DEFAULT_DOCUMENT_IMAGES.itemCybernetic;
    case "manifestation":
      return DEFAULT_DOCUMENT_IMAGES.itemManifestation;
    case "character-template":
    case "species-template":
      return DEFAULT_DOCUMENT_IMAGES.itemTemplate;
    case "item-group":
      return DEFAULT_DOCUMENT_IMAGES.itemGroup;
    case "disadvantage":
    case "flaw":
    case "trouble":
      return DEFAULT_DOCUMENT_IMAGES.itemFlaw;
    case "action":
    case "advantage":
    case "asset":
    case "perk":
    case "specialability":
    case "talent":
      return DEFAULT_DOCUMENT_IMAGES.itemFeature;
    case "gear":
    case "starship-gear":
    case "vehicle":
    case "vehicle-gear":
    default:
      return DEFAULT_DOCUMENT_IMAGES.itemGear;
  }
}

export function initializeActorDefaultImage(
  document: unknown,
  source: unknown,
): void {
  if (!FOUNDRY_ACTOR_PLACEHOLDERS.has(sourceImage(source, document))) return;
  updateDocumentSource(
    document,
    actorDefaultImage(sourceType(source, document)),
  );
}

export function initializeItemDefaultImage(
  document: unknown,
  source: unknown,
): void {
  if (!FOUNDRY_ITEM_PLACEHOLDERS.has(sourceImage(source, document))) return;
  updateDocumentSource(
    document,
    itemDefaultImage(
      sourceType(source, document),
      sourceSystem(source, document),
    ),
  );
}

function changedValue(
  changes: Record<string, unknown>,
  current: Record<string, unknown>,
  path: string,
): unknown {
  if (path in changes) return changes[path];
  let value: unknown = changes;
  for (const segment of path.split(".")) {
    value = record(value)?.[segment];
    if (value === undefined) break;
  }
  if (value !== undefined) return value;
  let currentValue: unknown = current;
  const currentPath = path.startsWith("system.") ? path.slice(7) : path;
  for (const segment of currentPath.split(".")) {
    currentValue = record(currentValue)?.[segment];
  }
  return currentValue;
}

export function updateWeaponDefaultImage(
  documentValue: unknown,
  changesValue: unknown,
): void {
  const document = record(documentValue);
  const changes = record(changesValue);
  if (!document || !changes || document.type !== "weapon") return;
  const currentImage = typeof document.img === "string" ? document.img : "";
  if (
    !FOUNDRY_ITEM_PLACEHOLDERS.has(currentImage) &&
    !SYSTEM_WEAPON_PLACEHOLDERS.has(currentImage)
  ) {
    return;
  }
  if (
    typeof changes.img === "string" &&
    !FOUNDRY_ITEM_PLACEHOLDERS.has(changes.img) &&
    !SYSTEM_WEAPON_PLACEHOLDERS.has(changes.img)
  ) {
    return;
  }
  const currentSystem = record(document.system) ?? {};
  const effectiveSystem: Record<string, unknown> = {
    weaponKind: changedValue(changes, currentSystem, "system.weaponKind"),
    range: {
      short: changedValue(changes, currentSystem, "system.range.short"),
      medium: changedValue(changes, currentSystem, "system.range.medium"),
      long: changedValue(changes, currentSystem, "system.range.long"),
    },
  };
  changes.img = weaponDefaultImage(effectiveSystem);
}

export function registerDocumentDefaultImages(): void {
  Hooks.on("preCreateActor", initializeActorDefaultImage);
  Hooks.on("preCreateItem", initializeItemDefaultImage);
  Hooks.on("preUpdateItem", updateWeaponDefaultImage);
}

interface ExistingImageDocument {
  readonly img: string;
  readonly system: Record<string, unknown>;
  readonly type: string;
  update(changes: Record<string, unknown>): Promise<unknown>;
}

export async function refreshExistingDocumentDefaultImages(): Promise<number> {
  if (game.user?.isGM !== true) return 0;
  let updated = 0;
  const refreshItem = async (item: ExistingImageDocument): Promise<void> => {
    if (!FOUNDRY_ITEM_PLACEHOLDERS.has(item.img)) return;
    await item.update({ img: itemDefaultImage(item.type, item.system) });
    updated += 1;
  };

  for (const actorValue of game.actors?.contents ?? []) {
    const actor = actorValue as FoundryActorDocument & ExistingImageDocument;
    if (FOUNDRY_ACTOR_PLACEHOLDERS.has(actor.img)) {
      await actor.update({ img: actorDefaultImage(actor.type) });
      updated += 1;
    }
    for (const itemValue of actor.items.contents) {
      await refreshItem(itemValue);
    }
  }
  for (const itemValue of game.items?.contents ?? []) {
    await refreshItem(itemValue);
  }
  return updated;
}
