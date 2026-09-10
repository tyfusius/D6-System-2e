# 1876 Companion

An initial campaign foundation for **1876**, a non-supernatural Western, using
D6 System Second Edition's existing OpenD6 support.

Enable this Foundry module, then open **Campaign Setup** and explicitly select
**1876 — Initial Campaign**. It pairs **1876 — Initial Rules** with the **1876**
Setting Profile. Enabling the module alone does not select profiles or change
Actors, Items, world settings, or campaign content.

## Gold and Outlaw appearances

The existing **1876** Setting Profile keeps the gold logo and palette.
**1876 — Outlaw** adds the supplied red logo with warm-black surfaces and
readable red accents. Both use the same 44 skills, attribute vocabulary, display
font and Wild Die presentation.

The GM can choose either through the existing Setting Profile selector without
changing the Rules Profile. A personal theme override still controls that user's
colors; choose the inherited theme to follow the selected Setting palette. The
shared logo follows the Setting choice. Reapplying **1876 — Initial Campaign**
selects the original gold profile, as before. Enabling the companion makes both
appearances available without automatically selecting either one.

## Supported in this foundation

- Existing First Edition segmented actions and the system's round grid.
- Rolled initiative compares tied totals using full base Perception, including
  pips. Only characters still tied compare full base Reflexes, including pips.
  A differing Perception rating resolves the tie even when Reflexes is unavailable.
  If an active attribute needed at the current step is missing, the system reports
  it and keeps those characters in their existing order. Agility, Dexterity,
  improved skills and inactive default ratings are not substitutes. Completely
  tied participants keep the existing order; no additional tie die is introduced.
- The current working six-attribute mapping in book order: Reflexes, Coordination,
  Physique, Knowledge, Perception, Presence. The Rules Profile explicitly binds its
  genre contribution, with Perception initiative, Physique strength, Knowledge
  knowledge, and budgets of 18D/54 attribute pips and 7D/21 skill pips.
- All 44 concrete skills: 35 other core skills, eight independent Handling fields,
  and elective Blowguns. Descriptions preserve learned professional scope. These
  use standard skill costs and attribute-inclusive pools; no advanced-training
  category or automatic permission grant is inferred.
- The manuscript difficulty ladder: 5, 10, 15, 20, 25, 30. The six existing tier
  IDs remain stable, with the top tier labelled Exceptional. Routine work usually
  needs no roll. Ordinary movement, health and resources retain existing engine
  behavior.
- The official local 1876 logo, website heading font and dark gold-and-bone
  palette. Bleeding Cowboys is used for headings; body text and controls retain
  the readable D6 Humanist font. Setting presentation never selects mechanics.

## Still outside this foundation

The six attributes, skill catalogue, budgets and difficulty ladder are adopted
from the current working draft for this bounded setup. The attribute architecture
and Demolition's Knowledge mapping remain provisional in the authoring project.
Further numerical creation, injury, medicine, reputation and firearm rules are
not adopted by this package. The accepted
initial attack Wild Die hit-location rule is not automated. Dynamite, horses,
weapons, talent trees, automatic career/upbringing grants, broad compendiums and
specialized sheets are not included. Emergency Dodge, Hold, the proposed
wound penalty refinement, Cycling and hip/pointed/sighted/Aim refinements are excluded.

The ordinary system action labels/icons describe existing actions; the companion
does not add actions or firearm state transitions. Existing Items and Actors keep
their data. Changing or removing this module does not migrate character data.

## Integration

Package ID: `western1876-companion-d6-system-2e`. Rules and preset ID:
`western-1876-initial`. Setting ID: `western-1876`.

The entry point registers inert Rules Profile v5, Setting Profile v5 and Profile
Preset v1 contributions through D6 System public API v2. Its display-only font
contribution and First Edition genre v1 are registered before the profiles use
them. The Rules Profile's versioned genre reference owns activation; the Setting
Profile keeps the complete system attribute vocabulary and supplies the 44 skills.
The genre's skill list stays empty because the manuscript is unpaginated and the
Setting catalogue is authoritative for this bound profile. The base system owns
execution, storage, permission checks, diagnostics and Campaign Setup selection.
There are no private system imports, companion settings, callbacks in profile
data, injected controls or alternate rules engine. Core supplies the generic
`open-d6.initiative.perception-reflexes` strategy in the same integrated candidate.

No persistent schema change or migration is introduced. There are no pack or
release URLs; this package has not been published. The Supervisor owns combined
validation and native GM/player/reload acceptance.

## Source and status

The canonical 1876 manuscript is `drafts/draft-01/1876-RULEBOOK-DRAFT-01.md`
in the separate 1876 authoring project. Its `AGENTS.md`, `docs/VISION.md` and
`docs/DESIGN-LEDGER.md` govern status. Decision 1876-112 accepts the base-attribute
tie order; 1876-114 accepts the hit-location rule, which remains outside this
implementation. A complete candidate rulebook is not wholesale mechanical
acceptance. The bounded attribute/skill catalogue and difficulty setup now follow the user's
explicit current-working-rules request; this does not accept the complete book.
[CATALOG.md](CATALOG.md) records the mapping, scope and source status;
[catalog-provenance.json](catalog-provenance.json) pins the exact source hashes and
all 44 extracted skill mappings.

Logo provenance is recorded in [art/PROVENANCE.md](art/PROVENANCE.md).
Typography and palette sources are recorded in
[art/fonts/PROVENANCE.md](art/fonts/PROVENANCE.md).
