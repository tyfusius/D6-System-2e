import type {
  rollFirstEditionHealingCheck,
  rollFirstEditionRecoveryCheck,
} from "./rolls/roll-service";
import { requireDestinyValue as required } from "@d6-system-2e/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseHTML } from "linkedom";
import { resolveD6Roll, type D6RollRequestV1 } from "@d6-system-2e/core";
import {
  createFirstEditionBodyPointRoot,
  advanceFirstEditionBodyPointRoot,
  type FirstEditionBodyPointRoot,
} from "../application/first-edition-body-point-root";
import {
  claimFirstEditionActionStage,
  recordFirstEditionActionStage,
} from "../application/first-edition-action-root";
import {
  continueBodyPointRoot,
  bodyPointRootViewModel,
  bindBodyPointRoot,
} from "./first-edition-body-point-root";
interface RouteCommand {
  method: string;
  next?: FirstEditionBodyPointRoot["action"];
  revision?: number;
}
const f = vi.hoisted(() => ({
  request: vi.fn<(data: RouteCommand) => Promise<unknown>>(),
  healing: vi.fn<typeof rollFirstEditionHealingCheck>(),
  recovery: vi.fn<typeof rollFirstEditionRecoveryCheck>(),
  plain: vi.fn(),
  id: 0,
  actors: new Map<string, FoundryActorDocument>(),
}));
const runtime = {
  profileId: "open-d6",
  successEvaluator: "first-edition-meets" as const,
  wildPolicy: "first-edition" as const,
};
vi.mock("./first-edition-body-point-authority", () => ({
  requestBodyPointRoot: f.request,
  bodyPointBoundActor: (uuid: string) => Promise.resolve(f.actors.get(uuid)),
  bodyPointRootRollRuntime: () => ({
    profileId: "open-d6",
    successEvaluator: "first-edition-meets",
    wildPolicy: "first-edition",
  }),
  BODY_POINT_ROOT_FLAG: "firstEditionBodyPointRoot",
  registerBodyPointRootAuthority: vi.fn(),
  setBodyPointRootRenderer: vi.fn(),
}));
vi.mock("./rolls/roll-service", () => ({
  rollFirstEditionHealingCheck: f.healing,
  rollFirstEditionRecoveryCheck: f.recovery,
  renderD6RollResult: () => Promise.resolve("saved D6 evidence"),
}));
vi.mock("./rolls/chat-card-actions", () => ({
  bindD6EmbeddedRollActions: vi.fn(),
}));
vi.mock("./free-d6-feature-service", () => ({
  persistFreeD6FeatureRollAudit: vi.fn(),
  privacySafeFreeD6FeatureRollResult: <T>(v: T) => v,
}));
vi.mock("./distinction-automation-service", () => ({
  privacySafeDistinctionRollResult: <T>(v: T) => v,
}));
vi.mock("./initiating-action-message", () => ({
  serializeD6FoundryRolls: (rolls: FoundryRoll[]) =>
    Promise.resolve(
      rolls.map((r) => ({
        version: 1,
        serialized: "saved",
        evidence: {
          formula: r.formula,
          total: r.total,
          faces: r.dice.flatMap((d) => d.results.map((v) => v.result)),
          fingerprint: "a".repeat(64),
        },
      })),
    ),
  hydrateD6FoundryRolls: () =>
    Promise.resolve([
      { render: () => Promise.resolve("plain amount evidence") },
    ]),
}));
let value: FirstEditionBodyPointRoot;
function initial(minutes = 5) {
  return createFirstEditionBodyPointRoot({
    rootMessageId: String(++f.id).padStart(16, "a"),
    initiatorUserId: "owner",
    patientControllerUserId: "owner",
    coordinatorUserId: "gm",
    patient: { actorId: "patient", actorUuid: "Actor.patient" },
    healer: { actorId: "healer", actorUuid: "Actor.healer" },
    operation: "assisted",
    before: { current: 0, maximum: 20 },
    minutes,
    restModifierScore: 0,
    source: { attributeId: "brawn", itemId: "medicine" },
    survivalSource: { attributeId: "brawn", itemId: "stamina" },
    runtime: {
      profileId: "open-d6",
      healthModelId: "open-d6.health.body-points",
      damageStrategyId: "open-d6.damage.body-points",
    },
  });
}
async function evaluated(
  total: number,
  hooks: NonNullable<Parameters<typeof rollFirstEditionHealingCheck>[4]>,
) {
  const s = value.action.stages.find((s) => s.state !== "recorded");
  if (s?.spec.kind !== "d6-roll") throw Error("stage");
  const request: D6RollRequestV1 = {
    contractVersion: 2,
    kind: "skill",
    label: s.spec.purpose,
    score: 6,
    resultModifier: total - 6,
    heroPointUse: "none",
    rollMode: "publicroll",
    source: { ...s.spec.subject, ...s.spec.source, actorName: "Actor" },
    ...(s.spec.fixedDifficulty === undefined
      ? {}
      : { difficulty: s.spec.fixedDifficulty }),
  };
  await required(hooks.beforeDice)(request);
  const result = resolveD6Roll({
    ...runtime,
    request,
    baseFaces: [4],
    wildFaces: [2],
  });
  await required(hooks.captureRollExecution)(result, [
    {
      formula: "2d6",
      total: 6,
      dice: [{ results: [{ result: 4 }, { result: 2 }] }],
    } as unknown as FoundryRoll,
  ]);
  return result;
}
beforeEach(() => {
  f.request.mockReset();
  f.healing.mockReset();
  f.recovery.mockReset();
  f.plain.mockReset();
  f.actors.clear();
  for (const id of ["patient", "healer"])
    f.actors.set(`Actor.${id}`, {
      id,
      uuid: `Actor.${id}`,
      name: id,
      isOwner: true,
      testUserPermission: () => true,
    } as unknown as FoundryActorDocument);
  vi.stubGlobal("game", {
    user: { id: "owner", active: true, isGM: false },
    settings: { get: () => undefined },
    i18n: { localize: (k: string) => k, format: (k: string) => k },
  });
  vi.stubGlobal("ui", { notifications: { warn: vi.fn() } });
  vi.stubGlobal(
    "Roll",
    class {
      formula: string;
      total = 6;
      dice = [{ results: [{ result: 6 }] }];
      constructor(formula: string) {
        this.formula = formula;
      }
      evaluate() {
        f.plain();
        return Promise.resolve(this);
      }
    },
  );
  value = initial();
  f.healing.mockImplementation((_a, _label, _d, _i, hooks) =>
    evaluated(6, required(hooks)),
  );
  f.recovery.mockResolvedValue(null);
  f.request.mockImplementation(
    async (data: {
      method: string;
      next?: FirstEditionBodyPointRoot["action"];
      revision?: number;
    }) => {
      await Promise.resolve();
      if (data.method === "cas") {
        if (data.revision !== value.action.revision) return false;
        value = { ...value, action: required(data.next) };
        return true;
      }
      if (data.method === "advance")
        value = advanceFirstEditionBodyPointRoot(value);
      if (data.method === "effect") {
        const stage = required(
          value.action.stages.find((s) => s.state !== "recorded"),
        );
        if (stage.spec.kind !== "effect") throw Error("effect");
        const action = claimFirstEditionActionStage(
          value.action,
          stage.id,
          "gm",
          { kind: "effect" },
        );
        value = {
          ...value,
          action: recordFirstEditionActionStage(action, stage.id, {
            kind: "effect",
            plan: stage.spec.plan,
            receiptKey: `${stage.id}:effect`,
            authorityReceiptId: "proof",
            outcome: "applied",
          }),
        };
      }
      return structuredClone(value);
    },
  );
});
describe("Body Point explicit continuation driver", () => {
  it.each(["cancel", "error"] as const)(
    "releases every control rendered during a sheet-launched initial roll after %s",
    async (exit) => {
      let finish!: () => void;
      f.healing.mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            finish = () =>
              exit === "cancel"
                ? resolve(null)
                : reject(Error("dialog failed"));
          }),
      );
      const pending = continueBodyPointRoot(value);
      const settled = pending.catch(() => null);
      await vi.waitFor(() => expect(f.healing).toHaveBeenCalledTimes(1));
      const { document } = parseHTML(
        '<div><button data-d6-body-point-root-action="continue">Continue</button><button data-d6-body-point-root-action="cancel">Cancel</button></div>',
      );
      const html = required(document.querySelector("div"));
      const replacement = html.cloneNode(true) as HTMLElement;
      const message = {
        id: value.action.rootMessageId,
        getFlag: () => value,
      } as unknown as FoundryChatMessageDocument;
      await bindBodyPointRoot(message, html);
      await bindBodyPointRoot(message, replacement);
      await bindBodyPointRoot(message, replacement);
      const controls = [html, replacement].flatMap((node) =>
        Array.from(node.querySelectorAll("button")),
      );
      expect(controls.every((button) => button.disabled)).toBe(true);
      // A separate unauthorized rendering must retain its permission gate.
      const observer = html.cloneNode(true) as HTMLElement;
      Object.assign(required(game.user), { id: "observer" });
      await bindBodyPointRoot(message, observer);
      Object.assign(required(game.user), { id: "owner" });
      finish();
      await settled;
      expect(controls.every((button) => !button.disabled)).toBe(true);
      expect(observer.querySelector("button")?.disabled).toBe(true);
      expect(observer.querySelector("button")?.hidden).toBe(true);
      expect(value.action.status).toBe("open");
      expect(value.action.stages.map((stage) => stage.state)).toEqual([
        "pending",
      ]);
      expect(f.plain).not.toHaveBeenCalled();
      expect(
        f.request.mock.calls.some(([data]) => data.method === "effect"),
      ).toBe(false);
      // The actual rebound Continue button reopens Medicine once, with no reload.
      f.healing.mockResolvedValueOnce(null);
      replacement.querySelector("button")?.click();
      await vi.waitFor(() => expect(f.healing).toHaveBeenCalledTimes(2));
      await vi.waitFor(() =>
        expect(replacement.querySelector("button")?.disabled).toBe(false),
      );
      expect(value.action.stages.map((stage) => stage.state)).toEqual([
        "pending",
      ]);
    },
  );
  it("cancels survival without death and retains initial/amount dice on the same root", async () => {
    const saved = await continueBodyPointRoot(value);
    expect(saved.action.status).toBe("open");
    expect(saved.action.stages.map((s) => s.state)).toEqual([
      "recorded",
      "recorded",
      "pending",
    ]);
    expect(f.plain).toHaveBeenCalledTimes(1);
    expect(f.recovery.mock.calls[0]?.[0]).toBe(f.actors.get("Actor.patient"));
    expect(f.recovery.mock.calls[0]?.[3]).toBe(5);
    expect(f.recovery.mock.calls[0]?.[6]).toBe(true);
    await continueBodyPointRoot(saved);
    expect(f.healing).toHaveBeenCalledTimes(1);
    expect(f.plain).toHaveBeenCalledTimes(1);
    expect(f.request.mock.calls.some(([d]) => d.method === "effect")).toBe(
      false,
    );
  });
  it("Check saved progress repairs cached initial evidence then stops before amount dice", async () => {
    const route = required(f.request.getMockImplementation());
    let drop = true;
    f.request.mockImplementation(async (data) => {
      await Promise.resolve();
      if (
        data.method === "cas" &&
        data.next?.stages[0]?.state === "recorded" &&
        drop
      ) {
        drop = false;
        throw Error("lost receipt");
      }
      return route(data);
    });
    await expect(continueBodyPointRoot(value)).rejects.toThrow();
    expect(value.action.stages[0]?.state).toBe("claimed");
    expect(f.plain).not.toHaveBeenCalled();
    const repaired = await continueBodyPointRoot(value, "check");
    expect(repaired.action.stages).toHaveLength(1);
    expect(repaired.action.stages[0]?.state).toBe("recorded");
    expect(f.plain).not.toHaveBeenCalled();
    expect(f.recovery).not.toHaveBeenCalled();
    await continueBodyPointRoot(repaired);
    expect(f.plain).toHaveBeenCalledTimes(1);
    expect(f.healing).toHaveBeenCalledTimes(1);
  });
  it("does not advance a pending stage through the check intent", async () => {
    await continueBodyPointRoot(value, "check");
    expect(f.healing).not.toHaveBeenCalled();
    expect(f.plain).not.toHaveBeenCalled();
  });
  it("repairs cached amount presentation without auto-starting survival", async () => {
    const route = required(f.request.getMockImplementation());
    let fail = true;
    f.request.mockImplementation(async (data) => {
      await Promise.resolve();
      if (
        data.method === "cas" &&
        data.next?.stages.at(-1)?.receipt?.kind === "plain-d6" &&
        fail
      ) {
        fail = false;
        throw Error("save failed");
      }
      return route(data);
    });
    await expect(continueBodyPointRoot(value)).rejects.toThrow();
    expect(value.action.stages.at(-1)?.state).toBe("claimed");
    const repaired = await continueBodyPointRoot(value, "check");
    expect(repaired.action.stages.at(-1)?.state).toBe("recorded");
    expect(f.recovery).not.toHaveBeenCalled();
    expect(f.plain).toHaveBeenCalledTimes(1);
  });
  it("cannot use another controller's patient survival roll", async () => {
    await continueBodyPointRoot(value);
    Object.assign(required(game.user), { id: "observer" });
    await continueBodyPointRoot(value);
    expect(f.recovery).toHaveBeenCalledTimes(1);
  });
  it("projects saved pool separately from pending required Skill loss", async () => {
    f.healing.mockImplementation((_a, _l, _d, _i, h) =>
      evaluated(5, required(h)),
    );
    f.recovery.mockImplementation(
      (_a, _l, _s, _d, _i, _score, _ignore, _duration, h) =>
        evaluated(5, required(h)),
    );
    const route = required(f.request.getMockImplementation());
    f.request.mockImplementation(async (data) => {
      await Promise.resolve();
      if (
        data.method === "effect" &&
        value.action.stages.at(-1)?.id.endsWith(":skills")
      )
        throw Error("pause skills");
      return route(data);
    });
    await expect(continueBodyPointRoot(value)).rejects.toThrow();
    const vm = await bodyPointRootViewModel(value);
    expect(vm.terminal).toBe(false);
    expect(vm.resultRows).toContainEqual({
      label: "D6E2.Combat.FirstEdition.BodyPointRoot.ActualGain",
      value: "2",
    });
    expect(vm.skillLossRows.at(-1)?.value).toContain("Unresolved");
    expect(vm.rollDetails).toHaveLength(2);
  });
  it("hides unauthorized controls and binds cloned buttons without duplicate activation", async () => {
    const { document } = parseHTML(
      '<div><button data-d6-body-point-root-action="continue">Continue</button></div>',
    );
    const html = required(document.querySelector("div"));
    const message = {
      id: value.action.rootMessageId,
      getFlag: () => value,
    } as unknown as FoundryChatMessageDocument;
    Object.assign(required(game.user), { id: "observer" });
    await bindBodyPointRoot(message, html);
    expect(html.querySelector("button")?.hidden).toBe(true);
    Object.assign(required(game.user), { id: "owner" });
    const clone = html.cloneNode(true) as HTMLElement;
    await bindBodyPointRoot(message, clone);
    await bindBodyPointRoot(message, clone);
    clone.querySelector("button")?.click();
    await vi.waitFor(() => expect(f.recovery).toHaveBeenCalledTimes(1));
    expect(f.healing).toHaveBeenCalledTimes(1);
  });
});
