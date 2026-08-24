import { SYSTEM_ID } from "../../constants";
import { normalizeD6BlastProfile } from "@d6-system-2e/core";
import {
  D6_EXPLOSIVE_REGION_STATE_SCHEMA,
  parseD6ExplosiveRegionState,
  transitionD6ExplosiveRegion,
  type D6ExplosiveRegionStateV1,
} from "../../application/explosive-workflow";
import type { D6ExplosiveAimResult } from "./explosive-aim-controller";
import {
  currentD6ExplosiveThrowRanges,
  resolveD6ExplosivePlacement,
} from "./explosive-rules";

const SOCKET_TIMEOUT_MS = 15_000;
const pending = new Map<
  string,
  { reject(error: Error): void; resolve(value: unknown): void }
>();

type Mutation =
  | {
      readonly operation: "create";
      readonly request: Omit<
        D6ExplosiveRegionStateV1,
        | "aimedPoint"
        | "affectedTargets"
        | "difficulty"
        | "range"
        | "regionId"
        | "resolvedPoint"
        | "revision"
        | "schema"
        | "status"
      >;
      readonly aim: D6ExplosiveAimResult;
    }
  | {
      readonly operation: "update";
      readonly requestId: string;
      readonly regionId: string;
      readonly sceneId: string;
      readonly expectedRevision: number;
      readonly changes: Parameters<typeof transitionD6ExplosiveRegion>[2];
    }
  | {
      readonly operation: "delete" | "detonate";
      readonly requestId: string;
      readonly regionId: string;
      readonly sceneId: string;
    };

interface SocketRequest {
  readonly type: "explosive-mutation";
  readonly messageId: string;
  readonly requesterUserId: string;
  readonly mutation: Mutation;
}
interface SocketResponse {
  readonly type: "explosive-response";
  readonly messageId: string;
  readonly requesterUserId: string;
  readonly error?: string;
  readonly result?: unknown;
}

interface RegionLike {
  readonly id: string;
  getFlag(scope: string, key: string): unknown;
  toObject(): Record<string, unknown>;
  update(changes: Record<string, unknown>): Promise<unknown>;
}

let detonateHandler:
  ((state: D6ExplosiveRegionStateV1) => Promise<unknown>) | undefined;

export function registerD6ExplosiveRegionSocket(
  handler: (state: D6ExplosiveRegionStateV1) => Promise<unknown>,
): void {
  detonateHandler = handler;
  game.socket?.on(
    `system.${SYSTEM_ID}`,
    (value: unknown) => void receive(value),
  );
}

export async function requestD6ExplosiveMutation(
  mutation: Mutation,
): Promise<unknown> {
  if (game.user?.isGM) return applyMutation(mutation, game.user.id);
  const activeGm = activeD6ExplosiveGm();
  if (!activeGm || !game.user)
    throw new Error("D6E2.Explosive.Error.GmUnavailable");
  const messageId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    pending.set(messageId, { reject, resolve });
    globalThis.setTimeout(() => {
      if (pending.delete(messageId))
        reject(new Error("D6E2.Explosive.Error.GmTimeout"));
    }, SOCKET_TIMEOUT_MS);
    game.socket?.emit(`system.${SYSTEM_ID}`, {
      messageId,
      mutation,
      requesterUserId: game.user?.id ?? "",
      type: "explosive-mutation",
    } satisfies SocketRequest);
  });
}

export function activeD6ExplosiveGm():
  NonNullable<typeof game.user> | undefined {
  return (game.users?.contents ?? [])
    .filter((user) => user.active && user.isGM)
    .sort((a, b) => a.id.localeCompare(b.id))[0];
}

export function assertD6ExplosiveCoordinatorAvailable(): void {
  if (!game.user?.isGM && !activeD6ExplosiveGm())
    throw new Error("D6E2.Explosive.Error.GmUnavailable");
}

async function receive(value: unknown): Promise<void> {
  if (!value || typeof value !== "object" || !("type" in value)) return;
  const type = (value as { readonly type?: unknown }).type;
  if (type === "explosive-response") {
    const response = value as SocketResponse;
    if (response.requesterUserId !== game.user?.id) return;
    const resolver = pending.get(response.messageId);
    if (!resolver) return;
    pending.delete(response.messageId);
    if (response.error) resolver.reject(new Error(response.error));
    else resolver.resolve(response.result);
    return;
  }
  if (type !== "explosive-mutation" || game.user?.isGM !== true) return;
  const request = value as SocketRequest;
  const activeGm = activeD6ExplosiveGm();
  if (activeGm?.id !== game.user.id) return;
  let result: unknown;
  let error: string | undefined;
  try {
    result = await applyMutation(request.mutation, request.requesterUserId);
  } catch (caught) {
    error =
      caught instanceof Error
        ? caught.message
        : "D6E2.Explosive.Error.InvalidRequest";
  }
  game.socket?.emit(`system.${SYSTEM_ID}`, {
    ...(error ? { error } : { result }),
    messageId: request.messageId,
    requesterUserId: request.requesterUserId,
    type: "explosive-response",
  } satisfies SocketResponse);
}

