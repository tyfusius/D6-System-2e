# ADR 0009: Edition settings ownership

Status: Accepted; amended by ADR 0021 on 2026-08-03

## Context

The system supports native D6 System Second Edition rules and an optional
Open D6 First Edition compatibility profile. OpenD6 Next also contains a large
historic settings surface. Copying those settings without classifying their
ownership would expose controls for absent mechanics, couple generic behavior
to one edition, and make companion presets write private configuration.

## Decision

Foundry's system settings page has three ownership levels:

1. Shared settings remain directly in the root system settings. They configure
   presentation or workflows used by either edition: theme selection, roll
   visibility, default difficulty, roll-builder sections, and shared Item
   visibility.
2. **Open D6 First Edition** is an ApplicationV2 submenu. It owns the complete
   OpenD6 master preset, its eight independently configurable compatibility
   switches, and First Edition-only creation, advancement, Wild Die, damage,
   scale, and resource options.
3. **D6 System Second Edition** is an ApplicationV2 submenu. It owns the modular
   optional Attributes, starting Hero Points, and supported Hero Point
   automation.

The master First Edition checkbox updates all seven compatibility controls.
Manually selecting only some controls produces a typed `custom` rules profile.
Turning the complete profile off does not destroy edition-specific option
values; it changes only which rules are active.

Settings that only controlled retired OpenD6 Next implementation details are
not copied. Setting-specific mechanics are added only when the system has a
typed consumer or the UI states that the value is reserved for its named
authoritative service.

Companion modules use the public `rules.applyPreset`, terminology registry, and
theme registry. They inspect resolved behavior through
`rules.capabilities()`. They do not write private settings or replace these
applications.

Genre packages and setting companions are Foundry add-on modules using the same
public contribution boundary. Enabling one makes its contributions available;
the system-owned campaign-package, companion, and world-theme selectors decide
which registered contributions are active. A package may own settings in its
own Foundry category, but it may not inject controls into these system
applications or mutate their private keys. See ADR 0020.

ADR 0021 refines the presentation without changing this ownership model. The
root category becomes a concise campaign-setup surface with one world-scoped
Game Mode selector and shared preferences. Edition-specific controls appear
only in their dedicated workspaces. **Open D6 First Edition** is the full
user-facing name; **OD6** is its abbreviation.

## Consequences

- Edition ownership is visible and understandable in Foundry.
- Existing compatibility keys remain stable, so current worlds retain values.
- The roll builder, Actor read model, character sheet, Item sheet, theme
  resolver, and character-creation hook consume the shared catalog.
- Additional OpenD6 Next parity settings require classification and a typed
  consumer before being admitted.
- The setting catalog is tested for unique stable keys and category ownership.
- Package-specific settings appearing under their own module category are normal
  Foundry behavior and do not violate system ownership.
