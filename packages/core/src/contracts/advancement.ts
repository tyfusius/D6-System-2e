import type { AdvancementKind } from "../domain/advancement";

export interface D6AdvancementResultV1 {
  readonly cost: number;
  readonly kind: AdvancementKind;
  readonly remainingCharacterPoints: number;
  readonly score: number;
}

export interface D6System2eAdvancementApi {
  attribute(actor: object, attributeId: string): Promise<D6AdvancementResultV1>;
  item(actor: object, itemId: string): Promise<D6AdvancementResultV1>;
}
