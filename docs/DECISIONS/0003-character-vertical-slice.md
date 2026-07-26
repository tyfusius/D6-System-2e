# ADR 0003: First character vertical slice

Status: Accepted

## Decision

Implement one `character` Actor, embedded `skill` Items, the four core attributes,
Hero Point storage, one typed basic check, core Wild Die resolution, and a structured
chat card before expanding document types.

## Consequences

The first slice proves persistence, permissions, ApplicationV2, rules isolation,
migrations, API delegation, and responsive UI end to end. Combat, damage, optional
modules, and setting content remain outside the slice.
