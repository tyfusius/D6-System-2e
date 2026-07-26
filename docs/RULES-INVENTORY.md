# Rules inventory

Source key: `D62e` means the supplied _D6 System: Second Edition_, v1.1, using
printed page numbers. Status values are `verified`, `contradictory`, `planned`,
or `deferred`. A concise summary is used instead of reproduced rules text.
`D6S` means the supplied OpenD6 Space rulebook using printed page numbers.

| Rule area                                   | Source                          | Status                  | Automation and owner                                                |
| ------------------------------------------- | ------------------------------- | ----------------------- | ------------------------------------------------------------------- |
| Character attribute budget and limits       | D62e p. 20                      | verified                | Creation validator; Phase 2                                         |
| Core attributes                             | D62e pp. 20, 35                 | verified                | Stable IDs: agility, brawn, knowledge, perception                   |
| Optional attributes                         | D62e pp. 62-68                  | verified                | World module profile; inactive values preserved                     |
| Skill budget and creation limits            | D62e p. 20                      | verified                | Creation validator; Phase 2/3                                       |
| Skill pool defaults to attribute            | D62e pp. 24, 36                 | verified                | Pure pool builder; Phase 2                                          |
| Die codes and modifiers                     | D62e pp. 24-25, 94-95           | verified                | Persistent values use integer pip units; Pips rules remain a module |
| Difficulty success uses strict greater-than | D62e p. 26                      | verified                | Pure evaluator; foundation                                          |
| First Edition meets-or-beats evaluator      | D6S pp. 6, 59                   | verified                | Compatibility strategy; foundation                                  |
| Opposed checks and tie order                | D62e p. 25                      | verified                | Pure evaluator; Phase 2/3                                           |
| Core Wild Die                               | D62e pp. 26-27                  | implemented             | Pure typed choice/explosion state machine; Foundry roll adapter     |
| First Edition classic Wild Die              | D6S pp. 55-56                   | implemented             | Selectable compatibility strategy in the same roll pipeline         |
| Alternate Wild Dice                         | D62e pp. 71-72                  | planned                 | Mutually exclusive world profile strategies                         |
| Core Hero Points                            | D62e pp. 20, 28                 | partial                 | Wild Die awards persist; spending uses remain planned               |
| First Edition Character/Fate Points         | D6S pp. 56-57                   | verified                | Separate preserved resources and compatibility services             |
| First Edition active defenses               | D6S pp. 58-60, 74-76            | planned                 | Compatibility combat strategy                                       |
| First Edition resistance and wounds         | D6S pp. 78-81                   | planned                 | Compatibility damage strategy; no conversion from 2e conditions yet |
| First Edition Character Point advancement   | D6S pp. 52-54                   | planned                 | Compatibility advancement service                                   |
| First Edition Space attribute profile       | D6S pp. 8-12                    | verified                | Six-field active projection; stable 2e storage IDs retained         |
| Hero Point variants                         | D62e pp. 75-76, 207             | planned                 | Profile strategy; no mixed implicit economy                         |
| Doubling Down                               | D62e p. 25                      | verified                | Chat/API follow-up; excluded from combat actions                    |
| Preparing, running, wounds                  | D62e pp. 28-29                  | verified                | Modifier contributors; Phase 3/4                                    |
| Multiple skill uses/actions                 | D62e pp. 29-30                  | verified                | Domain action context; combat ADR pending                           |
| Standard initiative                         | D62e pp. 30-31                  | verified                | Automation shape unresolved; combat ADR                             |
| Alternate initiative                        | D62e pp. 69-70                  | verified                | Mutually exclusive strategies; Phase 4                              |
| Movement and prone                          | D62e p. 32                      | verified                | Phase 4; grid interpretation configurable                           |
| Static Dodge and Parry                      | D62e pp. 21, 33                 | verified                | Derived values, not stored for characters                           |
| Attack resolution                           | D62e p. 33                      | verified                | Typed attack pipeline; Phase 4                                      |
| Damage and mortal-wound trigger             | D62e p. 33                      | contradictory           | Blocked pending errata/table decision                               |
| Staggered/Stunned/Wounded progression       | D62e pp. 33-34                  | partially contradictory | State machine after source decision                                 |
| Brawn resistance exclusions                 | D62e p. 34                      | verified                | Resistance context ignores listed penalties                         |
| Armor bonus dice                            | D62e p. 34 and equipment tables | verified                | Equipped armor contributes to resistance                            |
| Difficulty ladder                           | D62e p. 37                      | verified                | UI aid, never hidden GM authority                                   |
| Core skill descriptions                     | D62e pp. 38-42                  | verified                | Labels/config; distribution license gate                            |
| Chases                                      | D62e pp. 73-74                  | deferred                | Optional module after character slice                               |
| Environments                                | D62e pp. 77-78                  | deferred                | Optional module                                                     |
| Equipment by era                            | D62e pp. 79-85                  | deferred                | Schemas first; content license gate                                 |
| Advancement variants                        | D62e pp. 86-93                  | planned                 | XP, milestone, and narrative profiles are not conflated             |
| No Dodge Defense                            | D62e p. 94                      | deferred                | Optional combat strategy                                            |
| Pips                                        | D62e pp. 94-95                  | planned                 | Storage supported; behavior profile-gated                           |
| Advanced skills and specializations         | D62e pp. 96-100                 | planned                 | Embedded Items and stable references                                |
| Perks, Flaws, and Talents                   | D62e pp. 101-129                | planned                 | Typed feature subtypes                                              |
| Troubles and Assets                         | D62e pp. 130-131                | planned                 | Typed feature subtypes; session counters transient                  |
| Foes and creatures                          | D62e pp. 132-137                | verified                | NPC/creature schemas; creatures permit defense override             |
| Templates                                   | D62e pp. 138-139                | deferred                | Explicit import/apply workflow                                      |
| Fantasy and magic modules                   | D62e pp. 140-171                | deferred                | Registered typed disciplines                                        |
| Starships                                   | D62e pp. 176-180                | verified                | Optional Actor type; Phase 3/4                                      |
| Vehicles                                    | D62e pp. 181-183                | verified                | Optional Actor type; Phase 3/4                                      |
| Psionics                                    | D62e pp. 184-190                | deferred                | Registered typed discipline                                         |
| Cyberpunk                                   | D62e pp. 191-195                | deferred                | Optional module                                                     |
| Scale                                       | D62e pp. 196-197                | deferred                | Pure service after combat base                                      |
| Superhero modules                           | D62e pp. 204-239                | deferred                | Optional genre and discipline services                              |

