import { beforeEach, describe, expect, it, vi } from "vitest";

const capability = vi.hoisted(() => ({
  rankedActive: true,
  strategy: "second-edition-milestone",
}));

vi.mock("../settings/optional-capabilities", () => ({
  currentOptionalCapabilityRuntime: () => ({
    rankedFeatures: {
      state: capability.rankedActive ? "active" : "inactive-preserved",
    },
  }),
}));

vi.mock("../settings/advancement", () => ({
  currentAdvancementRuntimeStrategy: () => ({
    id:
      capability.strategy === "second-edition-narrative"
        ? "d6e2.advancement.narrative"
        : "d6e2.advancement.milestone",
  }),
}));

vi.mock("../settings/pip-rules", () => ({
  currentCombinedPipScore: (...scores: number[]) =>
    scores.reduce((total, score) => total + score, 0),
  currentEffectivePipScore: (score: number) => score,
}));

import {
  approveNarrativeArc,
  awardMilestone,
  completeNarrativeArc,
  exchangeMilestoneForPerk,
  proposeNarrativeArc,
  readMilestoneBalance,
  readNarrativeArcs,
  toggleNarrativeArcStep,
} from "./second-edition-advancement-service";

function actorFixture() {
  const shooting = {
    id: "shooting",
    name: "Shooting",
    system: {
      attributeId: "agility",
      key: "shooting",
      score: 3,
      training: "standard",
    },
    type: "skill",
    update: vi.fn((changes: Record<string, unknown>) => {
      const score = changes["system.score"];
      if (typeof score === "number") shooting.system.score = score;
      return Promise.resolve();
    }),
  };
  const perk = {
    id: "perk-1",
    name: "Lucky",
    system: { rank: 1 },
    type: "perk",
    update: vi.fn((changes: Record<string, unknown>) => {
      const rank = changes["system.rank"];
      if (typeof rank === "number") perk.system.rank = rank;
      return Promise.resolve();
    }),
  };
  const contents = [shooting, perk];
  const actor = {
    createEmbeddedDocuments: vi.fn(
      (_type: string, sources: readonly Record<string, unknown>[]) => {
        const created = sources.map((source, index) => ({
          id: `created-${index + 1}`,
          name: String(source.name),
          system: source.system as Record<string, unknown>,
          type: String(source.type),
          update: vi.fn(),
        }));
        contents.push(...(created as typeof contents));
        return Promise.resolve(created);
      },
    ),
    deleteEmbeddedDocuments: vi.fn((_type: string, ids: readonly string[]) => {
      for (const id of ids) {
        const index = contents.findIndex((item) => item.id === id);
        if (index >= 0) contents.splice(index, 1);
      }
      return Promise.resolve();
    }),
    id: "actor-1",
    isOwner: true,
    items: {
      contents,
      get: (id: string) => contents.find((item) => item.id === id),
    },
    name: "Test Character",
    system: {
      advancement: {
        milestone: { attributeDice: 0, skillPips: 0 },
        narrativeArcs: [] as Record<string, unknown>[],
      },
      attributes: { agility: { score: 9 } },
      sheetMode: { value: "advance" },
    },
    update: vi.fn((changes: Record<string, unknown>) => {
      const milestone = changes["system.advancement.milestone"];
      if (milestone && typeof milestone === "object") {
        actor.system.advancement.milestone = milestone as {
          attributeDice: number;
          skillPips: number;
        };
      }
      const arcs = changes["system.advancement.narrativeArcs"];
      if (Array.isArray(arcs)) {
        actor.system.advancement.narrativeArcs = arcs as Record<
          string,
          unknown
        >[];
      }
      const agility = changes["system.attributes.agility.score"];
      if (typeof agility === "number") {
        actor.system.attributes.agility.score = agility;
      }
      return Promise.resolve();
    }),
  };
  return { actor, perk, shooting };
}

describe("Second Edition Milestone advancement service", () => {
  beforeEach(() => {
    capability.strategy = "second-edition-milestone";
    capability.rankedActive = true;
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      user: { isGM: true },
    });
  });

  it("lets the GM award exactly +1 Attribute die and +9 Skill pips", async () => {
    const { actor } = actorFixture();
    await awardMilestone(actor);
    expect(readMilestoneBalance(actor)).toEqual({
      attributeDice: 1,
      skillPips: 9,
    });
  });

  it("exchanges a complete unused bundle for one Perk rank", async () => {
    const { actor, perk } = actorFixture();
    await awardMilestone(actor);
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      user: { isGM: false },
    });
    const balance = await exchangeMilestoneForPerk(actor, perk.id);
    expect(balance).toEqual({ attributeDice: 0, skillPips: 0 });
    expect(perk.system.rank).toBe(2);
  });
});

