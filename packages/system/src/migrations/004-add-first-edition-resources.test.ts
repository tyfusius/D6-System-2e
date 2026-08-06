import { describe, expect, it } from "vitest";
import type { ActorSource } from "@d6-system-2e/core";
import { addFirstEditionResourceFields } from "./004-add-first-edition-resources";

function character(resources: Record<string, unknown>): ActorSource {
  return {
    items: [],
    system: { resources },
    type: "character",
  };
}

describe("First Edition resource migration", () => {
  it("adds latent Character Point and Fate Point fields", () => {
    const source = character({ heroPoints: { value: 3 } });
    addFirstEditionResourceFields(source);
    expect(source.system.resources).toEqual({
      characterPoints: { value: 5 },
      fatePoints: { value: 1 },
      heroPoints: { value: 3 },
    });
  });

  it("preserves existing and unknown resource data", () => {
    const source = character({
      characterPoints: { imported: true, value: 8 },
      custom: { value: 99 },
      fatePoints: { value: 2 },
    });
    addFirstEditionResourceFields(source);
    expect(source.system.resources).toEqual({
      characterPoints: { imported: true, value: 8 },
      custom: { value: 99 },
      fatePoints: { value: 2 },
    });
  });

  it("is idempotent", () => {
    const source = character({});
    addFirstEditionResourceFields(source);
    const once = structuredClone(source);
    addFirstEditionResourceFields(source);
    expect(source).toEqual(once);
  });
});
