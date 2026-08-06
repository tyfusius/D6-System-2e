import {
  D6_CHASE_CONTRACT_VERSION,
  type D6ChaseParticipantV1,
  type D6ChaseResolveV1,
  type D6ChaseRollV1,
  type D6ChaseSide,
  type D6ChaseStartV1,
  type D6ChaseStateV1,
} from "../contracts/chase";
import { evaluateOpposedRoll } from "./opposed";

const integer = (value: number, label: string): number => {
  if (!Number.isSafeInteger(value))
    throw new Error(`${label} must be a safe integer.`);
  return value;
};

const text = (value: string, label: string): string => {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
};

function participant(
  value: D6ChaseParticipantV1,
  label: string,
): D6ChaseParticipantV1 {
  return Object.freeze({
    actorId: text(value.actorId, `${label} actor`),
    actorName: text(value.actorName, `${label} actor name`),
    itemId: text(value.itemId, `${label} skill`),
    skillName: text(value.skillName, `${label} skill name`),
    kind: value.kind ?? "unknown",
  });
}

export function createD6Chase(input: D6ChaseStartV1): D6ChaseStateV1 {
  const pursuer = participant(input.pursuer, "Pursuer");
  const fleeing = participant(input.fleeing, "Fleeing participant");
  if (pursuer.actorId === fleeing.actorId) {
    throw new Error("A chase requires two different representative actors.");
  }
  const distance = integer(input.distance ?? 4, "Distance");
  if (distance < 1 || distance > 7) {
    throw new Error(
      "An active chase must start at a Distance from 1 through 7.",
    );
  }
  return Object.freeze({
    contractVersion: D6_CHASE_CONTRACT_VERSION,
    distance,
    exchange: 1,
    fleeing,
    history: Object.freeze([]),
    id: text(input.id, "Chase id"),
    label: text(input.label, "Chase label"),
    pursuer,
    revision: 0,
    rolls: Object.freeze({}),
    status: "active",
  });
}

export function submitD6ChaseRoll(
  state: D6ChaseStateV1,
  roll: D6ChaseRollV1,
  expectedRevision: number,
): D6ChaseStateV1 {
  if (state.status !== "active") throw new Error("This chase has ended.");
  if (state.revision !== expectedRevision)
    throw new Error("The chase changed; refresh and try again.");
  integer(roll.total, "Roll total");
  text(roll.requestId, "Roll request id");
  text(roll.userId, "Rolling user id");
  if (state.rolls[roll.side])
    throw new Error("That participant has already rolled this exchange.");
  if (
    Object.values(state.rolls).some(
      (entry) => entry.requestId === roll.requestId,
    )
  ) {
    return state;
  }
  return Object.freeze({
    ...state,
    revision: state.revision + 1,
    rolls: Object.freeze({
      ...state.rolls,
      [roll.side]: Object.freeze({ ...roll }),
    }),
  });
}

export function resolveD6ChaseExchange(
  state: D6ChaseStateV1,
  input: D6ChaseResolveV1,
): D6ChaseStateV1 {
  if (state.status !== "active") throw new Error("This chase has ended.");
  if (state.revision !== input.expectedRevision)
    throw new Error("The chase changed; refresh and try again.");
  const pursuerRoll = state.rolls.pursuer;
  const fleeingRoll = state.rolls.fleeing;
  if (!pursuerRoll || !fleeingRoll)
    throw new Error("Both chase participants must roll before resolution.");
  const opposed = evaluateOpposedRoll({
    actorKind: state.pursuer.kind ?? "unknown",
    actorTotal: pursuerRoll.total,
    ...(pursuerRoll.wildDieFace === undefined
      ? {}
      : { actorWildFace: pursuerRoll.wildDieFace }),
    opponentKind: state.fleeing.kind ?? "unknown",
    opponentTotal: fleeingRoll.total,
    ...(fleeingRoll.wildDieFace === undefined
      ? {}
      : { opponentWildFace: fleeingRoll.wildDieFace }),
  });
  const automaticWinner: D6ChaseSide | undefined =
    opposed.winner === "actor"
      ? "pursuer"
      : opposed.winner === "opponent"
        ? "fleeing"
        : undefined;
  const winner = input.winner ?? automaticWinner;
  if (!winner)
    throw new Error("The Gamemaster must break a tied opposed roll.");
  if (automaticWinner && input.winner && input.winner !== automaticWinner) {
    throw new Error("The selected winner does not have the higher total.");
  }
  const shift = input.exceptional === true ? 2 : 1;
  const signedShift = winner === "pursuer" ? -shift : shift;
  const distance = Math.max(0, Math.min(8, state.distance + signedShift));
  const status =
    distance === 0 ? "caught" : distance === 8 ? "escaped" : "active";
  const exchange = Object.freeze({
    exchange: state.exchange,
    exceptional: input.exceptional === true,
    fleeingTotal: fleeingRoll.total,
    fromDistance: state.distance,
    pursuerTotal: pursuerRoll.total,
    shift,
    toDistance: distance,
    tieBreak: opposed.tieBreak,
    winner,
    ...(pursuerRoll.wildOutcome
      ? { pursuerWildOutcome: pursuerRoll.wildOutcome }
      : {}),
    ...(fleeingRoll.wildOutcome
      ? { fleeingWildOutcome: fleeingRoll.wildOutcome }
      : {}),
  });
  return Object.freeze({
    ...state,
    distance,
    exchange: state.exchange + 1,
    history: Object.freeze([...state.history, exchange]),
    revision: state.revision + 1,
    rolls: Object.freeze({}),
    status,
  });
}
