# Current handover

Updated: 2026-08-01

## Latest Second Edition Fantasy Bestiary and Fantasy Templates pass

- D62e printed pp. 165–171 (physical PDF pages 166–172) were extracted,
  rendered, and visually inspected. The four printed creatures combine broad
  Attribute baselines, explicit Dodge/Parry values, attacks, movement, scale,
  and conditional special facts; the four fantasy templates retain the normal
  21D Attribute and recommended 10D Skill guidance plus their optional-rule
  dependencies.
- OpenD6 Next's Creature Actor, Character/Species Template Items, schemas,
  compendium and import boundaries, ApplicationV2 registration, sheets,
  editors, styling, localization, creature semantics, and tests were traced.
  Its modern implementation contains neither a bestiary compendium nor a
  complete template-application transaction, so D62e keeps its existing exact
  character-template service and adds a separate bounded Creature workflow.
- Public API v1 now exposes an immutable, versioned, owner-scoped bestiary
  registry plus preview/create commands. The base creature and template
  catalogs are intentionally empty. Lawful companion content may register
  original entries; protected creature/template names, prose, and art are not
  distributed by the system.
- Schema 28 stores bestiary catalog, entry, owner, label, and printed-source
  provenance. A distinct Creature data model admits Die Codes through 20D
  while Character/NPC limits remain unchanged. Creation validates the active
  Second Edition campaign profile and optional-rule dependencies, then creates
  the Creature, active Skill catalog, declared Items, broad Attribute scores,
  defenses, movement facts, scale, Magic Points, biography, and provenance in
  one compensated persistence workflow.
- The GM-only Creature Catalog is an ApplicationV2 scene control that exposes
  exact previews, dependency issues, and complete Actor creation. Character
  templates registered by a lawful companion appear through the existing
  creation panel and preserve its creation-only, confirmation, ownership,
  rollback, and no-repeat guarantees. The accepted catalog capture is stored
  as `assets/manual/creature-catalog.png`.
- Live Foundry acceptance exposed two related TypeDataModel boundaries. New
  migration-backed scale/provenance fields retained their defaults during
  create, and migration helpers injected those defaults again during an
  unrelated partial sheet update. Creation now reasserts the complete fields
  through the persisted update boundary and deletes the new Actor if that
  final write fails; partial updates preserve absent movement, scale, and
  bestiary fields rather than overwriting them.
- Foundry v14 Build 365 visibly loaded `0.1.0-alpha.18` and schema 28. GM QA
  created and inspected a Creature with Agility 4D, Brawn 9D, Knowledge 2D,
  Perception 3D, Dodge 20, Parry 15, scale 2, source/catalog provenance, and
  both contributed QA Items. Switching to Free Edit preserved every value,
  and a full client reload retained the same Actor facts.
- A temporary passwordless Player fixture saw neither the GM-only Creature
  Catalog control nor the unowned QA Actor before or after a full reload.
  Cleanup removed the QA Actor, Macro, temporary User, and owner registration;
  Edge ended in the clean GM world with no browser warning or error.
- Development Foundry alone was restarted. Its empty stale
  `options.json.lock` directories were moved recoverably under `/private/tmp`;
  both the local and public development endpoints returned the expected
  `/dev/join` redirect, and production was untouched.
- The final gate passed formatting, lint, typecheck, 122 test files / 604
  tests, both production bundles, content packs, the rebuilt 14-page / 35-image
  manual, package invariants, and generated-bundle lifecycle smoke. The loader
  initializes API v1 and schema 28.

## Latest Magic Points Casting and Active & Responsive Combat pass

- D62e pp. 160–164 were extracted, rendered, and visually inspected. Magic
  Points Casting replaces Spell School with Mystical Alignment, calculates the
  pool as Magic dice plus three times Mystical Alignment dice, costs one point
  per ten points (rounded up) of spell difficulty, succeeds without a casting
  roll, and recovers Magic dice each elapsed hour.
- Schema 27 adds a loss-preserving Magic Point resource and weapon Autofire
  rating. Owner casts and recovery use the mechanical-edit authorization
  boundary; the public API exposes pool read/recovery and the no-roll cast
  result. Character sheets and chat show current/maximum, cost, remaining
  points, and pp. 160–162 provenance.
- The opt-in Active & Responsive Combat module adds persisted Combatant-scoped
  Full Defense and Feint state, next-attack Feint consumption, Wild Die 6 Feint
  follow-up, Wild Die 1/missed-attack Riposte follow-up with Hero Point spend,
  and Autofire's attack-for-damage exchange. Static defenses, roll dialogs,
  chat audit, and owner/GM commands all consume the same typed state.
- OpenD6 Next's manifestation resource/cast boundaries, Combatant revision
  state, reaction controls, ownership patterns, reload persistence, and
  structured chat were traced. D62e retains pp. 160–164 arithmetic and does not
  import Control/Sense/Alter or OpenD6 active-defense mechanics.
- Implementation ruling: where the book says to add/subtract a printed Skill
  value from a numeric static Defense, D62e maps the Skill to its whole-die
  rating (4D becomes 4), not its internal pip score or a ×5 difficulty value.
- Live Foundry v14 Build 365 GM QA loaded `0.1.0-alpha.17` and API v1. A Magic
  4D / Mystical Alignment 6D fixture derived 10/10 Magic Points, spent one on
  a Difficulty 10 Manifestation without a roll, created the source-cited cast
  card, recovered to 10/10, and retained the balance after client reload.
- The same live matrix persisted Full Defense at Dodge 19 / Parry 24 and a
  Feint with defense penalty 4 against a real Token/Actor fixture. The Feint
  survived client reload and remained visible on the Combat workspace. Because
  the isolated browser exposes no WebGL, its token lookup used a minimal
  in-memory adapter over the real persisted Token and synthetic Actor documents;
  canvas pointer targeting itself was not claimed.
- Live QA found and fixed two acceptance-boundary defects: Feint/Riposte buttons
  now create their action container when no Hero Point follow-up exists, and
  immutable Magic cast results are cloned before Foundry cleans ChatMessage
  flags. Accepted live captures are stored as
  `assets/manual/second-edition-magic-points.png` and
  `assets/manual/active-responsive-combat.png`.
- Cleanup removed both temporary Actors, both Tokens, both Combatants, and the
  exact QA chat card, then restored Fantasy Skills, Freeform Magic, Magic Points
  Casting, Active & Responsive Combat, and the optional Magic Attribute to off.
  The retained validation Combat and all unrelated world data were preserved.
- Player-role QA is not claimed for this pass: no distinct player credential
  was authorized, and the available browser-control surface could not attach to
  the user's already-open Edge tabs. Owner/GM boundaries remain automatically
  covered, while a future separate-player check should confirm the same sheet
  controls, chat follow-ups, and reload behavior.
