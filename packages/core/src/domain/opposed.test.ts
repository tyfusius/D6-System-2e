import { describe, expect, it } from "vitest";
import { evaluateOpposedRoll } from "./opposed";

describe("Second Edition opposed rolls", () => {
  it("awards the contest to the higher total", () => {
    expect(
      evaluateOpposedRoll({
        actorKind: "unknown",
        actorTotal: 14,
        opponentKind: "unknown",
        opponentTotal: 12,
      }),
    ).toMatchObject({ margin: 2, tieBreak: "none", winner: "actor" });
  });

  it("awards a tied PC versus NPC contest to the PC", () => {
    expect(
      evaluateOpposedRoll({
        actorKind: "player-character",
        actorTotal: 12,
        opponentKind: "non-player-character",
        opponentTotal: 12,
      }),
    ).toMatchObject({
      tieBreak: "player-over-npc",
      winner: "actor",
    });
  });

  it("uses the higher Wild Die between tied player characters", () => {
    expect(
      evaluateOpposedRoll({
        actorKind: "player-character",
        actorTotal: 12,
        actorWildFace: 5,
        opponentKind: "player-character",
        opponentTotal: 12,
        opponentWildFace: 3,
      }),
    ).toMatchObject({ tieBreak: "wild-die", winner: "actor" });
  });

  it("leaves a remaining tie to the table", () => {
    expect(
      evaluateOpposedRoll({
        actorKind: "player-character",
        actorTotal: 12,
        actorWildFace: 4,
        opponentKind: "player-character",
        opponentTotal: 12,
        opponentWildFace: 4,
      }),
    ).toMatchObject({ tieBreak: "gm-decision", winner: "unresolved" });
  });
});
