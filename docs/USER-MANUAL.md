# D6 System Second Edition User Manual

This manual describes the functionality currently available in the
**D6 System Second Edition** system for Foundry Virtual Tabletop v14. It is a
living manual: implemented workflows are documented here in the same change
that introduces or changes them.

> **Rules and licensing:** This manual explains how to operate the VTT. It uses
> concise rules summaries and printed-page references rather than reproducing
> rulebook prose. `D62e` refers to _D6 System: Second Edition_ v1.1. `D6S`
> refers to the supplied _OpenD6 Space_ rulebook.

## 1. Getting Started

### Choose the campaign rules before creating characters

The system can run native Second Edition rules, the complete OpenD6
compatibility preset, or a deliberate custom mixture. A Gamemaster should make
that choice before creating the campaign's permanent Actors.

1. Open **Settings** in Foundry's right sidebar.
2. Select **Game Settings**.
3. Select **D6 System Second Edition**.
4. Use **D6 System 2nd Edition** for native modules or **OpenD6 First Edition**
   for the compatibility profile.
5. Review the resolved capability matrix before saving.

The selected profile changes rules behavior; it is not merely a visual label.
Inactive data is preserved so a campaign can change profiles without silently
deleting stored pips, resources, or optional Attribute values.

![System settings showing the two edition configuration areas.](../assets/manual/game-settings.png)

### Create an Actor

Open the **Actors** sidebar and select **Create Actor**. The supported Actor
families currently include Character, NPC, Creature, Vehicle, and Starship.
Character is the complete player-facing vertical slice. NPC and Creature use
the character foundation, while Vehicle and Starship have dedicated
Second Edition sheets.

New native Second Edition Characters enter the character-creation workflow.
Existing or imported Actors do not enter creation automatically.

### The default character sheet

The sheet uses the OpenD6 Classic charcoal-and-gold theme and the same task
structure as OpenD6 Next. Its main workspaces are:

- **Attributes & Skills**
- **Biography**
- **Traits & Equipment**
- **Combat**

The header shows the active edition presentation, rules-owned resources, and
the current Condition. Its diffuse background wordmark follows the resolved
rules profile live: **D62e** for native Second Edition and custom profiles, or
**OPEN D6** for the complete OpenD6 compatibility profile. Move the pointer over
the portrait—or focus it with the keyboard—to reveal the OpenD6 animated scan,
glow, and reticle treatment. Owners and Gamemasters can activate the portrait
to choose a new image.

## 2. Campaign Profiles and Editions

### Native Second Edition

Core Second Edition uses Agility, Brawn, Knowledge, and Perception. Optional
Attributes and Skill modules are selected in the Second Edition configuration.
The resolved campaign profile is the single source used by new Actors, sheet
presentation, Skill synchronization, Item selectors, rolls, and the public API.

![Second Edition campaign profile, capability matrix, and module settings.](../assets/manual/second-edition-settings.png)

Core Second Edition uses whole-die Attribute and Skill progression. Enable
**Module: Pips** to use `+1` and `+2` steps, split dice during creation, and
sequential pip advancement. See D62e pp. 94–95.

### OpenD6 First Edition compatibility

Enable the master **Use OpenD6 rules** option to activate the complete
compatibility preset. It synchronizes the supported First Edition behaviors,
including:

- meets-or-beats difficulty evaluation;
- the classic Wild Die-one strategy;
- Character Points and Fate Points;
- Character Point advancement;
- classic pip progression; and
- the OpenD6 Attribute profile.

Individual First Edition options may be changed after enabling the preset. Any
such change produces an explicit custom profile rather than silently claiming
to be complete OpenD6.

First Edition flexible action allotment, active defenses, resistance, and the
full wound strategy remain planned. The Second Edition implementations do not
remain active under an incompatible First Edition strategy merely to fill the
gap.

### Custom profiles

A custom profile is supported, but the Gamemaster owns the resulting campaign
design. The capability matrix reports each rules family as active, preserved
but inactive, or planned. Review it after every rules-setting change.

## 3. Character Sheet and Modes

![Character sheet in Normal mode.](../assets/manual/character-sheet-normal.png)