- The final gate passed formatting, lint, typecheck, 118 test files / 593
  tests, both production bundles, content packs, the rebuilt 14-page / 34-image
  manual, package invariants, and generated-bundle lifecycle smoke. The loader
  initializes API v1 and schema 27.

## Latest Second Edition Fantasy Skills and Freeform Magic pass

- D62e printed pp. 140–159 were extracted, rendered, and visually inspected.
  The authoritative range is broader than the earlier 140–153 handover note:
  Fantasy Skills occupy pp. 141–145 and Freeform Skill-Based Magic continues
  through p. 159. Magic Points begins on p. 160.
- The opt-in Fantasy Skills module supplies Riding, Lockpicking, Swimming,
  Barter, Navigation, Traps, Gambling, and Streetwise while retaining the
  existing core Languages identity. The campaign profile exposes the module
  and the printed recommendation of +1D creation budget per three added Skills
  without silently changing a GM's configured budget.
- Freeform Magic fails closed unless both the optional Magic Attribute and
  Skill Specializations are active. It adds Arcane World, Craft Magic Item,
  Identify Magic, Spell School, and the four printed Spell School
  specializations: Change/Alteration, Movement/Apportation,
  Creation/Conjuration, and Knowledge/Divination.
- Versioned core contracts and `game.system.api.magic` expose lawful original
  Manifestation design, difficulty calculation, and owner casting. The exact
  base, Power, target, resistance, duration, casting-time, and range arithmetic
  is pure and tested; final difficulty has the printed minimum 5.
- Native Manifestation Items store the seven design facts under schema 26.
  Their focused editor persists each change, recalculates a visible difficulty
  breakdown, and casts through the ordinary protected roll builder. The chat
  audit records school, Power, untrained +5/+10 status, difficulty, and
  pp. 145–159 provenance without claiming to automate arbitrary spell effects.
- OpenD6 Next's manifestation/metaphysics schema, Item presentation, owner
  casting, component roll flow, public API, localization, and tests were traced
  completely. D62e adopts its typed document and permission boundaries, not
  its Control/Sense/Alter mechanics or named content.
- Live QA found and fixed three presentation/persistence defects before
  acceptance: manifestation type localization, inherited generic Trait fields,
  and design controls that did not persist through close/reopen. The accepted
  Difficulty 30 editor is captured in
  `assets/manual/freeform-magic-design.png`.
- Foundry v14 Build 365 visibly loaded `0.1.0-alpha.16` and schema 26 after the
  development container alone was restarted. A confirmed stale options lock
  was moved recoverably to `/private/tmp/d6e2-options-json-lock-alpha16`;
  production was untouched.
- GM QA built and reloaded a Power 3, two-or-three-target, partial-resistance,
  one-round, senses-range Manifestation at Difficulty 30, then cast it at fixed
  Difficulty 40 through the printed no-Magic-dice +10 path. TyfTester opened
  the owned Item, used the same protected cast dialog, created the same audited
  card, and retained it after reload.
- Cleanup removed the temporary Actor, Macro, and QA chat records and restored
  all four temporary world settings. Live browser logs contained only Foundry's
  1280×720 minimum-window warning and no D62e system error.
- The final gate passed formatting, lint, typecheck, 116 test files / 586 tests,
  both production bundles, content packs, the rebuilt screenshot manual,
  package invariants, and generated-bundle lifecycle smoke. The loader
  initializes schema 26.

## Latest Second Edition character-templates pass

- D62e printed pp. 138-139 (physical PDF pages 139-140) were extracted,
  rendered, and visually inspected. A template fixes the four core Attribute
  values at the normal 12D total, while the player still assigns the complete
  7D Skill budget and selects equipment after Skills. Suggested Skills are
  guidance only; the core templates do not use optional rules components.
- OpenD6 Next's native `character-template` Item schema, compendium boundary,
  editor, contained Items, CSS, localization, quickbar integration, tests, and
  current validation records were traced completely. Its modern code does not
  contain a complete apply transaction, so D62e adapts the document and
  presentation boundary while adding its own fail-closed application service.
- Public API v1 now exposes immutable, owner-scoped character-template catalog
  registration plus preview/apply commands. The base catalog is intentionally
  empty. Registered templates must use the exact active campaign Attribute IDs
  and budget, keep every Attribute from 1D through 5D, reference existing
  stable Skill keys, and restrict optional additions to Armor, Gear, or Weapon
  Items. Named protected templates are not distributed.
- Creation-only owner/GM application writes exact Attribute scores and
  schema-25 source/catalog/template provenance. It does not allocate Skill
  dice or write resources, health, advancement, or arbitrary Actor fields.
  Same-client repeat attempts are serialized, applied Actors fail closed, and
  every newly created equipment Item is removed if final Actor persistence
  fails.
- The Character Creation panel reports available lawful templates, opens a
  complete confirmation preview, keeps invalid templates inspectable with
  localized reasons, selects the first valid entry, and replaces the action
  with a source-cited applied summary after success. The accepted live preview
  is stored as `assets/manual/character-template-preview.png`.
- Foundry v14 Build 365 loaded `0.1.0-alpha.15`, migrated 81 documents to
  schema 25, and kept Token Action HUD's public API negotiation working. The
  development container alone was explicitly stopped and started; its
  confirmed-empty stale lock was moved recoverably to
  `/private/tmp/d6e2-options-json-lock-alpha15`. Local port 30001 and public
  `/dev` returned the expected `/dev/join` redirect; production was untouched.
- Visible GM QA previewed and applied a lawful generic template, observed the
  exact 1D-to-5D/3D/1D/3D replacements, unchanged 0D Skill increases and Hero
  Point balance, one added Gear Item, source provenance, no repeat action, and
  full reload persistence. TyfTester saw only owned Actors, applied the same
  template without GM controls, and retained the identical state after reload.
- Cleanup permanently removed both temporary Actors and the temporary Macro;
  no QA chat was created. Both roles reproduced only Token Action HUD Core
  2.1.1's already-documented missing `list-subgroup.hbs` reload error. The D62e
  template workflow remained available and produced no system error.
- The final gate passed formatting, lint, typecheck, 113 test files / 578
  tests, both production bundles, content packs, the rebuilt screenshot manual,
  package invariants, and generated-bundle lifecycle smoke. The loader
  initializes Actor schema 25.

## Latest Second Edition Environments pass

- D62e pp. 77-78 were extracted, rendered, and visually inspected. The optional
  rules component now covers cold, heat, poisonous air, and drowning with their
  printed Stamina difficulties, penalties, movement effect, condition changes,
  and recovery difficulty.
