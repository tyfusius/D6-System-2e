import { describe, expect, it } from "vitest";
import {
  itemDescriptionExcerpt,
  usableItemDescription,
} from "./item-description";

describe("Item description presentation", () => {
  it("normalizes rich Item descriptions for tooltips and roll dialogs", () => {
    expect(
      itemDescriptionExcerpt(
        "<p><strong>Astrogation:</strong> Plot a safe hyperspace route.</p>",
      ),
    ).toBe("Astrogation: Plot a safe hyperspace route.");
  });

  it("rejects empty and legacy null-like descriptions", () => {
    for (const value of [null, undefined, "", " null ", "undefined"]) {
      expect(usableItemDescription(value)).toBe("");
      expect(itemDescriptionExcerpt(value)).toBe("");
    }
  });

  it("keeps roll-dialog excerpts bounded without exposing markup", () => {
    const excerpt = itemDescriptionExcerpt(
      `<p>${"Detailed specialization guidance. ".repeat(30)}</p>`,
      320,
    );
    expect(excerpt.length).toBeLessThanOrEqual(321);
    expect(excerpt).not.toContain("<p>");
  });
});
