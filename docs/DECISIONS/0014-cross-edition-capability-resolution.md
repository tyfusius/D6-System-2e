# ADR 0014: Cross-edition capability resolution

Status: accepted

Date: 2026-07-27

## Context

The system supports a native Second Edition profile, a complete OpenD6 preset,
and independently mixed compatibility switches. Rules behavior cannot safely be
inferred from the display name, the complete profile ID, or an unrelated switch
such as the Attribute family.

## Decision

- A pure, versioned `EditionCapabilityProfileV1` resolves each rules family.
- Every decision has a stable ID, rules owner, strategy ID, and state.
- States are `active`, `inactive-preserved`, or `planned`.
- Foundry settings adapt stored world choices into this pure profile.
- Sheets, roll services, read models, public integrations, and later HUD
  adapters consume the same resolved decision instead of repeating edition
  conditionals.
- `game.system.api.rules.capabilities()` exposes an immutable public snapshot.
- Optional cross-edition ideas require an explicit setting and identify the
  borrowed rules owner; they do not become part of the OpenD6 preset silently.

## Consequences

Mixed campaigns remain supported without becoming ambiguous. Stored documents
survive profile changes, incomplete automation is visible, and companions can
inspect capabilities without importing private settings or recalculating rules.
