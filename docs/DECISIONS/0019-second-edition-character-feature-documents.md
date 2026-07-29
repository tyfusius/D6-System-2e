# ADR 0019: Second Edition character feature documents

Status: accepted and extended by the schema-11 vertical slice

## Context

D62e defines Perks, Flaws, and Talents as the optional character-feature module
on printed pp. 101-129. It defines Troubles and Assets as a separate optional
module on pp. 130-131 and recommends, without requiring, that campaigns avoid
combining the two. The older Advantage, Disadvantage, and Special Ability names
remain meaningful OpenD6 compatibility document families and cannot be renamed
or reinterpreted losslessly.

Many printed features contain bespoke modifiers, prerequisites, links, limited
uses, or narrative judgments. Troubles and Assets permit two invocations per
session.

## Decision

- Add distinct `perk`, `flaw`, `talent`, `trouble`, and `asset` Item types.
- Preserve the existing OpenD6 `advantage`, `disadvantage`, and
  `specialability` Item types.
- Store only common source-backed facts in schema 11:
  - Perks and Flaws store rank, focus/scope, description, and citation.
  - Talents additionally store their printed creation cost and whether the
    definition permits repeated purchase.
  - Troubles and Assets store their narrative trigger, description, and
    citation.
- Do not persist per-session invocation counters on Items. Store revisioned
  per-Actor session state in a system flag. Owners invoke; only a GM resets.
- Resolve the two feature modules independently. They are active only for native
  Second Edition when their world settings are enabled, and inactive-preserved
  under complete OpenD6.
- Account for Perks and Flaws at one Skill die per rank and for Talents at their
  stored printed Skill-dice cost.
- Trouble invocation grants one Hero Point and emits an explicit immediate
  Complication instruction. Asset invocation either grants one Hero Point or
  adds exactly +3D to a selected Attribute or Skill roll.
- Never infer bespoke prerequisites or modifiers from Item description text.
  Those effects require source-mapped, typed system services before they can be
  advertised as active.
- Do not map existing compatibility Items to native Second Edition families
  automatically. A future importer must report that transformation and preserve
  the original source.

## Consequences

Worlds can represent native Second Edition character features without inventing
executable Item data or losing OpenD6 documents. Module resolution, creation
accounting, public read projection, Trouble/Asset transactions, two-use limits,
and GM reset ownership are implemented. Bespoke named Perk, Flaw, and Talent
effects remain blocked on source mapping and distribution permission.
