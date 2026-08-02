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
glow, reticle, camera, and **Edit** treatment. Owners and Gamemasters can
activate the portrait to open Foundry's native Image Browser and choose a new
image. The same artwork control is available on Vehicle, Starship, and owned
Item sheets; browsing files still follows the Foundry role permissions
configured by the Gamemaster.

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
- Perception initiative rolls in the Combat Tracker;
- the classic Wild Die-one strategy;
- Character Points and Fate Points;
- Character Point advancement;
- classic pip progression; and
- the OpenD6 Attribute profile.

Individual First Edition options may be changed after enabling the preset. Any
such change produces an explicit custom profile rather than silently claiming
to be complete OpenD6.
All system-owned world rule switches also appear directly in Foundry's native
**Game Settings → D6 System Second Edition** category as a v14-safe fallback.
Foundry restricts these world settings to the Gamemaster; players retain only
the personal theme and default roll visibility controls.

First Edition flexible action allotment has a rules-isolated commitment model,
typed active defenses, and an independent relative-movement planner. The roll
builder can also apply MAP manually, including reaction rolls. First Edition
resistance and the Space wound-level strategy are independent of the Second
Edition Condition track. Incompatible Second Edition panels do not remain
active merely to fill a gap.

### Combat Tracker initiative

The GM chooses one native Second Edition initiative strategy under **Module:
Alternate Initiative**:

- **Standard** uses the relevant action roll. The tracker hides initiative-roll
  controls and lets the GM persist a practical order with drag or move buttons.
- **Simple** keeps the GM-set group order for the scene. Participants within a
  group act fluidly as the table decides.
- **Basic** lets each participant roll Perception through the normal D62e roll
  builder. The tracker labels declaration positions from lowest to highest and
  resolves from highest to lowest. Results clear for a fresh roll each round.
- **Narrative** uses the highest initial Perception result, then lets the current
  participant's owner or the GM choose who declares next. The chain persists on
  the Combat, and the previous last declarer starts the next round.

![Narrative Initiative in the live Combat Tracker.](../assets/manual/alternate-initiative-tracker.png)

The printed rules do not define tied Perception results; ties retain the
Combat's prior stable order. The optional Hero Point interrupt in the Narrative
sidebar remains a GM decision and is not automated.

Enable **Use First Edition Initiative Rolls** to use the independent OpenD6
tracker strategy instead. Each combatant rolls Perception, including its Wild
Die and pips, and Foundry sorts the results. The complete OpenD6 preset enables
this option by default and it takes precedence over the selected native Second
Edition strategy.

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
testing. It is not a player advancement mechanism. Adding a custom Skill first
asks for its name; cancelling or closing that dialog creates nothing. Editable
Skill rows include a delete control with a separate confirmation step, so an
accidental custom Skill can be removed without editing world data directly.

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

Creation controls prohibit spending beyond the current Attribute or Skill
budget. An increase that cannot fit is disabled in the sheet and rejected by
the protected creation service.

![Character creation budgets and Specialization exchange controls.](../assets/manual/character-creation.png)

### Character Templates

During creation, **Preview & Apply** lists templates registered by enabled,
lawfully supplied Foundry modules. The base system deliberately ships no named
rulebook templates. The preview shows every Attribute replacement, suggested
Skill, equipment Item addition, source citation, and any reason the template is
incompatible with the current campaign.

Applying a template sets its Attribute allocation and records its provenance.
Suggested Skills are guidance only: the template never spends any of the
character's Skill dice. A template may add registered Armor, Gear, or Weapons,
but cannot change Hero Points, advancement resources, Conditions, or arbitrary
character data. Only an owning player or Gamemaster may apply one, only while
creation is active, and only one template may be applied to a character.

![A source-cited character-template preview with exact Attribute changes.](../assets/manual/character-template-preview.png)

Without Module: Pips, creation controls move in whole dice. With the module,
they move in pips and enforce the printed split-die limits from D62e pp. 94–95.

Select **Finalize Character** only after the audit is valid. Finalization ends
the protected creation workflow and cannot be used as an ordinary editing
toggle.

### Advanced Skills and Specializations

When **Skill Specialization & Advanced Skills** is enabled:

- the creation panel begins at **Skills 0D / 7D** and
  **Specializations 0 / 0**;
- use the right-arrow exchange control to convert 1D of unspent Skill budget
  into three Specialization slots, changing the capacities to
  **Skills 0D / 6D** and **Specializations 0 / 3**;
- the reverse control returns three wholly unspent slots to recover that 1D.
  Created Specializations must be deleted before the conversion can be undone;
- Specializations display `(s)` and Advanced Skills display `(a)` beside their
  names;
- **Advanced Skill (a)** in the Specializations budget card opens one atomic
  definition dialog for the Advanced Skill's name and all connected standard
  Skills;
- at least two connected Skills must be checked before the Advanced Skill can be
  created, and cancelling the dialog creates nothing;
- its Item sheet presents the same named checkbox list when those connections
  need to be reviewed or changed later;
- the Advanced Skill appears as a linked `(a)` row beneath every connected
  Skill instead of belonging visually to one Attribute;
- every prerequisite must have its own rating of at least 3D, excluding its
  Attribute, and the Advanced Skill cannot exceed the lowest prerequisite;
- clicking the linked row rolls the parent Skill with that Advanced Skill
  preselected as context, while its small die button rolls the Advanced Skill's
  own rating directly; and
- creating a Specialization asks for its narrow name, such as **Parkour**, links
  it to the parent **Acrobatics** Skill, and supplies its fixed +1D bonus.

![An Advanced Skill linked beneath each of its connected Skills](../assets/manual/advanced-skill-links.png)

The explicit 1D-for-three exchange follows D62e p. 99. The broader creation and
roll behavior is sourced to D62e pp. 96–100. Advanced Skills
are preserved but inactive in complete OpenD6 mode unless the Gamemaster
explicitly enables the Second Edition extension.

### Fantasy Skills and Freeform Skill-Based Magic

The Gamemaster may enable **Fantasy Skills** independently. It adds Riding,
Lockpicking, Swimming, Barter, Navigation, Traps, Gambling, and Streetwise;
Languages keeps its existing core identity. The rulebook recommends adding 1D
to the creation Skill budget for every three included Fantasy Skills. The
system displays that guidance but leaves the actual additional-Skill budget
under explicit GM control.

### Science Fiction Skills

The Gamemaster may enable **Science Fiction Skills** independently. Synchronized
characters retain core Languages and gain Flying/0-G, Barter, Gambling,
Gunnery, and Streetwise. The setting does not enable Mechanical or Technical;
those remain separate Additional Attributes. As with other optional Skill
packages, the printed recommendation of +1D creation Skills for every three
added Skills remains an explicit GM budget choice.

On the Combat tab, Flying/0-G shows its complete Die Code, guideline movement
in meters per round, guideline hover duration in rounds without a test, and its
usual one-action cost. An owner may choose either normal Perception or the
complete Flying/0-G Die Code as Dodge's basis. Flying already contains Agility,
so the defense calculation never adds Agility twice. See D62e pp. 173–176.

![Flying/0-G movement guidance and the explicit Dodge basis selector](../assets/manual/science-fiction-skills.png)

**Freeform Skill-Based Magic** requires all three of these settings:

- Additional Attribute: Magic;
- Skill Specializations & Advanced Skills; and
- Freeform Skill-Based Magic.

