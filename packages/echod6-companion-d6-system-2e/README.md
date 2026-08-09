# The Echo D6 Companion

## Echo

One moment you were living an ordinary life. The next, you awaken at Authority
Arrival among bewildered newcomers drawn from countless worlds and are given a
choice: adapt… or disappear.

Assigned to the aging traversal vessel _The Wayward_, your new life begins upon
the Drift—the mysterious expanse between realities. Every expedition may reveal
a forgotten civilization, an impossible treasure, an ancient predator, or
another piece of the truth behind your arrival.

Echo is a campaign of exploration, mystery, and high adventure across realms
inspired by history, mythology, pulp adventure, and science fantasy. Read the
complete setting introduction in [`SETTING.md`](SETTING.md).

The companion includes a cinematic campaign landing image at
`art/scenes/echo-start-scene.png` and a ready-to-import **Echo Main** Scene that
uses it.

![The Wayward crossing the Drift](art/scenes/echo-start-scene.png)

## Foundry module

This Foundry VTT v14 companion ports the existing Echo D6 companion to
**D6 System Second Edition** as a separately installed private setting module.
It is not stock system content and does not require an Open D6 genre module.

The module contributes a Second Edition-derived Echo Rules Profile, an immutable
Echo Setting Profile, a discoverable named Profile Preset, and a matching burnished
bronze, warm ivory, and near-black Echo theme whose paused-game rings contain
the Echo logo, selected-only terminology and item/roll branding, and a GM action that applies the
module's recommended profile pair. It uses only the versioned
public system API and does not read or write private system settings.

## Use

1. Install the companion archive separately, then enable **The Echo D6
   Companion** in Manage Modules.
2. Open System Settings and select the **Echo D6** Setting Profile. Its logo and matching registered
   theme become the world presentation automatically; each player may still
   choose a different **Personal theme**.
3. To adopt the complete Second Edition-derived Echo setup, choose **Echo D6
   Recommended Rules** in
   the root **Profile Presets** card and select **Review & Apply**. The module
   setting **Apply Echo Recommended Rules** remains a compatibility route. Both
   explicitly select Echo's Rules Profile and Setting Profile through the
   system's version-1 atomic Profile Preset
   transaction. Both targets validate before persistence, unchanged selections
   are skipped, and failure restores the prior pair. It remains separate from
   each player's personal theme override.

Echo terminology and item/roll branding are inactive until the module's
registered **Echo D6** Setting Profile is selected. That Setting Profile
supplies the Character-sheet and paused-game logo, matching world presentation,
Attribute projection, vocabulary, and Wild Die presentation. Enable **Logo as
watermark** in a world-owned copy for the large diffused cross-section
treatment, or disable it for a crisp logo contained in the Mode row.

The selected Setting Profile labels the system-owned Credits, Faction Allegiance,
vehicle/starship toughness, interstellar-drive, manifestation, and Metaphysics
surfaces. It does not add private Actor fields or calculate rules.

## Compendiums

The module adds a **Setting Companions → Echo D6** Compendium folder with:

- a ready-to-import **Echo Scenes** pack containing **Echo Main**; and
- source-built distribution packs for **Characters**, **Character Templates**,
  **Equipment**, **Powers**, and **Vehicles & Starships**.

Do not use the installed module packs as a campaign workshop. Foundry module
updates replace the installed module directory and can discard direct edits to
unlocked bundled packs. Create world compendiums for campaign-authored
Characters, templates, equipment, powers, Vehicles, Starships, and Scenes; world
documents and world compendiums live outside the module and survive system and
module updates. Content intended for a later Echo release must be exported from
the world and added to this repository's source-backed content before building
the release.
