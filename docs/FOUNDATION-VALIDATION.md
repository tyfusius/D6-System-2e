# Foundation validation

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

## Not yet claimed

- The grouped settings bundle and both edition menus load in Build 365. The
  Second Edition application has open/save/reopen, responsive-layout, and full
  reload coverage. The OpenD6 submenu has a narrow-layout observation but still
  needs an application-only narrow resize plus changed-value save/reopen/reload.
  After Token Action HUD activation, the Settings tab focused but did not reveal
  its sidebar panel even though other tabs switched and the console stayed
  clean; isolate that host interaction before continuing the settings matrix.
- A simultaneous TyfTester/GM Double Down submission accepted exactly one
  authoritative retry, synchronized the used state, and discarded the losing
  narration. A same-role race from two separate owning player sessions still
  requires a second player credential. Deterministic authority tests cover the
  race, stale claims, cancellation release, and completed-state rejection.
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
