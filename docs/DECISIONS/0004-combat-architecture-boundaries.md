# ADR 0004: Combat architecture boundaries

Status: Accepted incrementally; declaration/action-segment slice implemented

## Context

Pages 29-31 describe declarations, multiple-use penalties, action segments, and
contextual initiative. Pages 33-34 describe attacks and damage, but page 33 contains
material contradictions. Foundry's Combat Tracker expects stable turns in ways that
do not directly match every described flow.

## Decision

- Keep persistent character condition on the Actor only when it remains outside the
  current round.
- Keep declared round actions and spent segments on a versioned Combatant flag.
- Keep selected initiative strategy and any future cross-combatant cursor on a
  versioned Combat flag. The first slice has no global cursor because standard
  initiative is contextual rather than one stable ordering.
- Mutate those flags only through revision-checked application commands.
- Route future remote owner requests through a system-owned socket protocol with
  idempotency keys and GM fallback.
- Rebuild state from documents after reload; UI caches are never authoritative.
- Do not implement damage progression until page 33 is resolved.

## Implemented slice

- `D6CombatantRoundStateV1` stores ordered declared actions, completed action IDs,
  source round, contract version, and monotonic revision on the Combatant.
- Sheet and public API commands declare, complete the next action without passing,
  and reset. Player owners may reset only before resolution begins; the GM may
  correct a started declaration.
- Every Attribute, Skill, resistance, and weapon-attack request derives the
  declared-action penalty from authoritative Combatant state. The typed request
  and chat card retain the round, action count, and penalty.
- A Foundry round change logically exposes a clean state even before a new flag
  write, preventing an old declaration from leaking into the next round.
- Damage pools are not reduced as “skill or attribute use.”

## Source-backed initiative boundary

Printed pp. 30-31 define contextual initiative: when actions affect one another,
the relevant skill/Attribute rolls establish order and also resolve success. High
roll acts first; a PC wins a PC-versus-NPC tie, while two PCs or two NPCs reroll.
This is not projected into one fabricated permanent Foundry turn order.

The implemented native strategy preserves that boundary while allowing the GM
to drag Combatants into a practical, Combat-owned tracker order. No initiative
score is invented. An independent **Use First Edition Initiative Rolls**
compatibility strategy instead rolls Perception through Foundry's tracker; the
complete OpenD6 preset enables it by default.

## Remaining questions

- Which exact roll's Complication creates mortal wounding?
- When do Staggered and Stunned clear in token-turn terms when the source says next round?
- How are disconnected owners and private roll choices routed?

Combat-wide strategy selection, reactions, socket routing, and tracker controls
remain subsequent slices.
