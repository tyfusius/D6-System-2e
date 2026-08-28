import {
  normalizeD6BlastProfile,
  planD6ExplosiveScatter,
  type D6ExplosiveBeginOptionsV1,
  D6_EXPLOSIVE_WORKFLOW_CONTRACT_VERSION,
  type D6ExplosiveScatterPlan,
  type D6RollInvocationOptionsV1,
  type D6RollResultV1,
} from "@d6-system-2e/core";
import type {
  D6CanvasPoint,
  D6ExplosiveRegionStateV1,
} from "../../application/explosive-workflow";
import {
  appendD6InitiatingActionResult,
  createD6InitiatingActionResultLedger,
  parseD6InitiatingActionResultLedger,
} from "../../application/initiating-action-results";
import { d6ExplosiveFinalPoint } from "../../application/explosive-workflow";
import { SYSTEM_ID } from "../../constants";
import { currentConfiguredRulesProfile } from "../../settings/rules-profile-library";
import { currentDefenseRuntimeStrategy } from "../../settings/defenses";
import { stringValue } from "../sheets/values";
import {
  rollPlacedThrownExplosiveAttack,
  rollPlacedThrownExplosiveAttackWithMessage,
  type RollTargetContext,
  type RollTargetOption,
} from "../rolls/roll-service";
import {
  appendD6InitiatingActionPresentation,
  D6_INITIATING_ACTION_RESULTS_FLAG,
  hydrateD6FoundryRolls,
  serializeD6FoundryRolls,
} from "../initiating-action-message";
import { D6ExplosiveAimController } from "./explosive-aim-controller";
import { currentSceneExplosiveTargets } from "./explosive-canvas";
import {
  createD6ExplosiveAttackThreadForDetonation,
  registerD6ExplosiveAttackThreadLifecycle,
} from "./explosive-attack-thread";
import {
  activeD6ExplosiveGm,
  assertD6ExplosiveCoordinatorAvailable,
  d6ExplosiveRegionState,
  requestD6ExplosiveMutation,
  type D6ExplosiveDeviationPresentationV1,
} from "./explosive-region";
import {
  currentD6ExplosiveThrowRanges,
  resolveD6ExplosivePlacement,
} from "./explosive-rules";
import {
  registerD6ExplosiveVisualizationLifecycle,
  revealD6ExplosiveVisualization,
} from "./explosive-visualization";

type ExplosiveActor = FoundryActorDocument;

type ExplosiveScatterRoll = FoundryRoll & {
  readonly formula: string;
};

interface EvaluatedExplosiveScatter {
  readonly direction: ExplosiveScatterRoll;
  readonly distance: ExplosiveScatterRoll;
  readonly plan: D6ExplosiveScatterPlan;
}

const aimController = new D6ExplosiveAimController();
const activeDetonations = new Map<string, Promise<unknown>>();
let activeRecovery: Promise<void> | undefined;
let recoveryCoordinatorId: string | undefined;
export const D6_EXPLOSIVE_REVEAL_MS = 900;

export async function beginD6ThrownExplosiveById(
  actorValue: object,
  itemId: string,
  options: D6ExplosiveBeginOptionsV1 = {},
): Promise<D6RollResultV1 | null> {
  const actor = actorValue as ExplosiveActor;
  const item = (
    actor.items as unknown as {
      get(id: string): FoundryItemDocument | undefined;
    }
  ).get(itemId);
  if (item?.type !== "weapon")
    throw new RangeError("D6E2.Explosive.Error.WeaponUnavailable");
  return beginD6ThrownExplosiveThrow(actor, item, options.roll ?? {}, options);
}

export function readD6ExplosiveRegion(value: object) {
  const state =
    "getFlag" in value
      ? d6ExplosiveRegionState(
          value as { getFlag(scope: string, key: string): unknown },
        )
      : null;
  return state
    ? Object.freeze({
        contractVersion: D6_EXPLOSIVE_WORKFLOW_CONTRACT_VERSION,
        rangeBand: state.range.band,
        requestId: state.requestId,
        status: state.status,
        timing: state.blastProfile.detonationTiming,
      })
    : null;
}

export async function cancelD6ExplosiveRegion(value: object): Promise<void> {
  const state =
    "getFlag" in value
      ? d6ExplosiveRegionState(
          value as { getFlag(scope: string, key: string): unknown },
        )
      : null;
  if (!state) throw new Error("D6E2.Explosive.Error.RegionMismatch");
  await deleteRegion(state);
}

