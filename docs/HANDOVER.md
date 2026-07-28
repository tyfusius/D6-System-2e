# Current handover

Updated: 2026-07-28

## Latest machine Actor pass

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
- The UI deliberately does not choose a crew member or automate Gunnery. It
  stores/displays the weapon attack bonus and cites the future coordinated
  workflow instead of treating the machine Actor as its own gunner.
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
- Page 33 contains two material contradictions. Damage automation is blocked.
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
  The provisional interpretation doubles the complete canonical pip score, so
  `5D+1` becomes `10D+2`; ADR 0007 records the source gap and replacement point.
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
  and schema 9. Milestone grants, Narrative arcs, and Second Edition
  Specialization acquisition remain separate planned workflows.
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
- GM Quickbar request controls now share the socket service's active non-GM
  owner resolver and are disabled when no eligible request target is online.
- GM Quickbar visibility is GM-only. Player request listeners now register at
  Foundry `ready`, when `game.socket` is available, instead of being attempted
  prematurely during `init`.
- The manifest now declares `"socket": true`; the former false value prevented
  Foundry from enabling the system channel used by remote roll requests.
- Dice So Nice now receives a distinct `dw` roll term and black-and-gold
  setting-neutral preset. The development world logged successful preset
  registration and completed a live `dw` roll without system console errors.
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

1. Complete a two-client GM/player validation of GM Quickbar roll requests,
   including disconnect, cancel, and GM takeover branches.
2. Capture a Dice So Nice animation frame showing the black-and-gold `dw`
   beside ordinary dice; registration and completed `dw` rolls are live
   verified, but the transient animation frame was not captured.
3. Target the remaining live Complication, repeated-explosion, and private
   visibility branches in Build 365.
4. Exercise the Actor read model and campaign profile through a live macro/module fixture for the
   future HUD.
5. Live-test reroll single-use behavior and the player-to-GM Wild Die decision
   route once its authoritative socket service exists.
6. Populate the ignored private description source only from lawfully held
   material, then generate and live-test the separate private content companion.

## Blockers before later phases

- Publisher/trademark/distribution permission.
- Page 33 errata or explicit table ruling.
- Minimum dice pool after penalties.
- Confirmation or errata for the provisional complete-pip-score interpretation
  of Hero Point Die Code doubling (ADR 0007).
- Initial optional module support profile.
