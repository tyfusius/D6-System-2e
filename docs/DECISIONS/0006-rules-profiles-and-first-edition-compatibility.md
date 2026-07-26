# ADR 0006: Rules profiles and First Edition compatibility

Status: Accepted

## Context

D6 System Second Edition deliberately changes several OpenD6 rules while also
describing modular alternatives. Campaigns need to choose those behaviors without
forking schemas, copying sheets, or making a companion module an alternate rules
engine. OpenD6 Space and future Star Wars/Echo companions also need a lossless
import and presentation boundary.

## Decision

The system owns a typed `RulesProfile`. Seven independent world switches select:

- success evaluation;
- Wild Die strategy;
- meta-currency economy;
- active versus static defenses;
- damage and wound strategy;
- advancement strategy;
- active attribute profile.

`Use OpenD6 Rules` is a convenience preset. Turning it on enables every verified
First Edition switch; turning it off restores every Second Edition default.
Changing an individual switch afterward produces a `custom` profile. It does not
silently rewrite other switches.

The schema is a union of supported data, not a separate schema per edition. Latent
fields remain preserved while inactive. Rules services select behavior from the
resolved profile; sheets, chat cards, HUDs, and companions only consume the result.

Companions may apply a profile through API v1 and register owner-scoped terminology
and themes. They do not implement the evaluator, Wild Die, currency, damage, or
advancement strategies.

## Evidence

- D6 System Second Edition v1.1 p. 26 explicitly uses strict greater-than while
  noting that other D6 games use meets-or-beats.
- D6 System Second Edition v1.1 pp. 26-28 defines its core Wild Die and Hero Point
  economy.
- OpenD6 Space pp. 55-57 defines the classic Wild Die plus separate Character and
  Fate Point economy.

## Consequences

Switching profiles does not delete Hero, Character, or Fate Points and does not
rename stable attribute IDs. The First Edition attribute profile activates
Mechanical and Technical; a companion can display `brawn` as Strength or `agility`
as Dexterity through terminology registration.

Each strategy still requires its own domain service and tests before the setting
can advertise full automation. The settings foundation is not a claim that combat,
damage, Wild Die dialogs, advancement, or importers are already complete.
