# Genre and companion contribution contract

Genre packages and setting companions are actual Foundry add-on modules. They
use the same public contribution mechanism and do not replace system ownership.
A genre package supplies a broad campaign foundation; a companion adapts or
extends a selected foundation for a particular setting.

This document describes the agreed target boundary. The existing terminology,
theme, and equipment-catalog registries implement only part of it; the unified
versioned package manifest, campaign-package resolver, cross-category conflict
diagnostics, and placeholder resolver remain to be implemented.

## Package availability and activation

- Installing and enabling a Foundry module makes its contributions available.
- A system-owned world setting explicitly selects one authoritative campaign
  package and, when compatible, one setting companion.
- Load order never decides rules ownership.
- Multiple visual themes may be available at once, but incompatible mechanical
  contributions produce a visible conflict instead of a silent merge.
- Missing selected packages retain their stored IDs and data, report the
  unavailable owner, and fall back safely without deleting documents.

## Allowed contributions

- package identity, API compatibility, dependencies, and conflicts;
- rules presets that select system-implemented strategies;
- Attribute, Skill, terminology, and character-creation catalogs;
- terminology entries keyed by stable generic IDs;
- semantic theme tokens, scoped CSS class, and optional owner-scoped pause
  artwork;
- logos, decorations, fonts, and placeholder artwork through supported render
  adapters;
- optional Dice So Nice appearance profiles;
- validated campaign configuration presets;
- licensed compendium content;
- licensed equipment catalogs using the system-owned era, kind, source, and
  document-data schema;
- lawful Perk, Flaw, and Talent catalogs using the system-owned definition,
  source, creation, and semantic-mechanics schema;
- translations;
- power-discipline content using system-approved schemas.

## Prohibited behavior

- replacing default Actor or Item sheets;
- replacing system templates;
- importing private source or generated bundle internals;
- calculating rules or penalties independently;
- making activation depend on Foundry module load order;
- writing private flags, combat state, or resources directly;
- writing private system setting keys or injecting controls into private system
  settings applications;
- broad DOM text replacement;
- mutating a global configuration snapshot;
- overriding generic system CSS outside the registered scope;
- making a companion mandatory for generic system operation.

Package-specific options may appear under that package's own Foundry settings
category. Shared campaign-package, companion, and presentation selection remain
system-owned settings populated from registered contributions.

## Registration lifecycle

Contributions are owner-scoped, validated, and immutable. A companion registers
during the documented setup lifecycle and unregisters its owner ID when disabled.
Unavailable stored IDs remain stored but resolve to the built-in generic fallback.

Registered themes are added to the existing world and personal theme setting
choices without a reload-sensitive snapshot. Disabling a companion removes its
themes from the choices immediately; a stored unavailable ID is preserved but
resolves to the generic Classic fallback until its owner returns.

A theme may provide `pauseIcon` as a PNG, SVG, WebP, or AVIF below
`modules/<ownerId>/`. Foreign module paths, traversal, and unsupported formats
are rejected. The system retains ownership of pause layout and motion so a
companion contributes artwork without injecting markup or private CSS.

Equipment catalogs are the first content-oriented contribution. Catalog and
entry IDs are stable lowercase identifiers; entries declare exactly one
Medieval, Modern, or Science Fiction era, one Gear/Weapon/Armor kind, a positive
source page, and inert system document data. Registration clones and freezes the
contribution, rejects duplicate entry IDs and cross-owner catalog-ID conflicts,
and removes every catalog for an unregistered owner. The system does not execute
arbitrary code or infer mechanics from names and descriptions.

Feature catalogs follow the same owner-scoped lifecycle. Their closed contract
admits rank bounds, focus requirements, repeatability, creation cost, citation,
and inert system-owned mechanic primitives. Application snapshots the normalized
definition onto the embedded Item, so disabling a contributor never erases an
existing character's facts. Catalogs cannot contribute callbacks or executable
expressions. Public packages must have distribution rights to every supplied
name and other content; the base system exposes an empty lawful boundary only.

The deterministic resolution order is base system → selected genre → selected
companion → explicit world override. A compatible user presentation preference
may override presentation only. It never changes mechanics, campaign content,
or authoritative world rules.

Every resolved contribution retains its owner ID. The UI and diagnostics must
be able to explain where an Attribute catalog, rules strategy, theme, die
profile, or placeholder came from.

## Placeholder artwork

Foundry's stock placeholder is `CONST.DEFAULT_TOKEN`, currently
`icons/svg/mystery-man.svg`. The system must distinguish that sentinel and other
registered placeholders from artwork deliberately chosen by a user.

For recognized placeholders, resolve in this order:

1. selected companion default for the document kind;
2. selected genre default;
3. base-system default; and
4. Foundry stock fallback.

Document kinds should include at least player character, NPC, creature,
vehicle, starship/machine, Item, weapon, armor, and feature. Theme changes must
not overwrite stored custom Actor images or Token textures. Dynamic resolution
or an explicit user-approved conversion is preferred to bulk mutation.

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

## Planned package identities

- First Edition Adventure genre package, sourced from
  `/Volumes/Store/RPG/OpenD6/weg51011e-West_End_Games-D6 Adventure.pdf`.
- First Edition Fantasy genre package, sourced from
  `/Volumes/Store/RPG/OpenD6/weg51013e-West_End_Games-D6 Fantasy_v1.3.pdf`.
- First Edition Space genre package, sourced from
  `/Volumes/Store/RPG/OpenD6/weg51012OGL-D6-Space.pdf`.
- Second Edition genre packages include the printed Fantasy, Science Fiction,
  and Superheroic families. Their printed rules components remain distinct
  from the Foundry modules that package them.

- `starwarsd6-companion-d6-system-2e`: OpenD6 profile preset, six-attribute
  activation, Star Wars-specific terminology, scoped Rebel/Imperial themes,
  optional Dice So Nice profiles, and independently licensed content.
- `echod6-companion-d6-system-2e`: Echo terminology, theme, presets, logos, and
  independently licensed content.

Mechanical and Technical already have stable, latent core storage. A Star Wars
companion activates them through the profile and renames `agility`/`brawn` through
terminology; it does not add ad-hoc Actor properties or replace the sheet.

A setting companion may depend on a compatible genre package, such as a Space
foundation, through its Foundry manifest and contribution metadata. It must not
copy the genre's rules engine.

## Compatibility

Companions check the API major and required capabilities before enabling a feature.
They degrade clearly when unavailable. They do not feature-detect private properties.

## Content and licensing

Each companion owns the provenance and license of its content. The generic system
contains no Star Wars names, art, rules text, or other protected setting material.
Existing companion artwork and compendium packs are not copied into a new module
until their distribution provenance is confirmed.
