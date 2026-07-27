# ADR 0013: Explicit Advanced Skill roll context

Status: accepted

Date: 2026-07-27

## Context

D6 System: Second Edition v1.1 printed pages 96–97 say that an Advanced Skill
uses only its own rating when attempted directly. When a prerequisite/basic
Skill is used for a task to which the Advanced Skill applies, the Advanced Skill
rating is added to the complete basic Skill die code. The Surgery example adds
Knowledge 3D, Medicine 3D, and Surgery 2D for an 8D Medicine task, while a direct
Surgery check remains 2D.

An Actor may have several Advanced Skills related to the same prerequisite.
Automatically adding every related rating would therefore invent task
applicability and could stack unrelated bonuses.

## Decision

- A standard Skill roll may present trained, valid Advanced Skills that list it
  as a prerequisite.
- The roll builder requires the user to explicitly choose zero or one applicable
  Advanced Skill for the current task.
- The pure domain combines the complete prerequisite Skill score and the chosen
  Advanced Skill rating in canonical pips.
- The selected embedded Item ID, label, and rating are recorded in the versioned
  roll request context. Chat renders that structured context and never parses
  presentation text.
- Direct Advanced Skill rolls continue to use only their own rating.
- Contextual augmentation is available only while the Second Edition Skill
  Specialization & Advanced Skills module is active. OpenD6 compatibility does
  not inherit this rule implicitly; ADR 0014 permits it only through the
  explicit optional extension.

## Consequences

Sheets, chat, rerolls, macros, and later HUD adapters can share one auditable
request. The implementation prevents silent stacking while leaving task
applicability as an explicit table choice.
