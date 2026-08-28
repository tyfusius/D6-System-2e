import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendD6InitiatingActionResult,
  createD6InitiatingActionResultLedger,
} from "../application/initiating-action-results";
import {
  appendD6InitiatingActionPresentation,
  hydrateD6FoundryRolls,
  serializeD6FoundryRolls,
} from "./initiating-action-message";

function roll(formula = "2d6", total = 9, faces = [4, 5]): FoundryRoll {
  const data = {
    dice: [{ results: faces.map((result) => ({ result })) }],
    formula,
    total,
  };
  return {
    ...data,
    toJSON: () => data,
  };
}

describe("initiating-action Foundry presentation", () => {
  beforeEach(() => {
    vi.stubGlobal("game", {
      user: { id: "player", isGM: false },
      users: {
        contents: [
          { id: "gm", isGM: true },
          { id: "player", isGM: false },
        ],
      },
    });
    vi.stubGlobal("Roll", {
      fromJSON: (json: string) => {
        const data = JSON.parse(json) as {
          dice: FoundryRoll["dice"];
          formula: string;
          total: number;
        };
        return { ...data, toJSON: () => data };
      },
    });
  });

  it("adds one roll slice to the existing root and suppresses duplicate delivery", async () => {
    const artifact = roll();
    const serialized = await serializeD6FoundryRolls([artifact]);
    const initial = createD6InitiatingActionResultLedger("root", "request");
    const ledger = appendD6InitiatingActionResult(initial, {
      appendId: "request:damage:1",
      details: { zone: 1 },
      kind: "explosive-zone-damage",
      rollMode: "publicroll",
      rolls: serialized.map(({ evidence }) => evidence),
    });
    const flags = new Map<string, unknown>();
    const update = vi.fn((changes: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(changes)) {
        if (key.includes("initiatingActionPresentedResults"))
          flags.set("initiatingActionPresentedResults", value);
        if (
          key.includes("initiatingActionResults") &&
          !key.includes("Presented")
        )
          flags.set("initiatingActionResults", value);
      }
      if (Array.isArray(changes.rolls))
        message.rolls = changes.rolls as FoundryRoll[];
      return Promise.resolve(undefined);
    });
    const message = {
      id: "root",
      rolls: [roll("3d6", 12, [4, 4, 4])],
      getFlag: (_scope: string, key: string) => flags.get(key),
      update,
    } as unknown as FoundryChatMessageDocument & { rolls: FoundryRoll[] };
    const entry = ledger.entries[0];
    if (!entry) throw new Error("expected fixture entry");

    await expect(
      appendD6InitiatingActionPresentation({
        artifacts: [artifact],
        entry,
        ledger,
        message,
      }),
    ).resolves.toBe("appended");
    await expect(
      appendD6InitiatingActionPresentation({
        artifacts: [artifact],
        entry,
        ledger,
        message,
      }),
    ).resolves.toBe("duplicate");
    expect(update).toHaveBeenCalledTimes(1);
    expect(message.rolls).toHaveLength(2);
  });

  it("round-trips serialized remote artifacts and rejects tampering", async () => {
    const serialized = await serializeD6FoundryRolls([roll()]);
    const first = serialized[0];
    if (!first) throw new Error("expected serialized fixture roll");
    await expect(hydrateD6FoundryRolls(serialized)).resolves.toMatchObject([
      { formula: "2d6", total: 9 },
    ]);
    await expect(
      hydrateD6FoundryRolls([
        {
          ...first,
          serialized: first.serialized.replace("9", "8"),
        },
      ]),
    ).rejects.toThrow("D6E2.ActionThread.RollArtifactInvalid");
  });

  it("narrows a public root to the private result recipient intersection", async () => {
    const artifact = roll();
    const serialized = await serializeD6FoundryRolls([artifact]);
    const ledger = appendD6InitiatingActionResult(
      createD6InitiatingActionResultLedger("root", "request"),
      {
        appendId: "request:resistance:target",
        details: { targetKey: "target" },
        kind: "explosive-target-resistance",
        rollMode: "gmroll",
        rolls: serialized.map(({ evidence }) => evidence),
      },
    );
    const update = vi.fn().mockResolvedValue(undefined);
    const message = {
      id: "root",
      rolls: [],
      getFlag: () => undefined,
      update,
    } as unknown as FoundryChatMessageDocument;
    const entry = ledger.entries[0];
    if (!entry) throw new Error("expected fixture entry");

    await appendD6InitiatingActionPresentation({
      artifacts: [artifact],
      entry,
      ledger,
      message,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ whisper: ["gm", "player"] }),
    );
  });

  it("keeps hidden continuation artifacts blind and GM-only", async () => {
    const artifact = roll();
    const serialized = await serializeD6FoundryRolls([artifact]);
    const ledger = appendD6InitiatingActionResult(
      createD6InitiatingActionResultLedger("root", "request"),
      {
        appendId: "request:damage:hidden",
        details: { zone: 2 },
        kind: "explosive-zone-damage",
        rollMode: "blindroll",
        rolls: serialized.map(({ evidence }) => evidence),
      },
    );
    const update = vi.fn().mockResolvedValue(undefined);
    const message = {
      id: "root",
      rolls: [],
      getFlag: () => undefined,
      update,
    } as unknown as FoundryChatMessageDocument;
    const entry = ledger.entries[0];
    if (!entry) throw new Error("expected fixture entry");

    await appendD6InitiatingActionPresentation({
      artifacts: [artifact],
      entry,
      ledger,
      message,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ blind: true, whisper: ["gm"] }),
    );
  });
});
