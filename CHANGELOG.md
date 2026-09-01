# Changelog

## 0.1.0-beta.18 - 2026-08-31

- Added playable FreeD6 Rules and Setting Profiles with its source-aligned
  attribute vocabulary, character creation, Feature economy, consequence
  handling, advancement, and ordinary roll workflows.
- Added a neutral Magnetic Variant (D6MV) rules foundation with source-aligned
  success degrees, static resistance defenses, initiative, conditions, vehicle
  structure and VSM handling, while keeping branded setting material outside
  the public Core.
- Added matching-combination dice pools for pairs, sets, full houses, and other
  ranked results. Rules Profiles define the evaluator, target, tie-break, and
  scope without replacing ordinary total-based combat, damage, or resistance.
- Added optional Homebrew rewards for the best matching result, including
  idempotent Hero/Fate/Force and Character Point awards, privacy-aware chat
  evidence, retry handling, and provider-safe saved mappings.
- Added OpenD6 profile branding and its canonical blue palette, distinct Rebel
  and Imperial Personal Themes, per-profile color editing with accessible
  contrast guidance, and client-safe presentation precedence.
- Added Setting Profile typography with separate display and interface roles,
  built-in, world-local, and module-provided fonts, deterministic fallbacks,
  safe Foundry Data paths, and reference-aware font removal.
- Restored the complete Rules & Mechanics workspace while keeping matching
  combinations additive under Homebrew. Hideouts now explain and can enable
  their Pips and Perks, Flaws & Talents prerequisites atomically.
- Refreshed the system logo, profile and pause branding, responsive settings
  presentation, Strength localization, and the illustrated in-game User Manual
  for the accepted Beta.18 workflows.
- Restored Foundry tooltip ownership so rich module tooltips are no longer
  clipped by the D6 system, and anchored Attribute help to its compact heading
  with matching pointer and keyboard behavior.

Schema remains 54; this release requires no migration.

## 0.1.0-beta.17 - 2026-08-28

- Added a complete Health Model Builder for safely authoring world-owned health
  tracks. Gamemasters can use Guided or Exact transitions, define two to eight
  ordered damage outcomes, test changes in the simulator, and resolve profile
  or Actor references before deletion without losing existing matrix choices.
- Redesigned the Health Model Builder as a compact, aligned, responsive Foundry
  workspace with clear ordinary and Developer details, conventional controls,
  readable transition cards, one scroll owner, keyboard-safe rerenders, and
  native resizing down to the supported 520×480 minimum.
- Unlocked native Foundry resizing for Configure Rules & Mechanics and the
  Health Model Library while preserving their default sizes, responsive
  navigation, fixed actions, and non-persistent window geometry.
- Added client-scoped Personal Themes with palette previews and safe fallback
  behavior. The Token Action HUD adapter now colors its original thin active
  highlight from the current client's theme without modifying Token Action HUD
  Core or changing its geometry.
- Unified system-owned pending prompts and added explicit reopen actions for
  requested rolls, resistance and damage continuations, transfers, Combined
  Action consent, and chase participation. Optional client auto-open behavior
  remains privacy- and ownership-aware.
- Consolidated ordinary attacks, thrown-explosive resolution, and Second
  Edition Feint/Riposte continuations onto their initiating chat cards. Damage,
  resistance, and applied Health results remain attached to one durable root
  with stable targeting, routing, redaction, reload, and cleanup behavior.
- Expanded the illustrated in-game User Manual with clear Health Model Builder
  instructions, outcome and transition examples, validation and deletion
  guidance, Personal Themes, unified prompts, and the accepted combat-card
  workflows.

Schema remains 54; this release requires no migration.

## 0.1.0-beta.16 - 2026-08-24

- Added Foundry-native thrown-explosive placement. Sheet and Token Action HUD
  attacks now aim a live colored blast footprint before opening the ordinary
  roll dialog, derive range and difficulty from the aimed point, scatter on a
  miss, identify affected Tokens by zone, and route physical or stun damage
  through the existing resistance workflow.
- Added schema 54 blast profiles with three or four ordered zones, fixed or
  falloff damage, immediate or end-of-round timing, cleanup and recovery, and
  First/Second Edition Strength or Brawn range adjustments.
- Projected exact preserved legacy Star Wars explosive profiles into the new
  authored model without name or prose guessing, including safe repair of
  unchanged existing imports and fail-closed handling of ambiguous sources.
