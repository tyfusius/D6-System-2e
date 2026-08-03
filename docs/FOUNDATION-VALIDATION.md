# Foundation validation

## 2026-08-02 core closure audit

- Acceptance was Tier C: source and repository audit found no core runtime or
  persistent-data change to validate live.
- Existing automated coverage and the recorded Build 365 Pips session below
  prove whole-die and optional-Pips Experience Point advancement; Milestone
  coverage also proves one-pip spending when enabled.
- D62e p. 63 has no Combined Action procedure, and p. 185 limits combined Skills
  to the Psionics module. D6 Space pp. 82 and 88 instead define Group Attack
  through Command, so it is not enabled in D62e.
- The release ledger now records the exact native default profile and finite
  beta/post-beta boundaries. The p. 21 ×4/×3 defense suggestion and retroactive
  difficulty assignment remain explicit table-adjudication boundaries.
- No UI, generated pack, or manual content changed. Under the lean Tier C
  protocol, no Foundry restart, broad browser matrix, screenshot, or manual
  rebuild was required; the unchanged live evidence was reused.

## 2026-07-28 edition-aware diffuse wordmark

- In Foundry v14 Build 365, native Second Edition resolved the root presentation
  marker to `second-edition` and the diffuse CSS wordmark to `D62e`.
- Enabling the complete OpenD6 preset changed both the root profile marker and
  the open character sheet to `OPEN D6` without a reload. The longer mark
  remained fully inside the header's clipped right edge.
- Disabling the preset restored `D62e` without a reload. The validation world
  was returned to Setup in native Second Edition mode.

Updated: 2026-07-28

## Second Edition Experience Point advancement (Build 365)

- Schema 9 migrated the existing Foundation Test Character and exposed the
  latent XP balance only while the XP profile was selected.
- The Second Edition settings selected Experience Points and resolved the
  capability matrix to an active XP strategy.
- Normal mode showed no advancement controls. Advance mode showed verified
  costs and the available XP balance.
- With core whole-die progression, Acrobatics advanced from 3D to 4D for 3 XP;
  the balance changed from 20 to 17.
- With Module: Pips, the same Skill advanced from 4D+1 to 4D+2 for 4 XP; the
  balance changed from 17 to 13, and the next displayed completion cost was 2.
- The confirmation dialog correctly distinguished "one die" from "one pip."
- Close/reopen and a full browser reload preserved purchases and balances.
- The test Actor was restored to Normal, Acrobatics 3D, and zero XP. The world
  was restored to unselected advancement and core whole-die progression.
- No new browser console warnings or errors were observed.

## Automated result

`npm run check` passed:

- Prettier verification;
- ESLint;
- strict TypeScript;
- 167 Vitest assertions across 42 test files;
- production ESM build;
- manifest, schema, filesystem, AppV1, and core-import invariants;
- generated-bundle lifecycle smoke with stubbed `init` and `ready` hooks;
- initial `character`/`skill` data-model and ApplicationV2 registration checks.

The lifecycle smoke observed:

```text
D6 System Second Edition | Initialized foundation API v1; schema 8
D6 System Second Edition | Ready
Generated bundle lifecycle smoke test passed.
```

This proves the generated bundle registers the two lifecycle hooks, initial data
models and sheets, and the foundation API in a controlled test harness.

The current run also covers canonical pip-score conversion and arithmetic,
sheet-mode authorization, the schema-2 character-sheet-mode migration, and the
schema-3 conversion from provisional `{dice, pips}` values. Direct mechanical
edit policy is covered for flattened and nested Actor/Item update shapes.

## Dependency audit

`npm install` reported five high-severity advisories in the development dependency
tree. A cached `npm audit --omit=dev` reported zero production vulnerabilities.
A later full audit request could not reach the npm advisory endpoint, so the
development advisories remain review debt. No forced dependency rewrite was applied.

## Live Build 365 result

A dedicated world named `D6 System 2e Foundation`, with ID
`d6-system-2e-foundation`, was created and launched as Gamemaster on Foundry v14
Build 365.

### Pips profile correction — 2026-07-27

- The Foundation Test Character retained Agility at canonical score 10 and its
  Climbing increase at 6.
- Core Second Edition displayed Agility `3D` and Climbing `5D`; the shared roll
  builder opened with a `5D` final pool.
- Enabling **Module: Pips** changed the same untouched documents to Agility
  `3D+1` and Climbing `5D+1`; the roll builder opened at `5D+1`.
- Enabling the complete OpenD6 preset kept `5D+1` through the separate
  classic-Pips capability and exposed the six-Attribute compatibility profile.
- The world was returned to core Second Edition with Module: Pips disabled.
  Reopening the sheet again showed `3D`/`5D`, proving the stored `+1` survived
  both profile transitions. The test character's Hero Point balance was
  restored to 3 after navigation-generated test rolls.
- The browser console contained Foundry's known 1280×720 minimum-height warning
  and one Hero Point overspend error caused when covered sheet controls were
  activated during automated Settings navigation. No error originated from
  resolving or rendering either Pips strategy.

### Doubling Down and private-roll validation — 2026-07-28

- A public Second Edition Climbing failure at difficulty 100 displayed the
  alternative Hero Point reroll and Doubling Down actions.
- Doubling Down opened an ApplicationV2 confirmation with the printed page 25
  reference and narration field.
- The retry replayed the complete `5D` pool, retained difficulty 100, displayed
  its original total and narration, and resolved the failed retry as a
  Complication without another Hero Point.
- The originating message disabled both alternative follow-up buttons after the
  accepted retry.
- The first private-GM check exposed frozen recipient arrays crossing into
  Foundry's mutable ChatMessage cleaner. The adapter was corrected and covered
  by deterministic tests.
- Repeating the private check created a real ChatMessage with the `whisper`
  class and working follow-up actions; no ChatMessage cleaning error recurred.
- Enabling the complete OpenD6 preset displayed the independent **Use First
  Edition retry rules** switch and the resolved **No general Doubling Down
  action** strategy. A failed OpenD6 check exposed neither Second Edition
  follow-up.
- The same OpenD6 check exercised the exploding Wild Die chat branch without
  affecting retry capability ownership.
- The world was restored to native Second Edition and Foundation Test Character
  to 3 Hero Points. A final reload preserved both. The only final browser error
  was Foundry's known 1280×720 minimum-height warning.

Observed:

- Foundry discovered `d6-system-2e` as `D6 System Second Edition`
  `0.1.0-alpha.1`.
- The generated module logged both foundation `init` and `ready` messages.
- The system localization file loaded.
- A `character` Actor named `Foundation Test Character` was created.
- Its ApplicationV2 sheet opened in the redesigned 980 by 820 layout.
- Agility was saved as 3D, Hero Points as 2, and a biography value was saved.
- Closing and reopening the sheet preserved those values.
- An embedded `skill` Item named `Climbing`, keyed `climbing`, with a 2D rating
  was created and saved through its ApplicationV2 sheet.
- The character sheet refreshed to show the embedded skill.
- Reloading the world and reopening the character preserved the Actor values and
  embedded Item.
- The redesigned sheet displayed the neutral OpenD6 Classic charcoal-and-gold
  theme with semantic accent tokens and no setting-specific blue branding.
- Normal mode displayed compact attribute and skill totals such as `3D` and
  `5D`.
- Normal mode exposed zero pip-score inputs, zero Add Skill controls, and zero
  Edit Skill controls, including for the Gamemaster.
- Advance mode displayed the verified advancement-profile boundary and disabled
  advancement controls instead of inventing a campaign advancement rule.
- Advance mode likewise exposed zero direct pip-score, Add Skill, or Edit Skill
  controls. It remains the reserved player-facing path for future point spending.
- A Gamemaster could select Free Edit and access the canonical integer pip score.
- Free Edit restored pip-score inputs and the explicit Add/Edit skill controls.
- Game Settings displayed one `Use OpenD6 Rules` master checkbox and seven
  individually labelled First Edition compatibility checkboxes.
- Enabling the master and saving enabled all seven child settings.
- With the OpenD6 profile active, the character sheet displayed Character Points
  5 and Fate Points 1, activated Mechanical and Technical, and preserved the
  existing attribute and skill scores.
- Disabling only First Edition Damage produced a custom state: the master became
  unchecked while Success Evaluator remained enabled and Damage remained
  disabled. Other child settings were not reset.
- Re-enabling and then disabling the master restored all eight settings to false.
  The sheet immediately returned to the four Second Edition core attributes and
  Hero Points 2 without losing the latent First Edition resources.
- The existing character reached schema 4 and exposed its migrated latent
  First Edition resources in the live DataModel.
- The historical Free Edit check verified lossless canonical storage for `10`,
  `11`, and `12`. ADR 0015 now separates that storage from effective rules:
  core Second Edition displays `3D`, `3D`, and `4D`; Module: Pips or OpenD6
  displays `3D+1`, `3D+2`, and `4D`.
- Returning Agility to 10 pips, switching to Normal mode, and reloading the world
  preserved `3D+1` Agility and `5D+1` Climbing.
- The schema-3 world service migrated the existing Actor and embedded skill once.
  The next full reload performed no migration writes, confirming live idempotence.
- The Biography tab exposed the persisted background-and-notes field.
- No system-originated warning or error appeared during the final game load and
  persistence sequence.
- Attribute and skill totals became accessible roll buttons without exposing
  direct pip editing in Normal mode.
- The skill button opened the localized ApplicationV2 roll builder with the
  derived `5D+1` pool, optional difficulty, result modifier, and four Foundry
  visibility modes.
- A public OpenD6-profile Climbing roll at difficulty 10 produced a structured
  themed chat card with five individual faces, a visually distinguished Wild
  Die, total 11, and success.
- Turning off the master OpenD6 preset returned the live sheet to the four
  Second Edition attributes and Hero Points while preserving latent First Edition
  resources.
- A public Second Edition-profile Climbing roll at difficulty 10 also produced
  a structured chat card with five individual faces, total 11, and success.
- The expanded Second Edition roll dialog displayed the opposed-check inputs and
  the Hero Point Die Code preview `5D+1 → 10D+2`.
- A public opposed Climbing roll against Rival's completed total of 10 produced
  total 28, reported `Opposed roll won · Rival 10`, and preserved the individual
  faces and distinguished Wild Die in the structured chat card.
- That opposed roll triggered the live Second Edition Wild Die advantage dialog.
  Selecting Exceptional success awarded one Hero Point and immediately changed
  the open sheet balance from 2 to 3.
- A second public Climbing roll spent one Hero Point, rolled the doubled
  `10D+2` pool, produced total 43 against difficulty 10, displayed
  `-1 Hero Points` on the chat card, and immediately returned the sheet balance
  from 3 to 2.
- After the OpenD6 Next presentation pass, a newly generated public chat card
  visibly rendered the actor portrait, compact identity header, centered `5D+1`
  pool, circular face row, burst-backed Wild Die, isolated total 15, explicit
  `TOTAL` label, and green `Success · Difficulty 10` result band within the
  standard narrow Foundry sidebar.
- A subsequent Wild Die 6 opened the redesigned decision surface. It visibly
  rendered the face in a gold burst medallion, current total 24, concise
  explanation, and icon-labelled Exceptional/Ordinary outcome controls. Choosing
  Exceptional success completed the roll and updated the open sheet balance.
- No new console warning or error appeared after the corrected rolls. The
  earlier errors described below remain in the browser's historical log only.

### Advanced Skill and GM/player matrix — 2026-07-27

The dedicated world gained a non-GM `Validation Player` fixture. That user has
Owner permission on `Advanced Skills Validation` and
`Foundation Test Character`; the other two test Actors remain unavailable.

Observed:

- As Gamemaster, Medicine 3D offered `Surgery · +1D · 4D`. Selecting it rolled
  four physical dice, and the chat card recorded
  `Advanced Skill context · Surgery +1D`.
- Normal mode exposed zero direct score inputs. Free Edit exposed the canonical
  score controls only to the Gamemaster, and the sheet was restored to Normal.
