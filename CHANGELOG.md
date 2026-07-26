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
- OpenD6 Next-aligned ApplicationV2 character-sheet shell with a cinematic
  identity header, native tabs, attribute/skill cards, and responsive reflow.
- Neutral OpenD6 Classic charcoal-and-gold built-in theme; setting-specific blue
  presentation remains companion-owned.
- Canonical die-code formatting (`2D`, `2D+1`, `3D+2`) with normalized pip display.
- Persistent Normal, Advance, and GM-only Free Edit character-sheet modes.
- Schema migration 2 for existing character Actors without a stored sheet mode.
- Canonical integer pip-score domain functions and schema migration 3, converting
  the provisional separate `{dice, pips}` representation without discarding
  unknown fields.
- GM Free Edit controls that edit the actual pip score; every third pip is
  immediately presented as another die.
- Document-level guards against forged direct score writes and embedded skill
  creation.
- Typed Second Edition, OpenD6, and custom rules profiles with a master preset
  plus seven independent compatibility switches.
- First Edition meets-or-beats success evaluation.
- Schema migration 4 for latent Character Point and Fate Point resources.
- Owner-scoped terminology and semantic theme registries in public API v1.
- Six-field OpenD6-compatible attribute projection with Mechanical and Technical.
- A dedicated Build 365 development world used to validate discovery, lifecycle,
  Actor/Item creation, sheet opening, and persistence through reload.
- One typed attribute/standard-skill roll pipeline shared by sheet controls and
  public API.
- Profile-aware difficulty evaluation and verified Second Edition and First
  Edition Wild Die resolution, including repeated explosions and typed choices.
- ApplicationV2 roll builder with optional difficulty, flat modifier, and public,
  GM, blind, or self roll visibility.
- Neutral OpenD6 Classic chat cards backed by structured `D6RollResultV1` flags.
- Second Edition Hero Point awards produced by resolved Advantage/Complication
  outcomes.
- Pure Second Edition opposed-roll evaluation with PC/NPC and Wild Die tie
  breakers, plus roll-dialog and chat-card support.
- Transactional Hero Point Die Code doubling using the complete canonical pip
  score.
- Immutable public Actor read model for future HUD, macro, and companion
  consumers.
- OpenD6 Next-aligned cinematic roll cards with portrait-led identity, circular
  dice, a burst-backed Wild Die, isolated total, semantic result band, and
  resource transaction footer.
- A dedicated cinematic Wild Die decision surface with the rolled Wild Die face,
  current total, explicit outcome buttons, and narrow-layout reflow.
- Direct ports of the canonical OpenD6 Next roll-builder shell, dialog controls,
  global chat container, and cinematic result-card component.
- Direct port of the OpenD6 Next ApplicationV2 character window shell and
  identity-header components, including artwork frame, name treatment, resources,
  condition summary, grid background, and theme watermark.
- Direct ports of the OpenD6 Next sheet utilities, tabs, attribute and skill
  panels, biography workspace, and Skill Item sheet shell. The Skill Item header
  now uses canonical die-code presentation and delegates rolls to the shared
  public roll pipeline.

### Changed

- Corrected the installed repository directory to `d6-system-2e` so it exactly
  matches the Foundry package ID.
- Moved the manifest schema version into a namespaced package flag supported by
  the v14 manifest schema.
- Enforced the verified 1D through 5D range for core character attributes.
- Replaced the character persistence harness with the first player-facing
  character-sheet UX slice.
- Replaced separate persistent dice and pip components with the OpenD6-compatible
  integer-score foundation used by od6s-next.
- Locked canonical attribute and skill pip scores outside GM Free Edit.
- Removed skill Add/Edit controls from Normal and Advance modes and reserved
  Advance as the only player-facing skill-increase workflow.
- Replaced the earlier interpreted roll/chat design with the actual OpenD6 Next
  component structure and CSS contract. UI parity is now an explicit acceptance
  criterion rather than a general visual reference.

### Known limitations

- The roll pipeline does not yet support Hero Point rerolls, Stunned prevention,
  combat action context, damage, resistance, or follow-up actions.
- Player-triggered Second Edition Complications that require a GM decision stop
  safely until the authoritative remote-GM socket workflow exists.
- Advance mode does not spend advancement currency until a Second Edition
  advancement module is selected.
- No broad rule automation.
- Player-role permissions and interactive narrow-layout resizing are not yet
  live-tested.
- Damage automation is blocked by a contradiction on rulebook page 33.
- Public distribution and trademark use require licensing confirmation.
