# ADR 0018: Rulebook module settings organization

## Status

Accepted; amended 2026-07-30.

## Context

D6 System: Second Edition v1.1 presents optional rules as plug-and-play modules
and recommends recording the active selection on a campaign worksheet
(pp. 14-16). The core-module introduction also identifies mutually exclusive
Wild Die, Hero Point, Initiative, and Advancement families and notes that some
modules require others (p. 61).

The initial ApplicationV2 settings screen had stable, working Foundry keys but
displayed every Second Edition option in one generic list. That obscured the
book's campaign vocabulary and made dependencies harder to communicate.

## Decision

Keep persisted Foundry keys as the storage contract and add a separate ordered
presentation catalog for Second Edition setting groups. Every group declares:

- a stable presentation ID;
- whether it represents core setup or an optional module;
- the exact localized rulebook-facing title;
- a printed-page reference;
- an icon and concise help text; and
- the complete list of stable setting keys displayed within it.

Every registered Second Edition setting must appear in exactly one group.
Automated tests enforce complete, nonduplicated membership and source order.

Every printed rules module must also have a visible entry in the GM-only Second
Edition Game Settings workspace. Each entry must identify its printed source,
state, dependencies, incompatibilities, and resulting campaign effect. During
development an incomplete module may be visible as disabled and explicitly
labelled **Planned / not yet available**; it must never be selectable as a
control that silently does nothing. For the broad full-rulebook 1.0 target,
every listed module must have a functional selection or strategy.

Mutually exclusive Initiative, Wild Die, Hero Point, and Advancement families
use one selector per family rather than independent checkboxes. Settings must
prevent or clearly resolve incompatible combinations and explain required
dependencies before saving.

The initial groups are Core campaign setup, Module: Additional Attributes,
Advancement modules, Module: Pips, and Module: Skill Specializations & Advanced
Skills. The advancement family remains one selector because D62e says its
variants are incompatible.

The complete catalog covers Core, Fantasy, Science-Fiction, and Superheroic
modules, not only the initially implemented character modules. Implemented,
runtime-consumed choices receive active controls; unfinished entries remain
visible but disabled until their rules, dependencies, conflicts, state
ownership, and tests exist.

## Consequences

- Existing worlds require no setting migration.
- The UI uses the book's module vocabulary and source references.
- A GM can audit the entire printed module catalog without consulting backlog
  documents or guessing whether an absent option was forgotten.
- Players cannot change campaign module selections. A separate read-only active
  rules summary may expose the resolved campaign profile to players.
- Module organization may evolve without changing persistence.
- A future campaign-profile editor can reuse the same catalog.
- New Second Edition settings must update the catalog and its completeness
  tests in the same change.
