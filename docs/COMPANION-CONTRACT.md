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

Registered themes are added to the existing world and personal theme setting
choices without a reload-sensitive snapshot. Disabling a companion removes its
themes from the choices immediately; a stored unavailable ID is preserved but
resolves to the generic Classic fallback until its owner returns.

## Presets

A preset service must:

- validate every setting ID and expected type;
- validate module dependencies and conflicts;
- preview changes;
- skip unchanged values;
- report missing, obsolete, and failed keys;
- state whether reload is required;
- never hide rules automation inside presentation settings.

The preferred compatibility call is the versioned system API:

```ts
await api.rules.applyPreset("open-d6");
```

A companion may recommend or apply this once during an explicit configurator
workflow. It must not reapply the preset every startup because that would overwrite
later GM customizations.

## Planned companion identities

- `starwarsd6-companion-d6-system-2e`: OpenD6 profile preset, six-attribute
  activation, Star Wars-specific terminology, scoped Rebel/Imperial themes,
  optional Dice So Nice profiles, and independently licensed content.
- `echod6-companion-d6-system-2e`: Echo terminology, theme, presets, logos, and
  independently licensed content.

Mechanical and Technical already have stable, latent core storage. A Star Wars
companion activates them through the profile and renames `agility`/`brawn` through
terminology; it does not add ad-hoc Actor properties or replace the sheet.

## Compatibility

Companions check the API major and required capabilities before enabling a feature.
They degrade clearly when unavailable. They do not feature-detect private properties.

## Content and licensing

Each companion owns the provenance and license of its content. The generic system
contains no Star Wars names, art, rules text, or other protected setting material.
Existing companion artwork and compendium packs are not copied into a new module
until their distribution provenance is confirmed.
