import { describe, expect, it } from "vitest";
import {
  appendD6InitiatingActionResult,
  createD6InitiatingActionResultLedger,
  parseD6InitiatingActionResultLedger,
  type D6InitiatingActionResultV1,
} from "./initiating-action-results";

const entry: D6InitiatingActionResultV1 = {
  appendId: "request:damage:1",
  details: { zone: 1 },
  kind: "explosive-zone-damage",
  rollMode: "publicroll",
  rolls: [
    {
      faces: [4, 5],
      fingerprint: "a".repeat(64),
      formula: "2d6",
      total: 9,
    },
  ],
};

describe("initiating-action result ledger", () => {
  it("appends stable evidence once and treats an identical delivery as idempotent", () => {
    const initial = createD6InitiatingActionResultLedger("message", "request");
    const recorded = appendD6InitiatingActionResult(initial, entry);

    expect(recorded.revision).toBe(1);
    expect(recorded.entries).toEqual([entry]);
    expect(
      appendD6InitiatingActionResult(recorded, structuredClone(entry)),
    ).toBe(recorded);
    expect(
      parseD6InitiatingActionResultLedger(structuredClone(recorded)),
    ).toEqual(recorded);
  });

  it("fails closed when a duplicate append id carries different evidence", () => {
    const recorded = appendD6InitiatingActionResult(
      createD6InitiatingActionResultLedger("message", "request"),
      entry,
    );

    const firstRoll = entry.rolls[0];
    if (!firstRoll) throw new Error("expected fixture roll");

    expect(() =>
      appendD6InitiatingActionResult(recorded, {
        ...entry,
        rolls: [{ ...firstRoll, total: 10 }],
      }),
    ).toThrow("D6E2.ActionThread.ResultConflict");
  });

  it("rejects malformed fingerprints, unbounded details, and duplicate persisted ids", () => {
    expect(
      parseD6InitiatingActionResultLedger({
        ...createD6InitiatingActionResultLedger("message", "request"),
        entries: [
          { ...entry, rolls: [{ ...entry.rolls[0], fingerprint: "x" }] },
        ],
      }),
    ).toBeNull();
    expect(
      parseD6InitiatingActionResultLedger({
        ...createD6InitiatingActionResultLedger("message", "request"),
        entries: [entry, entry],
      }),
    ).toBeNull();
  });
});
