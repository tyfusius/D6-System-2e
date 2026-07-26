# ADR 0002: Layered architecture

Status: Accepted

## Decision

Use pure domain and public-contract packages, an application-service layer with
ports, and a Foundry v14 adapter layer. UI and integrations depend on the public
application/API boundary.

## Consequences

Rules are independently testable. Foundry upgrades are isolated. Sheets, chat,
HUD, and companions cannot become alternate rules authorities. Boundary adapters
must validate unknown input, which adds deliberate mapping code and tests.