- A GM-only world setting adds an Environments manager to Token Controls. The
  GM chooses the Actor, hazard, and severity; resistance uses Stamina or Brawn
  when Stamina is absent, and a failed check stores one versioned, source-cited
  effect on that personal Actor. The sheet and ordinary roll/chat audit expose
  the active effect.
- Active moderate/severe penalties apply to Attribute, Skill, Attack, Damage,
  and resistance pools, independently of MAP. Moderate cold halves the movement
  limits shown by the declaration workspace. Severe cold/heat promotes later
  Stunned results to Wounded. Deadly hazards, severe poisonous air, and repeated
  drowning failures use the printed Condition outcomes.
- Aid uses any chosen owned Skill at the original resistance difficulty. A
  confirmed safe day provides the other recovery route. Recovery clears only
  the same effect and restores its prior Condition only when no later injury
  has replaced the condition it applied.
- Foundry does not infer damaged protective gear, four-hour or turn timing,
  poisonous-air side effects, or elapsed safe days. The manager displays the
  safe-breath-round allowance for drowning, while the GM remains responsible
  for when each check occurs.
- Schema 20 adds loss-preserving environment-effect state to Character,
  Creature, and NPC Actors. Stored effects remain inert when the rules component
  is disabled. No public API surface was added.
- Foundry v14 Build 365 visibly loaded `0.1.0-alpha.11` and migrated 81
  documents to schema 20. GM QA persisted a Cold/Severe failure, reloaded the
  client, and observed the source-cited effect on both the manager and repaired
  Combat workspace. A Medicine 3D roll resolved at 1D and published the exact
  environmental penalty audit. Choosing Stunned while the severe effect was
  active produced Wounded, and the Actor was then restored to Healthy.
- The in-app browser could not dispatch any custom Scene-control callback,
  including the already-verified GM Quickbar. A temporary visible Script Macro
  invoked the exact registered Environment-manager callback; the actual GM-only
  Token Controls button, manager UI, dialogs, roll builder, chat, persistence,
  and cleanup were all exercised normally. TyfTester had neither the manager
  nor GM Quickbar before or after a full reload.
- Cleanup cleared the environmental effect, restored both incidental Hero Point
  awards, removed all three pass-created chat cards, disabled the module, and
  permanently deleted the temporary Macro. Production was not touched.
- The final `npm run check` passed formatting, lint, typecheck, all 94 test
  files / 482 tests, both production bundles, content packs, the 14-page and
  26-screenshot manual, invariants, and generated-bundle loader smoke. The
  loader verified 59 registered settings and Actor schema 20.

## Latest Second Edition Chases pass

- D62e pp. 73-74 were extracted and visually inspected. The optional module now
  provides two fixed representatives with independently selected Skills,
  starting Distance 4 (GM-adjustable from 1 through 7), capture at 0, escape at
  8, one-step ordinary wins, and a GM-confirmed two-step Exceptional Success.
- A GM-only world setting adds the Chase tracker to Token Controls. Its typed,
  revisioned state persists on the current Scene; participant owners may submit
  only their side, the active GM validates ownership and serializes updates,
  and the public API exposes read and command boundaries. No Token translation
  or invented destination is included.
- Resolution reuses the existing D62e p. 25 opposed tie order and writes a
  shared audit card with both totals, both Wild Die outcomes, any table ruling,
  the Exceptional Success decision, and the exact Distance change. Ending a
  chase is confirmed and clears only that Scene's flag.
- Live Build 365 QA started `Live Chase Validation` with Foundation Test
  Character / Climbing pursuing TyfTester / Acrobatics. A normal exchange
  visibly moved 4 to 3; the final exceptional exchange moved 4 to 2 and
  produced the complete chat audit. Live resolution exposed and fixed Foundry
  flag merge semantics retaining old roll keys; Exchange 2 now presents two
  fresh Roll Skill controls. A separate TyfTester login saw only the owned
  fleeing roll, no resolve/end controls, and retained Distance 4 after reload.
- Live QA also exposed and fixed an unbound `HandlebarsApplicationMixin` in the
  new tracker. The accepted screenshot is included in the manual. Cleanup
  ended the chase, disabled the module, and removed the six pass-created chat
  cards. A genuinely simultaneous player-to-GM socket submission remains
  automated-only because the available browser surfaces share one profile.
- The final `npm run check` passed all 461 tests plus formatting, lint,
  typecheck, both production bundles, content-pack validation, the 14-page and
  25-screenshot manual, invariants, and loader smoke. System and companion
  versions are `0.1.0-alpha.10`; Actor schema remains 19.

## Latest Alternate Wild Dice pass

- D62e core pp. 26-27 and the complete optional family on pp. 71-73 were
  extracted and visually inspected. The earlier handover range ending at p. 72
  omitted the Simple strategy on p. 73 and is corrected here.
- One GM-only world selector now makes Core, Basic, Classic, and Simple mutually
  exclusive. Basic explodes sixes and automatically removes an initial Wild Die
  1 plus the highest ordinary die. Classic explodes sixes and sends an initial
  1 to the active GM for a typed Penalty or narrative Complication decision.
  Simple explodes sixes and counts every other result normally.
- The shared result contract retains the exact strategy. Discarded dice are
  visibly struck on the chat card, every strategy is named and page-cited, and
  the OpenD6 compatibility Wild Die remains a separate setting and rules path.
- OpenD6 Next's typed result, settings, automatic/prompt handling, DialogV2,
  chat flags, localization, permissions, and tests were traced completely while
  D62e remained the mechanics authority.
- The final `npm run check` passed all 454 tests plus formatting, lint,
  typecheck, both production bundles, content-pack validation, the 14-page and
  24-screenshot manual, invariants, and loader smoke.
- Visible GM/player QA selected every strategy. Basic visibly removed Wild Die
  1 and the highest ordinary die. A player Classic 1 opened the GM-only
  Penalty/Complication decision and synchronized the chosen penalty card to
  both clients. Simple visibly counted an initial 1 normally and also retained
  a post-explosion 1 in the total.
- With Simple still selected, enabling OpenD6 compatibility produced a shared
  `OpenD6 classic` card citing D6S pp. 55-56, proving isolation. A full player
  reload retained results and exposed only Personal theme and Default roll
  visibility, never the world selector.
- Cleanup restored Core, disabled OpenD6 compatibility, removed only this
  pass's QA cards, logged out the player, and retained the public GM session.
  Both live browser consoles were free of warnings and errors. System and
  companion versions are `0.1.0-alpha.9`; Actor schema remains 19.

## Latest Second Edition Wounded action-forfeiture pass

