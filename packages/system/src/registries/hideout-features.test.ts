import { beforeEach, describe, expect, it } from "vitest";
import {
  hideoutFeatureRegistry,
  resetHideoutFeatureRegistryForTests,
} from "./hideout-features";

describe("hideout feature registry", () => {
  beforeEach(resetHideoutFeatureRegistryForTests);

  it("normalizes an owner-scoped lawful catalog", () => {
    hideoutFeatureRegistry.register("private-module", {
      entries: [
        {
          id: "private.feature",
          label: "Private feature",
          prerequisiteIds: ["private.required", "private.required"],
          repeatable: true,
          source: { book: "Owned source", page: 231 },
          version: 1,
        },
      ],
      id: "private.hideouts",
      label: "Private hideouts",
      version: 1,
    });
    expect(hideoutFeatureRegistry.current()[0]?.entries[0]).toMatchObject({
      prerequisiteIds: ["private.required"],
      repeatable: true,
    });
  });

  it("rejects collisions and invalid sources", () => {
    const catalog = {
      entries: [
        {
          id: "shared.feature",
          label: "Shared feature",
          source: { book: "Source", page: 231 },
          version: 1 as const,
        },
      ],
      id: "one.catalog",
      label: "One",
      version: 1 as const,
    };
    hideoutFeatureRegistry.register("owner-one", catalog);
    expect(() =>
      hideoutFeatureRegistry.register("owner-two", {
        ...catalog,
        id: "two.catalog",
      }),
    ).toThrow(/already exists/u);
    expect(() =>
      hideoutFeatureRegistry.register("bad", {
        entries: [
          {
            id: "bad.feature",
            label: "Bad feature",
            source: { book: "", page: 0 },
            version: 1,
          },
        ],
        id: "bad.catalog",
        label: "Bad",
        version: 1,
      }),
    ).toThrow();
  });
});
