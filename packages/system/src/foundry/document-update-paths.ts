/** Match native expanded or flattened update data, including deletion syntax.
 * Unknown/whole-document replacements conservatively request synchronization. */
export function documentUpdateTouches(
  changes: unknown,
  paths: readonly string[],
): boolean {
  if (!changes || typeof changes !== "object" || Array.isArray(changes))
    return true;
  const visit = (value: unknown, prefix: string): boolean => {
    if (paths.some((path) => prefix === path || prefix.startsWith(`${path}.`)))
      return true;
    if (!paths.some((path) => path.startsWith(`${prefix}.`) || prefix === ""))
      return false;
    if (!value || typeof value !== "object" || Array.isArray(value))
      return true;
    const entries = Object.entries(value);
    if (!entries.length) return prefix !== "";
    return entries.some(([key, nested]) =>
      visit(
        nested,
        [
          prefix,
          key
            .split(".")
            .map((part) => (part.startsWith("-=") ? part.slice(2) : part))
            .join("."),
        ]
          .filter(Boolean)
          .join("."),
      ),
    );
  };
  return visit(changes, "");
}
