import { resolveD6Roll, type D6RollRequestV1 } from "@d6-system-2e/core";
import { describe, expect, it, vi } from "vitest";
import type {
  FirstEditionActionRoot,
  FirstEditionEffectPlan,
  FirstEditionRollRuntime,
  FirstEditionSerializedRoll,
  FirstEditionStageReceipt,
  FirstEditionStageSpec,
} from "./first-edition-action-contract";
import {
  appendFirstEditionActionStages,
  cancelFirstEditionAction,
  claimFirstEditionActionStage,
  completeFirstEditionAction,
  createFirstEditionActionRoot,
  parseFirstEditionActionRoot,
  recordFirstEditionActionStage,
} from "./first-edition-action-root";
import {
  createFirstEditionRollPorts,
  executeFirstEditionEffect,
  type FirstEditionEffectPorts,
  type FirstEditionRollCapture,
  type FirstEditionRollPorts,
} from "./first-edition-action-ports";

const subject = { actorId: "patient", actorUuid: "Actor.patient" };
const binding = {
  rootMessageId: "root",
  operationId: "treatment",
  stageId: "treatment:check",
  authenticatedSenderId: "owner",
};
const runtime: FirstEditionRollRuntime = {
  profileId: "first-edition",
  successEvaluator: "first-edition-meets",
  wildPolicy: "first-edition",
};
const spec: FirstEditionStageSpec = {
  kind: "d6-roll",
  purpose: "natural-healing",
  unit: "check",
  controllerUserId: "owner",
  subject,
  source: { attributeId: "brawn" },
  fixedDifficulty: 5,
};
function rootFor(
  stageSpec: FirstEditionStageSpec = spec,
): FirstEditionActionRoot {
  return createFirstEditionActionRoot({
    rootMessageId: "root",
    operationId: "treatment",
    initiation: "healing",
    coordinatorUserId: "gm",
    subjects: [{ role: "patient", actor: subject }],
    runtime: {
      profileId: runtime.profileId,
      healthModelId: "open-d6.wounds",
      damageStrategyId: "open-d6.damage",
    },
    stages: [{ id: binding.stageId, spec: stageSpec }],
  });
}
function artifact(faces: readonly number[]): FirstEditionSerializedRoll {
  return {
    version: 1,
    serialized: JSON.stringify({ faces }),
    evidence: {
      formula: `${faces.length}d6`,
      faces,
      total: faces.reduce((a, b) => a + b, 0),
      fingerprint: "a".repeat(64),
    },
  };
}
function rollFixture() {
  const request: D6RollRequestV1 = {
    contractVersion: 2,
    kind: "attribute",
    label: "Recovery",
    score: 6,
    resultModifier: 0,
    difficulty: 5,
    heroPointUse: "none",
    rollMode: "gmroll",
    source: { ...subject, actorName: "Patient", attributeId: "brawn" },
  };
  const result = resolveD6Roll({
    ...runtime,
    request,
    baseFaces: [4],
    wildFaces: [2],
  });
  const artifacts = [artifact([4, 2])];
  return { request, result, artifacts };
}
function fixture(initial = rootFor()) {
  let value: FirstEditionActionRoot | null = initial;
  const audits = new Set<string>(),
    presentations = new Set<string>();
  let effects = 0;
  const durableEffects = new Map<
    string,
    Extract<FirstEditionStageReceipt, { kind: "effect" }>
  >();
  const ports: FirstEditionRollPorts<FirstEditionSerializedRoll> = {
    load: vi.fn<FirstEditionRollPorts<FirstEditionSerializedRoll>["load"]>(() =>
      Promise.resolve(structuredClone(value)),
    ),
    compareAndSwap: vi.fn<
      FirstEditionRollPorts<FirstEditionSerializedRoll>["compareAndSwap"]
    >((_id, revision, next) => {
      if (value?.revision !== revision) return Promise.resolve(false);
      value = structuredClone(next);
      return Promise.resolve(true);
    }),
    authorize: vi.fn<
      FirstEditionRollPorts<FirstEditionSerializedRoll>["authorize"]
    >((command, root, stage) => {
      if (
        ![stage.spec.controllerUserId, root.coordinatorUserId].includes(
          command.authenticatedSenderId,
        )
      )
        return Promise.reject(new Error("authority"));
      return Promise.resolve();
    }),
    runtime: () => runtime,
    sanitizeRequest: (request) => structuredClone(request),
    sanitizeResult: (result) => structuredClone(result),
    serialize: vi.fn<
      FirstEditionRollPorts<FirstEditionSerializedRoll>["serialize"]
    >((artifacts) => Promise.resolve(structuredClone(artifacts))),
    validateArtifacts: vi.fn<
      FirstEditionRollPorts<FirstEditionSerializedRoll>["validateArtifacts"]
    >(() => Promise.resolve()),
    audit: vi.fn<FirstEditionRollPorts<FirstEditionSerializedRoll>["audit"]>(
      (_result, id, stage) => {
        audits.add(`${id}:${stage}`);
        return Promise.resolve();
      },
    ),
    present: vi.fn<
      FirstEditionRollPorts<FirstEditionSerializedRoll>["present"]
    >((_root, stage) => {
      presentations.add(stage.id);
      return Promise.resolve();
    }),
  };
  const effectPorts: FirstEditionEffectPorts = {
    ...ports,
    compareAndApply: vi.fn<FirstEditionEffectPorts["compareAndApply"]>(
      (plan, receiptKey) => {
        const old = durableEffects.get(receiptKey);
        if (old) return Promise.resolve(old);
        effects += 1;
        const receipt = {
          kind: "effect" as const,
          plan,
          receiptKey,
          outcome: "applied" as const,
          authorityReceiptId: `document:${receiptKey}`,
        };
        durableEffects.set(receiptKey, receipt);
        return Promise.resolve(receipt);
      },
    ),
    readReceipt: vi.fn<FirstEditionEffectPorts["readReceipt"]>((_plan, key) =>
      Promise.resolve(durableEffects.get(key) ?? null),
    ),
  };
  const data = rollFixture();
  const builder = vi.fn(
    async (hooks: FirstEditionRollCapture<FirstEditionSerializedRoll>) => {
      expect(hooks.suppressChatMessage).toBe(true);
      await hooks.beforeDice(data.request);
      expect(value?.stages[0]?.state).toBe("claimed");
      await hooks.captureRollExecution(data.result, data.artifacts);
      return data.result;
    },
  );
  return {
    ports,
    effectPorts,
    builder,
    data,
    audits,
    presentations,
    durableEffects,
    get root() {
      if (!value) throw new Error("Deleted fixture");
      return value;
    },
    setRoot(next: FirstEditionActionRoot | null) {
      value = next;
    },
    get effects() {
      return effects;
    },
  };
}
const automaticRecovery: FirstEditionEffectPlan = {
  kind: "health-change",
  actorUuid: subject.actorUuid,
  healthModelId: "open-d6.wounds",
  before: { kind: "wounds", stateId: "stunned" },
  after: { kind: "wounds", stateId: "healthy" },
};
const effectSpec: FirstEditionStageSpec = {
  kind: "effect",
  subject,
  controllerUserId: "owner",
  plan: automaticRecovery,
};

