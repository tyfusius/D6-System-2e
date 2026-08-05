# Parity and scope

OpenD6 Next is a reference for architecture, UX, integrations, and migration
discipline. It is not a Second Edition rules source.

## Beta reconciliation

The matrix below is the dated 2026-07-26 foundation baseline, not the current
release ledger. It is retained to show how the implementation was originally
classified. Current feature status and live evidence are authoritative in
`OD6S-NEXT-PARITY.md`, current rules scope is authoritative in
`RULES-INVENTORY.md`, and the 2026-08-03 release decision is recorded in
`BETA-READINESS.md`. No item described as partial or pending in the historical
matrix silently reopens the finite beta roadmap.

The foundation pass added the OpenD6 Next-style Second Edition creation workflow,
Advanced Skill and Specialization relationships, profile-aware Skill
provisioning, and the earlier Combat workspace. It does not claim parity for
OpenD6 Next's action scheduler, active defenses, damage application,
vehicles/starships, powers, or full content library.

## Audited parity baseline

Audit date: 2026-07-26.

This matrix prevents “same as od6s-next” from being reduced to visual similarity.
`Intentional difference` requires a cited Second Edition rule or an explicit product
decision. `Missing` is work still owed, not an implicit scope rejection.

| Area                           | od6s-next reference behavior                                                                                         | D6 System 2e status                                                                                                                                                                                                                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persistent numeric foundation  | Attributes, skills, damage pools, and related die codes use one integer score measured in pips                       | **Implemented:** schema 3 uses the same canonical unit; the earlier separate `{dice, pips}` design was rejected                                                                                                                                                                                                   |
| Die-code projection            | Integer score converts losslessly using three pips per die                                                           | **Implemented:** storage is lossless; effective projection is whole-die core 2e, optional Module: Pips, or classic OpenD6                                                                                                                                                                                         |
| Attribute derived score        | Persistent base plus modifiers produces a derived score                                                              | **Partial:** one persistent attribute score exists; base/modifier layering is not yet modeled                                                                                                                                                                                                                     |
| Skill derived score            | Standard skill score adds its pip increase to the governing attribute; advanced/flat skills have explicit exceptions | **Partial:** standard, standalone/contextual Second Edition Advanced Skill, and linked Specialization pools work; flat Skills remain                                                                                                                                                                              |
| Sheet modes                    | Normal, Advance, and GM-only Free Edit                                                                               | **Implemented:** Normal/Advance direct editing locked in UI and document hooks; Advance automation still pending                                                                                                                                                                                                  |
| Character creation             | Creation mode, pip budgets, limits, specialization budget, and finalization                                          | **Implemented for core 2e:** protected whole-die allocation, budgets, optional module additions, Advanced Skills, Specializations, and finalization                                                                                                                                                               |
| Advancement                    | Used-this-session state, costs, one-pip increases, and Character Point transactions                                  | **Implemented with edition-specific workflows:** OpenD6 retains Character Point advancement; Second Edition supports Experience Points, Milestone reward pools/Perk exchange, and GM-approved Narrative arcs                                                                                                      |
| Character sheet shell          | Cinematic header, task tabs, resources, attribute columns, linked skills, responsive layout                          | **Partial:** Attributes, Biography, Traits & Equipment, and Combat tabs are present; powers and richer resources remain                                                                                                                                                                                           |
| Actor types                    | Character, NPC, creature, vehicle, starship, and container capabilities                                              | **Substantial:** character, NPC, and creature share the typed character foundation; schema 10 adds native Second Edition vehicle/starship Actors and sheets; generic container remains an importer/content decision                                                                                               |
| Item types                     | Skills, specializations, equipment, weapons, armor, powers, and setting-extensible content                           | **Partial:** the compatibility families are admitted with typed schemas; several currently reuse their closest foundation model                                                                                                                                                                                   |
| Typed roll pipeline            | Attribute, skill, item, damage, resistance, reaction, and request rolls share a system service                       | **Partial:** attribute, skill, targeted weapon attack, targeted damage resolution, Brawn-plus-armor resistance, Hero Point reroll, and Doubling Down share one service; reaction remains                                                                                                                          |
| Wild Die and resource spending | Typed policies and result records drive chat and integrations                                                        | **Implemented core:** both Wild Die policies, 2e awards, Die Code doubling, failed-roll rerolls, and Stunned prevention use typed services                                                                                                                                                                        |
| Chat cards                     | Structured roll result data; no text parsing                                                                         | **Implemented for basic rolls:** neutral themed HTML is derived from versioned result flags                                                                                                                                                                                                                       |
| Conditions and damage          | Derived resistance, condition lifecycle, and authoritative application services                                      | **Implemented for personal 2e damage:** GM-controlled targeted Damage chat resolution rolls Brawn-plus-armor, applies the accepted Staggered/Stunned/Wounded progression and Brawn-Complication mortal result, offers Stunned prevention, and persists an idempotent audit; machine damage remains separate       |
| Combat state                   | Combatant/Combat ownership, declarations, reactions, passes, and recovery                                            | **Partial:** versioned Second Edition action declarations, penalties, GM-correctable contextual order, static-defense weapon targeting, and range audit are live; reactions and recovery remain                                                                                                                   |
| Permissions                    | Owner editing, GM corrections, remote requests, and authority checks                                                 | **Partial:** direct pip writes and skill creation require GM Free Edit; the local GM/player ownership matrix passed, while remote-owner routing remains                                                                                                                                                           |
| Advancement                    | Mode-specific costs, resource spending, confirmation, ownership, and authoritative mutation                          | **Implemented:** OpenD6 Character Points plus all three D62e profiles: Experience Points and Specialization acquisition, Milestone bundles/Perk exchange, and Narrative proposal/approval/step/completion workflows                                                                                               |
| Migrations                     | Ordered, idempotent transforms with per-document metadata                                                            | **Implemented foundation:** schema 13 adds Milestone balances and Narrative arcs while preserving Specialization allocation, features, cross-edition resources, machine state, creature overrides, and unknown imported data                                                                                      |
| Public API                     | Version negotiation, read models, rolls, registries, combat services                                                 | **Partial:** Actor read model, registries, typed attack/damage/resistance rolls, follow-ups, condition commands, and action-segment services are live; broader authoritative combat services remain                                                                                                               |
| Themes and terminology         | Validated live registries with safe fallback                                                                         | **Foundation implemented:** owner-scoped validated registrations; selection and render adapters still missing                                                                                                                                                                                                     |
| Settings architecture          | Shared settings plus grouped rules, creation, automation, and presentation options                                   | **Implemented foundation:** grouped menus expose versioned campaign and cross-edition capability profiles, including inactive/planned behavior                                                                                                                                                                    |
| Token Action HUD               | Separate thin adapter over public API                                                                                | **Implemented foundation:** separately loadable adapter consumes public API v1 for Attributes, Skills, weapons, features, and round state                                                                                                                                                                         |
| Dice So Nice                   | Optional presentation integration                                                                                    | **Implemented foundation:** every standard denomination uses a theme-selected black colorset with heavy sans-serif faces, while `dw` uses the shared antique-gold/bronze body with a profile-specific 6-face symbol; OpenD6 Classic and Echo sets are automated, while updated visible acceptance remains pending |
| Companion contract             | Modules contribute theme, terminology, presets, and content without becoming rules engines                           | **Foundation implemented:** profile/terminology/theme API ready; separate module scaffolds and content pending                                                                                                                                                                                                    |
| Import from od6s-next          | Explicit mapping utility with dry run and preservation                                                               | **Not promised; mapping study missing**                                                                                                                                                                                                                                                                           |

