# ADR 0012: Hero Point follow-up transactions

Status: accepted

## Context

D6 System: Second Edition v1.1 printed page 28 permits one Hero Point on a
roll, including rerolling a failed roll without doubling the Die Code. The same
page permits spending a Hero Point to avoid becoming Stunned. It does not say
that a Hero Point removes an already-existing Stunned condition.

Rendered chat text and sheet controls cannot be transaction authorities. A
reroll must retain the original typed request, and condition prevention must
occur before the condition write.

## Decision

- `D6HeroPointUse` distinguishes `double-die-code` from `reroll-failed`.
- A reroll is valid only when the prior typed result has `success === false`
  and spent no Hero Point.
- The new roll reuses the original score, difficulty/opposition, modifier,
  visibility, and source. It rolls a fresh physical pool without doubling.
- The original chat message receives a system flag before the command runs, so
  its action is single-use across rerenders.
- `health.condition` is the authoritative condition command. When instructed to
  prevent a transition into Stunned, it spends one Hero Point and retains the
  previous condition.
- Existing Stunned conditions are never cleared by this command.
- First Edition meta-currency profiles reject both Second Edition actions.

## Consequences

Chat cards and sheets remain presentation adapters. Macros, future combat
damage application, and HUD adapters can use the same public typed commands.
Remote-owner socket authority remains future work; the current commands require
local Actor ownership.
