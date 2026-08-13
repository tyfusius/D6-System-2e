import { extraordinaryPowerFrameworkRegistry } from "../registries/extraordinary-powers";
import { record } from "./sheets/values";

export interface ExtraordinaryPowerMaintenancePenalty {
  readonly count: number;
  readonly score: number;
}

export function extraordinaryPowerMaintenancePenalty(
  actor: FoundryActorDocument,
): ExtraordinaryPowerMaintenancePenalty {
  const storedFrameworks = record(
    record(actor.system.extraordinaryPowers).frameworks,
  );
  let count = 0;
  for (const framework of extraordinaryPowerFrameworkRegistry.current()) {
    const stored = record(storedFrameworks[framework.id]);
    const maintained = new Set(
      Array.isArray(stored.maintainedPowerIds)
        ? stored.maintainedPowerIds.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
    );
    count += framework.powers.filter(
      ({ id, maintenance }) =>
        maintenance === "active-toggle" && maintained.has(id),
    ).length;
  }
  return Object.freeze({ count, score: count * 3 });
}
