# Current handover

Updated: 2026-07-31

## Latest First Edition defense and movement pass

- Typed Dodge, Brawling Block, and Melee Combat Parry commands now execute from
  the Combat tab. Partial Defense applies tracked MAP; Full Defense ignores MAP
  and adds +10 automatically.
- Combatant state persists the active difficulty with optimistic revisions and
  explicit nested-flag clearing.
- Schema 16 adds loss-preserving positive base Move to personal Actors. A pure
  planner handles free half-rate movement, land/swim/climb/fly rates, printed
  difficulties, four-rate caps, chat audit, and optional action spending.
- Static/active defenses, Second/First Edition movement, and damage now render
  from independent capability decisions rather than one damage-profile switch.
- Foundry v14 live QA showed registered submenu applications missing from the
  native SettingsConfig category despite valid registration. Every world rule
  switch now also uses native `config: true` as a GM-only searchable fallback;
  players continue to receive only the two personal settings.

## Previous First Edition flexible-action pass

- OpenD6 Space printed pp. 58 and 73 were extracted and visually inspected.
- First Edition now has versioned count-only Combatant commitments instead of
  reusing ordered Second Edition action declarations. State stores total
  actions, base action allotment, defense mode, spent count, round, and revision;
  it does not force players to identify future actions.
- A pre-turn Dodge or other reaction can be recorded as already spent. Partial
  Defense receives the complete round MAP immediately and leaves the remaining
  actions available for the later turn.
- Full Defense is restricted to one exclusive action and 0D MAP. The player
  currently rolls the relevant Skill and enters +10 in the result-modifier
  field; dedicated active-defense roll selection remains a separate capability.
- Optional assistance displays a compact tracker and pre-fills tracked MAP in
  Attribute, Skill, Specialization, and weapon Attack dialogs. Manual assistance
  hides the tracker and retains the editable MAP field.
- Higher action allotments delay MAP, a zero-die pool remains illegal, round
  changes expose clean state, stale revisions are rejected, and only the GM may
  reset after an action or reaction is spent.
- Visible player QA recorded a two-action pre-turn Partial Defense, proved the
  resulting −1D MAP was pre-filled into a 3D Acrobatics roll as 2D, and showed
  the count as **Action total** rather than a Second Edition declaration. Live
  GM QA also exposed Foundry's recursive flag merge retaining an omitted old
  commitment; reset now persists an explicit clear value and has regression
  coverage. The Combatant and development-world setting were restored afterward.
- Public API v1 adds `combat.commitFirstEdition` and
  `combat.spendFirstEdition`. The action-economy capability is now active under
  the First Edition strategy; active defenses and free-half-Move remain separate
  planned capabilities.
- The complete project gate passes: 78 test files / 381 tests, formatting,
  lint, TypeScript, both production bundles, deterministic content, package
  invariants, loader lifecycle, and the 14-page manual with 21 screenshots.

## Accepted future package architecture

- First Edition is not one genre package. Adventure, Fantasy, and Space have
  separate authoritative PDFs listed in ADR 0020 and `RULES-INVENTORY.md`.
- Genre packages and setting companions will be actual Foundry add-on modules
  using one versioned public contribution contract. A genre supplies a campaign
  foundation; a companion such as Star Wars adapts or extends a compatible
  foundation.
- Enabling a package makes its contributions available. A system-owned world
  selection activates one authoritative genre and, when compatible, one
  companion. Never resolve mechanics by Foundry module load order.
- Resolution order is base system → selected genre → selected companion → world
  override. User preferences may override compatible presentation only.
- Keep mechanics, workflow assistance, content, and presentation separate.
  Packages contribute data and select system-implemented strategies; they do
  not calculate rules or write private system settings/flags.
- Package-specific options may normally appear under the package's own Foundry
  settings category. Shared campaign-package, companion, rules-profile, and
  presentation selection remain system-owned.
- Extend the public theme/contribution API before extracting genres. Required
  work includes a unified manifest, provenance, conflict diagnostics, package
  lifecycle/fallback, and placeholder-art resolver.
- `icons/svg/mystery-man.svg` is Foundry's stock `CONST.DEFAULT_TOKEN`.
  Placeholder resolution must be companion → genre → system → Foundry stock and
  must never overwrite a player- or GM-selected Actor/Token image.
- In developer text, use **rules component** for a printed optional D62e module
  and **Foundry module** for an installable package. Rulebook-facing UI may keep
  the printed “Module:” labels.
- This architecture is accepted but not implemented. Do not begin extracting
  genre packages until ADR 0020's contribution contract and resolver have tests.

## Linked and bounded combat declarations

- The free-text-only Second Edition declaration dialog now selects real Actor
  Attributes, Skills, Specializations, and weapon Attacks while retaining a
  clearly labeled GM-adjudicated area for non-roll actions.
- Every selected source displays its starting and projected final Die Code.
  The preview updates as actions, movement, and other tasks change.
- One authoritative pure planner and the Foundry command boundary prohibit the
  whole declaration when any selected pool would fall below 1D. `0D+1` and
  `0D+2` are invalid because they still contain zero whole dice.
- MAP, movement, and Condition penalties are separate values. Running and
  crawling affect Skills and weapon Attacks, not Attributes. Staggered and
  Wounded apply −1D; Stunned and the terminal Conditions cannot declare or
  perform actions. Resistance remains exempt.
- Stored declarations retain source identity plus starting/final score for
  reload-safe display and audit. The roll path rechecks the current Condition
  so a declaration cannot bypass a later penalty.
- The Combat overview's Dodge, Parry, and MAP-reference numerals were reduced
  from oversized display typography to compact tactical values.
- Foundry v14's standalone template renderer does not register the legacy
  `selected` helper. Live QA exposed the inherited declaration-dialog failure;
  the movement controls now use built-in conditional attributes and the action
  choices are populated with safe DOM APIs.
- Visible GM QA proved 3D at three actions remains legal at 1D, a fourth action
  is rejected at 0D, Wounded + Run + MAP is rejected at 0D, a legal declaration
  persists and reopens with all sources selected, and the compact overview
  typography remains readable. TyfTester also opened the same planner as the
  owning player. The Actor and retained encounter were restored to Healthy,
  Standing, and an empty declaration.
- The complete project gate passes: 76 test files / 358 tests, formatting,
  lint, TypeScript, both production bundles, deterministic content, package
  invariants, loader lifecycle, and the 14-page manual with 19 screenshots.

## Complete Second Edition module settings catalog

- The GM-only Second Edition settings application now contains the complete
  41-entry printed module catalog across Core, Fantasy, Science Fiction, and
  Superheroic rules.
- The catalog uses the union of the introduction, table of contents, and p. 249
  Module Worksheet. This intentionally restores bestiaries, templates, Scale,
  Superheroic Hero Points, Capping Die Codes, and Secret Identities omitted
  from the shortened worksheet.
- Every entry shows a printed-page reference and an honest support state:
  configurable, available/built-in, partial, or planned/unavailable. Planned
  entries are visible but have no input. Configurable entries link back to
  working controls.
- Known dependencies and mutually exclusive Initiative, Wild Die, Hero Point,
  and Advancement families are shown inline. Catalog tests require 41 unique
  entries and validate all dependency and settings-group references.
- Build 365 visible QA expanded the Science Fiction catalog, confirmed the
  18/6/8/9 genre counts, and found no horizontal overflow. Configurable
  navigation now scrolls the matching working card to the top of the settings
  window; the first anchor-based implementation was rejected live because it
  did not move the ApplicationV2 scroll region.