- Replaced opaque scatter rolls with one readable, visibility-matched deviation
  card, visibly relocates the complete blast footprint before damage, and adds
  an optional Tyfusius eight-direction d8 scatter rule while keeping the
  standard six-direction d6 map as the default.
- Added editable plain-text descriptions to every Health Model state and exposes
  them as accessible pointer and keyboard tooltips on Character condition
  controls.
- Hardened settings saves against overlapping submissions and refined explosive
  labels near viewport and sidebar edges without changing the established
  theme or ordinary Weapon workflow.

Schema advances from 53 to 54.

## 0.1.0-beta.15 - 2026-08-23

- Published the accepted post-Beta.14 fixes and presentation refinements under
  a strictly newer version so existing Foundry installations receive the
  collaborator update notification.

## 0.1.0-beta.14 - 2026-08-21

- Added configurable personal Health Models with 2–20 ordered states,
  per-state penalties and action availability, terminal states, damage and
  round-start transitions, Rules Profile ownership, Setting Profile labels,
  per-model Actor state restoration, and schema 53 migration.
- Unified Rules & Mechanics configuration into one ApplicationV2 workspace,
  including health-model management and the Rules Profile difficulty ladder.
  Difficulty suggestions now use a field-width, single-line popup while still
  accepting any custom numeric difficulty.
- Completed automated Star Wars Force workflows. Bound Control, Sense, and
  Alter scores open ordinary rolls; Force Powers can author ordered checks;
  and the dedicated builder supports blank sequences, shared multiple-action
  penalties, review, execution, and per-check results.
- Made Force sequences robust around ordinary failure, true cancellation, and
  pools reduced below 1D. A 0D check completes as a failed result without
  rolling or spending resources, and later checks still execute.
- Refined the Force Skills, Force Power, sequence-builder, Rules configuration,
  Health Model, and difficulty-suggestion interfaces for clear hierarchy,
  responsive containment, keyboard access, 44-pixel controls, and Reduced
  Effects compatibility.
- Integrated post-Beta.13 stabilization for advancement-resource persistence,
  player Advance access, configurable document terminology, portrait
  permissions, Reduced Effects, and importer idempotency.
- Updated the illustrated in-game User Manual with direct Force Skill rolls,
  role bindings, authored Force Power checks, the blank sequence builder,
  shared MAP, failure/cancellation behavior, and resource handling.

Schema advances from 52 to 53.

## 0.1.0-beta.13 - 2026-08-19

- Completed Skill-family presentation and authoring: exact Skill,
  Specialization, and Advanced Skill descriptions reach sheets and roll
  dialogs; child Skills group under their parent; and GM Free Edit exposes the
  shared blue-plus creation workflow.
- Preserved character resources across sheet-mode changes, restored direct GM
  editing of points and currency, fixed player equipment/currency transfers on
  browsers without `crypto.randomUUID`, and added prominent resolved-injury
  feedback plus the one-shot Attack-card **Resolve damage** action.
- Added configurable personal-Weapon damage bases. A Weapon may use fixed
  damage or add an Attribute or embedded Skill pool to its listed damage, with
  deterministic Strength-role and stale-Skill fallbacks. Schema advances to
  52 with an ordered migration.
- Added Rules Profile difficulty steps with the bundled values Very Easy 5,
  Easy 10, Moderate 15, Difficult 20, Very Difficult 30, and Heroic 35.
  Ordinary difficulty fields offer these as suggestions while retaining custom
  numeric entry.
- Added strategy-aware Setting Profile health terminology for Second Edition
  Conditions, Open D6 Wound Levels, and Body Points without changing health
  mechanics, state order, penalties, or thresholds.
- Restored the targeted Weapon roll selector, measured range presentation, and
  automatic range-derived Final Difficulty. Open D6 active-defense attacks now
  combine passive or completed Dodge with the measured range modifier.
- Refined Character-sheet weapon/currency layouts, Rules and Setting Profile
  responsiveness, roll-dialog resource placement, and theme-aware Star Wars
  chat-card branding.
- Updated the illustrated in-game User Manual for the new Skill, damage,
  profile, targeting, and authoring workflows.

Schema advances from 51 to 52.

## 0.1.0-beta.12 - 2026-08-17

- Stabilized Second Edition thrown-explosive Weapon editing and live attack
  setup, including immediate Weapon Kind rerendering and persisted range bands.