- D62e p. 33 was extracted and visually inspected again. A character who
  becomes Wounded falls prone, loses every remaining action in that round, and
  acts at the ordinary Wounded -1D penalty in later rounds.
- The versioned Combatant round contract now stores an optional typed
  `actionForfeiture` with stable reason `wounded` and source page 33. It keeps
  completed segments, suppresses all remaining segments, rejects redeclaration
  and completion, and resolves to clean round state when Foundry advances.
- The targeted personal-Damage resolver applies the marker only when a Second
  Edition result freshly changes an active Combatant to Wounded. First Edition,
  resistance, and damage rolls retain their separate rules paths.
- Ordinary action rolls are blocked under Enforced, Optional, and Manual
  assistance. The Character Combat tab, original Damage card, public read
  model, and Token Action HUD distinguish forfeiture from an empty or normally
  completed declaration. The GM retains a corrective reset; player reset is
  disabled.
- Visible GM QA declared three actions for TyfTester, completed **Draw weapon**,
  then resolved a retained character weapon's 12D Damage for 43 against Brawn
  resistance 15. The original card recorded Wounded and the p. 33 forfeiture;
  the Combat tab preserved the first segment and marked **Take cover** and
  **Return fire** forfeited.
- A visible TyfTester session saw declaration, completion, and reset disabled.
  An Acrobatics attempt was rejected with the Wounded round message. A full
  player reload retained the exact state; advancing to Round 2 removed it,
  restored declaration availability and 0D round MAP, and retained Wounded.
- Cleanup restored TyfTester to Healthy, the weapon to 0D and unequipped,
  removed the temporary Token, Combatant, macro, and two QA chat cards, cleared
  targeting, returned the retained Combat to empty Round 1, and paused the
  world. System and companion versions are `0.1.0-alpha.8`; Actor schema stays
  19 because the new state is an additive Combatant flag.

## Latest First Edition mortality and stabilization pass

- OpenD6 Space pp. 76 and 79 were extracted and visually inspected again.
  Wound-level stabilization remains the printed Medicine 25 one-level
  improvement; the separate Body Points rescue paragraph was not copied.
- Schema 19 adds a loss-preserving completed-round mortality clock and last
  processed Combat-round ID. Entering or leaving Mortally Wounded resets it.
- The deterministic primary active GM now rolls Strength at each completed
  Combat round. Twelve printed five-second rounds become one elapsed whole
  minute; Strength below that locked difficulty changes the Actor to Dead.
- The mandatory roll bypasses editable setup, MAP, actions, and wound penalties.
  Its typed chat context records completed rounds, whole minutes, difficulty,
  source page, and the ordinary First Edition Wild Die result.
- Repeated delivery of the same round is idempotent, distinct unlinked Token
  Actors remain distinct by UUID, and a secondary active GM does not duplicate
  the check.
- The Mortally Wounded sheet labels Medicine 25 as **Stabilize with Medicine**.
  Success improves the wound to Incapacitated and clears the mortality clock;
  no additional recovery shortcut or Body Points rule is inferred.
- Visible GM plus TyfTester QA advanced a retained Actor from round 1 to round
  2 and observed exactly one public automatic Strength card on both clients.
  The card audited 1 completed round, 0 minutes, fixed Difficulty 0, and p. 76;
  the Actor remained Mortally Wounded with the same persisted clock.
- The same visible pass selected **Stabilize with Medicine**, showed the locked
  difficulty 25, rolled 13D for a total of 47 with a Complication, and improved
  the patient to Incapacitated. Live tracing exposed and fixed schema 18
  discarding later injury-state fields during DataModel migration, the need to
  persist the wound and clock atomically, and an untranslated chat-card key.
- Cleanup restored the boosted healer Skill, the patient to Healthy, the native
  Second Edition preset, and the retained scene; temporary macros, Token,
  Combat, Combatant, and QA chat cards were removed.
- The final server-log audit also exposed player-side preset fan-out: a
  non-GM client received the GM's master-setting change and attempted protected
  world writes. Both master-preset application and master synchronization now
  require a GM client, with automated coverage for zero player writes.

## Latest First Edition stun and consciousness pass

- OpenD6 Space pp. 75-76 were visually verified for stun-only Wound reduction,
  unconscious duration, and the Incapacitated Stamina/Willpower check.
- Schema 18 adds persistent consciousness, source, reduced stun result, and
  unconscious minutes without mutating either physical damage track.
- A Weapon whose Damage Type contains `Stun` uses the targeted GM resistance
  workflow, reduces the ordinary result by two Wound levels (minimum Stunned),
  records the audit on the original chat card, and puts the target prone and
  unconscious. Fully resisted attacks record no injury.
- Incapacitated now requires a free Stamina or Willpower Moderate (15) check.
  Success permits action at the existing -3D penalty; failure rolls 10D minutes.
  Unresolved, unconscious, Mortally Wounded, and Dead Actors cannot make normal
  action rolls. Owners and GMs may mark temporary unconsciousness resolved.
- The source's negative-duration wording is treated provisionally as the
  positive Damage-minus-resistance difference; see Rules Ruling 5.
- OpenD6 Next's damage-application and condition-lifecycle layers were traced.
  D62e keeps the same separation but follows the fixed Space thresholds and
  leaves the optional accumulating-stuns variant for its named module.
- Visible TyfTester QA reloaded the schema-18 bundle, opened the owned sheet and
  Second Edition Combat tab, and found no browser warnings/errors or regression
  in the existing condition track. The GM session was occupied and the world
  was not switched, so the new First Edition controls and full roll sequence
  remain a named live-QA follow-up.

## Latest First Edition Wound healing pass

- OpenD6 Space pp. 76 and 79 were extracted and visually inspected. The Body
  Points rescue paragraph was kept separate from the Wound Level healing table.
- Injured First Edition character sheets now expose natural healing, assisted
  Medicine healing, and elapsed-minute Mortally Wounded Strength checks.
- Natural healing confirms the printed rest period; Stunned recovers after one
  minute, Wounded can fully heal, higher levels improve one step on success, and
  a Wild Die Complication applies the printed Critical Failure worsening.
- Assisted healing selects an owned Actor with Medicine, locks the printed
  10/15/20/25 difficulty, and improves the patient exactly one level. The UI
  states the once-per-patient-per-day limit without inventing campaign-time
  persistence.
- Mortality checks ask for whole minutes at the level, lock that value as the
  difficulty, and set Dead only when Strength is lower. Healing and death checks
  bypass MAP and wound penalties because they are recovery/resistance checks,
  not declared combat actions.
- OpenD6 Next's condition lifecycle was traced, but its configurable Moderate
  mortality difficulty was not copied because it conflicts with the printed
  elapsed-minute rule.

## Latest First Edition movement-roll and wound pass

