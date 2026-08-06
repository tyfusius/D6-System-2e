# ADR 0023: Universal character capabilities and world terminology

Status: Accepted

Date: 2026-08-05

## Context

Characters and Character Templates must move between lawful Second Edition,
Open D6, genre, and companion configurations without losing data. Optional
Attributes may be inactive in one campaign and active in another. The same is
true of supported personal Item families. Treating an inactive capability as
absent makes templates fragile and risks destructive profile changes.

The legacy Open D6 system also permits a GM to rename presentation vocabulary,
including Attributes, resources, Metaphysics Skills, and vehicle terms. These
names must not become document identifiers or rules selectors.

## Decision

- Character and Creature data models persist the complete supported Attribute
  superset under stable IDs. A campaign profile controls projection and rules
  activation only; it does not add or remove stored fields.
- Character Templates may store the complete Attribute superset and every
  supported personal Item family. Applying a compatible template projects only
  scores supplied for Attributes active in the destination campaign. Missing
  active Attributes and inactive stored Attributes remain unchanged; activation
  remains a separate GM rules decision.
- Character sheets show only the active Attribute projection in ordinary play.
  Their Items workspace retains supported embedded Items across profile changes,
  even when a related automation module is inactive.
- Optional sheet parts are render capabilities, not merely hidden tabs. Every
  render filters Psionics, Cyberpunk, and Superheroic parts unless the current
  campaign profile activates them.
- World terminology is a presentation-only layer applied after edition and
  companion terminology. Blank fields inherit the active package label. World
  overrides change rendered names but never stable Attribute IDs, Skill keys,
  Item types, template compatibility, migrations, or rules resolution.
- The terminology editor is available from both edition settings workspaces.
  Its contract covers the complete stored Attribute superset, character
  resources and details, Special Ability/Manifestation vocabulary,
  Metaphysics Skill names, and vehicle/starship terms.

## Consequences

Campaigns can activate or deactivate optional mechanics and content without
rewriting Actors or templates. A template authored for one lawful setting may
carry dormant capabilities into another compatible profile, while application
changes only the destination's active Attribute projection and the sheet shows
only active mechanics. Companion packages retain their owner-scoped terminology
and a GM may deliberately override it for the world.

Future Attributes or Item families require an additive schema field, a stable
identifier, projection rules, and terminology coverage. They must not be
implemented as free-form keys whose meaning changes with the displayed label.
