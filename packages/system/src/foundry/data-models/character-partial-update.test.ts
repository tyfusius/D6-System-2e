import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./character.ts", import.meta.url), "utf8");

describe("CharacterDataModel partial-update migration boundary", () => {
  it("only expands complete template provenance for complete Actor sources", () => {
    expect(source).toContain("const completeActorSource =");
    expect(source).toMatch(
      /if \(completeActorSource\) \{\s+addCharacterTemplateState\(/u,
    );
    expect(source).toMatch(
      /addCharacterTemplateState\([\s\S]*?addSuperheroicTemplateProvenance\(/u,
    );
  });
});
