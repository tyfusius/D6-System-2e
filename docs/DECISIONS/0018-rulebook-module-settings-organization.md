# ADR 0018: Rulebook module settings organization

## Status

Accepted.

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

The initial groups are Core campaign setup, Module: Additional Attributes,
Advancement modules, Module: Pips, and Module: Skill Specializations & Advanced
Skills. The advancement family remains one selector because D62e says its
variants are incompatible.

Only implemented, runtime-consumed choices receive settings. Deferred rulebook
modules remain documented in the rules inventory until their rules,
dependencies, conflicts, state ownership, and tests are implemented.

## Consequences

- Existing worlds require no setting migration.
- The UI uses the book's module vocabulary and source references.
- Module organization may evolve without changing persistence.
- A future campaign-profile editor can reuse the same catalog.
- New Second Edition settings must update the catalog and its completeness
  tests in the same change.
