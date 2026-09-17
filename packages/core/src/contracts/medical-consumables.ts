/** Additive API-v2 view of an owned, reachable supported stim. Patient eligibility is checked in the use dialog. */
export interface D6MedicalConsumableReadModelV1 {
  readonly id: string;
  readonly name: string;
  readonly image: string;
  readonly quantity: number;
  readonly actionCost: 1;
  readonly doseCost: 1;
}

export interface D6System2eMedicalApiV1 {
  read(actor: object): Promise<readonly D6MedicalConsumableReadModelV1[]>;
  /** Opens the authorized treatment flow; does not itself spend an action or dose. */
  begin(actor: object, itemId: string): Promise<void>;
}
