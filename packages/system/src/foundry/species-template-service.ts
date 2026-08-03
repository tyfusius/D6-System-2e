function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function actorAttributeBounds(
  actor: FoundryActorDocument,
  attributeId: string,
): Readonly<{ minimum: number; maximum: number }> {
  const species = actor.items.contents.find(
    (candidate) => candidate.type === "species-template",
  );
  const entries = Array.isArray(species?.system.attributeBounds)
    ? species.system.attributeBounds
    : [];
  const stored = entries
    .map(record)
    .find((entry) => entry.attributeId === attributeId);
  const minimum = Number(stored?.minimum);
  const maximum = Number(stored?.maximum);
  if (
    Number.isSafeInteger(minimum) &&
    Number.isSafeInteger(maximum) &&
    minimum >= 0 &&
    maximum >= minimum &&
    maximum <= 60
  ) {
    return Object.freeze({ minimum, maximum });
  }
  return Object.freeze({ minimum: 3, maximum: 15 });
}