- Selecting Stunned opened the page-28 prevention prompt. Spending one Hero
  Point changed the balance from 4 to 3 and kept the condition Healthy.
- As `Validation Player`, the Actor directory contained only the two owned test
  Actors. The character sheet offered Normal and Advance but no Free Edit, and
  Normal exposed zero direct score inputs.
- The owner Player could open Medicine 3D, select Surgery +1D, roll the final 4D
  pool, and produce the same structured context band in chat.
- At Foundry's supported 1024×768 minimum, the character sheet reflowed to
  980 pixels with matching client and scroll widths and no horizontal overflow.

### Machine Actor vertical slice — 2026-07-28

Observed in the dedicated `d6-system-2e-foundation` world on Foundry v14 Build
365:

- Actor creation offered native Vehicle and Starship choices and opened the
  dedicated ApplicationV2 machine sheet.
- A fresh Vehicle persisted passenger capacity 10, Armor 1D, Scale 3, and its
  Condition through focus changes and sheet close/reopen.
- Selecting Maneuverability opened the shared roll builder and created a
  structured OpenD6 Classic chat card with the machine Actor identity,
  distinguished Wild Die, total, and unopposed result.
- Live validation exposed and corrected two implementation defects: the
  character-only mechanical edit guard had intercepted machine Attribute
  updates, and running the ordered migration from `TypeDataModel.migrateData`
  reset subtype fields during ordinary document updates. The guard is now
  scoped to character/NPC/creature Actors, while schema 10 remains owned by the
  ordered world migration and typed field defaults.
- The console contained no system warning or error from these workflows. Its
  only retained errors were two earlier Foundry minimum-height warnings from the
  initial 1280×720 viewport; testing continued at supported dimensions.
- The browser was returned to an authenticated Gamemaster session after the
  matrix.

### Cross-edition capability matrix — 2026-07-27

Observed in the two ApplicationV2 edition settings:

- Native Second Edition resolved strict success, its Wild Die, Hero Points,
  static defenses, the condition track, campaign Attributes, and active
  contextual Advanced Skills. Its unselected advancement family was visibly
  marked Planned.
- Enabling the complete OpenD6 preset changed the success evaluator to
  meets-or-exceeds, selected the OpenD6 rules owners, marked OpenD6 damage
  Planned, and preserved Advanced Skills as `Stored · inactive`.
- The new **Allow Second Edition Advanced Skills** option changed only that
  capability to `Optional Second Edition behavior in OpenD6 mode · Active`.
  Medicine 3D then offered Surgery +1D and the 4D final pool.
- Disabling the extension removed Surgery from Medicine's task selector and
  made the preserved Surgery Item non-rollable.
- The complete OpenD6 preset and extension were both turned off after testing.
  Reopening settings showed native strict success and active Second Edition
  Advanced Skills again.
- Cancelling a prompted OpenD6 Wild Die choice exposed a dialog-action boundary
  bug. The prompt now accepts only one of its offered typed choices; cancellation
  returns `null` and has deterministic coverage.

### Rulebook module settings organization — 2026-07-28

Observed as Gamemaster in the dedicated `d6-system-2e-foundation` world on
Foundry v14 Build 365:

- The **D6 System 2nd Edition** ApplicationV2 submenu opened from Game Settings
  and displayed five ordered configuration cards: core campaign setup,
  Additional Attributes, advancement modules, Pips, and Skill Specializations
  & Advanced Skills.
- Every card displayed its core/module classification and the matching printed
  D62e v1.1 page reference. All 11 Second Edition settings appeared exactly
  once.
- The advancement card exposed one selector for the mutually exclusive
  Experience Point, Milestone Character Advancement, and Narrative Advancement
  variants.
- Saving closed the application. Reopening preserved the observed disabled Pips
  state and enabled Skill Specializations & Advanced Skills state and still
  rendered five groups.
- At a temporary 600×900 responsive viewport, the settings application fit the
  viewport width, module content and capability entries resolved to one-column
  grids, and the settings shell had no horizontal overflow. The application
  reopened at its normal 680-pixel width after the viewport was restored.
- No system warning or error occurred during open, save, reopen, or responsive
  checks. Foundry emitted its expected minimum-width warning only while the
  intentionally unsupported 600-pixel test viewport was active.

## Findings and corrections

The first server restart rejected the capitalized installation directory. Foundry
requires a system directory to exactly match the manifest ID, so the repository
was moved to `data/Data/systems/d6-system-2e`. The next restart discovered it
without adding a package warning.

The first persistence attempt also showed that a close-only save affordance was
not sufficient for an observable, dependable foundation workflow. The current
character sheet persists fields as they change. Numeric Free Edit controls
additionally persist on `input`, so direct D6/pip changes do not depend on a
browser-specific blur sequence. Core attribute inputs and their DataModel fields
enforce the verified creation range as canonical scores from 3 through 15 pips.

The first live schema-3 attempt exposed that the browser implementation of
`structuredClone` cannot be passed as an unbound callback. The runner now wraps
that call, the full automated suite passes, and the unchanged schema-2 documents
then migrated successfully.

The first live roll attempt found two v14 adapter issues. Foundry expands dotted
localization keys, so a scalar `D6E2.Roll` could not coexist with the
`D6E2.Roll.*` namespace. The action key is now `D6E2.Roll.Action`, and the
invariant suite rejects this entire collision class. Foundry also cleans chat
flag objects in place, while core results are intentionally frozen. The chat
adapter now persists a structured clone, preserving core immutability without
passing frozen data into document construction. Reloading then localized the
whole sheet and the same live roll completed successfully.

### Dice So Nice Wild Die presentation — 2026-07-29

- Visible browser control was used for the final Foundry check.
- The initial colorset-only implementation left ordinary dice green because it
  respected the player's saved global dice system. Matching OpenD6 Next's
  supported roll-level `appearance.system` route corrected the live behavior
  without mutating that saved preference.
- A real Brawn roll from TyfTester's player-owned character sheet animated two
  antique-gold d6s with dark numerals and the distinct black-and-gold `dw`
  together.
- The transient frame is recorded at
  `assets/manual/dice-so-nice-wild-die.png`.
- The live console contained the successful Dice So Nice dice-preset
  registration message and no related system warning or error.
- Both temporary Brawn QA messages were removed through the GM client; existing
  world messages were left unchanged.
- A correction pass registered the same antique-gold colorset for every
  standard Dice So Nice denomination (`d2`, `d4`, `d6`, `d8`, `d10`, `d12`,
  `d20`, `d100`, and `df`) instead of only `d6`.
- The correction also assigned Amiri to every standard preset while preserving
  `dw` as the sole black die. A visible unsaved Dice So Nice preview exercised
  the complete mixed-shape set, then Cancel restored the GM's prior Standard,
  blue-custom, Auto Font preferences exactly.
- A subsequent real-roll check exposed that `appearance.system` alone does not
  replace saved custom colors when that system is already selected. System
  rolls now explicitly provide `appearance.colorset` and `appearance.font` for
  each separately evaluated ordinary or Wild Die batch.
- With the GM's saved blue custom appearance still active, a real Climbing 5D
  roll rendered four antique-gold Amiri ordinary dice and one black Amiri Wild
  Die. The temporary chat message was removed.
- The real-roll live frame replaced
  `assets/manual/dice-so-nice-wild-die.png`.
- A later full client reload exposed that Dice So Nice adds a `step` property to
  each supplied value range during registration. The system had passed its
  frozen catalog range through that mutable boundary, so registration stopped
  on the first standard preset.
- Standard presets now receive fresh label and value-range copies. The
  regression test performs the same in-place normalization, and a subsequent
  visible reload logged successful registration. A real Brawn roll completed
  afterward; its temporary chat message was removed.

### Roll edge cases and private visibility — 2026-07-29

- Visible Gamemaster control in Foundry v14 Build 365 used a temporary,
  deterministic macro fixture to exercise the public Attribute-roll API with
  exact Wild Die sequences.
- An unopposed Second Edition roll of `[4, 4, dw1]` totaled 9 and rendered the
  unresolved Complication state without a pending decision, success result, or
  Hero Point award.
- A difficulty-30 roll of `[2, 2, dw6, dw6, dw3]` totaled 19, retained both
  exploding follow-ups, resolved as Failure, and awarded one Hero Point.
- Private-GM and self-only rolls produced Foundry `whisper` messages; the blind
  GM roll produced `whisper blind`. The adapter now fails closed when a private
  or self-only roll has no current-user recipient instead of risking an empty
  recipient array.
- The temporary macro and all six calibration/validation messages were removed,
  and the test Actor's Hero Points were restored to zero.
- The rebuilt user-manual compendium was reloaded during a named maintenance
  window. A Foundry data-lock restart race required an orderly stop/start
  recovery; afterward the intended world and all packs loaded successfully.
  The visible manual now documents the private, blind, and self-only audiences.

### Blind Advantage authority and follow-up cancellation — 2026-07-29

- Separate visible GM and TyfTester clients exercised a deterministic blind
  Brawn roll of `[3, 3, dw6]` against difficulty 1. The player received neither
  the total nor the decision dialog; the GM received the exact
  Exceptional/Ordinary choice and completed a `whisper blind` result. The
  player's copy remained redacted and the Exceptional outcome awarded exactly
  one Hero Point.
- GM cancellation created no ChatMessage or Hero Point change. Reloading the
  player while a decision was pending removed the player-side state; cancelling
  the orphaned GM prompt and reloading the GM did not replay it.
- The GM client was temporarily disconnected while the world remained online.
  The blind player roll stopped with the localized active-GM warning, no
  ChatMessage, and no resource change. The GM was then reconnected and both
  clients observed each other again.
- Live follow-up QA exposed that Foundry returns the cancel action string when a
  `DialogV2.wait` cancel callback yields `null`. The Double Down narration
  prompt had accepted that string as narration and created a retry. The prompt
  now accepts only a typed narration object; a regression test rejects the
  action string.
- The fixed live rerun added no retry on cancellation and left both source
  actions enabled. A fresh Hero Point reroll created one follow-up, spent one
  Hero Point, and disabled both alternatives on every observing client.
- The temporary macro and all six QA messages, including the pre-fix diagnostic
  retry, were deleted. TyfTester's Hero Points ended at zero.
- The rebuilt manual pack required a named refresh window. An immediate restart
  hit Foundry's data-directory lock race; a clean stop, five-second lock-release
  interval, and single start restored the world. The container became healthy,
  the public endpoint returned the expected join redirect, and the visible
  manual showed the blind-Advantage GM fallback and no-GM behavior.

### Experience Point specialization acquisition and public API — 2026-07-29

- The supplied Second Edition v1.1 rulebook was checked directly at page 99.
  Post-creation specialization cost is the parent Skill's own whole-die rating
  plus its current specialization count; the maximum count equals that rating,
  and the acquired specialization remains a fixed +1D.
- Visible GM QA enabled Experience Point advancement while preserving the
  already-enabled Skill Specialization module. Foundation Test Character's
  Climbing Skill had an own rating of 2D, so the new control displayed a 2 XP
  initial cost despite the combined roll being 5D.
- Cancelling the acquisition dialog left 10 XP and created no Item. Confirming
  `QA Climbing Focus` created one linked specialization, displayed 6D from the
  5D parent plus fixed +1D, and deducted exactly 2 XP.
- Reusing the same name was rejected case-insensitively with no second Item and
  no resource change. A second distinct specialization cost 3 XP; afterward the
  parent row disabled acquisition with the exact maximum of two.
- A temporary live script macro read the public Actor projection, current
  campaign profile, and rules capability profile, confirmed
  `advancement.specialization` was callable, and prepared the protected XP test
  balance. The two temporary specialization Items and macro were then deleted;
  the Actor returned to Normal mode with zero stored XP and no `QA Climbing`
  documents.
- The world advancement setting was restored to Unselected. A full client
  reload showed the Actor in Normal mode with no XP field or temporary data.
