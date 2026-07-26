# Parity and scope

OpenD6 Next is a reference for architecture, UX, integrations, and migration
discipline. It is not a Second Edition rules source.

## Concept mapping

| OpenD6 Next concept              | Second Edition treatment                                                      |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `agi`                            | Map candidate to stable `agility`                                             |
| `str` Strength                   | Not automatic; mapping candidate to `brawn` with report                       |
| `kno`, `per`                     | Map candidates to `knowledge`, `perception`                                   |
| Mechanical, Technical            | Optional attributes, not core defaults                                        |
| Metaphysics attribute            | No one-to-one assumption; Magic, Mysticism, and Psionics are distinct modules |
| Character Points and Fate Points | Absent from core; Hero Points are the core resource                           |
| Legacy Wild Die                  | Replaced by Second Edition core or selected alternate policy                  |
| Active defenses                  | Core uses static Dodge and Parry                                              |
| Wounds/body points               | Do not import as equivalent; Second Edition condition mapping needs study     |
| Action-pass scheduler            | Architecture reference only; not copied                                       |
| Vehicle/starship documents       | Concepts retained, schemas rebuilt from pp. 176-183                           |
| Themes and terminology           | Registry pattern retained and refined                                         |
| Token Action HUD                 | Separate adapter consuming public API                                         |
| Dice So Nice                     | Optional presentation integration                                             |

## Feature classification

### Retain as architecture

- pure domain layer;
- versioned contracts;
- application/Foundry ports;
- typed read models;
- ordered migrations;
- ApplicationV2-only UI;
- a single roll pipeline;
- registry-based companion contributions;
- thin HUD adapter;
- structured chat state.

### Rebuild from Second Edition

- dice and Wild Die flow;
- Hero Points;
- attributes and skills;
- defenses;
- damage and conditions;
- initiative and action segments;
- advancement;
- powers;
- vehicles and starships;
- item names and schemas.

### Defer pending authority or licensing

- damage mortal-wound trigger;
- distributable skill/equipment/template content;
- publisher logos and trade dress;
- public product naming/trademark usage;
- automated OpenD6 Next import.

## Import study categories

Future mapping reports classify every field as:

- exact;
- transformable without loss;
- transformable with user choice;
- preserved but inactive;
- unsupported and preserved;
- unsafe and rejected.

No world is migrated in place without backup and dry run.

## First milestone exclusions

The character vertical slice intentionally excludes combat automation, damage,
active effects, advancement spending, powers, vehicles, starships, compendiums,
HUD, Dice So Nice, and OpenD6 Next importing.
