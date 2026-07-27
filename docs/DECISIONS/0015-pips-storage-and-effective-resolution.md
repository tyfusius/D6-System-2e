# ADR 0015: Pips storage and effective resolution

Status: accepted

## Context

Second Edition core uses whole-die Attribute and Skill progression. The optional
**Module: Pips** restores `+1` and `+2` Die Code modifiers; `+3` normalizes to
`+1D` (D62e pp. 94-95). OpenD6 uses classic pip progression. The existing
schema already stores every Die Code losslessly as one integer pip score, but
runtime consumers incorrectly treated that storage choice as proof that Pips
were active.

Imported worlds and campaigns that switch rules profiles must not lose dormant
`+1` or `+2` values.

## Decision

- Persistence continues to use one non-negative integer pip score. Three stored
  units equal one die.
- The versioned edition-capability profile owns a separate `pips` decision.
- Core Second Edition resolves each independently stored Die Code down to its
  whole-die component.
- Enabling **Module: Pips** resolves the complete stored score.
- The OpenD6 preset enables its independent classic-Pips compatibility switch.
- Components resolve before addition. For example, a dormant `3D+2` Attribute
  and dormant `+2` Skill increase resolve to `3D`, not `4D+1`.
- Actor sheets, Item sheets, rolls, static defenses, combat equipment labels,
  and public read models consume effective scores through the same adapter.
- Switching Pips off never rewrites documents. Switching it on makes preserved
  modifiers effective again.
- Second Edition creation uses whole-die steps by default and one-pip steps with
  the module. Attribute and Skill split modifiers are audited separately and
  capped at the printed two-die split (six modifier pips) for each budget.

## Consequences

Storage and rules behavior are deliberately distinct. A GM may inspect dormant
canonical values in Free Edit, while player-facing pools and integrations see
only effective values. No Actor/Item schema migration is required. Second
Edition XP advancement remains unavailable until its advancement module is
implemented; when added, it must use the same Pips capability and sequential
`+1`, `+2`, next-die progression from printed p. 88.
