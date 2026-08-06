import { describe, expect, it } from "vitest";
import { addEditionAwareTemplateProvenance } from "./039-add-edition-aware-template-provenance";

describe("schema 39 edition-aware Character Template provenance", () => {
  it("upgrades legacy core provenance and preserves First Edition provenance", () => {
    const legacy = {
      items: [],
      system: { creation: { template: { rulesFamily: "core" } } },
      type: "character",
    };
    addEditionAwareTemplateProvenance(legacy);
    expect(legacy.system.creation.template.rulesFamily).toBe(
      "d6-system-second-edition",
    );

    const firstEdition = {
      items: [],
      system: {
        creation: {
          template: { rulesFamily: "open-d6-first-edition" },
        },
      },
      type: "character",
    };
    addEditionAwareTemplateProvenance(firstEdition);
    expect(firstEdition.system.creation.template.rulesFamily).toBe(
      "open-d6-first-edition",
    );
  });
});
