import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  D6_ROLL_CONTRACT_VERSION,
  type D6RollResultV1,
} from "@d6-system-2e/core";
import type { D6ExplosiveRegionStateV1 } from "../../application/explosive-workflow";
import type { D6ExplosiveAttackThreadV1 } from "../../application/explosive-attack-thread";
import { appendD6InitiatingActionResult } from "../../application/initiating-action-results";
import {
  registerD6PendingInteraction,
  resetD6PendingInteractionsForTests,
} from "../../application/pending-interactions";

const mocks = vi.hoisted(() => ({
  activeGm: vi.fn(),
  cancelDialog: vi.fn(),
  cancelRoll: vi.fn(),
  damage: vi.fn(),
  mutation: vi.fn(),
  prompts: new Map<
    string,
    { readonly reopen: () => Promise<"dismissed" | "resolved"> }
  >(),
  targets: vi.fn(),
  zoneRoll: vi.fn(),
}));

vi.mock("../pending-interactions", () => ({
  registerFoundryPendingInteraction: vi.fn(
    (options: {
      readonly id: string;
      readonly reopen: () => Promise<"dismissed" | "resolved">;
    }) => {
      mocks.prompts.set(options.id, { reopen: options.reopen });
      return Promise.resolve();
    },
  ),
}));

vi.mock("../rolls/roll-service", () => ({
  cancelRequestedRollDialog: mocks.cancelDialog,
  explosiveWeaponDamageScore: vi.fn(() => 12),
  rollExplosiveZoneDamage: mocks.zoneRoll,
}));

vi.mock("../roll-requests", () => ({
  cancelRollRequest: mocks.cancelRoll,
}));

vi.mock("../rolls/damage-resolution", () => ({
  resolveExplosiveThreadDamageTarget: mocks.damage,
}));

vi.mock("./explosive-canvas", () => ({
  currentSceneExplosiveTargets: mocks.targets,
}));

vi.mock("./explosive-region", async () => {
  const actual = await vi.importActual("./explosive-region");
  return {
    ...actual,
    activeD6ExplosiveGm: mocks.activeGm,
    requestD6ExplosiveMutation: mocks.mutation,
  };
});

import {
  createD6ExplosiveAttackThreadForDetonation,
  d6ExplosiveAttackThreadFromMessage,
  explosiveHealthTone,
  registerD6ExplosiveAttackThreadLifecycle,
  resetD6ExplosiveAttackThreadsForTests,
} from "./explosive-attack-thread";

