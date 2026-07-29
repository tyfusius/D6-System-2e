# Multiplayer roll workflow validation

This record covers the authority boundary shared by player rolls, Gamemaster
Wild Die decisions, GM-requested rolls, and single-use chat-card follow-ups.
OpenD6 Next is the workflow and presentation acceptance reference. D62e
pp. 25–28 remains the rules authority for the native Second Edition outcomes.

## Authority model

1. A player resolves their own current Actor pool through the ordinary typed
   roll pipeline. The socket never accepts a submitted dice pool or final
   outcome from another client.
2. When a successful native Second Edition roll produces a Wild Die 1, the
   player's client sends only the Actor identity, provisional total, and the
   exact `partial`/`failure` choice set to one deterministically selected active
   GM. The GM receives the themed Wild Die decision window. A response is
   accepted only for the matching request and GM.
3. A blind player Advantage sends the exact `exceptional`/`ordinary` choice set,
   typed blind-Advantage reason, and blind roll mode to the active GM instead of
   exposing the hidden total or decision to the player. Private-GM and self
   Advantage choices remain local.
4. The GM client rejects an expired, malformed, wrong-version, non-owner,
   inactive-player, non-targeted, mismatched-reason, mismatched-roll-mode, or
   expanded-choice request. Canceling the GM decision cancels the unresolved
   roll without posting chat or changing a resource.
5. Failed-roll Hero Point rerolls and Doubling Down share one single-use claim
   on the originating ChatMessage. A player asks an active GM to claim the
   message before either follow-up runs. The GM validates ownership, the typed
   roll flag, and Actor identity, then writes the claim and used marker.
6. Claims are serialized per ChatMessage by the designated GM. The first valid
   request wins. Cancelled or failed follow-ups release only the requesting
   user's own claim; successful follow-ups leave the audit marker set.
7. A GM acting locally uses the same validation and ChatMessage marker without a
   socket round trip. Players cannot use either follow-up without an active GM
   to arbitrate it.
8. Requested rolls use their separate five-minute, versioned protocol. The
   receiving owner acknowledges delivery before opening the normal roll
   builder. Missing acknowledgement moves the Active Tasks entry to failed
   delivery, where GM takeover can resolve it. One in-flight request per Actor
   score is allowed on the requesting GM client.

These socket messages are private system implementation details, not public API
contracts. No persistent Actor schema changes are introduced.

## Automated acceptance

- Deterministic active-GM selection and targeted response matching.
- Remote `partial`/`failure` decision routing.
- Blind-only remote `exceptional`/`ordinary` decision routing.
- Rejection of a blind-Advantage reason paired with a visible roll mode.
- GM validation of active player ownership and exact permitted choices.
- First-writer-wins follow-up claims under concurrent delivery.
- Typed ChatMessage/Actor matching before a claim is granted.
- Explicit denial when a player has no active GM.
- Requested-roll acknowledgement before the remote task is considered
  delivered.
- Existing roll, Hero Point, Doubling Down, chat visibility, request, and Active
  Tasks suites remain green.

## Live Foundry v14 matrix

Use separate authenticated GM and player clients in the development world.
Record only behavior actually observed.

| Scenario                                 | Expected                                                                                                          | Status                                                                                                                                                                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Player Wild Die 1 on a successful roll   | Player waits; GM receives the themed Partial/Failure decision; the selected result returns to the player pipeline | Pass — QA player rolled Wild Die 1 with total 7 against difficulty 1; GM chose Partial and the player card recorded Partial success with a complication                                                       |
| Blind player Advantage                   | Player sees no total or decision; GM receives Exceptional/Ordinary and the completed card remains blind           | Pass — deterministic `[3, 3, dw6]` against difficulty 1 showed only the redacted blind card to TyfTester; the GM alone chose Exceptional, saw total 12, and awarded exactly one Hero Point                    |
| GM cancels Wild Die decision             | No chat card, Hero Point transaction, or action completion                                                        | Pass — the GM cancelled the blind Advantage prompt; chat count and the one-point balance were unchanged                                                                                                       |
| No active GM                             | Player receives a clear unavailable warning and the unresolved roll stops safely                                  | Pass — with only the GM client disconnected, TyfTester received the active-GM warning and produced no chat or resource effect; the world stayed online                                                        |
| Eligible failed roll follow-up           | Owner click is GM-authorized, spends/rolls once, and disables both alternatives on every client                   | Pass — prior Double Down live coverage and this pass's fresh Hero Point reroll each completed once; the reroll spent one point and both source alternatives were disabled on every observing client           |
| Two owners click the same follow-up      | Exactly one claim wins; the other receives already-used feedback                                                  | Automated only — the live world had one temporary owner                                                                                                                                                       |
| Follow-up dialog cancellation/failure    | Claim is released and the original commands become usable again                                                   | Pass after correction — live QA found Cancel being accepted as narration; the typed-result fix produced no retry and left both original commands enabled, with the cancel-action regression covered automated |
| Requested-roll delivery                  | Active Tasks shows the remote task; player acknowledgement prevents false failed-delivery state                   | Pass — public, private, and blind requests all acknowledged; player completion or GM cancellation removed the task without duplicate chat or resource use                                                     |
| Player disconnect before acknowledgement | Task changes to failed/offline and GM takeover remains single-completion                                          | Pass — disconnect after recipient selection produced an offline task after the five-second acknowledgement deadline, with Take Over enabled                                                                   |
| Public / Player + GM / GM-only Blind     | Native Foundry audience and blind redaction match the selected request policy                                     | Pass — private whispered exactly to the rolling player and GMs; blind whispered only to GMs and rendered the player's result as redacted                                                                      |
| Reload                                   | Completed chat audit persists; pending Wild/request decisions do not replay                                       | Pass — requested-roll audit behavior remained valid; a pending blind Advantage disappeared on player reload, its orphaned GM prompt was cancelled, and neither player nor GM reload replayed the decision     |
| Console                                  | No system-owned error or deprecation warning                                                                      | Pass after correction — live takeover exposed a cancel-result type defect, the patched rerun completed without a new system-owned error; only known Foundry headless Chromium/WebGL/viewport errors remained  |

## Cleanup

Remove QA chat messages, restore spent or awarded resources, clear temporary
ownership/users, close unresolved dialogs, restore settings and combat state,
and return the development instance to Setup. Do not claim a live pass from
automated coverage.

The 2026-07-28 run removed all nine temporary roll messages, restored the
TyfTester Actor's temporary QA ownership to Default, confirmed its Hero Point
balance remained 0, deleted the disposable QA user, and changed no settings,
combat state, Items, or Actor scores.

The 2026-07-29 requested-roll pass used the existing TyfTester owner. It removed
the two temporary private/blind messages, confirmed zero open Active Tasks and
roll dialogs, and left Hero Points at 0, Character Points at 5, Fate Points at
1, Experience Points at 0, and all Actor scores unchanged.

The 2026-07-29 blind-Advantage pass removed its temporary deterministic macro
and all six QA messages, including the pre-fix cancellation diagnostic. It
restored TyfTester to 0 Hero Points, left no pending Wild Die or follow-up
dialog, reconnected the GM after the no-GM branch, and finished with the
development world healthy and available.