describe("First Edition internal root contract", () => {
  it("normalizes idempotently and rejects future, detached, reordered or contradictory state", () => {
    const root = rootFor();
    expect(
      parseFirstEditionActionRoot(parseFirstEditionActionRoot(root)),
    ).toEqual(root);
    for (const bad of [
      { ...root, version: 2 },
      { ...root, extra: "unrecognized" },
      { ...root, status: "complete" },
      {
        ...root,
        subjects: [
          {
            role: "patient",
            actor: {
              ...subject,
              actorUuid: "Scene.other.Token.other.Actor.patient",
            },
          },
        ],
      },
      { ...root, stages: [{ ...root.stages[0], state: "claimed" }] },
      { ...root, stages: [{ ...root.stages[0], id: "other:check" }] },
      { ...root, stages: [...root.stages, ...root.stages] },
    ])
      expect(parseFirstEditionActionRoot(bad)).toBeNull();
  });
  it("binds healer and patient UUIDs before rolls and rejects a later substituted patient", () => {
    const healer = { actorId: "healer", actorUuid: "Actor.healer" };
    const root = createFirstEditionActionRoot({
      ...rootFor(),
      subjects: [
        { role: "patient", actor: subject },
        { role: "healer", actor: healer },
      ],
      stages: [
        {
          id: binding.stageId,
          spec: { ...spec, purpose: "medicine", subject: healer },
        },
      ],
    });
    const data = rollFixture();
    expect(() =>
      claimFirstEditionActionStage(root, binding.stageId, "owner", {
        kind: "d6-roll",
        request: data.request,
        runtime,
      }),
    ).toThrow();
    expect(() =>
      createFirstEditionActionRoot({
        ...root,
        stages: [
          { id: binding.stageId, spec: { ...effectSpec, subject: healer } },
        ],
      }),
    ).toThrow();
  });
  it("keeps rounds/minutes and pixel/meter quantities distinct without converting them", () => {
    const clock = {
      checkId: "round-25",
      combatUuid: "Combat.encounter",
      completedRounds: { value: 25, unit: "rounds" as const },
      elapsedMinutes: { value: 2, unit: "minutes" as const },
    };
    const root = createFirstEditionActionRoot({
      ...rootFor(),
      initiation: "round-mortality",
      clock,
      runtime: { ...rootFor().runtime, roundLifecycleId: "open-d6.rounds" },
      stages: [{ id: binding.stageId, spec: { ...spec, purpose: "survival" } }],
    });
    expect(parseFirstEditionActionRoot(root)?.clock).toEqual(clock);
    expect(
      parseFirstEditionActionRoot({
        ...root,
        clock: { ...clock, elapsedMinutes: { value: 2, unit: "rounds" } },
      }),
    ).toBeNull();
    expect(
      parseFirstEditionActionRoot({
        ...root,
        clock: { ...clock, completedRounds: { value: 25, unit: "minutes" } },
      }),
    ).toBeNull();
  });
  it("validates request identity, numeric/Wild evidence and immutable duplicate receipts", () => {
    const root = rootFor(),
      { request, result, artifacts } = rollFixture();
    const claimed = claimFirstEditionActionStage(
      root,
      binding.stageId,
      "owner",
      { kind: "d6-roll", request, runtime },
    );
    const receipt = { kind: "d6-roll" as const, result, artifacts };
    const recorded = recordFirstEditionActionStage(
      claimed,
      binding.stageId,
      receipt,
    );
    expect(
      recordFirstEditionActionStage(recorded, binding.stageId, receipt),
    ).toBe(recorded);
    expect(() =>
      recordFirstEditionActionStage(claimed, binding.stageId, {
        ...receipt,
        result: { ...result, total: 99 },
      }),
    ).toThrow();
    expect(() =>
      recordFirstEditionActionStage(claimed, binding.stageId, {
        ...receipt,
        artifacts: [artifact([5, 2])],
      }),
    ).toThrow();
    expect(() =>
      claimFirstEditionActionStage(root, binding.stageId, "stranger", {
        kind: "d6-roll",
        request,
        runtime,
      }),
    ).toThrow("authority");
    expect(() =>
      claimFirstEditionActionStage(root, binding.stageId, "owner", {
        kind: "d6-roll",
        request: { ...request, difficulty: 0 },
        runtime,
      }),
    ).toThrow();
    expect(() =>
      claimFirstEditionActionStage(claimed, binding.stageId, "owner", {
        kind: "d6-roll",
        request,
        runtime,
      }),
    ).toThrow("uncertain");
  });
  it("appends effects only after saved dice and requires explicit completion", () => {
    const root = rootFor(),
      data = rollFixture();
    expect(() =>
      appendFirstEditionActionStages(root, [
        { id: "treatment:health", spec: effectSpec },
      ]),
    ).toThrow();
    const claimed = claimFirstEditionActionStage(
      root,
      binding.stageId,
      "owner",
      { kind: "d6-roll", request: data.request, runtime },
    );
    const recorded = recordFirstEditionActionStage(claimed, binding.stageId, {
      kind: "d6-roll",
      result: data.result,
      artifacts: data.artifacts,
    });
    const next = appendFirstEditionActionStages(recorded, [
      { id: "treatment:health", spec: effectSpec },
    ]);
    expect(next.status).toBe("open");
    expect(() => completeFirstEditionAction(next)).toThrow();
    expect(completeFirstEditionAction(recorded).status).toBe("complete");
  });
});

