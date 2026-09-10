export interface D6AttributeInitiativeParticipant {
  readonly total: number | null;
  readonly primary?: number | undefined;
  readonly secondary?: number | undefined;
}

/** Compare full base pip scores lexicographically, never fractional additions
 * to the rolled total. Zero means retain the caller's existing stable order;
 * missing base attributes cannot be replaced with another attribute or zero.
 * Array-sort callers must supply the entire cohort: an incomplete comparison
 * preserves the affected tied subgroup, preventing pairwise fallback cycles. */
export function compareAttributeInitiative(
  left: D6AttributeInitiativeParticipant,
  right: D6AttributeInitiativeParticipant,
  cohort: readonly D6AttributeInitiativeParticipant[] = [left, right],
): number {
  if (left.total === null || right.total === null) {
    return left.total === right.total ? 0 : left.total === null ? 1 : -1;
  }
  if (left.total !== right.total) return right.total - left.total;
  let tied = cohort.filter((p) => p.total === left.total);
  for (const key of ["primary", "secondary"] as const) {
    const a = left[key];
    const b = right[key];
    if (tied.some((p) => !Number.isSafeInteger(p[key]) || Number(p[key]) < 0))
      return 0;
    if (a !== b) return Number(b) - Number(a);
    tied = tied.filter((p) => p[key] === a);
  }
  return 0;
}

/** Retained fixed Perception/Reflexes API. */
export interface D6BaseInitiativeParticipant {
  readonly total: number | null;
  readonly perception?: number | undefined;
  readonly reflexes?: number | undefined;
}
export function compareBaseInitiative(
  left: D6BaseInitiativeParticipant,
  right: D6BaseInitiativeParticipant,
  cohort: readonly D6BaseInitiativeParticipant[] = [left, right],
): number {
  const bind = (p: D6BaseInitiativeParticipant) => ({
    total: p.total,
    primary: p.perception,
    secondary: p.reflexes,
  });
  return compareAttributeInitiative(bind(left), bind(right), cohort.map(bind));
}