- The rebuilt 14-page manual pack was opened visibly after the named
  `manual refresh + stale-session recovery` window. Its Advancement page
  contained the complete page-99 acquisition workflow and public API note.
- The First Edition settings application remained stacked, scrollable, and
  save-capable at a 620-pixel viewport. Foundry itself displayed its documented
  minimum-window warning below 1024 pixels, so an application-only narrow
  resize and full First Edition save/reload matrix remain separate work.
- Repeatable gstack evidence recorded `/dev` as a 302 followed by a 200 join
  page, all observed core assets as 200, the Amiri Bold font asset as 200, and
  no console errors. The headless accessibility snapshot did not expose
  Foundry's client-rendered join controls, so final interaction evidence came
  from the visible in-app browser.

## Human and multi-session follow-up closure — 2026-08-02

- The final genuine human-input GM Quickbar check dragged Foundation Test
  Character above TyfTester by its visible handle, reloaded, and confirmed the
  changed order persisted. Foundation was then dragged back below Creation
  Validation Character; a second reload confirmed the original four-character
  order was restored.

- TyfTester and Validation Player simultaneously held Owner access to the same
  TyfTester Actor from separate player sessions while a third session retained
  active-GM authority. Both players submitted different Double Down narrations
  against the same eligible roll. Exactly one retry message was created, the
  losing narration never entered chat, and the source action became disabled
  for both players. The two temporary messages were deleted and Validation
  Player's temporary TyfTester ownership was returned to Default.

## Not yet claimed

- The grouped settings bundle and both edition menus load in Build 365. The
  Second Edition application has open/save/reopen, responsive-layout, and full
  reload coverage. The OpenD6 submenu has a narrow-layout observation but still
  needs an application-only narrow resize plus changed-value save/reopen/reload.
  After Token Action HUD activation, the Settings tab focused but did not reveal
  its sidebar panel even though other tabs switched and the console stayed
  clean; isolate that host interaction before continuing the settings matrix.
- Token Action HUD Core and the independently loadable D62e adapter are active.
  Visible GM and TyfTester checks passed for owned-token Round, Attributes, and
  Skills projection, pip formatting, protected roll-builder dispatch, empty
  declaration controls, reload, and clean runtime logs. Weapon and Trouble/Asset
  HUD groups remain live-unverified because the cleaned Actors had no eligible
  Items; automated integration coverage passes.
- The temporary live world and its test documents are development fixtures, not
  distributable content.

### Specialization identity and Advanced Skill rules audit — 2026-07-29

- The supplied Second Edition v1.1 rulebook was checked directly at printed
  pages 96-100. Advanced Skills require at least two basic/standard prerequisite
  Skills, each prerequisite's own rating must be at least 3D, and the Advanced
  rating cannot exceed the lowest prerequisite. An Advanced Skill rolls alone
  at its own rating or adds to the complete relevant basic-Skill code.
- Specialization creation visibly prompted for the narrow focus name. Creating
  Parkour under Acrobatics produced a `Parkour` Actor row, a required
  `Specialization name` field, stable key
  `specialization-acrobatics-parkour`, parent Acrobatics, and a separate
  description field.
- The Surgery Advanced Skill displayed a required identity field and a named,
  standard-Skill-only prerequisite multi-select with each Skill's own rating.
  Medicine and Sciences saved and remained selected after a full client reload.
  The legacy `new-advanced-skill` identity repaired to `advanced-surgery`.
- The live fixture's Knowledge Attribute is 3D while Medicine and Sciences each
  have an own rating of 0D. The creation panel therefore rejects Surgery as
  invalid, confirming that Attribute dice no longer satisfy the 3D prerequisite
  rule.
- A multi-select serialization fault was caught during the live pass: an
  identically named hidden input could override selected values. The presence
  marker now has its own field, and the save/reload rerun passed.
- Automated validation passed 63 test files and 269 tests, lint, typecheck,
  system and Token Action HUD bundles, content/manual verification, invariants,
  loader smoke, and `git diff --check`.
- A follow-up added confirmed deletion to editable Skill and Specialization
  rows. Parkour was removed visibly through that control without direct document
  scripting or out-of-band LevelDB editing.
- Generic custom Skill creation now asks for a real name before persistence.
  Live GM QA confirmed that Cancel creates nothing, deletion can itself be
  cancelled, confirmed deletion removes the exact Item, and the stranded
  TyfTester `New Skill` placeholder is gone.

### Advanced Skill roll completion and Quickbar lifecycle — 2026-07-30

- The dedicated Advanced Skills fixture was temporarily set to Medicine 3D,
  Sciences 3D, and Surgery 2D. Surgery opened a standalone 2D roll builder and
  produced a 2D chat result.
- Rolling Medicine exposed `Surgery · +2D · 8D` as a task-context option.
  Selecting it produced an 8D chat result with
  `Advanced Skill context · Surgery +2D`, confirming that the full basic Skill
  code and the Advanced Skill's own rating combine.
- Both temporary chat messages were removed. The fixture was restored through
  the visible sheet to Medicine 0D, Sciences 0D, Surgery 1D, and Normal mode.
- After the pending Actor refreshes settled, the GM Quickbar closed normally
  and reopened from Token Controls with all four Player Characters in their
  prior order. The final visible client remained connected at 3 ms latency.
- Native HTML5 pointer drag could not be generated by the available visible
  browser control, so the human-input pointer-drag check remains explicit
  rather than being replaced with synthetic `DataTransfer` evidence. Versioned
  reorder, migration, cross-section, and persistence behavior remains covered
  automatically.
- The full automated gate passed 63 test files and 269 tests, formatting, lint,
  typecheck, system and Token Action HUD bundles, content/manual verification,
  invariants, loader smoke, and `git diff --check`.

### Explicit Specialization allocation and creation budget caps — 2026-07-30

- The supplied Second Edition v1.1 rulebook was checked directly at printed
  page 99. The implemented creation exchange spends one Skill die to make
  exactly three Specialization choices available.
- A fresh temporary Actor visibly began at Skills 0D/7D and Specializations
  0/0. The forward control changed those capacities to 0D/6D and 0/3; the
  reverse control restored 0D/7D and 0/0 while all three slots were unspent.
- Specialization creation controls were disabled before allocation and enabled
  afterward. The compact Advanced Skill `(a)` control opened the named Advanced
  Skill dialog, and Cancel created nothing.
- Spending exactly 7D across standard Skills left 0D remaining, disabled all 16
  Skill-increase controls, and disabled the 1D-to-3 exchange. Spending exactly
  12D across Attributes left 0D remaining and disabled all four
  Attribute-increase controls. The protected service separately rejects either
  overspend even if a UI caller bypasses the disabled controls.
- The existing Advanced Skills fixture migrated to schema 12 with its
  Specialization allocation preserved. Its Specialization displayed `(s)`, its
  Surgery Advanced Skill displayed `(a)`, and the reverse exchange remained
  disabled because a slot was spent.
- The temporary creation Actor was deleted after the visible checks. Foundry
  was not stopped or restarted and remained connected throughout.
- The final automated gate passed 64 test files and 277 tests, formatting,
  lint, typecheck, system and Token Action HUD bundles, 14-page/14-screenshot
  manual verification, package invariants, loader smoke, and schema 12 startup.

### Shared Advanced Skill references and atomic definition — 2026-07-30

- **Add Advanced Skill** opened one dialog containing the required name and a
  checkbox for every standard Skill. Submitting `Live QA Advanced` with only
  Medicine selected was rejected; the retry retained both the name and checked
  Skill. Cancelling that retry created no Item.
- Surgery appeared as the same linked `(a)` row beneath both Medicine and
  Sciences. Its Item sheet displayed the named connected-Skills checklist with
  Medicine and Sciences checked.
- The prerequisite own ratings were temporarily changed from 0D to 3D in Free
  Edit. The Medicine-linked row then opened a 7D roll builder with
  `Surgery · +1D · 7D` already selected, while its separate die control opened
  the standalone Surgery 1D builder.
- Both roll builders were cancelled without chat output. Medicine and Sciences
  were restored to 0D own ratings and the Actor was returned to Normal mode.
- Foundry remained online throughout the pass. The final visible client
  remained connected at 1 ms latency.

### Advanced Skill Experience Point advancement and correction — 2026-07-30

- The supplied Second Edition v1.1 rulebook was checked directly at printed
  page 97. An Advanced Skill costs twice the Experience Points of a regular
  Skill and cannot exceed its lowest prerequisite Skill.
- With Medicine and Sciences temporarily set to 3D own ratings and the XP
  profile enabled, both Surgery references displayed the same 2 XP advancement
  control. Confirmation advanced Surgery from 1D to 2D and reduced XP from 10
  to 8.
- The next confirmation displayed 4 XP. It advanced Surgery from 2D to 3D and
  reduced XP from 8 to 4. Both linked references updated immediately after each
  purchase.
- At Surgery 3D, the next purchase was disabled before confirmation because its
  proposed 4D rating exceeded both 3D prerequisites. The disabled control
  exposed the specific p. 97 prerequisite explanation.
- Live QA exposed and repaired a linked-row regression: Free Edit had no
  legitimate Advanced Skill score correction route after top-level Advanced
  rows were removed. A compact protected score field now appears on each linked
  reference and updates the one shared Item.
- The fixture was restored through visible controls to Medicine 0D, Sciences
  0D, Surgery 1D, zero XP, and Normal mode. The world advancement strategy was
  restored to Unselected. A full reload preserved every restored value.
- Foundry was not stopped or restarted. The final visible client reported 1 ms
  latency and no browser-console errors.

### Milestone and Narrative advancement — 2026-07-30

- The supplied Second Edition v1.1 rulebook was checked directly at printed
  pages 90-93. Milestones award one Attribute die and three Skill dice, or nine
  Skill pips when Pips is active; the complete bundle may instead buy a new
  rank-1 Perk or increase an existing Perk. Narrative rewards use a
  GM-approved arc whose step count equals the reward Skill's new rating.
- With Milestone selected, a visible GM award produced 1D and 9 Skill pips.
  Brawn advanced from 1D to 2D without disturbing the Skill balance.
  Acrobatics advanced from 2D through 5D while the Skill pool moved 9→6→3→0.
  A second complete bundle created `Live QA Milestone Perk` and consumed both
  pools atomically.
- Live QA found and fixed two transaction defects before acceptance: a
  deep-key Attribute update discarded the sibling Skill balance, and a frozen
  embedded-Item update payload conflicted with Foundry's `_id` normalization.
  Regression tests now preserve the sibling balance and require a mutable
  adapter payload.
- With Narrative selected, `Live QA Sharpshooter Arc` proposed Shooting 3D as
  its reward with exactly three story steps. The GM approved it, all steps were
  completed, and the final grant advanced Shooting from 2D to 3D while retaining
  the completed arc as an audit record.
- Cleanup exposed and repaired a separate Free Edit gap: non-Skill embedded
  Items on Traits & Equipment can now be deleted through the same confirmed,
  protected character-sheet action used for Skills.
- The temporary arc and Perk were deleted through visible controls. Agility,
  Brawn, Acrobatics, Shooting, and the linked Specialization returned to their
  original ratings; the Actor returned to Normal mode; the world returned to
  Unselected advancement with Perks/Flaws/Talents disabled.
- Foundry was not stopped or restarted. A final visible reload confirmed the
  restored world and fixture state.

### Narrative Perk advancement closure — 2026-07-31

- D62e printed pp. 86-93 were extracted and visually inspected as one
  advancement context. Page 92 recommends Perk arcs when the optional
  Perks/Flaws/Talents module is active: the arc's step count equals the new Perk
  rank. The rules discourage equivalent Flaw or Talent arcs, so none were
  invented. OpenD6 Next has no direct Narrative/Perk workflow; its protected
  advancement transactions and sheet-mode boundaries remained the nearest
  implementation reference.
