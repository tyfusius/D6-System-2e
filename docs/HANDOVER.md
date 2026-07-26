# Current handover

Updated: 2026-07-26

## Decisions

- Stable system ID: `d6-system-2e`.
- Display title: `D6 System Second Edition`.
- New repository and rules model; no wholesale legacy import.
- Core/contract/application/Foundry dependency direction accepted.
- First vertical slice: `character` Actor plus embedded `skill` Items and one typed
  core check.
- Manifest declares only document types with a supported runtime.
- Core campaign module defaults are recommended for the first slice.

## Source findings

- The supplied Second Edition v1.1 PDF is the rules authority.
- Success requires a score strictly greater than difficulty.
- Wild Die behavior in the NotebookLM summary needs correction; see rules inventory.
- Page 33 contains two material contradictions. Damage automation is blocked.
- The supplied PDF contains rights/trademark notices but no open license grant.

## Foundation status

- Repository initialized on `main`; no remote, commit, or push.
- Installed repository path corrected to `data/Data/systems/d6-system-2e` because
  Foundry requires the directory to exactly match the package ID.
- Documentation populated.
- Strict TypeScript/build/test scaffold added.
- Pure success evaluator and migration runner added.
- Foundation API v1 publishes only implemented capabilities.
- Foundry-native `character` and `skill` schemas plus minimal ApplicationV2 sheets
  are registered.
- `npm run check` passes with 21 tests plus a generated-bundle lifecycle smoke.
- Build 365 discovers and initializes the package in the dedicated
  `d6-system-2e-foundation` world.
- GM live checks passed for character creation, ApplicationV2 sheet opening,
  explicit save, close/reopen, embedded skill creation, and reload persistence.

## Next safe work

1. Exercise player permissions, interactive resizing, and narrow layout in the
   dedicated Build 365 world.
2. Add the versioned core-default campaign module profile.
3. Refine the ApplicationV2 sheets from persistence harnesses into the Phase 2 UX.
4. Implement the typed basic-check/Wild-Die application service and chat port.
5. Perform and record the full Build 365 GM/player vertical-slice matrix.

## Blockers before later phases

- Publisher/trademark/distribution permission.
- Page 33 errata or explicit table ruling.
- Minimum dice pool after penalties.
- Pips behavior when Hero Points double a die code.
- Initial optional module support profile.
