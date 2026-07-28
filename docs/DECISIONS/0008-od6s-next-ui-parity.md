# ADR 0008: OpenD6 Next is the canonical UI implementation

Status: accepted  
Date: 2026-07-26

## Decision

System-owned ApplicationV2 presentation in D6 System Second Edition uses the
corresponding OpenD6 Next component as its canonical implementation.

Port the actual component structure, class conventions, spacing, typography,
surface treatment, controls, responsive behavior, and accessibility patterns.
Do not create a merely similar interpretation. A visible difference is a defect
unless Second Edition rules, generic terminology, or a documented platform
constraint requires it.

Rules and persistent data remain native to this project. Presentation reuse does
not authorize copying OpenD6 rules logic, setting branding, protected artwork,
compendium content, or private document contracts.

## Required mapping

- OpenD6 Next roll builder → Second Edition typed roll builder.
- OpenD6 Next cinematic roll card → Second Edition structured roll result.
- OpenD6 Next Wild Die dialog family → edition-profile Wild Die choices.
- OpenD6 Next Actor and Item ApplicationV2 shells → equivalent Second Edition
  Actor and Item types.
- OpenD6 Next settings, configuration, tracker, and utility components →
  equivalent Second Edition applications when those capabilities exist.
- OpenD6 Next PC Quickbar and Active Tasks components → the same `.od6pc-*`
  and `.od6tasks-*` structures, without a parallel Second Edition skin.

New UI work must begin from the matching OpenD6 Next component. The review gate
is direct side-by-side comparison at the same dimensions and theme.
The maintained surface inventory and change gate are in `docs/UI-PARITY.md`.

## Boundaries

- Generic presentation uses the OpenD6 Classic theme.
- Companion modules may contribute setting themes through the public registry.
- Rules calculations remain in core/application services.
- Templates and chat cards consume typed results and never become rules engines.
- A rules-dependent field may be added, removed, or renamed without redesigning
  the surrounding component.
