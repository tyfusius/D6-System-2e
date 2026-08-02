import {
  firstEditionMovementPlan,
  secondEditionMovementPlan,
  type FirstEditionMovementType,
  type SecondEditionMovementMode,
} from "@d6-system-2e/core";
import { currentEditionCapabilityProfile } from "../settings/edition-capabilities";
import { readActorEnvironmentEffect } from "./environment-state";
import {
  completeNextCombatantAction,
  readCombatantRound,
} from "./combat-service";
import { resolveFirstEditionActorMovement } from "./first-edition-movement-service";

export interface D6CanvasPoint {
  readonly x: number;
  readonly y: number;
}

interface MovementTokenDocument {
  readonly x: number;
  readonly y: number;
  update(changes: Record<string, unknown>): Promise<unknown>;
}

export type MovementToken = FoundryTokenPlaceable & {
  readonly center: D6CanvasPoint;
  readonly document: NonNullable<FoundryTokenPlaceable["document"]> &
    MovementTokenDocument;
};

export type ActorTokenMovementRequest = Readonly<{
  destination: D6CanvasPoint;
  expectedRevision?: number;
  mode?: Exclude<SecondEditionMovementMode, "hold" | "stand">;
  terrainModifier?: number;
  tokenId?: string;
  type?: FirstEditionMovementType;
}>;

export interface ActorTokenMovementPreview {
  readonly blocked: boolean;
  readonly canMove: boolean;
  readonly destination: D6CanvasPoint;
  readonly distance: number;
  readonly maximumDistance: number;
  readonly token: MovementToken;
}

export interface ActorTokenMovementResult extends ActorTokenMovementPreview {
  readonly moved: boolean;
  readonly movementSucceeded: boolean;
}

function actorDocument(value: object): FoundryActorDocument {
  const actor = value as Partial<FoundryActorDocument>;
  if (typeof actor.id !== "string" || typeof actor.name !== "string") {
    throw new TypeError("Token movement requires a Foundry Actor.");
  }
  if (actor.isOwner !== true && game.user?.isGM !== true) {
    throw new Error("D6E2.Combat.Error.NotAuthorized");
  }
  return actor as FoundryActorDocument;
}

function finitePoint(value: D6CanvasPoint): D6CanvasPoint {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new RangeError("D6E2.Movement.Error.InvalidDestination");
  }
  return Object.freeze({ x: value.x, y: value.y });
}

function movementTokens(actor: FoundryActorDocument): readonly MovementToken[] {
  return (canvas.tokens?.placeables ?? []).filter(
    (token): token is MovementToken =>
      token.actor?.id === actor.id &&
      token.isPreview !== true &&
      typeof token.center?.x === "number" &&
      typeof token.center.y === "number" &&
      typeof (token.document as MovementTokenDocument | undefined)?.update ===
        "function",
  );
}

export function resolveActorMovementToken(
  actorValue: object,
  tokenId?: string,
): MovementToken {
  const actor = actorDocument(actorValue);
  const tokens = movementTokens(actor);
  if (tokenId) {
    const selected = tokens.find((token) => token.id === tokenId);
    if (!selected) throw new Error("D6E2.Movement.Error.TokenMissing");
    return selected;
  }
  const controlled = tokens.filter((token) => token.controlled === true);
  const onlyControlled = controlled.at(0);
  if (controlled.length === 1 && onlyControlled) return onlyControlled;
  const onlyToken = tokens.at(0);
  if (tokens.length === 1 && onlyToken) return onlyToken;
  throw new Error(
    tokens.length === 0
      ? "D6E2.Movement.Error.TokenMissing"
      : "D6E2.Movement.Error.TokenAmbiguous",
  );
}

function collision(origin: D6CanvasPoint, destination: D6CanvasPoint): boolean {
  const backend = (
    CONFIG as unknown as {
      readonly Canvas?: {
        readonly polygonBackends?: {
          readonly move?: {
            testCollision(
              origin: D6CanvasPoint,
              destination: D6CanvasPoint,
              options: Record<string, unknown>,
            ): unknown;
          };
        };
      };
    }
  ).Canvas?.polygonBackends?.move;
  return (
    backend?.testCollision(origin, destination, {
      mode: "any",
      type: "move",
    }) === true
  );
}

function firstEditionHasSkill(
  actor: FoundryActorDocument,
  type: FirstEditionMovementType,
): boolean {
  const key = {
    climb: "climb-jump",
    fly: "flying-zero-g",
    land: "running",
    swim: "swim",
  }[type];
  return actor.items.contents.some(
    (item) => item.type === "skill" && item.system.key === key,
  );
}

