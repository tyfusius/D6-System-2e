import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(new URL("./character.ts", import.meta.url), "utf8");

describe("CharacterDataModel partial-update migration boundary", () => {
  it("does not expand an isolated sheet-mode update into default resources or health", async () => {
    class Field {
      readonly options: unknown[];

      constructor(...options: unknown[]) {
        this.options = options;
      }
    }
    class TypeDataModel {
      readonly stub = true;

      static migrateData(sourceData: object): object {
        return sourceData;
      }
    }
    vi.stubGlobal("foundry", {
      abstract: { TypeDataModel },
      data: {
        fields: {
          ArrayField: Field,
          BooleanField: Field,
          HTMLField: Field,
          NumberField: Field,
          SchemaField: Field,
          StringField: Field,
        },
      },
    });
    const { CharacterDataModel } = await import("./character");
    const partial = { sheetMode: { value: "normal" } };

    expect(CharacterDataModel.migrateData(structuredClone(partial))).toEqual(
      partial,
    );
  });

  it("does not add default resource siblings to an isolated balance update", async () => {
    const { CharacterDataModel } = await import("./character");
    const partial = { resources: { experiencePoints: { value: 37 } } };

    expect(CharacterDataModel.migrateData(structuredClone(partial))).toEqual(
      partial,
    );
  });

  it("only expands complete template provenance for complete Actor sources", () => {
    expect(source).toContain("const completeActorSource =");
    expect(source).toContain("if (!completeActorSource) return source;");
    expect(source).toMatch(
      /addCharacterTemplateState\([\s\S]*?addSuperheroicTemplateProvenance\(/u,
    );
  });
});