- Hardened the neutral world-import preview and rollback boundary so failed or
  conflicting writes leave no partial documents behind.
- Added the development-only Star Wars D6 Template Support catalog with 351
  reusable Items and two public-API Token Macros. Owner/GM drops, parent Skill
  linkage, current-player hotbar import, cancellation, and failure reporting are
  covered without adding private Star Wars content to either release channel.
- Refined the optional Rebel and Imperial theme accents while leaving every
  dice color, style, rule, and authority boundary unchanged.
- Added a guarded, disposable-world Foundry acceptance foundation for future
  release QA. The separate crash-recovery hardening and Reduced Effects feature
  remain deferred and are not part of this release.
- Updated the illustrated User Manual for Template Support and Token Macros,
  and made Manual verification operate on a disposable LevelDB copy.

Schema remains 51; this release requires no migration.

## 0.1.0-beta.11 - 2026-08-14

- Replaced the single world-derived Star Wars character template and one-Actor
  GM pack with the complete reusable legacy companion catalogs: 26 Gamemaster
  NPCs, 16 starfighter/droid Actors, 453 embedded Items, 27 preserved effects,
  and 184 character templates with 6,313 inline members. Campaign-owned content
  remains world data, while obsolete legacy Attribute-modifier effects are
  preserved disabled and explicitly marked for review.
- Expanded the Star Wars D6 companion from the campaign-referenced Item subset
  to all 277 reusable legacy catalog records: 92 Skills, 19 advanced Skills, 79
  equipment/armor records, 62 weapon/general records, and 25 commodities.
  Conversion preserves IDs, both legacy UUID namespaces, original payload
  provenance, and companion-owned artwork while keeping world content separate.
- Added a Rules Profile-owned scale runtime while preserving the existing
  Second Edition ranked behavior. Attack, Damage, and Resistance now resolve
  through the profile strategy and retain concrete provenance; legacy profiles
  without the additive slot normalize safely.
- Added the development-only Star Wars D6 companion foundation with separate
  REUP Rules, reusable Setting, recommended atomic Preset, and presentation
  theme contributions. Enabling the module only registers availability; it is
  excluded from both Tyfusius and general-public release channels pending
  explicit authorization and provenance/licensing review.
- Redesigned the Character sheet into focused Attributes, Biography, Traits,
  Equipment, and Combat workspaces; action declarations now list only equipped
  weapons, and declared Token Action HUD entries execute directly.
- Added Rules Profile-owned scalar scale handling, visible Final Difficulty and
  signed manual dice adjustments in roll builders, and stable caret behavior
  across system sheet fields.
- Routed Wild Die complication choices to the Gamemaster and damage-resistance
  prompts to the owning player, with a protected GM fallback when that owner is
  offline.
- Added configurable Wild Triumph Hero/Force Point and Character Point rewards
  with explicit chat-card auditing.
- Made player-character currency and equipment transfers recipient-approved.
  The receiving owner reviews the sender, recipient, initiating user, asset,
  and amount before accepting; decline, timeout, unavailable owners, or stale
  state leave both characters unchanged.
- Updated the illustrated User Manual for the new roll, Character sheet,
  resistance, Wild Triumph, and transfer workflows.

## 0.1.0-beta.10 - 2026-08-10

- Restricted direct Character Item deletion to Gamemasters in Free Edit mode,
  including an independent permission check in the sheet handler.
- Added **Drop equipment** to the GM-authorized transfer window for owners and
  Gamemasters. Dropping part of a stack decrements its quantity; dropping the
  complete stack removes the Item and privately receipts the initiator and GMs.
- Updated the illustrated User Manual and live inventory screenshot for the
  corrected player and Gamemaster workflows.

## 0.1.0-beta.9 - 2026-08-10

- Restored currency as an always-visible, Setting Profile-named character
  resource with GM-only direct editing. Currency actions and equipment
  transfers are independently optional; GMs may act from every character
  regardless of ownership, and the active GM validates, serializes, rolls back,
  and privately audits each request. Successful transactions now create a
  high-contrast private receipt for the initiating user, receiving Actor owners,
  and all GMs while excluding uninvolved players.
- Consolidated all user-authored vocabulary into the Setting Profile Builder's
  new Terminology tab, including Currency under Character details. The Rules
  and Setting Profile cards now use the same concise Configure action and icon;
  low-level portable Rules definition remains under Manage.
