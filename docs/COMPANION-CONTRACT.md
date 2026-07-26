# Companion contract

Companions extend presentation, configuration, and licensed content. They do not
replace system ownership.

## Allowed contributions

- terminology entries keyed by stable generic IDs;
- semantic theme tokens and scoped CSS class;
- logos and decorations through supported render adapters;
- optional Dice So Nice appearance profiles;
- validated campaign configuration presets;
- licensed compendium content;
- translations;
- power-discipline content using system-approved schemas.

## Prohibited behavior

- replacing default Actor or Item sheets;
- replacing system templates;
- importing private source or generated bundle internals;
- calculating rules or penalties independently;
- writing private flags, combat state, or resources directly;
- broad DOM text replacement;
- mutating a global configuration snapshot;
- overriding generic system CSS outside the registered scope;
- making a companion mandatory for generic system operation.

## Registration lifecycle

Contributions are owner-scoped, validated, and immutable. A companion registers
during the documented setup lifecycle and unregisters its owner ID when disabled.
Unavailable stored IDs remain stored but resolve to the built-in generic fallback.

## Presets

A preset service must:

- validate every setting ID and expected type;
- validate module dependencies and conflicts;
- preview changes;
- skip unchanged values;
- report missing, obsolete, and failed keys;
- state whether reload is required;
- never hide rules automation inside presentation settings.

## Compatibility

Companions check the API major and required capabilities before enabling a feature.
They degrade clearly when unavailable. They do not feature-detect private properties.

## Content and licensing

Each companion owns the provenance and license of its content. The generic system
contains no Star Wars names, art, rules text, or other protected setting material.
