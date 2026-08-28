export type D6HealthOutcomeTone =
  | "custom"
  | "dead"
  | "healthy"
  | "incapacitated"
  | "mortally-wounded"
  | "staggered"
  | "stunned"
  | "wounded";

/** One semantic projection for final Health text across initiating roots. */
export function d6HealthOutcomeTone(
  stateId: string | undefined,
): D6HealthOutcomeTone {
  switch (stateId) {
    case "healthy":
    case "staggered":
    case "stunned":
    case "incapacitated":
    case "mortally-wounded":
    case "dead":
      return stateId;
    case "severely-wounded":
    case "wounded":
      return "wounded";
    default:
      return "custom";
  }
}
