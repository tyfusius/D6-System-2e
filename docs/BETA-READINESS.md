# Beta readiness

Audit date: 2026-08-03.

## Decision

The public system is ready to enter the Beta 1 release-candidate pass. The
finite pre-beta mechanics roadmap is complete, schema 38 is current, and this
stabilization pass found no internal release blocker. This is a readiness
decision, not a published beta release: release URLs, an installable archive,
clean-world installation, upgrade-from-alpha acceptance, and the Beta 1 version
change belong to the next pass.

## Release boundary

- Public system version: `0.1.0-alpha.23`; schema: 38.
- All root, workspace, lockfile, generated-pack, private-companion, and Token
  Action HUD adapter release metadata is now derived from or synchronized with
  the public system version.
- The public manifest contains only the user manual and two description-free
  Skill packs. Base equipment, bestiary, character-template, feature, hideout,
  and Psionics contribution catalogs remain empty of protected named content.
- `npm run release:verify` proves a contiguous migration chain from 001 through
  038, validates the public boundary, and builds a one-entry synthetic private
  companion in an isolated temporary directory. The fixture and temporary
  package are removed after verification; no private input or generated private
  pack enters the repository.
- A real local private companion remains optional and must be built only from
  lawfully held source material under the ignored `private-content/` input.

## Acceptance matrix

| Boundary                     | Automated evidence                                                                                                | Visible Foundry v14 Build 365 evidence                                                                                            | Result |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Migration chain              | 38 contiguous files; schema marker, manifest flag, index imports, and loader agree                                | Existing development world reached ready after the planned restart                                                                | Pass   |
| Public packs                 | 49 Second Edition and 60 OpenD6 Skills have blank descriptions/current metadata; 14-page/42-image manual verified | GM and TyfTester each saw exactly the manual and two public Skill packs                                                           | Pass   |
| GM startup and reload        | Bundle and loader gates cover registration and schema 38                                                          | GM loaded with Quickbar and Active Tasks, then reloaded with all three packs retained and no warning or error                     | Pass   |
| Player visibility and reload | Pack verification and role-specific automated suites                                                              | TyfTester saw all three packs, no GM Quickbar or Active Tasks controls, and retained the player session after reload              | Pass   |
| Private companion boundary   | Synthetic isolated companion preserved its private description and matching release metadata                      | No private companion was installed or exposed in the public world                                                                 | Pass   |
| Local/public availability    | HTTP route probes                                                                                                 | `foundry-dev` healthy; local `/dev` responded and public `/dev/game` redirected unauthenticated access to `/dev/join` as expected | Pass   |

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

`npm run check` passed formatting, lint, TypeScript, 156 test files / 721
tests, both production bundles, the 49-entry and 60-entry public Skill packs,
the 14-page/42-image user manual, the release boundary, package invariants, and
the generated schema-38 bundle lifecycle smoke.

## Exact next pass

**Beta 1 release-candidate packaging and clean install/upgrade acceptance.**
Change the coordinated version to `0.1.0-beta.1`, add and validate release
manifest/download metadata, build a reproducible public archive, install it in
a clean Foundry v14 world, upgrade a backed-up alpha.23 fixture through schema
38, repeat the bounded GM/player/reload smoke, and publish/tag only when those
checks and the repository release policy are satisfied.