- Automated coverage now proves new-R1 and existing-Perk rank-up proposals,
  module gating, exact step counts, Item creation and rank persistence, audit
  completion, rollback deletion when history persistence fails, migration, and
  the Foundry schema contract. The full gate passed 98 test files / 498 tests,
  both bundles, content packs, the 14-page/27-screenshot manual, package
  invariants, and generated schema-22 loader smoke.
- Visible Build 365 QA first exposed two Foundry DataModel boundaries: the
  reward-kind choice rejected `perk`, and the target-score minimum coerced R1
  to R3. Schema 22 and the corrected minimum fixed both before acceptance.
- The final visible flow proposed `Live QA Narrative Perk Arc` for a new
  `Live QA Narrative Perk` at R1 with one story step. The GM approved it. The
  owning player had no Approve or Grant control, completed the step, and
  retained 1/1 after reload. The GM then granted the reward; completed history
  and the embedded Rank-1 Perk both survived a full reload.
- Cleanup deleted the completed arc and temporary Perk through visible
  controls. TyfTester's pre-existing `Live Perk` remained untouched, the Actor
  returned to Free Edit, and the world returned to Unselected advancement with
  Perks/Flaws/Talents disabled. A final reload confirmed that state. Browser
  diagnostics contained zero warnings or errors.
- The activated container was healthy and the public endpoint returned HTTP
  302 to `/dev/join`. The stop left an exact empty
  `data/Config/options.json.lock` directory; it was removed with `rmdir` before
  startup. No world data was removed.

### Weapon targeting and resistance foundation — 2026-07-30

- The supplied Second Edition v1.1 rulebook was checked directly at pp. 21,
  33-34, 81-86, and 94. Static Dodge/Parry, strict `attack > defense`, weapon
  range bands, fixed Brawn resistance, and the permitted armor/shield
  contribution are implemented without inventing the contradictory p. 33
  damage result.
- Visible GM QA reopened TyfTester after a full client reload. The Combat tab
  showed Dodge 15, Parry 15, and a 4D Resistance control derived from Brawn 4D
  plus Armor 0D.
- The first live resistance builder exposed inherited generic Difficulty,
  modifier, and opposed-roll controls. Those were removed because resistance is
  a fixed pool and damage comparison is a separate unresolved boundary.
- After the fix and another full reload, the builder showed only Final Pool 4D,
  Roll Mode, Cancel, and Roll. It was cancelled without creating chat output.
- The browser reported no errors. Foundry was not stopped or restarted; the
  container remained healthy and the public route responded normally.
- The full gate passed 69 test files and 305 tests, formatting, lint, typecheck,
  system and Token Action HUD bundles, 14-page/16-screenshot manual
  verification, package invariants, and loader smoke.
- Live scene-target/range interaction remains pending because the retained
  development fixture has no weapon and no second eligible target Actor. Pure
  planners and Foundry UI/source contracts cover that path in this pass.

### Coordinated Vehicle and Starship crew attacks — 2026-07-30

- The supplied Second Edition v1.1 rulebook was checked directly at printed
  pp. 177, 180, and 182. Starship and Vehicle attacks use Gunnery plus the
  weapon attack bonus; Starships lose 1D from ship rolls for every missing
  member of the minimum crew.
- The world migrated six Actors to schema 15 under system
  `0.1.0-alpha.1`. The visible Starship sheet showed 0/4 crew and −4D, then
  1/4 and −3D after the first assignment, and finally 4/4 with no penalty.
- Advanced Skills Validation, Creation Validation Character, Foundation Test
  Character, and TyfTester were independently assigned. A full browser reload
  preserved all four roster references.
- `Schema 15 Laser Cannon` was configured as Attack 4D, Damage 5D, Starship
  scale 5, with short/medium/long ranges of 10/20/40.
- The mounted Attack action required a gunner choice. TyfTester produced a 4D
  final pool against Foundation Test Character. The public chat result totaled
  12 and audited `Gunnery 0D + Attack bonus 4D`, Starship identity, p. 180,
  Dodge 20, unmeasured range, and scale rank 5 → 0.
- Publicly served bundle and localization hashes matched the built files.
  The final development container was healthy and the local game endpoint
  returned the expected no-store redirect.

### Editable sheet artwork parity — 2026-07-30

- Character, Vehicle, Starship, and Item artwork now matches the OpenD6 Next
  interaction: hover or keyboard focus reveals the camera-and-`Edit` overlay,
  and activation routes through Foundry's native Image Browser.
- The missing D62e action registrations were added for all three sheet
  applications. Artwork selection persists the chosen `img` path on the owning
  Actor or Item document.
- Visible GM QA opened the native Image Browser from TyfTester and from the
  retained Starship without selecting a replacement image. Visible TyfTester
  QA confirmed the owned Character control is present and enabled in Normal
  mode; Foundry's core file-browsing role permission remains authoritative for
  whether a non-GM may browse server files.
- Regression coverage requires every artwork template to expose the action and
  overlay, every sheet to register the action, and the action to remain
  independent of mechanical sheet edit mode. The focused suite passed eight
  tests, followed by typecheck and both production bundles.
- A short named `alpha.2 image-picker activation` maintenance window rebuilt
  content and bundles, moved one stale empty lock recoverably to
  `/private/tmp`, restarted Foundry, and health-checked the container and public
  route.

### Shared Item workspaces and Active Effects — 2026-07-30

- The OpenD6 Next Item implementation was traced through its sheet actions,
  templates, styling, permission behavior, and Active Effect document calls.
  D62e now exposes full-width Details, Description, and Effects workspaces while
  retaining its own type-specific Second Edition fields.
- Visible TyfTester QA opened the owned Live Asset in Normal mode, changed among
  all three workspaces, observed the empty Effects state, and received no
  create/delete mutation control.
- Visible GM QA changed TyfTester to Free Edit, opened the same Item, created
  and opened Foundry's native `New Active Effect`, deleted it through the
  confirmation dialog, and observed the restored empty state. TyfTester was
  returned to Normal mode.
- The first live render exposed a vertical tab treatment. The corrected build
  rendered a full-width three-column navigation matching the shared component
  language. `assets/manual/item-effects-workspace.png` records the accepted
  view.

### Character inventory, Item descriptions, and effect summaries — 2026-07-30

- The complete OpenD6 Next inventory implementation was retraced through the
  view model, sheet actions, template, CSS, permissions, persistence, and test
  coverage. D62e now renders the same inventory-row structure with Item art,
  type labels, quantity chips, and Equipped toggles while preserving its typed
  Second Edition groups.
- Visible GM QA created a temporary Gear Item, observed its quantity chip,
  toggled Equipped from the character sheet, and captured
  `assets/manual/character-inventory-loadout.png`.
- Visible TyfTester QA opened Acrobatics through the new Normal-mode detail
  control, saved a narrative description, closed and reopened the Item, and
  observed the persisted text. The live pass also proved that clearing the
  description persists after Foundry HTML-field normalization.
- A temporary Active Effect on Live Asset rendered as a player-readable summary
  with zero open, create, or delete controls. The GM then deleted the effect,
  deleted the temporary Gear, cleared the temporary description, and restored
  TyfTester to Normal mode.
- Live QA exposed and fixed three underlying defects: the obsolete player Skill
  launcher guard, invalid `img` form data rejecting complete Item saves, and
  Foundry dropping literal empty HTML updates before field cleaning.
- `npm run check` passed 76 test files / 343 tests, formatting, lint,
  TypeScript, both production bundles, deterministic content verification,
  package invariants, the generated loader lifecycle, and the 14-page user
  manual with 18 screenshots.

### Remaining relative-scale branches — 2026-07-30

- Visible GM QA selected Foundation Test Character as the rank-0 target for the
  retained rank-5 Starship's 5D laser-cannon Damage roll. The live builder
  raised the final pool to 10D and the public chat card audited scale 5 → 0,
  `Damage pool · +5D`, and p. 196.
- Foundation Test Character was temporarily changed from scale 0 to scale 2.
  Its 1D Brawn resistance against rank-0 TyfTester became 3D, and the public
  chat card audited scale 0 → 2, `Brawn resistance pool · +2D`, and p. 196.
  Foundation was restored to scale 0 and Normal mode immediately afterward.
- The retained mounted-attack chat evidence still shows the complementary
  larger-attacker ranged-Dodge branch: rank 5 → 0 against Foundation used
  Dodge 20 and recorded p. 196 scale context.
- The visible browser can activate Foundry controls but does not provide a
  native HTML5 `DataTransfer` or unrestricted DOM event constructor. The final
  GM Quickbar pointer-drag check therefore remains explicitly unverified rather
  than being simulated and misreported.

### Unlinked Token combat identity — 2026-07-30

- Live movement QA exposed that the retained Foundation token is unlinked: its
  synthetic Token Actor and the directory prototype share an Actor ID but are
  independent documents.
- The combat service previously matched only that shared ID. As a result, the
  directory sheet incorrectly displayed the Token's action segments and could
  persist posture on the prototype instead of the Combatant.
- Combat lookup now prefers the Actor's stable Foundry document UUID and falls
  back to an Actor ID only when a Combatant has no resolved Actor document.
  UUID comparison accommodates fresh synthetic wrappers while automated
  coverage rejects the prototype and accepts the actual synthetic Actor.
- The first live run completed a Run declaration with finish-prone and visibly
  showed the completed segment, −1D penalty, Prone posture, and ranged Dodge
  change. After the alpha.4 bundle loaded, the corrected UUID-based rerun
  visibly proved that the directory prototype remained outside combat while
  the synthetic Token Actor showed Round 2, the completed Run, −1D, finish
  movement prone, Prone posture, and Dodge 15.
- Advancing the retained encounter with the synthetic Actor Stunned visibly
  produced the next round with Healthy, Standing, 0D, and no declared actions.
  Advancing again from Wounded visibly retained Wounded and Prone while still
  starting with no declared actions.
- Cleanup restored the directory and synthetic Actors to Healthy and Standing,
  removed the temporary Combatant and macro, and returned the retained empty
  encounter to Round 1.

### Complete Second Edition module catalog — 2026-07-30

- The rulebook introduction, table of contents, and visually inspected p. 249
  Module Worksheet were reconciled into one 41-entry catalog: 18 Core, 6
  Fantasy, 8 Science Fiction, and 9 Superheroic modules. The union restores
  bestiaries, templates, Scale, Superheroic Hero Points, Capping Die Codes, and
  Secret Identities omitted from the shortened worksheet.
- Every catalog entry exposes a printed-page reference and one honest support
  state. Planned entries have no input or action; configurable entries use a
  dedicated ApplicationV2 action to navigate to their working setting group.
- The first live Configure implementation used fragment anchors. Build 365
  exposed that the ApplicationV2 scroll region did not move, so the links were
  replaced with an explicit scroll action. The corrected action positioned
  Module: Additional Attributes at the top of the settings viewport.
- Visible GM QA expanded the complete eight-entry Science Fiction section and
  observed a clean two-column layout with no horizontal overflow. The complete
  catalog contained zero inputs, zero controls on planned entries, and nine
  navigation buttons for settings shared by multiple printed modules.
- A simultaneous TyfTester session showed exactly Personal theme and Default
  roll visibility in the system category. It contained no Configure button,
  world-rule control, or module catalog. GM and player browser logs contained
  zero warnings and zero errors.

### Linked combat declarations — 2026-07-31

- The declaration dialog now links each rolled action to an authoritative
  Attribute, Skill, Specialization, or weapon Attack and previews its final
  pool after MAP, movement, and Condition penalties.
- Visible GM QA selected Acrobatics 3D three times. All three rows showed
  `3D → 1D`, MAP showed −2D, and declaration remained enabled. A fourth row
  changed every pool to 0D, displayed the below-1D error, and disabled the
  command.
- With TyfTester Wounded and Standing, Run plus Acrobatics 3D produced two
  actions, MAP −1D, movement −1D, Condition −1D, and a prohibited 0D pool.
- A legal three-action declaration persisted as three ordered Acrobatics
  segments with final pool 1D and reopened with all three sources selected.
  The declaration was reset and TyfTester restored to Healthy and Standing.