- A simultaneous TyfTester session confirmed the player category still contains
  only Personal theme and Default roll visibility. The catalog and every
  Gamemaster configuration control remain absent, and both clients reported
  zero browser warnings or errors.

## Latest multiplayer requested-roll pass

- Two-client Foundry v14 validation now covers Public, Player + GM, and GM-only
  Blind requests, exact chat audience/redaction, remote cancellation,
  disconnection before and after acknowledgement, takeover, and player reload
  without replay.
- No-owner requests now match OpenD6 Next: GM Quickbar controls stay available,
  the configuration explains local Gamemaster control, and the same locked
  requested-roll builder runs locally under Active Tasks.
- Live takeover exposed a Foundry DialogV2 runtime boundary where a Cancel
  action may resolve as the string `cancel` despite a typed nullable result.
  Requested-roll configuration and roll builders now reject non-object results,
  preventing an unintended roll and Hero Point overdraw.
- The corrected takeover and local-fallback cancellation paths removed their
  tasks without chat, resource, or action side effects. Completed private/blind
  chat audit persisted across reload while the pending player prompt did not
  replay.
- `assets/manual/gm-request-local-fallback.png` records the new live fallback
  state, and the user manual and multiplayer/parity ledgers describe the
  verified workflow.

## Latest Second Edition character-feature vertical slice

- Schema 11 adds native `perk`, `flaw`, `talent`, `trouble`, and `asset` Item
  families from D62e pp. 101-131.
- Perks and Flaws store rank and focus/scope. Talents additionally store their
  creation Skill-dice cost and repeatability. Troubles and Assets store their
  narrative trigger. Every family carries a concise source citation.
- The canonical OpenD6 Next-derived Item shell and character inventory expose
  these facts and profile-aware invocation controls.
- Existing OpenD6 Advantage, Disadvantage, and Special Ability Items remain
  distinct; no document is renamed or coerced.
- Explicit native modules now own ranked-feature creation accounting and
  Trouble/Asset Hero Point, +3D, Complication, two-use, revision, and GM-reset
  workflows. Complete OpenD6 keeps native feature data inactive-preserved.
- API v1 projects feature data and publishes typed read/command capabilities.
- Named bespoke Perk/Flaw/Talent effects remain blocked on source mapping and
  distribution permission; description text is never executable.
- ADR 0019 records this boundary.
- Build 365 live validation created and edited all five embedded Item families,
  restarted the dedicated world, and confirmed schema-11 persistence plus the
  public Actor projection. GM Free Edit and player creation editing passed;
  finalized player Normal and Advance modes kept ranked features read-only, and
  players never received Free Edit.
- Live JSON export/import round-trips and duplication preserved every feature
  family. All ten temporary copies then deleted cleanly.
- An owning player invoked Trouble twice, received two authoritative Hero
  Points and the Complication audit, then invoked both Asset benefits. The +3D
  path rolled Acrobatics at 5D and retained the typed feature-bonus context.
  A player reset was rejected; the corrected GM reset advanced the session and
  removed all stored counters.
- The role pass found and fixed two Foundry-v14 update-shape defects: validated
  feature transactions now use a narrow authorization scope, and injected
  unchanged Character/Fate/Experience Point siblings no longer cancel unrelated
  player Actor updates such as Normal-to-Advance mode changes.
- The OpenD6 Next Item implementation was traced through its ApplicationV2
  class, partial templates, view model, CSS, permissions, persistence, tests,
  and validation notes. The D62e sheet retains the same shell, hero proportions,
  field grid, typography, focus treatment, and scrolling panel. Its default was
  corrected from 720×680 to the reference 680×620; a live Build 365 Perk check
  rendered at exactly 680×620 with the longer feature form scrolling cleanly.
- The same live Perk surface is captured in
  `assets/manual/character-feature-item-sheet.png` and included in the generated
  user-manual Journal.

## Edition-aware diffuse wordmark

- The OpenD6 Next diffuse background typography now resolves from the live
  rules profile rather than a fixed CSS label: native Second Edition and custom
  profiles show `D62e`, while the complete OpenD6 preset shows `OPEN D6`.
- Sheet, dialog, Item, roll-builder, and chat-card wordmarks use positive
  right-side insets so their final glyph is not clipped.
- A live Build 365 pass verified the complete `D62e` mark, switched to the
  complete OpenD6 preset, observed `OPEN D6` immediately without reloading,
  visually checked its longer final glyph, and restored native Second Edition.

## Latest coordinated machine combat pass

- Schema 15 adds loss-preserving crew rosters to Vehicles and Starships.
- The complete OpenD6 Next crew source path was traced. D62e retains its
  persistent roster and add/open/remove interaction pattern but intentionally
  omits embedded-pilot data copying and exclusive reverse Actor links.
- Machine owners can assign owned Character, Creature, or NPC Actors, open their
  sheets, and remove them only through confirmation.
- Mounted Attack selects an assigned gunner and executes as that crew Actor,
  preserving their action penalty, Hero Points, and follow-ups. Machine
  targeting, range, relative scale, and weapon identity remain authoritative.
- The pure D62e planner adds Gunnery and the weapon attack bonus, then subtracts
  1D for every missing Starship crewmember (D62e pp. 177, 180, 182).
- Typed roll context and the public chat card audit gunner, machine, Gunnery,
  weapon bonus, shortfall, and printed page. The public Actor projection now
  exposes machine Attack as well as Damage, so Token Action HUD uses the same
  public roll command without a private adapter path.

## Earlier machine Actor foundation

- Schema 10 admits native `vehicle` and `starship` Actors with typed Foundry v14
  data models and one dedicated ApplicationV2 sheet.
- D62e pp. 176–183 were extracted and visually checked before implementation.
  Vehicles store Maneuverability, Hull, passengers, Armor, Scale, Conditions,
  and notes. Starships store Navicomp, Maneuverability, Engines, Hull, minimum
  crew, Shields, Scale, Conditions, and notes.
- Machine sheets use the canonical OpenD6 Next component language across
  Systems, Combat, Cargo & Equipment, and Vessel Notes tabs.
- System headings use the shared roll pipeline. Defense is derived from Hull
  full dice ×5; resistance combines effective Hull and Armor/Shields. Weapon
  damage rolls use the existing typed Item pipeline.
- The original foundation stopped at weapon damage; Schema 15 supersedes that
  boundary with explicit crew-operated Gunnery attacks.
- Creature sheets now support positive static Dodge/Parry overrides, with zero
  retaining ordinary derivation, following D62e p. 132.
- The additive version-1 public Actor read model projects machine systems,
  capacity, Condition, Defense, protection, and resistance without fabricating
  character Skills or resources.
- Build 365 live checks passed for native Vehicle creation, field autosave,
  close/reopen persistence, Condition changes, the shared system roll builder,
  and the structured machine chat card. Live testing also corrected a
  character-only edit guard leak and removed update-time migration side effects
  from the machine TypeDataModels.

## Latest user-manual pass

- `docs/USER-MANUAL.md` is now the authoritative illustrated user manual for
  GitHub and the Foundry package. It covers the current campaign profiles,
  character modes and creation, rolls, Wild Die, chat cards, advancement,
  Items, combat and Conditions, settings, content, permissions, public API, and
  explicit alpha boundaries.
- Seven screenshots were captured from the live Build 365 development world:
  Normal and Advance modes, the shared roll builder, a cinematic chat card, the
  Combat workspace, root system settings, and the Second Edition rules panel.
- `scripts/build-user-manual.mjs` deterministically compiles the Markdown into a
  13-page `JournalEntry` compendium. Stable Journal/page IDs and installed image
  paths allow updates without maintaining a second handwritten manual.
