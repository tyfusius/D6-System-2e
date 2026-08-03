# Open D6 First Edition content roadmap

Audit date: 2026-08-03.

This ledger closes the ambiguity around “First Edition support.” The base system
already supplies shared First Edition mechanics and a 60-entry description-free
Skill pack. It does **not** yet supply the three genre books' equipment,
characters, creatures, templates, powers, vehicles, or other setting content.
Those belong to separate Foundry genre modules selected explicitly by the GM.

## Source and distribution boundary

| Package   | Authoritative supplied PDF                                     | Printed content boundary | Public distribution status                                                                                                                                                                                                         |
| --------- | -------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adventure | `weg51011e-West_End_Games-D6 Adventure.pdf` (145 PDF pages)    | D6A printed pp. 3–144    | Mechanics may be implemented with original summaries and page references. This supplied PDF does not contain an OGL declaration, so named/descriptive content waits for permission or a separately verified license.               |
| Fantasy   | `weg51013e-West_End_Games-D6 Fantasy_v1.3.pdf` (145 PDF pages) | D6F printed pp. 3–143    | Mechanics may be implemented with original summaries and page references. This supplied PDF does not contain an OGL declaration, so named/descriptive content waits for permission or a separately verified license.               |
| Space     | `weg51012OGL-D6-Space.pdf` (146 PDF pages)                     | OD6 printed pp. 3–145    | Printed p. 145 includes OGL 1.0a and identifies all mechanics and material outside the stated Product Identity as Open Game Content. Public records must still exclude logos, trade dress, art, protected marks, and copied prose. |

This is a repository content policy, not legal advice. Every shipped record must
retain its source page, use concise original wording, and pass the public-content
verifier. Generic mechanics are not permission to reproduce protected names,
descriptions, art, examples, or layout.

## Finite source ledger

| Package   | Content families and printed pages                                                                                                                                                                                                                                                      | Target Foundry surfaces                                                                                                                  |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Adventure | Character options pp. 15–42; magic and spell design pp. 83–96; precalculated spells pp. 97–103; psionics pp. 104–111; equipment and vehicles pp. 112–120; generic people/animals/monsters pp. 126–127; nine templates pp. 128–137                                                       | Feature catalogs, Magic/Psionics contributions, Equipment Items, Vehicle Actors, Bestiary Actors, Character Templates                    |
| Fantasy   | Character options pp. 15–41; non-human races pp. 42–43; magic and spell design pp. 83–96; precalculated spells pp. 97–102; miracles pp. 103–112; equipment and vehicles pp. 113–119; generic people/animals/monsters pp. 125–126; ten templates pp. 128–137                             | Feature and ancestry catalogs, Magic/Miracle contributions, Equipment Items, Vehicle Actors, Bestiary Actors, Character Templates        |
| Space     | Character options pp. 15–40; aliens and human offshoots pp. 41–44; cybernetics pp. 45–51; space travel pp. 68–71; metaphysics pp. 95–102; equipment, robots, and planetary vehicles pp. 103–113; ship design pp. 114–120; generic people/animals pp. 126–127; ten templates pp. 128–137 | Feature and ancestry catalogs, Cybernetic/Equipment Items, Metaphysics contributions, Robot/Vehicle/Starship Actors, Character Templates |

The package passes must also audit genre-specific skills, combat differences,
creation budgets, terminology, and default presets. Rules are never inferred
from another genre book merely because the books share a common engine.

## Legacy evidence, not shipping authority

The installed `od6s` and `od6s-next` systems contain the same legacy collection:
60 Skills, 61 Weapons, 21 Armor, 22 Gear, 15 Natural Items, 13 Cybernetics, 24
Advantages, 44 Disadvantages, 54 Special Abilities, three Metaphysics Skills,
eight Vehicles, three Character Templates, and 12 Macros. Their declared
Starship and vehicle/starship equipment packs are empty.

Those records are useful parity evidence but are not copied automatically. Each
new package record must be reconciled against its own authoritative PDF,
translated into the current typed schemas, given lawful original presentation,
and verified independently.

## Package activation contract

The base system owns campaign-package validation, registration, selection, and
diagnostics. A Foundry module registers one immutable versioned manifest through
`game.system.api.campaignPackages.register(moduleId, manifest)`.

- A module being enabled means its contribution is **available**.
- A GM explicitly selects one genre and, optionally, one compatible companion in
  **Open D6 First Edition** settings.
- Missing stored selections remain visible as diagnostics instead of silently
  falling back to another installed package.
- API-version, rules-family, compatibility, and declared conflicts are validated.
- Foundry module load order never chooses campaign rules.

## Completion order

1. Shared package registry, resolver, world selection, diagnostics, API, and
   settings empty state — implemented by the content-closure foundation pass.
2. **D6 Space public content — complete.** The installable genre module ships
   277 bounded mechanical records across ten deterministic packs and registers
   its manifest, equipment, template, and First Edition bestiary catalogs.
3. **D6 Fantasy — foundation and four core packs complete.** Schema 41 and the
   First Edition genre-profile registry activate the seven Fantasy Attributes,
   semantic initiative/knowledge/Strength roles, 54 Skills, 26 common equipment
   records, 14 pp. 125–126 generic profiles, and all ten templates. The next
   bounded pass closes ancestry/character-option contributions, the remaining
   equipment/vehicle table, and a truthful First Edition Magic/Miracles surface;
   protected prose, examples, art, and names remain excluded.
4. D6 Adventure lawful public mechanics and original/generic content; protected
   named content remains permission-gated.
5. Cross-package onboarding, GM/player selection acceptance, clean install and
   upgrade acceptance, then Beta 1 release-candidate packaging.