export async function requestD6ExplosiveDetonation(
  value: object,
): Promise<void> {
  const state =
    "getFlag" in value
      ? d6ExplosiveRegionState(
          value as { getFlag(scope: string, key: string): unknown },
        )
      : null;
  if (!state) throw new Error("D6E2.Explosive.Error.RegionMismatch");
  await requestD6ExplosiveMutation({
    operation: "detonate",
    regionId: state.regionId,
    requestId: state.requestId,
    sceneId: state.sceneId,
  });
}

export async function beginD6ThrownExplosiveThrow(
  actor: ExplosiveActor,
  item: FoundryItemDocument,
  rollOptions: D6RollInvocationOptionsV1 = {},
  options: D6ExplosiveBeginOptionsV1 = {},
): Promise<D6RollResultV1 | null> {
  if (
    item.parent?.uuid !== actor.uuid ||
    stringValue(item.system.weaponKind) !== "thrown-explosive"
  )
    throw new RangeError("D6E2.Explosive.Error.WeaponUnavailable");
  if (!actor.uuid || !item.uuid)
    throw new RangeError("D6E2.Explosive.Error.WeaponUnavailable");
  const actorUuid = actor.uuid;
  const itemUuid = item.uuid;
  if (actor.isOwner !== true)
    throw new Error("D6E2.Explosive.Error.NotAuthorized");
  if (options.handling === "manual")
    return rollPlacedThrownExplosiveAttack(
      actor,
      item.id,
      undefined,
      rollOptions,
    );
  const profile = normalizeD6BlastProfile(item.system.blast);
  assertD6ExplosiveCoordinatorAvailable();
  const token = resolveThrowToken(actor, options.tokenId);
  const sceneId = canvas.scene?.id;
  if (!token || !sceneId) throw new Error("D6E2.Explosive.Error.TokenRequired");
  const origin = Object.freeze({ x: token.center.x, y: token.center.y });
  const ranges = currentD6ExplosiveThrowRanges(actor, item);
  const color = actor.getFlag("d6-system-2e", "themeColor");
  const visualColor =
    typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)
      ? color
      : "#65b9ff";
  const aim = await aimController.aim({
    blastProfile: profile,
    color: visualColor,
    origin,
    resolve: (distance) => resolveD6ExplosivePlacement(distance, ranges),
    targets: (point) => currentSceneExplosiveTargets(point, profile),
    title: `${item.name} · ${game.i18n.localize("D6E2.Explosive.PlaceBlast")}`,
  });
  if (!aim) return null;
  const requestId = crypto.randomUUID();
  const combat = (
    game as FoundryGame & {
      readonly combat?: { readonly id?: string; readonly round?: number };
    }
  ).combat;
  const created = await requestD6ExplosiveMutation({
    aim,
    operation: "create",
    request: {
      actorUuid,
      blastProfile: profile,
      ...(combat?.id ? { combatId: combat.id } : {}),
      itemUuid,
      origin,
      requestId,
      ...(combat?.round === undefined ? {} : { round: combat.round }),
      sceneId,
      tokenId: token.id,
      userId: game.user?.id ?? "",
      visualColor,
    },
  });
  let state = created as D6ExplosiveRegionStateV1;
  try {
    const outcome = await rollPlacedThrownExplosiveAttackWithMessage(
      actor,
      item.id,
      aimedPointContext(actor, item, state, state.difficulty),
      rollOptions,
    );
    if (!outcome) {
      await deleteRegion(state);
      return null;
    }
    const { message: attackMessage, result } = outcome;
    let resolvedPoint = aim.point;
    let scatter: D6ExplosiveScatterPlan | undefined;
    let evaluatedScatter: EvaluatedExplosiveScatter | undefined;
    if (result.success !== true) {
      evaluatedScatter = await rollScatter(state);
      scatter = evaluatedScatter.plan;
      resolvedPoint = scatterDestination(origin, aim.point, scatter);
    }
    const updated = await requestD6ExplosiveMutation({
      changes: {
        attackHit: result.success === true,
        attackMessageId: attackMessage.id,
        resolvedPoint,
        ...(scatter ? { scatter } : {}),
        status:
          profile.detonationTiming === "end-of-round" ? "armed" : "resolved",
      },
      expectedRevision: state.revision,
      operation: "update",
      regionId: state.regionId,
      requestId: state.requestId,
      sceneId: state.sceneId,
    });
    state = updated as D6ExplosiveRegionStateV1;
    await revealExplosiveState(state);
    if (evaluatedScatter) {
      await presentScatterAudit(
        state,
        evaluatedScatter,
        result.request.rollMode,
      );
    }
    if (profile.detonationTiming === "immediate")
      await requestD6ExplosiveMutation({
        operation: "detonate",
        regionId: state.regionId,
        requestId: state.requestId,
        sceneId: state.sceneId,
      });
    return result;
  } catch (error) {
    if (state.status === "aiming")
      await deleteRegion(state).catch(() => undefined);
    throw error;
  }
}

