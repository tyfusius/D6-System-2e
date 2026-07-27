# ADR 0016: Typed Doubling Down follow-up

Status: accepted

Date: 2026-07-28

## Context

D6 System: Second Edition v1.1 printed page 25 permits a failed action to be
retried by rerolling its entire Die Code after the player narrates the new
attempt. A failed retry gains a Complication without a Hero Point. A successful
retry follows the normal success rules. Combat actions and other actions which
cannot reasonably be retried are excluded.

This is neither a Hero Point reroll nor a general OpenD6 rule. It must not spend
a resource again, discard a Die Code which was already enhanced, or allow
unlimited follow-ups from one chat result.

## Decision

- `doubling-down.ts` owns eligibility and constructs the typed retry request.
- Only completed failed Attribute and Skill rolls without Combat action context
  are automatically eligible. The confirmation surface reminds the table that
  the gamemaster decides whether the action can narratively be retried.
- The retry copies the effective Die Code recorded in the original result. This
  preserves an already-doubled Die Code without charging its Hero Point again.
- The request records the original total, optional narration, and printed source
  page in `D6RollContextV1`.
- A failed retry resolves to a Complication and awards zero Hero Points. A
  successful retry retains normal Wild Die and Hero Point resolution.
- Hero Point reroll and Doubling Down are alternative single-use actions on the
  originating ChatMessage.
- The cross-edition `retries` capability selects
  `second-edition-doubling-down` or `open-d6-no-general-double-down`.
- Public API capability `roll.double-down` delegates to the same owner-checked
  service used by chat.

## Consequences

Chat, macros, and a future HUD share one follow-up authority. OpenD6 mode does
not inherit a Second Edition retry mechanic, mixed profiles expose their choice
explicitly, and no persistent Actor migration is required.
