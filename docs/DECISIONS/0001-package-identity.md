# ADR 0001: Package identity

Status: Accepted

## Decision

Use `d6-system-2e` as the immutable Foundry system ID and npm package stem. Use
`D6 System Second Edition` as the display title.

## Consequences

Settings, flags, sockets, API ownership, asset paths, manifests, and integrations
use the lowercase ID. Repository capitalization is presentation only. Changing the
ID after worlds exist is a breaking migration and is not planned.

Public distribution remains subject to publisher trademark guidance.
