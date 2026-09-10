import {
  normalizeDifficultyScale,
  type D6DifficultyLadderEntryV2,
} from "@d6-system-2e/core";
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

/** Ordered settings migrations; document schema/compendium payloads are unrelated. */
export const RULES_PROFILE_SETTING_MIGRATIONS = Object.freeze([
  {
    version: 5,
    migrate(
      value: Record<string, unknown>,
      defaults: readonly D6DifficultyLadderEntryV2[],
    ) {
      return {
        ...value,
        profiles: Object.fromEntries(
          Object.entries(record(value.profiles)).map(([id, raw]) => {
            const profile = record(raw);
            return [
              id,
              {
                ...profile,
                difficultyLadder: normalizeDifficultyScale(
                  profile.difficultyLadder,
                  defaults,
                ),
                version: 5,
              },
            ];
          }),
        ),
        version: 5,
      };
    },
  },
]);

export function migrateRulesProfileSettings(
  value: unknown,
  defaults: readonly D6DifficultyLadderEntryV2[],
): Record<string, unknown> {
  let result = structuredClone(record(value));
  const version = Number(result.version) || 1;
  if (version > 5)
    throw new TypeError("Unsupported future Rules Profile setting version.");
  for (const migration of RULES_PROFILE_SETTING_MIGRATIONS)
    if (Number(result.version ?? 1) < migration.version)
      result = migration.migrate(result, defaults);
  return result;
}