- A separate TyfTester player session opened the owned synthetic Actor from the
  Combat Tracker and received the enabled declaration control and complete
  planner.
- Live QA exposed that Foundry v14 standalone template rendering lacks the
  legacy `selected` helper. Conditional HTML attributes replaced that helper,
  and grouped action choices are populated through safe DOM APIs.

### Personal damage resolution — 2026-07-31

- Visible GM QA resolved a retained Starship-scale Damage 32 card against
  Foundation Test Character. The original source Token was no longer on the
  scene, but the immutable Damage-card source context still preselected the
  rank-5 Starship and preserved the scale comparison. Brawn resistance totaled
  3, the system applied Wounded, and the original card retained the comparison
  and removed its one-shot resolver.
- A fresh targeted Damage roll totaled 31 against TyfTester. The resistance
  builder displayed `Must exceed Damage 31`, selected the original Starship
  source, and rolled Brawn 17. Its public result displayed
  `Failure · Difficulty 31`; the original Damage card recorded Wounded.
- A visible TyfTester player session saw both public damage summaries and zero
  **Resolve damage** controls. The player also had no GM Quickbar or Active
  Tasks controls. Returning to the GM restored both GM-only workspaces.
- Foundation and TyfTester were restored to Healthy and Standing. The visible
  browser was returned to the GM with the development world available.

### First Edition mortality and stabilization — 2026-07-31

- Visible GM plus TyfTester QA enabled the complete OpenD6 preset, staged
  Foundation Test Character as Mortally Wounded in round 1, and advanced the
  retained encounter to round 2. The player-visible mortality-card count rose
  by exactly one. Its public audit showed 1D Strength, 1 completed round,
  0 minutes, fixed Difficulty 0, and rules reference p. 76.
- The live Actor document and Combat sheet both retained Mortally Wounded,
  `mortalityRounds: 1`, and the processed round ID. The sheet displayed
  `1 completed rounds · 0 whole minutes elapsed` and **Stabilize with Medicine
  (25)**.
- The visible stabilization workflow selected Advanced Skills Validation as
  healer, displayed a locked 13D pool against difficulty 25, and rolled 47 with
  a Complication. The public card showed `Success · Difficulty 25`; the patient
  improved to Incapacitated and the mortality clock disappeared.
- Live tracing exposed three defects before sign-off: schema 18 discarded
  forward-added state fields during each DataModel migration, a partial clock
  update allowed Foundry to default the sibling Wound field, and the new audit
  used an untranslated difficulty key. Forward fields are now preserved, the
  survived write is atomic, and chat uses the canonical localization key.
- Cleanup restored the temporary healer score and mode, Foundation to Healthy,
  and the native Second Edition preset. It deleted 12 QA chat cards, one Token,
  two temporary macros, the created Combat, and the temporary Combatant from
  the retained encounter. The public development world remained available.
- The final server-log audit showed the connected player also reacting to the
  GM's master-preset change and attempting world-setting writes. Preset fan-out
  and master synchronization now return immediately on non-GM clients; a
  regression test proves that a player-side change notification performs zero
  setting writes.

### Vehicle and Starship damage and repair — 2026-07-31

- Visible GM QA targeted a rank-3 Vehicle from a rank-5 Starship and opened the
  weapon's 5D Damage builder. Relative scale contributed +2D for a final 7D
  pool. Damage 22 resolved against Hull 1D + Armor 1D resistance 6 and moved
  the Vehicle from Healthy to Wounded exactly once.
- The original public card persisted
  `Damage 22 vs. Hull + protection resistance 6` and the Wounded outcome after
  its GM-only resolver disappeared. The resistance card showed the individual
  Hull and Armor components, p. 183, and strict `Failure · Difficulty 22`.
- The Wounded machine sheet exposed only the printed Repair Mechanical action
  at fixed Difficulty 15. An owned Character with a temporary 12D Repair skill
  rolled 41; the GM selected the rules-authorized Wild Die partial success, and
  the Vehicle returned to Healthy.
- Live QA exposed two defects before sign-off. Machine scale audit text still
  said `Brawn resistance pool`, and a deferred sheet-focus microtask could read
  `ownerDocument` after the sheet closed. The audit now says
  `Hull resistance pool`, and the deferred focus path exits safely when its
  element has disconnected.
- After rebuilding and restarting Foundry, a fresh Damage 17 versus resistance
  8 result visibly confirmed the corrected scale audit, Hull 1D + Armor 1D,
  one-shot Wounded application, and the persistent public summary. TyfTester
  saw both public cards and zero **Resolve damage** controls. Leaving and
  rejoining as TyfTester preserved that result and permission boundary.
- Cleanup deleted the temporary Vehicle Token, Macro, Repair skill, and five QA
  chat messages; restored the Vehicle to Healthy and the repairer's Hero Point
  balance; and cleared targeting. The final visible checks found no retained QA
  message IDs, Macro, or Repair skill, and no post-restart browser-console
  errors. The world remained paused and publicly available.

### Second Edition Cover modifier boundary — 2026-07-31

- Full-text extraction and rendered-page inspection of D62e p. 30 and adventure
  pp. 245 and 248 confirmed that characters declare movement to take Cover and
  that scenery can provide it, but the book supplies no numeric Cover table or
  fixed modifier. No OpenD6 tier was inferred.
- OpenD6 Next's modern roll dialog and service were traced through target
  selection, difficulty, chat, flags, persistence, and permissions. It retains
  only a narrative Vehicle Cover field. The older OpenD6 implementation's
  quarter/half/three-quarters +1D/+2D/+4D tiers belong to that rules family and
  were deliberately not copied.
- The pure Cover planner normalizes base defense and a nonnegative integer
  modifier. Only a targeted Second Edition ranged Attack exposes the field;
  the builder previews effective Dodge, the immutable request records base
  Dodge, Cover, effective defense, and p. 30, and public chat renders the full
  equation. Melee, Damage, resistance, and First Edition paths remain unchanged.
- The complete `npm run check` passed: formatting, lint, typecheck, all 448
  tests, both production bundles, content and 14-page manual verification,
  invariants, and loader smoke. The dedicated container was explicitly stopped
  and started; it returned healthy, and both local `/dev` and the public route
  returned the expected join redirect.
- Visible GM QA used the retained rank-5 Starship and its 4D mounted ranged
  Attack against TyfTester. Base Dodge 30 plus entered Cover 5 updated the
  builder and locked roll Difficulty to 35. The public failure card rendered
  `Dodge 30 + Cover 5 = 35`, the no-fixed-values warning, and p. 30.
- TyfTester saw that public equation and page reference with zero GM Quickbar or
  Active Tasks controls. A full player reload retained the card. The only
  browser errors were the already-recorded Token Action HUD Core missing
  `list-subgroup.hbs` partial issue; no D62e Cover error appeared.
- Cleanup restored the Complication-awarded Hero Point from 1 to its original
  0, returned TyfTester from GM Free Edit to Normal, deleted the sole QA chat
  card, and left the visible browser in the GM world. Final DOM checks found no
  retained Cover audit card.

### Alternate Wild Dice — 2026-07-31

- D62e core pp. 26-27 and optional-module pp. 71-73 were extracted and rendered
  for visual inspection. This corrected the prior handover's incomplete p. 71-72
  range: Simple is printed on p. 73.
- OpenD6 Next's result contract, settings, automatic and prompted branches,
  DialogV2 choice, chat flags, localization, permissions, sockets, persistence,
  and tests were traced. D62e supplied every implemented mechanical rule.
- Automated validation passed all 454 tests plus formatting, lint, typecheck,
  both production bundles, content packs, the 14-page and 24-screenshot manual, package
  invariants, and the generated-bundle loader. The loader verified 57 registered
  settings and Actor schema 19.
- The dedicated Foundry container was explicitly stopped and started. Build 365
  loaded system `0.1.0-alpha.9`; both local and public `/dev/game` routes returned
  the expected redirect to `/dev/join` before the visible sessions entered.
- The GM settings surface showed exactly Core, Basic, Classic, and Simple. Basic
  rolled an initial Wild Die 1 and visibly struck that die plus the highest
  ordinary die, producing the printed automatic penalty.
- TyfTester rolled an initial Classic 1. The GM received the exact Penalty or
  Narrative Complication decision, selected Penalty, and both clients received
  the same page-cited card with the removed dice and total 0.
- Simple visibly counted an initial Wild Die 1 as an ordinary result with no
  prompt or penalty. A separate exploding sequence retained a subsequent Wild
  Die 1 in the total, confirming that only sixes have special handling.
- While Simple remained selected, the independent OpenD6 compatibility toggle
  produced a shared `OpenD6 classic` card citing D6S pp. 55-56. The compatibility
  path therefore overrode the active Second Edition choice without mutating it.
- A full player reload retained shared results. The player settings category
  contained only Personal theme and Default roll visibility; neither world
  Wild Die selector nor First Edition compatibility controls leaked.
- Cleanup restored Core, disabled OpenD6 compatibility, deleted every Basic,
  Classic, Simple, and pass-created OpenD6 chat card, logged out TyfTester, and
  left the public GM session visible. Final GM and player browser-log queries
  returned no warnings or errors.

### Second Edition Chases — 2026-07-31

- D62e pp. 73-74 were extracted and visually inspected. OpenD6 Next has no
  chase implementation, so its Active Tasks ApplicationV2 surface and
  Combat/round Scene-flag, revision, authority, socket, hook, reload, and audit
  patterns supplied the nearest acceptance trace while D62e supplied every
  mechanic.
- Automated validation passed all 461 tests plus formatting, lint, typecheck,
  both production bundles, content packs, the 14-page and 25-screenshot manual,
  package invariants, and generated-bundle loader smoke. The loader verified 58
  settings and Actor schema 19.
- Foundry v14 Build 365 loaded `0.1.0-alpha.10` in the dedicated development
  container. One restart encountered Foundry's empty stale
  `Config/options.json.lock`; after the dev container was stopped and no owner
  process remained, only that empty lock directory was removed and the healthy
  container restarted. Production was not touched.
- GM QA started `Live Chase Validation` at Distance 4 with Foundation Test
  Character / Climbing and TyfTester / Acrobatics. An ordinary pursuer win
  moved 4 to 3. A final Exceptional Success moved 4 to 2; chat retained both
  totals, both normal Wild Die outcomes, the two-step decision, and pp. 73-74.
- Live resolution exposed Foundry's merge behavior retaining absent nested roll
  keys. The authoritative flag writer now uses v14 `ForcedDeletion` operators;
  Exchange 2 visibly returned to two fresh Roll Skill controls. Live startup
  also exposed and fixed the tracker's unbound ApplicationV2 mixin.
- A visible TyfTester login saw only the owned fleeing Roll Skill control and
  no resolve or end controls. Reload retained the Scene chase and Distance 4.
  A simultaneous active-GM socket submission remains automated-only because
  both available visible browser surfaces resolve to the same browser profile.
- Cleanup confirmed End chase, disabled Module: Chases, removed the six
  pass-created roll/resolution cards, and retained no chase flag. Final service
  health and browser-console results are recorded in the pass report.

### Second Edition Environments — 2026-07-31

- D62e pp. 77-78 were extracted, rendered, and visually inspected. OpenD6 Next
  has no environment manager, so its complete condition, damage, resistance,
  roll-context/chat, ApplicationV2, permission, migration, and reload paths were
  traced as the nearest acceptance boundary. D62e remained the sole mechanics
  authority.
- The dedicated Foundry v14 Build 365 container was explicitly stopped and
  started. An empty stale `Config/options.json.lock` directory was removed only
  after the development container was stopped and no owner remained. The world
  loaded `0.1.0-alpha.11`, then the client migrated 81 documents to schema 20.
  Production was not touched.
- The GM enabled Module: Environments and opened its GM-only Token Controls
  manager. The in-app browser could not dispatch any custom Scene-control
  callback, including the already-verified GM Quickbar, so a temporary visible
  Script Macro invoked the exact callback registered on that tool. All manager,
  dialog, roll, sheet, chat, reload, role, and cleanup interaction after that
  handoff used the visible Foundry interface.
