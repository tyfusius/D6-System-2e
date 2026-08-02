import { effectiveCharacterSheetMode } from "./sheets/sheet-mode";

const authorizedAdvancementDocuments = new WeakSet<object>();
const authorizedCreationDocuments = new WeakSet<object>();
const authorizedFeatureDocuments = new WeakSet<object>();
const authorizedHealthDocuments = new WeakSet<object>();
const authorizedHeroPointDocuments = new WeakSet<object>();
const authorizedMagicPointDocuments = new WeakSet<object>();
const authorizedPsionicsDocuments = new WeakSet<object>();
const authorizedTemplateDocuments = new WeakSet<object>();
const authorizedSuperheroicDocuments = new WeakSet<object>();

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function changesAttributeScore(
  changes: Record<string, unknown>,
): boolean {
  if (
    Object.keys(changes).some((key) =>
      /^system\.attributes\.[^.]+\.score$/u.test(key),
    )
  ) {
    return true;
  }
  const attributes = record(record(changes.system)?.attributes);
  return (
    attributes !== undefined &&
    Object.values(attributes).some((attribute) =>
      Object.hasOwn(record(attribute) ?? {}, "score"),
    )
  );
}

export function changesSkillScore(changes: Record<string, unknown>): boolean {
  return (
    Object.hasOwn(changes, "system.score") ||
    Object.hasOwn(record(changes.system) ?? {}, "score")
  );
}

export function changesRankedFeatureMechanics(
  changes: Record<string, unknown>,
): boolean {
  const system = record(changes.system) ?? {};
  return (
    ["system.cost", "system.rank", "system.repeatable"].some((key) =>
      Object.hasOwn(changes, key),
    ) ||
    ["cost", "rank", "repeatable"].some((key) => Object.hasOwn(system, key))
  );
}

export function changesProtectedFirstEditionResource(
  changes: Record<string, unknown>,
  currentSystem?: unknown,
): boolean {
  return ["characterPoints", "fatePoints"].some((key) =>
    changesProtectedResourceValue(changes, currentSystem, key),
  );
}

export function changesProtectedSecondEditionAdvancementResource(
  changes: Record<string, unknown>,
  currentSystem?: unknown,
): boolean {
  if (
    changesProtectedResourceValue(changes, currentSystem, "experiencePoints")
  ) {
    return true;
  }
  const flattened = Object.keys(changes).some((key) =>
    key.startsWith("system.advancement."),
  );
  const nested = Object.hasOwn(record(changes.system) ?? {}, "advancement");
  return flattened || nested;
}

function changesProtectedResourceValue(
  changes: Record<string, unknown>,
  currentSystem: unknown,
  resourceId: string,
): boolean {
  const flattenedKey = `system.resources.${resourceId}.value`;
  const nestedResource = record(
    record(record(changes.system)?.resources)?.[resourceId],
  );
  const hasFlattenedValue = Object.hasOwn(changes, flattenedKey);
  const hasNestedValue = Object.hasOwn(nestedResource ?? {}, "value");
  if (!hasFlattenedValue && !hasNestedValue) return false;
  if (currentSystem === undefined) return true;
  const incomingValue = hasFlattenedValue
    ? changes[flattenedKey]
    : nestedResource?.value;
  const currentValue = record(
    record(record(currentSystem)?.resources)?.[resourceId],
  )?.value;
  return !Object.is(incomingValue, currentValue);
}

export function mayDirectEditMechanicalScore(
  storedMode: unknown,
  isGM: boolean,
): boolean {
  return effectiveCharacterSheetMode(storedMode, isGM) === "freeedit";
}

export function usesPersonalMechanicalEditGuard(actorType: string): boolean {
  return ["character", "creature", "npc"].includes(actorType);
}

function actorSheetMode(actor: FoundryActorDocument): unknown {
  return record(actor.system.sheetMode)?.value;
}

function updatingUserIsGM(userId: unknown): boolean {
  if (typeof userId === "string") {
    const user = game.users?.get(userId);
    if (user) return user.isGM;
  }
  return game.user?.isGM === true;
}

function isMigration(options: unknown): boolean {
  return record(options)?.d6System2eMigration === true;
}

