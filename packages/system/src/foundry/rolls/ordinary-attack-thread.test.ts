import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  D6_ROLL_CONTRACT_VERSION,
  type D6RollResultV1,
  type D6WeaponDamageContinuationRollContext,
} from "@d6-system-2e/core";
import {
  activeD6PendingInteractions,
  registerD6PendingInteraction,
  reopenD6PendingInteraction,
  resetD6PendingInteractionsForTests,
} from "../../application/pending-interactions";

const mocks = vi.hoisted(() => ({
  append: vi.fn(),
  damage: vi.fn(),
  rollDamage: vi.fn(),
}));

vi.mock("../initiating-action-message", () => ({
  appendD6InitiatingActionPresentation: mocks.append,
  D6_INITIATING_ACTION_RESULTS_FLAG: "initiatingActionResults",
  hydrateD6FoundryRolls: vi.fn(() => Promise.resolve([])),
  serializeD6FoundryRolls: vi.fn(() =>
    Promise.resolve([
      {
        evidence: {
          faces: [4, 3, 2],
          fingerprint: "a".repeat(64),
          formula: "3d6",
          total: 9,
        },
        serialized: "{}",
        version: 1,
      },
    ]),
  ),
}));

vi.mock("./chat-card-actions", () => ({
  successfulWeaponDamageFollowUp: vi.fn((result: D6RollResultV1) => ({
    actorId: result.request.source.actorId,
    targetActorId: "target",
    targetName: "Target",
    weaponId: "weapon",
  })),
}));

vi.mock("./damage-resolution", () => ({
  initiatingActionDamageKind: vi.fn(() => "physical"),
  resolveInitiatingActionDamageTarget: mocks.damage,
}));

vi.mock("./roll-service", () => ({
  rollSuccessfulWeaponAttackDamage: mocks.rollDamage,
}));

vi.mock("../roll-requests", () => ({
  cancelRollRequest: vi.fn(() => Promise.resolve()),
}));

import {
  d6OrdinaryAttackTargetAuthorized,
  d6OrdinaryAttackThreadFromMessage,
  registerD6OrdinaryAttackThreadLifecycle,
  resetD6OrdinaryAttackThreadForTests,
  synchronizeD6OrdinaryAttackThread,
} from "./ordinary-attack-thread";

function roll(
  kind: "damage" | "weapon-attack",
  total: number,
  options: {
    readonly attackScore?: number;
    readonly damagePlan?: D6WeaponDamageContinuationRollContext;
    readonly targetHidden?: boolean;
  } = {},
): D6RollResultV1 {
  return {
    baseFaces: [4, 3],
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
      ...(kind === "weapon-attack"
        ? {
            context: {
              weaponDamageContinuation: options.damagePlan ?? damagePlan(),
              weaponAttack: {
                attackKind: "ranged" as const,
                baseDefense: 10,
                coverModifier: 0,
                coverSourcePage: 30 as const,
                defense: 10,
                defenseKind: "dodge" as const,
                targetActorId: "target",
                ...(options.targetHidden ? { targetHidden: true } : {}),
                targetName: "Target",
                targetTokenId: "target-token",
                weaponId: "weapon",
              },
            },
          }
        : {
            context: {
              scale: {
                application: "damage" as const,
                modifierScore: 0,
                sourceActorId: "attacker",
                sourceName: "Attacker",
                sourcePage: 196,
                sourceRank: 0,
                targetActorId: "target",
                targetName: "Target",
                targetRank: 0,
                targetTokenId: "target-token",
              },
            },
          }),
      contractVersion: D6_ROLL_CONTRACT_VERSION,
      heroPointUse: "none",
      kind,
      label: kind,
      resultModifier: 0,
      rollMode: "publicroll",
      score: kind === "weapon-attack" ? (options.attackScore ?? 9) : 9,
      source: {
        actorId: "attacker",
        actorName: "Attacker",
        attributeId: "agility",
        itemId: "weapon",
      },
    },
    requiresWildExplosion: false,
    ...(kind === "weapon-attack" ? { success: true } : {}),
    total,
    wildFaces: [2],
    wildPolicy: "second-edition",
    wildOutcome: "normal",
  };
}