- Split the previous mixed Traits & Equipment workspace into a focused
  Equipment tab and a separate Traits workspace. Equipment now exposes clear
  equipped state and transfer actions without duplicating Specializations that
  already belong beneath their Skills.
- Kept Hero Points and Currency protected in Normal sheet mode, corrected
  multi-digit resource editing in Free Edit, and refreshed the illustrated
  User Manual for the revised sheets, profile controls, and transaction receipt.

## 0.1.0-beta.8 - 2026-08-10

- Redesigned the Setting Profile Builder as a clearer four-step workspace with
  tab summaries, player-facing identity controls separated from technical
  storage references, Rules-owned Attribute state, numbered Skill cards, and
  unmistakable Wild Die 1 and 6 identity cards.
- Updated the illustrated User Manual and automated layout contract for the
  revised authoring workflow while preserving profile data, mechanics, and
  existing world-owned assets.

## 0.1.0-beta.7 - 2026-08-09

- Split release construction into explicit private-collaborator and
  general-public modes. The normal eleven-package candidate continues to carry
  the separately downloadable Echo companion, while the new ten-package public
  allowlist rejects Echo paths, identity text, manifests, archives, index
  entries, checksums, and system relationships. Both modes now pass clean,
  reproducible, alpha.32, and exact beta.6 update verification.
- Corrected the development README so an unpublished beta candidate never links
  to a nonexistent version-specific GitHub release; the stable manifest and
  latest-release endpoint remain authoritative.
- Restored the Echo companion's intended boundary: it remains a separately
  downloadable private module, is no longer advertised as stock system content,
  no longer requires Open D6 Space, and now contributes a Second Edition-derived
  Rules Profile alongside its independent Setting Profile and preset.
- Refined Creature Catalog profile diagnosis controls by consolidating
  incompatibility details into a compact tooltip and moving the guarded world
  profile switch into the entry's Manage actions.
- Made Creature Actors the editable source for the Creature Catalog. Bundled
  compendium sources are protected and copy-only; a dedicated world Actor
  compendium supplies full create, open/edit, duplicate, profile-copy, unlist,
  and confirmed-delete workflows without risking campaign content during package
  updates.

- Made Creature Catalog compatibility derive from installed Rules and Setting
  Profiles. Open D6 Adventure, Fantasy, and Space now expose their genre
  Attribute/Skill definitions as Setting Profiles, and the GM can confirm an
  atomic switch to the package-recommended profile pair without rewriting
  existing Actors or Items.
- Hardened all eleven release archives with exact beta.6 upgrade overlays and
  explicit archive checks for the Open D6 Core, Adventure, Fantasy, and Space
  Rules/Setting Profile recommendation contracts.
- Updated the User Manual with an easy step-by-step Creature Catalog guide for
  browsing, playable creation, reusable master authoring, profile-aware copies,
  editing, non-destructive removal/restoration, and permanent deletion.
- Redesigned the Creature Catalog as a wider, responsive two-column browser with
  live search, dynamic Rules Profile facets, active-profile emphasis, filtered
  result counts, and clearer ready/incompatible states.

All notable changes will be recorded here. The project follows Semantic
Versioning once distributable releases begin.

## 0.1.0-beta.6 - 2026-08-08

- Redesigned root Profile Presets, Rules Profile, and Setting Profile controls
  as compact source-labelled tiles and selector plates with focused lifecycle
  menus, constrained-height scrolling, and unchanged GM/player permissions.
- Added seventeen coordinated system-owned default images for Actor and Item
  types. New documents and persisted Foundry placeholders receive the matching
  artwork while every user-selected portrait, Token image, and Item image
  remains untouched.
- Made the active Setting Profile authoritative for shared character-sheet and
  paused-game branding, retained client-only Personal theme overrides, and
  removed the obsolete World theme setting completely.
- Refreshed all eleven private collaborator packages, generated content,
  documentation, release metadata, clean-install acceptance, and exact
  beta.5-to-beta.6 upgrade verification.

## 0.1.0-beta.5 - 2026-08-08

- Closed the layered Profile Architecture release gate with clean-world and
  existing-world acceptance for independent Rules Profiles, Setting Profiles,
  module-owned selections, world-owned records, and inert Profile Preset
  discovery.
- Extended all eleven reproducible package checks with an exact beta.4-to-beta.5
  installation overlay while retaining the older alpha.32 upgrade fixture.
