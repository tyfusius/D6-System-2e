import { requireDestinyValue } from "@d6-system-2e/core";
/** Native execution stores all original batches first, then each continuation
 * round in original-die order. Reconstruct the same groups without treating a
 * continuation as another original Wild Die. */
export function destinyOriginalWildGroups(
  count: number,
  batches: readonly (readonly number[])[],
): readonly (readonly number[])[] {
  if (!Number.isInteger(count) || count < 0 || count > batches.length)
    throw new Error("D6E2.Destiny.Error.RollEvidence");
  if (
    batches.some(
      (b) => !b.length || b.some((n) => !Number.isInteger(n) || n < 1 || n > 6),
    )
  )
    throw new Error("D6E2.Destiny.Error.RollEvidence");
  const groups = batches.slice(0, count).map((b) => [...b]);
  let index = count;
  while (index < batches.length) {
    let consumed = false;
    for (const group of groups)
      if (group.at(-1) === 6 && index < batches.length) {
        group.push(...requireDestinyValue(batches[index++]));
        consumed = true;
      }
    if (!consumed) throw new Error("D6E2.Destiny.Error.RollEvidence");
  }
  return groups;
}