function damagePlan(
  options: {
    readonly autofire?: boolean;
    readonly baseKind?:
      | "attribute"
      | "fixed"
      | "skill"
      | "stale-skill-fallback"
      | "strength-damage";
    readonly score?: number;
    readonly scaleModifier?: number;
  } = {},
): D6WeaponDamageContinuationRollContext {
  const score = options.score ?? 15;
  return {
    bindingId: "damage-binding",
    score,
    scale: {
      application: "damage",
      modifierScore: options.scaleModifier ?? 0,
      sourceActorId: "attacker",
      sourceName: "Attacker",
      sourcePage: 83,
      sourceRank: 0,
      targetActorId: "target",
      targetName: "Target",
      targetRank: 0,
      targetTokenId: "target-token",
    },
    weaponDamage: {
      attributeId: options.baseKind === "fixed" ? "" : "strength",
      baseKind: options.baseKind ?? "fixed",
      baseScore: options.baseKind === "fixed" ? 0 : score - 6,
      configuredSkillKey: options.baseKind === "skill" ? "lifting" : "",
      listedDamageScore: options.baseKind === "fixed" ? score : 6,
      ...(options.baseKind === "skill"
        ? { skillItemId: "lifting", skillName: "Lifting" }
        : {}),
    },
    ...(options.autofire
      ? {
          autofire: {
            attackModifier: -3,
            damageModifier: 6,
            maximum: 3,
            sourcePage: 163,
            spend: 1,
          },
        }
      : {}),
  };
}

function context(
  options: {
    readonly attackScore?: number;
    readonly damagePlan?: D6WeaponDamageContinuationRollContext;
    readonly targetHidden?: boolean;
  } = {},
) {
  const flags = new Map<string, unknown>([
    ["roll", roll("weapon-attack", 15, options)],
  ]);
  const message = {
    id: "root",
    rolls: [{}],
    timestamp: 1000,
    getFlag: (_scope: string, key: string) => flags.get(key),
    update: vi.fn((changes: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(changes)) {
        const match = /^flags\.d6-system-2e\.(.+)$/u.exec(key);
        if (match?.[1]) flags.set(match[1], structuredClone(value));
      }
      return Promise.resolve(message);
    }),
  };
  const weapon = {
    id: "weapon",
    name: "Blaster",
    system: { weaponKind: "standard" },
    type: "weapon",
  };
  const attacker = {
    id: "attacker",
    img: "attacker.webp",
    items: { get: (id: string) => (id === weapon.id ? weapon : undefined) },
    name: "Attacker",
  };
  const target = { id: "target", name: "Target" };
  const gm = { active: true, id: "gm", isGM: true, name: "Gamemaster" };
  vi.stubGlobal("game", {
    actors: {
      get: (id: string) =>
        id === attacker.id ? attacker : id === target.id ? target : undefined,
    },
    i18n: { localize: (key: string) => key },
    settings: { get: () => false, set: vi.fn(() => Promise.resolve()) },
    user: gm,
    users: { activeGM: gm, contents: [gm] },
  });
  return { message };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function resistanceOutcome() {
  return {
    conditionLabel: "Wounded",
    flag: {
      damageKind: "physical" as const,
      damageTotal: 9,
      incoming: "wounded",
      nextCondition: "wounded",
      previousCondition: "healthy",
      prevented: false,
      resistanceComplication: false,
      resistanceRoll: {
        actorId: "target",
        baseFaces: [3],
        characterPointFaces: [],
        difficulty: 9,
        pool: { dice: 2, pips: 0 },
        requestId: "ordinary-resistance:ordinary:root:target",
        resultModifier: 0,
        rollArtifacts: [
          {
            evidence: {
              faces: [3, 2],
              fingerprint: "b".repeat(64),
              formula: "2d6",
              total: 5,
            },
            serialized: "{}",
            version: 1 as const,
          },
        ],
        rollMode: "publicroll" as const,
        total: 5,
        wildFaces: [2],
        wildOutcome: "normal" as const,
        wildPolicy: "second-edition" as const,
      },
      resistanceTotal: 5,
      status: "applied" as const,
      strategy: "second-edition-conditions" as const,
      targetActorId: "target",
      targetName: "Target",
      version: 1 as const,
    },
    resistanceTotal: 5,
  };
}

