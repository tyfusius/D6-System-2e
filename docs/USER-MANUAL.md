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

Native Second Edition uses contextual initiative rather than a separate
Perception roll. The Combat Tracker therefore hides initiative-roll controls.
The Gamemaster can drag combatants by the grip beside their name, or use the
adjacent move-earlier and move-later buttons, to set the encounter's practical
tracker order. Players can see that order but cannot change it. The order is
stored on that Combat and survives reopening the tracker.

Enable **Use First Edition Initiative Rolls** to use a conventional tracker
order instead. Each combatant rolls Perception, including its Wild Die and
pips, and Foundry sorts the results. The complete OpenD6 preset enables this
option by default, while a Second Edition or custom campaign may enable it
independently.

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

The Gamemaster approves a draft before its steps can be checked. Once every
approved step is complete, only the Gamemaster can grant the +1D reward. If the
target rating changed after approval, the stale arc is rejected rather than
granting an ambiguous increase. Draft, approved, and completed arcs persist on
the Actor (D62e pp. 92–93).

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
does not move the Token automatically. See D62e p. 32.

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
the Combat tab provides land, swim, climb, and fly/zero-G planning. Up to half
the relevant movement rate is free. Longer movement is an action; terrain and
extended distance determine difficulty. The planner enforces the four-times-
rate cap and posts a chat audit. A non-free move spends a tracked flexible
action when a commitment exists, while verbal/manual table play does not force
a tracker commitment. When the printed movement rules require a check, the
planner opens Running, Swim, Climb/Jump, or Flying/0-G with the difficulty
fixed. If the Skill is absent, it rolls the governing Agility or Strength
Attribute. Cancelling that check does not spend the action. See D6S pp. 63–64.

**Manual table workflow** hides both edition trackers. Players can always tell
the Gamemaster their actions and enter the agreed MAP directly in the roll
builder.

### Static defenses

The Combat tab derives:

- Dodge from full Perception dice; and
- Parry from full Agility dice.

These are derived presentation values, not stored character scores. See D62e
pp. 21, 33.

The posture control records Standing or Prone. A prone target gains +10 Dodge
against ranged attacks, while Dodge and Parry are capped at 10 against melee
attacks. Wounded and more severe Conditions put the Actor prone. The Combat tab
shows both the current posture and the resulting defense context.

### Targeted attacks and range

When the acting character has a token on the current Scene, a weapon Attack
dialog lists the other character, NPC, and creature tokens. A currently
targeted token is preselected. The dialog measures distance, shows the weapon's
short, medium, or long range band (or melee adjacency), and sets the correct
static Dodge or Parry as the difficulty. An attack must exceed that defense;
equality fails. Out-of-range attacks are stopped before dice are rolled.

For a targeted Second Edition ranged Attack, **Cover defense modifier** accepts
the nonnegative flat value adjudicated by the Gamemaster. It adds to the
target's already-derived Dodge and updates the displayed difficulty before the
roll. The book explains taking Cover but supplies no fixed Cover values (D62e
p. 30), so the system offers no quarter/half/full presets and does not infer a
modifier from Token position. The public chat audit shows
`base Dodge + Cover = effective defense`. This control does not appear for
melee, Damage, resistance, or First Edition rolls.

The resulting chat card and structured roll flags retain the target, weapon,
range, distance, and defense for audit. A targeted weapon Damage roll adds a
GM-only **Resolve damage** action to its chat card. Players can roll and see the
result, but only a GM can resolve and apply it.

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
  Skill-module count, starting Hero Points, and automatic bookkeeping.
- **Module: Additional Attributes** (pp. 62-68) contains Charm, Mechanical,
  Technical, Mysticism, and Magic.
- **Advancement modules** (pp. 86-93) selects no more than one of Experience
  Points, Milestone Character Advancement, or Narrative Advancement.
- **Module: Pips** (pp. 94-95) enables `+1` and `+2` Die Code steps.
- **Module: Skill Specializations & Advanced Skills** (pp. 96-100) enables the
  supported granular Skill structures.

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
Perception-based tracker initiative and the native Second Edition GM-controlled
contextual order. The tracker refreshes immediately when this option changes.
Both restricted edition menus expose the same **Action declaration assistance**
choice so the table workflow is easy to find without duplicating its world
state. It is intentionally absent from players' native Game Settings.

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

## 13. Current Boundaries

This alpha implements a substantial character, roll, advancement, Item, and
combat foundation, but it is not feature-complete. Important planned or blocked
areas include:

- optional Body Points rescue;
- alternate initiative, Wild Die, and defense modules;
- automatic token movement and chases;
- powers and extranormal disciplines;
- live player verification of crew-operated attacks from the Token Action HUD;
- licensed content supplied through approved companions.

The system deliberately leaves these visible as planned, deferred, or blocked
instead of filling gaps with rules from another D6 edition.
