import { spendFirstEditionCombatantAction } from "./combat-service";
import { afterEach, expect, it, vi } from "vitest";
import {
  initiatingActionVisibilityIntersection,
  appendD6InitiatingActionPresentation,
  serializeD6FoundryRolls,
} from "./initiating-action-message";
import {
  appendD6InitiatingActionResult,
  createD6InitiatingActionResultLedger,
} from "../application/initiating-action-results";
afterEach(() => vi.unstubAllGlobals());
it.each([
  ["gmroll", ["owner", "gm"], false],
  ["selfroll", ["owner"], false],
  ["blindroll", ["gm"], true],
  ["publicroll", ["owner", "gm"], false],
] as const)(
  "intersects stored %s recipients using the originating owner (native author visibility is guarded separately)",
  (mode, recipients, blind) => {
    vi.stubGlobal("game", {
      user: { id: "gm", isGM: true },
      users: {
        contents: [
          { id: "gm", isGM: true },
          { id: "owner", isGM: false },
        ],
      },
    });
    const message = {
      whisper: ["owner", "gm"],
    } as unknown as FoundryChatMessageDocument;
    const scope = initiatingActionVisibilityIntersection(
      message,
      mode,
      "owner",
    );
    expect(scope.whisper).toEqual(recipients);
    expect(scope.blind === true).toBe(blind);
  },
);
it("appends once with owner self-roll recipients; the native visibility guard excludes the GM author", async () => {
  vi.stubGlobal("game", {
    user: { id: "gm", isGM: true },
    users: {
      contents: [
        { id: "gm", isGM: true },
        { id: "owner", isGM: false },
      ],
    },
  });
  const data = {
    formula: "2d6",
    total: 8,
    dice: [{ results: [{ result: 4 }, { result: 4 }] }],
  };
  const roll = { ...data, toJSON: () => data } as FoundryRoll;
  const artifacts = await serializeD6FoundryRolls([roll]);
  const ledger = appendD6InitiatingActionResult(
    createD6InitiatingActionResultLedger("movement", "movement"),
    {
      appendId: "movement:check",
      kind: "first-edition-movement-check",
      details: { distance: 15 },
      rollMode: "selfroll",
      rolls: artifacts.map((a) => a.evidence),
    },
  );
  const entry = ledger.entries[0];
  if (!entry) throw Error("entry");
  const flags = new Map<string, unknown>();
  const message = {
    id: "movement",
    whisper: ["owner", "gm"],
    rolls: [] as FoundryRoll[],
    getFlag: (_scope: string, key: string) => flags.get(key),
    update: vi.fn((changes: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(changes))
        if (key.startsWith("flags.d6-system-2e."))
          flags.set(key.slice("flags.d6-system-2e.".length), value);
      if (changes.rolls) message.rolls = changes.rolls as FoundryRoll[];
      if (changes.whisper) message.whisper = changes.whisper as string[];
      return Promise.resolve();
    }),
  };
  const input = {
    message: message as unknown as FoundryChatMessageDocument,
    ledger,
    entry,
    artifacts: [roll],
    rollUserId: "owner",
  };
  expect(await appendD6InitiatingActionPresentation(input)).toBe("appended");
  expect(await appendD6InitiatingActionPresentation(input)).toBe("duplicate");
  expect(message.whisper).toEqual(["owner"]);
  expect(message.rolls).toHaveLength(1);
  expect(message.update).toHaveBeenCalledTimes(1);
});

it("rejects a receipt-bearing spend before an ordinary routed call could discard the receipt", async () => {
  await expect(
    spendFirstEditionCombatantAction({}, 2, undefined, "combatant", {
      key: "movement:spend:effect",
      value: {},
    }),
  ).rejects.toThrow("NotAuthorized");
});
