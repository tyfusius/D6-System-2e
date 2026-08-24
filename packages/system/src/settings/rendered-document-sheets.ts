interface RenderedSheetWindow {
  readonly rendered: boolean;
  render(options?: boolean | Record<string, unknown>): unknown;
}

let refreshBatchDepth = 0;
const pendingSheetRefreshes = new Set<RenderedSheetWindow>();

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
    if (refreshBatchDepth > 0) {
      if (!pendingSheetRefreshes.has(application)) {
        pendingSheetRefreshes.add(application);
        refreshed += 1;
      }
    } else {
      application.render({ force: true });
      refreshed += 1;
    }
  }
  return refreshed;
}

/** Coalesce setting onChange refreshes until a complete settings save finishes. */
export async function batchRenderedDocumentSheetRefreshes<T>(
  operation: () => Promise<T>,
): Promise<T> {
  refreshBatchDepth += 1;
  try {
    return await operation();
  } finally {
    refreshBatchDepth -= 1;
    if (refreshBatchDepth === 0) {
      const pending = [...pendingSheetRefreshes];
      pendingSheetRefreshes.clear();
      for (const application of pending) {
        // A sheet closed during the save must not be reopened by the flush.
        if (isRenderedSheetWindow(application)) {
          application.render({ force: true });
        }
      }
    }
  }
}
