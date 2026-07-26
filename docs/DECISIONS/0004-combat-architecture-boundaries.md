# ADR 0004: Combat architecture boundaries

Status: Proposed; automation deferred

## Context

Pages 29-31 describe declarations, multiple-use penalties, action segments, and
contextual initiative. Pages 33-34 describe attacks and damage, but page 33 contains
material contradictions. Foundry's Combat Tracker expects stable turns in ways that
do not directly match every described flow.

## Proposed direction

- Keep persistent character condition on the Actor only when it remains outside the
  current round.
- Keep declared round actions and spent segments on a versioned Combatant flag.
- Keep selected initiative strategy and any round-wide cursor on a versioned Combat
  flag.
- Mutate those flags only through revision-checked application commands.
- Route remote owner requests through a system-owned socket protocol with idempotency
  keys and GM fallback.
- Rebuild state from documents after reload; UI caches are never authoritative.
- Do not implement damage progression until page 33 is resolved.

## Questions before acceptance

- How should standard contextual initiative project into Foundry's turn order?
- Is the first supported profile standard initiative or Basic Initiative from p. 69?
- Does each declared action always create one tracker pass?
- Which exact roll's Complication creates mortal wounding?
- When do Staggered and Stunned clear in token-turn terms when the source says next round?
- How are disconnected owners and private roll choices routed?

This ADR must be revised and accepted before Phase 4 implementation.
