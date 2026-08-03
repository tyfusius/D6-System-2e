# Migrations

## Schema 27: Magic Points and autofire

Personal Actors receive a loss-preserving Magic Point resource with an
uninitialized marker so existing casters first present their lawful derived
maximum. Weapon families receive a non-negative `autofireRating` default of
zero. Repeated migration preserves valid values.

## Guarantees

Every persistent schema change has:

- a positive, monotonically increasing integer version;
- a typed unknown-input boundary;
- deterministic and idempotent transformation;
- preservation of unknown data;
- a report with changed, skipped, warning, and failure counts;
- tests for current, old, malformed, and repeated inputs;
- metadata recorded only after all writes for that document succeed.

The manifest `flags.d6-system-2e.schemaVersion` value and latest migration schema
version remain aligned. A namespaced flag is used because `templateVersion` is not
part of Foundry v14's current system-manifest schema.

## Runner behavior

The pure runner:

1. clones the source;
2. reads the current schema, treating missing metadata as version 0;
3. selects ordered migrations above that version;
4. applies Actor and embedded Item transforms to the clone;
5. returns the migrated clone and report;
6. records target metadata only after successful completion.

The Foundry world service separately controls document reads, batched writes,
permissions, progress UI, backup warnings, and failure recovery.

## Idempotency

Running the same migration plan on an already current source produces no changes.
A migration may not depend on wall-clock time, random values, current localization,
theme, sheet state, or module load order.

## Failure handling

- Stop advancing the affected document after a failure.
- Leave its recorded version unchanged.
- Continue only when doing so cannot create cross-document inconsistency.
- Present a permanent GM notification and a downloadable report.
- Never delete unknown keys to make validation pass without reporting them.

## World settings

The world stores one current schema version only as a progress/index aid. Individual
documents retain their own metadata because imports and compendiums can introduce
older sources later.

## Importers

OpenD6 Next compatibility will be a separate, explicit importer:

- runs on exported/backed-up data, never direct LevelDB replacement;
- produces a dry-run mapping report;
- preserves original UUIDs where safe;
- records source system and version;
- preserves unknown flags and data;
- distinguishes exact, lossy, skipped, and unresolved mappings.

No automatic compatibility claim exists yet.

## Implemented versions

