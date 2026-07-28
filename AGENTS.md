# Repository instructions

## Scope

This repository is the Foundry VTT v14 implementation of D6 System: Second Edition.
It is a new system, not a rename or fork of OpenD6 Next.

## Authority

- Treat the supplied D6 System: Second Edition v1.1 rulebook as the rules authority.
- Treat OpenD6 Next and its modules as read-only source repositories and the
  acceptance specification for equivalent UX, permissions, workflows,
  integrations, and presentation. Second Edition remains the rules authority.
- Do not infer a Second Edition rule from OpenD6, Star Wars D6, or OpenD6 Next.
- Label verified rules, implementation decisions, temporary assumptions, and open
  questions separately.
- Do not reproduce protected prose, art, logos, settings, or compendium content.

## Engineering

- Keep `packages/core` free of Foundry imports and browser globals.
- Keep public contracts versioned and independent of private Foundry document shapes.
- Put workflow coordination in `packages/system/src/application`.
- Put Foundry documents, hooks, settings, flags, sockets, and UI adapters in
  `packages/system/src/foundry`.
- Do not calculate rules in sheets, hooks, chat cards, HUD adapters, or companion modules.
- Every persistent schema change requires an ordered, idempotent migration and tests.
- Generated files under `dist/` are artifacts. TypeScript source is authoritative.
- Use ApplicationV2 for every system-owned sheet and application.
- For every UI surface with an OpenD6 Next equivalent, begin from that exact
  component's template structure, class names, CSS, typography, spacing,
  responsive behavior, and accessibility treatment. Do not introduce a
  parallel `d6e2-*` visual interpretation. Any intentional difference requires
  a rules, terminology, or platform reason documented in the same change.
- Before implementing or changing an equivalent feature, trace the complete
  OpenD6 Next implementation: TypeScript/application service, template, CSS,
  localization, settings, permissions, socket payloads, persistence, tests,
  reload behavior, and live validation record. A partial reimplementation based
  on memory or a screenshot is not acceptable.
- Preserve OpenD6 Next behavior by default. Adapt only the rules-dependent
  portions required by verified Second Edition rules. Record every deviation as
  rules-required, Foundry-platform-required, or deliberately deferred.
- Maintain `docs/OD6S-NEXT-PARITY.md` as the feature ledger. A feature is not
  complete until its observable behavior, GM/player role matrix, disabled and
  failure states, reload behavior, and same-size visual comparison are recorded.
- Unit tests proving local code execution do not establish parity. Any
  role-sensitive or socket-driven workflow requires a live GM/player test before
  it may be reported as live-verified.
- UI review requires a same-size side-by-side comparison with OpenD6 Next.
  A visible difference without a documented reason is a defect.
- Every user-facing change or new feature must update `docs/USER-MANUAL.md`
  in the same change. Rebuild and verify the Foundry Journal pack, and refresh
  the affected manual screenshots whenever the visible UI changes.
- Run `npm run check` before reporting a milestone as automated-test complete.
- Record live Foundry observations separately. Never infer a live pass from automated tests.

## Repository safety

- Inspect `git status` before editing.
- Preserve unrelated work and live Foundry data.
- Do not copy files from reference systems wholesale.
- Do not commit or push unless the user explicitly requests it.
- Build scripts may remove only their enumerated outputs, never the repository root.
