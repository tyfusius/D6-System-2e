import { destinyClientIsAuthority } from "./destiny-crypto";
import { SYSTEM_ID } from "../constants";
import { requestMedicalRoot } from "./medical-consumable-authority";

function activeMedicalActor(
  actor: unknown,
): actor is FoundryActorDocument & { readonly uuid: string } {
  if (!actor || typeof actor !== "object") return false;
  const candidate = actor as FoundryActorDocument & { readonly uuid?: string };
  const medical = candidate.system.medical as
    { readonly stim?: { readonly version?: unknown } } | undefined;
  return typeof candidate.uuid === "string" && medical?.stim?.version === 1;
}

function campaignTime(): number | null {
  const value = (game as unknown as { time?: { worldTime?: number } }).time
    ?.worldTime;
  return Number.isFinite(value) && Number(value) >= 0 ? Number(value) : null;
}

function combatActors(
  combat: unknown,
): readonly (FoundryActorDocument & { readonly uuid: string })[] {
  const contents =
    (
      combat as {
        readonly combatants?: {
          readonly contents?: readonly { readonly actor?: unknown }[];
        };
      }
    ).combatants?.contents ?? [];
  return contents.flatMap(({ actor }) =>
    activeMedicalActor(actor) ? [actor] : [],
  );
}

function allMedicalActors(): readonly (FoundryActorDocument & {
  readonly uuid: string;
})[] {
  const actors = new Map<
    string,
    FoundryActorDocument & { readonly uuid: string }
  >();
  const add = (actor: unknown) => {
    if (activeMedicalActor(actor)) actors.set(actor.uuid, actor);
  };
  for (const actor of game.actors?.contents ?? []) add(actor);
  for (const scene of game.scenes?.contents ?? [])
    for (const token of (
      scene as unknown as {
        readonly tokens?: {
          readonly contents?: readonly { actor?: unknown }[];
        };
      }
    ).tokens?.contents ?? [])
      add(token.actor);
  return [...actors.values()];
}

function currentCombatForActor(actor: { readonly uuid: string }): {
  readonly ambiguousCombat: boolean;
  readonly combatUuid: string | null;
  readonly combatClocks: readonly {
    readonly combatUuid: string;
    readonly round: number;
  }[];
  readonly round: number | null;
} {
  const combats = (
    (game as unknown as { readonly combats?: { contents?: unknown[] } }).combats
      ?.contents ?? []
  ).flatMap((combat) => {
    if ((combat as { readonly started?: unknown }).started === false) return [];
    const uuid = (combat as { readonly uuid?: unknown }).uuid;
    const round = Number((combat as { readonly round?: unknown }).round);
    return combatActors(combat).some(
      (candidate) => candidate.uuid === actor.uuid,
    ) &&
      typeof uuid === "string" &&
      Number.isSafeInteger(round) &&
      round >= 1
      ? [{ combatUuid: uuid, round }]
      : [];
  });
  if (combats.length > 1)
    return {
      ambiguousCombat: true,
      combatUuid: null,
      combatClocks: combats,
      round: null,
    };
  return combats[0]
    ? { ambiguousCombat: false, combatClocks: combats, ...combats[0] }
    : {
        ambiguousCombat: false,
        combatUuid: null,
        combatClocks: combats,
        round: null,
      };
}

function sync(actor: FoundryActorDocument & { readonly uuid: string }): void {
  const combat = currentCombatForActor(actor);
  void reconcile(actor, {
    kind: "sync",
    campaignTime: campaignTime(),
    ...combat,
  }).catch(console.error);
}

async function reconcile(
  actor: FoundryActorDocument & { readonly uuid: string },
  event: unknown,
): Promise<void> {
  if (!destinyClientIsAuthority()) return;
  await requestMedicalRoot({
    method: "reconcile",
    actorUuid: actor.uuid,
    event,
  });
}

