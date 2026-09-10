import { afterEach, describe, expect, it, vi } from "vitest";
import { compositionFixture } from "../application/combined-combat.test-fixtures";
import {
  appendD6InitiatingActionPresentation,
  composedD6OrdinaryInitiatingActionThread,
  persistD6OrdinaryInitiatingActionThread,
  serializeD6FoundryRolls,
} from "./initiating-action-message";

afterEach(() => vi.unstubAllGlobals());

async function fixture() {
  vi.stubGlobal("game", {
    user: { id: "gm", isGM: true },
    users: { contents: [{ id: "gm", isGM: true }] },
  });
  const { root: originalRoot, thread: initial } = compositionFixture();
  const data = {
    formula: "5d6",
    total: 15,
    dice: [{ results: [3, 3, 3, 3, 3].map((result) => ({ result })) }],
  };
  const artifact = { ...data, toJSON: () => data } as FoundryRoll;
  const serialized = await serializeD6FoundryRolls([artifact]);
  const thread = {
    ...initial,
    results: {
      ...initial.results,
      entries: initial.results.entries.map((entry) => ({
        ...entry,
        rolls: serialized.map(({ evidence }) => evidence),
      })),
    },
  };
  const root = {
    ...originalRoot,
    steps: originalRoot.steps.map((step) =>
      step.subject.kind === "weaponDamage"
        ? { ...step, artifacts: serialized }
        : step,
    ),
    results: {
      ...originalRoot.results,
      entries: originalRoot.results.entries.map((entry) =>
        entry.appendId === thread.results.entries[0]?.appendId
          ? required(thread.results.entries[0])
          : entry,
      ),
    },
  };
  const flags = new Map<string, unknown>([
    ["combinedActionRoot", root],
    ["roll", root.steps[1]?.result],
    ["initiatingActionResults", root.results],
  ]);
  const update = vi.fn(async (changes: Record<string, unknown>) => {
    await new Promise((resolve) => setTimeout(resolve, 3));
    for (const [key, value] of Object.entries(changes)) {
      if (key.startsWith("flags.d6-system-2e."))
        flags.set(key.slice("flags.d6-system-2e.".length), value);
    }
    if (Array.isArray(changes.rolls))
      message.rolls = changes.rolls as FoundryRoll[];
  });
  const message = {
    id: "root",
    rolls: [] as FoundryRoll[],
    getFlag: (_scope: string, key: string) => flags.get(key),
    update,
  };
  return {
    root,
    thread,
    flags,
    update,
    artifact,
    message: message as unknown as FoundryChatMessageDocument,
  };
}

describe("Combined ordinary physical-message composition", () => {
  it("saves each contributor's identity and presents a duplicate receipt only once", async () => {
    const { root, thread, message, flags, artifact, update } = await fixture();
    await persistD6OrdinaryInitiatingActionThread(message, thread);
    const entry = thread.results.entries[0];
    if (!entry) throw new Error("Missing Damage entry");
    const append = () =>
      appendD6InitiatingActionPresentation({
        message,
        ledger: thread.results,
        entry,
        artifacts: [artifact],
      });
    expect(await Promise.all([append(), append()])).toEqual([
      "appended",
      "duplicate",
    ]);
    expect(update).toHaveBeenCalledTimes(2);
    expect(message.rolls).toHaveLength(1);
    expect(flags.get("combinedActionRoot")).toEqual(root);
    expect(flags.get("ordinaryAttackThread")).toEqual(thread);
    expect(flags.get("initiatingActionResults")).toMatchObject({
      requestId: "group",
      entries: root.results.entries,
    });
    expect(
      composedD6OrdinaryInitiatingActionThread(
        message,
        structuredClone(thread),
      ),
    ).toEqual(thread);
    expect(flags.get("initiatingActionPresentedResults")).toEqual([
      entry.appendId,
    ]);
  });

  it("keeps committed parent history when a child update is retried after a failed save", async () => {
    const { root, thread, message, flags, update } = await fixture();
    update.mockRejectedValueOnce(new Error("save failed"));
    const attempts = await Promise.allSettled([
      persistD6OrdinaryInitiatingActionThread(message, thread),
      persistD6OrdinaryInitiatingActionThread(message, thread),
    ]);
    expect(attempts[0]).toMatchObject({ status: "rejected" });
    expect(attempts[1]).toMatchObject({ status: "fulfilled" });
    expect(flags.get("combinedActionRoot")).toEqual(root);
    expect(flags.get("ordinaryAttackThread")).toEqual(thread);
    expect(message.rolls).toHaveLength(0);
  });

  it("rejects a foreign or changed plan without overwriting either contributor", async () => {
    const { root, thread, message, flags, update } = await fixture();
    await expect(
      persistD6OrdinaryInitiatingActionThread(message, {
        ...thread,
        damage: {
          ...thread.damage,
          plan: { ...thread.damage.plan, score: 30 },
        },
      }),
    ).rejects.toThrow("AuthorityMismatch");
    expect(update).not.toHaveBeenCalled();
    expect(flags.get("combinedActionRoot")).toEqual(root);
    expect(flags.get("initiatingActionResults")).toEqual(root.results);
    expect(flags.has("ordinaryAttackThread")).toBe(false);
  });
});

function required<T>(value: T | null | undefined): T {
  if (value === undefined || value === null)
    throw new Error("Missing test fixture value");
  return value;
}
