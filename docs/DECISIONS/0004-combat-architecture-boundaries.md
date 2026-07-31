# ADR 0004: Combat architecture boundaries

Status: Accepted incrementally; personal damage slice implemented

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
- Implement personal damage progression only from the accepted rulings recorded
  in `RULES-RULINGS.md`; machine damage remains a separate rules slice.
- Resolve rules strategy independently from UI assistance. The world may use
  optional tracked suggestions, enforced Second Edition declarations, or a
  manual table workflow without changing which edition owns action economy.

## Implemented slice

- `D6CombatantRoundStateV1` stores ordered declared actions, completed action IDs,
  source round, contract version, and monotonic revision on the Combatant.
- The same state optionally stores a First Edition count-only commitment:
  planned total, base action allotment, defense mode, and spent count. It never
  invents exact future actions. A pre-turn reaction can be committed as already
  spent, immediately applying the complete round MAP.
- Sheet and public API commands declare, complete the next action without passing,
  and reset. Player owners may reset only before resolution begins; the GM may
  correct a started declaration.
- Every Attribute, Skill, and weapon-attack request offers a dedicated MAP
  input. Optional and enforced assistance pre-fill it from authoritative
  Combatant state; Manual assistance ignores tracked declarations. The typed
  request and chat card retain the round/action count when applicable, the
  tracked value, the applied value, and whether the MAP was tracked or manually
  overridden. Resistance remains exempt.
- A Foundry round change logically exposes a clean state even before a new flag
  write, preventing an old declaration from leaking into the next round.
- Damage pools are not reduced as “skill or attribute use.”
- Pure core planning rejects any action roll whose MAP plus movement and
  Condition penalties leave fewer than one whole die. First Edition reaction
  commitments and exclusive Full Defense are represented without requiring all
  future actions to be named in advance.
- A targeted Damage chat message is the GM authority boundary. It invokes the
  target's ordinary resistance roll, applies the pure condition progression
  through the health service, and stores the applied audit on the original
  message to prevent normal duplicate application.

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

- How are disconnected owners and private roll choices routed?

First Edition active-defense roll selection, free-half-Move automation, machine
damage, and broader socket routing remain subsequent slices.