The next parity review must update this table before any area is described as
equivalent to od6s-next.

## Cross-edition rules profile

| Switch            | Second Edition default                | OpenD6 compatibility                     |
| ----------------- | ------------------------------------- | ---------------------------------------- |
| Success evaluator | Score must exceed difficulty          | Score may meet or exceed difficulty      |
| Wild Die          | Core or selected pp. 71–73 alternate  | Classic exploding/critical strategy      |
| Meta-currency     | Heroic, Basic, or Classic Hero Points | Character Points and Fate Points         |
| Defenses          | Static derived defenses               | Active defense workflows                 |
| Damage            | Opposed condition strategy            | First Edition resistance/wounds strategy |
| Advancement       | Selected Second Edition module        | Character Point improvement              |
| Attributes        | Four core plus selected modules       | Six-field Space-compatible profile       |
| Pips              | Whole dice; optional Pips module      | Classic +1/+2 progression                |

The master preset sets every row. Any later individual override resolves to a
`custom` profile. Only the evaluator, profile resolution, resource storage, and
active attribute projection are currently executable; the remaining strategies
are explicit implementation work, not implied automation.

## Concept mapping

| OpenD6 Next concept              | Second Edition treatment                                                      |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `agi`                            | Map candidate to stable `agility`                                             |
| `str` Strength                   | Not automatic; mapping candidate to `brawn` with report                       |
| `kno`, `per`                     | Map candidates to `knowledge`, `perception`                                   |
| Mechanical, Technical            | Optional attributes, not core defaults                                        |
| Metaphysics attribute            | No one-to-one assumption; Magic, Mysticism, and Psionics are distinct modules |
| Character Points and Fate Points | Absent from core; Hero Points are the core resource                           |
| Legacy Wild Die                  | Replaced by Second Edition core or selected alternate policy                  |
| Active defenses                  | Core uses static Dodge and Parry                                              |
| Wounds/body points               | Do not import as equivalent; Second Edition condition mapping needs study     |
| Action-pass scheduler            | Architecture reference only; not copied                                       |
| Vehicle/starship documents       | Concepts retained, schemas rebuilt from pp. 176-183                           |
| Themes and terminology           | Registry pattern retained and refined                                         |
| Token Action HUD                 | Separate adapter consuming public API                                         |
| Dice So Nice                     | Optional presentation integration                                             |

## Feature classification

### Retain as architecture

- pure domain layer;
- versioned contracts;
- application/Foundry ports;
- typed read models;
- ordered migrations;
- ApplicationV2-only UI;
- a single roll pipeline;
- registry-based companion contributions;
- thin HUD adapter;
- structured chat state.

### Rebuild from Second Edition

- dice and Wild Die flow;
- Hero Points;
- attributes and skills;
- defenses;
- damage and conditions;
- initiative and action segments;
- advancement;
- powers;
- vehicles and starships;
- item names and schemas.

### Defer pending authority or licensing

- distributable skill/equipment/template content;
- publisher logos and trade dress;
- public product naming/trademark usage;
- automated OpenD6 Next import.

## Import study categories

Future mapping reports classify every field as:

- exact;
- transformable without loss;
- transformable with user choice;
- preserved but inactive;
- unsupported and preserved;
- unsafe and rejected.

No world is migrated in place without backup and dry run.

## First milestone exclusions

The character vertical slice intentionally excludes combat automation, damage,
active effects, advancement spending, powers, vehicles, starships, compendiums,
HUD, Dice So Nice, and OpenD6 Next importing.
