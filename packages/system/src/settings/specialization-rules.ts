import { SYSTEM_ID } from "../constants";
import { SECOND_EDITION_OPTION_KEYS } from "./settings-catalog";

/**
 * Resolve the optional fixed per-Skill Specialization cap.
 *
 * Zero preserves the printed phase-specific limits: three total creation
 * slots and, after creation, no more Specializations than the Skill's rating.
 */
export function configuredSpecializationsPerSkillLimit(): number | null {
  const stored = game.settings.get(
    SYSTEM_ID,
    SECOND_EDITION_OPTION_KEYS.specializationsPerSkillLimit,
  );
  const limit = typeof stored === "number" ? Math.trunc(stored) : 0;
  return limit > 0 ? Math.min(limit, 20) : null;
}
