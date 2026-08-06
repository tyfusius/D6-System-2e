/**
 * A distinct denomination lets Dice So Nice render the Wild Die with its own
 * preset while the domain layer remains responsible for explosion behavior.
 */
export function registerD6System2eDiceTerms(): void {
  const FoundryDie = foundry.dice?.terms.Die;
  if (!FoundryDie || !CONFIG.Dice?.terms) return;

  class D6System2eWildDie extends FoundryDie {
    static readonly DENOMINATION = "w";

    constructor(termData: Record<string, unknown>) {
      super({ ...termData, faces: 6 });
    }
  }

  CONFIG.Dice.terms[D6System2eWildDie.DENOMINATION] =
    D6System2eWildDie as unknown as FoundryConstructor<object>;
}
