# Beta readiness

Audit date: 2026-08-04.

## Decision

The finite Second Edition mechanics roadmap is complete and schema 44 is
current. The user correctly moved the missing Open D6 First Edition genre
content ahead of Beta 1 packaging. The shared package registry and explicit
world-selection foundation and specialized compendium usability are complete;
The D6 Fantasy public package is now content-complete across eight packs,
including dedicated First Edition Magic/Miracles, ancestry bundles, equipment,
and Vehicles. D6 Adventure and final cross-package onboarding/acceptance remain
before Beta packaging.

## Release boundary

- Public system version: `0.1.0-alpha.25`; schema: 44.
- All root, workspace, lockfile, generated-pack, private-companion, and Token
  Action HUD adapter release metadata is now derived from or synchronized with
  the public system version.
- The public system manifest contains the User Manual, the Open D6 Skill pack,
  four Fantasy Creature Actors, and four Fantasy Character Template references.
  The separately activatable Core Content module owns the unchanged 49-entry
  Second Edition Skill pack and 84-Item Equipment pack. Feature, hideout, and Psionics
  contribution catalogs remain empty where permission is required.
- The separately installable Open D6 Space genre module contains ten
  deterministic Foundry packs and 277 bounded OGL mechanical records. It
  registers package, equipment, template, and First Edition bestiary catalogs
  only while enabled; availability never selects the world package.
- `npm run release:verify` proves a contiguous migration chain from 001 through
  044, validates the public boundary, and builds a one-entry synthetic private
  companion in an isolated temporary directory. The fixture and temporary
  package are removed after verification; no private input or generated private
  pack enters the repository.
- A real local private companion remains optional and must be built only from
  lawfully held source material under the ignored `private-content/` input.

## Acceptance matrix

| Boundary                     | Automated evidence                                                                                                                                                                                                                           | Visible Foundry v14 Build 365 evidence                                                                                                                                                                                                                                                                      | Result |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Migration chain              | 44 contiguous files; schema marker, manifest flag, index imports, and loader agree                                                                                                                                                           | Existing development world reached ready after the planned restart and applied the schema-44 UUID compatibility boundary                                                                                                                                                                                    | Pass   |
| Public packs                 | 49 D62e Skills, 60 OD6 Skills, 84 Equipment Items, four Fantasy Creatures, and four Fantasy Templates match structured catalogs; the Core packs verify under their independent module; 15-page/43-image manual verified                      | With Core Content inactive, the GM saw the empty-content guidance. After activation, the GM opened the module-owned 49-entry Skill and 84-entry Equipment packs; unchanged Fantasy and User Manual boundaries remained visible                                                                              | Pass   |
| Open D6 Space genre package  | Module verification proves 277 bounded records, ten deterministic packs, public-API registration, source-page provenance, and the OGL/public-content boundary                                                                                | GM selected Space, saw all ten packs/templates, created and reloaded a six-Attribute Bounty Hunter with exact displayed combined Skills and three Items, then removed it; the mode-neutral catalog label also survived reload                                                                               | Pass   |
| Open D6 Fantasy package      | Module verification proves 54 Skills, 141 equipment records, 38 manifestations, four ancestries/20 bundled mechanics, 12 Vehicles, four ship Weapons, 14 generic profiles, ten templates, and eight deterministic packs                      | GM and TyfTester saw all eight packs. TyfTester opened the 38-record Manifestation pack, a First Edition spell, a Strength Damage Battle Axe, and the Galleon Vehicle. A trained 2D spell cast resolved against Difficulty 5 and produced a Fantasy-specific chat audit; reload and fixture cleanup passed. | Pass   |
| Shared compendium usability  | Compatibility, ownership, stable member references, copy sanitization, edition-aware templates, species bounds, protected specialization routes, transfer rollback, sorting, world-Item/source-Actor distinction, and sheet-route tests pass | GM authored and reloaded species bounds; an incorrect world-Item transfer prompt was caught and fixed; TyfTester had 23 draggable owned Item rows. The final specialized HTML5 drop is not re-claimed because the Chrome pointer bridge stopped completing drops                                            | Pass   |
| GM startup and reload        | Six bundle and loader gates cover Core Content registration, both installable genre modules, the content/package/profile registries, and schema 44                                                                                           | GM activated Core Content, retained both extracted packs after reload, and still saw the Second Edition primary rules profile with no imported mechanics. The final GM reload had no system/module warning or error                                                                                         | Pass   |
| Player visibility and reload | Pack verification and role-specific automated suites                                                                                                                                                                                         | TyfTester saw both module-owned Core packs, retained them after reload, and received neither Module Management nor the edition Configure control                                                                                                                                                            | Pass   |
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

`npm run check` passed formatting, lint, TypeScript, 177 test files / 800 tests,
all six production bundles, the Core Content, base, Open D6 Space, Open D6
Fantasy, and Echo deterministic packs, the 15-page/43-image user manual, the
release and public-content boundaries, package invariants, and the generated
schema-44 bundle lifecycle smoke.

## Exact next pass

**Modular Content Architecture — Phase 2: Second Edition Fantasy extraction.**
Phase 1 established the package and primary/imported-mechanics contracts and
extracted the lawful Core packs. Continue ADR 0022 by moving the current
Fantasy Creature and Character Template packs while preserving IDs, UUID
compatibility, provenance, and activation independence. After the finite
modular-content sequence and highlighted-roll-request pass, continue with **D6
Adventure public-content implementation.** Audit the Adventure authority
and legacy reference, then build its genre profile, lawful mechanical catalogs,
templates, generic Actors, and genre-specific rule contracts as the third
installable Open D6 First Edition package.