## Detailed entries for the vertical slice

### Strict difficulty evaluation

- Inputs: final score and difficulty number.
- Output: success only when score is greater.
- Edge cases: equality is failure; non-finite values are invalid.
- State read/write: none.
- Consumers: roll service, chat result, macros, HUD.
- Tests: below, equal, and above difficulty; invalid numbers.

### Skill pool construction

- Inputs: governing attribute die code, skill rating, applicable specialization,
  campaign pips profile, situational modifiers, and action context.
- Output: normalized pool plus an auditable contributor list.
- Edge cases: absent skill uses the attribute; disabled optional attribute remains
  stored but cannot be rolled; penalties approaching zero need a rules decision.
- State read: immutable Actor read model and module profile.
- State write: none.
- Consumers: sheet, API, HUD, roll dialog.
- Tests: trained, untrained, optional attribute unavailable, specialization, and
  modifier ordering.

### Core Wild Die

- Inputs: rolled faces, provisional success, difficulty/opposition context, and
  authorized chooser.
- Output: a pending choice or final typed result, plus proposed Hero Point award.
- Edge cases: hidden GM rolls, no player owner, repeated sixes, cancellation,
  duplicate prompt response, and opposed ties.
- State read: Actor ownership and Hero Point value.
- State write: Hero Point award only after one accepted resolution.
- Consumers: roll dialog, chat card, API.
- Tests: ordinary faces, successful/failing six, successful/failing one, repeated
  sixes, cancellation, and idempotent response.

## Authoritative questions

1. Obtain publisher errata for page 33: does mortal wounding depend on the damage
   roll's Complication or the defender's Brawn Wild Die showing `1`?
2. Confirm page 33's `Brawn > Damage` result is Staggered, not Stunned as its example says.
3. Confirm how Hero Point "double the Die Code" treats pips when the optional pips
   module is active.
4. Define the minimum roll when penalties reduce a pool below 1D while the Wild Die
   must still be present.
5. Decide whether the page 21 suggestion to reduce the defense multiplier is exposed
   as a supported campaign profile option.
6. Decide which initiative, Wild Die, advancement, and Hero Point modules are the
   first supported campaign profile. Core defaults are recommended.
7. Confirm whether Hero Point use on page 28 only prevents becoming Stunned. The
   implementation will not allow removal of an existing condition without authority.
8. Decide how private/GM rolls route player Advantage choices without revealing
   hidden totals.
9. Confirm whether publisher permission permits distributing the core skill labels,
   item names, and any starter content.
10. Determine whether later official errata supersedes the supplied v1.1 PDF.

## Sheet-only implementation notes

The sheet now formats canonical integer pip scores in the familiar `xD+y` form and
exposes a GM-only Free Edit mode. The internal pip unit does not silently enable
the optional Pips module; it provides one lossless arithmetic foundation for
module-off whole-die scores and module-on `+1`/`+2` scores. Advance mode
intentionally does not calculate or spend costs: Experience Points (pp. 86-88),
Milestone Advancement (pp. 90-91), and Narrative Advancement (pp. 92-93) require
different application services.

## Basic roll implementation notes

Attribute and standard-skill rolls now use one pipeline from sheet and public API
through application orchestration to pure domain resolution. The roll builder
accepts an optional difficulty, flat result modifier, and Foundry roll mode.
Physical dice are rolled by the Foundry adapter; all totals, success evaluation,
Wild Die decisions, and awards are resolved from typed values in the core.

Without a difficulty, a Second Edition `6` or `1` is reported as an unresolved
Advantage or Complication and does not award Hero Points. This avoids guessing
whether the underlying action succeeded. Opposed checks and adding a difficulty
to an existing unopposed result remain planned follow-ups.