- A Cold/Severe Stamina failure persisted Difficulty 20 and −2D on Advanced
  Skills Validation. After a full reload, the manager and Combat workspace both
  showed the source-cited effect. Live QA exposed and fixed an obsolete
  movement-strategy identifier that had hidden the movement and environment
  panels; the repaired workspace showed Walk 5 m, Run 10 m, and Crawl 2 m.
- Medicine 3D visibly resolved at the legal 1D minimum. Its public chat card
  retained `Environmental penalty`, Cold, Severe, Difficulty 20, −2D, and
  rules reference p. 77. Choosing Stunned while the severe effect was active
  produced Wounded; QA then restored Healthy.
- The manager visibly exposed Aid at the original difficulty and confirmed the
  safe-day route. Deterministic aid success/failure, provenance-safe condition
  restoration, direct-condition hazards, drowning progression, damage and
  resistance penalties, minimum 1D, permissions, and inert-disabled persistence
  are covered by automated tests rather than being forced through random live
  rolls.
- A TyfTester session had zero Environment-manager and GM Quickbar controls,
  including after a full reload. Cleanup cleared the effect, restored Advanced
  Skills Validation from 2 to 1 Hero Point and TyfTester from 1 to 0, removed
  the three pass-created chat cards, disabled the module, deleted the temporary
  Macro, and returned the visible browser to the GM world.
- The final `npm run check` passed formatting, lint, typecheck, 94 test files /
  482 tests, both production bundles, content-pack and 14-page/26-screenshot
  manual verification, package invariants, and generated-bundle loader smoke.
  The loader registered 59 settings and initialized Actor schema 20.

### Second Edition Equipment by Genre/Era foundation — 2026-07-31

- D62e pp. 79-85 were extracted, rendered, and visually inspected. The source
  establishes three alternative equipment families—Medieval, Modern, and
  Science Fiction—while leaving acquisition and costs to the GM. Named tables,
  item names, descriptions, and values were not copied.
- OpenD6 Next's complete typed Weapon/Armor/Gear, source-compendium, inventory,
  Item-sheet, ownership, and compendium-visibility paths were traced. D62e
  intentionally adds a campaign-era selector and persistent provenance instead
  of hiding mismatched Items; the empty base catalog is a distribution boundary,
  not missing content.
- The dedicated Foundry v14 Build 365 container was explicitly stopped and
  started after the production bundle passed. Each stop left an empty stale
  `Config/options.json.lock`; after confirming the container was stopped, the
  two lock directories were moved recoverably to `/private/tmp`. Production was
  not touched. The world loaded `0.1.0-alpha.12` and migrated 81 documents to
  schema 21.
- GM QA selected Modern through native Game Settings and verified the dedicated
  Second Edition settings card and resolved campaign profile. A newly created
  Gear Item inherited Modern, displayed the classification and custom-item
  provenance boundary on its Item sheet, remained visible in the character
  inventory, and survived a full reload.
- TyfTester saw the Modern classification but the Item-era selector was
  disabled. The ordinary Equipped checkbox remained enabled; changing it from
  the inventory persisted through a full player reload. The accepted Item-sheet
  capture was added to the user manual.
- Cleanup returned Equipped to off, deleted the temporary Gear, restored the
  campaign era to Unclassified, and visibly reopened settings to confirm the
  restored selection.
- The final `npm run check` passed formatting, lint, typecheck, 97 test files /
  492 tests, both production bundles, content-pack and 14-page/27-screenshot
  manual verification, package invariants, and generated-bundle loader smoke.
  The loader registered 60 settings and initialized Actor schema 21.

### Module: No Dodge Defense — 2026-07-31

- D62e pp. 29-34 and p. 94 were extracted, rendered, and visually inspected.
  The module replaces personal ranged Dodge with Point Blank 5, Short 10,
  Medium 15, Long 20, or Long 30 when the target is dodging; Parry and machine
  Defense remain.
- OpenD6 Next's complete target, measured-range, settings, visibility, and roll
  audit paths were traced. D62e adapts those paths without importing its active
  Dodge scheduler.
- The focused pre-live gate passed 6 test files / 76 tests, TypeScript
  typecheck, and both production bundles. The development-only Foundry v14
  Build 365 container was stopped and restarted; its confirmed-empty stale
  `Config/options.json.lock` directory was removed while stopped. The container
  became healthy after 6 seconds and the public `/dev/game` endpoint returned
  the expected HTTP 302 to `/dev/join`.
- GM QA visibly verified the checked p. 94 settings card, `Module: No Dodge
Defense` campaign profile entry, localized `No Dodge fixed range
difficulties` capability, Dodge-free Combat sheet, retained Parry 15, and
  posture text that does not claim a fixed-range modifier.
- A visible temporary Macro created exact source/target Tokens and configured a
  Shooting weapon. At 18 m the builder showed Long 20; **Target is dodging**
  changed the base to 30 and Cover 5 produced Difficulty 35. The public card
  audited `Long range · 18 m`, the module, p. 94, target dodging, and `Range
difficulty 30 + Cover 5 = 35` with p. 30.
- TyfTester opened the same owned Actor and builder, saw Long 20 and the
  long-range dodging choice, and saw the complete public audit. After a full
  reload the player still had the behavior and had no GM Quickbar, task
  manager, module setting, or printed-module catalog.
- Cleanup deleted both temporary weapons, all four exact temporary Tokens, both
  temporary Macros, and the one pass-created chat card; restored TyfTester from
  1 to 0 Hero Points; and returned the No Dodge setting to off. The refreshed
  settings and roll-builder captures were visually inspected.
- The final `npm run check` passed formatting, lint, typecheck, 98 test files /
  502 tests, both production bundles, content packs, the 14-page/27-screenshot
  manual, package invariants, and generated-bundle lifecycle smoke. The loader
  registered 61 settings and initialized Actor schema 22.

### Module: Hyper-lethal Combat — 2026-08-01

- D62e p. 33 and pp. 89-90 were extracted, rendered, and visually inspected.
  OpenD6 Next's complete damage, resistance, deadliness-setting, authoritative
  application, condition synchronization, and chat-audit paths were traced;
  D62e remained the mechanics authority.
- The development-only Foundry v14 Build 365 container was explicitly stopped
  and restarted after the production bundle passed. Its confirmed-empty stale
  `Config/options.json.lock` directory was removed only while the container was
  stopped. The healthy public `/dev` endpoint returned the expected redirect to
  `/dev/join`; production was not touched.
- GM QA saved all four independent controls and reopened the settings app to
  verify persistence. The resolved campaign profile listed `Module:
Hyper-lethal Combat`. Foundation Test Character visibly showed Brawn 1D plus
  Armor 6D capped from 7D to 6D, and its public resistance card audited the
  maximum and p. 90.
- A deterministic visible Macro fixture equipped a temporary 20D Weapon and 6D
  Armor. Damage 62 versus TyfTester's unlinked Token resistance 24 opened the
  Killing Blow dialog because resistance was strictly below half Damage.
  Spending one of two Hero Points survived and applied Mortally Wounded because
  both Stunned and Wounded were removed. The public Damage card recorded the
  survival, spend, shortened-track result, and p. 90.
- A visible TyfTester login saw the complete public Damage and resistance cards.
  Its Game Settings contained zero Hyper-lethal controls and no Second Edition
  Configure action. This also confirmed that the unlinked Token, rather than
  the base directory Actor, was the authoritative damage target.
- Cleanup restored the base Actor and Token resources/conditions, restored the
  original unequipped 0D Weapon, deleted the temporary Armor and Macro, removed
  all five QA chat cards, disabled all four settings, and reopened the settings
  app to confirm four unchecked controls. The refreshed settings screenshot was
  visually inspected.
- The final `npm run check` passed formatting, lint, typecheck, 99 test files /
  508 tests, both production bundles, content packs, the rebuilt user manual,
  package invariants, and generated-bundle lifecycle smoke. The loader
  registered 65 settings and initialized Actor schema 22.

### Module: Hero Points — 2026-08-01

- D62e pp. 75-76 were extracted, rendered, and visually inspected. OpenD6
  Next's meta-currency, roll augmentation, advancement-currency, session
  lifecycle, settings, and chat-audit paths were traced completely; D62e
  remained the mechanics authority.
- The implementation adds one mutually exclusive Heroic, Basic, or Classic
  strategy. Heroic retains core doubling, failed-roll reroll, Stunned
  prevention, and session refresh/carry-over. Basic buys ordinary dice
  one-for-one. Classic shares Experience Points, requires Classic Wild Die and
  Experience Point advancement, buys independently resolving Wild Dice up to
  the baseline Attribute's whole dice, and awards every Classic Wild Die 6.
  Superheroic Hero Points remain deferred to p. 204.
- The full pre-live `npm run check` passed formatting, lint, typecheck, 101 test
  files / 522 tests, both production bundles, content packs, the 14-page / 27-
  screenshot manual, package invariants, and generated-bundle lifecycle smoke.
  The loader registered 67 settings and initialized Actor schema 22.
- The development-only Foundry v14 Build 365 container was restarted. Its stale
  `Config/options.json.lock` directory prevented the first startup, so the
  confirmed lock was moved recoverably to `/private/tmp` and only the same
  development container was restarted. It became healthy; both local port
  30001 and the public `/dev` endpoint returned the expected `/dev/join`
  redirect.
- GM QA visibly saved and reloaded Basic. Foundation Test Character spent two
  of two Hero Points, rolled its normal 3D plus two ordinary bonus dice, and
  produced the p. 76 `-2 Hero Points · Basic ordinary bonus dice` audit.
- GM QA then selected Classic and visibly confirmed automatic Classic Wild Die
  and Experience Point advancement dependencies, the `Hero / Experience
Points` sheet field, the 3D baseline spend maximum, three bonus Wild Dice, a
  real GM Classic-mishap choice, and the public spend audit. A later natural
  roll exploded a Classic Wild Die 6, posted `+1 Hero Points`, and changed the
  shared balance from 3 to 1 after the three-point spend.
- TyfTester joined and reloaded, saw the same public Classic spend/explosion/
  award card, had the shared sheet field disabled, and saw only two personal
  system settings with no Hero Point or Second Edition campaign controls. Its
  reload reproduced two pre-existing Token Action HUD Core missing-partial
  errors for `list-subgroup.hbs`; the D62e system loaded and the tested behavior
  remained available. The final GM console contained no warnings or errors.
- Cleanup restored Heroic, Core Wild Die, no advancement module, starting Hero
  Points 1, and carry-over off; restored Foundation Hero Points to 2 and
  Experience Points to 0; removed all four pass-created chat cards; and reloaded
  to confirm every value. The accepted settings and roll-builder screenshots
  were refreshed from the live views.

### Module: Alternate Initiative — 2026-08-01

- D62e printed pp. 69-70 (physical PDF pages 70-71) were extracted, rendered,
  and visually inspected. OpenD6 Next's actor formula, Combat/Combatant
  documents, initiative reroll hook, responsible-GM ownership boundary,
  settings ApplicationV2, tracker behavior, tests, and prior live records were
  traced completely; D62e remains the mechanics authority.
- One GM-only native selector now chooses Standard, Simple, Basic, or Narrative.
  The existing Standard contextual order and independent First Edition
  Perception strategy remain unchanged. Basic uses the normal D62e Perception
  roll pipeline, labels low-to-high declaration positions, resolves high-to-low,
  and clears results each round. Narrative persists the owner-chosen chain on
  Combat and rotates the prior last declarer to the next round lead.
- Equal Perception totals retain the prior stable Combat order because the
  printed module supplies no tie procedure. The Narrative Hero Point interrupt
  sidebar remains unautomated GM advice. Player totals are accepted only by a
  GM after Actor OWNER validation; Narrative successor selection is limited to
  the current participant's owner or a GM.
