# Changelog

All notable changes will be recorded here. The project follows Semantic Versioning
once distributable releases begin.

## Unreleased

### Added

- Phase 0 discovery report based on the supplied D6 System: Second Edition v1.1 PDF.
- Stable package ID decision: `d6-system-2e`.
- Initial architecture, rules inventory, data model, API, migration, companion,
  UX, parity, roadmap, and handover documentation.
- Strict TypeScript workspace and safe ESM build foundation.
- Pure success-evaluation and migration foundations with deterministic tests.
- Versioned foundation public API with capability negotiation.
- Foundry-native initial `character` and `skill` data models.
- Minimal responsive ApplicationV2 character and skill sheets for persistence
  validation.
- Explicit localized Save actions for both foundation sheets.
- A dedicated Build 365 development world used to validate discovery, lifecycle,
  Actor/Item creation, sheet opening, and persistence through reload.

### Changed

- Corrected the installed repository directory to `d6-system-2e` so it exactly
  matches the Foundry package ID.
- Moved the manifest schema version into a namespaced package flag supported by
  the v14 manifest schema.
- Enforced the verified 1D through 5D range for core character attributes.

### Known limitations

- The sheets are persistence harnesses, not a complete playable character
  workflow; dice execution and chat cards do not exist yet.
- No broad rule automation.
- Player-role permissions and interactive narrow-layout resizing are not yet
  live-tested.
- Damage automation is blocked by a contradiction on rulebook page 33.
- Public distribution and trademark use require licensing confirmation.