- OpenD6 Space pp. 63-64 and 75-76 were extracted and visually inspected.
- Movement plans with a printed difficulty now open the appropriate Running,
  Swim, Climb/Jump, or Flying/0-G check with the difficulty fixed. Missing
  Skills fall back to the governing Agility or Strength Attribute. Cancelling
  the roll does not spend the tracked action.
- Schema 17 adds `health.firstEditionWound` without converting or overwriting
  `health.condition`. The active sheet track switches by damage capability.
- The First Edition damage strategy is active and uses damage minus resistance:
  1-3 Stunned, 4-8 Wounded, 9-12 Incapacitated, 13-15 Mortally Wounded, and
  16+ Dead. Repeated or lesser injuries advance the current wound one level,
  including the distinct Severely Wounded state.
- First Edition resistance uses Strength/Brawn plus equipped armor, excludes
  action and wound penalties, and retains a p. 76 audit. Wounded, Severely
  Wounded, and Incapacitated apply -1D, -2D, and -3D to ordinary action rolls.
- The existing GM-only targeted Damage workflow selects the active edition
  strategy and persists which strategy produced the applied result.

## Previous First Edition defense and movement pass

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

The 2026-07-31 advancement-closure pass rechecked D62e printed pp. 86-93 and
closed the remaining Narrative reward gap from p. 92. When the optional
Perks/Flaws/Talents module is active, a Narrative arc may now create a new R1
Perk or advance an existing Perk; the required number of story steps equals the
new Perk rank. Flaw and Talent arcs remain deliberately absent, matching the
book's recommendation. New-Perk naming, module gating, owner proposal and step
completion, GM approval and grant, audit persistence, and rollback-safe Item
creation/rank updates all use the existing protected advancement boundary.
Schema 22 admits the additive `perk` reward kind and permits R1 targets without
weakening Attribute/Skill validation.

Visible Build 365 QA ran the complete flow with a temporary R1 Perk arc. The GM
proposed and approved it, the owning player saw no approval/grant controls and
completed the sole step, and the GM granted a persisted Rank-1 Perk. Completed
history and the embedded Item survived reload. Both were then deleted, the
Actor returned to Free Edit, and the world returned to Unselected advancement
with Perks/Flaws/Talents disabled. The final browser log contained no warnings
or errors. Activating the build required removing the exact empty stale
`data/Config/options.json.lock` directory left by the container stop; no world
data was removed. The container finished healthy and the public route returned
HTTP 302 to `/dev/join`.

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

## Current Vehicle and Starship damage resolution

- Targeted Vehicle and Starship Damage cards use the same GM-only,
  one-resolution chat workflow as personal damage while retaining a distinct
  rules strategy and audit identity.
- D62e pp. 180 and 183 supply Hull + Shields for Starships and Hull + Armor for
  Vehicles. Resistance remains penalty-exempt and consumes the original
  Damage card's immutable target and scale context.
- Machine outcomes use the accepted Second Edition Condition progression but
  cannot spend personal Hero Points, force personal posture, or forfeit a crew
  Actor's actions. Round-start recovery still enumerates only Character,
  Creature, and NPC Actors, so machine Conditions persist.
- The Combat workspace offers Repair Mechanical only where the book supplies a
  difficulty: 10 Stunned, 15 Wounded or Incapacitated, and 20 Mortally Wounded.
  It selects an owned repairer, uses Repair when present or untrained
  Mechanical, clears the Condition only on success, and keeps Staggered/Dead
  manual rather than inventing a difficulty.
- OpenD6 Next's permission, one-shot application, persistent track, test, and
  reload pattern was traced; its different vehicle-damage table was not copied.
- Visible GM QA rolled a rank-5 Starship's 5D weapon Damage against a targeted
  rank-3 Vehicle. The builder applied +2D for 7D, the Vehicle resisted with
  Hull 1D + Armor 1D, and Damage 22 versus resistance 6 produced and persisted
  Wounded exactly once.
- Repair selected an owned Character with a temporary 12D Repair skill, locked
  Difficulty 15 for Wounded, and restored the Vehicle to Healthy on a total 41
  partial success. Live QA found and fixed a stale `Brawn resistance pool`
  scale label and a machine-sheet close/focus microtask error.
- After the corrected bundle restart, a fresh Damage 17 versus resistance 8
  result displayed `Hull resistance pool`, Hull 1D + Armor 1D, and the public
  Wounded audit. TyfTester saw both public cards and zero resolver controls,
  including after leaving and rejoining the world. The temporary Token, Macro,
  Repair skill, five chat cards, Condition, Hero Point, and target state were
  removed or restored; the post-cleanup browser console contained no errors.
- Automated and live validation details are recorded in
  `docs/FOUNDATION-VALIDATION.md` and the parity ledger.

## Current Second Edition Cover modifier boundary

- D62e p. 30 and adventure pp. 245 and 248 were extracted and visually
  inspected. They establish declaring and benefiting from Cover but supply no
  numeric tiers, fixed modifiers, or full-Cover exception.
- OpenD6 Next's complete modern target/difficulty/chat path was traced. Its
  retained narrative Vehicle field and the older OpenD6 +1D/+2D/+4D tiers were
  not treated as Second Edition rules.
- A targeted Second Edition ranged Attack now accepts a nonnegative flat Cover
  modifier adjudicated by the GM. The builder updates effective Dodge, and the
  immutable roll request, public chat card, and flags retain base Dodge, Cover,
  total defense, and p. 30. Melee, Damage, resistance, and First Edition rolls
  are unchanged. No persistent schema or Token-position inference was added.
- Pure planner, adapter, template, localization, and chat-contract coverage is
  included. `npm run check` passed all 448 tests plus build, content, manual,
  invariant, and loader validation. Visible GM QA entered Cover 5 against base
  Dodge 30 and observed the builder and public card resolve at Difficulty 35.
  TyfTester saw the same `30 + 5 = 35` equation and p. 30 after reload with no
  GM controls. Cleanup restored the awarded Hero Point to 0, returned the sheet
  to Normal, and deleted the QA card. The known Token Action HUD Core
  `list-subgroup.hbs` reload error remains external to this pass.

## Current Equipment by Genre/Era foundation

- D62e pp. 79-85 were extracted and visually inspected. The three alternative
  families are Medieval, Modern, and Science Fiction. Named tables, item names,
  prose, and values remain behind the content-license gate; acquisition and
  cost remain GM-adjudicated.
- Schema 21 adds lossless equipment era and catalog provenance to typed Gear,
  Weapon, Armor, and Cybernetic Items. Existing and imported Items remain
  visible regardless of the campaign selection.
