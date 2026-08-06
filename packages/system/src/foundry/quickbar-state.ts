export const QUICKBAR_STATE_VERSION = 2;

export type QuickbarSection = "npc" | "pc";

export interface QuickbarActorInfo {
  readonly id: string;
  readonly type: string;
}

export interface QuickbarState {
  readonly hiddenActorIds: readonly string[];
  readonly npcCollapsed: boolean;
  readonly npcOrder: readonly string[];
  readonly pcCollapsed: boolean;
  readonly pcOrder: readonly string[];
  readonly pinnedActorIds: readonly string[];
  readonly version: typeof QUICKBAR_STATE_VERSION;
}

const EMPTY_STATE: QuickbarState = Object.freeze({
  hiddenActorIds: Object.freeze([]),
  npcCollapsed: false,
  npcOrder: Object.freeze([]),
  pcCollapsed: false,
  pcOrder: Object.freeze([]),
  pinnedActorIds: Object.freeze([]),
  version: QUICKBAR_STATE_VERSION,
});

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? Object.freeze([
        ...new Set(
          value
            .filter((entry): entry is string => typeof entry === "string")
            .map((entry) => entry.trim())
            .filter(Boolean),
        ),
      ])
    : Object.freeze([]);
}

export function parseQuickbarState(value: unknown): QuickbarState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return EMPTY_STATE;
  }
  const state = value as Record<string, unknown>;
  const pinnedActorIds = stringArray(state.pinnedActorIds);
  const pinned = new Set(pinnedActorIds);
  const hiddenActorIds = Object.freeze(
    stringArray(state.hiddenActorIds).filter((id) => !pinned.has(id)),
  );

  if (state.version !== QUICKBAR_STATE_VERSION) {
    return Object.freeze({
      hiddenActorIds,
      npcCollapsed: Boolean(state.npcCollapsed),
      npcOrder: Object.freeze([]),
      pcCollapsed: Boolean(state.pcCollapsed),
      pcOrder: Object.freeze([]),
      pinnedActorIds,
      version: QUICKBAR_STATE_VERSION,
    });
  }

  const pcOrder = stringArray(state.pcOrder);
  const pcIds = new Set(pcOrder);
  return Object.freeze({
    hiddenActorIds,
    npcCollapsed: Boolean(state.npcCollapsed),
    npcOrder: Object.freeze(
      stringArray(state.npcOrder).filter((id) => !pcIds.has(id)),
    ),
    pcCollapsed: Boolean(state.pcCollapsed),
    pcOrder,
    pinnedActorIds,
    version: QUICKBAR_STATE_VERSION,
  });
}

export function resolveQuickbarSections(
  state: QuickbarState,
  actors: readonly QuickbarActorInfo[],
): { readonly npcIds: readonly string[]; readonly pcIds: readonly string[] } {
  const byId = new Map(actors.map((actor) => [actor.id, actor]));
  const hidden = new Set(state.hiddenActorIds);
  const visible = actors.filter((actor) => !hidden.has(actor.id));
  const pcIds = state.pcOrder.filter((id) => byId.has(id) && !hidden.has(id));
  const pcSet = new Set(pcIds);
  const npcIds = state.npcOrder.filter(
    (id) => byId.has(id) && !hidden.has(id) && !pcSet.has(id),
  );
  const ordered = new Set([...pcIds, ...npcIds]);

  for (const actor of visible) {
    if (ordered.has(actor.id)) continue;
    if (actor.type === "character") pcIds.push(actor.id);
    else npcIds.push(actor.id);
  }

  return Object.freeze({
    npcIds: Object.freeze(npcIds),
    pcIds: Object.freeze(pcIds),
  });
}

export function pinQuickbarActor(
  state: QuickbarState,
  actorId: string,
  section: QuickbarSection,
): QuickbarState {
  const id = actorId.trim();
  if (!id) return state;
  const pcOrder = state.pcOrder.filter((entry) => entry !== id);
  const npcOrder = state.npcOrder.filter((entry) => entry !== id);
  (section === "pc" ? pcOrder : npcOrder).push(id);
  return Object.freeze({
    ...state,
    hiddenActorIds: Object.freeze(
      state.hiddenActorIds.filter((entry) => entry !== id),
    ),
    npcOrder: Object.freeze(npcOrder),
    pcOrder: Object.freeze(pcOrder),
    pinnedActorIds: Object.freeze([...new Set([...state.pinnedActorIds, id])]),
  });
}

export function removeQuickbarActor(
  state: QuickbarState,
  actorId: string,
): QuickbarState {
  const id = actorId.trim();
  if (!id) return state;
  return Object.freeze({
    ...state,
    hiddenActorIds: Object.freeze([...new Set([...state.hiddenActorIds, id])]),
    npcOrder: Object.freeze(state.npcOrder.filter((entry) => entry !== id)),
    pcOrder: Object.freeze(state.pcOrder.filter((entry) => entry !== id)),
    pinnedActorIds: Object.freeze(
      state.pinnedActorIds.filter((entry) => entry !== id),
    ),
  });
}

export function reorderQuickbarActor(
  state: QuickbarState,
  actorId: string,
  section: QuickbarSection,
  index: number,
): QuickbarState {
  const id = actorId.trim();
  if (!id) return state;
  const pcOrder = state.pcOrder.filter((entry) => entry !== id);
  const npcOrder = state.npcOrder.filter((entry) => entry !== id);
  const target = section === "pc" ? pcOrder : npcOrder;
  target.splice(Math.max(0, Math.min(index, target.length)), 0, id);
  return Object.freeze({
    ...state,
    hiddenActorIds: Object.freeze(
      state.hiddenActorIds.filter((entry) => entry !== id),
    ),
    npcOrder: Object.freeze(npcOrder),
    pcOrder: Object.freeze(pcOrder),
    pinnedActorIds: Object.freeze([...new Set([...state.pinnedActorIds, id])]),
  });
}

export function toggleQuickbarSection(
  state: QuickbarState,
  section: QuickbarSection,
): QuickbarState {
  return Object.freeze({
    ...state,
    npcCollapsed: section === "npc" ? !state.npcCollapsed : state.npcCollapsed,
    pcCollapsed: section === "pc" ? !state.pcCollapsed : state.pcCollapsed,
  });
}
