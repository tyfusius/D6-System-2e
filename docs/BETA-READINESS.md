# Beta readiness

Audit date: 2026-08-04.

## Decision

The finite mechanics and pre-Beta content roadmaps are complete. Schema 48 is
current. The shared package registry, explicit primary-profile versus imported-
mechanics contract, clean modular staging, and Adventure/Fantasy/Space genre
packages are complete. The next pass packages and accepts the Beta 1 release
candidate from clean install and representative upgrade paths.

## Release boundary

- Public system version: `0.1.0-alpha.32`; schema: 48.
- All root, workspace, lockfile, generated-pack, private-companion, and Token
  Action HUD adapter release metadata is now derived from or synchronized with
  the public system version.
- The public system manifest contains only the User Manual. The separately
  activatable Second Edition Core Content, Second Edition Fantasy, and Open D6
  Core Content modules own the formerly system-bundled packs with unchanged
  pack/document IDs and runtime UUID aliases. Feature, hideout, and Psionics
  contribution catalogs remain empty where permission is required.
- Second Edition Core Content additionally owns the new nine-record core
  Character Template pack from pp. 138–139; all nine exact 12D scaffolds and
  recommended Skill sets pass the same protected preview/application route.
- The separately installable Open D6 Space genre module contains ten
  deterministic Foundry packs and 277 bounded OGL mechanical records. It
  registers package, equipment, template, and First Edition bestiary catalogs
  only while enabled; availability never selects the world package.
- The separately installable Open D6 Adventure genre module contains nine
  deterministic packs and 422 bounded mechanical or original/generic records.
  It registers its seven-Attribute/61-Skill profile, equipment, template, and
  bestiary catalogs only while enabled; availability never selects it.
- `npm run release:verify` proves a contiguous migration chain from 001 through
  048, validates the public boundary, and builds a one-entry synthetic private
  companion in an isolated temporary directory. The fixture and temporary
  package are removed after verification; no private input or generated private
  pack enters the repository.
- A real local private companion remains optional and must be built only from
  lawfully held source material under the ignored `private-content/` input.

## Acceptance matrix

| Boundary                     | Automated evidence                                                                                                                                                                                                                           | Visible Foundry v14 Build 365 evidence                                                                                                                                                                                                                                                                      | Result |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Migration chain              | 48 contiguous files; schema marker, manifest flag, index imports, and loader agree                                                                                                                                                           | Existing development world reaches ready with the complete Character Template authoring contract                                                                                                                                                                                                            | Pass   |
| Public packs                 | The base system verifies only the 15-page/43-image manual; all eight official content modules independently verify their owned deterministic packs and lawful public boundaries                                                              | The GM opened the nine-record Second Edition Core Templates pack in its Core Content folder and exercised all nine exact scaffolds; the previously accepted Adventure Skills and templates remain 61 and ten records without moved package identities                                                       | Pass   |
| Open D6 Space genre package  | Module verification proves 277 bounded records, ten deterministic packs, public-API registration, source-page provenance, and the OGL/public-content boundary                                                                                | GM selected Space, saw all ten packs/templates, created and reloaded a six-Attribute Bounty Hunter with exact displayed combined Skills and three Items, then removed it; the mode-neutral catalog label also survived reload                                                                               | Pass   |
| Open D6 Fantasy package      | Module verification proves 54 Skills, 141 equipment records, 38 manifestations, four ancestries/20 bundled mechanics, 12 Vehicles, four ship Weapons, 14 generic profiles, ten templates, and eight deterministic packs                      | GM and TyfTester saw all eight packs. TyfTester opened the 38-record Manifestation pack, a First Edition spell, a Strength Damage Battle Axe, and the Galleon Vehicle. A trained 2D spell cast resolved against Difficulty 5 and produced a Fantasy-specific chat audit; reload and fixture cleanup passed. | Pass   |
| Open D6 Adventure package    | Module verification proves 61 Skills, 24 Advantages, 44 Disadvantages, 54 Special Abilities, 150 equipment records, 24 Vehicles, 37 generic manifestations, 18 generic profiles, ten templates, and nine deterministic packs                 | GM opened every pack, applied Stage Magician at exact 18D/7D, and rolled Adventure Magic and Psionics with printed difficulty/page audit. Fresh embedded records retained their First Edition schema after reload. TyfTester opened the template and manifestation packs and retained access after reload.  | Pass   |
| Shared compendium usability  | Compatibility, ownership, stable member references, copy sanitization, edition-aware templates, species bounds, protected specialization routes, transfer rollback, sorting, world-Item/source-Actor distinction, and sheet-route tests pass | GM authored and reloaded species bounds; an incorrect world-Item transfer prompt was caught and fixed; TyfTester had 23 draggable owned Item rows. The final specialized HTML5 drop is not re-claimed because the Chrome pointer bridge stopped completing drops                                            | Pass   |
| GM startup and reload        | Eleven bundle/loader gates cover the base system, every official content module, both adapters, package/profile registries, and schema 48                                                                                                    | GM retained the Adventure selection, seven-Attribute Actor, and correctly discriminated embedded spell/psionic records through reload; D6 system and adapter initialization completed cleanly                                                                                                               | Pass   |
| Player visibility and reload | Pack verification and role-specific automated suites                                                                                                                                                                                         | TyfTester opened the Adventure template and manifestation packs and retained player access after reload without GM-only world controls                                                                                                                                                                      | Pass   |
| Private companion boundary   | Synthetic isolated companion preserved its private description and matching release metadata                                                                                                                                                 | No private companion was installed or exposed in the public world                                                                                                                                                                                                                                           | Pass   |
| Local/public availability    | HTTP route probes                                                                                                                                                                                                                            | `foundry-dev` healthy; local `/dev` responded and public `/dev/game` redirected unauthenticated access to `/dev/join` as expected                                                                                                                                                                           | Pass   |

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

The final `npm run check` result for alpha.32/schema 48 passed 188 test files /
852 tests, all 11 production bundles, all eight official module verifiers, the
15-page/42-image User Manual, clean modular staging, release/invariant checks,
and generated-loader smoke.

## Exact next pass

**Beta 1 release-candidate packaging and clean install/upgrade acceptance.**