- `scripts/verify-user-manual.mjs` compares every LevelDB record with the
  expected source and verifies all referenced screenshots. Manual verification
  is part of `npm run check`.
- `docs/USER-MANUAL-MAINTENANCE.md` records the same-pass documentation policy,
  supported Markdown subset, screenshot discipline, licensing boundary, and
  current coverage ledger.
- The live screenshot pass restored the Foundation Actor to Normal mode. It
  added one harmless public Climbing roll to the development world's chat.

## Latest Doubling Down pass

- Printed Second Edition page 25 now drives an owner-checked, typed Doubling
  Down follow-up for eligible failed non-combat Attribute and Skill rolls.
- The retry reconstructs the complete effective Die Code from the prior result.
  An earlier Hero Point enhancement is retained without a second expenditure.
- Retry narration, original total, and source page remain in the typed request
  and the cinematic chat card.
- A failed retry becomes a Complication with no Hero Point award; a successful
  retry follows normal Wild Die and award rules.
- Hero Point reroll and Doubling Down are mutually exclusive, single-use
  ChatMessage actions.
- The new `retries` cross-edition capability and First Edition switch keep
  Doubling Down inactive under the complete OpenD6 preset.
- Public capability `roll.double-down` exposes the same service for macros and
  future HUD integrations. ADR 0016 records the boundary.
- Live Build 365 checks observed the public `5D` failure, narrated retry,
  original-total context, no-award retry Complication, and consumed source
  actions. The complete OpenD6 preset removed both Second Edition follow-ups.
- Private-GM validation found and fixed frozen whisper recipients at the Foundry
  document boundary. The repeated check created a real `whisper` ChatMessage.
- The world was restored to native Second Edition and the Foundation Actor to 3
  Hero Points. The final console contained only Foundry's known 1280×720
  viewport warning.
- The complete gate passes with 40 test files and 158 tests.

## Latest Pips rules correction

- The authoritative Second Edition default is now whole-die progression.
  **Module: Pips** is a separate Second Edition option sourced to printed
  pp. 94-95.
- The OpenD6 preset enables a separate classic-Pips compatibility switch. A
  custom profile may select either rules family independently.
- Canonical pip-unit persistence remains lossless. Effective scores resolve each
  Attribute, Skill increase, damage value, or resistance value before
  arithmetic, so dormant modifiers neither apply nor carry into an extra die.
- Character/Item sheets, public Actor read models, static defenses, weapon and
  armor labels, and every implemented roll entry point use the shared effective
  score adapter.
- Second Edition creation steps by whole dice without the module and by pips
  with it. Finalization enforces separate 2D split limits for Attribute and
  Skill modifiers.
- No schema rewrite was introduced. Turning Pips off preserves stored `+1/+2`
  values for later profile changes and loss-aware imports.
- Live Build 365 checks observed the unchanged Foundation character as
  Agility/Climbing `3D`/`5D` in core Second Edition, `3D+1`/`5D+1` with Module:
  Pips, and `3D+1`/`5D+1` under the complete OpenD6 preset. The world was
  restored to core whole-die rules and the test Actor to 3 Hero Points.
- ADR 0015 records the storage/rules boundary. The automated gate currently
  covers 38 test files and 150 tests.

## Latest combat action-segment pass

- Printed Second Edition pp. 29-31 now drive a versioned Combatant round-action
  state: ordered declarations, no passing, current segment, completion, and
  monotonic revision checks.
- The Combat tab allows owners to declare an ordered action list, complete it in
  order, and reset before resolution; only the GM may reset after the
  first action is complete.
- Attribute, Skill, resistance, and weapon-attack rolls automatically subtract
  1D per declared action beyond the first. Requests and OpenD6 Next-style chat
  cards retain the round/action/penalty context.
- `combat.read` and `combat.command` are working public API capabilities for the
  future HUD adapter.
- Contextual standard initiative is documented rather than forced into a false
  stable Foundry order. Combat-owned alternate initiative, reactions, sockets,
  and contradictory damage text remain later slices.
- OpenD6 Space p. 58 was checked separately. Its flexible action allotment is a
  distinct planned capability; the stricter Second Edition declaration UI and
  penalty automation are inactive when that combat strategy is selected.
- Live Build 365 testing created the dedicated `Combat Action Validation` scene
  and observed a two-action declaration (`Move to cover`, `Fire weapon`), a
  displayed −1D round penalty, Climbing reduced from 5D+1 to 4D+1, matching typed
  chat-card context, ordered advancement to the second action, reload-safe
  round reset, and immediate sheet refresh from round 2 to round 3.
- The only captured browser error was Foundry's known 1280×720 minimum-height
  warning; no system runtime error was observed.
- The complete gate passes with 37 test files and 144 tests.

## Latest cross-edition capability pass

- `EditionCapabilityProfileV1` resolves ten current rules families
  independently for Second Edition, OpenD6, and custom mixed profiles.
- Every decision records a stable ID, rules owner, strategy, and active,
  inactive-preserved, or planned state.
- Both edition settings applications display the resolved matrix.
- Public API capability `rules.capabilities` exposes the same immutable profile.
- OpenD6 preserves Second Edition Advanced Skills inactive by default. A new
  explicit extension can enable the Second Edition standalone/contextual
  behavior without pretending it is a native OpenD6 rule.
- Character sheets, rolls, and Actor read models consume the resolved Advanced
  Skill capability instead of the First Edition Attribute switch.
- Live profile switching passed for native Second Edition, complete OpenD6, and
  the optional Advanced Skill extension; the world was restored to Second
  Edition afterward.
- The same live pass found and fixed OpenD6 Wild Die cancellation leaking the
  `cancel` action ID into typed resolution.
- ADR 0014 and `CROSS-EDITION-CAPABILITIES.md` make the three-profile decision
  mandatory for later rule passes.
- The complete gate passes with 34 test files and 136 tests.

## Latest Advanced Skill and role-validation pass

- A standard Skill roll now offers zero or one trained, valid related Advanced
  Skill as explicit task context. The pure domain adds its canonical rating to
  the complete prerequisite Skill pool.
- The versioned request records the selected Advanced Skill Item ID, label, and
  score. The roll builder previews the final die code and the chat card shows an
  auditable context band.
- Direct Advanced Skill rolls still use only their own rating. Contextual
  augmentation is limited to the active Second Edition Skill module.
- Live Build 365 checks observed Medicine 3D plus Surgery 1D rolling 4D as both
  Gamemaster and owner Player.
- The local role matrix confirmed the GM-only Free Edit option, no direct pip
  inputs in Normal mode, only Normal/Advance for the Player, and directory
  visibility limited to the Player's two owned Actors.
- The Stunned prevention prompt cited page 28, spent one Hero Point (4 to 3), and
  retained Healthy. At 1024×768 the 980-pixel sheet had no horizontal overflow.
- ADR 0013 records the explicit single-context rule. The complete gate passes
  with 33 test files and 131 tests.

## Latest Hero Point follow-up pass

- Failed evaluated Second Edition rolls expose a single-use chat-card reroll
  that preserves their structured request and rolls a fresh undoubled pool.
- The originating ChatMessage records the consumed action before the reroll;
  the new result records `reroll-failed` and one Hero Point spent.
- Selecting Stunned offers a source-cited page-28 choice. Prevention spends one
  Hero Point through `health.condition` and retains the previous condition;
  closing the prompt cancels the transition.
- Public capabilities `roll.reroll` and `health.condition` provide the same
  owner-checked commands to macros and future adapters.
- ADR 0012 records the narrow interpretation that prevention is not recovery
  from an existing Stunned condition.