async function applyMutation(
  mutation: Mutation,
  requesterUserId: string,
): Promise<unknown> {
  if (!game.user?.isGM) throw new Error("D6E2.Explosive.Error.GmRequired");
  const scene = game.scenes?.get(
    mutation.operation === "create"
      ? mutation.request.sceneId
      : mutation.sceneId,
  ) as unknown as
    | (Parameters<typeof createRegion>[0] & {
        deleteEmbeddedDocuments(
          type: "Region",
          ids: string[],
        ): Promise<unknown>;
        readonly regions: { get(id: string): RegionLike | undefined };
      })
    | undefined;
  if (!scene) throw new Error("D6E2.Explosive.Error.SceneUnavailable");
  if (mutation.operation === "create")
    return createRegion(scene, mutation, requesterUserId);
  const region = (
    scene as { regions: { get(id: string): RegionLike | undefined } }
  ).regions.get(mutation.regionId);
  const state = region ? d6ExplosiveRegionState(region) : null;
  if (!region || state?.requestId !== mutation.requestId)
    throw new Error("D6E2.Explosive.Error.RegionMismatch");
  const requester = game.users?.get(requesterUserId);
  const actor = (await fromUuid(
    state.actorUuid,
  )) as FoundryActorDocument | null;
  if (
    !requester?.active ||
    (!requester.isGM &&
      (!actor ||
        state.userId !== requester.id ||
        !actor.testUserPermission(requester, "OWNER")))
  )
    throw new Error("D6E2.Explosive.Error.NotAuthorized");
  if (mutation.operation === "delete") {
    await (
      scene as {
        deleteEmbeddedDocuments(
          type: "Region",
          ids: string[],
        ): Promise<unknown>;
      }
    ).deleteEmbeddedDocuments("Region", [region.id]);
    return null;
  }
  if (mutation.operation === "detonate") {
    if (!detonateHandler)
      throw new Error("D6E2.Explosive.Error.ServiceUnavailable");
    return detonateHandler(state);
  }
  const update = mutation as Extract<Mutation, { operation: "update" }>;
  const next = transitionD6ExplosiveRegion(
    state,
    update.expectedRevision,
    update.changes,
  );
  const shapes = update.changes.resolvedPoint
    ? (
        (region.toObject() as { shapes?: readonly Record<string, unknown>[] })
          .shapes ?? []
      ).map((shape) => ({
        ...shape,
        x: update.changes.resolvedPoint?.x,
        y: update.changes.resolvedPoint?.y,
      }))
    : undefined;
  await region.update({
    ...(shapes ? { shapes } : {}),
    [`flags.${SYSTEM_ID}.explosive`]: structuredClone(next),
  });
  return next;
}