### Normal mode

Normal mode is the everyday play view. Mechanical Attribute and Skill scores
are read-only. Players roll by selecting an Attribute or Skill name/die code;
they cannot directly type pip values or create arbitrary mechanical entries.

Rules-owned resources may be changed only through the workflows and permissions
appropriate to that resource. A Gamemaster may make authorized corrections.

### Advance mode

Advance mode shows improvement actions for the campaign's selected advancement
strategy. It never becomes a hidden direct editor.

![Character sheet in Advance mode.](../assets/manual/character-sheet-advance.png)

If the campaign has no automated advancement strategy selected, the controls
remain disabled and explain what the Gamemaster must configure. This is
intentional protection against spending an invented currency or applying the
wrong edition's costs.

### Free Edit mode

Free Edit is available only to a Gamemaster. It exposes canonical stored scores
and Item-management controls for setup, correction, migration review, and
testing. It is not a player advancement mechanism.

### Sheet header controls

The three upper-right controls use Foundry's ApplicationV2 conventions:

- toggle additional window controls;
- copy the document UUID; and
- close the sheet.

UUIDs are useful for macros and integration testing. Modules should still use
the system's versioned public API rather than private sheet fields.

## 4. Character Creation

New native Second Edition Characters begin in a protected creation state. The
sheet displays remaining budgets, permitted increments, and validation results.

The implemented core audit follows D62e p. 20:

- 12D Attribute budget;
- 1D minimum and 5D creation maximum per Attribute;
- 7D Skill budget;
- 2D creation maximum per Skill; and
- explicit additions for configured optional Skill modules.

Without Module: Pips, creation controls move in whole dice. With the module,
they move in pips and enforce the printed split-die limits from D62e pp. 94–95.

Select **Finalize Character** only after the audit is valid. Finalization ends
the protected creation workflow and cannot be used as an ordinary editing
toggle.

### Advanced Skills and Specializations

When **Skill Specialization & Advanced Skills** is enabled:

- an Advanced Skill stores stable prerequisite Skill keys;
- its prerequisite pools must satisfy the configured validation;
- it rolls its own rating when used directly;
- one valid Advanced Skill may be explicitly applied as context to a related
  standard Skill task; and
- a Specialization links to a parent Skill and supplies its fixed bonus.

The creation and roll behavior is sourced to D62e pp. 96–100. Advanced Skills
are preserved but inactive in complete OpenD6 mode unless the Gamemaster
explicitly enables the Second Edition extension.

## 5. Rolls, Wild Die, and Chat Cards

Select an Attribute, Skill, Specialization, weapon Attack, weapon Damage, or
resistance control to use the shared typed roll pipeline. Sheets, Items, future
HUD adapters, and macros should all delegate to this same service.

![Shared roll builder.](../assets/manual/roll-builder.png)

### Roll builder

The roll builder can present:

- the final effective Die Code;
- Hero Point spending when applicable;
- an optional difficulty;
- a flat result modifier;
- public, private-GM, blind-GM, or self-only visibility;
- an opposed completed score;
- participant types and tie information;
- valid Advanced Skill task context; and
- the current multiple-action penalty.

The Gamemaster can hide difficulty, modifier, or opposed-roll controls in the
root system settings.

### Difficulty and opposed checks

Native Second Edition succeeds only when the total exceeds the difficulty
(D62e p. 26). Complete OpenD6 compatibility succeeds when the total meets or
exceeds it (D6S pp. 6, 59).

Opposed checks compare completed scores. The implemented tie order is sourced
to D62e p. 25. When the rule still requires table judgment, the result remains
explicitly unresolved instead of inventing a winner.

### Wild Die

Native Second Edition uses the Advantage and Complication workflow from D62e
pp. 26–27. The system presents required choices and repeated explosions as
structured state. Complete OpenD6 compatibility uses the verified classic
Wild Die-one strategy from D6S pp. 55–56.

Player-owned choices remain on the rolling client. When a successful native
Second Edition roll produces a Wild Die 1, the player waits while an active
Gamemaster receives the same themed **Partial / Failure** decision window. The
roll continues only with that GM response. If no Gamemaster is online, the
system reports that the decision is unavailable and does not silently choose an
outcome.

