# ADR 0005: Character sheet modes and OpenD6 Next UX continuity

Status: Accepted

## Context

OpenD6 Next users should recognize the character-sheet organization and workflows.
D6 System Second Edition nevertheless has its own schemas and several mutually
exclusive advancement modules. Copying the old advancement implementation would
make OpenD6 Next an accidental rules authority.

## Decision

The character sheet provides the same three visible workflows:

- Normal for everyday play;
- Advance as the only player-facing skill-increase and point-spending workflow;
- Free Edit for direct dice/pip entry by GMs only.

The stable stored values are `normal`, `advance`, and `freeedit` at
`system.sheetMode.value`. Effective mode is permission-derived. A non-GM never
receives the Free Edit choice, a forged non-GM selection is rejected, and a stored
Free Edit value resolves to Normal for that user's view.

Attributes and skills use canonical `xD+y` labels. Free Edit exposes their separate
stored integer pip scores. Advance controls remain unavailable until a campaign
advancement profile selects and configures an authoritative Second Edition module.
Normal does not expose attribute/skill score inputs or skill-management controls,
even to a GM. The same policy is enforced by document hooks: direct score updates
and embedded skill creation are accepted only for a GM in Free Edit (or for the
versioned migration runner). Player advancement will use a separate authoritative
service rather than bypassing the direct-edit guard.

## Consequences

Users retain familiar mode switching and information hierarchy without coupling the
new system to OpenD6 Next internals. Schema version 2 adds Normal mode to older
character sources while preserving unknown keys and prior values. A future importer
can map the legacy `system.sheetmode.value` deliberately rather than making it an
implicit runtime dependency.