- Focused automated verification passed 102 test files / 531 tests before the
  first full repository gate.
- The development-only Foundry v14 Build 365 container was restarted after the
  production bundle passed. A confirmed stale `Config/options.json.lock`
  directory blocked the first startup, so it was moved recoverably to
  `/private/tmp` while only that container was stopped. Both local port 30001
  and public `/dev` returned the expected `/dev/join` redirect; production was
  untouched.
- GM QA saved Simple and Basic, reopened the settings app, and then reloaded the
  client. Basic rolled Perception for three real Actors through the normal roll
  builder, displayed results 8/5/4 in resolution order with declaration labels
  3/2/1, retained them through reload, and cleared all totals in round 2.
- Switching to Narrative initially exposed a missing tracker refresh; the
  setting registration now rerenders the tracker immediately. Narrative rolls
  produced a 5/3/1 order. The GM chose TyfTester and then Foundation, and round
  3 correctly promoted prior-last Foundation to the lead while retaining the
  remaining owner-choice controls.
- TyfTester saw the Narrative notice, read-only totals, and only the successor
  choice belonging to its current owned participant. A live player attempt
  exposed Foundry's Combat write denial; successor choices now use the same
  validated active-GM socket boundary as player initiative totals. With no GM
  present, the player control was visibly disabled with an explicit active-GM
  requirement. The accepted settings and tracker captures were visually
  inspected.
- Cleanup removed the six pass-created Perception chat cards, all three
  temporary Combatants, and the temporary Macro; cleared both initiative flags;
  restored the retained empty Round 1 encounter and Standard strategy; and
  reloaded. The final tracker had zero Combatants and the final GM browser log
  contained no warnings or errors.
- The final `npm run check` passed formatting, lint, typecheck, 102 test files /
  532 tests, both production bundles, content packs, the 14-page/28-screenshot
  manual, package invariants, and generated-bundle lifecycle smoke. The loader
  registers 68 system settings and initializes Actor schema 22.

### Second Edition character templates — 2026-08-01

- D62e printed pp. 138-139 (physical PDF pages 139-140) were extracted,
  rendered, and visually inspected. OpenD6 Next's complete template document,
  contained-Item editor, presentation, quickbar, test, and validation
  boundaries were traced; its modern implementation has no complete apply
  transaction to port.
- The implementation adds a versioned immutable public catalog, exact preview,
  campaign/profile/permission validation, schema-25 provenance, and a protected
  owner/GM apply service. It writes only the four active Attribute scores,
  template state, and explicitly declared Armor/Gear/Weapon additions. Skill
  dice, resources, health, advancement, and arbitrary fields remain untouched;
  failed final Actor persistence rolls back every newly created Item.
- The focused and complete automated matrix passed 113 test files / 578 tests,
  strict TypeScript, lint, production system and Token Action HUD bundles,
  migrations, API guards, registry conflicts, permissions, invalid profiles,
  repeat protection, rollback, UI contracts, and loader lifecycle.
- Foundry v14 Build 365 loaded system and companion `0.1.0-alpha.15`, migrated
  81 documents to schema 25, and negotiated public API v1. Only the development
  container was explicitly stopped and started. Its confirmed-empty stale lock
  was moved to `/private/tmp/d6e2-options-json-lock-alpha15`; local port 30001
  and public `/dev` both returned the expected `/dev/join` redirect.
- A visible GM session registered one temporary lawful `QA Balanced Foundation`
  catalog, opened the complete confirmation dialog, and applied exact Agility
  5D, Brawn 3D, Knowledge 1D, and Perception 3D values. Athletics and Stamina
  remained 0D increases, Hero Points stayed 1, `QA Template Kit` Gear was added,
  provenance replaced the action, and all state persisted across reload with
  no second application control.
- TyfTester saw only the two owned Actors, registered the same catalog in its
  own client, and completed the owner path without Free Edit or GM controls.
  Its Attribute, provenance, unchanged resource, no-repeat state, and Gear all
  persisted across a full reload.
- The accepted visible screenshot is
  `assets/manual/character-template-preview.png`. OpenD6 Next has no complete
  modern apply surface for same-size comparison, so the equivalent document
  and editor implementation was inspected rather than claiming a nonexistent
  live workflow.
- Cleanup deleted both temporary Actors and the temporary Macro and removed the
  runtime catalog. No chat was created. Both roles reproduced only Token Action
  HUD Core 2.1.1's pre-existing missing `list-subgroup.hbs` reload error; no
  D62e template error occurred. Production was not touched.

### Second Edition Fantasy Skills and Freeform Magic — 2026-08-01

- D62e printed pp. 140–159 were extracted, rendered, and visually inspected.
  OpenD6 Next's manifestation/metaphysics model, editor, casting pipeline,
  ownership, audit, API, and test boundaries were traced completely without
  copying its different Control/Sense/Alter mechanics.
- Automated coverage verifies exact design arithmetic and minimum Difficulty,
  Power beyond 10, resistance results, 0/+5/+10 training penalties, dependency
  resolution, catalogs, schema-26 idempotency, API guards, Item/chat surfaces,
  builds, packs, and loader lifecycle.
- Foundry v14 Build 365 visibly loaded `0.1.0-alpha.16` and schema 26 after only
  `foundry-dev` was restarted. Its confirmed stale options lock was moved
  recoverably to `/private/tmp/d6e2-options-json-lock-alpha16`; production was
  untouched.
- GM QA enabled the four required settings, created an owned temporary caster,
  and edited an original Manifestation to Power 3, two-to-three targets,
  partial resistance, one-round duration, one-action casting, and senses range.
  Live persistence initially failed; targeted per-field persistence was added,
  after which close/reopen and a fresh client both retained Difficulty 30.
- The GM and TyfTester owner each opened the protected 1D roll builder at fixed
  Difficulty 40, proving the printed +10 no-Magic-dice path. Both public cards
  recorded school, Power 3, penalty, pp. 145–159, dice, total, and failure; the
  player's card remained after a full reload.
- The accepted editor capture is
  `assets/manual/freeform-magic-design.png`. Live QA also removed generic Trait
  controls and restored the native Manifestation type title before capture.
- Cleanup deleted the exact temporary Actor, Macro, and chat messages, restored
  Magic, Specializations, Fantasy Skills, and Freeform Magic to off, and left
  the GM world available. The only browser error was Foundry's minimum-window
  warning at the browser controller's fixed 1280×720 viewport; no D62e error
  was present.
- The final `npm run check` passed formatting, lint, typecheck, 116 test files /
  586 tests, both production bundles, 43 Second Edition and 60 OpenD6 Skill
  pack entries, the 14-page/32-screenshot manual, package invariants, and the
  generated-bundle lifecycle smoke. The loader initializes schema 26 and all
  70 grouped settings.

### Second Edition Fantasy Bestiary and Fantasy Templates — 2026-08-01

- D62e printed pp. 165–171 (physical PDF pages 166–172) were extracted,
  rendered, and visually inspected. OpenD6 Next's Creature Actor,
  Character/Species Template Items, schemas, compendium and import boundaries,
  ApplicationV2 registration, sheets, styling, localization, permissions, and
  automated creature semantics were traced without copying protected names,
  prose, or art.
- Public API v1 adds an immutable, versioned, owner-scoped bestiary registry
  and GM preview/create service. The distributed bestiary and fantasy-template
  catalogs are deliberately empty; lawful companion registrations use the new
  Creature path or the already-protected exact character-template transaction.
- Schema 28 persists source/catalog/entry provenance. Creature Attribute scores
  may reach 20D while Character and NPC limits remain unchanged. One Actor
  creation source contains the validated broad Attribute baselines, static
  defenses, movement facts, scale, Magic Point state, biography, complete
  active Skill catalog, and declared contributed Items.
- The GM-only ApplicationV2 Creature Catalog presents source-cited previews,
  dependency issues, and a create action. Its accepted live capture is
  `assets/manual/creature-catalog.png`; the rebuilt manual explains the lawful
  registration and empty-catalog boundary.
- Live acceptance found two TypeDataModel persistence defects. New
  migration-backed scale/provenance fields retained defaults during create,
  and an unrelated partial sheet update reinjected those defaults. Creation
  now reasserts the complete fields through the persisted update boundary and
  removes the Actor if that write fails; partial updates preserve absent
  movement, scale, and bestiary fields.
- Build 365 visibly loaded alpha.18/schema 28. GM QA created and inspected 4D,
  9D, 2D, and 3D Attributes, Dodge 20, Parry 15, scale 2, source/catalog
  provenance, and both contributed Items. Switching sheet mode preserved the
  complete record, and a full reload retained it. A temporary passwordless
  Player saw neither the GM catalog control nor the unowned Actor before or
  after reload.
- Cleanup removed the temporary Actor, Macro, Player User, and registry owner.
  Edge ended in the clean GM world with no warning or error. Development
  Foundry alone was restarted; stale empty lock directories were moved
  recoverably under `/private/tmp`, both development endpoints returned the
  expected join redirect, and production was untouched.
- The final gate passed formatting, lint, typecheck, 122 test files / 604
  tests, both production bundles, content packs, the rebuilt 14-page / 35-image
  manual, invariants, and generated-bundle lifecycle smoke. The loader
  initializes API v1 and schema 28.

### Second Edition Science Fiction Skills — 2026-08-02

- D62e printed pp. 173–176 were extracted, rendered, and visually inspected.
  OpenD6 Next's Flying/0-G catalog, complete Attribute-plus-Skill calculation,
  Item and Character sheets, rolls, advancement, active-defense flow,
  permissions, settings, tests, and validation records were traced completely.
- The independent package synchronizes Flying/0-G, Barter, Gambling, Gunnery,
  Languages, and Streetwise without enabling Mechanical or Technical. Schema
  29 persists an explicit Perception/Flying Dodge basis, while the typed core
  rule supplies both sheet display and targeted attacks without counting
  Agility twice. The Combat tab supplies the printed movement, hover, action,
  and page guidance.
- Build 365 visibly loaded alpha.19/schema 29 after only the development
  Foundry was restarted. The confirmed-empty stale lock was moved recoverably
  under `/private/tmp`; local port 30001 and public `/dev` both returned their
  expected join redirect, and production was untouched.
- GM QA synchronized the exact six-Skill profile, observed Perception Dodge 15,
  selected complete 4D Flying for Dodge 20, and saw four meters of flight and
  four hover rounds. That state persisted after reload. TyfTester changed both
  bases through the owner control and retained Flying 20 through a separate
  player reload.
- Cleanup restored the original Actor Skill list and budget, Perception basis,
  Normal mode, OpenD6 on, and Science Fiction Skills off. A final reload
  confirmed Languages retained, all five temporary package additions absent,
  and the inactive package showing Dodge 15 without Flying controls.
- Server logs contained no D62e error; Foundry repeated only its pre-existing
  `Failed to parse URL from undefined` update-check warning on client joins.
- The accepted visible capture is
  `assets/manual/science-fiction-skills.png`. Focused coverage passed 8 files /
  86 tests; the final repository gate covers the complete automated matrix,
  bundles, rebuilt content and manual packs, invariants, and loader lifecycle.

### Second Edition Psionics — 2026-08-02

- D62e printed pp. 184–190 were extracted, rendered, and visually inspected.
  OpenD6 Next's metaphysics implementation was traced for reusable sheet,
  permission, combined-component, roll, and persistence boundaries while the
  D62e discipline, training, pool, and attempt rules remained authoritative.
- Alpha.20/schema 31 implements the default-off Psionics module, three
  standalone discipline Skills, protected first-1D downtime training, normal
  later advancement, one- or two-discipline complete-pool addition, a
  24-world-hour attempt ledger, structured chat audit, and an immutable lawful
  power-registration contract. The distributed power catalog is intentionally
  empty of protected names and prose.
- Build 365 GM QA visibly enabled the module, synchronized Kinesis, Perceive,
  and Reform, confirmed their initial 0D state, and trained Kinesis through one
  week with a teacher. TyfTester then saw Kinesis at 1D with the same training
  provenance, exactly two remaining first-die controls, no GM Quickbar, and the
  lawful empty-catalog explanation. A full player reload retained every fact.
  `assets/manual/psionics.png` records the accepted tab.