let registered = false;
export function registerMedicalConsumableHooks(): void {
  if (registered) return;
  registered = true;
  Hooks.on(
    "preUpdateActor",
    (_actor: unknown, changes: unknown, _options: unknown, userId: unknown) => {
      if (!changes || typeof changes !== "object") return;
      const value = changes as Record<string, unknown>;
      const medical = (value.system as { medical?: unknown } | undefined)
        ?.medical;
      const changesPhysiology =
        Object.hasOwn(value, "system.medical.physiology") ||
        (!!medical &&
          typeof medical === "object" &&
          Object.hasOwn(medical, "physiology"));
      if (!changesPhysiology) return;
      const user =
        typeof userId === "string" ? game.users?.get(userId) : game.user;
      if (!user?.isGM) return false;
    },
  );
  Hooks.once("ready", () => {
    if (!destinyClientIsAuthority()) return;
    for (const actor of allMedicalActors()) sync(actor);
  });
  Hooks.on("updateWorldTime", (_worldTime: unknown, delta: unknown) => {
    if (!destinyClientIsAuthority() || !(Number(delta) > 0)) return;
    for (const actor of allMedicalActors()) sync(actor);
  });
  Hooks.on("updateCombat", (combat: unknown, changes: unknown) => {
    if (!destinyClientIsAuthority()) return;
    if (!changes || typeof changes !== "object") return;
    const round = Number((combat as { readonly round?: unknown }).round);
    const uuid = (combat as { readonly uuid?: unknown }).uuid;
    if (typeof uuid !== "string") return;
    const ended =
      (Object.hasOwn(changes, "round") &&
        (!Number.isSafeInteger(round) || round < 1)) ||
      (Object.hasOwn(changes, "started") &&
        (combat as { readonly started?: unknown }).started === false);
    if (ended) {
      const current = campaignTime();
      for (const actor of combatActors(combat))
        if (current === null)
          void reconcile(actor, {
            kind: "sync",
            ambiguousCombat: false,
            campaignTime: null,
            combatUuid: null,
            combatClocks: [],
            round: null,
          }).catch(console.error);
        else
          void reconcile(actor, {
            kind: "leave",
            campaignTime: current,
            combatUuid: uuid,
            round: Number.isSafeInteger(round) && round >= 1 ? round : 1,
          }).catch(console.error);
      return;
    }
    if (
      !Object.hasOwn(changes, "round") ||
      !Number.isSafeInteger(round) ||
      round < 1
    )
      return;
    for (const actor of combatActors(combat)) sync(actor);
  });
  Hooks.on("createCombatant", (combatant: unknown) => {
    const actor = (combatant as { readonly actor?: unknown }).actor;
    if (activeMedicalActor(actor)) sync(actor);
  });
  Hooks.on("deleteCombatant", (combatant: unknown) => {
    const actor = (combatant as { readonly actor?: unknown }).actor;
    const combat = (
      combatant as {
        readonly combat?: { readonly uuid?: unknown; readonly round?: unknown };
      }
    ).combat;
    const current = campaignTime();
    if (
      !activeMedicalActor(actor) ||
      typeof combat?.uuid !== "string" ||
      !Number.isSafeInteger(combat.round) ||
      Number(combat.round) < 1
    )
      return;
    if (current === null) {
      void reconcile(actor, {
        kind: "sync",
        ambiguousCombat: false,
        campaignTime: null,
        combatUuid: null,
        combatClocks: [],
        round: null,
      }).catch(console.error);
      return;
    }
    void reconcile(actor, {
      kind: "leave",
      campaignTime: current,
      combatUuid: combat.uuid,
      round: Number(combat.round),
    }).catch(console.error);
  });
  Hooks.on("deleteCombat", (combat: unknown) => {
    const round = Number((combat as { readonly round?: unknown }).round);
    const uuid = (combat as { readonly uuid?: unknown }).uuid;
    const current = campaignTime();
    if (typeof uuid !== "string" || !Number.isSafeInteger(round) || round < 1)
      return;
    for (const actor of combatActors(combat)) {
      if (current === null)
        void reconcile(actor, {
          kind: "sync",
          ambiguousCombat: false,
          campaignTime: null,
          combatUuid: null,
          combatClocks: [],
          round: null,
        }).catch(console.error);
      else
        void reconcile(actor, {
          kind: "leave",
          campaignTime: current,
          combatUuid: uuid,
          round,
        }).catch(console.error);
    }
  });
  Hooks.on("createActor", (actor: unknown) => {
    if (activeMedicalActor(actor)) sync(actor);
  });
  const reconcileAuthority = (message: unknown) => {
    const flag = (
      message as {
        readonly getFlag?: (namespace: string, key: string) => unknown;
      }
    ).getFlag?.(SYSTEM_ID, "destinyV1") as
      { readonly type?: unknown } | undefined;
    if (flag?.type !== "presence" || !destinyClientIsAuthority()) return;
    for (const actor of allMedicalActors()) sync(actor);
  };
  Hooks.on("createChatMessage", reconcileAuthority);
  Hooks.on("updateChatMessage", reconcileAuthority);
}
