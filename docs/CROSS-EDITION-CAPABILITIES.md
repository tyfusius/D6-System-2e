# Cross-edition capability matrix

Updated: 2026-07-27

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

| Capability ID     | Second Edition strategy                   | OpenD6 strategy                     | Current OpenD6 state | Custom-profile rule |
| ----------------- | ----------------------------------------- | ----------------------------------- | -------------------- | ------------------- |
| success-evaluator | Result strictly exceeds difficulty        | Result meets or exceeds difficulty  | active               | Independent switch  |
| wild-die          | Advantage/Complication                    | Exploding six/critical-one strategy | active               | Independent switch  |
| meta-currency     | Hero Points                               | Character Points and Fate Points    | active               | Independent switch  |
| defenses          | Static defenses                           | Active defense scheduler            | planned              | Independent switch  |
| damage            | Manual Second Edition condition track     | OpenD6 wounds or Body Points        | planned              | Independent switch  |
| advancement       | Authoritative module not selected         | Character Point advancement         | active               | Independent switch  |
| attributes        | Versioned Second Edition campaign profile | Six-Attribute OpenD6 profile        | active               | Independent switch  |
| advanced-skills   | Standalone/contextual pp. 96–97 behavior  | Stored inactive by default          | inactive-preserved   | Explicit extension  |

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

## Acceptance rule for later features

A feature is not complete until deterministic tests cover native Second Edition,
complete OpenD6, and materially distinct custom behavior. Live checks are added
when Foundry permissions, settings, persistence, or UI are involved.
