# ADR 0007: Hero Point die-code doubling with canonical pips

Status: accepted
Date: 2026-07-30

## Context

D6 System: Second Edition v1.1 page 28 permits spending one Hero Point to
"double the Die Code of a single roll." The optional pips module on pages 94-95
does not explicitly say whether a code such as `3D+1` doubles to `6D+1` or
`6D+2`.

The system stores every Die Code as one canonical integer pip score. OpenD6 Next
also doubles both dice and pips before normalizing its Fate Point pool.

## Decision

The project owner supplied the authoritative campaign ruling:

- Second Edition without the Pips module doubles whole dice, so `3D` becomes
  `6D`.
- Second Edition with the Pips module doubles the complete canonical pip score
  and then normalizes it, so `3D+2` becomes `7D+1`.
- First Edition behaves as though the Pips module is active and therefore uses
  the same canonical pip-aware calculation.

The result contract records the original request, effective pool, and one Hero
Point expenditure. Companions cannot replace this policy with sheet-side
arithmetic. Basic and Classic Hero Point variants remain separate typed
strategies governed by their own printed rules.

## Consequences

- Pip arithmetic remains lossless and consistent across the Pips and First
  Edition profiles.
- One expenditure and any award from the same result are applied as one
  deterministic resource transaction.
- Existing character scores require no migration.
