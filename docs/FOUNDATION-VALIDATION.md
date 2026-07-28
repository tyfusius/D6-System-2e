# Foundation validation

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
  `0.1.0-alpha.0`.
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

## Not yet claimed

- The grouped settings bundle registered 41 settings and two edition menus in
  the generated Foundry lifecycle smoke. A live Build 365 setup login succeeded,
  but the development world could not be launched from the constrained
  1280×720 browser viewport during this pass; menu rendering, saving, and
  optional-Attribute projection therefore remain live observations rather than
  claimed passes.
- The live rolls exercised an Advantage and its Hero Point award, but not a
  Complication, repeated explosions, or private visibility. Those branches
  remain deterministically covered and still need targeted live observation.
- Hero Point reroll single-use behavior, player-to-GM Wild Die routing, and
  external integrations still require targeted live checks or implementation.
- The public Actor read model is covered by deterministic projection/API tests,
  but its macro/HUD-facing use has not yet been exercised from a live module.
- The temporary live world and its test documents are development fixtures, not
  distributable content.