- A contributed power could not be rolled visibly because the lawful public
  catalog is empty. Registry validation, required-discipline enforcement,
  complete-pool arithmetic, fixed/scaling difficulty, attempt persistence, and
  chat audit are covered by automated tests instead of being claimed live.
- Cleanup restored the module setting to off. The synchronized discipline
  Items remain loss-preservingly embedded on the test Actor but inactive. The
  browser logged only Token Action HUD Core's pre-existing missing-partial
  error; no D62e error was present.
- Only development Foundry was restarted. A confirmed-empty stale
  `options.json.lock` was moved recoverably under `/private/tmp`, after which
  both development routes recovered. The complete gate passed formatting,
  lint, typecheck, 136 files / 657 tests, both bundles, 49 Second Edition and 60
  OpenD6 Skills, manual generation/verification, invariants, and lifecycle
  smoke.

### Second Edition Superheroic Campaign Foundations — 2026-08-02

- D62e printed pp. 204–211 were extracted, rendered, and visually inspected.
  OpenD6 Next's settings, dedicated sheet workspace, protected resources,
  Combatant revision state, roll-dialog, chat-audit, migration, and permission
  patterns were traced without importing unrelated rules or protected power
  content.
- Alpha.22/schema 33 implements the default-off Superheroic Skills package and
  +1D creation adjustment, additive Hero Point choices, character-only Die Code
  caps, and the persisted Secret Identity pool, Suspicion, exposure, clearing,
  and public-identity lifecycle. Flying/0-G, Gambling, and Streetwise reuse
  stable Skill identities across genre packages.
- Foundry v14 Build 365 visibly loaded alpha.22 after only development Foundry
  was restarted. Its known empty `options.json.lock` was moved recoverably to
  `/private/tmp/d6e2-options-lock-recovery-20260802-2127`; local port 30001 and
  the public development route both recovered to their expected join redirect.
- GM QA enabled all four foundation controls, observed the +1D package and
  Standard Hero 15D cap, reinforced the identity pool to 2, then took a clue to
  reach its 3-point ceiling. The open Suspicion die rolled 1 and exposed the
  identity; the GM cleared the name, and a full reload retained the names,
  pool, Suspicion, and status before cleanup.
- A distinct TyfTester session saw the same plain-language rules and cap,
  retained owner-authored identity names through reload, and had every GM-only
  control disabled. The accepted manual capture is
  `assets/manual/superheroic-foundations.png`; both clients reported zero
  browser warnings or errors.
- Cleanup returned both Actors to blank identity names, a 1-point active pool,
  and zero Suspicion, then restored the complete OpenD6 preset and all four
  superheroic settings to their original disabled/no-cap state. The live audit
  cards remain as a transparent record of the accepted resource transitions.
- The final repository gate covers formatting, lint, typecheck, the complete
  automated matrix, both production bundles, regenerated packs, the rebuilt
  manual, package invariants, and generated-bundle lifecycle smoke.

### Second Edition Superpowers — 2026-08-02

- D62e printed pp. 212–226 were extracted, rendered, and visually inspected.
  OpenD6 Next contains no reusable Superpower engine or lawful named catalog,
  so the D62e rules are represented through the existing Talent, settings,
  protected-update, chat-audit, and contributed-catalog boundaries.
- Alpha.22/schema 34 adds a default-off module with its own 8D–24D campaign
  budget, ranked base cost, per-rank generic enhancement cost, one-time generic
  limitation credit, a 1D minimum, automatic powers, declared reliance, and
  reload-safe Talent fields. Superpower Talents do not spend the ordinary Skill
  creation budget.
- Build 365 GM QA visibly selected Standard Hero 12D, saved a rank-2 custom
  Talent at `(2D + 1D) × 2 − 2D = 4D`, exercised a 99D limitation credit to
  verify the 1D floor, declared reliance, and retained 4D/12D after reload. A
  distinct TyfTester session saw the same workspace, declared reliance, and
  retained the power and budget after its own reload.
- Live acceptance exposed two release blockers and closed both: the Character
  sheet omitted its Superheroic tab when Superpowers was the only active
  superheroic module, and directly editable Item details had no dependable
  explicit save action. Static regressions now cover the tab condition and the
  new Save button; the complete automated gate passed after both source fixes.
- The accepted manual capture is
  `assets/manual/superheroic-foundations.png`. Both temporary Talents and both
  audit messages were deleted. The complete OpenD6 preset was restored,
  Perks/Flaws/Talents and Superpowers were disabled, and Standard Hero 12D was
  retained. Local port 30001 and the public development route both returned
  the expected join redirect; production was untouched.
- The public feature registry remains empty of protected printed power,
  enhancement, and limitation names, text, examples, art, and tables. Lawful
  custom content and private or independently licensed companions use the same
  validated typed contract.

### Second Edition Gadgets & Gear — 2026-08-02

- D62e printed pp. 227–228 were extracted, rendered, and visually inspected.
  OpenD6 Next has no equivalent superheroic equipment engine, so the pass
  reuses the native personal Gear, shared-roll, Superpower Talent, permission,
  persistence, and structured chat boundaries while D62e remains the rules
  authority.
- Alpha.22/schema 35 adds explicit Gadget and Superpower Gear profiles. A
  Gadget stores one Attribute or Skill target plus a narrow use case and adds
  exactly +1D through the normal roll pipeline. Gear stores one or more lawful
  custom Superpower Talent links, portable snapshots for copied or transferred
  Items, creator identity, borrower −1D audit, condition, combined-cost rebuild
  days, and an explicit generic rebuilding override.
- Build 365 GM QA retained a Climbing Gadget target and use case, opened the
  normal roll dialog at 6D+1 from a 5D+1 Skill, and produced a chat audit naming
  the Item, +1D, narrow use, and p. 227. The same workspace visibly disabled a
  malfunctioning Gadget, declared a linked 2D Gear power, disabled destroyed
  Gear, and offered the correct two-day rebuild.
- Live QA found a real persistence defect: the custom target selection was
  erased when an immediately persisted equipment field rerendered the Item
  form. The target now maps immediately to its two typed fields, including a
  deliberate clear path, with focused regression coverage. Reload and reopen
  then retained the exact Climbing target, use case, and equipped state.
- A distinct TyfTester login saw its owned Athletics Gadget, opened the shared
  roll at 6D with the +1D applied, and had no malfunction, repair, destruction,
  or rebuild controls. The GM client contained only Token Action HUD Core's
  pre-existing missing-partial error and no D62e warning or error.
- Cleanup deleted the temporary custom Talent, both GM equipment Items, and the
  player Gadget, restored OpenD6 on, and returned Perks/Flaws/Talents,
  Superpowers, and Gadgets & Gear to off. The accepted manual capture is
  `assets/manual/superheroic-foundations.png`.
- Automatic coverage supplies deterministic Complication-triggered
  malfunction, borrowed-snapshot/−1D, invalid-use, permissions, migration, and
  campaign-dependency cases that were not forced destructively in the live
  world. The final repository gate passed formatting, lint, typecheck, 148 test
  files / 702 tests, both production bundles, content-pack verification,
  package invariants, and the generated-bundle lifecycle smoke at schema 35
  with 85 grouped settings. The rebuilt manual contains 14 pages and 40
  screenshots.
- Only development Foundry was stopped and started for the planned manual-pack
  rebuild. It returned healthy on v14 Build 365, completed world and package
  migration without error, served local `/dev/join` with HTTP 200, and served
  public `/dev/game` with the expected HTTP 302 to `/dev/join`. A post-restart
  GM login showed the normal world UI, no browser warning or error, OpenD6 on,
  and the three superheroic dependency settings still off.

### Nemesis, Companions, and Sidekicks — 2026-08-03

- D62e printed pp. 235–237 were extracted, rendered, and visually inspected.
  OpenD6 Next has no equivalent relationship engine, so the implementation
  reuses native Character Actors, ownership, protected Hero Point transactions,
  creation accounting, and the ApplicationV2 Superheroic workspace.
- Build 365 GM QA saved Foundation Test Character as TyfTester's Nemesis,
  retained the relationship across reload, and began an open encounter with a
  rolled 3 and therefore 6 fresh Nemesis Points. The encounter count advanced
  to one and the linked Character state remained intact.
- TyfTester retained its Companion, half-budget Sidekick marker, active status,
  mentor, and printed-requirement confirmation across GM and player reloads.
  The player had no GM Quickbar; every configuration, save, clear, encounter,
  and resolution control was disabled, while the owner Companion recovery was
  enabled and produced the expected pp. 235–237 audit.
- Live QA exposed and closed boolean checkbox submission, old-Actor defaulting,
  partial-update migration expansion, and free-text persistence defects. The
  final atomic save and GM-only clear command both persisted visibly.
- Cleanup cleared both temporary relationship records, including the Nemesis
  point pool and encounter count, restored TyfTester's Hero Points to zero,
  restored the OpenD6 preset, and returned both temporary modules to off. The
  accepted manual capture is `assets/manual/superheroic-relationships.png`.
- The final browser log contained no D6 System Second Edition warning or error.
  The dedicated development restart recovered only a confirmed-empty options
  lock; local `/dev/join` returned HTTP 200 and public `/dev/game` returned the
  expected HTTP 302 redirect to `/dev/join`.
- The complete repository gate passed formatting, lint, typecheck, 154 test
  files / 717 tests, both production bundles, content and manual verification,
  package invariants, and the schema-37 generated-bundle lifecycle smoke. The
  rebuilt manual contains 14 pages and 42 screenshots.

### Second Edition Superheroic Templates — 2026-08-03

- D62e printed pp. 238–239 (physical PDF pages 239–240) were extracted,
  rendered, and visually inspected. OpenD6 Next's complete template document,
  Item editor, compendium, registration, sheet, localization, permission, and
  test paths were traced; it still supplies no complete apply transaction.
- The optional template extension requires the exact Charm/15D Attribute,
  superhero Skills/8D assignable Skill, and Superpowers/10D campaign profile.
  It references existing lawful feature-catalog definitions by stable ID,
  validates ranks, focus, prerequisites, conflicts, prior allocation, and the
  exact cost, and displays every resulting Superpower in the preview.
- One protected batch creates all equipment and Superpower Talents. The final
  Actor update records schema-38 family/budget/definition provenance; any
  failure removes every Item created by that attempt. The public template and
  feature catalogs remain empty of protected names, lists, prose, examples,
  art, and tables.
- Focused automated QA passed the template and feature registries/services/UI,
  settings catalog, public API, schema migrations, and partial-update boundary.
- Build 365 GM QA visibly previewed the lawful test contribution with Charm,
  five Attribute replacements totaling 15D, 8D assignable Skills, and two
  starting Superpowers totaling exactly 10D. Applying it created both Talent
  Items atomically. A full reload retained the template label/source,
  `Superheroic template · 10D Starting Superpowers`, every Attribute, and the
  4D plus 6D Superpower Items.
- A distinct TyfTester credential retained ownership and the same result after
  reload, with no GM Quickbar and no template-apply control. The GM settings
  inventory visibly reported `AVAILABLE · BUILT IN`, pp. 238–239, and the
  Additional Attributes, Superheroic Skills, and Superpowers dependencies.
- Live reload found and closed two provenance defects: complete template
  defaults could be injected into partial Actor deltas, and the schema-25
  normalizer did not preserve fields added by schema 38. Both now have explicit
  regression tests. Cleanup removed all QA Actors/Macros and restored the prior
  settings. D62e browser diagnostics were clean; one external Token Action HUD
  Core missing-partial render error appeared on the final GM reload.
- The complete gate passed formatting, lint, typecheck, 156 files / 721 tests,
  both production bundles, 14-page/42-screenshot manual verification, content
  packs, invariants, and the generated schema-38 lifecycle smoke.
