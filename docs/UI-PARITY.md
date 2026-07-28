# OpenD6 Next UI parity

OpenD6 Next is the canonical design implementation for every equivalent
D6 System Second Edition interface. Second Edition changes rules, terminology,
available fields, and workflows; it does not introduce a lower-fidelity or
parallel visual language.

## Review contract

For an equivalent surface, review the two systems at the same dimensions and
with the OpenD6 Classic theme. Match:

- ApplicationV2 window treatment and header controls;
- Avenir Next body typography and Avenir Next Condensed display typography;
- spacing, density, borders, radii, shadows, and semantic colors;
- component hierarchy, tabs, buttons, inputs, focus states, and empty states;
- portrait, dice, Wild Die, and chat-card presentation;
- narrow-layout and keyboard behavior; and
- loading, disabled, validation, and asynchronous states.

Rules-driven controls may differ only where the Second Edition domain model
requires them. New controls must be composed from the existing OpenD6 Next
component language. A visible difference without a documented reason is a
defect.

## Surface inventory

| Second Edition surface                                   | Canonical OpenD6 Next source                                                            | Current contract                                                                                  |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Character sheet shell, header, portrait, utilities, tabs | `templates/actor/v2/character/*`, `.od6s-character-v2`, `.od6v2-*`                      | Canonical classes active; Second Edition fields and modes are rules-driven extensions             |
| Attributes and Skills                                    | `character/attributes.hbs`, `.od6v2-attribute-*`, `.od6v2-skill-*`                      | Canonical cards, scores, actions, and responsive grid                                             |
| Biography                                                | `character/biography.hbs`, `.od6v2-writing-*`                                           | Canonical writing panels with Second Edition labels                                               |
| Traits and equipment                                     | `character/inventory.hbs`, `.od6v2-section`, `.od6v2-item-*`                            | Canonical item rows and controls; Second Edition item families differ                             |
| Combat                                                   | `character/combat.hbs`, `.od6v2-*` combat components                                    | Canonical panels and condition colors; action-segment behavior is Second Edition-owned            |
| Item sheets                                              | `templates/item/v2/*`, `.od6s-item-v2`, `.od6item-*`                                    | Canonical ApplicationV2 shell and field components                                                |
| Roll builder and follow-up dialogs                       | `templates/roll/*`, `.od6roll-dialog`, `.od6roll-*`                                     | Canonical cinematic shell; controls reflect the active edition profile                            |
| Chat cards                                               | `templates/roll/chat-card.hbs`, `.od6chat-*`                                            | Canonical structured card, dice row, Wild Die, totals, status, and actions                        |
| GM Quickbar (legacy internal `pc-quickbar` identifiers)  | `templates/apps/pc-quickbar.hbs`, `.od6-pc-quickbar`, `.od6pc-*`                        | Exact component and Token Controls toolbar contract; visible name covers PCs, NPCs, and creatures |
| Active Tasks & Requests                                  | `templates/apps/active-tasks-quickbar.hbs`, `.od6-active-tasks-quickbar`, `.od6tasks-*` | Exact component and GM Token Controls toolbar contract                                            |
| Settings applications                                    | `templates/settings/v2/settings.hbs`, `.od6s-settings-v2`                               | Canonical window and form controls; edition capability panels extend the same tokens              |
| Foundry chrome touched by the system                     | global system-scoped OpenD6 Next rules                                                  | Canonical palette, typography, sidebar, players, and hotbar treatment                             |

## Change gate

Every user-facing change must:

1. identify the matching OpenD6 Next component before markup is written;
2. reuse its canonical class and token contracts;
3. document any necessary deviation in this file or an ADR;
4. pass package invariants that reject known parallel design classes;
5. receive a same-size visual comparison in Foundry; and
6. update the user manual and affected screenshots.
