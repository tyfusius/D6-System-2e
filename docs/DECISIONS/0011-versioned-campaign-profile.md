# ADR 0011: Versioned Second Edition campaign profile

Status: accepted
Date: 2026-07-27

## Context

Second Edition is modular. Independent settings are useful controls, but they
are not a sufficient integration contract: sheets, creation, compendiums,
macros, HUD adapters, and companions need one immutable interpretation of the
active campaign configuration.

The current implementation supports the four core Attributes, five optional
Attribute modules, an explicit count of additional Skill modules that grant the
printed p. 20 creation allowance, and the optional Skill Specialization &
Advanced Skills module from pp. 96-99.

## Decision

The system resolves those settings into
`SecondEditionCampaignProfileV1`. The profile contains:

- a contract version and stable `core-default` or `custom` ID;
- ordered active Attribute IDs;
- known stable module IDs;
- the explicit additional-Skill-module count;
- whether Advanced Skills and Specializations are active;
- canonical pip-score creation budgets.

Only known modules receive persistent IDs. The numeric count of unnamed
additional Skill modules affects the verified creation budget but does not
invent identities for modules the system cannot name authoritatively.

All current Second Edition Attribute projections, Skill provisioning,
character-creation validation, sheets, and the public API consume this resolved
profile. `game.system.api.campaign.current()` exposes an immutable snapshot
behind capability `campaign.profile`.

## Consequences

- The core-default profile is explicit and versioned without adding another
  mutable global configuration object.
- Companion and HUD integrations can inspect the campaign without reading
  Foundry settings or private sheet state.
- Adding initiative, advancement, genre, or companion modules requires a new
  validated profile contribution or a compatible profile-version extension;
  this decision does not claim those modules are implemented.
- Profile changes continue to preserve inactive document fields. A later impact
  report is still required before changing live campaign profiles can automate
  document transformations.
