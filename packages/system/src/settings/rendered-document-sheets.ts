interface RenderedSheetWindow {
  readonly rendered: boolean;
  render(options?: boolean | Record<string, unknown>): unknown;
}

function isRenderedSheetWindow(value: unknown): value is RenderedSheetWindow {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<RenderedSheetWindow>;
  return candidate.rendered === true && typeof candidate.render === "function";
}

export function refreshRenderedDocumentSheets(
  windows: Readonly<Record<number, unknown>> | undefined,
  isDocumentSheet: (application: unknown) => boolean,
): number {
  let refreshed = 0;
  for (const application of Object.values(windows ?? {})) {
    if (!isDocumentSheet(application) || !isRenderedSheetWindow(application)) {
      continue;
    }
    application.render({ force: true });
    refreshed += 1;
  }
  return refreshed;
}