- The world setting resolves through the campaign profile and dedicated Second
  Edition settings app. New equipment inherits the selection. A GM can edit the
  classification; owning players can use ordinary inventory controls but cannot
  rewrite provenance.
- Public API v1 now exposes an owner-scoped, validated, immutable equipment
  catalog registry. The base citation-only catalog is intentionally empty so a
  licensed Foundry module can contribute content without protected material
  entering this repository.
- OpenD6 Next's typed equipment documents, compendia, inventory controls, Item
  fields, ownership rules, and hide-compendia setting were traced completely.
  D62e deliberately uses persistent classification and warnings instead of
  hiding mismatched Items.
- `npm run check` passed 97 test files / 492 tests before live QA. Build 365 then
  loaded `0.1.0-alpha.12`, migrated 81 documents to schema 21, and visibly
  passed GM settings, create/default, Item-sheet, reload, player read-only-era,
  player Equipped, and player-reload checks. Cleanup deleted the temporary Gear
  and restored Unclassified. The final post-documentation gate passed the same
  492 tests plus both bundles, content packs, 14-page/27-screenshot manual,
  package invariants, and generated-bundle loader smoke.

## Current Module: No Dodge Defense pass

- D62e pp. 29-34 and p. 94 were extracted, rendered, and visually inspected.
  Personal ranged attacks use fixed Point Blank 5, Short 10, Medium 15, Long
  20, or Long 30 when the target is dodging. Melee retains Parry and machines
  retain Defense. Strict `attack > defense` remains unchanged.
- A dedicated campaign setting now selects the typed
  `no-dodge-range-difficulties` defense strategy. The character/creature Combat
  sheet removes Dodge and its posture display while retaining Parry,
  resistance, movement, and conditions. First Edition active-defense
  compatibility still takes precedence when explicitly selected.
- Targeted personal ranged attacks derive the fixed difficulty from measured
  range, expose the printed Long-range dodging choice only when eligible, add
  GM-adjudicated Cover, and retain strategy, p. 94, dodging state, base
  difficulty, and effective difficulty in immutable roll context, flags, and
  public chat. Dodge-only prone and smaller-target scale bonuses do not alter
  the replacement difficulty.
- OpenD6 Next's complete targeting, distance, range, settings, presentation,
  and audit paths were traced and adapted; its active Dodge scheduler was not
  imported. Pure planners, capability/profile/settings adapters, templates,
  localization, and Foundry UI contracts are covered automatically.
- Build 365 GM QA verified the checked settings card, resolved campaign module,
  localized capability label, Dodge-free sheet, Parry 15, Long 20, Long
  dodging 30, Cover 5 total 35, and the public p. 94/p. 30 audit. TyfTester saw
  the same Long controls and public card, retained them across reload, and had
  no GM Quickbar, task manager, module setting, or module catalog. Cleanup
  removed the two temporary weapons, four exact temporary Tokens, two Macros,
  the one chat card, restored Hero Points to 0, and disabled the module. The
  affected settings and roll-builder manual screenshots were refreshed.
- The final `npm run check` passed formatting, lint, typecheck, 98 test files /
  502 tests, both production bundles, content packs, the 14-page/27-screenshot
  manual, package invariants, and generated-bundle lifecycle smoke. The loader
  registered 61 system settings and initialized Actor schema 22.

## Current Module: Hyper-lethal Combat pass

- D62e p. 33 and pp. 89-90 were extracted, rendered, and visually inspected.
  The four options are independently selectable: remove Stunned, remove
  Wounded, strict below-half Killing Blows with a one-Hero-Point survival
  choice, and a maximum 6D personal Brawn-plus-Armor resistance pool.
- OpenD6 Next's complete character-damage resolver, resistance construction,
  configurable deadliness, authoritative application, status synchronization,
  settings, and chat-audit paths were traced. D62e mechanics replace its wound
  table; First Edition wounds, machine Hull damage, environmental direct
  Conditions, and manual condition changes remain isolated.
- Pure core planners now shorten the condition track for either or both removal
  options and detect Killing Blows with the printed strict inequality. The
  resistance planner caps only the personal Brawn-plus-Armor base pool; relative
  Scale is still applied and audited separately.
- Four stable world settings resolve through the campaign profile and the
  source-ordered settings catalog. The character Combat sheet previews both the
  uncapped and capped pools. Roll requests and public chat retain the cap and
  p. 90; damage flags retain active removal rules, Killing Blow detection,
  Hero Point survival, and the final condition.
- Build 365 GM QA visibly saved and reloaded all four settings, showed the
  resolved `Module: Hyper-lethal Combat` campaign entry, capped Brawn 1D plus
  Armor 6D from 7D to 6D, and produced the matching p. 90 public resistance
  audit. A 20D Damage roll against a 4D target triggered the Killing Blow
  dialog; spending one of two Hero Points survived and applied Mortally Wounded
  because both intermediate levels were removed.
- TyfTester saw the complete public Damage and resistance audit but had zero
  Hyper-lethal controls and no Second Edition configuration submenu. Cleanup
  restored the base Actor and unlinked Token resources/conditions, restored the
  original unequipped 0D Weapon, deleted the temporary Armor and Macro, removed
  all five QA chat cards, and returned all four settings to off. The settings
  screenshot was refreshed from the accepted live view.
- Automated coverage includes pure-domain combinations and threshold edges,
  setting/profile/catalog adapters, Hero Point transactions, ApplicationV2 and
  chat contracts, personal/machine boundaries, build, content, manual,
  invariants, and loader lifecycle smoke. The loader now registers 65 system
  settings; the final pass contains 99 test files / 508 tests.

## Latest Module: Hero Points pass

- D62e pp. 75-76 now resolve through one campaign strategy: Heroic, Basic, or
  Classic. Heroic retains core doubling, failed-roll reroll, Stunned prevention,
  and GM session refresh/carry-over. Basic buys ordinary bonus dice one-for-one.
  Classic shares Experience Points, requires Classic Wild Die and Experience
  Point advancement, buys independent Wild Dice up to the baseline Attribute's
  whole dice, and awards every Classic Wild Die 6. Superheroic Hero Points remain
  deferred to p. 204.
- Roll contract version 2 records arbitrary spend/award counts, ordinary and
  Wild bonus-die counts, and each independently exploding Wild Die face group.
  Existing V1 TypeScript names remain additive compatibility aliases.
- One protected resource service owns Heroic/Basic `heroPoints` and Classic
  `experiencePoints` transactions across rolls, Troubles/Assets, Killing Blows,
  conditions, and Heroic session refresh. Classic presents one shared sheet
  field and retains normal Experience Point advancement compatibility.
