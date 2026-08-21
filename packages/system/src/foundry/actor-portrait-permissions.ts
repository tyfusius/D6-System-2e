import { SHARED_SETTING_KEYS } from "../settings/settings-catalog";
import { booleanSetting } from "../settings/setting-values";

const CHARACTER_ACTOR_TYPES = new Set(["character", "creature", "npc"]);

export interface ActorPortraitPermissionState {
  readonly isGM: boolean;
  readonly isOwner: boolean;
  readonly playerUpdatesAllowed: boolean;
}

export function mayEditActorPortrait({
  isGM,
  isOwner,
  playerUpdatesAllowed,
}: ActorPortraitPermissionState): boolean {
  return isGM || (isOwner && playerUpdatesAllowed);
}

function playerPortraitUpdatesAllowed(): boolean {
  return booleanSetting(
    SHARED_SETTING_KEYS.allowPlayerCharacterPortraitUpdates,
    true,
  );
}

export function currentUserMayEditActorPortrait(
  actor: FoundryActorDocument,
): boolean {
  const user = game.user;
  if (!user || !CHARACTER_ACTOR_TYPES.has(actor.type)) return false;
  return mayEditActorPortrait({
    isGM: user.isGM,
    isOwner: actor.testUserPermission(user, "OWNER"),
    playerUpdatesAllowed: playerPortraitUpdatesAllowed(),
  });
}

export function guardActorPortraitUpdate(
  actorValue: unknown,
  changesValue: unknown,
  _options: unknown,
  userId: unknown,
): boolean | undefined {
  if (
    !(typeof actorValue === "object" && actorValue !== null) ||
    !(typeof changesValue === "object" && changesValue !== null) ||
    !Object.hasOwn(changesValue, "img")
  ) {
    return;
  }
  const actor = actorValue as FoundryActorDocument;
  if (!CHARACTER_ACTOR_TYPES.has(actor.type)) return;
  const user = typeof userId === "string" ? game.users?.get(userId) : game.user;
  if (
    user &&
    mayEditActorPortrait({
      isGM: user.isGM,
      isOwner: actor.testUserPermission(user, "OWNER"),
      playerUpdatesAllowed: playerPortraitUpdatesAllowed(),
    })
  ) {
    return;
  }
  return false;
}

export function registerActorPortraitPermissions(): void {
  Hooks.on("preUpdateActor", guardActorPortraitUpdate);
}
