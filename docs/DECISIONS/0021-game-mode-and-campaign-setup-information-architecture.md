# ADR 0021: Game System Mode and settings information architecture

Status: Accepted; root Game System Mode implemented

Date: 2026-08-03

## Context

The system currently registers 87 root settings and exposes edition-specific
configuration through two ApplicationV2 menus. The underlying ownership and
cross-edition capability model is sound, but the Foundry root category presents
too many implementation-level choices before the Gamemaster can answer the
primary system question: which edition supplies the baseline rules?

The Second Edition workspace also combines ordinary campaign configuration,
the resolved campaign profile, the cross-edition capability matrix, and the
complete printed-rules inventory in one long page. That preserves audit data but
makes routine configuration harder to scan.

## Decision

### Terminology

- Use **D6 System Second Edition** and **Open D6 First Edition** as the full
  edition names. Do not use “D6 System Second Edition.”
- Use **D62e** for D6 System Second Edition when an abbreviation is appropriate.
- Use **OD6**, not `OD6`, as the Open D6 abbreviation.
- A cited book title may retain its published styling, such as _D6 System:
  Second Edition_ or _OpenD6 Space_.

### Root Game System Mode

- The system root becomes a concise Game System Mode and shared-preferences
  surface, not an edition-by-edition list of individual rule switches.
- One world-scoped **Game System Mode** selector chooses the baseline ruleset. **D6
  System Second Edition** is the default.
- The selector is one mutually exclusive choice, never two independent
  checkboxes. While D6 System Second Edition is active, its left side is green
  and the inactive Open D6 First Edition side is muted grey. The visual states
  reverse when the mode changes.
- The active edition's **Configure** action enables immediately and the inactive
  edition's action disables immediately. The root Game Settings application
  updates in real time without closing or refreshing.
- Edition-specific controls live only in their edition workspace. They are not
  duplicated in the root list.

### Baseline and cross-edition rules

- Game System Mode identifies the baseline ruleset. A cross-edition option
  modifies that baseline and never silently changes Game System Mode.
- D6 System Second Edition configuration contains any selected Open D6 First
  Edition substitutions. Open D6 First Edition configuration contains any
  selected D6 System Second Edition extensions.
- The existing versioned capability resolver remains authoritative. Stored
  inactive data remains preserved.

### Resolved campaign state

- Every edition workspace begins with a plain-language current-campaign
  summary before long controls. It identifies Game System Mode, active rules
  components, cross-edition substitutions or extensions, dependencies, and
  unresolved warnings.
- Prerequisites appear as concise badges or dependency rows. Where the action is
  safe and explicit, the UI may offer **Enable with prerequisites**. It never
  enables dependencies silently.

### Second Edition workspace

- Separate routine configuration from implementation auditing with clear
  destinations: **Campaign Setup**, **Core Rules**, **Fantasy**, **Science
  Fiction**, **Superheroic**, **Current Profile**, and **Rules Inventory**.
- Preserve the complete 41-entry printed-rules inventory, page references,
  support-state badges, dependency data, and cross-edition capability matrix.
  Navigation changes must not weaken the distinction between available,
  partial, planned, and unavailable behavior.

### Homebrew and controls

- Tyfusius Home Brew is not a third root destination. Open D6 First Edition and
  D6 System Second Edition each own only their matching house-rule controls.
  Stable stored values remain independent and are preserved across mode changes.
  The rules retain their complete system-owned explanations and examples because
  no external rulebook supplies them. Each rule presents title, summary,
  edition, and switch first; **How it works** and **Example** expand beneath it.
- Switches remain close to their labels, expose accessible names and keyboard
  focus, provide adequate target sizes, and make on/off state recognizable
  without color alone. Explanatory copy uses readable text size and line height.
- Replace internal identifiers such as `rules.superpowers.street` with
  user-facing language such as **Superpowers: Street Level · 10D**.
- Navigation uses direct actions such as **Configure** or **Edit settings**, not
  indirect copy such as “Configure module above.”

## Consequences

- ADR 0009's ownership model remains in force, but its root category is now a
  Game System Mode surface rather than a literal display of every registered
  shared or edition switch.
- ADR 0014's capability profile and ADR 0018's complete rules-component catalog
  remain the data authorities behind the new information architecture.
- Stable Foundry setting keys and stored world data do not need to be renamed
  merely because presentation and navigation change.
- The root Game Settings surface now implements Game System Mode,
  immediate Configure-action state, and removal of duplicated edition-specific
  controls from the root list. The manual describes that shipped behavior.
- The next implementation pass is the edition-workspace information
  architecture: resolved summaries first, Second Edition navigation, profile
  and inventory separation, dependency actions, and progressive disclosure.