async function createRegion(
  scene: {
    readonly grid?: { readonly distance?: number; readonly size?: number };
    readonly tokens?: {
      get(id: string):
        | {
            readonly actorId?: string;
            readonly actor?: { readonly id?: string } | null;
          }
        | undefined;
    };
    readonly regions?: { readonly contents?: readonly RegionLike[] };
    createEmbeddedDocuments(
      type: "Region",
      data: readonly Record<string, unknown>[],
    ): Promise<readonly RegionLike[]>;
    deleteEmbeddedDocuments(
      type: "Region",
      ids: readonly string[],
    ): Promise<unknown>;
  },
  mutation: Extract<Mutation, { operation: "create" }>,
  requesterUserId: string,
): Promise<D6ExplosiveRegionStateV1> {
  const requester = game.users?.get(requesterUserId);
  const actor = (await fromUuid(
    mutation.request.actorUuid,
  )) as FoundryActorDocument | null;
  const item = (await fromUuid(
    mutation.request.itemUuid,
  )) as FoundryItemDocument | null;
  const token = scene.tokens?.get(mutation.request.tokenId);
  const duplicate = scene.regions?.contents
    ?.map(d6ExplosiveRegionState)
    .find((state) => state?.requestId === mutation.request.requestId);
  if (duplicate) return duplicate;
  const profile =
    item?.type === "weapon" ? normalizeD6BlastProfile(item.system.blast) : null;
  if (
    !requester?.active ||
    mutation.request.userId !== requesterUserId ||
    !actor ||
    !item ||
    item.parent?.uuid !== actor.uuid ||
    item.type !== "weapon" ||
    item.system.weaponKind !== "thrown-explosive" ||
    !actor.testUserPermission(requester, "OWNER") ||
    (token?.actorId ?? token?.actor?.id) !== actor.id ||
    !profile ||
    JSON.stringify(profile) !== JSON.stringify(mutation.request.blastProfile)
  )
    throw new Error("D6E2.Explosive.Error.NotAuthorized");
  if (
    canvas.scene?.id !== mutation.request.sceneId ||
    !Number.isFinite(mutation.aim.point.x) ||
    !Number.isFinite(mutation.aim.point.y)
  )
    throw new Error("D6E2.Explosive.Error.SceneUnavailable");
  const grid = canvas.grid;
  if (!grid) throw new Error("D6E2.Explosive.Error.SceneUnavailable");
  const distance = grid.measurePath([
    mutation.request.origin,
    mutation.aim.point,
  ]).distance;
  const sourceToken = canvas.tokens?.placeables.find(
    (candidate) => candidate.id === mutation.request.tokenId,
  );
  const sourceCenter = sourceToken?.center;
  const sourceHidden =
    (sourceToken?.document as { readonly hidden?: boolean } | undefined)
      ?.hidden === true;
  if (
    sourceCenter?.x !== mutation.request.origin.x ||
    sourceCenter.y !== mutation.request.origin.y
  )
    throw new Error("D6E2.Explosive.Error.NotAuthorized");
  const placement = resolveD6ExplosivePlacement(
    distance,
    currentD6ExplosiveThrowRanges(actor, item),
  );
  if (placement.range.outOfRange || placement.range.band === null)
    throw new Error("D6E2.Explosive.Error.OutOfRange");
  const regionId = foundry.utils.randomID();
  const state: D6ExplosiveRegionStateV1 = Object.freeze({
    ...mutation.request,
    affectedTargets: Object.freeze([]),
    aimedPoint: mutation.aim.point,
    difficulty: placement.difficulty,
    range: placement.range,
    regionId,
    resolvedPoint: mutation.aim.point,
    revision: 0,
    schema: D6_EXPLOSIVE_REGION_STATE_SCHEMA,
    status: "aiming",
  });
  const pixelsPerMeter = (scene.grid?.size ?? 1) / (scene.grid?.distance ?? 1);
  const created = await scene.createEmbeddedDocuments("Region", [
    {
      _id: regionId,
      behaviors: [],
      color: state.visualColor,
      displayMeasurements: false,
      flags: { [SYSTEM_ID]: { explosive: structuredClone(state) } },
      hidden: sourceHidden,
      name: game.i18n.localize("D6E2.Explosive.RegionName"),
      shapes: state.blastProfile.zones.map((zone) => ({
        gridBased: false,
        hole: false,
        radius: zone.radiusMeters * pixelsPerMeter,
        type: "circle",
        x: state.aimedPoint.x,
        y: state.aimedPoint.y,
      })),
    },
  ]);
  const region = created[0];
  if (!region) throw new Error("D6E2.Explosive.Error.RegionCreateFailed");
  const actualState: D6ExplosiveRegionStateV1 = Object.freeze({
    ...state,
    regionId: region.id,
  });
  try {
    if (region.id !== state.regionId)
      await region.update({
        [`flags.${SYSTEM_ID}.explosive`]: structuredClone(actualState),
      });
    const persisted = parseD6ExplosiveRegionState(
      region.getFlag(SYSTEM_ID, "explosive"),
    );
    if (persisted?.regionId !== region.id)
      throw new Error("D6E2.Explosive.Error.RegionCreateFailed");
    return persisted;
  } catch (error) {
    await scene
      .deleteEmbeddedDocuments("Region", [region.id])
      .catch(() => undefined);
    throw error;
  }
}

export function d6ExplosiveRegionState(value: {
  readonly id?: string;
  getFlag(scope: string, key: string): unknown;
}): D6ExplosiveRegionStateV1 | null {
  const state = parseD6ExplosiveRegionState(
    value.getFlag(SYSTEM_ID, "explosive"),
  );
  if (!state || typeof value.id !== "string" || value.id.length === 0)
    return state;
  return state.regionId === value.id
    ? state
    : Object.freeze({ ...state, regionId: value.id });
}