function isCatalogSync(options: unknown): boolean {
  return record(options)?.d6System2eCatalogSync === true;
}

export async function withAuthorizedAdvancementUpdate<T>(
  document: object,
  update: () => Promise<T>,
): Promise<T> {
  authorizedAdvancementDocuments.add(document);
  try {
    return await update();
  } finally {
    authorizedAdvancementDocuments.delete(document);
  }
}

export async function withAuthorizedCreationUpdate<T>(
  document: object,
  update: () => Promise<T>,
): Promise<T> {
  authorizedCreationDocuments.add(document);
  try {
    return await update();
  } finally {
    authorizedCreationDocuments.delete(document);
  }
}

export async function withAuthorizedFeatureUpdate<T>(
  document: object,
  update: () => Promise<T>,
): Promise<T> {
  authorizedFeatureDocuments.add(document);
  try {
    return await update();
  } finally {
    authorizedFeatureDocuments.delete(document);
  }
}

export async function withAuthorizedHeroPointUpdate<T>(
  document: object,
  update: () => Promise<T>,
): Promise<T> {
  authorizedHeroPointDocuments.add(document);
  try {
    return await update();
  } finally {
    authorizedHeroPointDocuments.delete(document);
  }
}

export async function withAuthorizedMagicPointUpdate<T>(
  document: object,
  update: () => Promise<T>,
): Promise<T> {
  authorizedMagicPointDocuments.add(document);
  try {
    return await update();
  } finally {
    authorizedMagicPointDocuments.delete(document);
  }
}

export async function withAuthorizedPsionicsUpdate<T>(
  document: object,
  update: () => Promise<T>,
): Promise<T> {
  authorizedPsionicsDocuments.add(document);
  try {
    return await update();
  } finally {
    authorizedPsionicsDocuments.delete(document);
  }
}

export async function withAuthorizedHealthUpdate<T>(
  document: object,
  update: () => Promise<T>,
): Promise<T> {
  authorizedHealthDocuments.add(document);
  try {
    return await update();
  } finally {
    authorizedHealthDocuments.delete(document);
  }
}

export async function withAuthorizedTemplateUpdate<T>(
  document: object,
  update: () => Promise<T>,
): Promise<T> {
  authorizedTemplateDocuments.add(document);
  try {
    return await update();
  } finally {
    authorizedTemplateDocuments.delete(document);
  }
}

export async function withAuthorizedSuperheroicUpdate<T>(
  document: object,
  update: () => Promise<T>,
): Promise<T> {
  authorizedSuperheroicDocuments.add(document);
  try {
    return await update();
  } finally {
    authorizedSuperheroicDocuments.delete(document);
  }
}

function changesProtectedSuperheroicState(
  changes: Record<string, unknown>,
): boolean {
  const protectedPaths = ["heroPoints", "status", "suspicion"];
  if (
    Object.keys(changes).some((key) =>
      protectedPaths.some((field) =>
        key.startsWith(`system.superheroic.secretIdentity.${field}`),
      ),
    )
  ) {
    return true;
  }
  const identity = record(
    record(record(changes.system)?.superheroic)?.secretIdentity,
  );
  return protectedPaths.some((field) => Object.hasOwn(identity ?? {}, field));
}

