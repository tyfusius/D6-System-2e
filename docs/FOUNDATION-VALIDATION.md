# Foundation validation

Date: 2026-07-26

## Automated result

`npm run check` passed:

- Prettier verification;
- ESLint;
- strict TypeScript;
- 21 Vitest assertions across 5 test files;
- production ESM build;
- manifest, schema, filesystem, AppV1, and core-import invariants;
- generated-bundle lifecycle smoke with stubbed `init` and `ready` hooks;
- initial `character`/`skill` data-model and ApplicationV2 registration checks.

The lifecycle smoke observed:

```text
D6 System Second Edition | Initialized foundation API v1; schema 1
D6 System Second Edition | Ready
Generated bundle lifecycle smoke test passed.
```

This proves the generated bundle registers the two lifecycle hooks, initial data
models and sheets, and the foundation API in a controlled test harness.

## Dependency audit

`npm install` reported five high-severity advisories in the development dependency
tree. A cached `npm audit --omit=dev` reported zero production vulnerabilities.
A later full audit request could not reach the npm advisory endpoint, so the
development advisories remain review debt. No forced dependency rewrite was applied.

## Live Build 365 result

A dedicated world named `D6 System 2e Foundation`, with ID
`d6-system-2e-foundation`, was created and launched as Gamemaster on Foundry v14
Build 365.

Observed:

- Foundry discovered `d6-system-2e` as `D6 System Second Edition`
  `0.1.0-alpha.0`.
- The generated module logged both foundation `init` and `ready` messages.
- The system localization file loaded.
- A `character` Actor named `Foundation Test Character` was created.
- Its ApplicationV2 sheet opened at 760 by 720 pixels.
- Agility was saved as 3D, Hero Points as 2, and a biography value was saved.
- Closing and reopening the sheet preserved those values.
- An embedded `skill` Item named `Climbing`, keyed `climbing`, with a 2D rating
  was created and saved through its ApplicationV2 sheet.
- The character sheet refreshed to show the embedded skill.
- Reloading the world and reopening the character preserved the Actor values and
  embedded Item.
- No system-originated warning or error appeared during the final game load and
  persistence sequence.

## Findings and corrections

The first server restart rejected the capitalized installation directory. Foundry
requires a system directory to exactly match the manifest ID, so the repository
was moved to `data/Data/systems/d6-system-2e`. The next restart discovered it
without adding a package warning.

The first persistence attempt also showed that a close-only save affordance was
not sufficient for an observable, dependable foundation workflow. Both sheets now
provide an explicit localized Save button. Core attribute inputs and their
DataModel fields also enforce the verified creation range of 1D through 5D.

## Not yet claimed

- Player-role permissions have not been exercised.
- Interactive sheet resizing and narrow layout have not been exercised.
- Roll, Wild Die, chat-card, combat, and integration behavior do not exist yet.
- The temporary live world and its test documents are development fixtures, not
  distributable content.