- The complete gate passes with 32 test files and 129 tests.

## Latest campaign-profile pass

- `SecondEditionCampaignProfileV1` resolves the core-default or custom campaign
  from all currently consumed Second Edition module settings.
- The immutable profile owns ordered active Attribute IDs, known module IDs,
  Advanced Skill/Specialization activation, the explicit additional Skill
  module count, and Attribute/Skill creation budgets in canonical pips.
- Actor defaults, Skill synchronization, creation validation, Actor/Item
  sheets, and the public Actor adapter now receive optional Attributes through
  the same profile resolver.
- The Second Edition settings ApplicationV2 displays the current profile,
  contract version, active Attribute count, creation budgets, and known modules.
- Public API capability `campaign.profile` exposes
  `game.system.api.campaign.current()` for future companions, macros, and the HUD
  adapter without granting access to private Foundry settings.
- ADR 0011 records why unnamed additional Skill modules retain a count without
  receiving invented persistent IDs.
- The complete gate passes with 30 test files and 120 tests, including pure
  profile normalization, settings adaptation, API negotiation, production
  bundle lifecycle, and package invariants.

## Latest condition-track correction

- Condition clicks resolve their owning `data-condition` control instead of
  assuming the innermost clicked element carries the action data.
- The character header now reads the persisted condition from the same sheet
  context as the Combat tab instead of always rendering Healthy.
- Header summary, condition panel, and every condition choice use OpenD6 Next's
  semantic wound-state palette. The Second Edition-only Staggered state uses a
  distinct muted amber without changing any rules behavior.
- The ordered condition list and runtime guard now live in the pure core domain
  rather than being duplicated in the sheet handler and presentation context.

## Latest creation and Skill module pass

- Schema is 8.
- New native Second Edition characters enter a protected, owner-editable
  creation workflow while the Normal/Advance/GM Free Edit contract remains
  unchanged.
- Core p. 20 Attribute and Skill budgets, limits, optional Skill-module
  additions, and finalization are deterministic domain rules.
- The optional pp. 96-99 module provides standalone Advanced Skill ratings,
  stable prerequisite keys, prerequisite validation, linked +1D
  Specializations, and shared-pipeline rolls.
- Live Build 365 checks created and finalized `Creation Validation Character`:
  it began at 4D/12D of Attribute allocation and 0D/7D of Skill allocation; whole-die controls
  produced four 3D Attributes and Shooting 4D, finalization removed all creation
  controls, and the derived pool persisted.
- Live Build 365 settings checks enabled the Skill module, created
  `Advanced Skills Validation`, linked a Shooting Specialization, charged 3
  creation pips once, displayed the parent relationship, and opened the shared
  roll builder with a 2D Specialization pool.
- The same live check created the Advanced Skill `Surgery`, edited its stable
  `medicine, sciences` prerequisites through the canonical Item sheet, raised
  Knowledge so both prerequisite Skills reached 3D, allocated Surgery 1D,
  cleared the prerequisite warning, and opened the shared roll builder at the
  standalone 1D rating.
- Live testing also exposed and corrected a pre-existing ApplicationV2 Item
  template violation: the canonical Item sheet now renders through one root
  element, so embedded Skill and Specialization editors open without browser
  console errors.
- The complete gate passes: formatting, lint, strict TypeScript, 28 test files
  with 115 tests, production build, content verification, package invariants,
  and schema-8 lifecycle smoke.

## Latest content and combat pass

- Schema is 7.
- Public packs provide 34 citation-only Second Edition skills and 60
  citation-only OpenD6 compatibility skills.
- New characters receive the active profile catalog; GMs can synchronize missing
  skills on existing characters.
- The Combat tab provides derived 2e defenses, the condition track, weapon and
  armor loadouts, and shared-pipeline attack/damage rolls.
- NPC, creature, and compatibility Item families are admitted. Vehicle,
  starship, resistance, damage comparison, and authoritative round-state
  automation remain later vertical slices.
- Private licensed descriptions are delegated to the generated local
  `d6-system-2e-private-content` companion.
- Automated gate: 26 test files and 105 tests pass.
- Live Build 365 checks for this pass confirmed that the GM catalog sync creates
  the missing Second Edition skills, including Acrobatics and Shooting; the
  Combat tab derives Dodge 5 from Perception 1D and Parry 15 from Agility 3D+1;
  a Weapon can be created from the loadout; and its attack opens the shared
  3D+1 roll builder and completes a public roll.

## Decisions

- Stable system ID: `d6-system-2e`.
- Display title: `D6 System Second Edition`.
- New repository and rules model; no wholesale legacy import.
- Core/contract/application/Foundry dependency direction accepted.
- First vertical slice: `character` Actor plus embedded `skill` Items and one typed
  core check.
- Manifest declares only document types with a supported runtime.
- Core campaign module defaults are recommended for the first slice.

## Source findings

- The supplied Second Edition v1.1 PDF is the rules authority.
- Success requires a score strictly greater than difficulty.
- Wild Die behavior in the NotebookLM summary needs correction; see rules inventory.
- Page 33 contains two material contradictions resolved by the project owner's
  accepted rulings in `RULES-RULINGS.md`.
- The supplied PDF contains rights/trademark notices but no open license grant.

## Foundation status

- Repository initialized on `main` and tracking
  `https://github.com/geimau/D6-System-2e.git`.
- Installed repository path corrected to `data/Data/systems/d6-system-2e` because
  Foundry requires the directory to exactly match the package ID.
- Documentation populated.
- Strict TypeScript/build/test scaffold added.
- Pure success evaluator and migration runner added.
- Foundation API v1 publishes only implemented capabilities, including an
  immutable versioned Actor read model for integrations.
- Foundry-native `character` and `skill` schemas plus ApplicationV2 sheets are
  registered.
- The character sheet now follows the OpenD6 Next task layout and interaction
  model while using a neutral OpenD6 Classic charcoal-and-gold theme.
- Normal, Advance, and GM-only Free Edit modes are implemented. Advance remains
  deliberately non-automating until a campaign advancement profile is selected.
- Normal and Advance expose no direct attribute/skill pip inputs or skill
  management controls. Document hooks also reject direct score writes and
  embedded skill creation outside GM Free Edit; migrations use a scoped bypass.
- D6 values use canonical integer pip scores. Three stored units equal one die;
  the resolved Pips capability converts each component to its effective value
  before skill totals are combined.
- Schema 2 adds persisted character sheet mode; schema 3 replaces the incorrect
  provisional `{dice, pips}` storage with canonical pip scores.
- Schema 4 adds latent Character Point and Fate Point fields so profile switching
  preserves both editions' currencies.
- A master OpenD6 preset and eight independent First Edition switches resolve to
  `second-edition`, `open-d6`, or `custom`.
- Public API v1 exposes working rules-profile, terminology, and theme capabilities.
- Attribute and standard-skill headings are roll controls backed by one typed
  ApplicationV2 dialog, application service, pure resolver, and chat adapter.
- The resolver supports strict Second Edition and meet-or-beat First Edition
  checks, both verified Wild Die policies, repeated explosions, typed choices,
  Second Edition Hero Point awards, opposed checks, and Hero Point Die Code
  doubling.
- Opposed-check ties implement the verified player-over-NPC and PC Wild Die
  tie-break rules, with an explicit unresolved result when table judgment is
  required.
- Hero Point spending and awards use one validated Actor resource transaction.
  The accepted campaign ruling doubles whole dice in core Second Edition and
  doubles the complete canonical pip score when the Pips module or First
  Edition profile is active; `3D+2` therefore becomes `7D+1`. ADR 0007 records
  the policy.
