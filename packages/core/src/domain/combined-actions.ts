export interface D6CombinedActionCandidate {
  readonly actorId: string;
  readonly actorName: string;
  readonly commandScore: number;
  readonly commandTrained: boolean;
  readonly perceptionScore: number;
  readonly taskScore: number;
}

export interface D6CombinedActionRoles {
  readonly capacity: number;
  readonly leader: D6CombinedActionCandidate;
  readonly leaderScore: number;
  readonly primaryWorker: D6CombinedActionCandidate;
}

export interface D6CombinedActionBonus {
  readonly commandMargin: number;
  readonly commandSucceeded: boolean;
  readonly finalBonusScore: number;
  readonly potentialBonusScore: number;
}

function score(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function combinedActionLeaderScore(
  candidate: D6CombinedActionCandidate,
): number {
  return score(
    candidate.commandTrained
      ? candidate.commandScore
      : candidate.perceptionScore,
  );
}

export function combinedActionRoles(
  candidates: readonly D6CombinedActionCandidate[],
): D6CombinedActionRoles {
  if (candidates.length < 2) {
    throw new RangeError("A combined action requires at least two characters.");
  }
  const ordered = [...candidates].sort(
    (left, right) =>
      combinedActionLeaderScore(right) - combinedActionLeaderScore(left) ||
      score(right.taskScore) - score(left.taskScore) ||
      left.actorName.localeCompare(right.actorName, undefined, {
        numeric: true,
        sensitivity: "base",
      }) ||
      left.actorId.localeCompare(right.actorId),
  );
  const primary = [...candidates].sort(
    (left, right) =>
      score(right.taskScore) - score(left.taskScore) ||
      left.actorName.localeCompare(right.actorName, undefined, {
        numeric: true,
        sensitivity: "base",
      }) ||
      left.actorId.localeCompare(right.actorId),
  )[0];
  const leader = ordered[0];
  if (!leader || !primary)
    throw new RangeError("Combined-action roles failed.");
  const leaderScore = combinedActionLeaderScore(leader);
  return Object.freeze({
    capacity: Math.floor(leaderScore / 3),
    leader,
    leaderScore,
    primaryWorker: primary,
  });
}

export function combinedActionBonus(
  participantCount: number,
  commandTotal: number,
  difficulty: number,
): D6CombinedActionBonus {
  const count = Math.max(0, Math.trunc(participantCount));
  if (count < 2) {
    throw new RangeError("A combined action requires at least two characters.");
  }
  const total = Math.trunc(commandTotal);
  const target = Math.max(0, Math.trunc(difficulty));
  const commandMargin = total - target;
  const potentialBonusScore = count;
  return Object.freeze({
    commandMargin,
    commandSucceeded: commandMargin >= 0,
    finalBonusScore: Math.max(
      0,
      potentialBonusScore - Math.max(0, -commandMargin) * 3,
    ),
    potentialBonusScore,
  });
}

export function validateCombinedActionAllocation(
  finalBonusScore: number,
  allocations: readonly number[],
): readonly number[] {
  const available = score(finalBonusScore);
  const normalized = allocations.map(score);
  if (normalized.reduce((total, value) => total + value, 0) !== available) {
    throw new RangeError(
      "Combined-action allocations must use the complete available bonus.",
    );
  }
  return Object.freeze(normalized);
}
