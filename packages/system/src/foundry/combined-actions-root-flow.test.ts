import type * as RollService from "./rolls/roll-service";
import {
  createD6OrdinaryAttackThread,
  claimD6OrdinaryAttackDamage,
  completeD6OrdinaryAttackDamage,
  parseD6OrdinaryAttackThread,
} from "../application/ordinary-attack-thread";
import { fixture as combatFixture } from "../application/combined-combat.test-fixtures";
import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { parseHTML } from "linkedom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveD6Roll,
  type D6RollInvocationOptionsV1,
  type D6RollRequestV1,
  type D6RollResultV1,
  type D6WeaponDamageContinuationRollContext,
} from "@d6-system-2e/core";
import {
  cancelCombinedActionRoot,
  continueCombinedActionRoot,
  registerCombinedActionSocket,
  registerCombinedActionLifecycle,
  resetCombinedActionsForTests,
  startCombinedAction,
} from "./combined-actions";
import { bindD6EmbeddedRollActions } from "./rolls/chat-card-actions";
import {
  combinedRoot,
  executeCombinedRootRoll,
  executeCombinedRootDamage,
  resetCombinedRootForTests,
  type CombinedRootBinding,
} from "./combined-action-root";
import { resetCombinedActionStateForTests } from "./combined-action-state";
const f = vi.hoisted(() => ({
  request: vi.fn(),
  owners: vi.fn(),
  roll: vi.fn(),
  renderResult: vi.fn(),
  wait: vi.fn(),
  cancel: vi.fn(),
  target: vi.fn(),
  attack: vi.fn(),
  damage: vi.fn(),
  sync: vi.fn(),
}));
vi.mock("./roll-requests", () => ({
  activeNonGmOwners: f.owners,
  requestCombinedActorRoll: f.request,
  cancelRollRequest: f.cancel,
}));
vi.mock("./rolls/roll-service", async (importOriginal) => ({
  d6RollMessageFlags: (await importOriginal<typeof RollService>())
    .d6RollMessageFlags,
  buildWeaponAttackTargetContext: f.target,
  rollCombinedWeaponAttack: f.attack,
  rollSuccessfulWeaponAttackDamage: f.damage,
  rollAttribute: f.roll,
  rollSkill: f.roll,
  renderD6RollResult: f.renderResult,
  retryD6MatchingResultReward: vi.fn(),
}));
vi.mock("./rolls/ordinary-attack-thread", () => ({
  synchronizeD6OrdinaryAttackThread: f.sync,
}));
vi.mock("./rolls/chat-card-actions", () => ({
  bindD6EmbeddedRollActions: vi.fn(),
}));
vi.mock("../settings/rules-profile-library", () => ({
  currentConfiguredRulesProfile: () => ({
    id: "second-edition",
    strategies: { actionEconomy: "d6e2.default" },
  }),
}));
vi.mock("../settings/roll-outcome", () => ({
  currentSuccessRuntimeStrategy: () => ({ evaluator: "second-edition-strict" }),
  currentWildDieRuntimeStrategy: () => ({ policy: "second-edition" }),
}));
vi.mock("../settings/setting-values", () => ({
  booleanSetting: (key: string, fallback: boolean) =>
    key.toLowerCase().includes("combined") || fallback,
  numberSetting: (_key: string, fallback: number) => fallback,
}));
vi.mock("../settings/pip-rules", () => ({
  currentCombinedPipScore: (a: number, b: number) => a + b,
}));
const template = Handlebars.compile(
  readFileSync(
    new URL(
      "../../../../templates/roll/combined-action-result.hbs",
      import.meta.url,
    ),
    "utf8",
  ),
);
const gm = { id: "gm", name: "GM", isGM: true, active: true };
let hooks: Map<string, (message: unknown, html?: unknown) => void>;
let actors: FoundryActorDocument[];
let cards: (FoundryChatMessageDocument & {
  content: string;
  rolls: FoundryRoll[];
})[];
let failLastPresentation: boolean;
let allocationBonus: number;
let application: "single" | "multiple" | "combat";
let created: ReturnType<typeof vi.fn>;
let emit: ReturnType<typeof vi.fn>;
let updates: Record<string, unknown>[];
let socketHandlers: ((value: unknown, senderId?: string) => void)[];
function artifact(formula: string, faces: number[]): FoundryRoll {
  const data = {
    formula,
    total: faces.reduce((a, b) => a + b, 0),
    dice: [{ results: faces.map((result) => ({ result })) }],
  };
  return { ...data, toJSON: () => data };
}
beforeEach(() => {
  vi.clearAllMocks();
  resetCombinedActionsForTests();
  resetCombinedRootForTests();
  resetCombinedActionStateForTests();
  f.owners.mockReturnValue([]);
  f.target.mockReturnValue({ selectedTarget: null });
  f.sync.mockResolvedValue(undefined);
  emit = vi.fn();
  socketHandlers = [];
  cards = [];
  updates = [];
  hooks = new Map();
  failLastPresentation = false;
  allocationBonus = 0;
  application = "single";
  actors = ["leader", "worker"].map((id) => {
    const skills = ["skill-a", "skill-b"].map((skillId) => ({
      id: skillId,
      type: "skill",
      name: skillId,
      system: { key: skillId, attributeId: "perception", score: 0 },
    }));
    const items = [
      ...skills,
      {
        id: "weapon",
        type: "weapon",
        name: "Explosive",
        system: { weaponKind: "thrown-explosive", key: "weapon" },
      },
    ];
    return {
      id,
      name: id,
      type: "character",
      img: "",
      isOwner: true,
      system: { attributes: { perception: { score: 9 } } },
      items: {
        contents: items,
        get: (key: string) => items.find((i) => i.id === key),
      },
      testUserPermission: () => true,
    } as unknown as FoundryActorDocument;
  });
  const { window, document } = parseHTML("<html><body></body></html>");
  vi.stubGlobal("HTMLElement", window.HTMLElement);
  vi.stubGlobal("document", document);
  Handlebars.registerHelper("localize", (key: string) => key);
  vi.stubGlobal("Hooks", {
    on: (key: string, fn: (message: unknown, html?: unknown) => void) =>
      hooks.set(key, fn),
  });
  vi.stubGlobal("ui", { notifications: { warn: vi.fn() } });
  vi.stubGlobal("game", {
    user: gm,
    users: {
      contents: [gm],
      get: (id: string) => (id === "gm" ? gm : undefined),
    },
    actors: {
      contents: actors,
      get: (id: string) => actors.find((a) => a.id === id),
    },
    messages: { get: (id: string) => cards.find((c) => c.id === id) },
    i18n: { localize: (key: string) => key, format: (key: string) => key },
    socket: {
      on: (
        _channel: string,
        handler: (value: unknown, senderId?: string) => void,
      ) => socketHandlers.push(handler),
      emit,
    },
  });
  f.wait.mockImplementation(() =>
    Promise.resolve(
      cards.length === 0
        ? {
            actorIds: ["leader", "worker"],
            difficulty: 7,
            leaderWorks: false,
            application,
          }
        : {
            allocations: [
              Math.ceil(allocationBonus / 2),
              Math.floor(allocationBonus / 2),
            ],
            subjectIds: ["skill-a", "skill-b"],
            weaponId: "weapon",
          },
    ),
  );
  // Combat creates its summary after its allocation prompt, so use a prompt counter.
  let prompts = 0;
  f.wait.mockImplementation(() =>
    Promise.resolve(
      application === "combat" && prompts === 1
        ? (++prompts, "weapon")
        : prompts++ === 0
          ? {
              actorIds: ["leader", "worker"],
              difficulty: 7,
              leaderWorks: false,
              application,
            }
          : {
              allocations: [
                Math.ceil(allocationBonus / 2),
                Math.floor(allocationBonus / 2),
              ],
              subjectIds: ["skill-a", "skill-b"],
              weaponId: "weapon",
            },
    ),
  );
  vi.stubGlobal("foundry", {
    utils: { randomID: () => "group" },
    applications: {
      api: { DialogV2: { wait: f.wait } },
      handlebars: {
        renderTemplate: (path: string, vm: Record<string, unknown>) => {
          if (path.includes("allocation"))
            allocationBonus = Number(vm.bonusScore);
          return Promise.resolve(
            path.endsWith("combined-action-result.hbs")
              ? template(vm)
              : "dialog",
          );
        },
      },
    },
  });
  created = vi.fn((input: Record<string, unknown>) => {
    const flags = new Map<string, unknown>(
      Object.entries(
        (input.flags as Record<string, Record<string, unknown>> | undefined)?.[
          "d6-system-2e"
        ] ?? {},
      ),
    );
    const card = {
      id: `root-${cards.length}`,
      content: typeof input.content === "string" ? input.content : "",
      rolls: [] as FoundryRoll[],
      getFlag: (_scope: string, key: string) => flags.get(key),
      update: (changes: Record<string, unknown>) => {
        updates.push(changes);
        if (
          failLastPresentation &&
          changes.rolls &&
          combinedRoot(card)?.steps.length === 2
        )
          return Promise.reject(new Error("presentation unavailable"));
        for (const [path, value] of Object.entries(changes))
          if (path.startsWith("flags.d6-system-2e."))
            flags.set(
              path.slice("flags.d6-system-2e.".length),
              structuredClone(value),
            );
        if (typeof changes.content === "string") card.content = changes.content;
        if (changes.rolls) card.rolls = changes.rolls as FoundryRoll[];
        return Promise.resolve();
      },
    } as unknown as (typeof cards)[number];
    cards.push(card);
    return Promise.resolve(card);
  });
  vi.stubGlobal("ChatMessage", { create: created });
  vi.stubGlobal("Roll", {
    fromJSON: (json: string) => {
      const data = JSON.parse(json) as FoundryRoll;
      return { ...data, toJSON: () => data };
    },
  });
  f.renderResult.mockImplementation((_actor: unknown, result: D6RollResultV1) =>
    Promise.resolve(
      `<article class="od6chat-roll"><strong>${result.total}</strong></article>`,
    ),
  );
  f.roll.mockImplementation(
    async (
      actor: FoundryActorDocument,
      id: string,
      options: D6RollInvocationOptionsV1 & {
        beforeDice(request: D6RollRequestV1): Promise<void>;
        captureRollExecution(
          result: D6RollResultV1,
          artifacts: FoundryRoll[],
        ): Promise<void>;
      },
    ) => {
      const request: D6RollRequestV1 = {
        contractVersion: 2,
        kind: id === "perception" ? "attribute" : "skill",
        label: id,
        score: 6,
        resultModifier: 0,
        heroPointUse: "none",
        rollMode: "publicroll",
        ...(options.combinedAction?.context.stage === "command"
          ? { difficulty: 7 }
          : {}),
        source: {
          actorId: actor.id,
          actorName: actor.name,
          ...(id === "perception" ? { attributeId: id } : { itemId: id }),
        },
        context: {
          requestedRoll: options.requestedRoll,
          combinedAction: options.combinedAction?.context,
        },
      } as D6RollRequestV1;
      await options.beforeDice(request);
      const result = resolveD6Roll({
        request,
        profileId: "second-edition",
        successEvaluator: "second-edition-strict",
        wildPolicy: "second-edition",
        baseFaces: [4],
        wildFaces: [5],
        wildFaceGroups: [[5]],
        characterPointFaceGroups: [],
        wildTriumph: {
          automaticSuccess: false,
          enabled: false,
          characterPointAward: 0,
          metaCurrencyAward: 0,
          threshold: 3,
        },
      });
      await options.captureRollExecution(result, [
        artifact("1d6", [4]),
        artifact("1dw", [5]),
      ]);
      return result;
    },
  );
  f.request.mockImplementation(
    async (
      actor: FoundryActorDocument,
      subject: { kind: "attribute"; attributeId: string },
      _label: string,
      _configuration: unknown,
      combinedAction: D6RollInvocationOptionsV1["combinedAction"],
      binding?: CombinedRootBinding & { requestId: string },
    ) => {
      if (!binding) return { status: "rolled", total: 9 };
      const result = await executeCombinedRootRoll(
        actor,
        subject,
        {
          combinedAction,
          requestedRoll: {
            requestId: binding.requestId,
            requesterUserId: "gm",
            requesterName: "GM",
            recipientUserId: "gm",
            rollMode: "publicroll",
            visibility: "public",
          },
        } as D6RollInvocationOptionsV1,
        binding,
      );
      return result
        ? { status: "rolled", total: result.total }
        : { status: "cancelled" };
    },
  );
  registerCombinedActionSocket();
});
afterEach(() => {
  resetCombinedRootForTests();
  resetCombinedActionsForTests();
  resetCombinedActionStateForTests();
  vi.unstubAllGlobals();
});
function leader() {
  const actor = actors[0];
  if (!actor) throw new Error("Missing actor");
  return actor;
}
function card() {
  const message = cards[0];
  if (!message) throw new Error("Missing card");
  return message;
}
describe("Combined initiating card orchestration", () => {
  it("binds restored terminal controls and used retries on the initial render before ready", async () => {
    await startCombinedAction(
      leader(),
      { kind: "attribute", attributeId: "perception" },
      "Team task",
    );
    const root = combinedRoot(card());
    const step = root?.steps[1];
    if (!root || !step) throw new Error("Missing fixture root");
    await card().update({
      ["flags.d6-system-2e.combinedActionRoot"]: {
        ...root,
        followUps: [{ stepId: step.id, claimedBy: "gm" }],
      },
    });
    const before = JSON.stringify({
      root: combinedRoot(card()),
      rolls: card().rolls,
    });
    resetCombinedActionsForTests();
    hooks.clear();
    const sockets = socketHandlers.length;
    registerCombinedActionLifecycle();
    registerCombinedActionLifecycle();
    expect(socketHandlers).toHaveLength(sockets);
    for (const isGM of [true, false]) {
      Object.assign(game, { user: isGM ? gm : { id: "player", isGM: false } });
      const { document } = parseHTML(
        card()
          .content.replace(/\shidden(?:="hidden")?/g, "")
          .replaceAll(" disabled", ""),
      );
      const html = document.querySelector("article");
      hooks.get("renderChatMessageHTML")?.(card(), html);
      expect(html?.classList.contains("od6-combined-actions-bound")).toBe(true);
      const buttons = Array.from(
        html?.querySelectorAll<HTMLButtonElement>(
          "[data-combined-root-action]",
        ) ?? [],
      );
      expect(buttons).toHaveLength(2);
      for (const button of buttons) {
        expect(button.disabled).toBe(true);
        expect(button.classList.contains("od6-combined-root-visible")).toBe(
          isGM,
        );
        expect(button.hidden).toBe(!isGM);
      }
      expect(bindD6EmbeddedRollActions).toHaveBeenCalledWith(
        card(),
        expect.anything(),
        step.result,
        true,
        expect.anything(),
      );
    }
    await expect(continueCombinedActionRoot(card())).rejects.toThrow(
      "Authority",
    );
    await expect(cancelCombinedActionRoot(card())).rejects.toThrow("Authority");
    expect(f.roll).toHaveBeenCalledTimes(2);
    expect(
      JSON.stringify({ root: combinedRoot(card()), rolls: card().rolls }),
    ).toBe(before);
  });
  it("keeps the Command and single task on exactly one card with complete roll details", async () => {
    await startCombinedAction(
      leader(),
      { kind: "attribute", attributeId: "perception" },
      "Team task",
    );
    expect(created).toHaveBeenCalledTimes(1);
    expect(combinedRoot(card())?.steps.map((s) => s.status)).toEqual([
      "recorded",
      "recorded",
    ]);
    expect(card().rolls).toHaveLength(4);
    expect(f.roll).toHaveBeenCalledTimes(2);
    expect(card().content).toContain("Root.Complete");
    expect(card().content).not.toContain("RestrictionHelp");
    expect(card().content.match(/data-combined-result-id=/g)).toHaveLength(2);
  });
  it("records each allocated Skill result on the same initiating card", async () => {
    application = "multiple";
    await startCombinedAction(
      leader(),
      { kind: "skill", itemId: "skill-a" },
      "Team task",
    );
    expect(created).toHaveBeenCalledTimes(1);
    expect(combinedRoot(card())?.steps).toHaveLength(3);
    expect(card().rolls).toHaveLength(6);
    expect(
      f.request.mock.calls.slice(1).map((call) => call[1] as unknown),
    ).toEqual([
      { kind: "skill", itemId: "skill-a" },
      { kind: "skill", itemId: "skill-b" },
    ]);
  });
  it("repairs the final saved dice after cancellation and reload without another roll", async () => {
    failLastPresentation = true;
    await startCombinedAction(
      leader(),
      { kind: "attribute", attributeId: "perception" },
      "Team task",
    );
    expect(combinedRoot(card())?.steps[1]?.status).toBe("recorded");
    await cancelCombinedActionRoot(card());
    resetCombinedRootForTests();
    failLastPresentation = false;
    const { document } = parseHTML(card().content);
    const html = document.querySelector("article");
    hooks.get("renderChatMessageHTML")?.(card(), html);
    expect(
      html?.querySelector<HTMLButtonElement>(
        '[data-combined-root-action="continue"]',
      )?.disabled,
    ).toBe(false);
    await continueCombinedActionRoot(card());
    expect(card().rolls).toHaveLength(4);
    expect(f.roll).toHaveBeenCalledTimes(2);
  });
  it("does not begin Command after forged participant consent and targets the authentic owner", async () => {
    const owner = { id: "owner", name: "Owner", active: true, isGM: false };
    f.owners.mockImplementation((actor: FoundryActorDocument) =>
      actor.id === "leader" ? [owner] : [],
    );
    const running = startCombinedAction(
      leader(),
      { kind: "attribute", attributeId: "perception" },
      "Team task",
    );
    await vi.waitFor(() =>
      expect(emit).toHaveBeenCalledWith(
        "system.d6-system-2e",
        expect.objectContaining({
          type: "combined-action-consent",
          targetUserId: "owner",
        }),
        { recipients: ["owner"] },
      ),
    );
    const request = emit.mock.calls
      .map((call) => call[1] as Record<string, unknown>)
      .find((p) => p.type === "combined-action-consent");
    if (!request) throw new Error("Missing consent request");
    const reply = {
      id: request.id,
      requesterUserId: "gm",
      targetUserId: "owner",
      type: "combined-action-consent-response",
      accepted: true,
    };
    for (const socket of socketHandlers) socket(reply, "stranger");
    await Promise.resolve();
    expect(created).not.toHaveBeenCalled();
    expect(f.roll).not.toHaveBeenCalled();
    for (const socket of socketHandlers) socket(reply, "owner");
    await running;
    expect(f.roll).toHaveBeenCalledTimes(2);
  });
  function targetedCombat(hit: boolean) {
    application = "combat";
    for (const actor of actors) {
      const weapon = required(actor.items.get("weapon"));
      Object.assign(weapon.system, { weaponKind: "standard" });
    }
    f.target.mockReturnValue({
      selectedTarget: { id: "target-token", actorId: "target" },
    });
    f.attack.mockImplementation(
      async (
        actor: FoundryActorDocument,
        itemId: string,
        intent: {
          weaponId: string;
          targetActorId: string;
          targetTokenId: string;
        },
        opts: CaptureOptions,
      ) => {
        const sample = combatFixture();
        const plan = {
          ...sample.plan,
          scale: {
            ...sample.plan.scale,
            sourceActorId: actor.id,
            sourceName: actor.name,
          },
        };
        const request: D6RollRequestV1 = {
          ...sample.attack,
          score: 12 + opts.combinedAction.bonusScore,
          difficulty: hit ? 7 : 100,
          source: {
            ...sample.attack.source,
            actorId: actor.id,
            actorName: actor.name,
            itemId,
          },
          context: {
            ...sample.attack.context,
            requestedRoll: opts.requestedRoll,
            combinedAction: opts.combinedAction.context,
            weaponDamageContinuation: plan,
            weaponAttack: {
              ...required(required(sample.attack.context).weaponAttack),
              defense: hit ? 7 : 100,
            },
          },
        };
        expect(intent).toMatchObject({
          weaponId: "weapon",
          targetActorId: "target",
          targetTokenId: "target-token",
        });
        await opts.beforeDice(request);
        const count = Math.floor(request.score / 3) - 1;
        const result = resolveD6Roll({
          request,
          profileId: "second-edition",
          successEvaluator: "second-edition-strict",
          wildPolicy: "second-edition",
          baseFaces: Array.from({ length: count }, () => 4),
          wildFaces: [5],
          wildTriumph: {
            automaticSuccess: false,
            enabled: false,
            characterPointAward: 0,
            metaCurrencyAward: 0,
            threshold: 3,
          },
        });
        await opts.captureRollExecution(result, [
          artifact(`${count}d6`, result.baseFaces as number[]),
          artifact("1dw", [5]),
        ]);
        return result;
      },
    );
    f.sync.mockImplementation(async (message: FoundryChatMessageDocument) => {
      if (message.getFlag("d6-system-2e", "ordinaryAttackThread")) return;
      const root = required(combinedRoot(message));
      const step = required(root.steps[1]);
      const thread = createD6OrdinaryAttackThread({
        actorId: step.actorId,
        actorName: required(step.result).request.source.actorName,
        attackHit: hit,
        attackMessageId: message.id,
        attackTotal: required(step.result).total,
        damagePlan: required(root.combatDamage).plan,
        defenseKind: "dodge",
        defenseLabel: "Dodge",
        defenseTotal: hit ? 7 : 100,
        requestId: `ordinary:${message.id}`,
        rollMode: "publicroll",
        targetActorId: "target",
        targetName: "Target",
        weaponId: "weapon",
        weaponName: "Weapon",
      });
      await message.update({
        "flags.d6-system-2e.ordinaryAttackThread": thread,
      });
    });
  }
  it("chooses targeted ordinary intent before Command and waits for its one Damage continuation", async () => {
    targetedCombat(true);
    await startCombinedAction(
      required(actors[0]),
      { kind: "skill", itemId: "skill-a" },
      "Team combat",
    );
    const card = required(cards[0]);
    const root = required(combinedRoot(card));
    expect(cards).toHaveLength(1);
    expect(root.version).toBe(2);
    expect(root.steps.map((step) => [step.subject.kind, step.status])).toEqual([
      ["attribute", "recorded"],
      ["weaponAttack", "recorded"],
      ["weaponDamage", "pending"],
    ]);
    expect(f.request).toHaveBeenCalledTimes(2); // Command and Attack; ordinary owns Damage.
    expect(card.content).toContain("AwaitingDamage");
    await continueCombinedActionRoot(card);
    expect(f.request).toHaveBeenCalledTimes(2);
    expect(f.attack).toHaveBeenCalledTimes(1);
  });
  it("titles combat from the chosen Weapon while preserving historic root and Command evidence", async () => {
    targetedCombat(true);
    await startCombinedAction(
      required(actors[0]),
      { kind: "skill", itemId: "skill-a" },
      "Climbing",
    );
    const card = required(cards[0]);
    const root = required(combinedRoot(card));
    expect(root.label).toBe(root.steps[1]?.label);
    expect(root.label).not.toBe("Climbing");
    const historical = { ...root, label: "Climbing" };
    await card.update({ "flags.d6-system-2e.combinedActionRoot": historical });
    await continueCombinedActionRoot(card);
    expect(combinedRoot(card)).toEqual(historical);
    const { document } = parseHTML(card.content);
    expect(document.querySelector("header strong")?.textContent).toBe(
      root.steps[1]?.label,
    );
    expect(combinedRoot(card)?.steps[0]).toEqual(root.steps[0]);
    expect(f.request).toHaveBeenCalledTimes(2);
  });
  it("decorates completed historical combat headings on initial GM/player render without persistence", async () => {
    targetedCombat(false);
    await startCombinedAction(
      required(actors[0]),
      { kind: "skill", itemId: "skill-a" },
      "Climbing",
    );
    const message = required(cards[0]),
      root = required(combinedRoot(message));
    const historical = { ...root, label: "Climbing" };
    expect(root.steps[2]?.status).toBe("skipped");
    const { document } = parseHTML(message.content);
    required(document.querySelector("header strong")).textContent = "Climbing";
    await message.update({
      "flags.d6-system-2e.combinedActionRoot": historical,
      content: required(document.querySelector("article")).outerHTML,
    });
    const before = JSON.stringify({
      root: combinedRoot(message),
      rolls: message.rolls,
      content: message.content,
    });
    resetCombinedActionsForTests();
    hooks.clear();
    registerCombinedActionLifecycle();
    for (const isGM of [true, false]) {
      Object.assign(game, { user: isGM ? gm : { id: "player", isGM: false } });
      const dom = parseHTML(
        `<div class="message-content">${message.content}</div>`,
      );
      const html = required(dom.document.querySelector(".message-content"));
      hooks.get("renderChatMessageHTML")?.(message, html);
      expect(html.querySelector("header strong")?.textContent).toBe(
        root.steps[1]?.label,
      );
      expect(
        JSON.stringify({
          root: combinedRoot(message),
          rolls: message.rolls,
          content: message.content,
        }),
      ).toBe(before);
    }
    expect(f.request).toHaveBeenCalledTimes(2);
    expect(f.damage).not.toHaveBeenCalled();
  });
  it("waits after Damage receipt until ordinary Health is terminal", async () => {
    targetedCombat(true);
    await startCombinedAction(
      required(actors[0]),
      { kind: "skill", itemId: "skill-a" },
      "Team combat",
    );
    const card = required(cards[0]);
    f.damage.mockImplementation(
      async (
        _actor: object,
        attack: D6RollResultV1,
        plan: D6WeaponDamageContinuationRollContext,
        opts: CaptureOptions,
      ) => {
        const request: D6RollRequestV1 = {
          contractVersion: 2,
          kind: "damage",
          label: "Damage",
          score: plan.score + opts.combinedAction.bonusScore,
          heroPointUse: "none",
          rollMode: "publicroll",
          resultModifier: 0,
          source: attack.request.source,
          context: {
            requestedRoll: opts.requestedRoll,
            combinedAction: opts.combinedAction.context,
            weaponDamage: plan.weaponDamage,
            scale: plan.scale,
            ...(plan.autofire ? { autofire: plan.autofire } : {}),
          },
        };
        await opts.beforeDice(request);
        const faces = Array.from(
          { length: Math.floor(request.score / 3) - 1 },
          () => 4,
        );
        const result = resolveD6Roll({
          request,
          profileId: "second-edition",
          successEvaluator: "second-edition-strict",
          wildPolicy: "second-edition",
          baseFaces: faces,
          wildFaces: [5],
          wildTriumph: {
            automaticSuccess: false,
            enabled: false,
            characterPointAward: 0,
            metaCurrencyAward: 0,
            threshold: 3,
          },
        });
        await opts.captureRollExecution(result, [
          artifact(`${faces.length}d6`, faces),
          artifact("1dw", [5]),
        ]);
        return result;
      },
    );
    const actor = required(
      actors.find(
        (actor) => actor.id === combinedRoot(card)?.steps[2]?.actorId,
      ),
    );
    await executeCombinedRootDamage(card, actor);
    await continueCombinedActionRoot(card);
    expect(card.content).toContain("Root.AwaitingHealth");
    expect(card.content).not.toContain("Root.Complete");
    const root = required(combinedRoot(card));
    const child = required(
      parseD6OrdinaryAttackThread(
        card.getFlag("d6-system-2e", "ordinaryAttackThread"),
      ),
    );
    const completed = completeD6OrdinaryAttackDamage(
      claimD6OrdinaryAttackDamage(child),
      required(required(root.steps[2]).result),
      required(root.results.entries[2]),
    );
    await card.update({
      "flags.d6-system-2e.ordinaryAttackThread": {
        ...completed,
        target: { ...completed.target, stage: "applied" },
      },
    });
    await continueCombinedActionRoot(card);
    expect(card.content).toContain("Root.Complete");
    expect(f.damage).toHaveBeenCalledTimes(1);
    expect(f.attack).toHaveBeenCalledTimes(1);
  });
  it("keeps the chosen Weapon with zero allocation when Command earns no bonus", async () => {
    targetedCombat(true);
    f.roll.mockImplementation(
      async (actor: FoundryActorDocument, id: string, opts: CaptureOptions) => {
        const request: D6RollRequestV1 = {
          contractVersion: 2,
          kind: "attribute",
          label: "Command",
          score: 3,
          difficulty: 7,
          heroPointUse: "none",
          rollMode: "publicroll",
          resultModifier: 0,
          source: { actorId: actor.id, actorName: actor.name, attributeId: id },
          context: {
            requestedRoll: opts.requestedRoll,
            combinedAction: opts.combinedAction.context,
          },
        };
        await opts.beforeDice(request);
        const result = resolveD6Roll({
          request,
          profileId: "second-edition",
          successEvaluator: "second-edition-strict",
          wildPolicy: "second-edition",
          baseFaces: [],
          wildFaces: [2],
          wildTriumph: {
            automaticSuccess: false,
            enabled: false,
            characterPointAward: 0,
            metaCurrencyAward: 0,
            threshold: 3,
          },
        });
        await opts.captureRollExecution(result, [artifact("1dw", [2])]);
        return result;
      },
    );
    await startCombinedAction(
      required(actors[0]),
      { kind: "skill", itemId: "skill-a" },
      "Team combat",
    );
    const root = required(combinedRoot(required(cards[0])));
    expect(
      root.steps
        .slice(1)
        .map((step) => [step.subject.kind, step.options.bonusScore]),
    ).toEqual([
      ["weaponAttack", 0],
      ["weaponDamage", 0],
    ]);
    expect(f.wait).toHaveBeenCalledTimes(2); // Setup and intent; no allocation needed.
    expect(f.attack).toHaveBeenCalledTimes(1);
  });
  it("narrows hidden-target intent before storing it on the new root", async () => {
    targetedCombat(true);
    f.target.mockReturnValue({
      selectedTarget: { id: "target-token", actorId: "target", hidden: true },
    });
    await startCombinedAction(
      required(actors[0]),
      { kind: "skill", itemId: "skill-a" },
      "Team combat",
    );
    const first = updates.find(
      (update) => update["flags.d6-system-2e.combinedActionRoot"],
    );
    expect(first).toMatchObject({
      whisper: ["gm"],
      "flags.d6-system-2e.combinedActionRoot": {
        combatIntent: { targetActorId: "target" },
      },
    });
  });
  it("starts no Command or root when Weapon intent is cancelled", async () => {
    application = "combat";
    f.wait
      .mockResolvedValueOnce({
        actorIds: ["leader", "worker"],
        difficulty: 7,
        leaderWorks: false,
        application,
      })
      .mockResolvedValueOnce(null);
    await startCombinedAction(
      required(actors[0]),
      { kind: "skill", itemId: "skill-a" },
      "Team combat",
    );
    expect(f.request).not.toHaveBeenCalled();
    expect(cards).toHaveLength(0);
  });
  it("ends a missed attack without requesting or reallocating Damage", async () => {
    targetedCombat(false);
    await startCombinedAction(
      required(actors[0]),
      { kind: "skill", itemId: "skill-a" },
      "Team combat",
    );
    const card = required(cards[0]);
    expect(combinedRoot(card)?.steps[2]?.status).toBe("skipped");
    expect(card.content).toContain("Root.Complete");
    expect(f.request).toHaveBeenCalledTimes(2);
    await continueCombinedActionRoot(card);
    expect(f.attack).toHaveBeenCalledTimes(1);
  });
  it.each(["explosive", "untargeted"])(
    "preserves the existing %s route without a partial new root",
    async (kind) => {
      application = "combat";
      if (kind === "untargeted")
        for (const actor of actors)
          Object.assign(required(actor.items.get("weapon")).system, {
            weaponKind: "standard",
          });
      await startCombinedAction(
        leader(),
        { kind: "attribute", attributeId: "perception" },
        "Team combat",
      );
      expect(f.request).toHaveBeenCalledTimes(3);
      expect(f.request.mock.calls.every((call) => call[5] === undefined)).toBe(
        true,
      );
      expect(
        f.request.mock.calls.slice(1).map((call) => call[1] as unknown),
      ).toEqual([
        { itemId: "weapon", kind: "weaponAttack" },
        { itemId: "weapon", kind: "weaponDamage" },
      ]);
      expect(combinedRoot(card())).toBeNull();
      expect(card().getFlag("d6-system-2e", "combinedAction")).toBeDefined();
      expect(f.roll).not.toHaveBeenCalled();
    },
  );
});

function required<T>(value: T | null | undefined): T {
  if (value === undefined || value === null)
    throw new Error("Missing test fixture value");
  return value;
}

type CaptureOptions = D6RollInvocationOptionsV1 & {
  combinedAction: NonNullable<D6RollInvocationOptionsV1["combinedAction"]>;
  requestedRoll: NonNullable<D6RollInvocationOptionsV1["requestedRoll"]>;
  beforeDice(request: D6RollRequestV1): Promise<void>;
  captureRollExecution(
    result: D6RollResultV1,
    artifacts: readonly FoundryRoll[],
  ): Promise<void>;
};
