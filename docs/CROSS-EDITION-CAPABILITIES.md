# Cross-edition capability matrix

Updated: 2026-07-28

Every rules feature must resolve independently for Second Edition, the complete
OpenD6 preset, and a custom mixed profile. A system title or one unrelated
compatibility switch is not a rules decision.

## Required classification

Each capability is classified as one of:

- **active**: the selected strategy is implemented and may own automation;
- **inactive-preserved**: data remains stored and editable through authorized
  boundaries, but it does not affect resolution;
- **planned**: the profile selects that rules family, but authoritative
  automation is not complete and the UI must say so.

An implementation pass must record its stable capability ID, rules owner,
strategy, state, source evidence, persistent-data treatment, UI behavior, public
API behavior, and tests in every affected profile.

## Current resolved families

| Capability ID      | Second Edition strategy                   | OpenD6 strategy                     | Current OpenD6 state | Custom-profile rule                      |
| ------------------ | ----------------------------------------- | ----------------------------------- | -------------------- | ---------------------------------------- |
| action-economy     | Declared actions and fixed round penalty  | Flexible action allotment           | active               | Combat strategy                          |
| success-evaluator  | Result strictly exceeds difficulty        | Result meets or exceeds difficulty  | active               | Independent switch                       |
| wild-die           | Core, Basic, Classic, or Simple           | Exploding six/critical-one strategy | active               | Alternate selector applies only to 2e    |
| meta-currency      | Hero Points                               | Character Points and Fate Points    | active               | Independent switch                       |
| movement           | Declared movement segments                | Relative/free-half-Move strategy    | active               | Independent switch                       |
| defenses           | Static defenses                           | Active defense scheduler            | active               | Independent switch                       |
| damage             | Manual Second Edition condition track     | OpenD6 wounds or Body Points        | planned              | Independent switch                       |
| advancement        | Authoritative module not selected         | Character Point advancement         | active               | Independent switch                       |
| attributes         | Versioned Second Edition campaign profile | Six-Attribute OpenD6 profile        | active               | Independent switch                       |
| pips               | Whole dice or optional Module: Pips       | Classic +1/+2 progression           | active               | Independent switch                       |
| advanced-skills    | Standalone/contextual pp. 96–97 behavior  | Stored inactive by default          | inactive-preserved   | Explicit extension                       |
| ranked-features    | Module: Perks, Flaws & Talents            | Stored inactive                     | inactive-preserved   | Explicit native module                   |
| narrative-features | Module: Troubles & Assets                 | Stored inactive                     | inactive-preserved   | Explicit native module                   |
| retries            | One narrated Doubling Down retry          | No general Doubling Down action     | active               | Independent switch                       |
| combined-actions   | Source decision required                  | Source decision required            | planned              | Independent switch after rules inventory |

Action economy, movement, and active defenses resolve through separate
compatibility switches. The Second Edition action-segment UI is inactive when
OpenD6 flexible action allotment is selected. OpenD6 Space printed p. 58 permits
decisions later in the round and therefore must not reuse the stricter Second
Edition declaration lock. Its count-only Combatant commitment stores total,
allotment, defense mode, and spent count without requiring exact actions. A
pre-turn Partial Defense can be recorded as already spent so the complete MAP
applies immediately. Full Defense is exclusive and penalty-free. Active-defense
roll selection is owned by the separate `defenses` capability. Typed Dodge,
Block, and Parry rolls persist the active difficulty; Partial Defense uses
tracked MAP and Full Defense ignores MAP and adds +10 automatically.

The independent First Edition movement strategy reads migrated base Move,
treats up to half the relevant rate as free, applies type-specific rates and
difficulties, enforces the four-rate cap, and spends a tracked action only when
a count-only commitment exists. Verbal/manual declarations remain valid.

The action-declaration assistance setting is not a fourth rules strategy. It
selects Optional, Enforced, or Manual Foundry workflow on top of the resolved
edition. The typed roll planner keeps tracked MAP, manual MAP, movement, and
Condition penalties separate and rejects a final pool below 1D.

The retry family is separate from Hero Point rerolls. Native Second Edition may
offer one narrated Doubling Down attempt after an eligible failed non-combat
Attribute or Skill roll. The complete OpenD6 preset disables that action because
the First Edition source has no equivalent general retry rule.

## Pips decision

Canonical pip-unit storage remains lossless in every profile. Core Second
Edition resolves each Attribute, Skill increase, damage score, and resistance
score to whole dice before combining values. **Module: Pips** restores the
stored `+1/+2` remainders. The complete OpenD6 preset activates the separate
classic-Pips compatibility switch. Disabling either behavior never rewrites
Actor or Item data.

## Advanced Skill decision

The Second Edition Advanced Skill module is not silently reinterpreted as an
OpenD6 rule:

- Second Edition module off: Advanced Skill data is preserved but inactive.
- Second Edition module on under a Second Edition Attribute profile: standalone
  and contextual behavior is active.
- Complete OpenD6 preset: Advanced Skill data is preserved but inactive.
- OpenD6 plus **Allow Second Edition Advanced Skills**: the Second Edition
  standalone/contextual behavior is deliberately enabled as an optional
  cross-edition extension.
- A custom profile that changes an unrelated family, such as only the success
  evaluator, leaves the active Second Edition Advanced Skill module unchanged.

Inactive Advanced Skills are projected as non-rollable by the public Actor read
model and character sheet. Direct API attempts are rejected with a localized
explanation. No data is deleted when the capability changes.

## Character feature document decision

Schema 11 admits native Second Edition Perks, Flaws, Talents, Troubles, and
Assets as distinct documents. It does not silently rename OpenD6 Advantages,
Disadvantages, or Special Abilities.

- Native Second Edition: Perk/Flaw/Talent and Trouble/Asset capabilities become
  active independently when their corresponding modules are selected.
- Complete OpenD6: native Second Edition feature data remains
  inactive-preserved; existing OpenD6 feature families remain distinct.
- Custom profile: an unrelated mixed-edition switch never activates feature
  effects; explicit module settings and the native Attribute strategy own the
  choice.

The ranked-feature capability applies creation accounting. The
narrative-feature capability owns Hero Point/+3D/Complication commands,
revisioned per-session counters, and GM reset authority. Named bespoke feature
effects remain unadvertised until source-mapped typed services exist.

## Acceptance rule for later features

A feature is not complete until deterministic tests cover native Second Edition,
complete OpenD6, and materially distinct custom behavior. Live checks are added
when Foundry permissions, settings, persistence, or UI are involved.