![Gamemaster resolution of a player's successful Wild Die 1.](../assets/manual/gm-wild-die-decision.png)

An unopposed roll without a difficulty can report an Advantage or Complication,
but it cannot infer whether the underlying action succeeded.

### Hero Points

Second Edition Hero Points can:

- double the complete Die Code before a roll;
- reroll an eligible failed evaluated roll;
- prevent a proposed transition to Stunned; and
- be awarded by supported resolved outcomes.

These behaviors use owner-checked transactions and are sourced to D62e
pp. 20, 28. Automatic bookkeeping can be disabled for manual campaigns.

### Doubling Down

Eligible failed, non-combat Attribute and Skill rolls offer **Double Down**.
The retry preserves the effective Die Code and requires narration. It is
single-use and mutually exclusive with the failed-roll Hero Point reroll. See
D62e p. 25.

The first eligible owner to activate either follow-up obtains a
Gamemaster-authorized claim on the original chat card. This prevents two
connected owners from rerolling the same result or spending the same opportunity
twice. Cancelling or failing the follow-up releases the claim; a completed
follow-up disables both alternatives for everyone.

### Chat cards

![Cinematic structured roll card.](../assets/manual/chat-card.png)

Chat cards retain the typed result in system flags; they never parse visible
prose to reconstruct rules state. Their visual language is:

- cube: generic roll result;
- burst: Wild Die or exceptional outcome;
- lightning bolt: Hero Point expenditure or award;
- graduation cap: Advanced Skill context;
- stacked layers: action-economy context; and
- circular arrows: reroll or Doubling Down.

Older messages retain the HTML and icons rendered by the system version that
created them.

### Dice So Nice

Dice So Nice is optional. When present, the system registers a dedicated
`dw` Wild Die preset using the OpenD6 Classic black-and-gold presentation.
The Wild Die is therefore physically distinct from the ordinary d6 dice while
remaining part of the same typed roll result. Dice appearance never changes
the Wild Die rules or numerical resolution.

## 6. Advancement

Select **Advance** on the character sheet. The available workflow depends on
the resolved advancement capability.

### Second Edition Experience Points

When **Experience Points** is selected, Attribute, standard Skill, and Advanced
Skill improvements use protected Experience Point transactions. Costs and
prerequisite validation follow D62e pp. 86–88 and p. 97.

Core progression purchases a whole die. Module: Pips instead requires the
sequential `+1`, `+2`, then next-die progression described on D62e pp. 94–95.
A Gamemaster can award or correct Experience Points from the header; players
spend them only through Advance mode.

Specializations do not receive repeated Experience Point improvements. Their
creation and fixed bonus are a separate workflow (D62e p. 99).

### Milestone and Narrative profiles

Milestone Advancement (D62e pp. 90–91) and Narrative Advancement (D62e
pp. 92–93) are selectable, preserved strategies but do not yet automate grants
or narrative arcs. Their controls remain explanatory until each receives its
own state model.

### OpenD6 Character Points

In the OpenD6 advancement strategy, Advance mode calculates Character Point
costs and affordability for Attributes, Skills, and Specializations. Purchases
are owner-checked, deduct the resource transactionally, and roll back a failed
embedded-Item update. See D6S pp. 52–54.

Changing edition strategies never converts Experience Points into Character
Points or deletes either stored balance.

## 7. Traits, Equipment, and Item Sheets

The **Traits & Equipment** tab groups embedded Items by player task rather than
raw database type. Current typed Item families include:

- Skills and Specializations;
- native Second Edition Perks, Flaws, Talents, Troubles, and Assets;
- Advantages and Disadvantages;
- Special Abilities;
- Weapons, Armor, and Gear;
- Actions and manifestations;
- character and species templates;
- cybernetics;
- vehicles, vehicle gear, and starship gear/weapons; and
- compatibility-oriented Item groups.

The canonical ApplicationV2 Item sheet shows only fields supported by the
Item's type. A Skill Item displays its Attribute, rating, training type, source
citation, and prerequisite/parent relationships where applicable.

Native Second Edition feature Items follow D62e pp. 101-131:

- Perks and Flaws record rank plus a campaign-defined focus or scope.
- Talents also record their printed creation cost in Skill dice and whether the
  Talent may be purchased repeatedly.
- Troubles and Assets record the narrative trigger the player may invoke.

Enable **Module: Perks, Flaws & Talents** to include these Items in the Skill
creation budget. Perks cost one Skill die per rank, Flaws grant one Skill die per
rank, and Talents use their stored printed Skill-dice cost.

Enable **Module: Troubles & Assets** to show invocation controls. Each Trouble
or Asset can be used twice per session. Trouble grants one Hero Point and posts
the immediate Complication requirement. Asset grants either one Hero Point or
+3D to the Attribute or Skill roll selected by the player. Only a GM can reset
the session counters. Existing OpenD6 Advantages, Disadvantages, and Special
Abilities remain separate and are never renamed automatically.

![A native Second Edition Perk in the canonical Item sheet.](../assets/manual/character-feature-item-sheet.png)

Descriptions are never interpreted as executable rules. Named Perk, Flaw, and
Talent prerequisites and modifiers appear only after a source-mapped typed
system implementation exists.

The public Skill packs intentionally contain stable IDs, names, Attribute
links, module IDs, and printed-page references—but no protected descriptive
prose. A private content companion may add descriptions without making the
generic system depend on private material.

Drag and drop is an enhancement. The visible add and edit controls remain the
discoverable alternative.

## 8. Combat and Conditions

![Character Combat workspace.](../assets/manual/character-sheet-combat.png)

### Action segments

Native Second Edition Combatants can declare an ordered action list for the
round. The system stores versioned Combatant state, applies one die of penalty
for each declared action after the first, and requires completion in order.
See D62e pp. 29–31.

Owners may reset before resolution. After the first action completes, correction
is restricted to the Gamemaster. Attribute, Skill, resistance, and weapon
Attack rolls consume the same resolved penalty context.

Complete OpenD6 mode does not reuse this scheduler. Its flexible action
allotment from D6S p. 58 remains a separate planned capability.

### Static defenses

The Combat tab derives:

- Dodge from full Perception dice; and
- Parry from full Agility dice.

These are derived presentation values, not stored character scores. See D62e
pp. 21, 33.

### Condition track

The persisted Second Edition track includes Healthy, Staggered, Stunned,
Wounded, Incapacitated, Mortally Wounded, and Dead. Selecting a state updates
the header and Combat tab using the same semantic colors.

When an eligible transition would make the Actor Stunned, the system offers the
verified Hero Point prevention choice from D62e p. 28. It prevents that proposed
transition; it is not a recovery action for an Actor already Stunned.

Damage-versus-resistance automation remains blocked because the supplied text
on D62e p. 33 contains material contradictions. Weapon Attack, Damage, armor,
resistance rolls, and manual Condition control remain available without
pretending that unresolved damage automation is authoritative.

### Weapons and armor

The Combat loadout can create, equip, edit, and roll Weapons and Armor.
Weapon Attack and Damage and Actor resistance use the shared roll pipeline.
Armor contributes its supported resistance value when equipped.

## 9. Game Settings

Root system settings contain options useful in either edition:

- world and personal theme;
- default roll visibility and difficulty;
- visibility of difficulty, modifier, and opposed-roll controls;
- visibility of Advantages and Disadvantages; and
- visibility of Specializations.

The **D6 System 2nd Edition** submenu is organized like the rulebook's campaign
worksheet. Each configurable card identifies whether it is core setup or an
optional module and shows the relevant printed pages:

- **Core campaign setup** (D62e pp. 20, 28) contains the additional
  Skill-module count, starting Hero Points, and automatic bookkeeping.
- **Module: Additional Attributes** (pp. 62-68) contains Charm, Mechanical,
  Technical, Mysticism, and Magic.
- **Advancement modules** (pp. 86-93) selects no more than one of Experience
  Points, Milestone Character Advancement, or Narrative Advancement.
- **Module: Pips** (pp. 94-95) enables `+1` and `+2` Die Code steps.
- **Module: Skill Specializations & Advanced Skills** (pp. 96-100) enables the
  supported granular Skill structures.

Only implemented modules have controls. A missing module is backlog, not an
inactive checkbox that silently does nothing. The resolved campaign profile and
cross-edition capability matrix below the module cards show what the system will
actually apply.

The **OpenD6 First Edition** submenu owns the complete preset and independent
compatibility switches. Settings that affect only one edition do not appear as
ambiguous root toggles.

After changing a campaign-level rules option, reopen relevant sheets and review
the capability matrix. Some Foundry settings may require a reload; the settings
application reports this when applicable.

## 10. Compendiums and Content

The system currently ships citation-only Skill packs for:

- D6 System: Second Edition; and
- OpenD6 compatibility.

New characters receive the catalog for the active profile. A Gamemaster can use
**Sync Rules Skills** to add missing active-profile Skills to an existing
character. Synchronization preserves existing embedded Items.

The **D6 System Second Edition — User Manual** compendium contains this manual
as a Journal with one page per chapter. Open it directly from Compendium Packs
or import it into a world if you want a world-owned copy.

Public content must remain legally distributable. Setting-specific terminology,
art, themes, and content belong in independently licensed companion modules.

## 11. Permissions, Macros, and Integrations

### GM Quickbar

Enable **Show GM Quickbar** in the root system settings to open a compact
Actor workspace using the same component design and interaction hierarchy as
OpenD6 Next. This window and its Token Controls toolbar button are available
only to Gamemasters. It shows accessible player characters, NPCs, and creatures;
future GM quick-access categories may join the same workspace. Player Characters
and NPCs have separate collapsible sections. Use **Manage characters** to restore
a removed Actor; pin frequently used Actors, collapse the whole panel, or expand
an Actor and its Attributes to reach Skills. Every score is displayed as a Die
Code. Select one to use the same typed roll pipeline as the character sheet, or
open the Actor directly from the card. While a roll is resolving, the selected
control is temporarily locked to prevent duplicate rolls and overlapping 3D
animations.

Gamemasters also see a broadcast control beside each Attribute and Skill. It
opens the OpenD6-style **Request Roll** window before anything is sent. Choose
the owning player when several are online, then choose exactly one audience:

- **Public:** everyone sees the roll.
- **Player + GM:** only the selected player and Gamemasters see the roll.
- **GM Only (Blind):** only Gamemasters see the result; the player performs a
  blind roll.

The receiving player then gets the ordinary themed system roll builder with the
GM request identified and the selected visibility locked. The player retains
control of difficulty, modifiers, opposition, and permitted resources, but
cannot override the GM's audience choice. When no eligible owner is online, the
broadcast controls are disabled and visibly muted; their tooltip explains why
the request is unavailable. Requests are versioned, acknowledge delivery, expire
after five minutes, and are accepted only when they come from an active GM to an
owning non-GM player. Request delivery is registered after Foundry's client
socket is ready, and the system manifest enables that channel. If the player
client does not acknowledge delivery, Active Tasks marks the request for
Gamemaster takeover instead of silently waiting forever. A second request for
the same Actor score is rejected while the first remains pending.

### Active Tasks & Requests

Gamemasters can enable **Show Active Tasks & Requests** in the root settings.
The panel lists outstanding GM Quickbar requests, the responsible player, and
their online status, failure state, and remaining lifetime. A request is
registered before delivery and disappears after the player rolls or cancels.
The queue is transient: closing the panel does not clear it, while reloading the
world deliberately does not replay unanswered decisions.

A Gamemaster may cancel a waiting request at any time. Cancellation is delivered
to the assigned player and closes that player's open roll builder without
creating chat, spending resources, or completing an action. **Take Over** remains
disabled while the assigned player is online. If that player disconnects or
delivery fails, Take Over first aborts the remote prompt and then opens the same
current Actor roll locally for the GM. The first completed path wins, preventing
the old player prompt and GM takeover from both resolving. Unanswered requests
expire and clean themselves up after five minutes.

Both quickbars are GM-only, per-user display preferences. Turning either setting
off closes that panel immediately without changing campaign data and removes
its button from the Token Controls toolbar. While enabled, each quickbar has a
toolbar button using the same icon as its window. Use that button to close,
reopen, or recover a quickbar after closing it with the window control.

All system interfaces use OpenD6 Next as their canonical design baseline:
typography, window treatment, spacing, controls, focus states, empty states,
roll presentation, and responsive behavior should feel like the same product.
Edition-specific differences describe rules and available data, not a separate
or simplified UI theme.

![GM Quickbar and Active Tasks & Requests in the development world.](../assets/manual/quickbars.png)

Players can use owned Actors, roll, advance through the selected protected
workflow, and update permitted narrative fields. They cannot:

- enter Free Edit;
- directly write mechanical pip scores in Normal mode;
- bypass advancement transactions;
- create protected embedded mechanical Items outside supported workflows; or
- directly correct authoritative combat state after resolution begins.

The Gamemaster can use Free Edit, synchronize catalogs, correct resources,
manage campaign settings, and perform the documented combat corrections.

The system exposes a versioned public API through `game.system.api`. Supported
capabilities include Actor read models, rolls and follow-ups, advancement,
health Conditions, campaign/rules profiles, combat commands, terminology, and
themes. Macros and modules must negotiate the supported API version and must not
import private source files or recalculate system rules.

Token Action HUD and companion modules should remain presentation adapters.
Dice So Nice is optional and never changes rules resolution.

## 12. Vehicles, Starships, and Creatures

### Vehicle and starship sheets

Create a **Vehicle** or **Starship** from the Actors sidebar. Their dedicated
ApplicationV2 sheets use the same OpenD6 Next visual components as character
sheets, with four task workspaces:

- **Systems** holds the machine's source-backed Die Codes and operational
  profile.
- **Combat** presents Defense, resistance, repair difficulties, Conditions, and
  weapons.
- **Cargo & Equipment** manages scale-appropriate gear and armor.
- **Vessel Notes** stores campaign-specific configuration and history.

A Vehicle stores Maneuverability, Hull, passenger capacity, Armor, and Scale
(D62e pp. 181–183). A Starship stores Navicomp, Maneuverability, Engines, Hull,
minimum crew, Shields, and Scale (D62e pp. 176–181). Values use the same
canonical pip-unit storage as character Die Codes; the active Pips capability
controls their visible `xD+y` projection. Editable fields save when focus leaves
the control; reopening the sheet reads the persisted document values.

![A native Second Edition vehicle sheet showing its Systems workspace.](../assets/manual/machine-sheet.png)

Select a system heading to use the shared typed roll builder. Defense is five
times the full Hull dice. Resistance combines Hull with Armor for Vehicles or
Shields for Starships. The Combat workspace can roll a weapon's damage and
stores the shared Condition track. Machines do not naturally recover from these
Conditions; the printed repair difficulties are displayed directly in the
workspace.

Crew or driver attacks require the acting character's Gunnery plus a weapon
attack bonus. The sheet stores and displays that bonus but does not invent a
crew assignment or automatically choose an acting character. That coordinated
attack workflow remains explicit future work.

When the OpenD6 compatibility strategy is selected, Second Edition machine data
is preserved and clearly marked; it is not silently treated as First Edition
vehicle combat.

### Creature defenses

Creature sheets normally derive Dodge and Parry like characters. In GM
**Free Edit**, the Combat tab also exposes optional static overrides. A positive
override replaces the derived value; zero restores the standard calculation.
This models the deliberate exceptions described on D62e p. 132.

## 13. Current Boundaries

This alpha implements a substantial character, roll, advancement, Item, and
combat foundation, but it is not feature-complete. Important planned or blocked
areas include:

- authoritative damage-versus-resistance resolution after the p. 33 conflict
  is decided;
- complete First Edition combat, active-defense, wound, and resistance
  strategies;
- Milestone and Narrative advancement state;
- alternate initiative, Wild Die, and defense modules;
- full movement, range, cover, scale, chase, and coordinated vehicle/starship
  crew automation;
- powers and extranormal disciplines;
- the separate Token Action HUD adapter; and
- licensed content supplied through approved companions.

The system deliberately leaves these visible as planned, deferred, or blocked
instead of filling gaps with rules from another D6 edition.