- Build 365 GM QA visibly passed Basic's two ordinary dice and two-point spend,
  Classic dependency enforcement, shared resource field, 3D spend cap, three
  bonus Wild Dice, a real mishap decision, an exploding Wild Die 6 award, reload,
  and complete cleanup. TyfTester saw the public audit, a disabled shared field,
  and no campaign settings. The final GM console was clean; the player reload
  separately reproduced Token Action HUD Core's pre-existing missing
  `list-subgroup.hbs` partial error.
- Cleanup restored Heroic/Core/no advancement/starting 1/carry-over off,
  Foundation Hero Points 2, Experience Points 0, and removed four QA cards. The
  accepted settings and roll-builder screenshots were refreshed.
- Automated coverage includes pure strategy and spend caps, Basic pools,
  Classic multi-Wild/explosion/award resolution, Foundry batching, dependency
  fail-closed behavior, the shared resource/session service, feature awards,
  sheet/settings templates, both production bundles, documentation, invariants,
  and loader lifecycle. The pass contains 101 test files / 522 tests and the
  loader registers 67 settings.

## Latest Module: Alternate Initiative pass

- D62e pp. 69-70 now resolve through one native Standard, Simple, Basic, or
  Narrative strategy while the independent First Edition Perception strategy
  remains unchanged. Equal rolls retain stable prior Combat order.
- Basic uses the normal D62e Perception builder, reverses its resolution order
  only for low-to-high declaration labels, and rerolls each round. Narrative
  persists the owner-authored chain and promotes the last declarer next round.
- Player totals and Narrative successor choices cross validated active-GM
  sockets after Actor OWNER checks. An owner without an active GM receives a
  visibly disabled successor control instead of an unauthorized Combat update.
- Build 365 GM/player/reload QA found and fixed the immediate tracker-refresh
  omission and the direct player Combat-write defect. Accepted settings and
  tracker screenshots were captured. Cleanup restored Standard and the empty
  retained Round 1 encounter, removed all temporary documents and six chat
  cards, and ended with a clean GM browser log.
- The final gate passed formatting, lint, typecheck, 102 test files / 532 tests,
  both bundles, content packs, the 14-page/28-screenshot manual, invariants, and
  generated-bundle lifecycle smoke. The loader registers 68 settings and schema 22.

## Latest First Edition accumulating-stuns compatibility pass

- OpenD6 Space pp. 75-76 were extracted, rendered, and visually inspected. They
  define the existing two-level-reduction stun-only rule, but do not contain an
  accumulating count, Strength-dice threshold, or one-minute count reset. This
  pass therefore labels the feature as a legacy D6 compatibility extension
  instead of claiming D6 Space provenance.
- OpenD6 Next's setting, schema, damage application, condition lifecycle, sheet
  track, owner reset, localization, and tests were traced completely. Its state
  stores a penalty and remaining rounds but does not decrement them, so this
  implementation adds authoritative, duplicate-safe round decay under the
  primary active Gamemaster.
- The off-by-default world option works with both First Edition Wounds and Body
  Points. Schema 24 preserves total hits, current noncumulative penalty,
  remaining rounds, and the last processed round. Positive hits add one; the
  threshold is whole Strength dice; differences 1-3 apply −1D, 4-8 apply −2D,
  and 9+ causes immediate unconsciousness. Threshold unconsciousness uses a
  separately audited 2D-minute roll. A confirmed uninterrupted one-minute rest
  clears the count.
- Ordinary Attribute, Skill, and weapon-attack actions receive the active
  penalty; resistance, recovery, and action-exempt rolls remain unchanged. The
  original Damage card, Combat-tab track, and public Actor read model expose the
  complete state and explicitly identify the compatibility boundary. Disabling
  the option preserves but inactivates stored state. Native Second Edition,
  machines, and the default D6 Space stun-only path are isolated.
- Automated coverage includes the pure threshold/penalty lifecycle, malformed
  state normalization, repeat-safe schema migration, application and rest
  services, primary-GM round handling with duplicate Actor suppression, public
  projection, settings refresh, and schema/API integration.
- Build 365 live QA used temporary linked Actors and real targeted Damage and
  Strength rolls. The original card recorded Damage 20 versus resistance 15,
  Body Points 25/30, one stun against a Strength threshold of four, and a
  noncumulative −2D penalty for two rounds. The target's ordinary Brawn preview
  changed from 4D to 2D; Round 2 retained −2D with one round left; Round 3
  cleared the penalty while preserving the count. A full reload retained the
  one-stun count, and TyfTester saw the owner track and confirmed one-minute
  reset without any Gamemaster-only damage control.
- Live QA found and fixed two integration boundaries. Unarmored Body Point
  targets now treat their legal 0D armor pool as zero resistance and proceed
  directly to the separate Strength check instead of asking the shared roller
  to execute an illegal 0D roll. Owner rest resets now run inside a narrowly
  authorized health transaction, preventing Foundry's injected unchanged
  Attribute scores from being rejected by the mechanical edit guard. The
  authorization is removed immediately after the health update.
- Cleanup restored the option to off, the retained empty Round 1 encounter, and
  removed every temporary Actor, Token, Macro, and matching chat card. The only
  player-browser error was Token Action HUD Core's pre-existing missing
  `list-subgroup.hbs` partial when no Gamemaster was online.
- The final gate passed formatting, lint, typecheck, 109 test files / 568 tests,
  both production bundles, content packs, the 14-page/30-screenshot manual,
  invariants, and generated-bundle lifecycle smoke. The loader initializes
  schema 24.

## Previous First Edition Body Points pass

- OpenD6 Space pp. 14 and 75-79 were extracted, rendered, and visually
  inspected. The implementation follows Strength roll + 20 maximum, armor-only
  resistance, point subtraction, optional percentage Wound bands, stun
  unconsciousness, the complete natural/Medicine recovery table, zero-point
  rescue, the 10% revival floor, elapsed-minute checks, and permanent 1D/2D
  Skill loss. Rules Ruling 6 records the deterministic rounding and death
  boundary.
- One typed world selector now chooses Wounds, Body Points, or Body Points with
  derived Wound bands. Schema 23 preserves both inactive tracks and migrates
  legacy Body Point shapes. Native Second Edition and machine damage remain
  unchanged. The public health API and Actor projection expose the active state.
- The character Combat tab provides current/maximum points, a percentage meter,
  source-cited maximum generation, GM Free Edit maximum control, owner current
  control, read-only derived Wounds, Body Point recovery, and mortality actions.
  Physical Damage uses armor/special resistance without Strength; stun damage
  adds a separate penalty-exempt Strength recovery roll.
