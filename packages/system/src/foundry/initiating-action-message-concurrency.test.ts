import { describe, expect, it, vi } from "vitest";
import {
  appendD6InitiatingActionResult,
  createD6InitiatingActionResultLedger,
  reconcileD6InitiatingActionResultLedgers,
  type D6InitiatingActionResultLedgerV1,
} from "../application/initiating-action-results";
import {
  appendD6InitiatingActionPresentation,
  serializeD6FoundryRolls,
} from "./initiating-action-message";

async function fixture() {
  vi.stubGlobal("game", {
    user: { id: "gm", isGM: true },
    users: { contents: [{ id: "gm", isGM: true }] },
  });
  const data = {
    dice: [{ results: [{ result: 4 }] }],
    formula: "1d6",
    total: 4,
  };
  const artifact = { ...data, toJSON: () => data } as FoundryRoll;
  const serialized = (await serializeD6FoundryRolls([artifact]))[0];
  if (!serialized) throw new Error("expected serialized fixture roll");
  const evidence = serialized.evidence;
  const initial = createD6InitiatingActionResultLedger("root", "request");
  const first = appendD6InitiatingActionResult(initial, {
    appendId: "request:damage",
    details: { targetActorId: "target" },
    kind: "ordinary-weapon-damage",
    rollMode: "publicroll",
    rolls: [evidence],
  });
  const second = appendD6InitiatingActionResult(first, {
    appendId: "request:resistance",
    details: { targetActorId: "target" },
    kind: "ordinary-target-resistance",
    rollMode: "blindroll",
    rolls: [evidence],
  });
  const flags = new Map<string, unknown>();
  const update = vi.fn(async (changes: Record<string, unknown>) => {
    // Model the server round-trip: document state changes only after save.
    await new Promise((resolve) => setTimeout(resolve, 5));
    for (const [key, value] of Object.entries(changes)) {
      if (key.startsWith("flags.d6-system-2e."))
        flags.set(key.slice("flags.d6-system-2e.".length), value);
    }
    if (Array.isArray(changes.rolls))
      message.rolls = changes.rolls as FoundryRoll[];
    if (Array.isArray(changes.whisper))
      message.whisper = changes.whisper as string[];
    if (changes.blind === true) message.blind = true;
  });
  const message = {
    id: "root",
    rolls: [] as FoundryRoll[],
    whisper: [] as string[],
    blind: false,
    getFlag: (_scope: string, key: string) => flags.get(key),
    update,
  };
  function append(ledger: D6InitiatingActionResultLedgerV1, index = 0) {
    const entry = ledger.entries[index];
    if (!entry) throw new Error("expected fixture entry");
    return appendD6InitiatingActionPresentation({
      artifacts: [artifact],
      entry,
      ledger,
      message: message as unknown as FoundryChatMessageDocument,
    });
  }
  return { append, first, second, flags, message, update };
}

describe("initiating-action concurrent and delayed receipts", () => {
  it("saves duplicate concurrent deliveries once", async () => {
    const { append, first, message, update } = await fixture();
    expect(await Promise.all([append(first), append(first)])).toEqual([
      "appended",
      "duplicate",
    ]);
    expect(update).toHaveBeenCalledTimes(1);
    expect(message.rolls).toHaveLength(1);
  });

  it("retains both independently completed slices and the narrow visibility", async () => {
    const { append, first, second, flags, message } = await fixture();
    await Promise.all([append(second, 1), append(first)]);
    expect(message.rolls).toHaveLength(2);
    expect(flags.get("initiatingActionResults")).toEqual(second);
    expect(flags.get("initiatingActionPresentedResults")).toEqual([
      "request:resistance",
      "request:damage",
    ]);
    expect(message.blind).toBe(true);
    expect(message.whisper).toEqual(["gm"]);
  });

  it("repairs an older saved receipt without rolling back newer history", async () => {
    const { append, first, second, flags, message } = await fixture();
    flags.set("initiatingActionResults", second);
    await expect(append(first)).resolves.toBe("appended");
    expect(flags.get("initiatingActionResults")).toEqual(second);
    expect(message.rolls).toHaveLength(1);
  });

  it("allows a queued retry after the preceding save fails", async () => {
    const { append, first, message, update } = await fixture();
    update.mockRejectedValueOnce(new Error("save failed"));
    const results = await Promise.allSettled([append(first), append(first)]);
    expect(results[0]).toMatchObject({ status: "rejected" });
    expect(results[1]).toEqual({ status: "fulfilled", value: "appended" });
    expect(message.rolls).toHaveLength(1);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("rejects conflicting history even when the entry was already presented", async () => {
    const { append, first, flags, update } = await fixture();
    await append(first);
    flags.set("initiatingActionResults", {
      ...first,
      entries: [{ ...first.entries[0], details: { targetActorId: "changed" } }],
    });
    await expect(append(first)).rejects.toThrow("ResultConflict");
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed stored ledgers without overwriting evidence", async () => {
    const { append, first, flags, update } = await fixture();
    flags.set("initiatingActionResults", { version: 999 });
    await expect(append(first)).rejects.toThrow("AuthorityMismatch");
    expect(update).not.toHaveBeenCalled();
  });

  it("only reconciles a prefix of the same root and request", async () => {
    const { first, second } = await fixture();
    expect(reconcileD6InitiatingActionResultLedgers(first, second)).toBe(
      second,
    );
    expect(reconcileD6InitiatingActionResultLedgers(second, first)).toBe(
      second,
    );
    for (const invalid of [
      { ...second, rootMessageId: "other" },
      { ...second, requestId: "other" },
      { ...second, entries: [...second.entries].reverse() },
      { ...second, revision: first.revision },
      { ...second, revision: first.revision - 1 },
    ]) {
      expect(() =>
        reconcileD6InitiatingActionResultLedgers(first, invalid),
      ).toThrow();
    }
  });
});