The active catalog supplies Arcane World, Craft Magic Item, Identify Magic, and
Spell School. Spell School uses Change (Alteration), Movement (Apportation),
Creation (Conjuration), and Knowledge (Divination) specializations.

Create a **Manifestation** from **Traits & Equipment**, then choose its Spell
School, Power, target, resistance, duration, casting time, and range. Each
change is saved immediately and the sheet recalculates the printed Difficulty.
The final value cannot be lower than 5. The example below is Power 3, two or
three targets, partial resistance, one-round duration, one-action casting, and
senses range: `5 + 10 + 5 + 5 + 0 + 0 + 5 = 30`.

![A Freeform Magic Manifestation with its live Difficulty breakdown.](../assets/manual/freeform-magic-design.png)

Select **Roll** on the Manifestation to use the normal protected roll builder.
A matching Spell School specialization has no untrained penalty. Magic or Spell
School dice without the specialization add +5 Difficulty; an attempt with no
Magic or Spell School dice uses the system's minimum 1D roll and adds +10.
Chat records the school, Power, penalty, final Difficulty, and pp. 145–159
reference. The rules can describe arbitrary original effects, so the system
does not invent or automatically apply their fictional consequences.

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
- the current multiple-action penalty; and
- a GM-adjudicated Cover defense modifier on targeted Second Edition ranged
  attacks.

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

The Gamemaster can instead select one of the mutually exclusive **Alternate
Wild Die** strategies in the Second Edition settings:

- **Basic** (p. 71): sixes explode; an initial 1 removes the Wild Die and the
  highest ordinary die automatically.
- **Classic** (p. 72): sixes explode; an initial 1 asks the Gamemaster to classify
  a penalty or narrative Complication. A penalty removes the same two dice; a
  Complication ignores the Wild Die and leaves its narrative consequence to the
  table.
- **Simple** (p. 73): sixes explode and every other face counts normally.

Every chat card names and cites the active strategy. Removed dice are struck
through, and the typed chat flag retains the exact policy. Selecting any of
these options does not alter the independent OpenD6 Wild Die strategy.

Select **Configure** for **D6 System 2nd Edition** in the Gamemaster's world
settings, then choose the campaign's Wild Die strategy.

![The Gamemaster-only route to Second Edition module settings.](../assets/manual/alternate-wild-die-settings.jpg)

Player-owned choices remain on the rolling client. When a successful native
Second Edition roll produces a Wild Die 1, the player waits while an active
Gamemaster receives the same themed **Partial / Failure** decision window. The
roll continues only with that GM response. If no Gamemaster is online, the
system reports that the decision is unavailable and does not silently choose an
outcome.

If a player's blind roll produces an Advantage choice, the active Gamemaster
makes the **Exceptional / Ordinary** decision because only the Gamemaster can
see the hidden result. The player receives neither the total nor the choice
window. Private-GM and self rolls remain player-owned because the rolling player
can see those results. If no Gamemaster is online, the blind roll stops without
an automatic choice or resource change.

