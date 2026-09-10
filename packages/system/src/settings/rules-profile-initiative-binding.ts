import type { D6InitiativeBaseTiesV1 } from "@d6-system-2e/core";

/** Ordered optional migration: V0 absence stays absent; V1 normalizes
 * idempotently. Never reinterpret or erase an explicit unsupported version. */
export function normalizeInitiativeBaseTies(
  value: unknown,
): D6InitiativeBaseTiesV1 | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Invalid initiative base tie binding.");
  const source = value as Record<string, unknown>;
  if (source.version !== 1)
    throw new TypeError("Unsupported initiative base tie binding version.");
  if (
    typeof source.secondaryAttributeId !== "string" ||
    !/^[a-z][a-z0-9-]*$/u.test(source.secondaryAttributeId)
  )
    throw new TypeError("Invalid initiative secondary Attribute ID.");
  return Object.freeze({
    version: 1,
    secondaryAttributeId: source.secondaryAttributeId,
  });
}
