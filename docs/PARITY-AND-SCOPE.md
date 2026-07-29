# Parity and scope

OpenD6 Next is a reference for architecture, UX, integrations, and migration
discipline. It is not a Second Edition rules source.

The current pass adds the OpenD6 Next-style Second Edition creation workflow,
Advanced Skill and Specialization relationships, profile-aware Skill
provisioning, and the earlier Combat workspace. It does not claim parity for
OpenD6 Next's action scheduler, active defenses, damage application,
vehicles/starships, powers, or full content library.

## Audited parity baseline

Audit date: 2026-07-26.

This matrix prevents “same as od6s-next” from being reduced to visual similarity.
`Intentional difference` requires a cited Second Edition rule or an explicit product
decision. `Missing` is work still owed, not an implicit scope rejection.

| Area                           | od6s-next reference behavior                                                                                         | D6 System 2e status                                                                                                                                                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persistent numeric foundation  | Attributes, skills, damage pools, and related die codes use one integer score measured in pips                       | **Implemented:** schema 3 uses the same canonical unit; the earlier separate `{dice, pips}` design was rejected                                                                                                                                 |
| Die-code projection            | Integer score converts losslessly using three pips per die                                                           | **Implemented:** storage is lossless; effective projection is whole-die core 2e, optional Module: Pips, or classic OpenD6                                                                                                                       |
| Attribute derived score        | Persistent base plus modifiers produces a derived score                                                              | **Partial:** one persistent attribute score exists; base/modifier layering is not yet modeled                                                                                                                                                   |
| Skill derived score            | Standard skill score adds its pip increase to the governing attribute; advanced/flat skills have explicit exceptions | **Partial:** standard, standalone/contextual Second Edition Advanced Skill, and linked Specialization pools work; flat Skills remain                                                                                                            |
| Sheet modes                    | Normal, Advance, and GM-only Free Edit                                                                               | **Implemented:** Normal/Advance direct editing locked in UI and document hooks; Advance automation still pending                                                                                                                                |
| Character creation             | Creation mode, pip budgets, limits, specialization budget, and finalization                                          | **Implemented for core 2e:** protected whole-die allocation, budgets, optional module additions, Advanced Skills, Specializations, and finalization                                                                                             |
| Advancement                    | Used-this-session state, costs, one-pip increases, and Character Point transactions                                  | **Intentional difference pending:** Second Edition offers multiple advancement modules                                                                                                                                                          |
| Character sheet shell          | Cinematic header, task tabs, resources, attribute columns, linked skills, responsive layout                          | **Partial:** Attributes, Biography, Traits & Equipment, and Combat tabs are present; powers and richer resources remain                                                                                                                         |
| Actor types                    | Character, NPC, creature, vehicle, starship, and container capabilities                                              | **Substantial:** character, NPC, and creature share the typed character foundation; schema 10 adds native Second Edition vehicle/starship Actors and sheets; generic container remains an importer/content decision                             |
| Item types                     | Skills, specializations, equipment, weapons, armor, powers, and setting-extensible content                           | **Partial:** the compatibility families are admitted with typed schemas; several currently reuse their closest foundation model                                                                                                                 |
| Typed roll pipeline            | Attribute, skill, item, damage, resistance, reaction, and request rolls share a system service                       | **Partial:** attribute, skill, weapon attack, raw weapon damage, Hero Point reroll, and Doubling Down share one service; resistance, reaction, and damage comparison remain                                                                     |
| Wild Die and resource spending | Typed policies and result records drive chat and integrations                                                        | **Implemented core:** both Wild Die policies, 2e awards, Die Code doubling, failed-roll rerolls, and Stunned prevention use typed services                                                                                                      |
| Chat cards                     | Structured roll result data; no text parsing                                                                         | **Implemented for basic rolls:** neutral themed HTML is derived from versioned result flags                                                                                                                                                     |
| Conditions and damage          | Derived resistance, condition lifecycle, and authoritative application services                                      | **Partial:** a persistent manual condition track exists; comparison/application automation is blocked by the recorded page 33 contradiction                                                                                                     |
| Combat state                   | Combatant/Combat ownership, declarations, reactions, passes, and recovery                                            | **Missing; must be rebuilt from Second Edition timing**                                                                                                                                                                                         |
| Permissions                    | Owner editing, GM corrections, remote requests, and authority checks                                                 | **Partial:** direct pip writes and skill creation require GM Free Edit; the local GM/player ownership matrix passed, while remote-owner routing remains                                                                                         |
| Advancement                    | Mode-specific costs, resource spending, confirmation, ownership, and authoritative mutation                          | **OpenD6 and 2e XP implemented:** OpenD6 uses Character Points; selected Second Edition Experience Points improve Attributes and Skills with whole-die/Pips behavior. Milestone, Narrative, and 2e Specialization acquisition remain planned    |
| Migrations                     | Ordered, idempotent transforms with per-document metadata                                                            | **Implemented foundation:** schema 11 adds native feature documents while preserving cross-edition resources, machine state, creature overrides, and unknown imported data                                                                      |
| Public API                     | Version negotiation, read models, rolls, registries, combat services                                                 | **Partial:** Actor read model, registries, roll/reroll, and condition commands are live; broader authoritative combat services remain                                                                                                           |
| Themes and terminology         | Validated live registries with safe fallback                                                                         | **Foundation implemented:** owner-scoped validated registrations; selection and render adapters still missing                                                                                                                                   |
| Settings architecture          | Shared settings plus grouped rules, creation, automation, and presentation options                                   | **Implemented foundation:** grouped menus expose versioned campaign and cross-edition capability profiles, including inactive/planned behavior                                                                                                  |
| Token Action HUD               | Separate thin adapter over public API                                                                                | **Missing by phase; API not ready**                                                                                                                                                                                                             |
| Dice So Nice                   | Optional presentation integration                                                                                    | **Implemented and live-verified foundation:** every standard denomination uses theme gold with Amiri faces while `dw` remains the only black die; `db`, finish/size settings, face assets, and companion-contributed profiles remain later work |
| Companion contract             | Modules contribute theme, terminology, presets, and content without becoming rules engines                           | **Foundation implemented:** profile/terminology/theme API ready; separate module scaffolds and content pending                                                                                                                                  |
| Import from od6s-next          | Explicit mapping utility with dry run and preservation                                                               | **Not promised; mapping study missing**                                                                                                                                                                                                         |

The next parity review must update this table before any area is described as
equivalent to od6s-next.

## Cross-edition rules profile

| Switch            | Second Edition default           | OpenD6 compatibility                     |
| ----------------- | -------------------------------- | ---------------------------------------- |
| Success evaluator | Score must exceed difficulty     | Score may meet or exceed difficulty      |
| Wild Die          | Advantage/Complication strategy  | Classic exploding/critical strategy      |
| Meta-currency     | Hero Points                      | Character Points and Fate Points         |
| Defenses          | Static derived defenses          | Active defense workflows                 |
| Damage            | Opposed condition strategy       | First Edition resistance/wounds strategy |
| Advancement       | Selected Second Edition module   | Character Point improvement              |
| Attributes        | Four core plus selected modules  | Six-field Space-compatible profile       |
| Pips              | Whole dice; optional Pips module | Classic +1/+2 progression                |

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

- damage mortal-wound trigger;
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
