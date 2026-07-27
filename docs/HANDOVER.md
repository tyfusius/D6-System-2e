# Current handover

Updated: 2026-07-27

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
  it began at 12/36 Attribute pips and 0/21 Skill pips, whole-die controls
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
- D6 values use canonical integer pip scores. Three pips equal one die, and skill
  totals add the linked attribute score to the stored skill increase before
  formatting.
- Schema 2 adds persisted character sheet mode; schema 3 replaces the incorrect
  provisional `{dice, pips}` storage with canonical pip scores.
- Schema 4 adds latent Character Point and Fate Point fields so profile switching
  preserves both editions' currencies.
- A master OpenD6 preset and seven independent First Edition switches resolve to
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
- Second Edition Advance mode remains visibly blocked because the rulebook
  presents multiple advancement modules and no authoritative campaign choice
  has been made.
- Companion theme registration updates the shared world/user theme choices
  live. Removing the owner removes the choice and rendering falls back to
  OpenD6 Classic without deleting the stored module-owned ID.
- Public API v1 now exposes `roll.attribute` and `roll.skill` plus the working
  `roll.check`, `roll.attribute`, and `roll.skill` capabilities.
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
  editing verified `10 → 3D+1`, `11 → 3D+2`, and `12 → 4D`, followed by a clean,
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

1. Exercise player permissions, interactive resizing, and narrow layout in the
   dedicated Build 365 world.
2. Target the remaining live Complication, repeated-explosion, and private
   visibility branches in Build 365.
3. Implement the verified contextual Advanced Skill augmentation workflow once
   the roll request has an explicit task-context selector.
4. Exercise the Actor read model and campaign profile through a live macro/module fixture for the
   future HUD.
5. Perform and record the full Build 365 GM/player vertical-slice matrix,
   including reroll single-use behavior and Stunned prevention.
6. Populate the ignored private description source only from lawfully held
   material, then generate and live-test the separate private content companion.

## Blockers before later phases

- Publisher/trademark/distribution permission.
- Page 33 errata or explicit table ruling.
- Minimum dice pool after penalties.
- Confirmation or errata for the provisional complete-pip-score interpretation
  of Hero Point Die Code doubling (ADR 0007).
- Initial optional module support profile.
