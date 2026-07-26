# Migrations

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

| Version | Change                                     | Compatibility behavior                                                                          |
| ------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 1       | Initialize per-document migration metadata | Preserves all pre-foundation source data                                                        |
| 2       | Add persistent character sheet mode        | Missing character value becomes `normal`; existing retained                                     |
| 3       | Canonical integer pip scores               | Converts legacy `{dice, pips}` attributes and skill ratings; preserves unknown keys             |
| 4       | Latent First Edition resources             | Adds Character Points (5) and Fate Points (1) without changing Hero Points or unknown resources |