- Refreshed the system, companion modules, content packages, Token Action HUD
  adapter, manifests, package relationships, documentation, and Tyfusius release
  metadata as one coordinated beta.5 distribution.

## 0.1.0-beta.4 - 2026-08-07

- Added the portable **Echo Main** Scene to the Echo companion's new **Echo
  Scenes** compendium while preserving its stable document identity and bundled
  artwork.
- Added campaign-content update-safety guidance and a build guard against
  replacing unsourced Echo companion records.
- Limited terminology-change refreshes to document sheets that are already
  open instead of opening every sheet in a developed world.

## 0.1.0-beta.3 - 2026-08-06

- Fixed First and Second Edition settings-tab overflow so every active page
  scrolls inside a bounded content row while the action footer remains visible.
  Grid cards now retain their natural content height instead of being compressed
  into equal clipped rows. The complete **Settings at a glance** summary remains
  the first content in General, and the rebuilt User Manual explains the tabbed
  scrolling behavior.

## 0.1.0-beta.2 - 2026-08-06

- Reorganized both edition settings workspaces into focused General, Modules,
  Homebrew, and Reference tabs with keyboard navigation, retained unsaved
  changes, and a fixed action footer.

- Polished roll follow-up chat controls, including a compact Hero Point reroll
  action, and made Wild Die chat-card and Dice So Nice symbols follow the active
  campaign profile.

- Fixed the GM Quickbar, Active Tasks & Requests, and Creature Catalog so their
  toolbar actions open correctly even when no Scene is active.

- Character Templates now use additive Attribute projection: missing active
  Attributes remain unchanged, recognized inactive Attributes are ignored when
  applying, and newly captured Second Edition templates include the complete
  nine-Attribute superset for cross-profile compatibility.

- Added an independent, disabled-by-default Second Edition **Combined Actions**
  option with unanimous owner consent, Command/Perception leadership and group
  capacity, working-leader penalty, failure-degraded bonuses, highest-pool
  primary work, reaction-only participation locks, and exact single/combat/
  multi-Skill bonus allocation through the existing roll-request pipeline.

## 0.1.0-beta.1 - 2026-08-05

- Added coordinated private-release metadata and reproducible Foundry archives
  for the base system, all eight official content packages, the Echo companion,
  and the Token Action HUD adapter. The release gate verifies checksums, archive
  layout, required runtime files, clean installation, and representative
  alpha.32 package upgrades.

- Added the separately activatable **Open D6 Adventure** genre module with nine
  deterministic compendiums: 61 Skills, 24 Advantages, 44 Disadvantages, 54
  Special Abilities, 150 equipment records, 24 Vehicles, 37 generic
  manifestations, 18 generic profiles, and ten original/generic templates.
  Its seven-Attribute profile and dedicated First Edition Magic/Psionics path
  preserve the 18D/7D creation budgets, fixed difficulties, and +5 untrained
  rule. Schema 47 adds neutral Reflexes/Presence storage. Public records remain
  bounded mechanics and citations without protected prose, named spell
  presentation, examples, tables, layout, or art.

- Added independent requested-roll delivery choices: **Open Roll Window** keeps
  immediate OpenD6-style delivery, while **Highlight on Character Sheet** marks
  the exact Attribute or embedded Skill until the owning player selects it.
  Highlights survive sheet rerenders but remain intentionally client-transient;
  acknowledgement, visibility locking, GM cancellation/takeover, five-minute
  expiry, local fallback, and duplicate protection continue through the shared
  request/task contract.

- Completed modular-content acceptance across both edition workspaces. Active
  content, primary profile, and imported mechanics now share one visible read
  contract; Second Edition-primary worlds can explicitly select individual Open
  D6 substitutions without module activation changing rules. Added clean-system
  staging verification for all seven official modules and an integrated
  schema-43-to-46 extracted-UUID upgrade fixture.

- Extracted the unchanged 60-Skill Open D6 compatibility pack into the
  separately activatable **Open D6 First Edition — Core Content** module.
  Fantasy and Space now register distinct First Edition content identities in
  addition to their explicit genre-selection manifests, and recommend rather
  than require Core Content. The system recommends all three available First
  Edition modules; Adventure retains a reserved validated family identity until
  its separately scoped content implementation. Schema 46 and runtime UUID
  normalization preserve stored references to the former system-owned pack.