| Version | Change                                       | Compatibility behavior                                                                                                                                                                 |
| ------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | Initialize per-document migration metadata   | Preserves all pre-foundation source data                                                                                                                                               |
| 2       | Add persistent character sheet mode          | Missing character value becomes `normal`; existing retained                                                                                                                            |
| 3       | Canonical integer pip scores                 | Converts legacy `{dice, pips}` attributes and skill ratings; preserves unknown keys                                                                                                    |
| 4       | Latent First Edition resources               | Adds Character Points (5) and Fate Points (1) without changing Hero Points or unknown resources                                                                                        |
| 5       | Admit cross-edition Item families            | Registers typed Item unions without coercing existing or imported legacy fields                                                                                                        |
| 6       | Add Second Edition condition state           | Existing Actors use the non-destructive `healthy` default; unknown health data remains                                                                                                 |
| 7       | Admit compatibility document families        | Registers NPC, creature, and compatibility Item families without rewriting source concepts                                                                                             |
| 8       | Add creation and Skill relationships         | Existing/imported Actors remain out of creation; Skills receive empty prerequisite lists; Specializations gain source fields without replacing known data                              |
| 9       | Latent Second Edition advancement resource   | Adds Experience Points (0) without converting Hero Points, OpenD6 currencies, or unknown resource data                                                                                 |
| 10      | Machine Actors and creature defenses         | Admits vehicle/starship fields and zero-valued creature defense overrides while preserving valid and unknown imported data                                                             |
| 11      | Second Edition character features            | Adds source-backed Perk, Flaw, Talent, Trouble, and Asset fields without coercing OpenD6 compatibility Items                                                                           |
| 12      | Explicit Specialization creation allocation  | Existing Actors with Specialization Items receive three slots; all others receive zero, preserving unknown creation data                                                               |
| 13      | Second Edition advancement workflows         | Adds zeroed Milestone reward balances and an empty Narrative arc list while preserving existing and unknown advancement data                                                           |
| 14      | Movement posture and scale                   | Adds standing posture and personal scale ranks without changing machine scale                                                                                                          |
| 15      | Machine crew rosters                         | Adds loss-preserving Vehicle and Starship crew arrays; valid existing actor IDs and names are retained and deduplicated                                                                |
| 16      | Personal base Move                           | Adds `movement.base` 10 to Characters, NPCs, and creatures; valid existing values are preserved and machine Actors are unchanged                                                       |
| 17      | Independent First Edition wounds             | Adds `health.firstEditionWound` as Healthy to personal Actors; valid wound IDs and all Second Edition health data are preserved                                                        |
| 18      | First Edition injury and consciousness state | Adds a separate conscious state to personal Actors; existing Incapacitated wounds become unresolved, Mortally Wounded becomes unconscious, and valid existing state is preserved       |
| 19      | First Edition mortality clock                | Adds zero completed Mortally Wounded rounds and an empty processed-round ID to personal Actors while preserving all wound and consciousness data                                       |
| 20      | Second Edition environment effects           | Adds an inactive, versioned environment-effect record to personal Actors; valid prior fields and unknown environment data are preserved, while machine Actors remain unchanged         |
| 21      | Equipment era and catalog provenance         | Adds an unclassified provenance record to equipment Items; valid era/catalog/source fields and unknown data are preserved, while non-equipment Items remain unchanged                  |
| 22      | Narrative Perk rewards                       | Admits Perk-backed Narrative arcs, preserving existing Attribute/Skill arcs and imported Perk arc data while supplying only missing safe defaults                                      |
| 23      | First Edition Body Points                    | Adds inactive current/maximum Body Points while preserving Wounds, legacy point shapes, and machine Actors                                                                             |
| 24      | Legacy accumulating stuns                    | Adds an inactive versioned stun count, penalty, round duration, and processed-round marker to personal Actors                                                                          |
| 25      | Character template application state         | Adds empty applied-template provenance to Characters only; existing creation state and canonical template data are preserved idempotently                                              |
| 26      | Freeform Manifestation design                | Adds safe school, Power, target, resistance, duration, casting-time, and range defaults only to Manifestation Items; existing and unknown Item data remain preserved                   |
| 27      | Magic Points and weapon autofire             | Adds an uninitialized Magic Point pool to personal Actors and zero autofire ratings to weapon families while preserving existing values                                                |
| 28      | Creature bestiary provenance                 | Adds empty typed catalog/entry/source provenance to Creature Actors only; existing creature mechanics and unknown fields remain unchanged                                              |
| 29      | Persisted Dodge basis                        | Adds the Perception default to personal Actors while preserving an authored Flying basis                                                                                               |
| 30      | Thrown-explosive Weapon profile              | Adds `standard` as the safe kind for existing personal Weapons and a zero Short minimum; authored thrown-explosive kinds and valid minima are preserved                                |
| 31      | Psionics attempt state                       | Adds an empty 24-hour power-attempt ledger to personal Actors while preserving unknown Psionics data; machine Actors remain unchanged                                                  |
| 32      | Cyberpunk state                              | Adds reload-safe personal Firewall hardening to personal Actors and typed kind, Talent link, rank, installation, and disable state to Cybernetic Items while preserving unknown data   |
| 33      | Superheroic identity state                   | Adds the separate Secret Identity pool, Suspicion, names, and status while preserving unknown superheroic data                                                                         |
| 34      | Superpower Talent fields                     | Adds generic Superpower accounting fields to Talent Items without distributing or inferring named content                                                                              |
| 35      | Superheroic equipment                        | Adds typed Gadget/Gear state and portable power snapshots while preserving ordinary equipment data                                                                                     |
| 36      | Hidden Bases and Hideouts                    | Admits standalone Hideout Actors with loss-preserving feature, member, and relocation state                                                                                            |
| 37      | Superheroic relationships                    | Adds a loss-preserving half-budget Sidekick marker and protected Nemesis, Companion, mentor, status, confirmation, point, encounter, and Experience fields to personal Actors          |
| 38      | Superheroic Template provenance              | Extends Character template provenance with a core/superheroic family, exact starting Superpower dice, and deduplicated stable feature-definition IDs while preserving schema-25 fields |