- Live QA found and fixed a canonical migration defect that reset every update
  to 0/0: the data-model migration now preserves `firstEditionBodyPoints` before
  considering legacy keys. The GM then generated 21/21, retained it across a
  full reload, and observed all combined Wound controls disabled. TyfTester saw
  current editable, maximum as output only, derived Wounds disabled, and no
  GM damage resolver. A clean live 980×820 manual image was captured. The only
  browser error was Token Action HUD Core's pre-existing missing
  `list-subgroup.hbs` partial.
- Automated coverage includes the pure threshold/healing/death domain, repeated
  schema migration, atomic Foundry persistence, settings compatibility,
  resistance/damage paths, read models, and API/schema integration. Final gate
  passed 106 test files / 553 tests, both production bundles, content packs,
  the 14-page/29-screenshot manual, invariants, and generated-bundle lifecycle
  smoke. The loader initializes schema 23.

## Latest Second Edition Science Fiction Skills pass

- D62e printed pp. 173–176 (physical PDF pages 174–177) were extracted,
  rendered, and visually inspected. OpenD6 Next's Flying/0-G catalog, complete
  Attribute-plus-Skill calculation, Item/sheet presentation, rolls,
  advancement, active-defense flow, settings, tests, and validation records
  were traced without copying its different rules or protected prose.
- The independent Science Fiction Skills package adds Flying/0-G and Gunnery,
  shares the already lawful Barter, Gambling, and Streetwise identities, and
  retains core Languages. Mechanical and Technical stay independent optional
  Attributes. The printed loose +1D-per-three-Skills benchmark remains an
  explicit campaign-budget choice rather than an automatic mutation.
- Schema 29 persists an explicit Perception/Flying Dodge basis. One typed core
  calculation supplies both the sheet and targeted attacks; the Flying choice
  uses the complete Agility-plus-Skill Die Code exactly once. The Combat tab
  also presents whole-die flight meters, hover rounds, the ordinary action
  cost, and source citations. Rules Ruling 9 records the source's conflicting
  reference to Agility while core Dodge is based on Perception.
- Foundry v14 Build 365 visibly loaded alpha.19/schema 29 after only
  `foundry-dev` was restarted. The confirmed-empty stale options lock was moved
  recoverably to `/private/tmp/d6e2-options-json-lock-alpha19-20260802T0027`;
  both development endpoints returned their expected join redirect and
  production was untouched.
- GM QA enabled only the Science Fiction package, synchronized Languages plus
  the five package Skills, raised Flying to 4D for a clear test, and changed
  Dodge from Perception 15 to Flying 20. The sheet showed 4 meters per round,
  four hover rounds, and the action cost. The complete choice persisted after
  reload. TyfTester then changed 15/20 bases through the owner control and
  retained Flying 20 through a separate player reload.
- Cleanup restored Perception, the original Skill budget, Normal mode, the
  original Actor Skill list, OpenD6 on, and Science Fiction Skills off. A final
  reload confirmed the five temporary Skills absent, Languages retained, and
  the disabled package showing Dodge 15 without its selector or guidance. No
  temporary User, Actor, Token, Macro, or chat record was created.
- Server logs were clean of D62e errors. Foundry repeated its pre-existing
  `Failed to parse URL from undefined` update-check warning on client joins.
- The accepted Combat capture is
  `assets/manual/science-fiction-skills.png`. Focused implementation coverage
  passed 8 files / 86 tests; the final repository gate covers formatting,
  lint, typecheck, complete tests, both production bundles, the rebuilt packs
  and manual, invariants, and generated-bundle lifecycle smoke.

**Next autonomous development pass: perform the core closure audit.** Resolve
or explicitly defer every remaining ordinary-play gap, including Combined
Actions ambiguity and optional Pips advancement, and produce a release-scope
inventory with no vague partial statuses. This is an audit-first pass: do not
expand into later genre modules. Its acceptance tier must be declared after the
audit identifies whether any code or persistent data changes are required. The
exact following pass is **Perks, Flaws, and Talents closure — D62e pp. 101–129**.

## Finite roadmap to beta

The beta milestone includes all work below. Do not turn this into an unbounded
page-by-page loop; each completed pass must name the next exact item.

1. **Science Fiction Skills closure — D62e pp. 173–176. Complete.** The opt-in
   package, lawful catalog, Flying guidance, persisted Dodge basis, sheet,
   targeted-defense use, schema migration, and source/parity audit are closed.
2. **Core closure audit.** Resolve or explicitly defer every remaining
   ordinary-play gap, including Combined Actions ambiguity and optional Pips
   advancement, and produce a release-scope inventory with no vague partial
   statuses.
3. **Perks, Flaws, and Talents closure — D62e pp. 101–129.** Complete the
   mechanics and lawful contribution surfaces. Public data follows the Skill
   boundary: generic identifiers and page citations where distributable, no
   copied protected descriptions, examples, tables, or art.
4. **Automatic Token movement.** Implement only destinations justified by the
   verified movement/chase rules and explicit user intent; preserve manual
   positioning and never invent a destination.
5. **Outstanding human and multi-session acceptance.** Perform the GM Quickbar
   pointer drag/reload check and the first-writer-wins race from two distinct
   owning player sessions.
6. **Psionics — D62e pp. 184–190.** Complete its typed discipline, permission,
   persistence, sheet, roll, audit, and contribution boundaries.
7. **Cyberpunk — D62e pp. 191–195.** Complete the optional rules component and
   its bounded data/workflow surfaces.
8. **Superhero modules — D62e pp. 204–239.** Divide this large range into
   explicitly named, source-bounded passes before implementation; do not treat
   all 36 pages as one unsafe pass.
9. **Beta stabilization.** No new mechanics: reconcile the inventory/parity
   ledger, run migrations and the complete automated gate, execute the final
   risk-based live matrix, verify the public/private packaging boundary, and
   produce the beta-readiness report.

The local private edition is a separate packaging output, not a fork of the
rules engine. Populate ignored `private-content/` inputs only from lawfully held
books, generate `d6-system-2e-private-content`, and live-test that module through
the same public contribution contracts. Never commit or push private inputs or
generated private packs.

## Lean execution agreement

- Follow the risk-tiered acceptance protocol in `AGENTS.md`.
- Use focused tests during implementation and one final `npm run check`.
- Schedule at most one normal development Foundry restart after the final build.
- Reuse existing traces, authenticated sessions, and fixtures when unchanged.
- Rebuild the manual or screenshots only for changed manual/UI surfaces.
- Keep browser inspection targeted and documentation nonduplicative.
- Record unrelated discoveries for core closure or beta stabilization unless
  they block acceptance or threaten data/security.

## Beta blockers

- Public distribution must continue to exclude protected book prose, tables,
  examples, and art. Any unresolved content belongs in the ignored private
  companion rather than blocking public mechanics.
- Initial optional rules-component support profile must be explicit in the core
  closure audit.