- Failed evaluated rolls now offer a single-use Hero Point reroll on their
  structured chat card. The reroll preserves the original request, rolls a
  fresh undoubled pool, records `reroll-failed`, and is available through public
  capability `roll.reroll`.
- Selecting Stunned on the character condition track now offers the verified
  page-28 prevention choice. Public capability `health.condition` spends one
  Hero Point before the condition write and retains the prior condition; it
  never removes an existing Stunned condition. ADR 0012 records the boundary.
- Chat cards use the neutral charcoal-and-gold visual language and retain
  `D6RollResultV1` as structured system flags; no chat text parsing is required.
- Chat cards and the Wild Die decision surface now use OpenD6 Next's proven
  cinematic hierarchy—portrait identity, circular dice, burst-backed Wild Die,
  isolated total, and semantic outcome bands—adapted to the generic gold theme
  and Second Edition result choices.
- ADR 0008 supersedes the earlier interpretation of visual parity: OpenD6 Next
  is now the canonical UI implementation. The roll builder, global chat
  container, cinematic roll card, and Wild Die dialog have been converted to
  direct component/CSS ports with only IDs, terminology, and rules-driven fields
  changed.
- The character sheet now opts into the canonical `od6s-character-v2` window
  shell. Its header, utilities, tabs, attribute and skill panels, and biography
  workspace use directly ported `od6v2-*` components. Normal and Advance retain
  the intentional Second Edition permission boundary and expose no direct pip
  editing.
- The Skill Item sheet now opts into the canonical `od6s-item-v2` window and
  `od6item-*` hero/panel components, presents its score as a die code, and rolls
  embedded skills through the same public roll API as the Actor sheet.
- The ApplicationV2 settings, copy-UUID, and close controls use OpenD6 Next's
  exact SVG-mask implementation so inherited form fonts cannot produce missing
  glyph boxes.
- Schema 5 admits typed specialization, advantage, disadvantage, special
  ability, weapon, armor, and gear Item unions. The shared canonical Item sheet
  exposes stored facts without claiming unresolved damage, cost, or activation
  automation.
- The character has a canonical Traits & Equipment tab with grouped embedded
  Item creation and editing for the six non-skill families.
- Foundry settings separate cross-edition root preferences from
  **OpenD6 First Edition** and **D6 System 2nd Edition** ApplicationV2 menus.
  The OpenD6 master switch synchronizes all seven compatibility rules, while
  individual selections resolve to a custom profile.
- Supported settings are consumed by the roll builder, theme resolver,
  character and Item sheets, public Actor read model, new-character resource
  defaults, Hero Point bookkeeping, and First Edition Wild Die-one resolution.
- OpenD6 Advance mode shows calculated one-pip costs and affordability for
  Attributes, Skills, and Specializations. Purchases use a protected service,
  deduct Character Points, roll back failed Item updates, and are exposed
  through public capability `advancement.command`.
- Second Edition advancement now has explicit unselected, Experience Points,
  Milestone, and Narrative profiles. Experience Point Attribute and Skill
  purchases are complete, including whole-die/Pips progression, Advanced Skill
  cost and prerequisite validation, protected XP transactions, public results,
  and schema 9. Second Edition Specialization acquisition follows p. 99.
  Milestones now persist separate Attribute-die and canonical Skill-pip rewards,
  support GM bundle awards and full-bundle Perk exchange, and spend through
  normal Advance controls. Narrative arcs persist proposal, GM approval,
  ordered steps, completion state, and the final +1D reward. Schema 13 adds both
  workflows without converting any existing advancement resource.
- Companion theme registration updates the shared world/user theme choices
  live. Removing the owner removes the choice and rendering falls back to
  OpenD6 Classic without deleting the stored module-owned ID.
- Public API v1 now exposes `roll.attribute` and `roll.skill` plus the working
  `roll.check`, `roll.attribute`, and `roll.skill` capabilities.
- Per-user GM Quickbar and GM Active Tasks & Requests settings now open
  ApplicationV2 panels. The quickbar consumes the public Actor read model and
  roll API; GM broadcasts target an active non-GM owner over the system socket.
- GM Quickbar Attribute and Skill scores format the structured public Die Code,
  root click delegation is refresh-safe, and direct rolls are guarded against
  overlap. Foundry v14 live validation observed one dialog after repeated
  rerenders, one resulting chat card, and a clean cancel path.
- GM Quickbar request controls share the socket service's active non-GM owner
  resolver. When no eligible target is online, they route through the same
  request configuration to a local Gamemaster roll.
- GM Quickbar visibility is GM-only. Player request listeners now register at
  Foundry `ready`, when `game.socket` is available, instead of being attempted
  prematurely during `init`.
- The manifest now declares `"socket": true`; the former false value prevented
  Foundry from enabling the system channel used by remote roll requests.
- GM Quickbar Attribute and Skill requests now open the OpenD6 Next request
  configuration first. The GM selects an online owner and Public, Player + GM,
  or GM-only Blind visibility. The versioned five-minute request carries that
  selection to the owner, whose ordinary roll builder identifies the request
  and locks its roll mode to the GM's choice.
- Repository instructions now make OpenD6 Next the acceptance specification for
  equivalent UX and workflows. `docs/OD6S-NEXT-PARITY.md` is the required
  inspection, implementation, automated, and live-verification ledger.
- Standard requested rolls now run through a dedicated transient Active GM Task
  application service ported from OpenD6 Next. It owns deterministic ordering,
  completion, failure, five-minute expiry, cancellation, takeover, and
  first-completion protection. Player completion/cancellation returns a typed
  response; GM cancellation closes the remote roll builder; takeover is enabled
  only after disconnection or delivery failure.
- Combined Actions were not silently copied into Second Edition. Their Active
  Task categories remain deferred until the rules inventory records whether
  they are core, First Edition-only, optional in Second Edition, or absent.
- Dice So Nice now receives a distinct `dw` roll term and black-and-gold
  setting-neutral preset. Every standard Dice So Nice denomination (`d2`, `d4`,
  `d6`, `d8`, `d10`, `d12`, `d20`, `d100`, and `df`) now uses a stable
  colorset derived directly from the classic interface theme: antique-gold body
  `#c89b45`, bright-gold edge `#f0c96c`, near-black numerals `#0a0d12`, and the
  Amiri face font. The custom `dw` remains the only black die. System rolls
  explicitly send supported roll-level `appearance.system`,
  `appearance.colorset`, and `appearance.font` data without mutating saved
  global Dice So Nice preferences. This is required because Dice So Nice only
  reapplies a preset colorset when the selected system changes; a user who had
  already selected the system could otherwise retain a custom green or blue
  colorset. A real visible Build 365 Climbing 5D roll with the GM's saved custom
  blue appearance produced four gold Amiri d6s and one black Amiri `dw`. The
  temporary QA chat message was removed. The real-roll frame is recorded in
  `assets/manual/dice-so-nice-wild-die.png`.
- Build 365 live rendering verified both quickbars and the interactive
  portrait treatment. `assets/manual/quickbars.png` records the observed UI.
- `npm run check` passes with the complete unit suite, production build,
  invariants, and a schema-5 lifecycle smoke.
- Build 365 discovers and initializes the package in the dedicated
  `d6-system-2e-foundation` world.
- GM live checks passed for character creation, ApplicationV2 sheet opening,
  explicit save, close/reopen, embedded skill creation, and reload persistence.
- A Build 365 visual check passed for the OpenD6 Next header-control masks and
  the new Traits & Equipment workspace. The development server was then
  restarted successfully to reload the schema-5 manifest; creation and
  persistence of the newly admitted Item types still require a post-restart
  live check because the browser connection was lost during that restart.
