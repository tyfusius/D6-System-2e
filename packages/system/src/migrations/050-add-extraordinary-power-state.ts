import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stableEntries(value: unknown): Record<string, string> {
  const source = record(value) ?? {};
  return Object.fromEntries(
    Object.entries(source).flatMap(([key, entry]) =>
      key.trim() && typeof entry === "string" && entry.trim()
        ? [[key.trim(), entry.trim()]]
        : [],
    ),
  );
}

function numericEntries(value: unknown): Record<string, number> {
  const source = record(value) ?? {};
  return Object.fromEntries(
    Object.entries(source).flatMap(([key, entry]) =>
      key.trim() && Number.isSafeInteger(entry) && Number(entry) >= 0
        ? [[key.trim(), Number(entry)]]
        : [],
    ),
  );
}

export function addExtraordinaryPowerState(source: ActorSource): void {
  if (!["character", "creature", "npc"].includes(source.type)) return;
  const current = record(source.system.extraordinaryPowers) ?? {};
  const frameworks = record(current.frameworks) ?? {};
  source.system.extraordinaryPowers = {
    ...current,
    frameworks: Object.fromEntries(
      Object.entries(frameworks).flatMap(([frameworkId, value]) => {
        if (!frameworkId.trim()) return [];
        const framework = record(value) ?? {};
        const maintainedPowerIds = Array.isArray(framework.maintainedPowerIds)
          ? [
              ...new Set(
                framework.maintainedPowerIds.flatMap((entry) =>
                  typeof entry === "string" && entry.trim()
                    ? [entry.trim()]
                    : [],
                ),
              ),
            ]
          : [];
        return [
          [
            frameworkId.trim(),
            {
              ...framework,
              consequenceValues: numericEntries(framework.consequenceValues),
              maintainedPowerIds,
              powerBindings: stableEntries(framework.powerBindings),
              skillBindings: stableEntries(framework.skillBindings),
            },
          ],
        ];
      }),
    ),
  };
}

export const addExtraordinaryPowerStateMigration: Migration = Object.freeze({
  name: "Add extraordinary-power runtime state",
  updateActor: addExtraordinaryPowerState,
  version: 50,
});
