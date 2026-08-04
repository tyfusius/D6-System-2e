# ADR 0022: Modular content packages and multiple active settings

Status: Accepted; Phases 1–2 implemented

Date: 2026-08-04

## Context

The base system currently owns Second Edition Skills, Open D6 compatibility
Skills, general Second Edition equipment, Second Edition Fantasy creatures and
templates, and the user manual. Open D6 Fantasy, Open D6 Space, and Echo already
ship as separate Foundry modules.

System-owned compendiums appear in every world using the system even when their
genre is irrelevant. This increases setup clutter, couples content updates to
the rules engine, and does not match campaigns that need only one genre. At the
same time, multiverse campaigns must be able to activate and use content from
several settings together.

Second Edition catalogs 41 printed rules components across four families: 18
Core, six Fantasy, eight Science Fiction, and nine Superheroic. Those rules
components are not suitable as 41 independently installed Foundry modules.

## Decision

### Base system boundary

The `d6-system-2e` Foundry system owns:

- rules calculation, resolution, and validation;
- data models, migrations, sheets, applications, settings, sockets, and public
  contribution APIs;
- shared presentation, onboarding, and the user manual; and
- safe fallback behavior when no content module is active.

Setting-specific compendiums and assets move out of `system.json`. The rules
engine retains the capability to interpret every supported setting, but no
content module becomes an alternate rules engine.

### Foundry content modules

Second Edition content is organized into four Foundry modules:

1. **D6 System Second Edition — Core Content**
2. **D6 System Second Edition — Fantasy**
3. **D6 System Second Edition — Science Fiction**
4. **D6 System Second Edition — Superhero**

Their internal settings continue to expose the complete 41-entry printed rules
component catalog and its dependency data. The Superhero module includes the
complete pp. 204–239 family: Skills, Hero Points, Die Code caps, Secret
Identities, Superpowers, Gadgets and Gear, Hidden Bases, Nemeses/Companions/
Sidekicks, and templates. Science Fiction includes Skills, Starships, Vehicles,
Psionics, Cyberpunk, Scale, bestiary, and templates. Fantasy includes Skills,
both Magic approaches, Active/Responsive Combat, bestiary, and templates.

Open D6 First Edition content is organized as Core Content plus the distinct
Adventure, Fantasy, and Space genre modules. Setting companions such as Echo,
Star Wars, Ghostbusters, Talislanta, Zorro, and Men in Black remain separate
modules layered onto compatible genre modules.

### Availability, activation, and rules selection

The following states remain independent:

- **Installed modules:** packages available on the Foundry server.
- **Active content modules:** any number enabled for the current world; their
  compatible compendiums and assets are available together.
- **Primary rules profile:** one explicit baseline for rules resolution.
- **Imported mechanics:** explicit compatible mechanics selected from other
  active modules.

Activating a Foundry module never silently changes world rules, themes, or the
primary profile. A module may offer **Apply Recommended Settings**, but applying
that preset requires a clear GM action and confirmation. Content remains usable
without applying every rules recommendation.

This permits a Fantasy-primary multiverse campaign to activate Fantasy, Science
Fiction, Superhero, and Echo content while importing only selected mechanics,
such as Starships, Psionics, or Superpowers.

### Installation and relationships

Foundry systems and modules remain separate packages. Modules are not nested
inside the system archive. The system may declare optional recommended-module
relationships with manifest URLs, and each content module declares support for
`d6-system-2e`. Required relationships are reserved for genuine functional
dependencies; optional settings must not force-install every genre.

The onboarding surface detects active official content modules, explains an
empty-content world, and directs the GM to module management. It never attempts
to alter Foundry Setup state from an in-world application.

### Migration and compatibility

Extraction must preserve stable pack names, document IDs, source provenance,
drag/drop behavior, Actor compatibility, and existing compendium UUID links
where technically possible. Any unavoidable UUID change requires an explicit
migration or compatibility alias and a documented upgrade test.

Implementation proceeds serially through the shared package contracts before
genre work is delegated:

1. package contracts and Second Edition Core Content extraction;
2. Second Edition Fantasy extraction;
3. Second Edition Science Fiction packaging;
4. Second Edition Superhero packaging;
5. First Edition Core/Fantasy/Space/Adventure relationship alignment;
6. multiple-active-content, primary-profile, imported-mechanics, onboarding,
   clean-install, and upgrade acceptance.

Phase 1 shipped the version-1 multi-active content-package registry, the
primary-profile/imported-mechanics read contract, empty-content onboarding, and
the separately activatable `d6-system-2e-core-content` module. It owns the
existing Second Edition Skills and Equipment pack names and document IDs.
Schema 44 and runtime UUID normalization alias their former system-pack
namespace to the new module namespace.

Phase 2 extracted the unchanged Second Edition Fantasy Creatures and Character
Templates packs into `d6-system-2e-fantasy`. Schema 45 and runtime UUID
normalization alias their former system-owned namespace. The module registers
the `fantasy` family and advertises the existing `fantasy-skills-magic` rules
group without applying it; activation therefore leaves the primary profile and
every optional Fantasy mechanic unchanged.

## Consequences

- Installing the system no longer fills every world with unrelated setting
  compendiums.
- A normal campaign activates only the content it needs, while multiverse worlds
  may activate several settings simultaneously.
- Content packages can release independently from the base rules engine.
- Module activation and rules activation require separate tests and separate
  user-facing explanations.
- D6 Adventure content implementation follows this architecture instead of
  preceding it.
- Deferred roll-request presentation remains a separate subsequent feature with
  the labels **Open Roll Window** and **Highlight on Character Sheet**.
