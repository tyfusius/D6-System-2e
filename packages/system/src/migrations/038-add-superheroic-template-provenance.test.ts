import { describe, expect, it } from "vitest";
import { addSuperheroicTemplateProvenance } from "./038-add-superheroic-template-provenance";

describe("schema 38 Superheroic Template provenance", () => {
  it("adds defaults and preserves a normalized superheroic snapshot", () => {
    const source = {
      items: [],
      system: {
        creation: {
          active: true,
          template: {
            rulesFamily: "superheroic",
            superpowerCreationDice: 10,
            superpowerDefinitionIds: ["qa.flight", "qa.flight", "qa.armor"],
          },
        },
      },
      type: "character",
    };
    addSuperheroicTemplateProvenance(source);
    addSuperheroicTemplateProvenance(source);
    expect(source.system.creation.template).toMatchObject({
      rulesFamily: "superheroic",
      superpowerCreationDice: 10,
      superpowerDefinitionIds: ["qa.flight", "qa.armor"],
    });
  });
});
