# ADR 0020: Genre and companion package boundaries

Status: Accepted design direction; contribution API not yet implemented

Date: 2026-07-31

## Context

The system supports two rules families and multiple genre sources. First
Edition is not a single genre: Adventure, Fantasy, and Space have separate
rulebooks. Second Edition likewise groups rules components into Core, Fantasy,
Science Fiction, and Superheroic families. Setting companions such as Star Wars
may combine a compatible rules foundation with setting-specific terminology,
content, and presentation.

Bundling every genre and companion permanently into the base system would mix
rules, licensed content, presentation, release cadence, and settings ownership.
Allowing each package to patch sheets or private settings would instead create
multiple rule engines and load-order-dependent behavior.

Foundry uses “module” for installable add-ons, while the Second Edition book
uses the same word for optional rules. The architecture needs an explicit
distinction.

## Decision

1. Genre packages and setting companions are actual Foundry add-on modules and
   use one versioned, validated public contribution contract.
2. The base system owns document schemas, pure rule strategies, application
   services, authority, validation, persistence boundaries, conflict
   resolution, settings selection, and safe fallbacks.
3. Enabling a package makes its contributions available. It does not make them
   authoritative. A system-owned world selection activates one campaign genre
   and, when compatible, one setting companion.
4. Resolution order is base system → selected genre → selected companion →
   explicit world override. A user presentation preference may override only
   compatible presentation values.
5. Rules, workflow assistance, content, and presentation remain independent.
   Presets may recommend a coherent bundle but must preview and explicitly
   apply mechanical changes.
6. Conflicting authoritative rules contributions are rejected and diagnosed;
   they are never merged by Foundry module load order.
7. Every resolved value retains owner/provenance metadata for UI explanation,
   diagnostics, and safe package removal.
8. Packages register data and select system-implemented strategies. They do not
   calculate rules, import private internals, write private settings or flags,
   replace sheets, or inject controls into private system applications.
9. A package may register genuinely package-specific settings under its own
   normal Foundry settings category. The system owns shared campaign-package,
   companion, rules-profile, and presentation selection.
10. The public contribution manifest is planned to include identity and API
    compatibility, dependencies/conflicts, rules presets and capabilities,
    Attribute/Skill/catalog contributions, terminology, content packs, themes,
    Dice So Nice profiles, placeholder artwork, creation presets, and
    owner-scoped migrations.

Use **rules component** in developer-facing text for a printed optional D62e
mechanic. Use **Foundry module** for an installable package. Rulebook-facing UI
may retain the printed “Module:” title.

## Presentation and placeholders

Presentation is independently selectable from rules. A package may provide CSS
tokens, fonts, logos, dice, and default artwork without becoming a rules owner.

Foundry's stock placeholder is `CONST.DEFAULT_TOKEN`, currently
`icons/svg/mystery-man.svg`. A presentation change may replace only a recognized
placeholder sentinel. It must never overwrite user-selected Actor or Token
artwork. Placeholder resolution is companion → genre → system → Foundry stock
and should support distinct defaults for characters, NPCs, creatures, vehicles,
starships/machines, and Item families.

## Authoritative First Edition genre sources

- Adventure:
  `/Volumes/Store/RPG/OpenD6/weg51011e-West_End_Games-D6 Adventure.pdf`
- Fantasy:
  `/Volumes/Store/RPG/OpenD6/weg51013e-West_End_Games-D6 Fantasy_v1.3.pdf`
- Space: `/Volumes/Store/RPG/OpenD6/weg51012OGL-D6-Space.pdf`

These sources establish separate campaign packages. No package may infer one
genre's mechanics from another.

## Consequences

- The base system remains usable and testable without a genre or companion.
- Worlds install only the content and presentation they need.
- Genre and licensed companion releases can have separate provenance, licenses,
  versions, dependencies, and update cadence.
- Disabling or temporarily losing a package preserves stored IDs and document
  data while presenting a clear fallback and diagnostic.
- The existing terminology and theme registries are partial foundations. The
  unified contribution contract, provenance resolver, conflict report,
  activation settings, and placeholder resolver must be implemented before
  extracting genre packages.
- Existing internal Second Edition catalog IDs are not automatically external
  package identities. Extraction requires an explicit compatibility and
  migration plan.
