# ADR 0007: Hero Point die-code doubling with canonical pips

Status: provisional  
Date: 2026-07-26

## Context

D6 System: Second Edition v1.1 page 28 permits spending one Hero Point to
"double the Die Code of a single roll." The optional pips module on pages 94-95
does not explicitly say whether a code such as `3D+1` doubles to `6D+1` or
`6D+2`.

The system stores every Die Code as one canonical integer pip score. OpenD6 Next
also doubles both dice and pips before normalizing its Fate Point pool.

## Decision

Until authoritative clarification is available, doubling multiplies the complete
canonical score by two and then normalizes it. Therefore `3D+1` becomes `6D+2`.
The result contract records the original request, effective pool, and one Hero
Point expenditure.

This is a visible, tested design decision rather than an inferred rulebook claim.
Companions cannot replace it with sheet-side arithmetic. A future verified
campaign strategy may supply a different typed policy without changing stored
character scores.

## Consequences

- Pip arithmetic remains lossless and consistent with OpenD6 Next.
- One expenditure and any award from the same result are applied as one
  deterministic resource transaction.
- The question remains listed in the rules inventory and may require a migration
  only if persisted audit records need reinterpretation; character scores do not.
