# OpenD6 Next parity ledger

This ledger makes OpenD6 Next the acceptance specification for equivalent D6
System Second Edition user experience, permissions, workflows, integrations,
and presentation. D6 System Second Edition remains the authority for game rules
and data semantics.

## Status vocabulary

- **Not inspected:** the complete OpenD6 Next implementation has not been traced.
- **Inspected:** TypeScript, templates, CSS, localization, settings, permissions,
  sockets, persistence, tests, reload behavior, and validation records were read.
- **Ported:** equivalent observable behavior is implemented.
- **Adapted for 2e:** parity is preserved except for a documented rules-required
  difference.
- **Automated verified:** deterministic and Foundry-adapter tests pass.
- **Live verified:** the relevant GM/player and reload matrix was observed in
  Foundry v14.
- **Deferred:** a named part is intentionally incomplete and remains backlog.

## Feature ledger

| Feature                                | Source traced | Implementation | Automated | Live     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------- | ------------- | -------------- | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GM Quickbar                            | Partial       | Ported         | Verified  | Partial  | GM-only access and score controls exist. Complete side-by-side and reload matrix remains required.                                                                                                                                                                                                                                                                                                                             |
| GM-requested Attribute and Skill rolls | Complete      | Ported         | Verified  | Pending  | GM configuration, recipient selection, Public/Player + GM/GM-only Blind audience, version/lifetime/authority validation, locked player builder, chat audit context, and duplicate in-flight suppression are implemented. Complete the live role, blind-redaction, cancellation, reload, and side-by-side matrix before marking live verified.                                                                                  |
| Active Tasks & Requests                | Complete      | Adapted for 2e | Verified  | Pending  | Standard requests now use the ported transient authority service: registration before delivery, deterministic ordering, response cleanup, expiry, remote cancel/abort, disconnect-aware takeover, working/failure state, and first-completion protection. Offline request creation remains disabled by the user's explicit UX decision. Combined Actions remain deferred until their cross-edition rules decision is recorded. |
| Diffuse edition wordmarks              | Complete      | Adapted for 2e | Verified  | Verified | OpenD6 Next's diffuse background treatment is retained without right-edge clipping. Build 365 verified live, reload-free switching between `OPEN D6` for complete OpenD6 compatibility and `D62e` for native Second Edition. Custom profiles intentionally retain `D62e`.                                                                                                                                                      |

## Required completion rule

For every OpenD6 Next-equivalent feature, update this ledger in the same change.
Do not mark a feature complete from unit tests alone. Record intentional
differences with their verified Second Edition rule or Foundry platform reason.
