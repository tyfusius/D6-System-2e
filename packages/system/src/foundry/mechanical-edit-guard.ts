import { effectiveCharacterSheetMode } from "./sheets/sheet-mode";

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

export function mayDirectEditMechanicalScore(
  storedMode: unknown,
  isGM: boolean,
): boolean {
  return effectiveCharacterSheetMode(storedMode, isGM) === "freeedit";
}

function actorSheetMode(actor: FoundryActorDocument): unknown {
  return record(actor.system.sheetMode)?.value;
}

function updatingUserIsGM(userId: unknown): boolean {
  if (typeof userId === "string") {
    const user = game.users?.get(userId);
    if (user) return user.isGM === true;
  }
  return game.user?.isGM === true;
}

function isMigration(options: unknown): boolean {
  return record(options)?.d6System2eMigration === true;
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
    !changesAttributeScore(changeRecord) ||
    isMigration(options)
  ) {
    return;
  }
  const document = actor as FoundryActorDocument;
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
  if (
    !(typeof item === "object" && item !== null) ||
    !changeRecord ||
    !changesSkillScore(changeRecord) ||
    isMigration(options)
  ) {
    return;
  }
  const document = item as FoundryItemDocument;
  const parent = document.parent;
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

function guardSkillCreation(
  item: unknown,
  _data: unknown,
  options: unknown,
  userId: unknown,
): boolean | undefined {
  if (!(typeof item === "object" && item !== null) || isMigration(options)) {
    return;
  }
  const document = item as FoundryItemDocument;
  if (document.type !== "skill") return;
  const isGM = updatingUserIsGM(userId);
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
  Hooks.on("preCreateItem", guardSkillCreation);
  Hooks.on("preUpdateActor", guardActorScoreUpdate);
  Hooks.on("preUpdateItem", guardItemScoreUpdate);
}
