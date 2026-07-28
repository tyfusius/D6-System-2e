# Changelog

All notable changes will be recorded here. The project follows Semantic Versioning
once distributable releases begin.

## Unreleased

- Added schema 10 vehicle and starship Actors with source-backed system fields,
  OpenD6 Next-style ApplicationV2 sheets, system and weapon-damage rolls,
  derived Defense/resistance, repair Conditions, equipment workspaces, and
  additive public read models.
- Added explicit creature Dodge and Parry overrides sourced to D62e p. 132.
- Added setting-dependent Token Controls toolbar buttons that reopen the PC
  Quickbar and GM Active Tasks & Requests panels after they are closed.
- Added optional per-user GM Quickbar and GM Active Tasks & Requests
  ApplicationV2 panels, with owner-targeted Attribute/Skill roll requests and
  GM cancel/takeover controls.
- Fixed GM Quickbar Die Codes rendering as `[object Object]` and prevented
  repeated ApplicationV2 refreshes from multiplying one click into overlapping
  roll dialogs or Dice So Nice animations.
- Disabled and visually muted GM Quickbar request controls when an Actor has no
  active non-GM owner.
- Restricted the GM Quickbar window and Token Controls button to Gamemasters,
  and fixed player roll-request delivery by registering its socket listener
  during Foundry's ready phase and enabling the system socket channel in the
  manifest.
- Ported OpenD6 Next's standard GM-request configuration workflow: recipient
  selection, Public/Player + GM/GM-only Blind audience cards, a versioned and
  expiring socket request, and a player roll builder locked to the GM-selected
  visibility.
- Added a dedicated Dice So Nice `dw` term and OpenD6 Classic black-and-gold
  Wild Die preset so the physical Wild Die is distinct from ordinary dice.
- Restored the complete OpenD6 Next portrait hover/focus treatment.
- Made same-change user-manual updates and refreshed UI screenshots a
  repository-level requirement.
- Added a screenshot-rich user manual covering the implemented campaign,
  character, roll, advancement, Item, combat, settings, content, permissions,
  and integration workflows.
- Added deterministic compilation of the GitHub Markdown manual into a
  Foundry v14 Journal compendium with one page per chapter.
- Added manual-pack and screenshot verification to the complete project gate.
- Added explicit Second Edition advancement profiles and a complete Experience
  Point Attribute/Skill advancement path with Module: Pips and Advanced Skill
  validation.
- Added schema 9 with a preserved, independent Experience Point resource.

### Fixed

- Vehicle and starship fields now persist through ordinary Foundry updates.
  Character-only score guards no longer cancel machine updates, and schema 10
  migration logic no longer reruns inside TypeDataModel update preparation.
- Private, blind, and self roll visibility now passes mutable recipient arrays
  across the Foundry document boundary, preventing v14 ChatMessage cleaning from
  failing on frozen arrays.
- Core Second Edition no longer treats canonical pip-unit storage as if the
  optional Pips rule were always active. Dormant `+1/+2` values are preserved
  but excluded from sheets, rolls, combat values, and public read models.
- Attribute and Skill components now resolve before addition, preventing two
  inactive modifiers from carrying into an unintended extra die.
- Cancelling an OpenD6 Wild Die decision now cancels the roll cleanly instead of
  passing the dialog action ID into rules resolution.
- Condition-track actions now resolve the owning button when its label or node
  is clicked, persist the selected condition, and rerender the header summary.
- Character-header and Combat-tab conditions now use the matching OpenD6 Next
  semantic wound-state colors.

### Added

- Source-backed Second Edition Doubling Down retries for failed non-combat
  Attribute and Skill actions, including narrated typed context, exact Die Code
  replay, no-award retry Complications, and single-use chat controls.
- Public `roll.double-down` plus an independent cross-edition retry capability
  and OpenD6 compatibility switch.
- **Module: Pips** in the Second Edition settings, a separate classic-Pips
  OpenD6 compatibility switch, and a resolved public `pips` capability.
- Profile-aware character-creation stepping and the printed two-die split limit
  for Attribute and Skill modifiers (D62e pp. 94-95).
- Source-backed Second Edition round declarations and action segments on a
  versioned, revision-checked Combatant flag, with owner/GM correction rules.
- Combat-tab declaration, next-action, and reset controls plus live round
  penalty and current-action presentation.
- Automatic declared-action penalties on Attribute, Skill, resistance, and
  weapon-attack rolls, preserved in typed roll requests and chat cards.
- Working public `combat.read` and `combat.command` API capabilities.
- A narrow Foundry round-change hook that refreshes open Actor sheets without
  writing document state, keeping the segment display current across rounds.
- A separate planned OpenD6 flexible-action capability, preventing Second
  Edition declaration semantics from leaking into First Edition mode.
- Versioned cross-edition capability resolution for success, Wild Die,
  meta-currency, defenses, damage, advancement, Attributes, and Advanced Skills.
