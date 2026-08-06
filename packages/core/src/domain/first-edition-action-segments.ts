export interface FirstEditionSegmentParticipant {
  readonly actionCount: number;
  readonly combatantId: string;
  readonly declared: boolean;
  readonly label: string;
  readonly spentActionCount: number;
}

export interface FirstEditionSegmentPlan {
  readonly complete: boolean;
  readonly currentSegment: number;
  readonly nextCombatantId?: string;
  readonly nextLabel?: string;
  readonly ready: boolean;
  readonly waitingCombatantIds: readonly string[];
  readonly waitingLabels: readonly string[];
}

export function firstEditionSegmentPlan(
  participants: readonly FirstEditionSegmentParticipant[],
): FirstEditionSegmentPlan {
  const waiting = participants.filter((participant) => !participant.declared);
  if (waiting.length > 0) {
    return Object.freeze({
      complete: false,
      currentSegment: 1,
      ready: false,
      waitingCombatantIds: Object.freeze(
        waiting.map((participant) => participant.combatantId),
      ),
      waitingLabels: Object.freeze(
        waiting.map((participant) => participant.label),
      ),
    });
  }

  const maximum = Math.max(
    0,
    ...participants.map((participant) => participant.actionCount),
  );
  for (let segment = 1; segment <= maximum; segment += 1) {
    const next = participants.find(
      (participant) =>
        participant.actionCount >= segment &&
        participant.spentActionCount < segment,
    );
    if (next) {
      return Object.freeze({
        complete: false,
        currentSegment: segment,
        nextCombatantId: next.combatantId,
        nextLabel: next.label,
        ready: true,
        waitingCombatantIds: Object.freeze([]),
        waitingLabels: Object.freeze([]),
      });
    }
  }

  return Object.freeze({
    complete: true,
    currentSegment: maximum,
    ready: true,
    waitingCombatantIds: Object.freeze([]),
    waitingLabels: Object.freeze([]),
  });
}
