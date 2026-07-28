import type { AdvancementKind } from "../domain/advancement";

export interface D6AdvancementResultV1 {
  readonly cost: number;
  readonly kind: AdvancementKind;
  readonly remaining: number;
  readonly remainingCharacterPoints: number;
  readonly resource: "character-points" | "experience-points";
  readonly score: number;
  readonly strategy:
    "open-d6-character-points" | "second-edition-experience-points";
}

export interface D6System2eAdvancementApi {
  attribute(actor: object, attributeId: string): Promise<D6AdvancementResultV1>;
  item(actor: object, itemId: string): Promise<D6AdvancementResultV1>;
}
