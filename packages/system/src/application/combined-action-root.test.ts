import { describe, expect, it } from "vitest";
import { resolveD6Roll, type D6RollRequestV1 } from "@d6-system-2e/core";
import {
  claimCombinedRootStep,
  createCombinedActionRootState,
  parseCombinedActionRoot,
  recordCombinedRootStep,
  type CombinedRootRuntime,
} from "./combined-action-root";
import { appendD6InitiatingActionResult } from "./initiating-action-results";

function requestedContext(request: D6RollRequestV1) {
  const value = request.context?.requestedRoll;
  if (!value) throw new Error("Missing fixture context");
  return value;
}
const context = {
  groupId: "group",
  stage: "command" as const,
  allocatedBonusScore: 0,
  commandDifficulty: 7,
  commandPenaltyScore: 0,
  participantCount: 2,
  leaderActorId: "leader",
  leaderName: "Leader",
  primaryActorId: "worker",
  primaryName: "Worker",
};
const runtime: CombinedRootRuntime = {
  profileId: "second-edition",
  successEvaluator: "second-edition-strict",
  wildPolicy: "second-edition",
};
function fixture() {
  const root = createCombinedActionRootState({
    rootMessageId: "root",
    groupId: "group",
    coordinatorId: "gm",
    createdAt: 1,
    label: "Team task",
    application: "single",
    participantIds: ["leader", "worker"],
    participantNames: "Leader, Worker",
    primarySubject: { kind: "attribute", attributeId: "perception" },
    steps: [
      {
        id: "command",
        actorId: "leader",
        label: "Command",
        subject: { kind: "attribute", attributeId: "perception" },
        options: { bonusScore: 0, penaltyScore: 0, context },
        status: "requested",
        controllerId: "owner",
      },
    ],
  });
  const request: D6RollRequestV1 = {
    contractVersion: 2,
    kind: "attribute",
    label: "Command",
    score: 6,
    resultModifier: 0,
    heroPointUse: "none",
    rollMode: "publicroll",
    difficulty: 7,
    source: {
      actorId: "leader",
      actorName: "Leader",
      attributeId: "perception",
    },
    context: {
      combinedAction: context,
      requestedRoll: {
        requestId: "command",
        requesterUserId: "gm",
        requesterName: "GM",
        recipientUserId: "owner",
        rollMode: "publicroll",
        visibility: "public",
      },
    },
  };
  const result = resolveD6Roll({
    ...runtime,
    request,
    baseFaces: [4],
    wildFaces: [5],
  });
  return { root, request, result };
}
describe("Combined Action root V1 transitions", () => {
  it("claims exactly the selected actor, subject, controller, request and fixed Command difficulty", () => {
    const { root, request } = fixture();
    const claimed = claimCombinedRootStep(
      root,
      "command",
      "owner",
      request,
      runtime,
    );
    expect(claimed.steps[0]?.status).toBe("rolling");
    expect(() =>
      claimCombinedRootStep(claimed, "command", "owner", request, runtime),
    ).toThrow();
    for (const changed of [
      { ...request, difficulty: 0 },
      { ...request, source: { ...request.source, actorId: "worker" } },
      { ...request, source: { ...request.source, attributeId: "brawn" } },
      {
        ...request,
        context: {
          ...request.context,
          requestedRoll: {
            ...requestedContext(request),
            requesterUserId: "intruder",
          },
        },
      },
    ])
      expect(() =>
        claimCombinedRootStep(root, "command", "owner", changed, runtime),
      ).toThrow();
    expect(() =>
      claimCombinedRootStep(root, "command", "other", request, runtime),
    ).toThrow();
  });
  it("records once, replays an identical receipt, rejects conflicting evidence and never mutates the prior root", () => {
    const { root, request, result } = fixture();
    const claimed = claimCombinedRootStep(
      root,
      "command",
      "owner",
      request,
      runtime,
    );
    const recorded = recordCombinedRootStep(claimed, "command", result, [
      "artifact",
    ]);
    expect(
      recordCombinedRootStep(recorded, "command", result, ["artifact"]),
    ).toBe(recorded);
    expect(() =>
      recordCombinedRootStep(recorded, "command", { ...result, total: 99 }, [
        "artifact",
      ]),
    ).toThrow("ResultConflict");
    expect(claimed.steps[0]?.result).toBeUndefined();
  });
  it("rejects a forged numeric total, pool, Wild Die result or unfinished choice even with the bound request", () => {
    const { root, request, result } = fixture();
    const claimed = claimCombinedRootStep(
      root,
      "command",
      "owner",
      request,
      runtime,
    );
    for (const changed of [
      { ...result, total: 99 },
      { ...result, pool: { ...result.pool, baseDice: 5 } },
      { ...result, wildOutcome: "complication" as const },
      { ...result, pendingChoices: ["second-edition-ordinary" as const] },
    ])
      expect(() =>
        recordCombinedRootStep(claimed, "command", changed, ["artifact"]),
      ).toThrow("RollArtifactInvalid");
  });
  it("treats absent, malformed and future roots as unavailable without adopting old summary cards", () => {
    const { root } = fixture();
    expect(parseCombinedActionRoot(root)).toEqual(root);
    for (const raw of [
      undefined,
      {},
      { ...root, version: 2 },
      { ...root, participantIds: ["leader", "leader"] },
      { ...root, steps: [{ ...root.steps[0], options: {} }] },
    ])
      expect(parseCombinedActionRoot(raw)).toBeNull();
  });
  it("round-trips recorded evidence only when the ledger and bound result agree", () => {
    const { root, request, result } = fixture();
    const recorded = recordCombinedRootStep(
      claimCombinedRootStep(root, "command", "owner", request, runtime),
      "command",
      result,
      ["artifact"],
    );
    const complete = {
      ...recorded,
      results: appendD6InitiatingActionResult(recorded.results, {
        appendId: "command",
        kind: "combined-action-command",
        details: { actorId: "leader", total: result.total },
        rollMode: "publicroll",
        rolls: [
          {
            formula: "2d6",
            total: 9,
            faces: [4, 5],
            fingerprint: "a".repeat(64),
          },
        ],
      }),
    };
    expect(parseCombinedActionRoot(complete)).toEqual(complete);
    expect(parseCombinedActionRoot(recorded)).toBeNull();
    expect(
      parseCombinedActionRoot({
        ...complete,
        steps: [{ ...complete.steps[0], result: { ...result, total: 99 } }],
      }),
    ).toBeNull();
  });
  it("cancellation prohibits a new claim but retains already-started dice", () => {
    const { root, request, result } = fixture();
    const claimed = claimCombinedRootStep(
      root,
      "command",
      "owner",
      request,
      runtime,
    );
    expect(
      recordCombinedRootStep(
        { ...claimed, cancelled: true },
        "command",
        result,
        ["artifact"],
      ),
    ).toMatchObject({ cancelled: true, steps: [{ status: "recorded" }] });
    expect(() =>
      claimCombinedRootStep(
        { ...root, cancelled: true },
        "command",
        "owner",
        request,
        runtime,
      ),
    ).toThrow();
  });
});
