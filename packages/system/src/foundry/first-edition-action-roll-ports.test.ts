import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFirstEditionActionRoot } from "../application/first-edition-action-root";
import type { FirstEditionActionRoot } from "../application/first-edition-action-contract";
import { createFoundryFirstEditionRollPorts } from "./first-edition-action-roll-ports";

vi.mock("./free-d6-feature-service", () => ({
  persistFreeD6FeatureRollAudit: vi.fn(),
  privacySafeFreeD6FeatureRollResult: <T>(value: T) => value,
}));
vi.mock("./distinction-automation-service", () => ({
  privacySafeDistinctionRollResult: <T>(value: T) => value,
}));
import { persistFreeD6FeatureRollAudit } from "./free-d6-feature-service";

const subject = {
  actorId: "patient",
  actorUuid: "Scene.scene.Token.token.Actor.patient",
  sceneId: "scene",
  tokenUuid: "Scene.scene.Token.token",
};
const binding = {
  rootMessageId: "root",
  operationId: "heal",
  stageId: "heal:amount",
  authenticatedSenderId: "owner",
};
function fixture(actorUuid = subject.actorUuid) {
  let root = createFirstEditionActionRoot({
    rootMessageId: "root",
    operationId: "heal",
    initiation: "healing",
    coordinatorUserId: "gm",
    subjects: [{ role: "patient", actor: subject }],
    runtime: {
      profileId: "first-edition",
      healthModelId: "body-points",
      damageStrategyId: "body-points",
    },
    stages: [
      {
        id: binding.stageId,
        spec: {
          kind: "plain-d6",
          purpose: "body-point-amount",
          unit: "points",
          dice: 2,
          subject,
          controllerUserId: "owner",
        },
      },
    ],
  });
  const present = vi.fn(),
    authorize = vi.fn();
  const ports = {
    load: () => Promise.resolve(structuredClone(root)),
    compareAndSwap: (
      _id: string,
      revision: number,
      next: FirstEditionActionRoot,
    ) => {
      if (root.revision !== revision) return Promise.resolve(false);
      root = structuredClone(next);
      return Promise.resolve(true);
    },
    authorize,
    present,
    runtime: () => ({
      profileId: "first-edition" as const,
      successEvaluator: "first-edition-meets" as const,
      wildPolicy: "first-edition" as const,
    }),
  };
  const actor = {
    id: subject.actorId,
    uuid: actorUuid,
  } as FoundryActorDocument & { uuid: string };
  const data = {
    formula: "2d6",
    total: 7,
    dice: [{ results: [{ result: 3 }, { result: 4 }] }],
  };
  const evaluate = vi.fn(() =>
    Promise.resolve({
      total: 7,
      faces: [3, 4],
      artifacts: [{ ...data, toJSON: () => data }],
    }),
  );
  return {
    driver: () => createFoundryFirstEditionRollPorts(binding, actor, ports),
    evaluate,
    present,
    authorize,
    get root() {
      return root;
    },
    setRoot(next: FirstEditionActionRoot) {
      root = next;
    },
  };
}

describe("inactive First Edition Foundry roll codec", () => {
  const fromJSON = vi.fn((json: string) => {
    const data = JSON.parse(json) as {
      formula: string;
      total: number;
      dice: FoundryRoll["dice"];
    };
    return { ...data, toJSON: () => data };
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("Roll", { fromJSON });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("hydrates recorded plain dice after reload without evaluating or issuing D6 rewards", async () => {
    const f = fixture();
    await f.driver().runPlain("gmroll", f.evaluate);
    await f.driver().runPlain("gmroll", f.evaluate);
    expect(f.evaluate).toHaveBeenCalledTimes(1);
    expect(fromJSON).toHaveBeenCalled();
    expect(persistFreeD6FeatureRollAudit).not.toHaveBeenCalled();
    expect(f.root.stages[0]?.receipt).toMatchObject({
      kind: "plain-d6",
      total: 7,
      faces: [3, 4],
    });
  });
  it("rejects changed serialized evidence before presentation or another evaluation", async () => {
    const f = fixture();
    await f.driver().runPlain("gmroll", f.evaluate);
    const stage = f.root.stages[0],
      receipt = stage?.receipt;
    if (!stage || receipt?.kind !== "plain-d6")
      throw new Error("fixture receipt missing");
    f.setRoot({
      ...f.root,
      stages: [
        {
          ...stage,
          receipt: {
            ...receipt,
            artifacts: receipt.artifacts.map((a) => ({
              ...a,
              serialized: a.serialized.replace('"total":7', '"total":8'),
            })),
          },
        },
      ],
    });
    f.present.mockClear();
    await expect(f.driver().resume()).rejects.toThrow("RollArtifactInvalid");
    expect(f.present).not.toHaveBeenCalled();
    expect(f.evaluate).toHaveBeenCalledTimes(1);
  });
  it("rejects the same Actor id on a different token UUID before the claim", async () => {
    const f = fixture("Scene.scene.Token.other.Actor.patient");
    await expect(f.driver().runPlain("gmroll", f.evaluate)).rejects.toThrow(
      "authority",
    );
    expect(f.root.stages[0]?.state).toBe("pending");
    expect(f.evaluate).not.toHaveBeenCalled();
    expect(f.authorize).not.toHaveBeenCalled();
  });
});