- Added the separately activatable **D6 System Second Edition — Superhero**
  module. It registers the official Superhero content family and advertises the
  existing Superheroes rules group without changing settings, the primary
  profile, imported mechanics, or presentation. No compendiums are declared
  because the lawful public Superpower, Gadget, Hideout-feature, relationship,
  and Superheroic Template catalogs intentionally contain no protected named
  records.

- Added the separately activatable **D6 System Second Edition — Science
  Fiction** module. It registers the official Science Fiction content family
  and advertises the existing Science Fiction Skills, Psionics, and Cyberpunk
  rules group without changing settings, the primary profile, imported
  mechanics, or presentation. No compendiums are declared because the lawful
  public bestiary, template, named-power, Vehicle, and Starship catalogs are
  empty.

- Extracted the existing Second Edition Skills and Equipment compendiums into
  the separately activatable **D6 System Second Edition — Core Content** module.
  The base system recommends the module without requiring it; package activation
  now reports content availability independently from the primary rules profile
  and explicitly imported mechanics. Schema 44 and runtime UUID normalization
  preserve stored references to the packs' former system-owned namespace.

- Added Echo-owned Foundry compendiums under **Setting Companions → Echo D6**:
  empty manual-development shells for Characters, Character Templates,
  Equipment, Powers, and Vehicles & Starships. Deterministic build and
  verification scripts preserve the empty starting point while the setting is
  built out manually.

- Added the optional Second Edition Cyberpunk module: Technical- and
  cyberware-based Firewalls, hardening, detected-failure consequences,
  hacking outcomes, Talent-linked cyberware and bioware, separate capacity,
  Medicine installation, schema 32 persistence, and source-audited sheet/chat
  presentation without distributing protected Talent content.

- Added the optional Second Edition Psionics module: three standalone
  disciplines, protected first-1D downtime training, normal later advancement,
  combined one/two-discipline power pools, a 24-hour attempt ledger, structured
  sheet/chat audit, schema 31, and an immutable public power-catalog registry.
  The base catalog intentionally contains no protected named powers or prose.

- Added an independent, disabled-by-default Tyfusius First Edition segmented-
  actions rule. Combatants declare ordered linked or freeform action queues,
  retain their own action count and MAP, and resolve action segment N across
  initiative order before segment N+1. A forced early defense declares the
  defender's complete queue and spends only that defender's first action.

- Added the top-level, GM-only **Tyfusius Home Brew** workspace. Its first
  disabled-by-default First Edition rule shifts typed thrown-explosive range
  boundaries by Strength pips relative to 2D, clamps them at zero, measures the
  aimed Token position, and applies the printed 0/10/15/20 grenade-targeting
  difficulty. Schema 30 preserves existing Weapons with a standard profile.

- Added explicit automatic Token movement for native Second Edition and the
  supported First Edition movement strategy. The canvas picker measures snapped
  user-selected routes, enforces rate/environment/wall/ownership boundaries,
  consumes only matching declared movement, rolls back revision failures, and
  leaves failed First Edition movement for GM adjudication. Abstract chase
  Distance deliberately does not translate Tokens.

- Closed the Second Edition Perks, Flaws, and Talents foundation with a
  versioned owner-scoped feature catalog, collision-safe validation, rank/focus/
  repeatability/prerequisite/conflict rules, total ranked-Talent creation cost,
  authoritative preview/apply commands, durable provenance and semantic-
  mechanics snapshots, and immutable public projection. The base catalog is
  intentionally empty of protected names and text.

- Added the lawful Second Edition bestiary foundation: a versioned immutable
  creature-catalog registry, bounded profile contract, GM-only ApplicationV2
  browser, rollback-protected Creature creation, schema-28 source provenance,
  supported embedded attacks/special facts, and a Creature-specific
  high-Die-Code schema. Migration-backed scale and provenance now survive both
  initial creation and unrelated partial Actor updates.
  The base catalog remains empty of the protected named creatures and Fantasy
  templates on D62e pp. 165–171.

- Added Second Edition Magic Points Casting and Active & Responsive Combat:
  schema-27 Magic Points/autofire data, Mystical Alignment casting and hourly
  recovery, persisted Full Defense/Feint state, Wild Die Feint and Riposte
  follow-ups, autofire attack/damage exchange, public API commands, protected
  owner/GM transactions, and source-cited sheet/chat presentation.
