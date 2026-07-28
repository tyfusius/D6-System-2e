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

| Feature                                | Source traced | Implementation | Automated | Live    | Notes                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------- | ------------- | -------------- | --------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GM Quickbar                            | Partial       | Ported         | Verified  | Partial | GM-only access and score controls exist. Complete side-by-side and reload matrix remains required.                                                                                                                                                                                                                                            |
| GM-requested Attribute and Skill rolls | Complete      | Ported         | Verified  | Pending | GM configuration, recipient selection, Public/Player + GM/GM-only Blind audience, version/lifetime/authority validation, locked player builder, chat audit context, and duplicate in-flight suppression are implemented. Complete the live role, blind-redaction, cancellation, reload, and side-by-side matrix before marking live verified. |
| Active Tasks & Requests                | Partial       | Partial        | Partial   | Pending | Standard requested-roll lifecycle exists. Combined Actions and full disconnect/takeover parity remain deferred.                                                                                                                                                                                                                               |

## Required completion rule

For every OpenD6 Next-equivalent feature, update this ledger in the same change.
Do not mark a feature complete from unit tests alone. Record intentional
differences with their verified Second Edition rule or Foundry platform reason.
