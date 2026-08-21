import type { D6RollMode, D6RollResultV1 } from "@d6-system-2e/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extraordinaryPowerSummaryAudiences,
  postExtraordinaryPowerRollSummary,
} from "./extraordinary-power-roll-summary";

function roll(
  mode: D6RollMode,
  total: number,
  difficulty: number,
): D6RollResultV1 {
  return {
    request: { difficulty, rollMode: mode },
    success: total >= difficulty,
    total,
  } as D6RollResultV1;
}

const users = [
  { id: "player", isGM: false },
  { id: "observer", isGM: false },
  { id: "gm", isGM: true },
];

describe("extraordinary-power consolidated chat audiences", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("publishes one durable ordered public projection when every check is public", () => {
    expect(
      extraordinaryPowerSummaryAudiences(
        [roll("publicroll", 12, 10), roll("publicroll", 14, 15)],
        [
          { difficulty: 10, label: "Control" },
          { difficulty: 15, label: "Sense" },
        ],
        users,
        "player",
      ),
    ).toEqual([
      {
        allDisclosed: true,
        rows: [
          {
            difficulty: 10,
            disclosed: true,
            label: "Control",
            status: "succeeded",
            total: 12,
          },
          {
            difficulty: 15,
            disclosed: true,
            label: "Sense",
            status: "failed",
            total: 14,
          },
        ],
      },
    ]);
  });

  it("never widens mixed private or blind recipients and redacts restricted rows", () => {
    const audiences = extraordinaryPowerSummaryAudiences(
      [
        roll("publicroll", 12, 10),
        roll("blindroll", 20, 15),
        roll("selfroll", 9, 12),
      ],
      [
        { difficulty: 10, label: "Public" },
        { difficulty: 15, label: "GM secret" },
        { difficulty: 12, label: "Player secret" },
      ],
      users,
      "player",
    );
    const player = audiences.find(({ recipientIds }) =>
      recipientIds?.includes("player"),
    );
    const gm = audiences.find(({ recipientIds }) =>
      recipientIds?.includes("gm"),
    );
    const observer = audiences.find(({ recipientIds }) =>
      recipientIds?.includes("observer"),
    );
    expect(player?.rows.map(({ disclosed }) => disclosed)).toEqual([
      true,
      false,
      true,
    ]);
    expect(gm?.rows.map(({ disclosed }) => disclosed)).toEqual([
      true,
      true,
      false,
    ]);
    expect(observer?.rows.map(({ disclosed }) => disclosed)).toEqual([
      true,
      false,
      false,
    ]);
    expect(JSON.stringify(player)).not.toContain("GM secret");
    expect(JSON.stringify(gm)).not.toContain("Player secret");
  });

  it("fails closed if ordered role/result cardinality or roller authority is missing", () => {
    expect(() =>
      extraordinaryPowerSummaryAudiences(
        [roll("publicroll", 12, 10)],
        [],
        users,
        "player",
      ),
    ).toThrow("SummaryInvalid");
    expect(() =>
      extraordinaryPowerSummaryAudiences(
        [],
        [{ difficulty: 10, label: "Control" }],
        users,
        "",
      ),
    ).toThrow("SummaryInvalid");
  });

  it("creates durable recipient-specific messages with restricted rows removed from content", async () => {
    const create = vi.fn<(data: Record<string, unknown>) => Promise<object>>(
      () => Promise.resolve({ id: "summary" }),
    );
    vi.stubGlobal("game", {
      i18n: {
        format: (key: string) => key,
        localize: (key: string) => key,
      },
      user: { id: "player" },
      users: { contents: users },
    });
    vi.stubGlobal("foundry", {
      applications: {
        handlebars: {
          renderTemplate: vi.fn((_path: string, context: object) =>
            Promise.resolve(JSON.stringify(context)),
          ),
        },
      },
    });
    vi.stubGlobal("ChatMessage", {
      create,
      getSpeaker: () => ({ actor: "actor-1" }),
    });
    await postExtraordinaryPowerRollSummary(
      { id: "actor-1", name: "Hero" } as FoundryActorDocument,
      "Mixed sequence",
      [
        roll("publicroll", 12, 10),
        roll("blindroll", 99, 15),
        roll("selfroll", 88, 12),
      ],
      [
        { difficulty: 10, label: "Public" },
        { difficulty: 15, label: "GM secret" },
        { difficulty: 12, label: "Player secret" },
      ],
      false,
      "completed",
    );
    const playerMessage = create.mock.calls
      .map(([data]) => data)
      .find((data) =>
        (data.whisper as string[] | undefined)?.includes("player"),
      );
    const gmMessage = create.mock.calls
      .map(([data]) => data)
      .find((data) => (data.whisper as string[] | undefined)?.includes("gm"));
    expect(create).toHaveBeenCalledTimes(3);
    expect(playerMessage?.content).not.toContain("GM secret");
    expect(playerMessage?.content).not.toContain("99");
    expect(gmMessage?.content).not.toContain("Player secret");
    expect(gmMessage?.content).not.toContain("88");
  });

  it("retains unrolled checks as interrupted without fabricating totals", () => {
    const audiences = extraordinaryPowerSummaryAudiences(
      [roll("publicroll", 12, 10)],
      [
        { difficulty: 10, label: "Control" },
        { difficulty: 15, label: "Sense" },
      ],
      users,
      "player",
    );
    const player = audiences.find(({ recipientIds }) =>
      recipientIds?.includes("player"),
    );
    expect(player?.rows[1]).toEqual({
      difficulty: 15,
      disclosed: true,
      label: "Sense",
      status: "interrupted",
    });
  });

  it("retries a partial summary idempotently without duplicating posted audiences", async () => {
    let attempt = 0;
    const create = vi.fn(() => {
      attempt += 1;
      return attempt === 2
        ? Promise.reject(new Error("chat unavailable"))
        : Promise.resolve({ id: `summary-${attempt}` });
    });
    vi.stubGlobal("game", {
      i18n: {
        format: (key: string) => key,
        localize: (key: string) => key,
      },
      user: { id: "player" },
      users: { contents: users },
    });
    vi.stubGlobal("foundry", {
      applications: {
        handlebars: {
          renderTemplate: vi.fn((_path: string, context: object) =>
            Promise.resolve(JSON.stringify(context)),
          ),
        },
      },
    });
    vi.stubGlobal("ChatMessage", {
      create,
      getSpeaker: () => ({ actor: "actor-1" }),
    });
    const publication = { completedAudienceIndexes: new Set<number>() };
    const args = [
      { id: "actor-1", name: "Hero" } as FoundryActorDocument,
      "Mixed sequence",
      [roll("publicroll", 12, 10), roll("blindroll", 20, 15)],
      [
        { difficulty: 10, label: "Public" },
        { difficulty: 15, label: "Secret" },
      ],
      false,
      "completed" as const,
      publication,
    ] as const;
    await expect(postExtraordinaryPowerRollSummary(...args)).rejects.toThrow(
      "chat unavailable",
    );
    expect(publication.completedAudienceIndexes).toEqual(new Set([0]));
    await postExtraordinaryPowerRollSummary(...args);
    expect(create).toHaveBeenCalledTimes(3);
    await postExtraordinaryPowerRollSummary(...args);
    expect(create).toHaveBeenCalledTimes(3);
  });
});