- Ensured responsive-combat chat actions render even when no Hero Point
  follow-up container exists, and cloned immutable Magic cast results before
  Foundry cleans their persisted ChatMessage flags.

- Added Second Edition Fantasy Skills and the Freeform Skill-Based Magic
  foundation: dependency-aware campaign settings, supporting Skill catalogs,
  schema-26 Manifestation designs, exact printed difficulty calculation,
  owner-safe +5/+10 untrained casting, public API contracts, live recalculation,
  chat provenance, GM/player/reload QA, and manual coverage without distributing
  named protected spells.

- Added the Second Edition character-template import/apply foundation: an
  empty lawful base catalog, immutable public registry, exact creation preview,
  campaign/profile validation, owner/GM application, schema-25 provenance,
  equipment rollback, applied-state presentation, and GM/player/reload QA
  without distributing named protected template content.

- Added the opt-in legacy D6 accumulating-stuns compatibility extension for
  First Edition campaigns: schema-24 persistent counts, Strength-dice
  unconsciousness thresholds, noncumulative short penalties with primary-GM
  round decay, explicit one-minute rest reset, 2D threshold duration, sheet and
  chat audit, and public read-model projection. The option is off by default and
  explicitly distinguished from the D6 Space stun-only rule. Unarmored Body
  Point stun resolution now skips the nonexistent 0D armor roll, and confirmed
  owner rest resets use the protected health-update boundary.
- Added the complete optional OpenD6 Space Body Points strategy: mutually
  exclusive Wounds, Body Points, or combined profiles; schema-23 persistence;
  Strength-plus-20 maximum generation; armor-only resistance; point and stun
  damage; deterministic percentage bands; natural/Medicine recovery; mortal
  rescue windows; sheet/chat/public API projection; and loss-preserving mode
  changes without altering native Second Edition damage.

- Added the Second Edition Equipment by Genre/Era foundation: one campaign
  Medieval/Modern/Science Fiction selector, schema-21 Item classification and
  provenance, visible mismatch guidance, an empty citation-only base catalog,
  and a validated owner-scoped public registry for licensed module catalogs.

- Added a source-bounded Second Edition Cover workflow for targeted ranged
  attacks: a nonnegative GM-adjudicated flat defense modifier, live effective
  Dodge preview, immutable roll/chat audit, and no invented presets or Token
  position inference where the rulebook supplies no numeric Cover values.
- Added Second Edition Vehicle and Starship damage resolution with Hull plus
  Armor/Shields resistance, GM-only one-shot application, persistent machine
  Conditions without personal side effects, and source-locked Repair
  Mechanical checks at the printed difficulties.
- Added schema-19 OpenD6 Space Mortally Wounded clocks, primary-GM automatic
  end-of-round Strength checks, typed p. 76 chat audit, duplicate-round
  protection, and explicit Medicine 25 stabilization into Incapacitated.
- Preserved forward-added injury-state fields through live DataModel migration,
  made survived mortality writes atomic with the Wound state, and corrected the
  fixed-difficulty localization on roll chat cards.
- Prevented non-GM clients from fanning a received master-preset change back out
  into protected world-setting writes.
- Added OpenD6 First Edition stun-only weapon damage as a separate persistent
  injury state, including the printed two-level reduction, unconscious duration,
  Incapacitated Stamina/Willpower check, and action lock while unconscious.
- Added OpenD6 First Edition Wound Level natural healing, assisted Medicine
  checks at the printed fixed difficulties, and elapsed-minute Mortally Wounded
  Strength checks without applying combat actions, MAP, or wound penalties.

- Reorganized the Second Edition settings application as a source-backed
  campaign worksheet with core setup and rulebook module cards, printed-page
  references, explicit advancement-family exclusivity, and unchanged persistent
  setting keys.
- Made the diffuse sheet, dialog, Item, and chat-card wordmark follow the live
  rules profile (`D62e` or `OPEN D6`) and moved it inside clipped surfaces.
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
- Ported the Active Tasks & Requests authority lifecycle for standard rolls:
  registration before delivery, response cleanup, five-minute expiry, remote
  dialog cancellation, offline/failure takeover, and first-completion
  protection against duplicate player and GM resolution.
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

- Equipment-family Item sheets now persist ordinary field changes immediately,
  including Cybernetic augmentation configuration, instead of discarding them
  when the sheet closes.

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
