import { describe, expect, it, vi } from "vitest";
import {
  batchRenderedDocumentSheetRefreshes,
  refreshRenderedDocumentSheets,
} from "./rendered-document-sheets";

describe("rendered document sheet refresh", () => {
  it("refreshes only already rendered document-sheet applications", () => {
    const openActorSheet = { rendered: true, render: vi.fn() };
    const closedItemSheet = { rendered: false, render: vi.fn() };
    const unrelatedWindow = { rendered: true, render: vi.fn() };

    const refreshed = refreshRenderedDocumentSheets(
      {
        1: openActorSheet,
        2: closedItemSheet,
        3: unrelatedWindow,
      },
      (application) => application !== unrelatedWindow,
    );

    expect(refreshed).toBe(1);
    expect(openActorSheet.render).toHaveBeenCalledOnce();
    expect(openActorSheet.render).toHaveBeenCalledWith({ force: true });
    expect(closedItemSheet.render).not.toHaveBeenCalled();
    expect(unrelatedWindow.render).not.toHaveBeenCalled();
  });

  it("does nothing when no application windows exist", () => {
    expect(refreshRenderedDocumentSheets(undefined, () => true)).toBe(0);
  });

  it("keeps closed sheets closed and refreshes each open sheet once per settings save", async () => {
    const openActorSheet = { rendered: true, render: vi.fn() };
    const closedActorSheet = { rendered: false, render: vi.fn() };
    const windows = { 1: openActorSheet, 2: closedActorSheet };

    await batchRenderedDocumentSheetRefreshes(() => {
      refreshRenderedDocumentSheets(windows, () => true);
      refreshRenderedDocumentSheets(windows, () => true);
      expect(openActorSheet.render).not.toHaveBeenCalled();
      return Promise.resolve();
    });

    expect(openActorSheet.render).toHaveBeenCalledOnce();
    expect(openActorSheet.render).toHaveBeenCalledWith({ force: true });
    expect(closedActorSheet.render).not.toHaveBeenCalled();
  });

  it("does not reopen a queued sheet that closes before the save completes", async () => {
    const actorSheet = { rendered: true, render: vi.fn() };

    await batchRenderedDocumentSheetRefreshes(() => {
      refreshRenderedDocumentSheets({ 1: actorSheet }, () => true);
      actorSheet.rendered = false;
      return Promise.resolve();
    });

    expect(actorSheet.render).not.toHaveBeenCalled();
  });
});
