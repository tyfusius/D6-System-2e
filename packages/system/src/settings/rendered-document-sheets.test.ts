import { describe, expect, it, vi } from "vitest";
import { refreshRenderedDocumentSheets } from "./rendered-document-sheets";

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
});
