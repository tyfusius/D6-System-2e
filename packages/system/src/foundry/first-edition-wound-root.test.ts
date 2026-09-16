import { parseHTML } from "linkedom";
import { requireDestinyValue as required } from "@d6-system-2e/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveD6Roll, type D6RollRequestV1 } from "@d6-system-2e/core";
import {
  createFirstEditionWoundRoot,
  advanceFirstEditionWoundRoot,
  type FirstEditionWoundRoot,
} from "../application/first-edition-wound-root";
import {
  FirstEditionActionError,
  claimFirstEditionActionStage,
  recordFirstEditionActionStage,
} from "../application/first-edition-action-root";
import {
  continueWoundRoot,
  startWoundRoot,
  woundRootViewModel,
  bindWoundRoot,
} from "./first-edition-wound-root";
interface RouteCommand {
  method: string;
  next?: FirstEditionWoundRoot["action"];
  revision?: number;
}
const f = vi.hoisted(() => ({
  request: vi.fn<(data: RouteCommand) => Promise<unknown>>(),
  ordinary: vi.fn(),
  automatic: vi.fn(),
  actor: {} as FoundryActorDocument,
  id: 0,
  warn: vi.fn(),
}));
vi.mock("./first-edition-wound-authority", () => ({
  requestWoundRoot: f.request,
  woundBoundActor: () => Promise.resolve(f.actor),
  WOUND_ROOT_FLAG: "firstEditionWoundRoot",
  woundRootRollRuntime: () => ({
    profileId: "first-edition",
    successEvaluator: "first-edition-meets",
    wildPolicy: "first-edition",
  }),
  registerWoundRootAuthority: vi.fn(),
  setWoundRootRenderer: vi.fn(),
}));
vi.mock("./rolls/roll-service", () => ({
  rollFirstEditionHealingCheck: f.ordinary,
  rollFirstEditionAutomatedMortalityCheck: f.automatic,
  renderD6RollResult: () => Promise.resolve("saved dice"),
}));
vi.mock("./rolls/chat-card-actions", () => ({
  bindD6EmbeddedRollActions: vi.fn(),
}));
vi.mock("./foundry-random-id", () => ({
  foundryRandomId: () => String(++f.id).padStart(16, "a"),
}));
vi.mock("./free-d6-feature-service", () => ({
  persistFreeD6FeatureRollAudit: vi.fn(),
  privacySafeFreeD6FeatureRollResult: <T>(v: T) => v,
}));
vi.mock("./distinction-automation-service", () => ({
  privacySafeDistinctionRollResult: <T>(v: T) => v,
}));
vi.mock("./initiating-action-message", () => ({
  serializeD6FoundryRolls: () =>
    Promise.resolve([
      {
        version: 1,
        serialized: "roll",
        evidence: {
          formula: "2d6",
          faces: [4, 2],
          total: 6,
          fingerprint: "a".repeat(64),
        },
      },
    ]),
  hydrateD6FoundryRolls: () => Promise.resolve([]),
}));
let value: FirstEditionWoundRoot;
const runtime = {
  profileId: "first-edition",
  successEvaluator: "first-edition-meets" as const,
  wildPolicy: "first-edition" as const,
};
function initial(operation: "natural" | "round-mortality" = "natural") {
  return createFirstEditionWoundRoot({
    rootMessageId: String(++f.id).padStart(16, "a"),
    controllerUserId: "owner",
    coordinatorUserId: "gm",
    patient: { actorId: "patient", actorUuid: "Actor.patient" },
    source: { attributeId: "brawn" },
    runtime: {
      profileId: "first-edition",
      healthModelId: "open-d6.health.wound-track",
      damageStrategyId: "open-d6.damage.wounds",
      ...(operation === "round-mortality"
        ? { roundLifecycleId: "open-d6.elapsed-rounds" }
        : {}),
    },
    operation,
    wound: operation === "natural" ? "wounded" : "mortally-wounded",
    ...(operation === "round-mortality"
      ? {
          minutes: 1,
          clock: {
            checkId: "combat:round:12",
            combatUuid: "Combat.combat",
            completedRounds: { value: 12, unit: "rounds" as const },
            elapsedMinutes: { value: 1, unit: "minutes" as const },
          },
        }
      : {}),
  });
}
function request(): D6RollRequestV1 {
  return {
    contractVersion: 2,
    kind: "attribute",
    label: "Recovery",
    score: 6,
    resultModifier: 0,
    heroPointUse: "none",
    rollMode: "publicroll",
    source: { actorId: "patient", actorName: "Patient", attributeId: "brawn" },
    ...(value.action.clock
      ? {
          difficulty: 1,
          context: {
            firstEditionMortality: {
              checkId: "combat:round:12",
              completedRounds: 12,
              elapsedMinutes: 1,
              sourcePage: 76,
            },
          },
        }
      : {}),
  };
}
async function mountedControls() {
  const callbacks = new Map<string, () => void>();
  const buttons = ["continue", "cancel"].map((action) => ({
    dataset: { d6WoundRootAction: action },
    disabled: false,
    hidden: false,
    addEventListener: (_event: string, callback: () => void) =>
      callbacks.set(action, callback),
  }));
  await bindWoundRoot(
    {
      id: value.action.rootMessageId,
      getFlag: () => value,
    } as unknown as FoundryChatMessageDocument,
    {
      querySelectorAll: (selector: string) =>
        selector.includes("root-action") ? buttons : [],
    } as unknown as HTMLElement,
  );
  return { buttons, click: () => callbacks.get("continue")?.() };
}
function claimCheck() {
  value = {
    ...value,
    action: claimFirstEditionActionStage(
      value.action,
      required(value.action.stages[0]).id,
      "owner",
      {
        kind: "d6-roll",
        request: request(),
        runtime,
      },
    ),
  };
}
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  f.request.mockReset();
  f.ordinary.mockReset();
  f.automatic.mockReset();
  f.actor = {
    id: "patient",
    uuid: "Actor.patient",
    name: "Patient",
    isOwner: true,
    testUserPermission: () => true,
  } as unknown as FoundryActorDocument;
  vi.stubGlobal("game", {
    user: { id: "owner", active: true, isGM: false },
    settings: { get: () => undefined },
    i18n: { localize: (k: string) => k, format: (k: string) => k },
  });
  f.warn.mockReset();
  vi.stubGlobal("ui", { notifications: { warn: f.warn } });
  value = initial();
  f.request.mockImplementation(
    (data: {
      method: string;
      next?: FirstEditionWoundRoot["action"];
      revision?: number;
    }) => {
      if (data.method === "cas") {
        if (value.action.revision !== data.revision)
          return Promise.resolve(false);
        value = { ...value, action: required(data.next) };
        return Promise.resolve(true);
      }
      if (data.method === "advance")
        value = advanceFirstEditionWoundRoot(value);
      if (data.method === "effect") {
        const stage = required(
          value.action.stages.find((s) => s.spec.kind === "effect"),
        );
        if (stage.spec.kind !== "effect") throw Error("effect");
        const claimed = claimFirstEditionActionStage(
          value.action,
          stage.id,
          "gm",
          { kind: "effect" },
        );
        value = {
          ...value,
          action: recordFirstEditionActionStage(claimed, stage.id, {
            kind: "effect",
            plan: stage.spec.plan,
            receiptKey: `${stage.id}:effect`,
            authorityReceiptId: "proof",
            outcome: "applied",
          }),
        };
      }
      return Promise.resolve(structuredClone(value));
    },
  );
  const roll = async (...args: unknown[]) => {
    const hooks = args.at(-1) as {
      beforeDice: (r: D6RollRequestV1) => Promise<void>;
      captureRollExecution: (
        r: ReturnType<typeof resolveD6Roll>,
        a: readonly unknown[],
      ) => Promise<void>;
      suppressChatMessage: boolean;
    };
    expect(hooks.suppressChatMessage).toBe(true);
    const r = request();
    await hooks.beforeDice(r);
    const result = resolveD6Roll({
      ...runtime,
      request: r,
      baseFaces: [4],
      wildFaces: [2],
    });
    await hooks.captureRollExecution(result, []);
    return result;
  };
  f.ordinary.mockImplementation(roll);
  f.automatic.mockImplementation(roll);
});
describe("Wound explicit client continuations", () => {
  it("captures ordinary dice before applying, and repeated completion never rerolls", async () => {
    await continueWoundRoot(value);
    expect(value.action.status).toBe("complete");
    f.request.mockClear();
    await continueWoundRoot(value);
    expect(f.ordinary).toHaveBeenCalledTimes(1);
    expect(f.request.mock.calls.map(([d]) => d.method)).toEqual(["load"]);
    expect(f.automatic).not.toHaveBeenCalled();
    expect(
      f.request.mock.calls.filter(([d]) => d.method === "effect"),
    ).toHaveLength(0);
  });
  it("leaves builder cancellation pending without a health effect", async () => {
    f.ordinary.mockResolvedValueOnce(null);
    await continueWoundRoot(value);
    expect(value.action.stages[0]?.state).toBe("pending");
    expect(f.request.mock.calls.some(([d]) => d.method === "effect")).toBe(
      false,
    );
  });
  it("uses the mandatory prepared mortality wrapper with saved round units", async () => {
    value = initial("round-mortality");
    await continueWoundRoot(value);
    expect(f.ordinary).not.toHaveBeenCalled();
    expect(f.automatic).toHaveBeenCalledTimes(1);
    expect(f.automatic.mock.calls[0]?.[2]).toBe(1);
    expect(f.automatic.mock.calls[0]?.[3]).toMatchObject({
      completedRounds: 12,
      elapsedMinutes: 1,
      checkId: "combat:round:12",
    });
  });
  it("reuses an evaluated result after persistence reply loss without opening the builder again", async () => {
    const original = required(f.request.getMockImplementation());
    let fail = true;
    f.request.mockImplementation(async (data) => {
      const result = await original(data);
      if (
        fail &&
        data.method === "cas" &&
        data.next?.stages[0]?.state === "recorded"
      ) {
        fail = false;
        throw Error("lost reply");
      }
      return result;
    });
    await expect(continueWoundRoot(value)).rejects.toThrow("lost reply");
    await continueWoundRoot(value);
    expect(value.action.status).toBe("complete");
    expect(f.ordinary).toHaveBeenCalledTimes(1);
  });
  it("shows neutral waiting during an active claimed roll and keeps local controls disabled", async () => {
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ordinary = required(f.ordinary.getMockImplementation());
    f.ordinary.mockImplementationOnce(async (...args: unknown[]) => {
      const hooks = args.at(-1) as {
        beforeDice: (r: D6RollRequestV1) => Promise<void>;
      };
      await hooks.beforeDice(request());
      await waiting;
      // This probe ends before any dice or effect; its unresolved claim is intentional.
      return null;
    });
    const active = continueWoundRoot(value);
    const outcome = expect(active).rejects.toThrow("uncertain");
    await vi.waitFor(() =>
      expect(value.action.stages[0]?.state).toBe("claimed"),
    );
    const vm = await woundRootViewModel(value);
    expect(vm.statusLabel).toContain("AwaitingRoll");
    expect(vm.nextStepLabel).toContain("AwaitingRollHelp");
    expect(vm.controls[0]?.label).toContain("CheckSavedProgress");
    expect(vm.rollDetails).toEqual([]);
    const controls = await mountedControls();
    expect(controls.buttons.every((button) => button.disabled)).toBe(true);
    controls.click();
    expect(f.ordinary).toHaveBeenCalledOnce();
    release();
    await outcome;
    f.ordinary.mockImplementation(ordinary);
    expect(f.request.mock.calls.some(([d]) => d.method === "effect")).toBe(
      false,
    );
  });
  it("does not offer another client's claimed check to the GM as a retry", async () => {
    claimCheck();
    Object.assign(game, { user: { id: "gm", active: true, isGM: true } });
    const controls = await mountedControls();
    expect(controls.buttons[0]?.disabled).toBe(true);
    controls.click();
    expect(f.request).not.toHaveBeenCalled();
    expect(f.ordinary).not.toHaveBeenCalled();
    expect((await woundRootViewModel(value)).statusLabel).toContain(
      "AwaitingRoll",
    );
  });
  it("lets the roller check an interrupted claim without saved evidence, but never rerolls it", async () => {
    claimCheck();
    const before = structuredClone(value);
    const controls = await mountedControls();
    expect(controls.buttons[0]?.disabled).toBe(false);
    expect(controls.buttons[1]?.disabled).toBe(true);
    controls.click();
    await vi.waitFor(() =>
      expect(f.warn).toHaveBeenCalledWith(
        "D6E2.Combat.FirstEdition.WoundRoot.ProgressUnconfirmed",
      ),
    );
    await vi.waitFor(() => expect(controls.buttons[0]?.disabled).toBe(false));
    expect(value).toEqual(before);
    expect(f.ordinary).not.toHaveBeenCalled();
    expect(f.automatic).not.toHaveBeenCalled();
    expect(f.request.mock.calls.every(([d]) => d.method === "load")).toBe(true);
  });
  it("recovers a captured result after a failed save from the original session without new dice", async () => {
    const original = required(f.request.getMockImplementation());
    let fail = true;
    f.request.mockImplementation(async (data) => {
      if (
        fail &&
        data.method === "cas" &&
        data.next?.stages[0]?.state === "recorded"
      ) {
        fail = false;
        throw Error("save failed");
      }
      return original(data);
    });
    await expect(continueWoundRoot(value)).rejects.toThrow("save failed");
    expect(value.action.stages[0]?.state).toBe("claimed");
    const vm = await woundRootViewModel(value);
    expect(vm.controls[0]?.label).toContain("CheckSavedProgress");
    const controls = await mountedControls();
    expect(controls.buttons[0]?.disabled).toBe(false);
    controls.click();
    await vi.waitFor(() => expect(value.action.status).toBe("complete"));
    expect(f.ordinary).toHaveBeenCalledOnce();
  });
  it("does not claim missing dice when saved-roll recovery reaches an uncertain health effect", async () => {
    const original = required(f.request.getMockImplementation());
    let saveFailed = false;
    f.request.mockImplementation(async (data) => {
      if (
        !saveFailed &&
        data.method === "cas" &&
        data.next?.stages[0]?.state === "recorded"
      ) {
        saveFailed = true;
        throw Error("save failed");
      }
      if (data.method === "effect")
        throw new FirstEditionActionError("uncertain");
      return original(data);
    });
    await expect(continueWoundRoot(value)).rejects.toThrow("save failed");
    expect(value.action.stages[0]?.state).toBe("claimed");
    const controls = await mountedControls();
    controls.click();
    await vi.waitFor(() =>
      expect(f.warn).toHaveBeenCalledWith(
        "D6E2.Combat.FirstEdition.WoundRoot.ProgressUnconfirmed",
      ),
    );
    expect(value.action.stages[0]?.state).toBe("recorded");
    expect(value.action.stages[0]?.receipt?.kind).toBe("d6-roll");
    expect(value.action.status).toBe("open");
    expect(f.ordinary).toHaveBeenCalledOnce();
    expect(f.warn.mock.calls.flat().join(" ")).not.toContain(
      "SavedProgressUnavailable",
    );
  });
  it("does not infer missing saved evidence when the first recovery load fails", async () => {
    claimCheck();
    const before = structuredClone(value);
    f.request.mockRejectedValue(new FirstEditionActionError("uncertain"));
    const controls = await mountedControls();
    controls.click();
    await vi.waitFor(() =>
      expect(f.warn).toHaveBeenCalledWith(
        "D6E2.Combat.FirstEdition.WoundRoot.ProgressUnconfirmed",
      ),
    );
    expect(value).toEqual(before);
    expect(f.ordinary).not.toHaveBeenCalled();
    expect(f.warn.mock.calls.flat().join(" ")).not.toContain(
      "SavedProgressUnavailable",
    );
  });
  it("keeps a saved result awaiting its effect distinct from a claimed check", async () => {
    const original = required(f.request.getMockImplementation());
    f.request.mockImplementation((data) =>
      data.method === "effect"
        ? Promise.reject(Error("effect interrupted"))
        : original(data),
    );
    await expect(continueWoundRoot(value)).rejects.toThrow(
      "effect interrupted",
    );
    const vm = await woundRootViewModel(value);
    expect(vm.statusLabel).toContain("AwaitingEffect");
    expect(vm.rollDetails).toHaveLength(1);
    expect(vm.controls[0]?.label).toBe(
      "D6E2.Combat.FirstEdition.WoundRoot.Continue",
    );
    const effect = required(
      value.action.stages.find((s) => s.spec.kind === "effect"),
    );
    value = {
      ...value,
      action: claimFirstEditionActionStage(value.action, effect.id, "gm", {
        kind: "effect",
      }),
    };
    const uncertain = await woundRootViewModel(value);
    expect(uncertain.statusLabel).toContain("NeedsAttention");
    expect(uncertain.controls[0]?.label).toBe(
      "D6E2.Combat.FirstEdition.WoundRoot.Retry",
    );
    expect(uncertain.rollDetails).toHaveLength(1);
  });
  it("coalesces repeated initiation while the builder remains open", async () => {
    let release!: () => void;
    const wait = new Promise<void>((r) => {
      release = r;
    });
    f.ordinary.mockImplementationOnce(async () => {
      await wait;
      return null;
    });
    const first = startWoundRoot(f.actor, "natural"),
      second = startWoundRoot(f.actor, "natural");
    expect(first).toBe(second);
    release();
    await first;
    expect(
      f.request.mock.calls.filter(([d]) => d.method === "create"),
    ).toHaveLength(1);
  });
  it("binds a restored DOM clone despite a copied bound marker, without duplicate listeners", async () => {
    const { document } = parseHTML(
      '<html><body><main><button data-d6-wound-root-action="continue">Continue</button></main></body></html>',
    );
    const original = required(document.querySelector("main"));
    const message = {
      id: value.action.rootMessageId,
      getFlag: () => value,
    } as unknown as FoundryChatMessageDocument;
    await bindWoundRoot(message, original);
    // DOM cloning copies attributes, but not addEventListener registrations.
    required(original.querySelector("button")).setAttribute(
      "data-wound-bound",
      "true",
    );
    const clone = original.cloneNode(true) as HTMLElement;
    await bindWoundRoot(message, clone);
    await bindWoundRoot(message, clone);
    const button = required(clone.querySelector<HTMLButtonElement>("button"));
    expect(button.disabled).toBe(false);
    button.click();
    await vi.waitFor(() => expect(value.action.status).toBe("complete"));
    expect(f.ordinary).toHaveBeenCalledOnce();
    expect(
      f.request.mock.calls.filter(([d]) => d.method === "effect"),
    ).toHaveLength(1);
  });
  it("renders and binds restored chat without continuing or evaluating", async () => {
    const vm = await woundRootViewModel(value);
    expect(vm.outcomeLabel).toContain("NotConfirmed");
    await bindWoundRoot(
      {
        id: value.action.rootMessageId,
        getFlag: () => value,
      } as unknown as FoundryChatMessageDocument,
      { querySelectorAll: () => [] } as unknown as HTMLElement,
    );
    expect(f.request).not.toHaveBeenCalled();
    expect(f.ordinary).not.toHaveBeenCalled();
    expect(f.automatic).not.toHaveBeenCalled();
  });
  it.each(["complete", "cancelled"] as const)(
    "makes %s cards terminal and their mounted controls inert",
    async (status) => {
      if (status === "complete") await continueWoundRoot(value);
      else
        value = {
          ...value,
          action: { ...value.action, status: "cancelled", revision: 1 },
        };
      f.request.mockClear();
      f.ordinary.mockClear();
      const vm = await woundRootViewModel(value);
      expect(vm.terminal).toBe(true);
      expect(vm.controls).toEqual([]);
      const callbacks: (() => void)[] = [];
      const button = {
        dataset: { d6WoundRootAction: "continue" },
        disabled: false,
        hidden: false,
        addEventListener: (_event: string, cb: () => void) =>
          callbacks.push(cb),
      };
      await bindWoundRoot(
        {
          id: value.action.rootMessageId,
          getFlag: () => value,
        } as unknown as FoundryChatMessageDocument,
        {
          querySelectorAll: (selector: string) =>
            selector.includes("root-action") ? [button] : [],
        } as unknown as HTMLElement,
      );
      expect(button.disabled).toBe(true);
      callbacks.forEach((callback) => callback());
      expect(f.request).not.toHaveBeenCalled();
      expect(f.ordinary).not.toHaveBeenCalled();
    },
  );
});