export function previewActorTokenMovement(
  actorValue: object,
  request: ActorTokenMovementRequest,
): ActorTokenMovementPreview {
  const actor = actorDocument(actorValue);
  const token = resolveActorMovementToken(actor, request.tokenId);
  const destination = finitePoint(request.destination);
  const grid = canvas.grid;
  if (!grid) throw new Error("D6E2.Movement.Error.CanvasUnavailable");
  const distance = grid.measurePath([token.center, destination]).distance;
  const capabilities = currentEditionCapabilityProfile();
  const strategy = capabilities.movement.strategy;
  let maximumDistance = 0;
  if (strategy === "second-edition-segment-movement") {
    if (!request.mode) throw new Error("D6E2.Movement.Error.ModeRequired");
    const posture =
      (actor.system.movement as { readonly posture?: unknown } | undefined)
        ?.posture === "prone"
        ? "prone"
        : "standing";
    const plan = secondEditionMovementPlan(request.mode, posture);
    maximumDistance = plan.maximumDistance;
    if (
      capabilities.environments.state === "active" &&
      readActorEnvironmentEffect(actor)?.halfMove === true
    ) {
      maximumDistance /= 2;
    }
    const round = readCombatantRound(actor);
    if (
      round &&
      (round.currentAction?.kind !== "move" ||
        round.currentAction.movementMode !== request.mode)
    ) {
      throw new Error("D6E2.Movement.Error.CurrentActionMismatch");
    }
    if (round && request.expectedRevision !== round.revision) {
      throw new Error("D6E2.Combat.Error.RevisionConflict");
    }
  } else if (strategy === "open-d6-relative-movement") {
    if (!request.type) throw new Error("D6E2.Movement.Error.TypeRequired");
    const baseMove = Math.max(
      1,
      Math.trunc(
        Number(
          (actor.system.movement as { readonly base?: unknown } | undefined)
            ?.base,
        ) || 1,
      ),
    );
    maximumDistance = firstEditionMovementPlan({
      baseMove,
      distance: 0,
      hasMovementSkill: firstEditionHasSkill(actor, request.type),
      ...(request.terrainModifier === undefined
        ? {}
        : { terrainModifier: request.terrainModifier }),
      type: request.type,
    }).maximumDistance;
  } else {
    throw new Error("D6E2.Movement.Error.StrategyInactive");
  }
  const blocked = collision(token.center, destination);
  return Object.freeze({
    blocked,
    canMove: !blocked && distance <= maximumDistance,
    destination,
    distance,
    maximumDistance,
    token,
  });
}

async function updateTokenCenter(
  token: MovementToken,
  destination: D6CanvasPoint,
): Promise<void> {
  const offsetX = token.center.x - token.document.x;
  const offsetY = token.center.y - token.document.y;
  await token.document.update({
    x: destination.x - offsetX,
    y: destination.y - offsetY,
  });
}

export async function moveActorToken(
  actorValue: object,
  request: ActorTokenMovementRequest,
): Promise<ActorTokenMovementResult> {
  const actor = actorDocument(actorValue);
  const preview = previewActorTokenMovement(actor, request);
  if (preview.blocked) throw new Error("D6E2.Movement.Error.Blocked");
  if (!preview.canMove) throw new Error("D6E2.Movement.Error.TooFar");
  const strategy = currentEditionCapabilityProfile().movement.strategy;
  if (strategy === "open-d6-relative-movement") {
    const type = request.type;
    if (!type) throw new Error("D6E2.Movement.Error.TypeRequired");
    const baseMove = Math.max(
      1,
      Math.trunc(
        Number(
          (actor.system.movement as { readonly base?: unknown } | undefined)
            ?.base,
        ) || 1,
      ),
    );
    const resolution = await resolveFirstEditionActorMovement(actor, {
      baseMove,
      distance: preview.distance,
      ...(request.expectedRevision === undefined
        ? {}
        : { expectedRevision: request.expectedRevision }),
      terrainModifier: request.terrainModifier ?? 0,
      type,
    });
    if (!resolution.completed || !resolution.successful) {
      return Object.freeze({
        ...preview,
        moved: false,
        movementSucceeded: resolution.successful,
      });
    }
    await updateTokenCenter(preview.token, preview.destination);
    return Object.freeze({ ...preview, moved: true, movementSucceeded: true });
  }
  const round = readCombatantRound(actor);
  const originDocument = Object.freeze({
    x: preview.token.document.x,
    y: preview.token.document.y,
  });
  await updateTokenCenter(preview.token, preview.destination);
  if (round) {
    try {
      await completeNextCombatantAction(actor, round.revision);
    } catch (error) {
      await preview.token.document.update(originDocument);
      throw error;
    }
  }
  return Object.freeze({ ...preview, moved: true, movementSucceeded: true });
}