function guardActorScoreUpdate(
  actor: unknown,
  changes: unknown,
  options: unknown,
  userId: unknown,
): boolean | undefined {
  const changeRecord = record(changes);
  if (
    !(typeof actor === "object" && actor !== null) ||
    !changeRecord ||
    isMigration(options) ||
    authorizedCreationDocuments.has(actor) ||
    authorizedFeatureDocuments.has(actor) ||
    authorizedHealthDocuments.has(actor) ||
    authorizedHeroPointDocuments.has(actor) ||
    authorizedMagicPointDocuments.has(actor) ||
    authorizedPsionicsDocuments.has(actor) ||
    authorizedTemplateDocuments.has(actor) ||
    authorizedSuperheroicDocuments.has(actor) ||
    authorizedAdvancementDocuments.has(actor)
  ) {
    return;
  }
  const document = actor as FoundryActorDocument;
  if (!usesPersonalMechanicalEditGuard(document.type)) return;
  if (
    changesProtectedSuperheroicState(changeRecord) &&
    !updatingUserIsGM(userId)
  ) {
    return false;
  }
  if (
    (Object.hasOwn(changeRecord, "system.psionics") ||
      Object.keys(changeRecord).some((key) =>
        key.startsWith("system.psionics."),
      ) ||
      Object.hasOwn(record(changeRecord.system) ?? {}, "psionics")) &&
    !updatingUserIsGM(userId)
  ) {
    return false;
  }
  if (
    changesProtectedResourceValue(
      changeRecord,
      document.system,
      "magicPoints",
    ) &&
    !updatingUserIsGM(userId)
  ) {
    return false;
  }
  if (
    changesProtectedFirstEditionResource(changeRecord, document.system) &&
    !updatingUserIsGM(userId)
  ) {
    return false;
  }
  if (
    changesProtectedSecondEditionAdvancementResource(
      changeRecord,
      document.system,
    )
  ) {
    const isGM = updatingUserIsGM(userId);
    if (!isGM) return false;
  }
  if (!changesAttributeScore(changeRecord)) return;
  if (
    updatingUserIsGM(userId) &&
    mayDirectEditMechanicalScore(actorSheetMode(document), true)
  ) {
    return;
  }
  return false;
}

function guardItemScoreUpdate(
  item: unknown,
  changes: unknown,
  options: unknown,
  userId: unknown,
): boolean | undefined {
  const changeRecord = record(changes);
  const document =
    typeof item === "object" && item !== null
      ? (item as FoundryItemDocument)
      : undefined;
  const parent = document?.parent;
  const protectsSkillScore =
    document !== undefined &&
    ["skill", "specialization"].includes(document.type) &&
    changeRecord !== undefined &&
    changesSkillScore(changeRecord);
  const protectsRankedFeature =
    document !== undefined &&
    ["flaw", "perk", "talent"].includes(document.type) &&
    changeRecord !== undefined &&
    changesRankedFeatureMechanics(changeRecord);
  if (
    document === undefined ||
    !changeRecord ||
    (!protectsSkillScore && !protectsRankedFeature) ||
    isMigration(options) ||
    authorizedCreationDocuments.has(document) ||
    (parent !== undefined && authorizedCreationDocuments.has(parent)) ||
    authorizedAdvancementDocuments.has(document) ||
    authorizedTemplateDocuments.has(document) ||
    (parent !== undefined && authorizedTemplateDocuments.has(parent))
  ) {
    return;
  }
  const isGM = updatingUserIsGM(userId);
  if (
    isGM &&
    (parent === undefined ||
      mayDirectEditMechanicalScore(actorSheetMode(parent), true))
  ) {
    return;
  }
  return false;
}

function guardMechanicalItemCreation(
  item: unknown,
  _data: unknown,
  options: unknown,
  userId: unknown,
): boolean | undefined {
  if (!(typeof item === "object" && item !== null) || isMigration(options)) {
    return;
  }
  const document = item as FoundryItemDocument;
  if (
    !["flaw", "perk", "skill", "specialization", "talent"].includes(
      document.type,
    )
  ) {
    return;
  }
  if (
    authorizedCreationDocuments.has(document) ||
    authorizedFeatureDocuments.has(document) ||
    (document.parent !== undefined &&
      (authorizedCreationDocuments.has(document.parent) ||
        authorizedFeatureDocuments.has(document.parent) ||
        authorizedAdvancementDocuments.has(document.parent) ||
        authorizedTemplateDocuments.has(document.parent)))
  ) {
    return;
  }
  const isGM = updatingUserIsGM(userId);
  if (isGM && isCatalogSync(options)) return;
  if (
    isGM &&
    (document.parent === undefined ||
      mayDirectEditMechanicalScore(actorSheetMode(document.parent), true))
  ) {
    return;
  }
  return false;
}

export function registerMechanicalEditGuards(): void {
  Hooks.on("preCreateItem", guardMechanicalItemCreation);
  Hooks.on("preUpdateActor", guardActorScoreUpdate);
  Hooks.on("preUpdateItem", guardItemScoreUpdate);
}