describe("Foundry explosive attack thread", () => {
  it("maps stable and custom health state ids through the existing palette", () => {
    expect(explosiveHealthTone("healthy")).toBe("healthy");
    expect(explosiveHealthTone("staggered")).toBe("staggered");
    expect(explosiveHealthTone("severely-wounded")).toBe("wounded");
    expect(explosiveHealthTone("mortally-wounded")).toBe("mortally-wounded");
    expect(explosiveHealthTone("shaken")).toBe("custom");
    expect(explosiveHealthTone(undefined)).toBe("custom");
  });

  beforeEach(() => {
    mocks.activeGm.mockReset().mockReturnValue({ id: "gm" });
    mocks.cancelDialog.mockReset();
    mocks.cancelRoll.mockReset().mockResolvedValue(undefined);
    mocks.damage.mockReset().mockResolvedValue(null);
    mocks.mutation.mockReset().mockResolvedValue(null);
    mocks.prompts.clear();
    mocks.targets.mockReset().mockReturnValue([
      {
        actorId: "visible-actor",
        label: "Visible Target",
        tokenId: "visible-token",
        visible: true,
        zone: 1,
      },
      {
        actorId: "hidden-actor",
        label: "",
        tokenId: "hidden-token",
        visible: false,
        zone: 1,
      },
    ]);
    mocks.zoneRoll.mockReset();
  });

  afterEach(() => {
    resetD6ExplosiveAttackThreadsForTests();
    resetD6PendingInteractionsForTests();
    vi.unstubAllGlobals();
  });

  it("persists one root zone prompt without rolling and redacts hidden target identity", async () => {
    const context = installThreadContext();
    const thread = await createD6ExplosiveAttackThreadForDetonation(
      context.state,
      context.sourceActor as never,
      context.item as never,
    );

    expect(thread.attackMessageId).toBe(context.message.id);
    expect(thread.zones).toHaveLength(1);
    expect(mocks.prompts.size).toBe(1);
    expect(mocks.zoneRoll).not.toHaveBeenCalled();
    expect(thread.targets[1]).toMatchObject({
      stage: "awaiting-damage",
      visible: false,
      zone: 1,
    });
    expect(typeof thread.targets[1]?.targetKey).toBe("string");
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("repairs a player-owned root-card mirror from the authoritative Region ledger", async () => {
    const context = installThreadContext();
    const created = await createD6ExplosiveAttackThreadForDetonation(
      context.state,
      context.sourceActor as never,
      context.item as never,
    );
    await context.message.update({
      "flags.d6-system-2e.explosiveAttackThread": {
        ...created,
        requestId: "tampered-request",
      },
    });

    const recovered = await createD6ExplosiveAttackThreadForDetonation(
      context.state,
      context.sourceActor as never,
      context.item as never,
    );

    expect(recovered.requestId).toBe(context.state.requestId);
    expect(context.thread()?.requestId).toBe(context.state.requestId);
  });

  it("projects a newly appended canonical deviation when the embedded thread mirror is stale", async () => {
    const context = installThreadContext();
    const created = await createD6ExplosiveAttackThreadForDetonation(
      context.state,
      context.sourceActor as never,
      context.item as never,
    );
    const deviation = appendD6InitiatingActionResult(created.results, {
      appendId: `${created.requestId}:deviation`,
      details: {
        aimedPoint: "100, 100",
        direction: "Left",
        finalPoint: "120, 110",
      },
      kind: "explosive-deviation",
      rollMode: "publicroll",
      rolls: [
        {
          faces: [5],
          fingerprint: "a".repeat(64),
          formula: "1d6",
          total: 5,
        },
        {
          faces: [2, 4],
          fingerprint: "b".repeat(64),
          formula: "2d6",
          total: 6,
        },
      ],
    });
    await context.message.update({
      "flags.d6-system-2e.initiatingActionResults": deviation,
    });

    expect(context.thread()?.results.entries).toHaveLength(0);
    expect(
      d6ExplosiveAttackThreadFromMessage(context.message as never)?.results
        .entries,
    ).toMatchObject([
      {
        appendId: `${created.requestId}:deviation`,
        kind: "explosive-deviation",
      },
    ]);
  });

  it("keeps close pending, then records the shared zone roll exactly once before Resistance", async () => {
    const context = installThreadContext();
    await createD6ExplosiveAttackThreadForDetonation(
      context.state,
      context.sourceActor as never,
      context.item as never,
    );
    const prompt = [...mocks.prompts.values()][0];
    expect(prompt).toBeDefined();
    mocks.zoneRoll.mockResolvedValueOnce(null);
    mocks.targets.mockReturnValue([]);
    await expect(prompt?.reopen()).resolves.toBe("dismissed");
    expect(context.thread()?.zones[0]?.stage).toBe("pending");
    expect(context.message.rolls).toHaveLength(0);

    const rolled = damageResult();
    mocks.zoneRoll.mockImplementationOnce(
      async (...args: readonly unknown[]) => {
        const capture = args[8] as (
          result: D6RollResultV1,
          artifacts: readonly FoundryRoll[],
        ) => Promise<void>;
        await capture(rolled, [rollArtifact()]);
        return rolled;
      },
    );
    await expect(prompt?.reopen()).resolves.toBe("resolved");
    await vi.waitFor(() => expect(mocks.damage).toHaveBeenCalledTimes(2));

    expect(mocks.zoneRoll).toHaveBeenCalledTimes(2);
    expect(mocks.zoneRoll.mock.calls[1]?.[7]).toBe("blindroll");
    expect(context.thread()?.zones[0]).toMatchObject({
      result: { total: 13 },
      stage: "rolled",
    });
    expect(context.thread()?.targets).toMatchObject([
      { stage: "pending-resistance" },
      { stage: "pending-resistance" },
    ]);
    expect(context.message.rolls).toHaveLength(1);
    await expect(prompt?.reopen()).resolves.toBe("resolved");
    expect(context.message.rolls).toHaveLength(1);
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("starts each Resistance lifetime when zone Damage completes, not when the older attack card was created", async () => {
    const context = installThreadContext({ messageTimestamp: 1_000 });
    await createD6ExplosiveAttackThreadForDetonation(
      context.state,
      context.sourceActor as never,
      context.item as never,
    );
    const rolled = damageResult();
    mocks.zoneRoll.mockImplementationOnce(
      async (...args: readonly unknown[]) => {
        await (
          args[8] as (
            result: D6RollResultV1,
            artifacts: readonly FoundryRoll[],
          ) => Promise<void>
        )(rolled, [rollArtifact()]);
        return rolled;
      },
    );
    vi.spyOn(Date, "now").mockReturnValue(600_000);

    await [...mocks.prompts.values()][0]?.reopen();
    await vi.waitFor(() => expect(mocks.damage).toHaveBeenCalledTimes(2));

    const resistanceCreatedAt = mocks.damage.mock.calls.map((call) => {
      const request: unknown = call[3];
      return request && typeof request === "object" && "createdAt" in request
        ? request.createdAt
        : undefined;
    });
    expect(resistanceCreatedAt).toEqual([600_000, 600_000]);
  });

  it("validates and appends one routed Resistance artifact to the same root", async () => {
    mocks.targets.mockReturnValue([
      {
        actorId: "visible-actor",
        label: "Visible Target",
        tokenId: "visible-token",
        visible: true,
        zone: 1,
      },
    ]);
    const context = installThreadContext();
    await createD6ExplosiveAttackThreadForDetonation(
      context.state,
      context.sourceActor as never,
      context.item as never,
    );
    const targetKey = context.thread()?.targets[0]?.targetKey;
    expect(targetKey).toBeDefined();
    const rolled = damageResult();
    mocks.zoneRoll.mockImplementationOnce(
      async (...args: readonly unknown[]) => {
        await (
          args[8] as (
            result: D6RollResultV1,
            artifacts: readonly FoundryRoll[],
          ) => Promise<void>
        )(rolled, [rollArtifact()]);
        return rolled;
      },
    );
    const resistanceArtifact = await serializedArtifact("3d6", 12, [4, 3, 5]);
    mocks.damage.mockResolvedValueOnce({
      conditionLabel: "Healthy",
      flag: {
        resistanceRoll: {
          actorId: "visible-actor",
          baseFaces: [4, 3],
          characterPointFaces: [],
          difficulty: 13,
          pool: { dice: 3, pips: 0 },
          requestId: `explosive:request:resistance:${targetKey}`,
          resultModifier: 0,
          rollArtifacts: [resistanceArtifact],
          rollMode: "publicroll",
          total: 12,
          wildFaces: [5],
          wildOutcome: "normal",
          wildPolicy: "second-edition",
        },
      },
      resistanceTotal: 12,
    });

    await [...mocks.prompts.values()][0]?.reopen();
    await vi.waitFor(() =>
      expect(context.thread()?.targets[0]?.stage).toBe("applied"),
    );

    expect(context.thread()?.results.entries.map(({ kind }) => kind)).toEqual([
      "explosive-zone-damage",
      "explosive-target-resistance",
    ]);
    expect(context.message.rolls).toHaveLength(2);
  });

  it("refreshes the recipient root action when Resistance delivery follows the message update", async () => {
    mocks.targets.mockReturnValue([
      {
        actorId: "visible-actor",
        label: "Visible Target",
        tokenId: "visible-token",
        visible: true,
        zone: 1,
      },
    ]);
    const context = installThreadContext();
    await createD6ExplosiveAttackThreadForDetonation(
      context.state,
      context.sourceActor as never,
      context.item as never,
    );
    const rolled = damageResult();
    mocks.zoneRoll.mockImplementationOnce(
      async (...args: readonly unknown[]) => {
        await (
          args[8] as (
            result: D6RollResultV1,
            artifacts: readonly FoundryRoll[],
          ) => Promise<void>
        )(rolled, [rollArtifact()]);
        return rolled;
      },
    );
    await [...mocks.prompts.values()][0]?.reopen();
    await vi.waitFor(() =>
      expect(context.thread()?.targets[0]?.stage).toBe("pending-resistance"),
    );
    const targetKey = context.thread()?.targets[0]?.targetKey;
    expect(targetKey).toBeDefined();

    class FakeElement {
      readonly dataset: Record<string, string> = {};
      appended?: FakeElement;
      clickListener?: (event: Event) => void;
      replacedWith?: FakeElement;

      constructor(
        readonly kind:
          "card" | "container" | "control" | "existing" | "message" | "thread",
      ) {}

      addEventListener(type: string, listener: EventListener): void {
        if (type === "click") this.clickListener = listener;
      }

      getAttribute(name: string): string | null {
        return name === "data-message-id"
          ? (this.dataset.messageId ?? null)
          : null;
      }

      append(value: FakeElement): void {
        this.appended = value;
      }

      closest(selector: string): FakeElement | null {
        return this.kind === "control" && selector === "[data-prompt-id]"
          ? this
          : null;
      }

      dispatchClick(target: FakeElement): void {
        this.clickListener?.({ target } as unknown as Event);
      }

      matches(selector: string): boolean {
        return this.kind === "card" && selector === ".od6chat-roll";
      }

      querySelector(selector: string): FakeElement | null {
        if (this.kind === "message" && selector === ".od6chat-roll") {
          return card;
        }
        if (
          this.kind === "card" &&
          selector === "[data-explosive-attack-thread]"
        ) {
          return existing;
        }
        return null;
      }

      replaceWith(value: FakeElement): void {
        this.replacedWith = value;
      }
    }
    const card = new FakeElement("card");
    const existing = new FakeElement("existing");
    const messageElement = new FakeElement("message");
    const messageId = context.message.id;
    if (!messageId) throw new Error("Expected an attack message id.");
    messageElement.dataset.messageId = messageId;
    const threadElement = new FakeElement("thread");
    const container = new FakeElement("container") as FakeElement & {
      firstElementChild: FakeElement;
      innerHTML: string;
    };
    container.firstElementChild = threadElement;
    container.innerHTML = "";
    const renderTemplate = vi.fn(
      (_path: string, view: Record<string, unknown>) => {
        const targets = view.targets as readonly {
          readonly promptId: string;
          readonly showAction: boolean;
        }[];
        return Promise.resolve(
          targets[0]?.showAction === true ? "action-visible" : "no-action",
        );
      },
    );
    vi.stubGlobal("HTMLElement", FakeElement);
    vi.stubGlobal("document", {
      createElement: () => container,
      querySelectorAll: () => [messageElement],
    });
    vi.stubGlobal("foundry", {
      applications: { handlebars: { renderTemplate } },
    });
    vi.stubGlobal("Hooks", { on: vi.fn() });
    Object.assign(game, {
      user: { id: "player", isGM: false, name: "Player" },
    });
    registerD6ExplosiveAttackThreadLifecycle();

    const promptId = `explosive:${context.state.requestId}:resistance:${targetKey}`;
    const reopen = vi.fn(() => Promise.resolve("dismissed" as const));
    registerD6PendingInteraction({
      controllerUserId: "player",
      createdAt: Date.now(),
      id: promptId,
      kind: "resistance-roll",
      label: "Resistance",
      reopen,
    });

    await vi.waitFor(() => expect(existing.replacedWith).toBe(threadElement));
    const lastView = renderTemplate.mock.calls.at(-1)?.[1] as
      | { readonly targets?: readonly { readonly showAction: boolean }[] }
      | undefined;
    expect(lastView?.targets?.[0]?.showAction).toBe(true);
    const control = new FakeElement("control");
    control.dataset.promptId = promptId;
    card.dispatchClick(control);
    await vi.waitFor(() => expect(reopen).toHaveBeenCalledTimes(1));
  });

  it("retires only the exact authoritative Region after every target Health result is recorded", async () => {
    const context = installThreadContext();
    await createD6ExplosiveAttackThreadForDetonation(
      context.state,
      context.sourceActor as never,
      context.item as never,
    );
    const rolled = damageResult();
    mocks.zoneRoll.mockImplementationOnce(
      async (...args: readonly unknown[]) => {
        await (
          args[8] as (
            result: D6RollResultV1,
            artifacts: readonly FoundryRoll[],
          ) => Promise<void>
        )(rolled, [rollArtifact()]);
        return rolled;
      },
    );
    mocks.damage
      .mockResolvedValueOnce(damageOutcome("Wounded", 8))
      .mockResolvedValueOnce(damageOutcome("Stunned", 9));

    await [...mocks.prompts.values()][0]?.reopen();
    await vi.waitFor(() => expect(mocks.mutation).toHaveBeenCalledTimes(1));

    expect(mocks.mutation).toHaveBeenCalledWith({
      operation: "delete",
      regionId: context.state.regionId,
      requestId: context.state.requestId,
      sceneId: context.state.sceneId,
    });
    expect(context.thread()?.targets).toMatchObject([
      {
        conditionLabel: "Wounded",
        healthStateId: "wounded",
        stage: "applied",
      },
      { stage: "applied", visible: false },
    ]);
    expect(context.thread()?.targets[1]).not.toHaveProperty("conditionLabel");
    expect(context.thread()?.targets[1]).not.toHaveProperty("healthStateId");
  });

  it("cancels only thread-owned prompts and Region when the root message is deleted", async () => {
    const hooks = new Map<string, (...args: unknown[]) => void>();
    vi.stubGlobal("Hooks", {
      on: (name: string, handler: (...args: unknown[]) => void) =>
        hooks.set(name, handler),
    });
    const context = installThreadContext();
    await createD6ExplosiveAttackThreadForDetonation(
      context.state,
      context.sourceActor as never,
      context.item as never,
    );
    registerD6ExplosiveAttackThreadLifecycle();

    hooks.get("deleteChatMessage")?.(context.message);
    await vi.waitFor(() => expect(mocks.mutation).toHaveBeenCalledTimes(1));

    expect(mocks.cancelDialog).toHaveBeenCalledWith(
      `explosive:${context.state.requestId}:damage:1`,
    );
    expect(mocks.cancelRoll).toHaveBeenCalledTimes(2);
    expect(mocks.mutation).toHaveBeenCalledWith({
      operation: "delete",
      regionId: context.state.regionId,
      requestId: context.state.requestId,
      sceneId: context.state.sceneId,
    });
  });
});

function installThreadContext(
  options: { readonly messageTimestamp?: number } = {},
) {
  let threadFlag: unknown;
  let regionThreadFlag: unknown;
  let resultFlag: unknown;
  let presentedFlag: unknown;
  const state = explosiveState();
  const message = {
    getFlag: (_scope: string, key: string): unknown =>
      key === "roll"
        ? { request: { rollMode: "publicroll" } }
        : key === "explosiveAttackThread"
          ? threadFlag
          : key === "initiatingActionResults"
            ? resultFlag
            : key === "initiatingActionPresentedResults"
              ? presentedFlag
              : undefined,
    id: state.attackMessageId,
    rolls: [] as FoundryRoll[],
    timestamp: options.messageTimestamp ?? Date.now(),
    update: vi.fn((changes: Record<string, unknown>) => {
      threadFlag =
        changes["flags.d6-system-2e.explosiveAttackThread"] ?? threadFlag;
      resultFlag =
        changes["flags.d6-system-2e.initiatingActionResults"] ?? resultFlag;
      presentedFlag =
        changes["flags.d6-system-2e.initiatingActionPresentedResults"] ??
        presentedFlag;
      if (Array.isArray(changes.rolls))
        message.rolls = changes.rolls as FoundryRoll[];
      return Promise.resolve();
    }),
  };
  const sourceActor = {
    id: "source-actor",
    img: "source.webp",
    name: "Thrower",
    uuid: state.actorUuid,
  };
  const item = {
    id: "grenade",
    parent: { uuid: sourceActor.uuid },
    uuid: state.itemUuid,
  };
  const visibleActor = {
    id: "visible-actor",
    img: "visible.webp",
    name: "Visible Target",
  };
  const hiddenActor = {
    id: "hidden-actor",
    img: "hidden.webp",
    name: "Hidden Target",
  };
  const region = {
    getFlag: (_scope: string, key: string): unknown =>
      key === "explosive"
        ? state
        : key === "explosiveAttackThread"
          ? regionThreadFlag
          : key === "initiatingActionResults"
            ? resultFlag
            : undefined,
    id: state.regionId,
    update: vi.fn((changes: Record<string, unknown>) => {
      regionThreadFlag =
        changes["flags.d6-system-2e.explosiveAttackThread"] ?? regionThreadFlag;
      resultFlag =
        changes["flags.d6-system-2e.initiatingActionResults"] ?? resultFlag;
      return Promise.resolve();
    }),
  };
  const scene = {
    id: state.sceneId,
    regions: {
      contents: [region],
      get: (id: string) => (id === region.id ? region : undefined),
    },
  };
  vi.stubGlobal("game", {
    i18n: {
      format: (key: string, data: { readonly zone?: number }) =>
        `${key}:${data.zone ?? ""}`,
      localize: (key: string) => key,
    },
    messages: {
      get: (id: string) => (id === message.id ? message : undefined),
    },
    scenes: {
      contents: [scene],
      get: (id: string) => (id === scene.id ? scene : undefined),
    },
    user: { id: "gm", isGM: true, name: "Gamemaster" },
    users: { contents: [{ id: "gm", isGM: true }] },
  });
  vi.stubGlobal("canvas", {
    tokens: {
      placeables: [
        { actor: visibleActor, id: "visible-token" },
        { actor: hiddenActor, id: "hidden-token" },
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
  vi.stubGlobal(
    "fromUuid",
    vi.fn((uuid: string) =>
      Promise.resolve(uuid === state.actorUuid ? sourceActor : item),
    ),
  );
  return {
    item,
    message,
    sourceActor,
    state,
    thread: () => threadFlag as D6ExplosiveAttackThreadV1 | undefined,
  };
}

function rollArtifact(): FoundryRoll {
  const data = {
    dice: [{ results: [{ result: 4 }, { result: 4 }, { result: 5 }] }],
    formula: "3d6",
    total: 13,
  };
  return { ...data, toJSON: () => data };
}

async function serializedArtifact(
  formula: string,
  total: number,
  faces: readonly number[],
) {
  const serialized = JSON.stringify({
    dice: [{ results: faces.map((result) => ({ result })) }],
    formula,
    total,
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(serialized),
  );
  const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return {
    evidence: { faces, fingerprint, formula, total },
    serialized,
    version: 1 as const,
  };
}

function explosiveState(): D6ExplosiveRegionStateV1 {
  return {
    actorUuid: "Actor.source",
    affectedTargets: [],
    aimedPoint: { x: 100, y: 100 },
    attackHit: false,
    attackMessageId: "attack-message",
    blastProfile: {
      activeZoneCount: 4,
      damageKind: "physical",
      damageMode: "falloff",
      detonationTiming: "immediate",
      zones: [
        { damageScore: 0, index: 1, radiusMeters: 2 },
        { damageScore: 0, index: 2, radiusMeters: 4 },
        { damageScore: 0, index: 3, radiusMeters: 6 },
        { damageScore: 0, index: 4, radiusMeters: 8 },
      ],
    },
    combatId: "",
    difficulty: 15,
    itemUuid: "Actor.source.Item.grenade",
    origin: { x: 0, y: 0 },
    range: {
      band: "medium",
      distance: 15,
      maximumDistance: 20,
      outOfRange: false,
    },
    regionId: "region",
    requestId: "request",
    resolvedPoint: { x: 120, y: 110 },
    revision: 2,
    round: 0,
    sceneId: "scene",
    schema: 1,
    status: "resolved",
    tokenId: "source-token",
    userId: "gm",
    visualColor: "#65b9ff",
  };
}

function damageResult(): D6RollResultV1 {
  return {
    baseFaces: [4, 4],
    contractVersion: D6_ROLL_CONTRACT_VERSION,
    heroPointAward: 0,
    heroPointSpent: 0,
    pendingChoices: [],
    pool: {
      baseDice: 2,
      bonusOrdinaryDice: 0,
      bonusWildDice: 0,
      code: { dice: 3, pips: 0 },
      resultModifier: 0,
      wildDice: 1,
    },
    profileId: "second-edition",
    request: {
      context: {
        scale: {
          application: "damage",
          family: "ranked",
          modifierScore: 0,
          sourceActorId: "source-actor",
          sourceName: "Thrower",
          sourcePage: 0,
          sourceRank: 0,
          targetActorId: "source-actor",
          targetName: "Zone 1",
          targetRank: 0,
        },
      },
      contractVersion: D6_ROLL_CONTRACT_VERSION,
      heroPointUse: "none",
      kind: "damage",
      label: "Zone Damage",
      resultModifier: 0,
      rollMode: "blindroll",
      score: 12,
      source: {
        actorId: "source-actor",
        actorName: "Thrower",
        attributeId: "",
      },
    },
    requiresWildExplosion: false,
    total: 13,
    wildFaces: [5],
    wildOutcome: "normal",
    wildPolicy: "second-edition",
  };
}

function damageOutcome(conditionLabel: string, resistanceTotal: number) {
  return {
    conditionLabel,
    flag: { nextCondition: conditionLabel.toLocaleLowerCase() },
    resistanceTotal,
  };
}
