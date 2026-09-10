import {
  D6_DIFFICULTY_LADDER_SLOTS,
  type D6DifficultyLadderEntryV2,
} from "../contracts/rules-profiles";

export const isDefaultDifficultyId = (id: string): boolean =>
  (D6_DIFFICULTY_LADDER_SLOTS as readonly string[]).includes(id);

/** Validate writes before normalization so deletions and invalid edits cannot be hidden. */
export function difficultyScaleErrors(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return ["scale"];
  const errors = new Set<string>();
  const ids = new Set<string>();
  const values = new Map<number, string>();
  for (const raw of value as unknown[]) {
    const e =
      raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const id = typeof e.id === "string" ? e.id : "";
    if (!/^[a-z][a-z0-9-]*$/.test(id) || ids.has(id)) errors.add("scale");
    ids.add(id);
    if (typeof e.label !== "string" || !e.label.trim())
      errors.add(`${id}.label`);
    if (
      typeof e.value !== "number" ||
      !Number.isSafeInteger(e.value) ||
      e.value < 0
    )
      errors.add(`${id}.value`);
    else {
      const prior = values.get(e.value);
      if (prior !== undefined) {
        errors.add(`${prior}.value`);
        errors.add(`${id}.value`);
      }
      values.set(e.value, id);
    }
  }
  if (D6_DIFFICULTY_LADDER_SLOTS.some((id) => !ids.has(id)))
    errors.add("scale");
  return [...errors];
}

/** Reading/upgrading preserves historical numeric values, including ties and
 * invalid legacy anchors. Only explicit writes demand a valid unambiguous scale.
 */
export function normalizeDifficultyScale(
  value: unknown,
  defaults: readonly D6DifficultyLadderEntryV2[],
): readonly D6DifficultyLadderEntryV2[] {
  const raw: readonly unknown[] = Array.isArray(value) ? value : [];
  const entries = raw.map((v, index) => {
    const e = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
    const id = typeof e.id === "string" ? e.id : `legacy-${index + 1}`;
    const fallback = defaults.find((d) => d.id === id);
    return {
      id,
      label: typeof e.label === "string" ? e.label : (fallback?.label ?? ""),
      value:
        typeof e.value === "number"
          ? e.value
          : (fallback?.value ?? Number(e.value)),
    };
  });
  for (const fallback of defaults)
    if (!entries.some((e) => e.id === fallback.id))
      entries.push({ ...fallback });
  return Object.freeze(
    entries
      .sort((a, b) => a.value - b.value || a.id.localeCompare(b.id))
      .map((e) => Object.freeze(e)),
  );
}