- Schema 3 migrated the existing Actor and embedded skill in Build 365. Live
  editing verified lossless stored values `10`, `11`, and `12`, followed by a clean,
  idempotent reload.
- Live Build 365 settings checks passed for master-on synchronization, an
  independent custom override, master-off restoration, six-attribute/resource
  projection, and return to the unchanged Second Edition sheet.
- Live Build 365 basic rolls passed in both OpenD6 and Second Edition profiles:
  the `5D+1` Climbing control opened the localized roll builder and created a
  public structured chat card with five faces, distinguished Wild Die, total,
  difficulty, and success.
- Live Build 365 opposed and Hero Point flows passed: a total 28 opposed check
  beat Rival 10, its Advantage choice awarded one Hero Point, and a subsequent
  spend rolled `10D+2`, displayed the resource cost on the chat card, and
  decremented the open sheet balance.
- Live Build 365 visual checks passed for a newly generated cinematic card in the
  standard narrow sidebar and for the redesigned Wild Die 6 decision surface
  with total 24 and explicit Exceptional/Ordinary choices.
- Live discovery found and corrected a dotted-localization namespace collision
  and the frozen-core-result/Foundry-flag boundary. A new package invariant
  prevents localization prefix collisions.

## Next safe work

The 2026-07-29 initiative pass repairs Foundry's previously undefined Combat
formula. Native D62e now hides initiative-roll controls and lets the GM persist
a manual Combatant order by dragging tracker rows. The independent **Use First
Edition Initiative Rolls** strategy rolls Perception with a Wild Die and is
enabled by the complete OpenD6 preset. The complete suite passes with 253 tests.
Build 365 verified the player/GM control boundary, immediate move-button
reordering, reload persistence, and a real `10.15` Perception initiative result.
All temporary combatants, token, macro, and chat records were removed, and the
encounter was restored to its empty Round 1 native state.

The 2026-07-29 HUD pass added the first permanent public-API consumer. The
independently loadable Token Action HUD adapter projects round state, Attributes,
Skills, equipped weapon modes, and active Trouble/Asset actions without reading
private Foundry documents. The public Actor read model now carries immutable
rollable-Item facts. Root builds produce both the system and module bundles.

Build 365 loaded Token Action HUD Core 2.1.1 and the adapter successfully.
Visible GM and TyfTester sessions projected owned-token groups, preserved Die
Code pips, opened the protected roll builder, and survived reload. A concurrent
player/GM Double Down submission accepted exactly one retry and synchronized the
used state; all temporary chat messages were deleted. A later eligible
TyfTester fixture exposed equipped weapon Attack and Damage plus Trouble and
Asset actions. The player opened both protected weapon roll builders, invoked
Trouble, chose both Asset benefits, and observed synchronized use counters and
audit chat. The GM client built the same 25 action nodes; its personal Token
Action HUD Core hover/collapsed presentation kept submenu actions visually
closed, which is user layout state rather than missing adapter data. The
temporary weapon, cleanup macro, Hero Point delta, feature-session uses, and
module setting were removed or restored. The 14-page manual pack was rebuilt.
The development world remains available.

The same pass isolated the prior Settings-sidebar report. The sidebar activated
normally, and the First Edition ApplicationV2 completed its separate render
above the still-open Foundry Game Settings window. Starting Move was changed
from 10 to 11, saved, reopened, retained through a full client reload, and
restored to 10. The earlier report was an insufficient render-wait/stacking
observation, not a settings-registration defect.

One companion-module boundary remains after the live reload matrix. When the GM
and player reload together, Token Action HUD Core 2.1.1 can service a buffered
`getData` socket request before Core has assigned
`game.tokenActionHud.dataHandler`. Core then logs a transient
`getDataWithSocket` `TypeError`; the D62e adapter subsequently initializes and
the HUD works normally. The failing dereference is in Core's socket handler, not
the adapter, so the installed dependency was not patched in place. The next pass
should first check an official Core update or upstream fix and otherwise prepare
a minimal reproduction/report. After that, continue the GM Quickbar
side-by-side/responsive/reload matrix, a same-role race when a second player
session is available, and private-content boundaries.

The follow-up verified that Core 2.1.1 remains the latest official release and
that upstream `main` retains the same startup ordering. A sanitized reproduction
and suggested upstream behavior are recorded in
`docs/TOKEN-ACTION-HUD-CORE-UPSTREAM.md`; no installed dependency was changed.

The 2026-07-29 Specialization/Advanced Skill pass checked the supplied Second
Edition v1.1 rulebook directly at printed pages 96-100. Creation now asks for
the actual narrow Specialization name (for example, Parkour under Acrobatics)
and uses that name in the Actor row, Item identity, and unique stable key.
Advanced Skills receive the same explicit identity treatment and a named
multi-select containing only standard prerequisite Skills.

One shared rules helper now governs Advanced Skill creation, advancement, and
rolling. It requires at least two standard prerequisites, checks each
prerequisite's own Skill rating without its Attribute, enforces the 3D minimum,
and caps the Advanced Skill at the lowest prerequisite rating. Standalone
Advanced rolls continue to use only the Advanced rating; relevant basic-Skill
rolls add the Advanced rating to the complete basic Skill die code. Automated
QA passed 63 files and 267 tests plus lint, typecheck, both bundles, content and
manual verification, invariants, loader smoke, and whitespace checks.

Visible GM QA created Parkour under Acrobatics on the dedicated `Advanced
Skills Validation` Actor and confirmed that description is separate from the
required name. Surgery repaired its legacy key to `advanced-surgery`, selected
Medicine and Sciences, saved, and retained both prerequisites after a full
client reload. The fixture correctly reports those prerequisites as 0D in
their own right despite Knowledge 3D, demonstrating the rulebook boundary.
The follow-up creation-UX repair added confirmed deletion to editable Skill and
Specialization rows. Parkour was then deleted through the visible sheet without
direct document scripting or out-of-band LevelDB editing.

The same follow-up fixed generic custom Skill creation. Free Edit now asks for a
real Skill name before creating any Item, so Cancel or window-close leaves the
Actor unchanged. Named Skills receive a name-derived stable key and duplicate
names/keys are rejected. Visible GM QA cancelled creation with no new record,
created `QA Cancelable Skill`, cancelled its deletion without loss, then
confirmed deletion. The stranded `New Skill` on TyfTester was removed through
the new confirmation flow.

The same pass traced the complete OpenD6 Next Quickbar state and interaction
path. Live review found that D62e rendered drag handles without registering any
drag/drop handlers. The repair adds versioned per-GM PC/NPC order, migrates the
existing hidden/pinned/collapse flag without loss, supports within-section and
cross-section moves, and pins moved Actors. Build 365 passed the GM/player
boundary, compact presentation, a 323-pixel internal-scroll layout with no
horizontal overflow, window close, automatic return after reload, collapse
persistence, and reload. Automated visible control could not synthesize a native
HTML5 `DataTransfer` or activate Foundry's Scene Controls button, so one
human-input pass for pointer drag and toolbar close/reopen remains.

The 2026-07-30 completion pass supplied the missing valid roll fixture:
Medicine 3D, Sciences 3D, and Surgery 2D. Surgery rolled independently at 2D;
Medicine offered `Surgery · +2D · 8D` and recorded that exact Advanced Skill
context on the resulting 8D chat card. Temporary messages were deleted and the
Actor was restored to Medicine 0D, Sciences 0D, Surgery 1D, and Normal mode.
The GM Quickbar also closed and reopened from Token Controls while preserving
its four-character order. Only a true human pointer-drag remains live-unverified;
the available visible browser control cannot produce native HTML5
`DataTransfer`, and synthetic drag evidence was intentionally not substituted.

