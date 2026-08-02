import { describe, expect, it } from "vitest";
import { addSuperheroicRelationships } from "./037-add-superheroic-relationships";

describe("schema 37 superheroic relationships", () => {
  it("adds idempotent defaults without replacing secret identity state", () => {
    const source = {
      type: "character",
      system: {
        creation: {},
        superheroic: { secretIdentity: { status: "active" } },
      },
    };
    addSuperheroicRelationships(source as never);
    addSuperheroicRelationships(source as never);
    expect(source).toMatchObject({
      system: {
        creation: { sidekick: false },
        superheroic: {
          relationships: {
            nemesisActive: false,
            nemesisPoints: 0,
            sidekickActive: false,
          },
          secretIdentity: { status: "active" },
        },
      },
    });
  });
});