describe("First Edition inactive wrapper ports", () => {
  it("claims before evaluation, narrows scope before storage, and repairs without rebuilding", async () => {
    const f = fixture();
    const driver = createFirstEditionRollPorts(binding, f.ports);
    expect(await driver.runD6(f.builder)).toEqual(f.data.result);
    expect(vi.mocked(f.ports.compareAndSwap).mock.calls[0]?.[3]).toBe("gmroll");
    f.setRoot(cancelFirstEditionAction(f.root));
    expect(
      await createFirstEditionRollPorts(binding, f.ports).runD6(f.builder),
    ).toEqual(f.data.result);
    expect(f.builder).toHaveBeenCalledTimes(1);
    expect(f.audits.size).toBe(1);
    expect(f.presentations.size).toBe(1);
  });
  it.each(["before", "after"])(
    "recovers a receipt save failure %s commit without new dice",
    async (when) => {
      const f = fixture(),
        save = f.ports.compareAndSwap;
      f.ports.compareAndSwap = async (...args) => {
        if (args[2].stages[0]?.state === "recorded") {
          f.ports.compareAndSwap = save;
          if (when === "after") await save(...args);
          throw new Error("save reply lost");
        }
        return save(...args);
      };
      const driver = createFirstEditionRollPorts(binding, f.ports);
      await expect(driver.runD6(f.builder)).rejects.toThrow("save reply lost");
      await driver.resume();
      expect(f.root.stages[0]?.state).toBe("recorded");
      expect(f.builder).toHaveBeenCalledTimes(1);
      expect(f.audits.size).toBe(1);
      expect(f.presentations.size).toBe(1);
    },
  );
  it("does not evaluate on a lost claim reply or on reload with missing evidence", async () => {
    const f = fixture(),
      save = f.ports.compareAndSwap;
    f.ports.compareAndSwap = async (...args) => {
      await save(...args);
      throw new Error("claim reply lost");
    };
    const driver = createFirstEditionRollPorts(binding, f.ports);
    await expect(driver.runD6(f.builder)).rejects.toThrow("claim reply lost");
    expect(f.ports.serialize).not.toHaveBeenCalled();
    await expect(
      createFirstEditionRollPorts(binding, f.ports).runD6(f.builder),
    ).rejects.toThrow("uncertain");
    expect(f.builder).toHaveBeenCalledTimes(1);
    expect(f.root.stages[0]?.state).toBe("claimed");
  });
  it("admits only one concurrent claim and never creates a deleted root", async () => {
    const f = fixture();
    const outcomes = await Promise.allSettled([
      createFirstEditionRollPorts(binding, f.ports).runD6(f.builder),
      createFirstEditionRollPorts(binding, f.ports).runD6(f.builder),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled"),
    ).toHaveLength(1);
    expect(f.ports.serialize).toHaveBeenCalledTimes(1);
    f.setRoot(null);
    await expect(
      createFirstEditionRollPorts(binding, f.ports).resume(),
    ).rejects.toThrow("deleted");
  });
  it.each(["survival", "duration"] as const)(
    "keeps cancelled %s unrolled and unresolved",
    async (purpose) => {
      const f = fixture(
        rootFor({
          ...spec,
          purpose,
          unit: purpose === "duration" ? "minutes" : "check",
        }),
      );
      expect(
        await createFirstEditionRollPorts(binding, f.ports).runD6(() =>
          Promise.resolve(null),
        ),
      ).toBeNull();
      expect(f.root.stages[0]).toMatchObject({ state: "pending" });
      expect(f.root.stages[0]?.receipt).toBeUndefined();
      expect(f.ports.compareAndSwap).not.toHaveBeenCalled();
      expect(() => completeFirstEditionAction(f.root)).toThrow();
    },
  );
  it("keeps a plain Body Point amount roll separate from D6/Wild rules", async () => {
    const f = fixture(
      rootFor({
        kind: "plain-d6",
        purpose: "body-point-amount",
        unit: "points",
        dice: 2,
        subject,
        controllerUserId: "owner",
      }),
    );
    const evaluate = vi.fn(() =>
      Promise.resolve({
        total: 7,
        faces: [3, 4],
        artifacts: [artifact([3, 4])],
      }),
    );
    const driver = createFirstEditionRollPorts(binding, f.ports);
    expect(await driver.runPlain("blindroll", evaluate)).toMatchObject({
      kind: "plain-d6",
      total: 7,
    });
    await createFirstEditionRollPorts(binding, f.ports).runPlain(
      "blindroll",
      evaluate,
    );
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(evaluate).toHaveBeenCalledWith(2);
    expect(f.ports.audit).not.toHaveBeenCalled();
    expect(f.presentations.size).toBe(1);
  });
  it("records automatic recovery without dice or presentation artifacts", async () => {
    const f = fixture(rootFor(effectSpec));
    expect(
      await executeFirstEditionEffect(binding, f.effectPorts),
    ).toMatchObject({ kind: "effect", plan: automaticRecovery });
    await executeFirstEditionEffect(binding, f.effectPorts);
    expect(f.effects).toBe(1);
    expect(f.ports.serialize).not.toHaveBeenCalled();
    expect(f.ports.present).not.toHaveBeenCalled();
    expect(f.root.stages[0]?.receipt).not.toHaveProperty("artifacts");
  });
  it("reconciles an applied effect after failed root save without applying it again", async () => {
    const f = fixture(rootFor(effectSpec)),
      save = f.effectPorts.compareAndSwap;
    f.effectPorts.compareAndSwap = async (...args) => {
      if (args[2].stages[0]?.state === "recorded") {
        f.effectPorts.compareAndSwap = save;
        throw new Error("save failed");
      }
      return save(...args);
    };
    await expect(
      executeFirstEditionEffect(binding, f.effectPorts),
    ).rejects.toThrow("save failed");
    f.setRoot(cancelFirstEditionAction(f.root));
    await executeFirstEditionEffect(binding, f.effectPorts);
    expect(f.effects).toBe(1);
    expect(f.effectPorts.compareAndApply).toHaveBeenCalledTimes(1);
    expect(f.effectPorts.readReceipt).toHaveBeenCalledTimes(1);
    expect(f.root.status).toBe("cancelled");
  });
  it("does not infer that an uncertain effect is safe to repeat", async () => {
    const f = fixture(
      claimFirstEditionActionStage(
        rootFor(effectSpec),
        binding.stageId,
        "owner",
        { kind: "effect" },
      ),
    );
    await expect(
      executeFirstEditionEffect(binding, f.effectPorts),
    ).rejects.toThrow("uncertain");
    expect(f.effectPorts.compareAndApply).not.toHaveBeenCalled();
    expect(f.root.stages[0]?.state).toBe("claimed");
  });
});

describe("First Edition evidence admission boundaries", () => {
  it("rejects detached or forged roll capture before private reward audit", async () => {
    const detached = fixture();
    await expect(
      createFirstEditionRollPorts(
        binding,
        detached.ports,
      ).hooks.captureRollExecution(
        detached.data.result,
        detached.data.artifacts,
      ),
    ).rejects.toThrow("invalid");
    expect(detached.ports.audit).not.toHaveBeenCalled();
    const f = fixture(),
      driver = createFirstEditionRollPorts(binding, f.ports);
    await driver.hooks.beforeDice(f.data.request);
    await expect(
      driver.hooks.captureRollExecution(
        { ...f.data.result, total: 999 },
        f.data.artifacts,
      ),
    ).rejects.toThrow("invalid");
    expect(f.ports.audit).not.toHaveBeenCalled();
    expect(f.root.stages[0]?.state).toBe("claimed");
  });
  it("binds scheduled survival to the exact round identity and elapsed minutes", () => {
    const clock = {
      checkId: "round-25",
      combatUuid: "Combat.encounter",
      completedRounds: { value: 25, unit: "rounds" as const },
      elapsedMinutes: { value: 2, unit: "minutes" as const },
    };
    const root = createFirstEditionActionRoot({
      ...rootFor(),
      initiation: "round-mortality",
      clock,
      runtime: { ...rootFor().runtime, roundLifecycleId: "open-d6.rounds" },
      stages: [{ id: binding.stageId, spec: { ...spec, purpose: "survival" } }],
    });
    const context = {
      checkId: clock.checkId,
      completedRounds: 25,
      elapsedMinutes: 2,
      sourcePage: 76 as const,
    };
    const request = {
      ...rollFixture().request,
      context: { firstEditionMortality: context },
    };
    expect(
      claimFirstEditionActionStage(root, binding.stageId, "owner", {
        kind: "d6-roll",
        request,
        runtime,
      }).stages[0]?.state,
    ).toBe("claimed");
    for (const changed of [
      { ...context, checkId: "round-24" },
      { ...context, completedRounds: 24 },
      { ...context, elapsedMinutes: 25 },
    ]) {
      expect(() =>
        claimFirstEditionActionStage(root, binding.stageId, "owner", {
          kind: "d6-roll",
          request: { ...request, context: { firstEditionMortality: changed } },
          runtime,
        }),
      ).toThrow();
    }
    expect(() =>
      claimFirstEditionActionStage(root, binding.stageId, "owner", {
        kind: "d6-roll",
        request,
        runtime: {
          ...runtime,
          wildTriumph: { enabled: true, automaticSuccess: true, threshold: -1 },
        },
      }),
    ).toThrow();
  });
  it("retains plain evaluated dice through serialization failure and blocks cancelled unclaimed effects", async () => {
    const f = fixture(
      rootFor({
        kind: "plain-d6",
        purpose: "body-point-amount",
        unit: "points",
        dice: 2,
        subject,
        controllerUserId: "owner",
      }),
    );
    vi.mocked(f.ports.serialize).mockRejectedValueOnce(
      new Error("codec unavailable"),
    );
    const evaluate = vi.fn(() =>
      Promise.resolve({
        total: 7,
        faces: [3, 4],
        artifacts: [artifact([3, 4])],
      }),
    );
    const driver = createFirstEditionRollPorts(binding, f.ports);
    await expect(driver.runPlain("gmroll", evaluate)).rejects.toThrow(
      "codec unavailable",
    );
    await driver.resume();
    await driver.runPlain("gmroll", evaluate);
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(f.root.stages[0]?.receipt).toMatchObject({
      kind: "plain-d6",
      total: 7,
    });
    const effect = fixture(rootFor(effectSpec));
    effect.setRoot(cancelFirstEditionAction(effect.root));
    await expect(
      executeFirstEditionEffect(binding, effect.effectPorts),
    ).rejects.toThrow("cancelled");
    expect(effect.effectPorts.compareAndApply).not.toHaveBeenCalled();
  });
  it("records translation separately from planned distance and rejects redirected or false no-change receipts", () => {
    const mover = {
      actorId: "patient",
      actorUuid: "Scene.scene.Token.token.Actor.patient",
      sceneId: "scene",
      tokenUuid: "Scene.scene.Token.token",
    };
    const plan: FirstEditionEffectPlan = {
      kind: "token-translation",
      actorUuid: mover.actorUuid,
      sceneId: "scene",
      tokenUuid: mover.tokenUuid,
      from: { x: 0, y: 0, unit: "pixels" },
      to: { x: 100, y: 0, unit: "pixels" },
      distance: { value: 1, unit: "meters" },
      measurement: { sceneUnits: "m", gridDistance: 1, gridSize: 100 },
    };
    const root = createFirstEditionActionRoot({
      ...rootFor(),
      initiation: "movement",
      subjects: [{ role: "mover", actor: mover }],
      runtime: {
        profileId: "first-edition",
        movementStrategyId: "relative",
        actionEconomyStrategyId: "ordered",
      },
      stages: [
        {
          id: binding.stageId,
          spec: {
            kind: "effect",
            subject: mover,
            controllerUserId: "owner",
            plan,
          },
        },
      ],
    });
    const claimed = claimFirstEditionActionStage(
      root,
      binding.stageId,
      "owner",
      { kind: "effect" },
    );
    expect(claimed.stages[0]?.receipt).toBeUndefined();
    const receipt = {
      kind: "effect" as const,
      plan,
      receiptKey: `${binding.stageId}:effect`,
      outcome: "applied" as const,
      authorityReceiptId: "token:receipt",
    };
    expect(
      recordFirstEditionActionStage(claimed, binding.stageId, receipt).stages[0]
        ?.state,
    ).toBe("recorded");
    expect(() =>
      recordFirstEditionActionStage(claimed, binding.stageId, {
        ...receipt,
        outcome: "no-change",
      }),
    ).toThrow();
    expect(() =>
      recordFirstEditionActionStage(claimed, binding.stageId, {
        ...receipt,
        plan: { ...plan, tokenUuid: "Scene.scene.Token.other" },
      }),
    ).toThrow();
    expect(
      parseFirstEditionActionRoot({
        ...root,
        stages: [
          {
            ...root.stages[0],
            spec: {
              ...root.stages[0]?.spec,
              plan: { ...plan, distance: { value: 100, unit: "pixels" } },
            },
          },
        ],
      }),
    ).toBeNull();
  });
});
