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
