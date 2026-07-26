export type D6ParticipantKind =
  "player-character" | "non-player-character" | "unknown";

export type D6OpposedWinner = "actor" | "opponent" | "unresolved";

export type D6OpposedTieBreak =
  "none" | "player-over-npc" | "wild-die" | "gm-decision";

export interface D6OpposedEvaluation {
  readonly actorTotal: number;
  readonly margin: number;
  readonly opponentTotal: number;
  readonly tieBreak: D6OpposedTieBreak;
  readonly winner: D6OpposedWinner;
}

export interface D6OpposedEvaluationInput {
  readonly actorKind: D6ParticipantKind;
  readonly actorTotal: number;
  readonly actorWildFace?: number;
  readonly opponentKind: D6ParticipantKind;
  readonly opponentTotal: number;
  readonly opponentWildFace?: number;
}

function integer(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer.`);
  }
  return value;
}

function wildFace(
  value: number | undefined,
  label: string,
): number | undefined {
  if (value === undefined) return undefined;
  const valid = integer(value, label);
  if (valid < 1 || valid > 6) {
    throw new RangeError(`${label} must be between 1 and 6.`);
  }
  return valid;
}

export function evaluateOpposedRoll(
  input: D6OpposedEvaluationInput,
): D6OpposedEvaluation {
  const actorTotal = integer(input.actorTotal, "Actor total");
  const opponentTotal = integer(input.opponentTotal, "Opponent total");
  const actorWild = wildFace(input.actorWildFace, "Actor Wild Die");
  const opponentWild = wildFace(input.opponentWildFace, "Opponent Wild Die");
  const margin = actorTotal - opponentTotal;
  if (margin !== 0) {
    return Object.freeze({
      actorTotal,
      margin,
      opponentTotal,
      tieBreak: "none",
      winner: margin > 0 ? "actor" : "opponent",
    });
  }

  if (input.actorKind !== input.opponentKind) {
    if (input.actorKind === "player-character") {
      return Object.freeze({
        actorTotal,
        margin,
        opponentTotal,
        tieBreak: "player-over-npc",
        winner: "actor",
      });
    }
    if (input.opponentKind === "player-character") {
      return Object.freeze({
        actorTotal,
        margin,
        opponentTotal,
        tieBreak: "player-over-npc",
        winner: "opponent",
      });
    }
  }

  if (
    input.actorKind === "player-character" &&
    input.opponentKind === "player-character" &&
    actorWild !== undefined &&
    opponentWild !== undefined &&
    actorWild !== opponentWild
  ) {
    return Object.freeze({
      actorTotal,
      margin,
      opponentTotal,
      tieBreak: "wild-die",
      winner: actorWild > opponentWild ? "actor" : "opponent",
    });
  }

  return Object.freeze({
    actorTotal,
    margin,
    opponentTotal,
    tieBreak: "gm-decision",
    winner: "unresolved",
  });
}
