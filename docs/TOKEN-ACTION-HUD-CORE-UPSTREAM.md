# Token Action HUD Core startup race

## Environment

- Foundry Virtual Tabletop 14 Build 365
- Token Action HUD Core 2.1.1
- socketlib 1.1.4
- Token Action HUD — D6 System Second Edition 0.1.0
- One active GM client and one owning player client

Core 2.1.1 is the latest official release as of 2026-07-29. The same affected
code path remains on the upstream `main` branch.

## Reproduction

1. Open an authenticated GM client and an authenticated player client in the
   same world.
2. Select an owned token on the player client so Token Action HUD requests its
   customized layout data from the GM.
3. Reload both clients together.
4. Inspect the GM console during module startup.

The GM can receive the player's buffered `getData` socket request after Core has
registered its socket handlers but before Core has assigned
`game.tokenActionHud.dataHandler`. Core's static `getDataWithSocket` handler
dereferences the missing handler and socketlib reports an exception. Core later
finishes initialization and both HUDs work.

## Root cause

Core registers `getDataWithSocket` on `socketlib.ready`. It creates and
initializes the data handler later, after the system adapter announces that it
is ready. The socket handler assumes the later initialization has already
completed. Simultaneous client reload makes that ordering assumption observable.

The D62e adapter does not own Core's socket registration or data-handler
lifecycle, and no adapter callback can make the GM-side handler exist before
Core creates it. Patching the installed dependency from the system would hide
the symptom at the wrong boundary.

## Suggested upstream behavior

Core should make all three data socket handlers safe before its data handler is
available. A request may return a neutral value, wait for Core readiness with a
bounded timeout, or register the handlers only after the data handler exists.
The chosen behavior should have a regression test that invokes each registered
handler between socket registration and HUD initialization.

No installed Core files were changed during this investigation.