- A live rules-capability matrix in both edition settings applications and the
  public `rules.capabilities()` API.
- An explicit **Allow Second Edition Advanced Skills** OpenD6 extension. The
  complete OpenD6 preset preserves those Items inactive by default.
- Explicit Second Edition Advanced Skill task augmentation: a standard Skill
  roll may add one valid related Advanced Skill rating, with the selected
  context preserved in the typed request and displayed on the chat card.
- A complete Build 365 GM/player validation fixture and recorded matrix covering
  ownership visibility, sheet-mode authorization, Advanced Skill rolls, Stunned
  prevention, and the supported minimum viewport.
- Source-backed Second Edition Hero Point rerolls from failed chat-card results,
  preserving the original typed request while rolling a fresh undoubled pool.
- Single-use reroll chat actions, owner and balance validation, structured
  reroll result flags, and public `roll.reroll`.
- An authoritative `health.condition` command and sheet prompt that can spend
  one Hero Point to prevent a transition into Stunned without treating Hero
  Points as recovery.
- Versioned `SecondEditionCampaignProfileV1` resolution for core/default and
  custom modular campaigns, including active Attributes, known module IDs, and
  canonical creation budgets.
- Public `campaign.profile` capability with
  `game.system.api.campaign.current()`.
- A resolved campaign-profile summary in the Second Edition settings
  ApplicationV2.
- Protected Second Edition character creation with 12D Attribute and 7D Skill
  budget validation, whole-die controls, and finalization.
- Optional Skill-module budgeting and the Skill Specialization & Advanced Skills
  setting from printed pp. 96-99.
- Standalone Advanced Skill pools, prerequisite relationships, and linked +1D
  Specializations.
- Schema 8 creation state and stable Skill relationships.
- Standard, Advanced, and Specialization classifications in the public Actor
  read model.
- Structured public Skill catalog with 16 core Second Edition skills, all
  Additional Attribute module skills, a 60-entry OpenD6 compatibility catalog,
  stable keys, Attribute links, and printed-page citations.
- Reproducible Foundry v14 public Skill compendiums and catalog verification in
  `npm run check`.
- New-character skill provisioning plus a GM **Sync Rules Skills** action for
  existing characters and rules-profile changes.
- Separate local-only private-content companion generator for licensed
  descriptions; public compendium descriptions remain blank.
- Character Combat tab with derived Second Edition Dodge/Parry, action-penalty
  reference, editable condition track, weapon/armor loadouts, and typed weapon
  attack/damage rolls.
- Pure tested static-defense and multiple-action-penalty functions.
- NPC and creature Actor types plus OpenD6-compatible Item family admissions for
  future loss-aware imports.
- Schema migrations 6 and 7 for condition state and compatibility document
  families.
- Grouped ApplicationV2 rules settings with shared root preferences, dedicated
  **OpenD6 First Edition** and **D6 System 2nd Edition** submenus, a synchronized
  complete OpenD6 preset, and independently configurable custom profiles.
- Supported cross-edition settings for themes, roll visibility, default
  difficulty, roll-builder sections, shared Item visibility, modular Second
  Edition Attributes, Hero Point bookkeeping, First Edition character creation,
  advancement, damage variants, scale, resources, and Wild Die-one handling.
- Settings consumers in sheets, Item Attribute choices, public Actor read
  models, roll dialogs, new-character resources, theme resolution, Hero Point
  transactions, and First Edition Wild Die resolution.
- Functional OpenD6 Advance mode for one-pip Attribute, Skill, and
  Specialization purchases, including configured cost multipliers,
  affordability, confirmation, protected Character Point deductions, rollback,
  and the public `advancement.command` API capability.
- Live companion-theme choices in the shared world/user settings, with
  immediate semantic-token application and safe fallback/removal when the
  contributing module is disabled.
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
  plus eight independent compatibility switches.
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
- Exact OpenD6 Next mask-based ApplicationV2 header controls for sheet settings,
  UUID copying, and close actions.
- Typed Foundry v14 Item models for specializations, advantages, disadvantages,
  special abilities, weapons, armor, and gear.
- A canonical shared Item record covering trait, equipment, weapon, armor, and
  specialization fields, plus a character Traits & Equipment workspace.
- Schema migration 5 admitting the cross-edition Item union without coercing
  unknown legacy fields.

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
  persistent combat action context, resistance, resolved damage comparison, or
  follow-up actions. Raw weapon damage rolls are implemented.
- Player-triggered Second Edition Complications that require a GM decision stop
  safely until the authoritative remote-GM socket workflow exists.
- Advance mode does not spend advancement currency until a Second Edition
  advancement module is selected.
- No broad rule automation.
- Player-role permissions and interactive narrow-layout resizing are not yet
  live-tested.
- Damage automation is blocked by a contradiction on rulebook page 33.
- Public distribution and trademark use require licensing confirmation.
