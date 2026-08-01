# Authoritative Rules Rulings

This ledger records explicit table rulings for contradictory or ambiguous
language in _D6 System: Second Edition_ v1.1. These rulings are the authority for
system automation unless later official errata supersedes them.

## Ruling 1: Successful damage resistance causes Staggered

- **Source:** D62e p. 33.
- **Conflict:** The formal outcome list says a Brawn total greater than the
  Damage total causes Staggered. The example says the same result causes
  Stunned, while the following condition text says a character becomes Stunned
  when Staggered again while already Staggered.
- **Decision:** A Brawn total greater than the Damage total causes Staggered. A
  second Staggered result while the character is already Staggered causes
  Stunned.
- **Rationale:** Treat the example's direct Stunned result as a typo. The formal
  outcome list and the immediately following escalation rule form the coherent
  progression.
- **Status:** Accepted by the project owner on 2026-07-30.

## Ruling 2: A Brawn-roll Complication causes Mortally Wounded

- **Source:** D62e p. 33.
- **Conflict:** The formal outcome list requires a Complication on the Damage
  roll. The example instead refers to a `1` on the defender's Brawn Wild Die.
- **Decision:** When the Brawn total is equal to or less than the Damage total
  and the Brawn resistance roll invokes a Complication, the target becomes
  Mortally Wounded. A Complication on the Damage roll does not escalate the
  target's condition.
- **Rationale:** Treat `Damage Roll invoked a Complication` in the formal list
  as a typo for `Brawn Roll invoked a Complication`, consistent with the
  numerical example and the adverse meaning of a Complication for the
  character making the resistance roll.
- **Status:** Accepted by the project owner on 2026-07-30.

## Ruling 3: A declaration cannot reduce a required roll below 1D

- **Source:** D62e pp. 26, 29-30.
- **Ambiguity:** The rules require every roll to contain a Wild Die and warn that
  excessive actions will not work, but do not explicitly define a `0D` or
  negative-dice roll.
- **Decision:** A character cannot declare an action sequence if the resulting
  multiple-action penalty plus wounds, movement, conditions, or other
  applicable penalties would reduce any declared Skill or Attribute use to `0D`
  or less. The whole-die count must remain at least `1D`; positive pips do not
  rescue a zero-die pool, so `0D+1` and `0D+2` are also illegal. There is no 1D
  floor and no automatic-failure declaration.
- **Consequences:** Adding an action must revalidate every rolled action already
  in the sequence. Movement and other non-roll segments may remain legal
  themselves but can make a rolled action illegal by increasing the round
  penalty. If an applicable penalty changes after declaration, execution of a
  roll reduced below 1D is prohibited.
- **Status:** Accepted by the project owner on 2026-07-30.

## Ruling 4: Heroic Die Code doubling includes canonical pips

- **Source:** D62e pp. 28, 94-95; First Edition compatibility profile.
- **Ambiguity:** The core Hero Point rule doubles a Die Code, but the optional
  Pips module does not explicitly state how a `+1` or `+2` is doubled.
- **Decision:** In Second Edition without the Pips module, only whole dice
  exist, so `3D` becomes `6D`. With the Pips module active, double the complete
  canonical pip score and normalize it, so `3D+2` becomes `7D+1`. First Edition
  always uses the same pip-aware calculation.
- **Consequences:** Basic and Classic Hero Point variants retain their own
  printed strategies. This ruling governs the core/Heroic Die Code-doubling
  strategy and the First Edition Fate Point compatibility calculation.
- **Status:** Accepted by the project owner on 2026-07-30.

## Ruling 5: First Edition unconscious duration uses a positive difference

- **Source:** D6S pp. 75-76.
- **Conflict:** The stun-only and Wound Level paragraphs describe unconscious
  minutes as resistance minus Damage, even though those outcomes occur only
  when Damage exceeds resistance. A literal result would therefore be negative.
- **Decision:** Store the positive Damage-minus-resistance difference for
  stun-only unconscious duration. A failed Incapacitated Stamina/Willpower check
  retains the separate printed 10D-minute duration.
- **Rationale:** This is the only non-negative reading consistent with the
  surrounding damage comparison and an elapsed duration.
- **Status:** Provisional implementation clarification recorded on 2026-07-31;
  the project owner may replace it if official errata supplies another value.

## Equipment by Genre/Era classification note

D62e pp. 79-85 clearly present Medieval, Modern, and Science Fiction as
alternative equipment families and explicitly leave acquisition and cost to the
Gamemaster. No contradiction required a new rules ruling. The implementation
therefore treats era as classification and catalog-filter guidance only: it does
not hide mismatched Items, invent prices, infer bonuses from descriptions, or
ship the protected named tables. Licensed Foundry modules may contribute
validated catalog facts through the public registry while the base catalog
remains empty.

## No Dodge Defense interaction note

D62e p. 94 replaces a character's Dodge with fixed personal ranged-attack
difficulties; it does not remove Parry or machine Defense. The prone bonus on
p. 32 and the smaller-target scale bonus on pp. 196–197 explicitly modify
Dodge, so neither modifies this replacement difficulty. Cover remains an
independent GM-adjudicated addition. Because the system has no persistent
printed Dodge-reaction scheduler, the p. 94 Long-range dodging value is exposed
as a per-attack **Target is dodging** choice, only at Long range, and is fully
audited in chat.

## Hyper-lethal Combat boundaries

The phrases “first level” and “next level” on D62e p. 89 describe the complete
normal damage track that replaces the p. 33 Staggered/Stunned/Wounded track.
Accordingly, removing Stunned makes Wounded the first result whether Brawn is
above or at/below Damage; removing Wounded makes Stunned first and Mortally
Wounded next; enabling both removals makes Mortally Wounded the sole normal
damage result. A resistance Complication remains Mortally Wounded.

The p. 90 Killing Blow comparison is strict: `Brawn × 2 < Damage`. Equality is
not a Killing Blow. Spending the printed Hero Point prevents only immediate
death, then applies the ordinary result from the active damage track; any
separate Hero Point option produced by that result remains a distinct choice.

The Maximum Armor Rule names a “Brawn+Armor” roll. The 6D cap therefore applies
to that personal base pool. The relative-Scale resistance modifier on pp.
196-197 remains a separate, visible modifier. Hull plus Shields/Armor is not a
Brawn roll, so Vehicle and Starship damage is unchanged. The module changes
normal damage resolution, not environmental direct Conditions or manual
Condition edits.
