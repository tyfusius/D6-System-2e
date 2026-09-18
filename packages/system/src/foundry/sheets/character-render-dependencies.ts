/** Only proven local dependencies narrow a native Actor update. Unknown fields,
 * whole-system replacements, permissions and embedded documents use a full render.
 * No previous context or document state is retained. */
export function characterUpdateParts(
  options: Record<string, unknown>,
): readonly string[] | null {
  if (
    options.isFirstRender !== false ||
    options.renderContext !== "updateActor"
  )
    return null;
  const paths: string[] = [];
  const visit = (value: unknown, prefix: string): void => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const entries = Object.entries(value);
      if (entries.length) {
        for (const [key, nested] of entries)
          visit(nested, prefix ? `${prefix}.${key}` : key);
        return;
      }
    }
    paths.push(prefix);
  };
  visit(options.renderData, "");
  const changed = paths.filter(
    (path) => path !== "_id" && !path.startsWith("_stats."),
  );
  return changed.length &&
    changed.every(
      (path) =>
        !path.includes("-=") &&
        (path.startsWith("system.health.") ||
          path.startsWith("system.movement.")),
    )
    ? ["header", "combat"]
    : null;
}
