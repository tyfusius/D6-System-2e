# ADR 0010: Character creation and optional Skill module

Status: accepted  
Date: 2026-07-27

## Context

Second Edition core character creation assigns 12D among four Attributes, with a
1D minimum and 5D creation maximum, and permits up to 7D of Skill allocations.
Each additional Attribute adds 3D to the Attribute budget. Each optional Skill
module selected by the campaign adds 2D to the Skill budget (printed p. 20).

The optional Skill Specialization & Advanced Skills module uses different pool
and relationship rules (printed pp. 96-99):

- Advanced Skills have two or more standard prerequisite Skills, cannot be
  attempted untrained, use their own rating when rolled alone, and cannot exceed
  the lowest prerequisite.
- A prerequisite's required 3D rating is the Skill's own rating, excluding its
  governing Attribute. This matches the printed distinction between a Skill
  rating and the complete Attribute + Skill die code.
- Up to 2D of the creation Skill budget may be assigned to Advanced Skills.
- Spending 1D of creation Skill budget provides up to three +1D
  Specializations. A Specialization is linked to one standard parent Skill and
  does not automatically increase with it.

## Decision

New native Second Edition `character` Actors start with a persistent
`system.creation.active` marker. Existing and imported Actors migrate with the
marker inactive. Creation mutations use named, owner-checked services rather
than opening Normal mode to direct pip editing.

Creation controls change Attributes and Skills in whole-die increments by
default. Module: Pips changes them to one-pip increments and finalization audits
the separate two-die split limits for Attributes and Skills (ADR 0015). Finalization is
permitted only after deterministic validation. Finalization removes creation
controls and restores the Normal-mode mechanical write boundary.

The optional Skill module has an explicit world setting. The separate
`Additional Skill modules` setting records the number of campaign modules that
actually grant the p. 20 bonus; optional Attribute selection is not silently
counted as a Skill module.

Stable relationships store both an embedded parent ID and a stable Skill key.
The ID is used inside the current Actor; the key supports import and repair.
Specialization Items use their narrow focus as the Item name, such as `Parkour`,
while the relationship identifies `Acrobatics` as the parent Skill.

## Consequences

- The familiar od6s-next creation-budget panel and finalization workflow are
  retained without treating First Edition creation budgets as rules authority.
- Normal mode remains non-editable after creation, including for players.
- Advanced Skills and Specializations can be represented even when the optional
  module is disabled, but creation controls and Second Edition validation are
  activated only by the module setting.
- Advanced Skill augmentation of a prerequisite's ordinary roll is implemented
  through the explicit task-context selection accepted in ADR 0013. Standalone
  Advanced Skill and linked Specialization pools remain distinct.