describe("Foundry ordinary initiating attack thread", () => {
  beforeEach(() => {
    mocks.append.mockReset().mockResolvedValue("appended");
    mocks.damage.mockReset().mockResolvedValue(null);
    mocks.rollDamage.mockReset();
  });

  afterEach(() => {
    resetD6OrdinaryAttackThreadForTests();
    resetD6PendingInteractionsForTests();
    vi.unstubAllGlobals();
  });

  it("rolls nothing on open/cancel and appends explicit Damage once to the root", async () => {
    const { message } = context();
    await synchronizeD6OrdinaryAttackThread(message as never);
    expect(
      d6OrdinaryAttackThreadFromMessage(message as never)?.damage.stage,
    ).toBe("pending");
    expect(mocks.rollDamage).not.toHaveBeenCalled();
    const prompt = activeD6PendingInteractions("gm")[0];
    expect(prompt?.kind).toBe("damage-resolution");

    mocks.rollDamage.mockResolvedValueOnce(null);
    await reopenD6PendingInteraction(prompt?.id ?? "");
    expect(
      d6OrdinaryAttackThreadFromMessage(message as never)?.damage.stage,
    ).toBe("pending");
    expect(mocks.append).not.toHaveBeenCalled();

    mocks.rollDamage.mockImplementationOnce(
      async (
        _actor: unknown,
        _attack: unknown,
        _plan: D6WeaponDamageContinuationRollContext,
        options: {
          readonly captureRollExecution: (
            result: D6RollResultV1,
            artifacts: readonly unknown[],
          ) => Promise<void>;
        },
      ) => {
        const damage = roll("damage", 9);
        await synchronizeD6OrdinaryAttackThread(message as never);
        expect(
          d6OrdinaryAttackThreadFromMessage(message as never)?.damage.stage,
        ).toBe("rolling");
        await options.captureRollExecution(damage, [{}]);
        return damage;
      },
    );
    await reopenD6PendingInteraction(prompt?.id ?? "");
    expect(
      d6OrdinaryAttackThreadFromMessage(message as never)?.damage.stage,
    ).toBe("rolled");
    expect(mocks.append).toHaveBeenCalledTimes(1);
    expect(mocks.rollDamage.mock.calls[1]?.[2]).toEqual(damagePlan());
    expect(mocks.rollDamage.mock.calls[1]?.[3]).toMatchObject({
      fixedRollMode: "publicroll",
      suppressChatMessage: true,
    });
    await synchronizeD6OrdinaryAttackThread(message as never);
    expect(mocks.append).toHaveBeenCalledTimes(1);
  });

  it("reopens a root Riposte after Foundry replaces its projection before and after a dismissed dialog", async () => {
    const { message } = context();
    await synchronizeD6OrdinaryAttackThread(message as never);
    const reopen = vi.fn(() => Promise.resolve("dismissed" as const));
    registerD6PendingInteraction({
      controllerUserId: "gm",
      createdAt: 1000,
      id: "ordinary:root:riposte",
      kind: "requested-roll",
      label: "Roll Riposte",
      reopen,
    });

    type Hook = (...args: unknown[]) => void;
    const hooks = new Map<string, Hook>();
    let visibleThread: RenderLifecycleElement | undefined;
    class RenderLifecycleElement {
      readonly dataset: Record<string, string> = {};
      readonly clickListeners: EventListener[] = [];
      parentElement: RenderLifecycleElement | undefined;

      constructor(
        readonly kind: "card" | "container" | "control" | "message" | "thread",
      ) {}

      addEventListener(type: string, listener: EventListener): void {
        if (type === "click") this.clickListeners.push(listener);
      }

      append(value: RenderLifecycleElement): void {
        value.parentElement = this;
        if (this.kind === "card") visibleThread = value;
      }

      closest(selector: string): RenderLifecycleElement | null {
        return this.kind === "control" && selector === "[data-prompt-id]"
          ? this
          : null;
      }

      dispatchClick(): void {
        const event = { target: this } as unknown as Event;
        this.propagateClick(event);
      }

      propagateClick(event: Event): void {
        for (const listener of this.clickListeners) listener(event);
        this.parentElement?.propagateClick(event);
      }

      matches(selector: string): boolean {
        return this.kind === "card" && selector === ".od6chat-roll";
      }

      querySelector(selector: string): RenderLifecycleElement | null {
        if (this.kind === "message" && selector === ".od6chat-roll")
          return card;
        if (
          this.kind === "card" &&
          selector === "[data-ordinary-attack-thread]"
        )
          return visibleThread ?? null;
        return null;
      }

      replaceWith(value: RenderLifecycleElement): void {
        value.parentElement = this.parentElement;
        this.parentElement = undefined;
        visibleThread = value;
      }
    }
    const card = new RenderLifecycleElement("card");
    const messageElement = new RenderLifecycleElement("message");
    vi.stubGlobal("Element", RenderLifecycleElement);
    vi.stubGlobal("HTMLElement", RenderLifecycleElement);
    vi.stubGlobal("document", {
      createElement: () => {
        const thread = new RenderLifecycleElement("thread");
        const container = new RenderLifecycleElement(
          "container",
        ) as RenderLifecycleElement & {
          firstElementChild: RenderLifecycleElement;
          innerHTML: string;
        };
        container.firstElementChild = thread;
        container.innerHTML = "";
        return container;
      },
      querySelectorAll: () => [],
    });
    vi.stubGlobal("foundry", {
      applications: {
        handlebars: { renderTemplate: vi.fn(() => Promise.resolve("root")) },
      },
    });
    vi.stubGlobal("Hooks", {
      on: vi.fn((name: string, hook: Hook) => {
        hooks.set(name, hook);
      }),
    });
    registerD6OrdinaryAttackThreadLifecycle();
    const render = hooks.get("renderChatMessageHTML");
    expect(render).toBeDefined();

    render?.(message, messageElement);
    await vi.waitFor(() => expect(visibleThread).toBeDefined());
    const firstThread = visibleThread;
    const firstReplacement = new RenderLifecycleElement("thread");
    firstThread?.replaceWith(firstReplacement);
    const firstControl = new RenderLifecycleElement("control");
    firstControl.dataset.promptId = "ordinary:root:riposte";
    firstReplacement.append(firstControl);
    firstControl.dispatchClick();
    await vi.waitFor(() => expect(reopen).toHaveBeenCalledTimes(1));
    expect(card.clickListeners).toHaveLength(1);

    const priorProjection = visibleThread;
    render?.(message, messageElement);
    await vi.waitFor(() => expect(visibleThread).not.toBe(priorProjection));
    const secondThread = visibleThread;
    const secondReplacement = new RenderLifecycleElement("thread");
    secondThread?.replaceWith(secondReplacement);
    const secondControl = new RenderLifecycleElement("control");
    secondControl.dataset.promptId = "ordinary:root:riposte";
    secondReplacement.append(secondControl);
    secondControl.dispatchClick();
    await vi.waitFor(() => expect(reopen).toHaveBeenCalledTimes(2));
    expect(card.clickListeners).toHaveLength(1);
  });

  it("reopens a GM continuation from a 7D attack with the captured fixed 5D Damage pool", async () => {
    const capturedDamage = damagePlan({ baseKind: "fixed", score: 15 });
    const { message } = context({
      attackScore: 21,
      damagePlan: capturedDamage,
    });
    await synchronizeD6OrdinaryAttackThread(message as never);
    const prompt = activeD6PendingInteractions("gm")[0];

    mocks.rollDamage.mockImplementationOnce(
      async (
        _actor: unknown,
        attack: D6RollResultV1,
        plan: D6WeaponDamageContinuationRollContext,
        options: {
          readonly captureRollExecution: (
            result: D6RollResultV1,
            artifacts: readonly unknown[],
          ) => Promise<void>;
        },
      ) => {
        expect(attack.request.score).toBe(21);
        expect(plan).toEqual(capturedDamage);
        expect(plan.score).toBe(15);
        const baseDamage = roll("damage", 18);
        const damage: D6RollResultV1 = {
          ...baseDamage,
          pool: {
            ...baseDamage.pool,
            baseDice: 4,
            code: { dice: 5, pips: 0 },
          },
          request: { ...baseDamage.request, score: plan.score },
        };
        await options.captureRollExecution(damage, [{}]);
        return damage;
      },
    );

    await reopenD6PendingInteraction(prompt?.id ?? "");
    const thread = d6OrdinaryAttackThreadFromMessage(message as never);
    expect(thread?.damage.result?.request.score).toBe(15);
    expect(thread?.damage.result?.pool.code).toEqual({ dice: 5, pips: 0 });
    expect(mocks.rollDamage).toHaveBeenCalledOnce();
  });

  it("validates and appends one Resistance before projecting GM-applied Health", async () => {
    const { message } = context();
    mocks.damage.mockResolvedValue(resistanceOutcome());
    await synchronizeD6OrdinaryAttackThread(message as never);
    const prompt = activeD6PendingInteractions("gm")[0];
    mocks.rollDamage.mockImplementationOnce(
      async (
        _actor: unknown,
        _attack: unknown,
        _plan: D6WeaponDamageContinuationRollContext,
        options: {
          readonly captureRollExecution: (
            result: D6RollResultV1,
            artifacts: readonly unknown[],
          ) => Promise<void>;
        },
      ) => {
        const damage = roll("damage", 9);
        await options.captureRollExecution(damage, [{}]);
        return damage;
      },
    );

    await reopenD6PendingInteraction(prompt?.id ?? "");
    await vi.waitFor(() =>
      expect(
        d6OrdinaryAttackThreadFromMessage(message as never)?.target.stage,
      ).toBe("applied"),
    );
    const thread = d6OrdinaryAttackThreadFromMessage(message as never);
    expect(thread?.target).toMatchObject({
      conditionLabel: "Wounded",
      healthStateId: "wounded",
      resistanceTotal: 5,
      stage: "applied",
    });
    expect(thread?.results.entries.map(({ kind }) => kind)).toEqual([
      "ordinary-weapon-damage",
      "ordinary-target-resistance",
    ]);
    expect(mocks.append).toHaveBeenCalledTimes(2);
    await synchronizeD6OrdinaryAttackThread(message as never);
    expect(mocks.damage).toHaveBeenCalledTimes(1);
    expect(mocks.append).toHaveBeenCalledTimes(2);
  });

  it("preserves an active Resistance operation across root recovery and completes it once", async () => {
    const { message } = context();
    const resistance = deferred<ReturnType<typeof resistanceOutcome>>();
    mocks.damage.mockReturnValueOnce(resistance.promise);
    await synchronizeD6OrdinaryAttackThread(message as never);
    const prompt = activeD6PendingInteractions("gm")[0];
    mocks.rollDamage.mockImplementationOnce(
      async (
        _actor: unknown,
        _attack: unknown,
        _plan: D6WeaponDamageContinuationRollContext,
        options: {
          readonly captureRollExecution: (
            result: D6RollResultV1,
            artifacts: readonly unknown[],
          ) => Promise<void>;
        },
      ) => {
        const damage = roll("damage", 9);
        await options.captureRollExecution(damage, [{}]);
        return damage;
      },
    );

    await reopenD6PendingInteraction(prompt?.id ?? "");
    await vi.waitFor(() =>
      expect(
        d6OrdinaryAttackThreadFromMessage(message as never)?.target.stage,
      ).toBe("resolving"),
    );

    await synchronizeD6OrdinaryAttackThread(message as never);
    expect(
      d6OrdinaryAttackThreadFromMessage(message as never)?.target.stage,
    ).toBe("resolving");

    resistance.resolve(resistanceOutcome());
    await vi.waitFor(() =>
      expect(
        d6OrdinaryAttackThreadFromMessage(message as never)?.target.stage,
      ).toBe("applied"),
    );
    await synchronizeD6OrdinaryAttackThread(message as never);

    const completed = d6OrdinaryAttackThreadFromMessage(message as never);
    expect(completed?.results.entries.map(({ kind }) => kind)).toEqual([
      "ordinary-weapon-damage",
      "ordinary-target-resistance",
    ]);
    expect(mocks.damage).toHaveBeenCalledTimes(1);
    expect(mocks.append).toHaveBeenCalledTimes(2);
    expect(activeD6PendingInteractions("gm")).toHaveLength(0);
  });

  it("keeps cancelled Resistance pending and completes only an explicit reopen", async () => {
    const { message } = context();
    mocks.damage.mockResolvedValueOnce(null);
    await synchronizeD6OrdinaryAttackThread(message as never);
    const prompt = activeD6PendingInteractions("gm")[0];
    mocks.rollDamage.mockImplementationOnce(
      async (
        _actor: unknown,
        _attack: unknown,
        _plan: D6WeaponDamageContinuationRollContext,
        options: {
          readonly captureRollExecution: (
            result: D6RollResultV1,
            artifacts: readonly unknown[],
          ) => Promise<void>;
        },
      ) => {
        const damage = roll("damage", 9);
        await options.captureRollExecution(damage, [{}]);
        return damage;
      },
    );

    await reopenD6PendingInteraction(prompt?.id ?? "");
    await vi.waitFor(() =>
      expect(
        d6OrdinaryAttackThreadFromMessage(message as never)?.target.stage,
      ).toBe("pending-resistance"),
    );
    expect(mocks.damage).toHaveBeenCalledOnce();
    expect(mocks.append).toHaveBeenCalledOnce();
    expect(
      d6OrdinaryAttackThreadFromMessage(message as never)?.results.entries,
    ).toHaveLength(1);

    mocks.damage.mockResolvedValueOnce(resistanceOutcome());
    await synchronizeD6OrdinaryAttackThread(message as never);
    await vi.waitFor(() =>
      expect(
        d6OrdinaryAttackThreadFromMessage(message as never)?.target.stage,
      ).toBe("applied"),
    );
    await synchronizeD6OrdinaryAttackThread(message as never);
    expect(mocks.damage).toHaveBeenCalledTimes(2);
    expect(mocks.append).toHaveBeenCalledTimes(2);
  });

  it("releases a stale abandoned Resistance claim and reopens it after reload", async () => {
    const { message } = context();
    mocks.damage.mockImplementationOnce(() => new Promise(() => undefined));
    await synchronizeD6OrdinaryAttackThread(message as never);
    const prompt = activeD6PendingInteractions("gm")[0];
    mocks.rollDamage.mockImplementationOnce(
      async (
        _actor: unknown,
        _attack: unknown,
        _plan: D6WeaponDamageContinuationRollContext,
        options: {
          readonly captureRollExecution: (
            result: D6RollResultV1,
            artifacts: readonly unknown[],
          ) => Promise<void>;
        },
      ) => {
        const damage = roll("damage", 9);
        await options.captureRollExecution(damage, [{}]);
        return damage;
      },
    );

    await reopenD6PendingInteraction(prompt?.id ?? "");
    await vi.waitFor(() =>
      expect(
        d6OrdinaryAttackThreadFromMessage(message as never)?.target.stage,
      ).toBe("resolving"),
    );
    resetD6OrdinaryAttackThreadForTests();
    mocks.damage.mockResolvedValueOnce(null);
    await synchronizeD6OrdinaryAttackThread(message as never);

    await vi.waitFor(() =>
      expect(
        d6OrdinaryAttackThreadFromMessage(message as never)?.target.stage,
      ).toBe("pending-resistance"),
    );
    expect(mocks.damage).toHaveBeenCalledTimes(2);
    expect(mocks.append).toHaveBeenCalledOnce();
  });

  it.each([
    ["fixed", 15],
    ["attribute", 18],
    ["skill", 21],
    ["strength-damage", 24],
  ] as const)(
    "reloads and forwards the captured %s Damage base without recomputing mutable documents",
    async (baseKind, score) => {
      const { message } = context({
        damagePlan: damagePlan({ baseKind, score }),
      });

      await synchronizeD6OrdinaryAttackThread(message as never);
      const reloaded = d6OrdinaryAttackThreadFromMessage(message as never);
      expect(reloaded?.damage.plan).toEqual(damagePlan({ baseKind, score }));
      const prompt = activeD6PendingInteractions("gm")[0];
      mocks.rollDamage.mockResolvedValueOnce(null);
      await reopenD6PendingInteraction(prompt?.id ?? "");
      expect(mocks.rollDamage).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        damagePlan({ baseKind, score }),
        expect.objectContaining({ suppressChatMessage: true }),
      );
    },
  );

  it("persists hidden redaction across a reload without target semantics", async () => {
    const { message } = context({ targetHidden: true });
    await synchronizeD6OrdinaryAttackThread(message as never);
    const persisted = d6OrdinaryAttackThreadFromMessage(message as never);

    expect(persisted?.target).toEqual({
      stage: "awaiting-damage",
      targetActorId: "target",
      visible: false,
    });
    expect(d6OrdinaryAttackThreadFromMessage(message as never)?.target).toEqual(
      persisted?.target,
    );
    expect(activeD6PendingInteractions("gm")[0]?.subjectLabel).toBe(
      "D6E2.Explosive.HiddenTarget",
    );
  });

  it("projects target details only to the GM or an involved owning player", async () => {
    const { message } = context();
    await synchronizeD6OrdinaryAttackThread(message as never);
    const thread = d6OrdinaryAttackThreadFromMessage(message as never);
    expect(thread).not.toBeNull();
    const gm = { id: "gm", isGM: true };
    const attackerOwner = { id: "attacker-owner", isGM: false };
    const targetOwner = { id: "target-owner", isGM: false };
    const unrelated = { id: "unrelated", isGM: false };
    const actor = {
      testUserPermission: (user: { readonly id: string }) =>
        user.id === attackerOwner.id,
    };
    const target = {
      testUserPermission: (user: { readonly id: string }) =>
        user.id === targetOwner.id,
    };

    expect(
      d6OrdinaryAttackTargetAuthorized(
        thread as never,
        gm as never,
        actor as never,
        target as never,
      ),
    ).toBe(true);
    expect(
      d6OrdinaryAttackTargetAuthorized(
        thread as never,
        attackerOwner as never,
        actor as never,
        target as never,
      ),
    ).toBe(true);
    expect(
      d6OrdinaryAttackTargetAuthorized(
        thread as never,
        targetOwner as never,
        actor as never,
        target as never,
      ),
    ).toBe(true);
    expect(
      d6OrdinaryAttackTargetAuthorized(
        thread as never,
        unrelated as never,
        actor as never,
        target as never,
      ),
    ).toBe(false);

    const hidden = context({ targetHidden: true });
    await synchronizeD6OrdinaryAttackThread(hidden.message as never);
    const hiddenThread = d6OrdinaryAttackThreadFromMessage(
      hidden.message as never,
    );
    expect(
      d6OrdinaryAttackTargetAuthorized(
        hiddenThread as never,
        gm as never,
        actor as never,
        target as never,
      ),
    ).toBe(false);
  });
});
