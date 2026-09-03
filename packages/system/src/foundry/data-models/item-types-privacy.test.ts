import { describe, expect, it, vi } from "vitest";

describe("ranked feature privacy schema", () => {
  it("preserves the neutral private field through a Foundry-like schema projection", async () => {
    class Field {
      readonly options: readonly unknown[];

      constructor(...options: unknown[]) {
        this.options = options;
      }
    }
    class BooleanField extends Field {}
    class TypeDataModel {
      readonly stub = true;

      static migrateData(source: object): object {
        return source;
      }
    }
    vi.stubGlobal("foundry", {
      abstract: { TypeDataModel },
      data: {
        fields: {
          ArrayField: Field,
          BooleanField,
          HTMLField: Field,
          NumberField: Field,
          ObjectField: Field,
          SchemaField: Field,
          StringField: Field,
        },
      },
    });

    const { FlawDataModel, PerkDataModel, TalentDataModel } =
      await import("./item-types");
    for (const Model of [FlawDataModel, PerkDataModel, TalentDataModel]) {
      const schema = Model.defineSchema();
      const source = { private: true, rank: 2, strippedUnknown: "secret" };
      const projected = Object.fromEntries(
        Object.entries(source).filter(([key]) => key in schema),
      );

      expect(schema.private).toBeInstanceOf(BooleanField);
      expect(projected).toMatchObject({ private: true, rank: 2 });
      expect(projected).not.toHaveProperty("strippedUnknown");
      expect({ ...projected, rank: 3 }).toMatchObject({
        private: true,
        rank: 3,
      });
    }
  });
});
