# Beta readiness

Audit date: 2026-08-03.

## Decision

The finite Second Edition mechanics roadmap is complete and schema 40 is
current. The user correctly moved the missing Open D6 First Edition genre
content ahead of Beta 1 packaging. The shared package registry and explicit
world-selection foundation and specialized compendium usability are complete;
D6 Space, lawful D6 Fantasy, lawful D6 Adventure, and integrated onboarding and
acceptance remain. Beta packaging is not the next pass.

## Release boundary

- Public system version: `0.1.0-alpha.23`; schema: 40.
- All root, workspace, lockfile, generated-pack, private-companion, and Token
  Action HUD adapter release metadata is now derived from or synchronized with
  the public system version.
- The public manifest contains the user manual, two description-free Skill
  packs, an 84-Item D62e Equipment pack, four Fantasy Creature Actors, and four
  Fantasy Character Template references. Feature, hideout, and Psionics
  contribution catalogs remain empty where permission is required.
- `npm run release:verify` proves a contiguous migration chain from 001 through
  040, validates the public boundary, and builds a one-entry synthetic private
  companion in an isolated temporary directory. The fixture and temporary
  package are removed after verification; no private input or generated private
  pack enters the repository.
- A real local private companion remains optional and must be built only from
  lawfully held source material under the ignored `private-content/` input.

## Acceptance matrix

| Boundary                     | Automated evidence                                                                                                                                                                                                                           | Visible Foundry v14 Build 365 evidence                                                                                                                                                                                                                           | Result |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Migration chain              | 40 contiguous files; schema marker, manifest flag, index imports, and loader agree                                                                                                                                                           | Existing development world reached ready after the planned restart                                                                                                                                                                                               | Pass   |
| Public packs                 | 49 D62e Skills, 60 OD6 Skills, 84 Equipment Items, four Fantasy Creatures, and four Fantasy Templates match structured catalogs; 15-page/42-image manual verified                                                                            | GM saw all six public packs, opened the corrected packaged Dragon with all six embedded natural Items, and saw all four Fantasy Templates                                                                                                                        | Pass   |
| Shared compendium usability  | Compatibility, ownership, stable member references, copy sanitization, edition-aware templates, species bounds, protected specialization routes, transfer rollback, sorting, world-Item/source-Actor distinction, and sheet-route tests pass | GM authored and reloaded species bounds; an incorrect world-Item transfer prompt was caught and fixed; TyfTester had 23 draggable owned Item rows. The final specialized HTML5 drop is not re-claimed because the Chrome pointer bridge stopped completing drops | Pass   |
| GM startup and reload        | Bundle and loader gates cover registration, the package registry, and schema 40                                                                                                                                                              | GM loaded all six packs; the current pass also verified explicit First Edition package selection, its empty state, D62e restoration, and clean diagnostics                                                                                                       | Pass   |
| Player visibility and reload | Pack verification and role-specific automated suites                                                                                                                                                                                         | TyfTester retained the world across reload and never received the GM-only First Edition Configure control or campaign-package workspace                                                                                                                          | Pass   |
| Private companion boundary   | Synthetic isolated companion preserved its private description and matching release metadata                                                                                                                                                 | No private companion was installed or exposed in the public world                                                                                                                                                                                                | Pass   |
| Local/public availability    | HTTP route probes                                                                                                                                                                                                                            | `foundry-dev` healthy; local `/dev` responded and public `/dev/game` redirected unauthenticated access to `/dev/join` as expected                                                                                                                                | Pass   |

## Accepted residual risks

- Token Action HUD Core 2.1.1 can still report its known missing
  `list-subgroup.hbs` partial during reload. It appeared once on the TyfTester
  reload in this pass. The D62e adapter initializes and the system remains
  usable; this external dependency is tracked separately and is not patched in
  the system package.
- The Second Edition Brawn-adjusted thrown-explosive setting and range planner
  are automated and the settings surface is live-verified, but its dedicated
  attack-dialog fixture remains live-unverified. The shared attack, player
  chat, and reload paths have independent live evidence.
- A chase participant's active-GM socket submission remains automated rather
  than separately live-observed. Chase GM resolution, player ownership
  visibility, persistence, and reload are live-verified, and the distinct-player
  serialized first-writer boundary has separate live evidence.
- A few destructive or highly situational rule branches remain intentionally
  automated or GM-adjudicated as recorded in the parity ledger. None changes
  the declared public beta support profile.

## Final automated gate

`npm run check` passed formatting, lint, TypeScript, 163 test files / 769 tests,
both production bundles, the 49-entry and 60-entry public Skill packs,
the 84-entry Equipment pack, the 15-page/42-image user manual, the release
boundary, package invariants, and the generated schema-40 bundle lifecycle
smoke.

## Exact next pass

**D6 Space public content — Open D6 Space printed pp. 15–120 and 126–137.**
Create the first public First Edition genre module, register its
campaign-package manifest, and build the bounded OGL-backed typed catalogs,
Foundry packs, provenance, onboarding, and acceptance.
