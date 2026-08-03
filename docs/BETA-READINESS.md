# Beta readiness

Audit date: 2026-08-03.

## Decision

The finite pre-beta mechanics roadmap is complete, schema 38 is current, and the
stabilization pass found no internal release blocker. The user has since moved
the public-content onboarding closure ahead of Beta 1 packaging. Equipment from
D62e pp. 79–85 is now included; the bounded bestiary/template content passes in
`HANDOVER.md` must finish before the release-candidate pass resumes.

## Release boundary

- Public system version: `0.1.0-alpha.23`; schema: 38.
- All root, workspace, lockfile, generated-pack, private-companion, and Token
  Action HUD adapter release metadata is now derived from or synchronized with
  the public system version.
- The public manifest contains the user manual, two description-free Skill
  packs, and an 84-Item D62e Equipment pack. Bestiary, character-template,
  feature, hideout, and Psionics contribution catalogs remain empty where their
  public-content boundary has not yet been completed or permission is required.
- `npm run release:verify` proves a contiguous migration chain from 001 through
  038, validates the public boundary, and builds a one-entry synthetic private
  companion in an isolated temporary directory. The fixture and temporary
  package are removed after verification; no private input or generated private
  pack enters the repository.
- A real local private companion remains optional and must be built only from
  lawfully held source material under the ignored `private-content/` input.

## Acceptance matrix

| Boundary                     | Automated evidence                                                                                                                  | Visible Foundry v14 Build 365 evidence                                                                                                          | Result                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Migration chain              | 38 contiguous files; schema marker, manifest flag, index imports, and loader agree                                                  | Existing development world reached ready after the planned restart                                                                              | Pass                                     |
| Public packs                 | 49 Second Edition Skills, 60 OpenD6 Skills, and 84 D62e Equipment Items match structured catalogs; 15-page/42-image manual verified | GM saw all four public packs, opened representative Gear/Armor/Weapon records, imported and removed Axe, and opened the rebuilt manual guidance | Pass                                     |
| GM startup and reload        | Bundle and loader gates cover registration and schema 38                                                                            | GM loaded after the planned restart with the new Equipment pack, Quickbar, and Active Tasks; final browser diagnostics were clean               | Pass                                     |
| Player visibility and reload | Pack verification and role-specific automated suites                                                                                | Prior TyfTester acceptance covered the manual and two Skill packs; the Tier A Equipment pass did not repeat a distinct player session           | Deferred to bounded player release smoke |
| Private companion boundary   | Synthetic isolated companion preserved its private description and matching release metadata                                        | No private companion was installed or exposed in the public world                                                                               | Pass                                     |
| Local/public availability    | HTTP route probes                                                                                                                   | `foundry-dev` healthy; local `/dev` responded and public `/dev/game` redirected unauthenticated access to `/dev/join` as expected               | Pass                                     |

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

`npm run check` passed formatting, lint, TypeScript, 159 test files / 738
tests, both production bundles, the 49-entry and 60-entry public Skill packs,
the 84-entry Equipment pack, the 15-page/42-image user manual, the release
boundary, package invariants, and the generated schema-38 bundle lifecycle
smoke.

## Exact next pass

**Fantasy Bestiary and Fantasy Templates — D62e pp. 165–171.** Populate the
existing lawful Creature and Character Template contracts with mechanically
distributable records, provide their user-facing compendium/catalog surfaces,
document how a new GM uses them, and retain concise page-referenced summaries.
Beta 1 release-candidate packaging resumes only after the bounded public-content
passes recorded in `HANDOVER.md` are complete.