The full gate passed 63 test files and 269 tests, formatting, lint, typecheck,
both bundles, content/manual verification, invariants, loader smoke, and
whitespace checks. Foundry was not stopped or restarted; the container remained
healthy and the final visible GM client reported 3 ms latency.

The next creation-budget repair replaces the previous implicit
"first Specialization costs 1D" behavior with an explicit persisted p. 99
exchange. New creation Actors begin at Skills 0D/7D and Specializations 0/0.
The right-arrow control converts one genuinely unspent Skill die into three
slots; the reverse control works only while all three remain unused. Schema 12
preserves existing Specializations by allocating their Actors three slots.
Attribute and Skill increases now fail closed before either creation budget can
be overspent. Specialization and Advanced Skill rows carry `(s)` and `(a)`
markers, and the Specialization budget card contains the discoverable Advanced
Skill creation action.

Visible GM QA completed that repair on a temporary creation Actor. Both exchange
directions worked, Specialization controls followed allocation, and the
Advanced Skill dialog cancelled without creating an Item. Exact 7D Skill and
12D Attribute spending disabled every further relevant increase and the
conversion control. The existing Advanced Skills fixture migrated with its
spent allocation intact and displayed the `(s)`/`(a)` markers. The temporary
Actor was deleted afterward. The final gate passed 64 test files and 277 tests,
formatting, lint, typecheck, both bundles, content verification, the rebuilt
14-page/14-screenshot manual, invariants, and loader smoke at schema 12.

The Advanced Skill presentation now reflects its many-to-many rules
relationship. Definition is atomic: one dialog captures the Advanced Skill name
and at least two connected standard Skills, and Cancel creates nothing. The
Item sheet uses the same named checkbox list for later edits. One linked `(a)`
reference appears beneath every connected Skill; the row opens the combined
basic-Skill roll with that Advanced Skill preselected, and its separate die
control opens the Advanced Skill's own roll.

Visible GM QA rejected a one-Skill definition while preserving the entered name
and selection, then cancelled with no Item created. Surgery appeared beneath
both Medicine and Sciences, and both persisted connections were checked in its
Item sheet. With temporary valid prerequisite own ratings, Medicine opened at
7D with Surgery preselected and Surgery opened independently at 1D. Both
builders were cancelled, and the fixture was restored to Medicine 0D, Sciences
0D, Surgery 1D, and Normal mode. Foundry stayed online throughout.

The follow-up completed Advanced Skill Experience Point advancement on those
linked rows. Each reference exposes the same protected purchase, charging twice
the regular Skill cost. Visible GM QA advanced Surgery from 1D to 2D for 2 XP
and then to 3D for 4 XP. The proposed 4D purchase locked before confirmation
because both prerequisites were 3D, with the p. 97 cap explanation exposed on
the disabled control. Transaction tests prove the same rejection spends no XP
and changes no rating.

That live pass also found that the new linked presentation had hidden the GM's
Free Edit score route while the canonical Item sheet correctly kept protected
scores disabled. Each linked reference now has a compact Free Edit pip field
backed by the same shared Item. It restored Surgery to 1D; Medicine, Sciences,
XP, Normal mode, and the Unselected advancement setting were also restored and
verified after reload.

The next mega pass completed the two remaining Second Edition advancement
profiles. Milestone mode persists and spends separate Attribute-die and
canonical Skill-pip rewards, supports GM bundle awards, and atomically exchanges
one complete bundle for a new or ranked-up Perk. Narrative mode persists
reward-linked arcs through owner proposal, GM approval, ordered step tracking,
final GM grant, completion history, and protected removal. The public API,
capability matrix, schema 13 migration, sheet workspaces, settings copy, and
manual now expose all three selected Second Edition profiles.

Visible GM QA completed both workflows. Milestone advanced Brawn and Acrobatics
from a real reward pool, then created a Perk from a second complete bundle.
Narrative proposed, approved, completed, and granted a three-step Shooting arc.
That pass found and repaired sibling-balance loss on Attribute spending, a
frozen Foundry Item-update payload, and the lack of confirmed Free Edit deletion
for non-Skill embedded Items. All temporary rewards, ratings, arc data, and
settings were restored through the visible world. Foundry stayed online and was
not restarted.

## Latest weapon-targeting and resistance pass

The current pass ports OpenD6 Next's scene-target and measured-range
infrastructure while retaining D62e combat rules. Character weapon attacks keep
their weapon identity and attack bonus, list eligible scene tokens, preselect a
Foundry-targeted token, measure short/medium/long or melee range, use static
Dodge/Parry, stop out-of-range rolls, and retain target/range/defense audit data
in chat plus typed flags. The shared difficulty evaluator already enforces the
printed strict `attack > defense` rule.

Character Combat sheets now expose a Resistance control. It derives effective
Brawn plus the strongest equipped body armor and strongest equipped Item
explicitly classified as a shield. Resistance is excluded from action-segment
and wound penalties per p. 34. Armor sheets replace the opaque stacking-tag
field with body-armor/shield choices. No damage or Condition is applied
automatically; that boundary remains behind the p. 33 ruling.

Visible GM QA verified TyfTester's derived Dodge 15, Parry 15, and Resistance
4D after a full reload. A temporary weapon plus the retained Foundation token
then verified the new scale path: rank 0 → 2 changed Attack 4D → 6D while
retaining Long range 27 m and Dodge 5. The public result exposed the same +2D
and p. 196 audit to the visible player session. The weapon was deleted,
Foundation's scale restored to 0, and both sheets restored to Normal. The GM
browser reported no errors. The player reload reproduced a Token Action HUD
Core missing-partial render error even though its `list-subgroup.hbs` file is
installed; treat that dependency load-order issue separately from the D62e
roll pipeline. Foundry stayed online and no restart occurred.

Module discovery required two named maintenance windows. An initial
`docker compose restart` exposed the instance wrapper's data-lock/backoff race;
explicit `docker compose stop foundry-dev` followed by `start foundry-dev`
recovered it. Use explicit stop/start for future named maintenance windows and
health-check the container plus public endpoint afterward.

## Latest coordinated machine-combat pass

Schema 15 adds persistent non-exclusive crew rosters to Vehicles and Starships.
Machine Combat sheets now assign, open, and confirm removal of independent
character, creature, or NPC crew Actors. Starships display the live assigned
count and apply the printed −1D penalty for each missing minimum crewmember.
Mounted attacks select an eligible gunner, combine that Actor's Gunnery with
the weapon attack bonus, and execute through the gunner's authoritative action
economy while retaining machine target, range, and scale context.

The public API and Token Action HUD projection now expose machine Attack as
well as Damage. Chat records machine, gunner, Gunnery, weapon bonus, crew
shortfall, target, range, scale, and rule-page provenance. The user manual,
architecture, data model, migration ledger, public API, rules inventory, and
parity ledger describe the new boundary.

Visible GM QA migrated all six development Actors to schema 15, observed the
Starship shortfall at 0/4 and 1/4, completed a four-Actor roster, configured a
4D attack/5D damage laser cannon, selected TyfTester as gunner, targeted
Foundation Test Character, and produced a public audited 4D result. A complete
browser reload preserved all four crew assignments.

The pass also fixed development asset invalidation by advancing the system and
companion module to `0.1.0-alpha.1`. Both announced restarts exposed Foundry
v14's stale empty `options.json.lock`; each was moved recoverably to
`/private/tmp` before Foundry was restarted and health-checked. Prefer explicit
stop, lock inspection, recoverable move, and start for future maintenance.

