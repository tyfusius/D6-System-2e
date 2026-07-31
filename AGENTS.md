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
- Treat the following local PDFs as the authoritative First Edition genre
  sources when their packages are in scope:
  - Adventure:
    `/Volumes/Store/RPG/OpenD6/weg51011e-West_End_Games-D6 Adventure.pdf`
  - Fantasy:
    `/Volumes/Store/RPG/OpenD6/weg51013e-West_End_Games-D6 Fantasy_v1.3.pdf`
  - Space: `/Volumes/Store/RPG/OpenD6/weg51012OGL-D6-Space.pdf`
- Do not collapse First Edition into one genre. Adventure, Fantasy, and Space
  are distinct campaign packages with their own source authority.

## Engineering

- Keep `packages/core` free of Foundry imports and browser globals.
- Keep public contracts versioned and independent of private Foundry document shapes.
- Put workflow coordination in `packages/system/src/application`.
- Put Foundry documents, hooks, settings, flags, sockets, and UI adapters in
  `packages/system/src/foundry`.
- Do not calculate rules in sheets, hooks, chat cards, HUD adapters, or companion modules.
- Treat genre packages and setting companions as actual Foundry add-on modules
  using the same versioned public contribution contract. The base system owns
  rule execution, resolution, validation, and fallback behavior.
- Keep package availability separate from package activation. Enabling a
  Foundry module makes its contributions available; an explicit world choice
  selects the authoritative campaign package and companion.
- Keep rules, workflow assistance, content, and presentation independent. A
  visual theme must not silently select mechanics, and a rules preset must not
  overwrite a user's presentation choice.
- Use **rules component** for a printed optional D62e rulebook module and
  **Foundry module** for an installable add-on package. Do not use the bare word
  “module” where the meaning is ambiguous.
- Never replace user-selected Actor or Token artwork during theme/package
  changes. Presentation resolution may replace only a recognized placeholder
  sentinel and must fall back companion → genre → system → Foundry stock.
- Genre and companion modules may register validated contributions and their own
  package-specific settings. They must not import private system code, write
  private system settings/flags, inject controls into system applications, or
  become alternate rule engines. See ADR 0020 and `docs/COMPANION-CONTRACT.md`.
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

## Development process and visibility

- Keep the user informed throughout long implementation and validation passes.
  Report the current phase, what is running, material findings, and what remains
  at every meaningful transition. Do not disappear into a long autonomous
  workflow without concise progress updates.
- Before invoking a specialized skill or heavyweight workflow, state which one
  is being used and what it contributes. A skill's checklist does not override
  the user's requested scope, these repository instructions, or the obligation
  to communicate clearly.
- Distinguish implementation, automated verification, live Foundry validation,
  documentation, and release work in progress reports. Do not let a long
  validation matrix obscure what has already been implemented.
- Use automated/headless browser tooling for repeatable assertions, responsive
  captures, console checks, and before/after evidence. Use a visible browser for
  final Foundry visual judgment, authentication when practical, Dice So Nice
  animation, and workflows the user should be able to observe. Headless tooling
  is not automatically the default for every live Foundry task.
- Continue safe independent work while waiting for credentials or user input.
  Before pausing, report completed implementation, automated results, remaining
  live checks, current server status, and the exact information needed.

### Foundry process lifecycle

- Treat the development Foundry instance as a shared, user-visible service.
  Do not stop, kill, or restart it merely for convenience.
- Announce any required stop or restart before performing it, including the
  reason and expected interruption. Process commands such as `kill`, `pkill`,
  or service restarts must target the resolved development process only.
- If the instance is stopped during a task, restart it and verify both the local
  process and `https://foundryvtt.darknessunfolds.com/dev` before completing the
  session. Do not leave the public endpoint returning a proxy error without
  immediately telling the user why and what remains to restore it.
- Preserve authenticated browser sessions where possible. Do not invalidate a
  working GM/player session unless the test explicitly requires logout,
  disconnect, or session replacement.
- A build, manifest change, schema change, or compendium rebuild is not by
  itself permission to leave Foundry offline. Schedule the minimum necessary
  restart and confirm the intended development world launches afterward.

### Required end-of-pass report

Every substantial development pass must end with a concise, evidence-based
report containing:

1. source and documentation changes;
2. automated commands and their exact results;
3. live Foundry checks actually observed, separated from unverified checks;
4. local process and public development-endpoint status;
5. Git status and any intentionally preserved unrelated changes; and
6. commit and push status.

## Repository safety

- Inspect `git status` before editing.
- Preserve unrelated work and live Foundry data.
- Do not copy files from reference systems wholesale.
- Do not commit or push unless the user explicitly requests it.
- Build scripts may remove only their enumerated outputs, never the repository root.