![Gamemaster resolution of a player's successful Wild Die 1.](../assets/manual/gm-wild-die-decision.png)

An unopposed roll without a difficulty can report an Advantage or Complication,
but it cannot infer whether the underlying action succeeded.

Private rolls are whispered to the rolling user and every Gamemaster. Blind
rolls are visible only to Gamemasters, while self rolls are visible only to the
rolling user. The system requires a current user recipient for private and self
rolls instead of risking an empty-recipient message.

### Hero Points

The GM selects one mutually exclusive Hero Point strategy in **Module: Hero
Points** (D62e pp. 75-76):

- **Heroic** is the default core behavior. One point doubles the complete Die
  Code before a roll, rerolls an eligible failed evaluated roll, or prevents a
  proposed transition to Stunned. At a new session the GM may restore every
  personal Actor to the configured starting balance unless carry-over is on.
- **Basic** spends any number of points before a roll. Each point adds one
  ordinary bonus die; these dice are not Wild Dice.
- **Classic** uses Experience Points as the Hero Point balance. It requires the
  Classic Wild Die and Experience Point advancement. Before the GM announces
  the result, the roller may spend up to the baseline Attribute's whole-die
  rating; every point adds one independently resolving Wild Die, and every 6
  rolled on a Classic Wild Die awards one point.

Trouble, Asset, and supported outcome awards always use the balance selected by
the active strategy. Killing Blow survival does the same. Failed-roll rerolls
and Stunned prevention remain Heroic-only. All automatic changes use
owner-checked transactions; automatic bookkeeping can still be disabled for
manual campaigns. Superheroic Hero Points are a separate deferred p. 204
module.

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
The Wild Die is therefore physically distinct from every standard die while
remaining part of the same typed roll result. Dice appearance never changes the
Wild Die rules or numerical resolution.

System rolls explicitly select the Second Edition dice system, colorset, and
Amiri face font without changing the player's saved global Dice So Nice
preferences. This prevents a previously saved custom color from overriding the
system presentation. Every standard denomination (`d2`, `d4`, `d6`, `d8`,
`d10`, `d12`, `d20`, `d100`, and Fate dice) uses the interface theme's
antique-gold body, bright-gold edge, and near-black numerals. The custom `dw`
Wild Die remains the only black die.

![A real system roll with gold Amiri standard dice and the black Wild Die.](../assets/manual/dice-so-nice-wild-die.png)

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

An Advanced Skill's linked `(a)` row carries its own advancement control under
every connected Skill. Its Experience Point cost is twice the cost of a regular
Skill at the same rating. The confirmation dialog shows that cost before
anything is spent. If the next rating would exceed the lowest connected
prerequisite Skill—or the prerequisites do not each have at least 3D of their
own rating—the control is locked and explains the prerequisite limit. A rejected
purchase changes neither Experience Points nor the Advanced Skill rating
(D62e p. 97).

![Advanced Skill Experience Point advancement and prerequisite cap](../assets/manual/advanced-skill-advancement.png)

In **Free Edit**, the same linked row exposes the Advanced Skill's compact pip
score field. Editing either repeated reference updates the one shared Advanced
Skill Item and every linked presentation. This is the GM correction route;
ordinary players still spend advancement resources only through Advance mode.

Specializations do not receive repeated Experience Point improvements. When
**Module: Skill Specializations & Advanced Skills** is enabled, each standard
Skill row in Advance mode instead offers **Acquire specialization**. Enter the
narrow focus in the dialog and confirm the displayed Experience Point cost.
The cost is the Skill's own rating plus the number of specializations already
linked to that Skill. A Skill cannot have more specializations than its rating,
Advanced Skills cannot receive them, and every acquired specialization remains
a fixed +1D bonus (D62e p. 99).

### Second Edition Milestones

When **Milestone Advancement** is selected, Advance mode shows the character's
unused milestone rewards. The Gamemaster's **Award milestone** action grants
exactly +1 Attribute die and +3 Skill dice. Internally the Skill award is stored
as nine pips so whole-die campaigns spend three at a time while Module: Pips
campaigns may spend them one at a time. Attribute rewards always increase one
Attribute by +1D (D62e pp. 90–91).

If **Perks, Flaws & Talents** is active, a complete unused bundle can instead be
exchanged for a new Perk at R1 or one additional rank on an existing Perk. The
transaction requires and consumes one Attribute die plus all nine Skill pips;
partial balances cannot be exchanged.

### Second Edition Narrative arcs

When **Narrative Advancement** is selected, an owning player can propose an arc
from the Advance workspace. Choose its Skill or Attribute reward, give the arc
a title, and enter one story step per line. The dialog displays the current and
new reward rating and required step count. The system enforces steps equal to
the reward's new die rating; Skills are the rulebook's recommended reward.
When **Perks, Flaws & Talents** is active, the same dialog can propose a new R1
Perk or the next rank of an existing Perk. That arc requires steps equal to the
Perk's new rank. Narrative Flaw and Talent rewards remain deliberately absent,
matching the rulebook's recommendation.

The Gamemaster approves a draft before its steps can be checked. Once every
approved step is complete, only the Gamemaster can grant the +1D or Perk reward.
If an existing target rating changed after approval, the stale arc is rejected
rather than granting an ambiguous increase. Draft, approved, and completed arcs
persist on the Actor (D62e pp. 92–93).

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

Inventory rows follow the same compact loadout pattern as OpenD6 Next. Each row
opens the Item without requiring drag-and-drop. Equipment rows show their
quantity and an **Equipped** checkbox directly on the character sheet, so an
owning player can change the active loadout in Normal or Advance mode. The
per-group **Add** button is the keyboard-accessible alternative for creating a
new embedded Item; deletion remains a confirmed Free Edit operation.

The Second Edition settings application also offers one **Equipment era**
choice: Unclassified, Medieval, Modern, or Science Fiction (pp. 79-85). Newly
created equipment inherits the current selection. Inventory rows and Item
sheets display that classification; a different-era Item receives a visible
warning but is never hidden or deleted. A Gamemaster may reclassify an Item in
Free Edit. The base system intentionally contains no named rulebook equipment
tables. Licensed Foundry modules can supply validated catalogs, while custom
Items remain clearly marked as having no catalog provenance.

![A custom Gear Item inheriting the campaign's Modern equipment era.](../assets/manual/equipment-era-provenance.png)

![Quantity and Equipped controls in the Traits & Equipment inventory.](../assets/manual/character-inventory-loadout.png)

The canonical ApplicationV2 Item sheet shows only fields supported by the
Item's type. A Skill Item displays its Attribute, rating, training type, source
citation, and prerequisite/parent relationships where applicable. Advanced
Skills and Specializations have explicit, required name fields. A
Specialization's description is optional supporting detail and never replaces
its narrow focus name.

Every Item sheet has three shared workspaces:

- **Details** contains the type-specific mechanical and source fields.
- **Description** keeps narrative notes separate from configuration.
- **Effects** lists Foundry Active Effects attached to the Item.

Owners may edit an Item's narrative **Description** without gaining access to
its protected mechanical fields. They can also review the names and enabled
state of existing effects. Because a native Active Effect form can alter
document data, only a Gamemaster using **Free Edit** can open, create, or delete
effect documents. Deletion always asks for confirmation.

Owned Skills and Specializations can therefore be opened in Normal and Advance
mode for description editing and inspection. Their names, ratings, parent
relationships, and other protected fields remain disabled until the applicable
creation or Gamemaster Free Edit authority is active.

![The Gamemaster-only Active Effects workspace on an Item sheet.](../assets/manual/item-effects-workspace.png)

Native Second Edition feature Items follow D62e pp. 101-131:

- Perks and Flaws record rank plus a campaign-defined focus or scope.
- Talents also record their printed creation cost in Skill dice and whether the
  Talent may be purchased repeatedly.
- Troubles and Assets record the narrative trigger the player may invoke.

Enable **Module: Perks, Flaws & Talents** to include these Items in the Skill
creation budget. Perks cost one Skill die per rank, Flaws grant one Skill die per
rank, and Talents use their stored total Skill-dice cost. When a lawful content
module supplies a ranked Talent, the system multiplies its per-rank definition
cost before storing the Item.

Licensed or private content modules can add named definitions through the public
feature catalog. The system validates rank limits, required focus, repeatability,
source, creation cost, and semantic mechanic records before an owning player or
GM adds the feature. The created Item retains its catalog and mechanic snapshot
even if that module is later disabled. The generic system ships an empty catalog
and therefore does not distribute protected names or descriptions.

Enable **Module: Troubles & Assets** to show invocation controls. Each Trouble
or Asset can be used twice per session. Trouble grants one Hero Point and posts
the immediate Complication requirement. Asset grants either one Hero Point or
+3D to the Attribute or Skill roll selected by the player. Only a GM can reset
the session counters. Existing OpenD6 Advantages, Disadvantages, and Special
Abilities remain separate and are never renamed automatically.

![A native Second Edition Perk in the canonical Item sheet.](../assets/manual/character-feature-item-sheet.png)

Descriptions are never interpreted as executable rules. Catalog mechanics are
closed typed data, not contributed code; narrative or context-dependent entries
remain explicit GM adjudication.

The public Skill packs intentionally contain stable IDs, names, Attribute
links, module IDs, and printed-page references—but no protected descriptive
prose. A private content companion may add descriptions without making the
generic system depend on private material.

Drag and drop is an enhancement. The visible add and edit controls remain the
discoverable alternative.

## 8. Combat and Conditions

![Character Combat workspace.](../assets/manual/character-sheet-combat.png)

### Action economy assistance

The Gamemaster chooses **Action declaration assistance** in either restricted
edition-settings menu:

- **Optional assistance** (recommended) keeps the planner available, pre-fills
  its tracked MAP in the roll builder, and permits an explicit per-roll
  override.
- **Enforce Second Edition declarations** requires a declaration before an
  action roll by an active Second Edition Combatant.
- **Manual table workflow** hides the declaration workspace. Players tell the
  Gamemaster their actions and enter the agreed MAP directly in the roll
  builder.

This setting controls Foundry assistance, not the campaign's rules profile. The
roll builder's dedicated **Multiple-action penalty (MAP)** field is measured in
dice and remains available to both authorized players and the Gamemaster. A
manual override and a tracked declaration are distinguished in the chat audit.
No action roll may proceed if all applicable MAP, movement, and Condition
penalties leave fewer than 1D; pips do not rescue a zero-die pool.

![A player applying a 1D MAP while the final pool updates to 2D.](../assets/manual/roll-map-dialog.png)

Native Second Edition Combatants declare an ordered list of actual Attributes,
Skills, weapon Attacks, movement, and GM-adjudicated non-roll actions. Each
listed roll source comes from the Actor rather than free text, so the dialog can
show its starting and projected final Die Code. The system stores versioned
Combatant state, applies one die of penalty for each declared action after the
first, and requires completion in order. See D62e pp. 29–31.

The dialog updates every final pool while actions are added or removed. A
declaration is prohibited when MAP, movement, or the current Condition would
reduce any selected pool below 1D. `0D+1` and `0D+2` remain zero whole dice and
are therefore prohibited. Staggered and Wounded each contribute their −1D;
Stunned, Incapacitated, Mortally Wounded, and Dead cannot declare or perform
actions. The same authoritative checks run again when the roll is attempted, so
a later Condition change cannot bypass the declaration limit.

If Damage makes a Combatant Wounded during the round, D62e p. 33 also ends that
character's participation for the rest of that round. The sheet marks every
uncompleted segment as forfeited, disables declaration and completion, and
blocks ordinary action rolls even when assistance is Optional or Manual.
Already-completed segments remain recorded. The Damage card and Token Action
HUD show the same forfeiture, and the next round clears it while retaining the
Wounded Condition and its normal -1D penalty.

![A completed first action followed by two actions forfeited after the character became Wounded.](../assets/manual/wounded-action-forfeiture.png)

![Three legal 3D actions retained at a final 1D each.](../assets/manual/combat-declaration.png)

The declaration also records the round's movement choice. Walking allows up to
5 metres, running up to 10 metres, and a prone Actor may crawl up to 2 metres.
Running or crawling adds another −1D to Skill and weapon Attack rolls, but not
to Attribute rolls. Standing up is an action
and prevents other movement that round. A Walk or Run can be marked **Finish
movement prone**; completing that action changes the sheet posture to Prone.
Completing Stand changes it to Standing. The system validates these choices but
never invents a destination. Use **Move Token** and point to a destination on
the active Scene. The nonmodal picker shows the snapped route distance and
applicable maximum, rejects movement-wall paths and over-range destinations,
and allows right-click or Escape cancellation. When the current declared
segment is Walk, Run, or Crawl, only that matching mode is accepted; a successful
Token update completes the segment, while a revision failure restores the
Token's original position. Outside Combat, choose the movement mode explicitly.
Moderate cold halves the enforced maximum. See D62e p. 32.

![The explicit Token destination picker validating a Second Edition walk.](../assets/manual/automatic-token-movement.png)

Combat actions belong to the exact Actor represented by the Combatant. For an
unlinked Token, open that Token's Actor sheet to declare and complete actions;
the separate directory Actor has a different Foundry document UUID, is only its
prototype, and correctly remains outside that Token's combat state.

At the start of a new round, the Gamemaster-authoritative combat hook clears the
previous action declaration. Short Conditions, Staggered and Stunned, recover
to Healthy; Wounded and more severe Conditions remain in place.

Owners may reset before resolution. After the first action completes, correction
is restricted to the Gamemaster. Attribute, Skill, and weapon Attack rolls
consume the same separately audited MAP, movement, and Condition penalties.
Resistance deliberately does not:
D62e p. 34 excludes multiple-action and wound penalties from Brawn resistance.

### First Edition flexible actions

First Edition does not reuse the ordered Second Edition scheduler. With
**Optional assistance**, a Combatant's sheet shows a count-only **Flexible
actions** tracker. Choose the total number of actions when the character's turn
arrives; the individual actions do not need to be named in advance. The tracker
applies −1D to every action roll beyond the character's base action allotment,
pre-fills that MAP in the shared roll builder, and records spent versus
remaining actions. See D6S p. 58.

![First Edition flexible-action tracker showing a two-action total, one spent reaction, Partial Defense, and tracked −1D MAP.](../assets/manual/first-edition-actions.jpg)

If an attack forces a Dodge before the character's normal turn, the Gamemaster
asks whether further actions are planned. Set the complete total, choose
**Partial Defense**, and mark the reaction as already spent. The resulting MAP
therefore applies to the Dodge immediately and to later actions. Unused
committed actions are lost at round end.

**Full Defense** is exclusive: its total is fixed to one action and its MAP is
0D. After a defense is committed, use the typed **Dodge**, **Block**, or
**Parry** buttons on the Combat tab. Partial Defense applies tracked MAP. Full
Defense ignores MAP and adds the printed +10 automatically. Its result becomes
the active difficulty and remains visible in roll/chat audit. See D6S p. 73.

Characters with an ability that increases their action allotment may enter that
larger value. MAP begins only after the allotment is exceeded. The minimum-1D
rule still applies to every tracked or manually entered MAP. Players may clear
an unspent commitment; after an action or reaction is spent, only the
Gamemaster may correct it.

### First Edition relative movement

With First Edition movement active, the header exposes the Actor's **Move** and
the Combat tab provides land, swim, climb, and fly/zero-G movement. Choose the
type and terrain modifier, then point to the explicit Token destination; the
measured Scene route replaces manually transcribing a distance. Up to half
the relevant movement rate is free. Longer movement is an action; terrain and
extended distance determine difficulty. The planner enforces the four-times-
rate cap and posts a chat audit. A non-free move spends a tracked flexible
action when a commitment exists, while verbal/manual table play does not force
a tracker commitment. When the printed movement rules require a check, the
planner opens Running, Swim, Climb/Jump, or Flying/0-G with the difficulty
fixed. If the Skill is absent, it rolls the governing Agility or Strength
Attribute. Cancelling that check does not spend the action. A successful check
moves the Token. On failure, the action and audit remain resolved but the Token
stays put because the printed fallback distance or a fall requires GM
adjudication. See D6S pp. 63–64.

### First Edition Body Points

![First Edition Body Points on the character Combat tab](../assets/manual/first-edition-body-points.png)

The OpenD6 First Edition settings offer one mutually exclusive **First Edition
damage track** selector:

- **Wounds** keeps the existing Strength-plus-armor resistance, wound
  progression, penalties, and step healing.
- **Body Points** uses current/maximum points without intermediate wound
  penalties.
- **Body Points + wound bands** derives the printed Stunned through Mortally
  Wounded bands from the remaining percentage. The derived track is read-only.

Switching modes preserves the inactive Wound and Body Point values. It does not
convert or erase campaign data. Native Second Edition Conditions, Vehicle and
Starship damage, and their resistance pools are unchanged.

On the Combat tab, **Roll maximum** rolls the Actor's Strength and adds 20. A 1
on that roll is ordinary and does not invoke a Wild Die mishap. Rerolling an
existing maximum asks for confirmation, sets both current and maximum to the
new result, and posts a source-cited public audit. A GM in **Free Edit** may
enter the maximum directly; an owner may edit current points. See D6S p. 14.

Body Point damage rolls armor and special resistance only. Strength is not part
of an ordinary Body Point resistance pool. The GM-only action on the original
targeted Damage card subtracts positive Damage-minus-resistance from current
points once and records the resulting points, percentage band, and source in
chat. Stun-only damage first rolls armor, then rolls Strength without wound or
action penalties, and subtracts only what remains. Any point loss causes the
printed temporary unconsciousness. See D6S pp. 75–76.

**Natural healing** asks whether the preceding day was full rest (+1D), light
activity, or strenuous activity (−1D), then rolls Strength. **Assisted healing**
rolls the selected owned healer's Medicine. The result selects the full printed
recovery table: 0, 2 points, or 1D through 6D points, capped at the maximum.
The once-per-day Medicine limit and optional longer rest-period rule remain
Gamemaster calendar decisions. See D6S pp. 78–79.

At 1%–9%, and at zero while revival remains possible, the Actor is Mortally
Wounded and uses the existing active-GM round clock. Medical aid must restore
at least 10% of maximum. Aid within four minutes revives without Skill loss;
aid during minutes 5–10 or 11–15 requires Strength or Stamina against elapsed
minutes and permanently removes 1D or 2D from Skills without taking a Skill
below its Attribute. Failure, aid after 15 minutes, or another full maximum of
damage below zero is fatal. The system stores Skill bonuses separately, so the
floor is represented by a zero bonus. See D6S p. 76 and Rules Ruling 6.

### Legacy First Edition accumulating stuns

![Legacy accumulating-stuns track on the character Combat tab](../assets/manual/first-edition-accumulating-stuns.png)

The OpenD6 First Edition setting **Track accumulating stuns (legacy
compatibility)** enables a separate, off-by-default compatibility extension.
D6 Space pp. 75–76 do not contain this count-and-threshold mechanic; the normal
stun-only weapon rule remains the default when the option is off.

With the option enabled, every positive stun hit adds one persistent stun. The
Combat tab shows the current count and the unconsciousness threshold, equal to
the Actor's whole Strength dice. Net differences 1–3 apply a noncumulative −1D
ordinary-action penalty; 4–8 apply −2D. The penalty lasts for the current and
next round, and the primary active Gamemaster advances it once per true Combat
round. Resistance, recovery, and other action-exempt rolls do not receive this
penalty.

Reaching the threshold makes the target unconscious for a separate 2D minutes.
A net difference of 9 or more retains immediate unconsciousness for the positive
Damage-minus-resistance difference in minutes. The original Damage card records
the count, threshold, penalty, rounds, and explicit compatibility provenance.
State persists if the setting is disabled and becomes active again unchanged.

After one uninterrupted minute of rest, an owner or Gamemaster may choose
**Complete 1-minute rest** and confirm the reset. Round transitions clear only
the short penalty; they do not erase the persistent count.

**Manual table workflow** hides both edition trackers. Players can always tell
the Gamemaster their actions and enter the agreed MAP directly in the roll
builder.

### Static defenses

With core Second Edition defenses, the Combat tab derives:

- Dodge from full Perception dice; and
- Parry from full Agility dice.

These are derived presentation values, not stored character scores. See D62e
pp. 21, 33.

When **Science Fiction Skills** is active and Flying/0-G is present, the Actor
owner may select the complete Flying/0-G Die Code as Dodge's alternate basis.
The choice persists on the Actor and targeted attacks consume the same value.

The posture control records Standing or Prone. A prone target gains +10 Dodge
against ranged attacks, while Dodge and Parry are capped at 10 against melee
attacks. Wounded and more severe Conditions put the Actor prone. The Combat tab
shows both the current posture and the resulting defense context.

When **Module: No Dodge Defense** is enabled, the sheet removes the Dodge
value and its posture modifier. Personal ranged attacks instead use the fixed
range difficulties on D62e p. 94: Point Blank 5, Short 10, Medium 15, Long 20,
or Long 30 when the target is dodging. Parry and machine Defense remain in use.

### Targeted attacks and range

When the acting character has a token on the current Scene, a weapon Attack
dialog lists the other character, NPC, and creature tokens. A currently
targeted token is preselected. The dialog measures distance, shows the weapon's
short, medium, or long range band (or melee adjacency), and sets the correct
static Dodge or Parry as the difficulty. With **Module: No Dodge Defense**, a
personal ranged target instead shows Point Blank 5, Short 10, Medium 15, or
Long 20. At Long range only, **Target is dodging** raises that difficulty to 30. An attack must exceed the resulting defense; equality fails. Out-of-range
attacks are stopped before dice are rolled.

For a targeted Second Edition ranged Attack, **Cover defense modifier** accepts
the nonnegative flat value adjudicated by the Gamemaster. It adds to the
target's base defense and updates the displayed difficulty before the
roll. The book explains taking Cover but supplies no fixed Cover values (D62e
p. 30), so the system offers no quarter/half/full presets and does not infer a
modifier from Token position. The public chat audit shows
`base defense + Cover = effective defense`. This control does not appear for
melee, Damage, resistance, or First Edition rolls.

The resulting chat card and structured roll flags retain the target, weapon,
range, distance, and defense for audit. A targeted weapon Damage roll adds a
GM-only **Resolve damage** action to its chat card. Players can roll and see the
result, but only a GM can resolve and apply it.

### Hyper-lethal combat

**Module: Hyper-lethal Combat** provides four independent campaign options
from D62e pp. 89-90:

- **Remove Stunned** makes Wounded the first normal damage level. Repeated
  Wounded results retain the standard Incapacitated and Mortally Wounded
  progression.
- **Remove Wounded** makes Stunned the first normal damage level and Mortally
  Wounded the next. Enabling both removal options leaves Mortally Wounded as
  the only normal damage level.
- **Killing Blows** immediately makes a personal target Dead when its Brawn
  resistance total is strictly less than half the Damage total. At exactly
  half, ordinary damage resolution applies. A target with a Hero Point may
  spend one to survive the Killing Blow, after which the hit resolves normally.
- **Cap Brawn + Armor at 6D** limits the personal Brawn-plus-equipped-Armor
  pool before rolling. Any relative Scale modifier remains separately visible
  and auditable.

These options apply only to targeted personal Second Edition damage. Vehicle
and Starship Hull-plus-protection damage, First Edition wounds, environmental
direct Conditions, and manual Condition changes retain their own rules. The
character resistance card shows the configured 6D maximum, and resistance and
Damage chat cards retain the active rule, source page, Killing Blow decision,
Hero Point expenditure, and applied Condition.

### Relative scale

Characters and machines use scale ranks 0 through 6. The rank alone does not
change a pool; only the difference between two participants matters. A scene
target or damage source can therefore add the D62e pp. 196–197 modifier directly
in the roll dialog:

- a smaller attacker adds +1D per rank of difference to the Attack pool;
- a smaller ranged target adds the same bonus to Dodge, but never Parry;
- a larger attacker adds it to a weapon Damage pool; and
- a larger defender adds it to Brawn resistance.

The dialog updates the final pool before rolling, including the doubled Hero
Point preview. The chat card records the application, both ranks, the modifier,
and the page reference. Select **No target** or omit a damage source when no
relative-scale comparison applies. A Damage roll must have a selected personal
target to offer the automatic resolver.

### Condition track

The sheet displays the track selected by the active damage strategy. The
persisted Second Edition track includes Healthy, Staggered, Stunned,
Wounded, Incapacitated, Mortally Wounded, and Dead. Selecting a state updates
the header and Combat tab using the same semantic colors.

The independent First Edition Space track includes Healthy, Stunned, Wounded,
Severely Wounded, Incapacitated, Mortally Wounded, and Dead. It never converts
or overwrites the Second Edition state. Wounded, Severely Wounded, and
Incapacitated apply -1D, -2D, and -3D to ordinary action rolls; resistance
remains exempt.

First Edition also displays a separate consciousness panel when required.
Choose **Stun** in a Weapon's Damage Type field to use stun-only damage. The GM's
targeted Damage action then reduces the ordinary Wound result by two levels,
never below Stunned, without changing the physical Wound track. Any resulting
injury makes the target unconscious for Damage minus resistance minutes. A
fully resisted attack records that it caused no stun injury.

Applying Incapacitated requires the target to choose a free **Stamina** or
**Willpower** Moderate (15) check. Success leaves the character conscious at
the normal -3D Incapacitated penalty. Failure makes the character unconscious
for a separately rolled 10D minutes. Unresolved and unconscious characters
cannot make ordinary action rolls. The sheet retains the result across reloads
and provides **Mark conscious** for the owner or GM once the duration has been
adjudicated. Mortally Wounded remains unconscious until its wound is resolved.

When that track is active and the Actor is injured, the condition panel also
shows the applicable Wound healing tools from OpenD6 Space p. 79:

- **Natural healing** confirms the printed rest period before rolling full
  Strength. Stunned recovers automatically after one minute of complete rest;
  the other levels use their printed result table, including worsening on a
  Wild Die Critical Failure.
- **Assisted healing** selects an owned Actor with the Medicine Skill and locks
  the printed difficulty: 10 for an unconscious Stunned patient, 15 for
  Wounded or Severely Wounded, 20 for Incapacitated, and 25 for Mortally
  Wounded. Success improves exactly one Wound level. Foundry reminds the group
  that only one attempt may be made for a patient each day; the GM remains the
  authority for elapsed campaign time and whether a Stunned patient is
  unconscious. At Mortally Wounded the same button is labelled **Stabilize with
  Medicine**: success at difficulty 25 improves the patient to Incapacitated,
  which ends the mortal clock without inventing a separate recovery state.
- **Death check** remains available as a manual elapsed-time fallback. During
  Combat, the primary active GM instead rolls the check automatically whenever
  Foundry advances to the next round. The sheet shows completed mortal rounds
  and elapsed whole minutes; 12 five-second rounds equal one minute. A typed
  public chat audit records those values, the locked difficulty, and p. 76.
  Duplicate delivery of the same completed round is ignored. A Strength total
  below elapsed whole minutes changes the Actor to Dead; meeting or exceeding
  it survives that round's check.

![A Mortally Wounded First Edition character showing the persisted round clock and stabilization action.](../assets/manual/first-edition-mortality.png)

These checks deliberately bypass combat action/MAP and wound penalties. The
rules-set difficulty is displayed read-only in the normal roll builder, so roll
visibility and Wild Die handling remain auditable without allowing the printed
threshold to be edited.

At the start of the next Combat round, the GM client automatically clears
Staggered and Stunned. Longer-lasting Conditions remain until their separate
recovery requirements are resolved. This automation is inactive when the
First Edition damage strategy is selected.

When an eligible transition would make the Actor Stunned, the system offers the
verified Hero Point prevention choice from D62e p. 28. It prevents that proposed
transition; it is not a recovery action for an Actor already Stunned.

For a targeted Damage chat card, the GM selects **Resolve damage**. The system
opens the target's normal Brawn-plus-armor resistance builder with the attacker
preselected as its damage source, so scale and roll visibility remain visible
and auditable. The Damage total is the fixed difficulty and Brawn must exceed
it; the builder displays that threshold before rolling. The Damage card retains
its original source and scale context even if that source's Token has since
left the scene. After that roll:

- Brawn greater than Damage causes Staggered;
- another Staggered result while already Staggered causes Stunned;
- Brawn equal to or lower than Damage causes Wounded;
- a Brawn-roll Complication on that failed resistance instead causes Mortally
  Wounded; and
- repeated Wounded results progress to Incapacitated, then Mortally Wounded.

If the transition would cause Stunned and the target has a Hero Point, the GM
chooses whether to spend it to prevent the transition. The original Damage card
then records both totals, the incoming result, the applied Condition, and
whether prevention occurred. If the result freshly makes the target Wounded,
the card also records that every remaining action was forfeited for the round.
The applied flag prevents normal duplicate
resolution. Vehicle and Starship damage remains a separate rules workflow.

With First Edition damage active, the same GM action instead rolls the target's
Strength/Brawn plus equipped armor and subtracts that resistance from Damage.
A difference of 1-3 causes Stunned, 4-8 Wounded, 9-12 Incapacitated, 13-15
Mortally Wounded, and 16 or more Dead. A repeated or lesser injury advances the
existing wound one level, which supplies the distinct Severely Wounded step.
The Damage card records the First Edition strategy, both totals, the difference,
and the applied wound. See OpenD6 Space pp. 75-76.

### Weapons and armor

The Combat loadout can create, equip, edit, and roll Weapons and Armor.
Weapon Attack and Damage and Actor resistance use the shared roll pipeline.
Resistance combines effective Brawn with the strongest equipped body armor.
One equipped item classified as a **Shield** may add to that armor; multiple
body armors or shields do not stack. The Combat tab shows the derived pool and
its contributing equipment before rolling.

### Chase tracker

Enable **Module: Chases** in the Second Edition settings application to add the
route control to Token Controls. The control opens a tracker stored on the
current Scene, so its participants, rolls, Distance, and completed exchanges
survive reloads.

The GM starts a chase by choosing one representative Actor and one embedded
Skill or Specialization for each side. The normal starting Distance is 4; the
GM may choose another active value from 1 through 7 when the fiction calls for
it. Each representative may use a different Skill, as described by the module.
Only the representative's owner or a GM can roll that side. Player rolls are
submitted to the active GM before the Scene flag changes.

After both sides roll, the GM resolves the exchange. The higher opposed total
wins; ties use the ordinary p. 25 order described above. A pursuer win reduces
Distance, and a fleeing-party win increases it. The normal shift is 1; select
**Exceptional Success** only when the winning result merits the printed
two-step shift. Distance 0 means the pursuer catches the fleeing party, while
Distance 8 means the fleeing party escapes (D62e pp. 73–74).

Each ordinary Skill roll keeps its own chat card. Resolution adds a shared audit
card containing both totals, both Wild Die outcomes, the tie ruling when used,
the Exceptional Success decision, and the exact Distance change. Because the
core Wild Die result may remain an unresolved Advantage or Complication until
the opposed result exists, the GM makes that final table ruling explicitly; the
tracker never silently converts it. Ending a chase requires confirmation and
clears only that Scene's chase flag.

![The scene-persistent Chase tracker after an Exceptional Success moved Distance to 2 and opened a fresh exchange.](../assets/manual/chase-tracker.png)

### Environmental hazards

Enable **Module: Environments** in the Second Edition settings application to
add the cloud-bolt control to Token Controls. This GM-only manager lists every
Character, Creature, and NPC, its safe-breath allowance, and any current
environment effect.

Choose **New exposure**, then select an Actor, cold, heat, poisonous air, or
drowning, and the applicable severity. The system opens the ordinary roll
builder with the printed difficulty locked and rolls Stamina, falling back to
Brawn when the Actor has no Stamina Skill. A successful check leaves no effect.
A failed check stores the hazard and applies the printed result (D62e pp. 77-78):

- moderate cold imposes −1D on all rolls and halves the movement limits shown
  in the combat declaration workspace;
- moderate heat or poisonous air imposes −1D on all rolls;
- severe cold or heat imposes −2D on all rolls and turns later Stunned results
  into Wounded;
- severe poisonous air causes Incapacitated;
- deadly cold, heat, or poisonous air causes Mortally Wounded; and
- consecutive failed drowning checks progress through Incapacitated, Mortally
  Wounded, and Dead.

The penalty applies to ordinary actions, Damage, and resistance independently
of MAP, and the final roll card names the hazard, severity, effect, and source
page. The Character Combat workspace shows the active effect and adjusted
movement limit. Drowning allows a number of rounds equal to the Actor's Stamina
Die Code before the GM begins the end-of-turn checks; the manager displays that
allowance.

Use **Aid** to choose an owned helper and Skill. The check uses the original
exposure difficulty, and success removes the effect. **Safe day** is the other
confirmed recovery path after the group has actually spent about a day in a
safe place with the needed remedy. Recovery restores a Condition caused by that
effect only if a later injury has not replaced it.

![The GM-only Environments manager showing an active severe cold effect.](../assets/manual/environment-manager.png)

Foundry does not decide when four hours or a drowning turn has elapsed, detect
damaged protective equipment, invent extra poisonous-air penalties, or advance
campaign time. The GM remains responsible for those fictional and timing
decisions.

## 9. Game Settings

Root system settings contain options useful in either edition:

- world and personal theme;
- default roll visibility and difficulty;
- visibility of difficulty, modifier, and opposed-roll controls;
- visibility of Advantages and Disadvantages; and
- visibility of Specializations.

The world-level **Show GM Quickbar** and **Show Active Tasks & Requests**
preferences are Gamemaster settings. Foundry does not expose those controls in
player Game Settings.

The **D6 System 2nd Edition** submenu is organized like the rulebook's campaign
worksheet. Each configurable card identifies whether it is core setup or an
optional module and shows the relevant printed pages:

- **Core campaign setup** (D62e pp. 20, 28) contains the additional
  Skill-module count and automatic bookkeeping.
- **Module: Additional Attributes** (pp. 62-68) contains Charm, Mechanical,
  Technical, Mysticism, and Magic.
- **Module: Hero Points** (pp. 75-76) selects Heroic, Basic, or Classic; it
  contains the strategy-specific starting and session controls and enforces
  Classic's Wild Die and advancement dependencies.
- **Advancement modules** (pp. 86-93) selects no more than one of Experience
  Points, Milestone Character Advancement, or Narrative Advancement.
- **Module: Hyper-lethal Combat** (pp. 89-90) independently configures a
  shorter Condition track, Killing Blows, and a 6D maximum Brawn-plus-Armor
  resistance pool.
- **Module: No Dodge Defense** (p. 94) replaces personal ranged Dodge with
  fixed range-band difficulties while retaining Parry and machine Defense.
- **Module: Pips** (pp. 94-95) enables `+1` and `+2` Die Code steps.
- **Module: Skill Specializations & Advanced Skills** (pp. 96-100) enables the
  supported granular Skill structures.
- **Fantasy Skills & Freeform Magic** (pp. 141-159) enables the optional
  Fantasy catalog and the dependency-gated Manifestation workflow.
- **Module: Science Fiction Skills** (pp. 173-176) enables Flying/0-G, Barter,
  Gambling, Gunnery, and Streetwise, retains core Languages, and exposes the
  source-cited Flying movement and Dodge-basis controls.
- **Magic Points Casting** (pp. 160-162) adds Mystical Alignment and the
  protected current/maximum Magic Point track. Manifestation casts spend the
  displayed cost and succeed without a casting roll; **Recover one hour** adds
  the caster's Magic whole dice up to maximum.

![Second Edition character sheet showing the Magic Point track and one-hour recovery control.](../assets/manual/second-edition-magic-points.png)

- **Active & Responsive Combat** (pp. 162-164) adds Full Defense and targeted
  Feint controls to the Combat workspace. Full Defense is the only round
  action. Feint requires Melee 4D and an already targeted scene Token. Melee
  Wild Die reaction buttons appear on eligible chat cards. Weapons with an
  Autofire rating prompt for the attack reduction and carry twice that value
  into the next completed Damage roll.

![Second Edition Combat workspace showing a prepared Feint and the Active & Responsive Combat controls.](../assets/manual/active-responsive-combat.png)

The active cards are the currently implemented configurable subset. The
GM-only workspace lists every printed Core, Fantasy, Science-Fiction, and
Superheroic module with its page reference, state, dependencies, and
incompatibilities. During development, unfinished modules are shown as
**Planned / not yet available**; they are never selectable controls that
silently do nothing. The broad full-rulebook 1.0 target requires every catalog
entry to become functional.

The **Every printed module** catalog below the active cards contains 41 entries
in four collapsible sections. It intentionally combines the book's introduction,
table of contents, and shortened Module Worksheet. This includes modules omitted
from the worksheet itself: the general and genre bestiaries, templates, Scale,
Superheroic Hero Points, Capping Die Codes, and Secret Identities. Every entry
shows one of four honest support states:

- **Available · configurable** links to a working setting above.
- **Available · built in** identifies implemented system behavior that is
  currently always present when its Actor or workflow is used.
- **Partial support** identifies a real implemented foundation whose complete
  printed module is not finished.
- **Planned · unavailable** is visible for campaign planning but has no
  selectable control.

Mutually exclusive Initiative, Wild Die, Hero Point, and Advancement families
use one choice control per family. The settings workspace prevents incompatible
combinations and explains dependencies. Players cannot change these world rules;
the controls remain restricted to Gamemasters. The resolved campaign profile
and cross-edition capability matrix below the module cards show what the system
will actually apply.

The **OpenD6 First Edition** submenu owns the complete preset and independent
compatibility switches. Settings that affect only one edition do not appear as
ambiguous root toggles. **Use First Edition Initiative Rolls** switches between
Perception-based tracker initiative and the selected native Second Edition
strategy. The tracker refreshes immediately when this option changes.
Both restricted edition menus expose the same **Action declaration assistance**
choice so the table workflow is easy to find without duplicating its world
state. It is intentionally absent from players' native Game Settings.

### Tyfusius Home Brew

The GM-only **Tyfusius Home Brew** submenu contains optional house rules rather
than default OpenD6 or Second Edition rules. Every switch is world-scoped,
independent, and disabled by default. The submenu explains each rule in plain
language and identifies which edition it affects. Players cannot change these
settings, so the GM should tell the table which house rules are active.

**First Edition: segmented action queues** changes how declared actions are
ordered. Each combatant first enters a complete queue. Choose a linked
Attribute, Skill, or weapon action when Foundry should show its final pool, or
use a short freeform label for an action the GM will adjudicate. Foundry waits
until every active combatant has declared. It then resolves everybody's first
action in initiative order, followed by everybody's second action, and so on.

For example, Ada declares three actions and Bex declares two. If Ada has the
higher initiative, the order is Ada action 1, Bex action 1, Ada action 2, Bex
action 2, then Ada action 3. Ada has a 2D MAP and Bex has a 1D MAP throughout;
neither character borrows the other's action count or penalty.

If someone must Dodge, block, or parry an attack before their initiative place,
declare that defender's complete queue immediately and mark the defense as
already spent. That consumes only the defender's first queued action. The
remaining actions still occur in their normal later segments. Full Defense must
be the queue's only action.

Each action segment also permits movement. Foundry looks at every linked Skill,
Attribute, weapon, and Running action in that character's queue after MAP. The
number of full dice in the lowest pool is the first movement limit. The second
limit is **Move divided by that character's declared actions**; use the lower of
the two. Freeform actions have no pool, so link at least one queued action when
you want Foundry to calculate movement automatically.

For example, Kael has Move 12 and declares three actions. His lowest linked pool
after MAP is 3D. Three dice permit 3 meters, while Move 12 divided by three
actions caps him at 4 meters, so Kael may move 3 meters in each normal segment.

Choose **Running** as a queued movement action when the character tries to run.
Its Difficulty is 5 for each declared action, so Kael's three-action Running
Difficulty is 15. Success doubles that segment's movement to 6 meters. Failure
still spends the Running action and keeps its MAP, but allows only the normal 3
meters. If the Running Wild Die 1 becomes a **Complication**, every other action
is lost and the character receives only one normal 3-meter movement total.

In the movement dialog, check **This is reactive movement** only while responding
to another character's current segment. The reaction spends the reacting
character's own next action and uses that character's own queue, MAP, action
count, and Move. A guard with two actions can therefore move farther than Kael
with three. The reactive move does not offer or trigger another movement
reaction.

**First Edition: Strength-adjusted grenade ranges** changes the printed ranges
of Weapons marked **Thrown explosive**. Enter the grenade's printed **Short
range begins**, Short end, Medium end, and Long end on its Item sheet. The
printed ranges assume Strength 2D. Add one meter to every boundary for each
Strength pip above 2D, or subtract one meter for each pip below 2D; a boundary
never falls below zero.

For example, printed ranges `3–4 / 7 / 12` become `6–7 / 10 / 15` for a
Strength 3D thrower. For Strength 1D they become `0–1 / 4 / 9`: Point Blank is
empty and zero meters counts as Short. The Weapon Attack dialog measures from
the thrower's active Token to the selected Token position, displays the
adjusted range band, and uses First Edition grenade-targeting difficulty 0 for
Point Blank, 10 for Short, 15 for Medium, or 20 for Long. The selected Token is
an aiming position; ordinary First Edition active defenses do not apply to the
throw itself. Blast placement, scatter, and affected targets remain GM
adjudication in this first bounded pass.

**Module: Alternate Wild Die** supplies one world selector for Core, Basic,
Classic, or Simple. The control is GM-only and affects the next Second Edition
roll immediately.

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

The GM-only **Creature Catalog** button appears under Token Controls. It lists
Creature profiles registered by authorized content modules, previews exact
Attributes, static defenses, included Items, scale, Magic Points, and source,
and creates one complete Creature Actor. The base catalog is deliberately empty
of named rulebook creatures and explains that an authorized companion is
required. Players do not receive the toolbar button or creation command.

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

Drag an Actor card by its grip to reorder it within a section or move it between
the Player Characters and Non-Player Characters sections. A moved Actor becomes
pinned, and the per-Gamemaster order, hidden Actors, pins, and section collapse
state survive a client reload. Existing Quickbar preferences created before
ordering was added are migrated without losing hidden Actors, pins, or collapse
state. At narrow window sizes the card labels truncate safely and the Actor list
scrolls inside the Quickbar instead of overflowing the Foundry viewport.

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
broadcast controls remain available. The configuration identifies that the
Gamemaster will roll locally, then opens the same requested-roll builder on the
GM client with the selected audience locked. Requests sent to a player are
versioned, acknowledge delivery, expire after five minutes, and are accepted
only when they come from an active GM to an owning non-GM player. Request
delivery is registered after Foundry's client socket is ready, and the system
manifest enables that channel. If the player client does not acknowledge
delivery, Active Tasks marks the request for Gamemaster takeover instead of
silently waiting forever. A second request for the same Actor score is rejected
while the first remains pending.

![A requested Perception roll configured for local Gamemaster control because no player owner is online.](../assets/manual/gm-request-local-fallback.png)

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

The advancement API exposes Attribute and existing-Item improvements plus
`advancement.specialization(actor, parentSkillId, name)` for the same protected
Second Edition specialization-acquisition transaction used by the character
sheet. `advancement.milestone` exposes read, award, and Perk-exchange commands;
`advancement.narrative` exposes read, propose, approve, step-toggle, complete,
and remove commands. Every command applies the same owner/GM and active-profile
checks as the sheet.

### Token Action HUD

Install and enable **Token Action HUD Core** and **Token Action HUD — D6 System
Second Edition** to expose the selected token's common actions without opening
its sheet. The adapter provides:

- the current round declaration, penalty, and next-action command;
- rollable Attributes and Skills;
- equipped character-weapon attack and damage rolls;
- equipped Vehicle and Starship weapon crew attacks and damage rolls; and
- available Trouble and Asset invocations with visible session-use counts.

The HUD uses the same protected system commands as the Actor sheet. Ownership,
revision conflicts, Trouble/Asset limits, Hero Point awards, declared-action
penalties, roll dialogs, and chat results therefore remain authoritative. A GM
may reset a combat declaration from the HUD when the underlying combat command
allows it. Machine weapon Attack opens the same assigned-gunner selection used
by the sheet; ownership and Starship minimum-crew penalties remain
system-authoritative.

Token Action HUD Core controls whether categories open on hover or click and
whether subgroups may remain collapsed. If a category is visible but its actions
are not, hover the category or enable **Click to Open** in Token Action HUD Core;
also expand any collapsed subgroup. These are personal HUD presentation
settings and do not remove the system actions.

Token Action HUD and companion modules remain presentation adapters. Dice So
Nice is optional and never changes rules resolution.

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
stores the shared Condition track. When a targeted Damage card names a Vehicle
or Starship, the GM-only **Resolve damage** action rolls this resistance, applies
the same Condition progression used for characters, and records Hull plus
protection and the outcome on the original card. Machine resolution does not
spend Hero Points, change personal posture, or forfeit a crew Actor's actions.

Machines do not naturally recover from Conditions. For Stunned, Wounded,
Incapacitated, or Mortally Wounded machines, **Repair machine** selects an owned
repairer and rolls Repair under Mechanical, falling back to untrained
Mechanical. The printed difficulties are locked at 10, 15, and 20 respectively
(Wounded and Incapacitated both use 15). Success removes the machine Condition;
failure leaves it unchanged. The book assigns no repair difficulty to
Staggered, Healthy, Dead, or other states, so those remain manual GM decisions.

Use **Add crew** on the Systems workspace to assign owned Character, Creature,
or NPC Actors. Crew entries open their source Actor and can be removed only
after confirmation. Select **Attack** on a mounted weapon to choose an assigned
gunner. The roll uses that Actor's Gunnery (or Mechanical when untrained), adds
the weapon attack bonus, and retains the crew Actor's action economy and Hero
Points. Starships automatically subtract 1D for every assigned crewmember below
their Minimum Crew (D62e pp. 177, 180, 182). The roll builder still derives
target, range, Defense, and scale from the machine and weapon, and the chat card
audits every contributor.

When the OpenD6 compatibility strategy is selected, Second Edition machine data
is preserved and clearly marked; it is not silently treated as First Edition
vehicle combat, and the Second Edition machine damage/repair actions are hidden.

### Creature defenses

Creature sheets normally derive Dodge and Parry like characters. In GM
**Free Edit**, the Combat tab also exposes optional static overrides. A positive
override replaces the derived value; zero restores the standard calculation.
This models the deliberate exceptions described on D62e p. 132.

### Bestiary Creature profiles

Creature profiles created from the GM **Creature Catalog** retain their catalog,
entry, owner, contract version, and printed source on the Combat workspace.
Their Attributes support the higher Die Codes used by the D62e bestiary without
raising the 5D character-creation maximum. Profiles also receive the campaign's
active Skill catalog and may include registered Armor, Gear, Manifestations,
Special Abilities, or Weapons. See D62e pp. 165–167.

![The GM Creature Catalog previewing a lawful source-cited profile.](../assets/manual/creature-catalog.png)

## 13. Current Boundaries

This alpha implements a substantial character, roll, advancement, Item, and
combat foundation, but it is not feature-complete. Important planned or blocked
areas include:

- chase Distance remains abstract and never moves Tokens because D62e pp. 73–74
  provide no spatial route or distance;
- named bestiary/templates supplied only by authorized content companions;
- later extranormal disciplines and genre modules;
- live player verification of crew-operated attacks from the Token Action HUD;
- licensed content supplied through approved companions.

The system deliberately leaves these visible as planned, deferred, or blocked
instead of filling gaps with rules from another D6 edition.
