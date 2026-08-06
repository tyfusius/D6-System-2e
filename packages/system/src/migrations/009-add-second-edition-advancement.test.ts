import { describe, expect, it } from "vitest";
import type { ActorSource } from "@d6-system-2e/core";
import { addSecondEditionAdvancementFields } from "./009-add-second-edition-advancement";

function character(resources: Record<string, unknown>): ActorSource {
  return { items: [], system: { resources }, type: "character" };
}

describe("schema 9 Second Edition advancement fields", () => {
  it("adds a zero Experience Point balance while preserving unknown data", () => {
    const source = character({
      custom: { value: 7 },
      heroPoints: { value: 2 },
    });
    addSecondEditionAdvancementFields(source);
    expect(source.system.resources).toEqual({
      custom: { value: 7 },
      experiencePoints: { value: 0 },
      heroPoints: { value: 2 },
    });
  });

  it("preserves a valid balance and is idempotent", () => {
    const source = character({
      experiencePoints: { imported: true, value: 12 },
    });
    addSecondEditionAdvancementFields(source);
    const once = structuredClone(source);
    addSecondEditionAdvancementFields(source);
    expect(source).toEqual(once);
  });
});