export async function detonateD6ExplosiveRegion(
  state: D6ExplosiveRegionStateV1,
): Promise<unknown> {
  const key = `${state.sceneId}:${state.requestId}`;
  const existing = activeDetonations.get(key);
  if (existing) return existing;
  const task = detonate(state).finally(() => activeDetonations.delete(key));
  activeDetonations.set(key, task);
  return task;
}

async function detonate(state: D6ExplosiveRegionStateV1): Promise<unknown> {
  if (canvas.scene?.id !== state.sceneId)
    throw new Error("D6E2.Explosive.Error.SceneUnavailable");
  const actor = (await fromUuid(state.actorUuid)) as ExplosiveActor | null;
  const item = (await fromUuid(state.itemUuid)) as FoundryItemDocument | null;
  if (!actor || !item || item.parent?.uuid !== actor.uuid)
    throw new Error("D6E2.Explosive.Error.WeaponUnavailable");
  const targets = currentSceneExplosiveTargets(
    state.resolvedPoint,
    state.blastProfile,
  );
  const publicTargets = targets.filter((target) => target.visible);
  const updated = (await requestD6ExplosiveMutation({
    changes: { affectedTargets: publicTargets, status: "resolved" },
    expectedRevision: state.revision,
    operation: "update",
    regionId: state.regionId,
    requestId: state.requestId,
    sceneId: state.sceneId,
  })) as D6ExplosiveRegionStateV1;
  await revealExplosiveState(updated);
  await waitForD6BlastReveal();
  const thread = await createD6ExplosiveAttackThreadForDetonation(
    updated,
    actor,
    item,
  );
  return Object.freeze({ requestId: state.requestId, thread });
}

