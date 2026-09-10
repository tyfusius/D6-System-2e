import { requireDestinyValue } from "./destiny-value";
import { describe, expect, it } from "vitest";
import {
  destinyIncomingWound,
  validateDestinyState,
  destinyDifficultyShift,
  destinyLightAllocation,
  initialDestinyState,
  normalizeDestinyConfiguration,
  transitionDestiny,
  validateDestinyDelivery,
} from "./destiny";
import type {
  D6DestinyCommandV1,
  D6DestinyOperation,
  D6DestinyPrincipal,
  D6DestinyStateV1,
} from "../contracts/destiny";
const gm = { userId: "gm", isGM: true, actorIds: ["npc"] };
const player = { userId: "player", isGM: false, actorIds: ["hero"] };
const other = { userId: "other", isGM: false, actorIds: [] };
function command(
  state: D6DestinyStateV1,
  operation: D6DestinyOperation,
  id = `command-${state.revision}`,
): D6DestinyCommandV1 {
  return {
    version: 1,
    id,
    expectedRevision: state.revision,
    sessionId: state.sessionId,
    operation,
  };
}
function act(
  state: D6DestinyStateV1,
  operation: D6DestinyOperation,
  user: D6DestinyPrincipal = gm,
) {
  return transitionDestiny(state, command(state, operation), user);
}
function started(size = 3, die = 6) {
  let s = act(initialDestinyState(), {
    kind: "reset",
    sessionId: "first",
    size,
    nominatedUserId: "player",
  });
  s = act(s, { kind: "session-roll", die }, player);
  return s;
}
function proposal(s = started()) {
  return act(
    s,
    {
      kind: "propose",
      proposal: {
        id: "proposal",
        actorId: "hero",
        coinId: "coin-1",
        story: "Packed a respirator.",
        situation: "Underwater",
        request: "One respirator",
      },
    },
    player,
  );
}
function effect(s = started()) {
  return act(
    s,
    {
      kind: "open-effect",
      effect: {
        id: "roll",
        key: "roll:one",
        actorId: "hero",
        userId: "player",
        kind: "difficulty",
        label: "Test",
        side: "either",
        before: 15,
        ladder: [5, 10, 15, 20, 25, 30],
      },
    },
    player,
  );
}
describe("Destiny shared pool", () => {
  it("acknowledges a repaired equipment ID without replaying the committed approval spend", () => {
    const reviewed = act(proposal(), {
      kind: "review",
      proposalId: "proposal",
      decision: "approve",
      review: "Approved",
      delivery: {
        kind: "equipment",
        actorId: "hero",
        itemId: "Jx0DbKSKQFjWW2bfp3Ch4XNj",
        name: "Respirator",
        description: "Packed",
        quantity: 1,
        charges: 1,
        permanence: "session",
      },
    });
    const operation = {
      kind: "delivered" as const,
      proposalId: "proposal",
      itemId: "Jx0DbKSKQFjWW2bf",
      itemFingerprint: "fingerprint",
    };
    const ack = command(reviewed, operation, "delivered-proposal");
    const recovered = transitionDestiny(reviewed, ack, gm);
    expect(recovered.proposals.proposal).toMatchObject({
      status: "approved",
      delivery: { itemId: "Jx0DbKSKQFjWW2bf" },
      itemFingerprint: "fingerprint",
    });
    expect(recovered.coins).toEqual(reviewed.coins);
    expect(recovered.spends).toEqual(reviewed.spends);
    for (const [id, receipt] of Object.entries(reviewed.receipts))
      expect(recovered.receipts[id]).toEqual(receipt);
    expect(transitionDestiny(recovered, ack, gm)).toEqual(recovered);
  });
  it("defaults off, fixes max3 and allocates a nonexploding session die", () => {
    expect(normalizeDestinyConfiguration(undefined)).toEqual({
      version: 1,
      enabled: false,
      size: 3,
    });
    for (let n = 1; n <= 3; n++)
      for (let d = 1; d <= 6; d++)
        expect(destinyLightAllocation(n, d)).toBe(
          Math.min(n, Math.ceil(d / 2)),
        );
    expect(() => destinyLightAllocation(4, 1)).toThrow("PoolSize");
    expect(() => destinyLightAllocation(3, 7)).toThrow("InvalidDie");
  });
  it("requires explicit GM reset and the nominated non-GM roller", () => {
    const s = initialDestinyState();
    expect(() =>
      act(
        s,
        {
          kind: "reset",
          sessionId: "first",
          size: 3,
          nominatedUserId: "player",
        },
        player,
      ),
    ).toThrow("GMRequired");
    const pending = act(s, {
      kind: "reset",
      sessionId: "first",
      size: 2,
      nominatedUserId: "player",
    });
    expect(() => act(pending, { kind: "session-roll", die: 4 }, gm)).toThrow(
      "NominatedPlayerRequired",
    );
    expect(() =>
      act(pending, { kind: "session-roll", die: 4 }, other),
    ).toThrow();
    expect(started(2, 6).coins.map((c) => c.face)).toEqual(["light", "light"]);
  });
  it("reserves without flipping, keeps the reservation through revision, and releases on reject", () => {
    const s = proposal();
    expect(s.coins[0]).toEqual({
      id: "coin-1",
      face: "light",
      reservationId: "proposal",
    });
    const revision = act(s, {
      kind: "review",
      proposalId: "proposal",
      decision: "revision",
      review: "Narrow the request",
    });
    expect(revision.coins).toEqual(s.coins);
    const revised = act(
      revision,
      {
        kind: "revise",
        proposalId: "proposal",
        story: "One small respirator",
        situation: "",
        request: "One item",
      },
      player,
    );
    expect(revised.spends).toHaveLength(0);
    const rejected = act(revised, {
      kind: "review",
      proposalId: "proposal",
      decision: "reject",
      review: "No",
    });
    expect(rejected.coins[0]).toEqual({ id: "coin-1", face: "light" });
  });
  it("rejects competing final-coin reservations and stale approval", () => {
    const s = proposal(started(1));
    expect(() =>
      act(
        s,
        {
          kind: "propose",
          proposal: {
            id: "second",
            actorId: "hero",
            coinId: "coin-1",
            story: "Other",
            situation: "",
            request: "Fact",
          },
        },
        player,
      ),
    ).toThrow("CoinUnavailable");
    const stale = command(
      s,
      {
        kind: "review",
        proposalId: "proposal",
        decision: "approve",
        review: "",
        delivery: { kind: "fact", fact: "Prepared" },
      },
      "stale-approval",
    );
    const cancelled = act(
      s,
      { kind: "cancel", proposalId: "proposal" },
      player,
    );
    expect(() => transitionDestiny(cancelled, stale, gm)).toThrow(
      "RevisionConflict",
    );
  });
  it("approves once before any subsequent checks and forbids withdrawal after commitment", () => {
    const s = proposal();
    const c = command(s, {
      kind: "review",
      proposalId: "proposal",
      decision: "approve",
      review: "Scope agreed",
      delivery: { kind: "fact", fact: "Prepared" },
    });
    const committed = transitionDestiny(s, c, gm);
    expect(committed.coins[0]?.face).toBe("dark");
    expect(committed.proposals.proposal?.status).toBe("delivering");
    expect(transitionDestiny(committed, c, gm)).toBe(committed);
    expect(() =>
      act(committed, { kind: "cancel", proposalId: "proposal" }, player),
    ).toThrow("ProposalState");
    expect(
      act(committed, { kind: "delivered", proposalId: "proposal" }).proposals
        .proposal?.status,
    ).toBe("approved");
  });
  it("does not let another player revise, withdraw, or approve", () => {
    const s = proposal();
    expect(() =>
      act(s, { kind: "cancel", proposalId: "proposal" }, other),
    ).toThrow("OwnerRequired");
    expect(() =>
      act(
        s,
        {
          kind: "review",
          proposalId: "proposal",
          decision: "reject",
          review: "No",
        },
        player,
      ),
    ).toThrow("GMRequired");
  });
  it("binds idempotency to exact command and native principal", () => {
    const s = effect();
    const c = command(s, { kind: "spend", effectId: "roll", coinId: "coin-1" });
    const next = transitionDestiny(s, c, player);
    expect(transitionDestiny(next, c, player)).toBe(next);
    expect(() =>
      transitionDestiny(
        next,
        {
          ...c,
          operation: { kind: "spend", effectId: "roll", coinId: "coin-2" },
        },
        player,
      ),
    ).toThrow("ReceiptConflict");
    expect(() => transitionDestiny(next, c, gm)).toThrow("ReceiptConflict");
  });
  it("prevents both same-side repeats and immediate opposing cancellation while allowing another effect", () => {
    const s = act(
      effect(),
      { kind: "spend", effectId: "roll", coinId: "coin-1" },
      player,
    );
    expect(s.effects.roll?.after).toBe(10);
    expect(() =>
      act(s, { kind: "spend", effectId: "roll", coinId: "coin-1" }, gm),
    ).toThrow("SameEffect");
    expect(() =>
      act(s, { kind: "spend", effectId: "roll", coinId: "coin-2" }, player),
    ).toThrow("SameEffect");
    const next = act(s, {
      kind: "open-effect",
      effect: {
        ...requireDestinyValue(s.effects.roll),
        id: "other",
        key: "roll:two",
        userId: "gm",
        actorId: "npc",
      },
    });
    expect(
      act(next, { kind: "spend", effectId: "other", coinId: "coin-1" }, gm)
        .coins[0]?.face,
    ).toBe("light");
  });
  it("rejects off-anchor custom difficulty in both directions and preserves nonuniform categories", () => {
    for (const side of ["light", "dark"] as const)
      expect(() =>
        destinyDifficultyShift(13, [5, 10, 15, 21, 28, 40], side),
      ).toThrow("CustomDifficultyCategory");
    expect(destinyDifficultyShift(15, [5, 10, 15, 21, 28, 40], "dark")).toBe(
      21,
    );
    expect(destinyDifficultyShift(15, [5, 10, 15, 21, 28, 40], "light")).toBe(
      10,
    );
    expect(() => destinyDifficultyShift(5, [5, 10], "light")).toThrow(
      "DifficultyBoundary",
    );
  });
  it("reduces only an open incoming hit and cannot increase a PC wound", () => {
    let s = started();
    s = act(s, {
      kind: "open-effect",
      effect: {
        id: "hit",
        key: "hit:root:hero",
        actorId: "hero",
        userId: "gm",
        label: "Incoming hit",
        kind: "incoming-hit",
        side: "light",
        before: 2,
        ladder: [],
      },
    });
    expect(() =>
      act(s, { kind: "spend", effectId: "hit", coinId: "coin-1" }, gm),
    ).toThrow("WrongSide");
    s = act(s, { kind: "spend", effectId: "hit", coinId: "coin-1" }, player);
    expect(s.effects.hit?.after).toBe(1);
    s = act(s, { kind: "close-effect", effectId: "hit" });
    expect(() =>
      act(s, { kind: "spend", effectId: "hit", coinId: "coin-2" }, player),
    ).toThrow("EffectClosed");
  });
  it("requires explicit bounded equipment and preserves the supplied definition", () => {
    const d = {
      kind: "equipment" as const,
      actorId: "hero",
      itemId: "gear",
      name: "Respirator",
      description: "Simple equipment",
      quantity: 1,
      charges: 2,
      permanence: "session" as const,
    };
    expect(() => validateDestinyDelivery(d)).not.toThrow();
    expect(() => validateDestinyDelivery({ ...d, quantity: 21 })).toThrow();
    expect(() => validateDestinyDelivery({ ...d, charges: 101 })).toThrow();
    const s = act(proposal(), {
      kind: "review",
      proposalId: "proposal",
      decision: "approve",
      review: "",
      delivery: d,
    });
    expect(s.proposals.proposal?.delivery).toEqual(d);
  });
  it("retains immutable sampled faces across later spending and triggers once for original Wild1", () => {
    let s = started();
    s = act(s, {
      kind: "correct",
      faces: ["dark", "dark", "dark"],
      reason: "Fixture",
    });
    s = act(
      s,
      {
        kind: "sample",
        activation: {
          id: "power",
          actorId: "hero",
          frameworkId: "force",
          ownerId: "provider",
          resourceRoleId: "dark",
        },
      },
      player,
    );
    s = act(s, {
      kind: "correct",
      faces: ["light", "light", "light"],
      reason: "Later state",
    });
    s = act(
      s,
      { kind: "tempt", activationId: "power", originalWild: 1 },
      player,
    );
    expect(s.temptations.power?.status).toBe("rolling");
    expect(s.temptations.power?.faces).toEqual(["dark", "dark", "dark"]);
    expect(() =>
      act(s, { kind: "tempt", activationId: "power", originalWild: 1 }, player),
    ).toThrow("TemptationClaimed");
    s = act(s, { kind: "temptation-roll", activationId: "power", die: 3 });
    expect(s.temptations.power?.status).toBe("applying");
    expect(
      act(s, { kind: "consequence-applied", activationId: "power" }).temptations
        .power?.status,
    ).toBe("failed");
  });
  it("never triggers with fewer than three Dark or an original6 followed by a later1", () => {
    for (const size of [1, 2, 3]) {
      let s = started(size);
      s = act(s, {
        kind: "correct",
        faces: s.coins.map(() => "dark"),
        reason: "Fixture",
      });
      s = act(
        s,
        {
          kind: "sample",
          activation: {
            id: "power",
            actorId: "hero",
            frameworkId: "force",
            ownerId: "provider",
            resourceRoleId: "dark",
          },
        },
        player,
      );
      s = act(
        s,
        {
          kind: "tempt",
          activationId: "power",
          originalWild: size === 3 ? 6 : 1,
        },
        player,
      );
      expect(s.temptations.power?.status).toBe("sampled");
    }
  });
  it("blocks a new session during unresolved delivery or temptation recovery", () => {
    const s = act(proposal(), {
      kind: "review",
      proposalId: "proposal",
      decision: "approve",
      review: "",
      delivery: { kind: "fact", fact: "Prepared" },
    });
    expect(() =>
      act(s, {
        kind: "reset",
        sessionId: "next",
        size: 3,
        nominatedUserId: "player",
      }),
    ).toThrow("RecoveryRequired");
  });
  it("allows Light to hinder a public enemy task and Dark to help that enemy", () => {
    let s = started();
    s = act(s, {
      kind: "open-effect",
      effect: {
        id: "enemy",
        key: "roll:enemy",
        actorId: "npc",
        userId: "gm",
        kind: "difficulty",
        label: "Enemy",
        side: "either",
        before: 15,
        ladder: [5, 10, 15, 20, 25],
        lightDirection: "raise",
        public: true,
      },
    });
    expect(
      act(s, { kind: "spend", effectId: "enemy", coinId: "coin-1" }, player)
        .effects.enemy?.after,
    ).toBe(20);
    s = act(s, {
      kind: "correct",
      faces: ["dark", "dark", "dark"],
      reason: "Fixture",
    });
    expect(
      act(s, { kind: "spend", effectId: "enemy", coinId: "coin-1" }, gm).effects
        .enemy?.after,
    ).toBe(10);
    const privateState = {
      ...s,
      effects: {
        enemy: { ...requireDestinyValue(s.effects.enemy), public: false },
      },
    };
    expect(() =>
      act(
        privateState,
        { kind: "spend", effectId: "enemy", coinId: "coin-1" },
        player,
      ),
    ).toThrow("OwnerRequired");
  });
  it("reduces one incoming level with or without a no-wound anchor", () => {
    for (const outcomes of [
      ["none", "stunned", "wounded", "incapacitated"],
      ["stunned", "wounded", "incapacitated"],
    ]) {
      expect(destinyIncomingWound(outcomes, "wounded")).toEqual({
        before: 2,
        after: "stunned",
      });
      expect(destinyIncomingWound(outcomes, "stunned")).toEqual({
        before: 1,
        after: "none",
      });
      expect(destinyIncomingWound(outcomes, "none")).toBeUndefined();
      expect(destinyIncomingWound(outcomes, "unknown")).toBeUndefined();
    }
  });
  it("rejects a corrupted durable reservation instead of resetting it", () => {
    expect(() => validateDestinyState(proposal())).not.toThrow();
    const s = proposal();
    expect(() =>
      validateDestinyState({
        ...s,
        coins: [{ id: "coin-1", face: "dark", reservationId: "proposal" }],
      }),
    ).toThrow("CoinUnavailable");
    expect(() => validateDestinyState({ ...s, revision: -1 })).toThrow(
      "Version",
    );
  });
  it("persists a temptation dice claim before its immutable artifact and prevents repeat rolls", () => {
    let s = started();
    s = act(s, {
      kind: "correct",
      faces: ["dark", "dark", "dark"],
      reason: "Fixture",
    });
    s = act(
      s,
      {
        kind: "sample",
        activation: {
          id: "power",
          actorId: "hero",
          frameworkId: "force",
          ownerId: "provider",
          resourceRoleId: "dark",
        },
      },
      player,
    );
    s = act(
      s,
      { kind: "tempt", activationId: "power", originalWild: 1 },
      player,
    );
    expect(() =>
      act(s, { kind: "claim-temptation-dice", activationId: "power" }, player),
    ).toThrow("GMRequired");
    s = act(s, { kind: "claim-temptation-dice", activationId: "power" });
    s = JSON.parse(JSON.stringify(s)) as D6DestinyStateV1;
    expect(() =>
      act(s, { kind: "claim-temptation-dice", activationId: "power" }),
    ).toThrow("RollClaimed");
    s = act(s, {
      kind: "save-temptation-dice",
      activationId: "power",
      artifact: "exact original serialized die",
    });
    expect(s.temptations.power?.diceArtifact).toBe(
      "exact original serialized die",
    );
    expect(() =>
      act(s, {
        kind: "save-temptation-dice",
        activationId: "power",
        artifact: "replacement",
      }),
    ).toThrow("RollEvidence");
  });
});
