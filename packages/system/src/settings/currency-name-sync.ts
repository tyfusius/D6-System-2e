interface CurrencyNames {
  readonly pluralName: string;
  readonly singularName: string;
}

export function synchronizedCurrencyPluralName(
  previous: CurrencyNames,
  singularName: string,
  pluralName: string,
  placeholders: readonly CurrencyNames[],
): string {
  if (
    singularName === previous.singularName ||
    pluralName !== previous.pluralName
  )
    return pluralName;
  const wasPlaceholder = placeholders.some(
    (placeholder) =>
      previous.singularName === placeholder.singularName &&
      previous.pluralName === placeholder.pluralName,
  );
  if (!wasPlaceholder) return pluralName;
  return singularName.endsWith("s") ? `${singularName}es` : `${singularName}s`;
}
