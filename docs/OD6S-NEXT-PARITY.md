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

| Feature                                | Source traced | Implementation | Automated | Live     | Notes                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------- | ------------- | -------------- | --------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GM Quickbar                            | Partial       | Ported         | Verified  | Partial  | GM-only access and score controls exist. Complete side-by-side and reload matrix remains required.                                                                                                                                                                                                                                                                                                         |
| GM-requested Attribute and Skill rolls | Complete      | Ported         | Verified  | Partial  | GM configuration, recipient selection, Public/Player + GM/GM-only Blind audience, version/lifetime/authority validation, locked player builder, chat audit context, delivery acknowledgement, and duplicate in-flight suppression are implemented. Public delivery/cleanup passed live; private, blind redaction, disconnect, cancellation, and reload remain.                                             |
| Active Tasks & Requests                | Complete      | Adapted for 2e | Verified  | Partial  | Standard requests use the ported transient authority service: registration before delivery, acknowledgement/failure state, deterministic ordering, response cleanup, expiry, remote cancel/abort, disconnect-aware takeover, working state, and first-completion protection. Online acknowledgement and completion cleanup passed live. Offline request creation remains disabled by explicit UX decision. |
| Remote GM Wild Die decision            | Complete      | Adapted for 2e | Verified  | Partial  | Native Second Edition successful Wild Die 1 routes the exact Partial/Failure choice to an active GM. The targeted, expiring request validates player ownership and preserves the themed decision dialog; no dice pool or final result is trusted over the socket. Two-client Partial resolution passed live; GM cancellation, unavailable state, reload, and side-by-side reference comparison remain.     |
| Single-use roll follow-ups             | Complete      | Adapted for 2e | Verified  | Partial  | Hero Point reroll and Second Edition Doubling Down share a serialized GM-authorized ChatMessage claim. First completion wins across owning clients; cancel/failure releases only the claimant's marker. Live Double Down claim, retry, and cross-client used state passed; simultaneous-owner, release, and reload remain.                                                                                 |
| Diffuse edition wordmarks              | Complete      | Adapted for 2e | Verified  | Verified | OpenD6 Next's diffuse background treatment is retained without right-edge clipping. Build 365 verified live, reload-free switching between `OPEN D6` for complete OpenD6 compatibility and `D62e` for native Second Edition. Custom profiles intentionally retain `D62e`.                                                                                                                                  |
| Edition settings applications          | Complete      | Adapted for 2e | Verified  | Partial  | OpenD6 Next presentation and ApplicationV2 behavior are retained. The native D62e submenu intentionally follows the D62e v1.1 campaign-module structure and printed-page references; stable setting keys are unchanged. Build 365 open/save/reopen and 600-pixel reflow passed. Same-size OpenD6 Next comparison, First Edition narrow layout, and full reload remain.                                     |

## Required completion rule

For every OpenD6 Next-equivalent feature, update this ledger in the same change.
Do not mark a feature complete from unit tests alone. Record intentional
differences with their verified Second Edition rule or Foundry platform reason.
