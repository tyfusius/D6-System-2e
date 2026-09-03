interface ItemDescriptionEnrichmentOptions {
  readonly relativeTo: object;
  readonly secrets: boolean;
}

type EnrichHtml = (
  html: string,
  options: ItemDescriptionEnrichmentOptions,
) => Promise<string>;

type CleanHtml = (html: string) => string;

export interface ItemDescriptionEditorElement extends Element {
  readonly value: unknown;
}

export async function enrichItemDescription(
  item: object,
  canViewSecrets: boolean,
  source: string,
  enrichHtml: EnrichHtml,
  cleanHtml: CleanHtml,
): Promise<Readonly<{ html: string; value: string }>> {
  const value = cleanHtml(source);
  const html = await enrichHtml(value, {
    relativeTo: item,
    secrets: canViewSecrets,
  });
  return Object.freeze({ html, value });
}

export function itemDescriptionEditorValue(root: ParentNode): string | null {
  const editor = root.querySelector<ItemDescriptionEditorElement>(
    'prose-mirror[data-d6e2-item-description-editor][name="system.description"]',
  );
  return editor && typeof editor.value === "string" ? editor.value : null;
}