function resolveThrowToken(
  actor: ExplosiveActor,
  tokenId?: string,
): (FoundryTokenPlaceable & { readonly center: D6CanvasPoint }) | null {
  const matches = (canvas.tokens?.placeables ?? []).filter(
    (
      token,
    ): token is FoundryTokenPlaceable & { readonly center: D6CanvasPoint } =>
      token.actor?.id === actor.id &&
      !token.isPreview &&
      token.center !== undefined,
  );
  if (tokenId) return matches.find((token) => token.id === tokenId) ?? null;
  const controlled = matches.filter((token) => token.controlled);
  if (controlled.length === 1) return controlled[0] ?? null;
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

function aimedPointContext(
  actor: ExplosiveActor,
  item: FoundryItemDocument,
  state: D6ExplosiveRegionStateV1,
  difficulty: number,
): RollTargetContext {
  const band = state.range.band ?? "long";
  const scale = Object.freeze({
    application: "attack" as const,
    family: "ranked" as const,
    modifierScore: 0,
    sourcePage: 0,
    sourceActorId: actor.id,
    sourceName: actor.name,
    sourceRank: 0,
    targetActorId: "",
    targetName: game.i18n.localize("D6E2.Explosive.AimedPoint"),
    targetRank: 0,
  });
  const target: RollTargetOption = Object.freeze({
    actorId: "",
    attackKind: "ranged",
    defense: difficulty,
    defenseKind: "range",
    defenseSourcePage:
      currentDefenseRuntimeStrategy().family === "active" ? 111 : 94,
    defenseStrategy:
      currentDefenseRuntimeStrategy().family === "active"
        ? "grenade-targeting"
        : "fixed-range",
    distance: state.range.distance,
    id: `aim:${state.requestId}`,
    img: "icons/svg/target.svg",
    name: game.i18n.localize("D6E2.Explosive.AimedPoint"),
    optionLabel: game.i18n.format("D6E2.Explosive.AimedPointSummary", {
      distance: state.range.distance.toFixed(1),
    }),
    outOfRange: false,
    purpose: "attack",
    rangeBand: band,
    rangeLabel: game.i18n.localize(
      band === "point-blank"
        ? "D6E2.Combat.Range.PointBlank"
        : band === "short"
          ? "D6E2.Combat.Range.Short"
          : band === "medium"
            ? "D6E2.Combat.Range.Medium"
            : "D6E2.Combat.Range.Long",
    ),
    scale,
    selected: true,
    weaponId: item.id,
  });
  return Object.freeze({
    hasAuthoritativeTargetDifficulty: true,
    hasTargets: true,
    purpose: "attack",
    selectedTarget: target,
    targets: Object.freeze([target]),
  });
}

async function rollScatter(
  state: D6ExplosiveRegionStateV1,
): Promise<EvaluatedExplosiveScatter> {
  const band = state.range.band ?? "long";
  const distanceDice = band === "medium" ? 2 : band === "long" ? 3 : 1;
  const directionDieSides = currentD6ExplosiveDeviationDieSides();
  const [direction, distance] = (await Promise.all([
    new Roll(`1d${directionDieSides}`).evaluate(),
    new Roll(`${distanceDice}d6`).evaluate(),
  ])) as [ExplosiveScatterRoll, ExplosiveScatterRoll];
  return Object.freeze({
    direction,
    distance,
    plan: planD6ExplosiveScatter({
      directionDie: direction.total,
      directionDieSides,
      distanceMeters: distance.total,
      rangeBand: band,
    }),
  });
}

export function currentD6ExplosiveDeviationDieSides(): 6 | 8 {
  return currentConfiguredRulesProfile().homebrew.tyfusiusD8ExplosiveDeviation
    ? 8
    : 6;
}

async function presentScatterAudit(
  state: D6ExplosiveRegionStateV1,
  scatter: EvaluatedExplosiveScatter,
  rollMode: D6RollResultV1["request"]["rollMode"],
): Promise<void> {
  try {
    const serialized = await serializeD6FoundryRolls([
      scatter.direction,
      scatter.distance,
    ]);
    await requestD6ExplosiveMutation({
      operation: "present-deviation",
      presentation: { rollMode, rolls: serialized },
      regionId: state.regionId,
      requestId: state.requestId,
      sceneId: state.sceneId,
    });
  } catch (error) {
    console.warn(`${SYSTEM_ID} | Could not publish explosive deviation`, error);
  }
}

export async function presentD6ExplosiveDeviation(
  state: D6ExplosiveRegionStateV1,
  presentation: D6ExplosiveDeviationPresentationV1,
): Promise<void> {
  if (state.attackHit !== false || !state.attackMessageId || !state.scatter) {
    throw new Error("D6E2.Explosive.Thread.AttackMessageMismatch");
  }
  const scene = game.scenes?.get(state.sceneId) as
    | (FoundrySceneDocument & {
        readonly regions?: {
          get(id: string):
            | {
                getFlag(scope: string, key: string): unknown;
                update(changes: Record<string, unknown>): Promise<unknown>;
              }
            | undefined;
        };
      })
    | undefined;
  const region = scene?.regions?.get(state.regionId);
  const message = (
    game as FoundryGame & {
      readonly messages?: {
        get(id: string): FoundryChatMessageDocument | undefined;
      };
    }
  ).messages?.get(state.attackMessageId);
  if (!region || !message)
    throw new Error("D6E2.Explosive.Thread.RegionMismatch");
  const attackRoll = message.getFlag(SYSTEM_ID, "roll") as
    { readonly request?: { readonly rollMode?: unknown } } | undefined;
  if (attackRoll?.request?.rollMode !== presentation.rollMode) {
    throw new Error("D6E2.ActionThread.AuthorityMismatch");
  }
  const artifacts = await hydrateD6FoundryRolls(presentation.rolls);
  const direction = artifacts[0];
  const distance = artifacts[1];
  const expectedDirectionFormula = `1d${state.scatter.directionDieSides ?? 6}`;
  const expectedDistanceFormula = `${state.scatter.distanceDice}d6`;
  if (
    artifacts.length !== 2 ||
    direction?.formula !== expectedDirectionFormula ||
    direction.total !== state.scatter.directionDie ||
    distance?.formula !== expectedDistanceFormula ||
    distance.total !== state.scatter.distanceMeters
  ) {
    throw new Error("D6E2.ActionThread.RollArtifactInvalid");
  }
  const current =
    parseD6InitiatingActionResultLedger(
      region.getFlag(SYSTEM_ID, D6_INITIATING_ACTION_RESULTS_FLAG),
    ) ?? createD6InitiatingActionResultLedger(message.id, state.requestId);
  const ledger = appendD6InitiatingActionResult(current, {
    appendId: `${state.requestId}:deviation`,
    details: {
      aimedPoint: pointLabel(state.aimedPoint),
      direction: directionName(state.scatter.directionDie),
      finalPoint: pointLabel(state.resolvedPoint),
    },
    kind: "explosive-deviation",
    rollMode: presentation.rollMode,
    rolls: presentation.rolls.map(({ evidence }) => evidence),
  });
  await region.update({
    [`flags.${SYSTEM_ID}.${D6_INITIATING_ACTION_RESULTS_FLAG}`]:
      structuredClone(ledger),
  });
  const entry = ledger.entries.find(
    ({ appendId }) => appendId === `${state.requestId}:deviation`,
  );
  if (!entry) throw new Error("D6E2.ActionThread.AuthorityMismatch");
  await appendD6InitiatingActionPresentation({
    artifacts,
    entry,
    ledger,
    message,
  });
}

function directionName(value: number): string {
  return (
    [
      "Forward",
      "ForwardRight",
      "Right",
      "Backward",
      "Left",
      "ForwardLeft",
      "BackwardLeft",
      "BackwardRight",
    ][value - 1] ?? "Forward"
  );
}

function pointLabel(point: D6CanvasPoint): string {
  return `${Math.round(point.x)}, ${Math.round(point.y)}`;
}

async function revealExplosiveState(
  state: D6ExplosiveRegionStateV1,
): Promise<void> {
  try {
    await revealD6ExplosiveVisualization(state);
  } catch (error) {
    console.warn(
      `${SYSTEM_ID} | Could not refresh explosive visualization`,
      error,
    );
  }
}

function scatterDestination(
  origin: D6CanvasPoint,
  aimed: D6CanvasPoint,
  scatter: D6ExplosiveScatterPlan,
): D6CanvasPoint {
  const dimensions = (
    canvas as unknown as {
      readonly dimensions?: {
        readonly size?: number;
        readonly distance?: number;
      };
    }
  ).dimensions;
  const pixelsPerMeter = (dimensions?.size ?? 1) / (dimensions?.distance ?? 1);
  const proposed = d6ExplosiveFinalPoint({
    aimedPoint: aimed,
    hit: false,
    origin,
    pixelsPerMeter,
    scatter,
  });
  const collision = (
    CONFIG as unknown as {
      Canvas?: {
        polygonBackends?: {
          move?: {
            testCollision(
              a: D6CanvasPoint,
              b: D6CanvasPoint,
              options: object,
            ): unknown;
          };
        };
      };
    }
  ).Canvas?.polygonBackends?.move?.testCollision(aimed, proposed, {
    mode: "closest",
    type: "move",
  });
  return collision &&
    typeof collision === "object" &&
    "x" in collision &&
    "y" in collision
    ? { x: Number(collision.x), y: Number(collision.y) }
    : proposed;
}

async function deleteRegion(state: D6ExplosiveRegionStateV1): Promise<void> {
  await requestD6ExplosiveMutation({
    operation: "delete",
    regionId: state.regionId,
    requestId: state.requestId,
    sceneId: state.sceneId,
  });
}

export function registerD6ExplosiveLifecycle(): void {
  registerD6ExplosiveVisualizationLifecycle();
  registerD6ExplosiveAttackThreadLifecycle();
  Hooks.on("updateCombat", (value: unknown) => {
    void detonateDueExplosives(
      value as { readonly id: string; readonly round?: number },
    );
  });
  Hooks.on("canvasReady", () => {
    recoveryCoordinatorId = activeD6ExplosiveGm()?.id;
    void runD6ExplosiveRecovery();
  });
  Hooks.on("updateUser", () => {
    const coordinatorId = activeD6ExplosiveGm()?.id;
    if (!coordinatorId || coordinatorId === recoveryCoordinatorId) return;
    recoveryCoordinatorId = coordinatorId;
    void runD6ExplosiveRecovery();
  });
  Hooks.on("deleteToken", (value: unknown) => {
    const token = value as {
      readonly id?: string;
      readonly parent?: { readonly id?: string };
    };
    if (token.id && token.parent?.id) {
      void retireExplosives(
        (state) =>
          state.sceneId === token.parent?.id && state.tokenId === token.id,
      );
    }
  });
  Hooks.on("deleteItem", (value: unknown) => {
    const item = value as { readonly uuid?: string };
    if (item.uuid)
      void retireExplosives((state) => state.itemUuid === item.uuid);
  });
  Hooks.on("deleteActor", (value: unknown) => {
    const actor = value as { readonly uuid?: string };
    if (actor.uuid)
      void retireExplosives((state) => state.actorUuid === actor.uuid);
  });
}

export async function recoverD6ExplosiveLifecycle(): Promise<void> {
  if (game.user?.isGM !== true || activeD6ExplosiveGm()?.id !== game.user.id)
    return;
  const currentSceneId = canvas.scene?.id;
  for (const state of [...allExplosiveStates()].sort(
    (left, right) =>
      left.sceneId.localeCompare(right.sceneId) ||
      left.requestId.localeCompare(right.requestId),
  )) {
    if (
      state.status === "aiming" ||
      state.status === "cancelled" ||
      state.status === "detonated"
    ) {
      await deleteRegion(state);
      continue;
    }
    if (state.status === "armed") {
      if (state.blastProfile.detonationTiming !== "end-of-round")
        await deleteRegion(state);
      continue;
    }
    if (
      state.blastProfile.detonationTiming === "immediate" &&
      state.sceneId === currentSceneId
    ) {
      await requestD6ExplosiveMutation({
        operation: "detonate",
        regionId: state.regionId,
        requestId: state.requestId,
        sceneId: state.sceneId,
      });
      continue;
    }
    // Resolved blasts on another Scene remain durable until that Scene is
    // active. The root ChatMessage ledger makes current-scene detonation
    // idempotent; recovery must never delete an unresolved attack thread.
  }
}

async function runD6ExplosiveRecovery(): Promise<void> {
  if (activeRecovery) return activeRecovery;
  const recovery = (async () => {
    try {
      await recoverD6ExplosiveLifecycle();
      const combat = (
        game as FoundryGame & {
          readonly combat?: { readonly id: string; readonly round?: number };
        }
      ).combat;
      if (combat) await detonateDueExplosives(combat);
    } catch (error) {
      console.error("D6 System | Explosive lifecycle recovery failed", error);
    }
  })();
  activeRecovery = recovery;
  try {
    await recovery;
  } finally {
    if (activeRecovery === recovery) activeRecovery = undefined;
  }
}

export async function waitForD6BlastReveal(): Promise<void> {
  await new Promise<void>((resolve) =>
    globalThis.setTimeout(resolve, D6_EXPLOSIVE_REVEAL_MS),
  );
}

async function detonateDueExplosives(combat: {
  readonly id: string;
  readonly round?: number;
}): Promise<void> {
  if (game.user?.isGM !== true || activeD6ExplosiveGm()?.id !== game.user.id)
    return;
  for (const state of allExplosiveStates()) {
    if (
      state.status === "armed" &&
      state.combatId === combat.id &&
      (combat.round ?? 0) > (state.round ?? 0)
    ) {
      await requestD6ExplosiveMutation({
        operation: "detonate",
        regionId: state.regionId,
        requestId: state.requestId,
        sceneId: state.sceneId,
      });
    }
  }
}

async function retireExplosives(
  predicate: (state: D6ExplosiveRegionStateV1) => boolean,
): Promise<void> {
  if (game.user?.isGM !== true || activeD6ExplosiveGm()?.id !== game.user.id)
    return;
  for (const state of allExplosiveStates().filter(predicate)) {
    await deleteRegion(state);
  }
}

function allExplosiveStates(): readonly D6ExplosiveRegionStateV1[] {
  return Object.freeze(
    (game.scenes?.contents ?? []).flatMap((scene) =>
      (
        (
          scene as FoundrySceneDocument & {
            readonly regions?: {
              readonly contents?: readonly {
                getFlag(scope: string, key: string): unknown;
              }[];
            };
          }
        ).regions?.contents ?? []
      ).flatMap((region) => {
        const state = d6ExplosiveRegionState(region);
        return state ? [state] : [];
      }),
    ),
  );
}