describe("Second Edition Narrative advancement service", () => {
  beforeEach(() => {
    capability.strategy = "second-edition-narrative";
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      user: { isGM: false },
    });
  });

  it("runs proposal, GM approval, step tracking, and GM reward atomically", async () => {
    const { actor, shooting } = actorFixture();
    const proposed = await proposeNarrativeArc(actor, {
      rewardId: shooting.id,
      rewardKind: "skill",
      steps: ["Find a master", "Earn trust", "Train", "Win a duel", "Reflect"],
      title: "Master the blaster",
    });
    expect(proposed.arc).toMatchObject({
      rewardName: "Shooting",
      status: "draft",
      targetScore: 15,
    });
    expect(proposed.arc.steps).toHaveLength(5);

    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      user: { isGM: true },
    });
    await approveNarrativeArc(actor, proposed.arc.id);

    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      user: { isGM: false },
    });
    for (const step of proposed.arc.steps) {
      await toggleNarrativeArcStep(actor, proposed.arc.id, step.id);
    }

    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      user: { isGM: true },
    });
    const completed = await completeNarrativeArc(actor, proposed.arc.id);
    expect(completed.arc.status).toBe("completed");
    expect(shooting.system.score).toBe(6);
    expect(readNarrativeArcs(actor)[0]?.status).toBe("completed");
  });

  it("requires the exact rulebook step count", async () => {
    const { actor, shooting } = actorFixture();
    await expect(
      proposeNarrativeArc(actor, {
        rewardId: shooting.id,
        rewardKind: "skill",
        steps: ["Too short"],
        title: "Master the blaster",
      }),
    ).rejects.toThrow("D6E2.Advancement.NarrativeStepCount");
  });

  it("creates a new rank-1 Perk from a one-step approved arc", async () => {
    const { actor } = actorFixture();
    const proposed = await proposeNarrativeArc(actor, {
      rewardId: "",
      rewardKind: "perk",
      rewardName: "Chosen by Fortune",
      steps: ["Win fate's favor"],
      title: "A fortunate turn",
    });
    expect(proposed.arc).toMatchObject({
      rewardId: "",
      rewardKind: "perk",
      rewardName: "Chosen by Fortune",
      targetScore: 1,
    });

    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      user: { isGM: true },
    });
    await approveNarrativeArc(actor, proposed.arc.id);
    const [step] = proposed.arc.steps;
    expect(step).toBeDefined();
    if (!step) throw new Error("Expected one Perk arc step.");
    await toggleNarrativeArcStep(actor, proposed.arc.id, step.id);
    const completed = await completeNarrativeArc(actor, proposed.arc.id);

    expect(completed.arc).toMatchObject({
      rewardId: "created-1",
      status: "completed",
    });
    expect(actor.items.get("created-1")).toMatchObject({
      name: "Chosen by Fortune",
      system: { rank: 1 },
      type: "perk",
    });
  });

  it("raises an existing Perk using steps equal to its new rank", async () => {
    const { actor, perk } = actorFixture();
    const proposed = await proposeNarrativeArc(actor, {
      rewardId: perk.id,
      rewardKind: "perk",
      steps: ["Trust fortune", "Risk everything"],
      title: "Fortune favors the bold",
    });
    expect(proposed.arc).toMatchObject({ targetScore: 2 });

    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      user: { isGM: true },
    });
    await approveNarrativeArc(actor, proposed.arc.id);
    for (const step of proposed.arc.steps) {
      await toggleNarrativeArcStep(actor, proposed.arc.id, step.id);
    }
    await completeNarrativeArc(actor, proposed.arc.id);
    expect(perk.system.rank).toBe(2);
  });

  it("deletes a newly granted Perk when completion history cannot persist", async () => {
    const { actor } = actorFixture();
    const proposed = await proposeNarrativeArc(actor, {
      rewardId: "",
      rewardKind: "perk",
      rewardName: "Unwritten Destiny",
      steps: ["Tempt fate"],
      title: "A lost future",
    });
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      user: { isGM: true },
    });
    await approveNarrativeArc(actor, proposed.arc.id);
    const [step] = proposed.arc.steps;
    expect(step).toBeDefined();
    if (!step) throw new Error("Expected one Perk arc step.");
    await toggleNarrativeArcStep(actor, proposed.arc.id, step.id);
    actor.update.mockImplementationOnce(() =>
      Promise.reject(new Error("history write failed")),
    );

    await expect(completeNarrativeArc(actor, proposed.arc.id)).rejects.toThrow(
      "history write failed",
    );
    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", [
      "created-1",
    ]);
    expect(actor.items.get("created-1")).toBeUndefined();
    expect(readNarrativeArcs(actor)[0]?.status).toBe("approved");
  });
});