## Latest editable artwork parity pass

D62e Character, Vehicle, Starship, and Item sheets now expose the OpenD6 Next
camera-and-`Edit` artwork overlay and open Foundry's native Image Browser. The
original templates named `data-action="editImage"` without registering that
action, so clicks silently did nothing. A shared typed picker service and
registered actions now persist the selected document image.

Artwork ownership is intentionally separate from mechanical sheet mode:
players may activate artwork on owned documents while the sheet remains in
Normal mode, and Item artwork uses parent-Actor ownership rather than granting
access to mechanical Item fields. Foundry's core file-browsing role permission
still controls whether a non-GM may browse server files.

Visible GM QA opened and cancelled the native browser on TyfTester and the
retained Starship. Visible player QA confirmed TyfTester's `Edit` control is
enabled in Normal mode. The focused artwork suite passed eight tests, followed
by typecheck and both production bundles. The system and companion module now
identify as `0.1.0-alpha.3`.

## Latest Item-management parity pass

The canonical Item sheet now exposes full-width **Details**, **Description**,
and **Effects** workspaces using the OpenD6 Next component language. Tab changes
preserve unsaved form state and expose selected state to assistive technology.
Every typed D62e Item family receives the shared surface without importing
OpenD6-specific fields or rules.

The Effects workspace reads Foundry Active Effects for owners. Only a
Gamemaster with the parent Actor in Free Edit may create or delete effects,
because effect changes are mechanical automation; deletion is confirmed.
Visible player QA opened Live Asset, changed all three tabs, observed no
mutation control, and retained Normal-mode protections. Visible GM QA switched
TyfTester to Free Edit, created and opened a native `New Active Effect`, deleted
it through confirmation, observed the empty state, and restored Normal mode.
The live pass also corrected the initial vertical tab layout to the intended
full-width three-column navigation.

## Latest character inventory and owner-safe Item narrative pass

- The complete OpenD6 Next inventory path was retraced through its view model,
  character-sheet actions, template, CSS, Item sheet, effect actions, tests,
  and permission behavior.
- Traits & Equipment now uses the canonical inventory row structure and exposes
  quantity plus owner-operable Equipped controls without requiring an Item
  sheet or drag-and-drop. Existing per-group Add controls remain the accessible
  creation path.
- Item Description submission now admits only `system.description` when the
  owner lacks protected mechanical edit authority. Native Active Effect forms
  are no longer opened for owners; the read-only Effects workspace renders
  summaries instead.
- Live player QA caught and removed the character sheet's older Skill and
  Specialization launcher guard. Owners can now open those records in Normal
  mode while the Item sheet itself keeps protected fields disabled.
- The same live pass traced previously silent Item Save rejection to an invalid
  `img` value synthesized by Foundry's extended form data. Ordinary Item
  submission now excludes `img`; the native image picker remains the sole,
  immediate artwork persistence path.
- Empty textareas are also read from the live form rather than trusting
  Foundry's omitted-empty extended data, so owners can both write and clear
  narrative descriptions.
- Automated validation passed the complete `npm run check` gate: 76 test files /
  343 tests, formatting, lint, TypeScript, both production bundles,
  deterministic content, package invariants, loader smoke, and the 14-page
  manual with 18 screenshots. The parity ledger is now Verified / Verified.

## Latest relative-scale live closure

- Visible GM QA closed the remaining p. 196 relative-scale branches without
  adding new rules interpretation.
- The retained rank-5 Starship laser cannon rolled 10D Damage from a 5D base
  against rank-0 Foundation Test Character. Public chat audited `+5D`.
- Foundation was temporarily set to rank 2; its 1D Brawn resistance became 3D
  against rank-0 TyfTester and public chat audited `+2D`. The Actor was restored
  to rank 0 and Normal mode.
- Together with the retained rank-5 mounted Attack card using Dodge 20 and the
  earlier rank-0 versus rank-2 Attack check, targeting/scale/resistance is now
  Verified / Verified.
- Automatic Token translation is still deferred because p. 32 supplies distance
  limits but no destination or facing. Completion must not invent player intent.

## Current unlinked-Token combat identity repair

- Live movement and round-recovery QA found that Foundation's retained Token is
  unlinked. The combat service matched the Token's synthetic Actor and its
  directory prototype by shared Actor ID, so the wrong sheet could expose and
  mutate combat state.
- Combat lookup now requires the same stable Foundry document UUID whenever the
  Combatant resolves an Actor. This distinguishes the directory prototype from
  an unlinked Token while tolerating newly resolved synthetic wrappers.
  Actor-ID fallback remains only for incomplete document stubs.
- A regression test proves that the prototype is not active while the synthetic
  Actor is. Round-start coverage also verifies one recovery for duplicate
  references and retention of Wounded.
- The alpha.4 bundle passed the complete gate at 76 files / 345 tests. After a
  named restart, visible GM QA proved the directory prototype remained outside
  combat while the synthetic Actor completed Run with −1D, finish-prone, Prone,
  and Dodge 15.
- The next-round live check recovered Stunned to Healthy and Standing with an
  empty declaration and 0D. A second advance retained Wounded and Prone. Cleanup
  restored both Actors, removed the temporary Combatant and macro, and returned
  the retained empty encounter to Round 1.

## Current personal damage resolution

- The project owner's accepted p. 33 rulings are now executable core rules:
  higher Brawn causes Staggered, a repeat causes Stunned, equal/lower Brawn
  causes Wounded, and a Complication on that Brawn roll instead causes Mortally
  Wounded. Repeated Wounded progresses to Incapacitated, then Mortally Wounded.
- A targeted personal weapon Damage card exposes **Resolve damage** to GMs only.
  It rolls the target's normal Brawn-plus-armor resistance with the source
  preselected and the Damage total as a strict fixed difficulty, applies the
  health transition, offers the existing Hero Point Stunned prevention choice,
  and writes a player-visible comparison/outcome audit back to the original
  card. Immutable source/scale context remains available if the source Token
  has since left the scene.
- The chat-message resolution flag is versioned and records resolving/applied
  status, totals, target, incoming result, previous/current condition, Brawn
  Complication, and prevention. Applied or in-progress cards cannot normally be
  resolved twice.
- This slice deliberately rejects Vehicle and Starship targets; their printed
  damage rules remain separate.
- Visible GM QA resolved two retained Starship-scale Damage cards. Foundation
  resisted Damage 32 with Brawn 3, and TyfTester resisted Damage 31 with Brawn
  17; both original cards recorded Wounded and removed their one-shot resolver.
  The fresh resistance card displayed `Failure · Difficulty 31`. A TyfTester
  player session saw both public summaries but zero resolver controls, GM
  Quickbar controls, or Active Tasks controls. Both Actors were restored to
  Healthy and Standing, and the visible browser was returned to the GM.

1. Perform the final human-input GM Quickbar pointer drag and confirm the
   persisted order after reload.
2. Run the remaining first-writer-wins follow-up race from two distinct owning
   player sessions when a second player credential is available.
3. Add the printed Mortally Wounded end-of-round death check and stabilization
   workflow without inventing a recovery shortcut.
4. Enforce the freshly Wounded remainder-of-round action forfeiture.
5. Implement Vehicle and Starship damage as its own rules-authoritative slice.
   Automatic Token translation remains deferred; do not invent destinations.
6. Add cover only after its source-backed modifier semantics are recorded.
7. Populate the ignored private description source only from lawfully held
   material, then generate and live-test the separate private content companion.

## Blockers before later phases

- Publisher/trademark/distribution permission.
- Initial optional module support profile.
