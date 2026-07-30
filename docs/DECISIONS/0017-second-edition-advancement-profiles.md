# ADR 0017: Second Edition advancement profiles

## Status

Accepted; expanded by the schema 13 Milestone and Narrative vertical slice.

## Context

D62e presents three mutually exclusive advancement modules: Experience Points
(pp. 86-88), Milestone Character Advancement (pp. 90-91), and Narrative
Advancement (pp. 92-93). They do not share a currency or transaction model.
Module: Pips changes the size and cost sequence of XP improvements (pp. 88,
94-95). Advanced Skills cost twice as much and remain capped by their
prerequisites (p. 97).

## Decision

- Store the campaign selection as
  `secondEditionAdvancementStrategy`.
- Preserve `unselected`, `experience-points`, `milestone`, and `narrative` as
  distinct capability strategies.
- Experience Points, Milestone, and Narrative use independent state and
  commands. Milestone stores Attribute dice and canonical Skill pips;
  Narrative stores reward-linked, GM-approved arcs and ordered steps.
- Store `resources.experiencePoints.value` independently from Hero Points and
  latent OpenD6 Character/Fate Points.
- Let GMs award or correct XP from the resource header in any sheet mode.
  Player writes remain rejected; purchases still require Advance mode.
- Keep canonical pip storage. An XP improvement is +1D by default or one
  sequential pip with Module: Pips. A deliberate whole-die purchase normalizes
  a dormant stored modifier instead of carrying an inactive modifier into the
  new die.
- Route OpenD6 Character Point and Second Edition XP transactions through the
  same public commands but return a discriminated strategy and resource.
- Do not allow XP to increase a Second Edition Specialization: p. 99 defines
  acquisition, a fixed +1D bonus, and a separate cost rather than repeated
  improvement.

## Consequences

Changing the campaign strategy never converts or deletes another strategy's
stored data. Schema 13 supplies the dedicated Milestone and Narrative state
model; Specialization acquisition remains its separate p. 99 transaction.
