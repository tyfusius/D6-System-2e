import { describe, expect, it } from "vitest";
import { addTemplateContainerContracts } from "./040-add-template-container-contracts";

describe("schema 40 specialized template container contracts", () => {
  it("adds stable defaults to legacy Item groups", () => {
    const source = { name: "Kit", system: {}, type: "item-group" };
    addTemplateContainerContracts(source);
    expect(source.system).toEqual({
      actorTypes: ["character", "creature", "npc"],
      members: [],
      rulesFamily: "both",
    });
  });

  it("preserves valid species bounds and explicit rules family", () => {
    const bounds = [{ attributeId: "brawn", maximum: 18, minimum: 6 }];
    const source = {
      name: "Species",
      system: {
        attributeBounds: bounds,
        rulesFamily: "open-d6-first-edition",
      },
      type: "species-template",
    };
    addTemplateContainerContracts(source);
    expect(source.system).toMatchObject({
      attributeBounds: bounds,
      members: [],
      rulesFamily: "open-d6-first-edition",
    });
  });

  it("ignores unrelated Items", () => {
    const source = { name: "Rope", system: { quantity: 1 }, type: "gear" };
    addTemplateContainerContracts(source);
    expect(source.system).toEqual({ quantity: 1 });
  });
});
