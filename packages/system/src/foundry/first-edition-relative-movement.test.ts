import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { parseHTML } from "linkedom";
import {
  firstEditionSegmentMovementPlan,
  requireDestinyValue as required,
  resolveD6Roll,
  type D6RollResultV1,
} from "@d6-system-2e/core";
import {
  createFirstEditionRelativeMovement,
  advanceFirstEditionRelativeMovement,
  type FirstEditionRelativeMovement,
} from "../application/first-edition-relative-movement";
import {
  claimFirstEditionActionStage,
  recordFirstEditionActionStage,
} from "../application/first-edition-action-root";
import type { FirstEditionRollCapture } from "../application/first-edition-action-ports";
import {
  continueRelativeMovement,
  bindRelativeMovementRoot,
  relativeMovementContent,
  tryRelativeMovementRoot,
} from "./first-edition-relative-movement";
const f = vi.hoisted(() => ({
  route: vi.fn(),
  roll: vi.fn(),
  segmentRoll: vi.fn(),
  audit: vi.fn(),
  bind: vi.fn(),
  render: vi.fn(),
  available: true,
  combat: {},
}));
vi.mock("./combat-round-private", () => ({
  activeGridCombat: () => f.combat,
  requestPrivateMovementRoot: f.route,
}));
vi.mock("./combat-service", () => ({
  readCombatantRound: () => ({ combatantId: "c", revision: 2 }),
}));
vi.mock("./first-edition-relative-movement-authority", () => ({
  RELATIVE_MOVEMENT_ROOT_FLAG: "firstEditionRelativeMovement",
  registerRelativeMovementAuthority: vi.fn(),
  setRelativeMovementRenderer: vi.fn(),
  relativeMovementContextAvailable: () => f.available,
  relativeMovementRollRuntime: () => ({
    profileId: "first-edition",
    successEvaluator: "first-edition-meets",
    wildPolicy: "first-edition",
  }),
}));
vi.mock("./rolls/roll-service", () => ({
  rollFirstEditionMovementCheck: f.roll,
  rollFirstEditionSegmentRunningCheck: f.segmentRoll,
  renderD6RollResult: () =>
    Promise.resolve('<div class="d6-roll">full ordinary detail</div>'),
}));
vi.mock("./rolls/chat-card-actions", () => ({
  bindD6EmbeddedRollActions: f.bind,
}));
vi.mock("./free-d6-feature-service", () => ({
  persistFreeD6FeatureRollAudit: f.audit,
  privacySafeFreeD6FeatureRollResult: <T>(value: T) => value,
}));
vi.mock("./distinction-automation-service", () => ({
  privacySafeDistinctionRollResult: <T>(value: T) => value,
}));
vi.mock("./initiating-action-message", () => ({
  hydrateD6FoundryRolls: () => Promise.resolve([]),
  serializeD6FoundryRolls: (rolls: { faces: number[] }[]) =>
    Promise.resolve(
      rolls.map((r) => ({
        version: 1,
        serialized: JSON.stringify(r),
        evidence: {
          faces: r.faces,
          formula: "2d6",
          total: r.faces.reduce((a, b) => a + b, 0),
          fingerprint: "a".repeat(64),
        },
      })),
    ),
}));
let value: FirstEditionRelativeMovement,
  actor: FoundryActorDocument,
  effects: number,
  presentations: number,
  failRecord: boolean;
let serial = 0;
function fixture(distance = 15) {
  const id = `movement-${++serial}`;
  return createFirstEditionRelativeMovement({
    rootMessageId: id,
    operationId: id,
    coordinatorUserId: "gm",
    controllerUserId: "owner",
    subject: {
      actorId: "actor",
      actorUuid: "Scene.scene.Token.token.Actor.actor",
      sceneId: "scene",
      tokenUuid: "Scene.scene.Token.token",
    },
    runtime: {
      profileId: "first-edition",
      movementStrategyId: "open-d6.movement.relative",
      actionEconomyStrategyId: "economy",
    },
    combat: {
      uuid: "Combat.combat",
      combatantUuid: "Combat.combat.Combatant.c",
      revision: 2,
    },
    source: { attributeId: "agility" },
    planInput: {
      type: "land",
      baseMove: 10,
      distance,
      hasMovementSkill: false,
    },
    translation: {
      kind: "token-translation",
      actorUuid: "Scene.scene.Token.token.Actor.actor",
      sceneId: "scene",
      tokenUuid: "Scene.scene.Token.token",
      from: { x: 0, y: 0, unit: "pixels" },
      to: { x: 15, y: 0, unit: "pixels" },
      distance: { value: distance, unit: "meters" },
      measurement: { sceneUnits: "m", gridSize: 100, gridDistance: 1 },
    },
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  effects = 0;
  presentations = 0;
  failRecord = false;
  f.available = true;
  value = fixture();
  actor = {
    id: "actor",
    uuid: "Scene.scene.Token.token.Actor.actor",
    isOwner: true,
    testUserPermission: () => true,
  } as unknown as FoundryActorDocument;
  f.combat = { id: "combat", combatants: { contents: [{ id: "c", actor }] } };
  const { window } = parseHTML("<html><body></body></html>");
  vi.stubGlobal("HTMLElement", window.HTMLElement);
  vi.stubGlobal("game", {
    user: { id: "owner", active: true, isGM: false },
    i18n: {
      localize: (key: string) => key,
      format: (key: string, data: unknown) => key + JSON.stringify(data),
    },
    messages: new Map(),
  });
  vi.stubGlobal("fromUuid", (uuid: string) =>
    Promise.resolve(uuid === actor.uuid ? actor : null),
  );
  vi.stubGlobal("foundry", {
    utils: { randomID: (size = 16) => "A".repeat(size) },
    applications: { handlebars: { renderTemplate: f.render } },
  });
  vi.stubGlobal("ui", { notifications: { warn: vi.fn() } });
  f.render.mockResolvedValue("content");
  f.route.mockImplementation(
    async (command: { data: Record<string, unknown> }) => {
      await Promise.resolve();
      const d = command.data;
      if (d.method === "load" || d.method === "create")
        return structuredClone(value);
      if (d.method === "cas") {
        const next = d.next as typeof value.action;
        if (d.revision !== value.action.revision) return false;
        if (failRecord && next.stages.some((s) => s.state === "recorded")) {
          failRecord = false;
          throw Error("record failed");
        }
        value = { ...value, action: next };
        return true;
      }
      if (d.method === "advance")
        value = advanceFirstEditionRelativeMovement(value);
      if (d.method === "effect") {
        const stage = value.action.stages.find((s) => s.state !== "recorded");
        if (stage?.spec.kind !== "effect") throw Error("bad effect");
        const claimed = claimFirstEditionActionStage(
          value.action,
          stage.id,
          "owner",
          { kind: "effect" },
        );
        value = {
          ...value,
          action: recordFirstEditionActionStage(claimed, stage.id, {
            kind: "effect",
            receiptKey: `${stage.id}:effect`,
            plan: stage.spec.plan,
            authorityReceiptId: "witness",
            outcome: "applied",
          }),
        };
        effects++;
      }
      if (d.method === "present") presentations++;
      return structuredClone(value);
    },
  );
  f.segmentRoll.mockImplementation(
    (a: unknown, difficulty: number, distance: number, hooks: unknown) =>
      f.roll(
        a,
        { difficulty, distance },
        hooks,
      ) as Promise<D6RollResultV1 | null>,
  );
  f.roll.mockImplementation(
    async (
      _actor: unknown,
      _plan: unknown,
      hooks: FirstEditionRollCapture<FoundryRoll>,
    ): Promise<D6RollResultV1> => {
      const request = {
        contractVersion: 2 as const,
        kind: "attribute" as const,
        label: "Movement",
        score: 6,
        resultModifier: 0,
        difficulty: value.plan.difficulty,
        heroPointUse: "none" as const,
        rollMode: "gmroll" as const,
        source: {
          actorId: "actor",
          actorName: "Mover",
          attributeId: "agility",
        },
      };
      await hooks.beforeDice(request);
      const result = resolveD6Roll({
        profileId: "first-edition",
        successEvaluator: "first-edition-meets",
        wildPolicy: "first-edition",
        request,
        baseFaces: [4],
        wildFaces: [4],
      });
      await hooks.captureRollExecution(result, [
        { faces: [4, 4] } as unknown as FoundryRoll,
      ]);
      return result;
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
it("captures one ordinary roll on the root, translates once and restores completed presentation without another roll", async () => {
  expect((await continueRelativeMovement(value)).action.status).toBe(
    "complete",
  );
  expect(f.roll).toHaveBeenCalledTimes(1);
  expect(f.audit).toHaveBeenCalledTimes(1);
  expect(effects).toBe(1);
  await continueRelativeMovement(value);
  expect(f.roll).toHaveBeenCalledTimes(1);
  expect(effects).toBe(1);
  expect(presentations).toBeGreaterThan(1);
});
it("retains the invocation's captured roll across failed receipt save", async () => {
  failRecord = true;
  await expect(continueRelativeMovement(value)).rejects.toThrow(
    "record failed",
  );
  expect(value.action.stages[0]?.state).toBe("claimed");
  expect((await continueRelativeMovement(value)).action.status).toBe(
    "complete",
  );
  expect(f.roll).toHaveBeenCalledTimes(1);
  expect(effects).toBe(1);
});
it("leaves dialog cancellation unresolved without spending or translating", async () => {
  f.roll.mockResolvedValue(null);
  expect((await continueRelativeMovement(value)).action.stages[0]?.state).toBe(
    "pending",
  );
  expect(effects).toBe(0);
});
it("refuses to reroll an orphaned claimed check after reload", async () => {
  const stage = value.action.stages[0];
  if (!stage) throw Error("stage");
  const request = {
    contractVersion: 2 as const,
    kind: "attribute" as const,
    label: "Movement",
    score: 6,
    resultModifier: 0,
    difficulty: 5,
    heroPointUse: "none" as const,
    rollMode: "gmroll" as const,
    source: { actorId: "actor", actorName: "Mover", attributeId: "agility" },
  };
  value = {
    ...value,
    action: claimFirstEditionActionStage(value.action, stage.id, "owner", {
      kind: "d6-roll",
      request,
      runtime: {
        profileId: "first-edition",
        successEvaluator: "first-edition-meets",
        wildPolicy: "first-edition",
      },
    }),
  };
  await expect(continueRelativeMovement(value)).rejects.toThrow("uncertain");
  expect(f.roll).not.toHaveBeenCalled();
  expect(effects).toBe(0);
});
it("does not offer an action or movement receipt before either is saved", async () => {
  await relativeMovementContent(value, actor);
  expect(f.render).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      root: true,
      trackedAction: false,
      rollDetails: [],
      movementOutcome: {
        label: "D6E2.Combat.FirstEdition.MovementRoot.NotConfirmed",
      },
    }),
  );
});
it("binds full saved roll detail and the exact synthetic Actor before revealing controls on initial render", async () => {
  await continueRelativeMovement(value);
  await relativeMovementContent(value, actor);
  expect(f.render).toHaveBeenLastCalledWith(
    expect.any(String),
    expect.objectContaining({
      rollDetails: [
        expect.objectContaining({
          content: '<div class="d6-roll">full ordinary detail</div>',
        }),
      ],
    }),
  );
  const stage = value.action.stages[0];
  if (!stage) throw Error("stage");
  const { document } = parseHTML(
    `<article class="od6-first-edition-movement-root"><div data-d6-movement-result-id="${stage.id}"></div><button hidden="hidden" disabled data-d6-movement-root-action="continue"></button></article>`,
  );
  const card = document.querySelector("article");
  if (!card) throw Error("card");
  f.bind.mockImplementation(() =>
    expect(card.classList.contains("od6-movement-root-bound")).toBe(false),
  );
  const message = {
    id: value.action.rootMessageId,
    getFlag: () => value,
  } as unknown as FoundryChatMessageDocument;
  const beforeCalls = f.route.mock.calls.length;
  await bindRelativeMovementRoot(message, card);
  expect(f.bind).toHaveBeenCalledWith(
    message,
    expect.anything(),
    expect.anything(),
    false,
    expect.anything(),
    actor,
  );
  expect(card.classList.contains("od6-movement-root-bound")).toBe(true);
  expect(card.querySelector("button")?.hidden).toBe(false);
  expect(f.route.mock.calls.length).toBe(beforeCalls);
  expect(f.roll).toHaveBeenCalledTimes(1);
  await bindRelativeMovementRoot(message, card);
  expect(f.bind).toHaveBeenCalledTimes(1);
});
it("returns unsupported before any command in unchanged legacy contexts", async () => {
  f.available = false;
  const result = await tryRelativeMovementRoot(
    actor,
    { destination: { x: 4, y: 0 }, type: "land" },
    { token: { id: "token" } } as never,
  );
  expect(result).toBeNull();
  expect(f.route).not.toHaveBeenCalled();
});
it.each(["dismissal", "failure"])(
  "refreshes the same card rendered while running after pre-dice %s",
  async (outcome) => {
    const { document } = parseHTML(
      '<article class="od6-first-edition-movement-root"><button disabled data-d6-movement-root-action="continue"></button><button disabled data-d6-movement-root-action="cancel"></button></article>',
    );
    const card = document.querySelector("article");
    if (!card) throw Error("card");
    const message = {
      id: value.action.rootMessageId,
      getFlag: () => value,
    } as unknown as FoundryChatMessageDocument;
    f.segmentRoll.mockImplementation(
      (a: unknown, difficulty: number, distance: number, hooks: unknown) =>
        f.roll(
          a,
          { difficulty, distance },
          hooks,
        ) as Promise<D6RollResultV1 | null>,
    );
    f.roll.mockImplementation(async () => {
      await bindRelativeMovementRoot(message, card);
      expect(
        Array.from(card.querySelectorAll("button")).every((b) => b.disabled),
      ).toBe(true);
      if (outcome === "failure") throw Error("before dice failed");
      return null;
    });
    if (outcome === "failure")
      await expect(continueRelativeMovement(value)).rejects.toThrow(
        "before dice failed",
      );
    else await continueRelativeMovement(value);
    expect(
      Array.from(card.querySelectorAll("button")).every((b) => !b.disabled),
    ).toBe(true);
    expect(effects).toBe(0);
    expect(value.action.stages[0]?.state).toBe("pending");
  },
);
it("refreshes controls from the latest committed state instead of re-enabling Cancel", async () => {
  const { document } = parseHTML(
    '<article class="od6-first-edition-movement-root"><button disabled data-d6-movement-root-action="continue"></button><button disabled data-d6-movement-root-action="cancel"></button></article>',
  );
  const card = document.querySelector("article");
  if (!card) throw Error("card");
  const message = {
    id: value.action.rootMessageId,
    getFlag: () => value,
  } as unknown as FoundryChatMessageDocument;
  await bindRelativeMovementRoot(message, card);
  await continueRelativeMovement(value);
  expect(
    card.querySelector<HTMLButtonElement>(
      '[data-d6-movement-root-action="cancel"]',
    )?.disabled,
  ).toBe(true);
  expect(
    card.querySelector<HTMLButtonElement>(
      '[data-d6-movement-root-action="continue"]',
    )?.disabled,
  ).toBe(false);
});
it("shows a pending owner root as read-only to the GM and never opens its builder", async () => {
  Object.assign(game.user ?? {}, { id: "gm", isGM: true });
  const { document } = parseHTML(
    '<article class="od6-first-edition-movement-root"><button data-d6-movement-root-action="continue"></button><button data-d6-movement-root-action="cancel"></button></article>',
  );
  const card = document.querySelector("article");
  if (!card) throw Error("card");
  const message = {
    id: value.action.rootMessageId,
    getFlag: () => value,
  } as unknown as FoundryChatMessageDocument;
  await bindRelativeMovementRoot(message, card);
  expect(
    Array.from(card.querySelectorAll("button")).every((b) => b.disabled),
  ).toBe(true);
  expect(card.querySelector("button")?.textContent).toContain("Repair");
  await continueRelativeMovement(value);
  expect(f.roll).not.toHaveBeenCalled();
  expect(effects).toBe(0);
  expect(
    f.route.mock.calls.map(
      ([command]) => (command as { data: { method: string } }).data.method,
    ),
  ).not.toContain("advance");
});
it("GM repairs known check presentation without claiming the pending owner translation", async () => {
  await continueRelativeMovement(value);
  const check = value.action.stages[0];
  if (!check) throw Error("check");
  value = advanceFirstEditionRelativeMovement({
    ...value,
    action: { ...value.action, status: "open", stages: [check] },
  });
  effects = 0;
  f.roll.mockClear();
  Object.assign(game.user ?? {}, { id: "gm", isGM: true });
  const before = f.route.mock.calls.length;
  await continueRelativeMovement(value);
  expect(
    f.route.mock.calls
      .slice(before)
      .map(
        ([command]) => (command as { data: { method: string } }).data.method,
      ),
  ).toEqual(["load", "present"]);
  expect(f.roll).not.toHaveBeenCalled();
  expect(effects).toBe(0);
});

it.each(["native", "crypto"])(
  "generates a native ChatMessage-sized ID through the real helper (%s)",
  async (backend) => {
    const expectedId =
      backend === "native" ? "A".repeat(16) : "1234567812341234";
    if (backend === "crypto") {
      vi.stubGlobal("foundry", {});
      vi.stubGlobal("crypto", {
        randomUUID: () => "12345678-1234-1234-1234-123456789abc",
      });
    }
    // Foundry respects the requested size; the shared helper defaults to 24.
    // The authority/native ChatMessage boundary requires exactly 16 characters.
    f.route.mockImplementationOnce(
      (command: { data: { rootMessageId: string } }) => {
        if (!/^[a-zA-Z0-9]{16}$/.test(command.data.rootMessageId))
          return Promise.reject(new Error("first-edition-action:invalid"));
        return Promise.resolve(null);
      },
    );
    await expect(
      tryRelativeMovementRoot(
        actor,
        {
          destination: { x: 1750, y: 1050 },
          expectedRevision: 2,
          type: "land",
          terrainModifier: 0,
        },
        {
          token: {
            id: "token",
            document: { uuid: "Scene.scene.Token.token", x: 1500, y: 1000 },
          },
        } as never,
      ),
    ).resolves.toBeNull();
    expect(f.route).toHaveBeenCalledWith({
      kind: "relative-movement-root",
      actorId: "actor",
      combatantId: "c",
      revision: 2,
      data: {
        method: "create",
        rootMessageId: expectedId,
        tokenUuid: "Scene.scene.Token.token",
        origin: { x: 1500, y: 1000 },
        destination: { x: 1750, y: 1050 },
        type: "land",
        terrainModifier: 0,
      },
    });
    expect(f.roll).not.toHaveBeenCalled();
    expect(effects).toBe(0);
  },
);

function runningFixture(distance = 3) {
  const old = fixture(distance);
  return createFirstEditionRelativeMovement({
    rootMessageId: old.action.rootMessageId,
    operationId: old.action.operationId,
    controllerUserId: "owner",
    coordinatorUserId: "gm",
    subject: required(old.action.subjects[0]).actor,
    combat: old.combat,
    runtime: {
      ...old.action.runtime,
      movementStrategyId: "open-d6.movement.segmented",
    },
    planInput: old.planInput,
    source: { attributeId: "agility" },
    translation: old.translation,
    segment: {
      round: 1,
      actionId: "run",
      spentActionCount: 0,
      plannedActionCount: 3,
      effectiveScores: [9, 12, 12],
      reactive: false,
      plan: firstEditionSegmentMovementPlan({
        baseMove: 10,
        plannedActionCount: 3,
        effectiveScores: [9, 12, 12],
        running: true,
      }),
    },
    spend: {
      kind: "segment-movement",
      actorUuid: old.translation.actorUuid,
      combatUuid: old.combat.uuid,
      combatantUuid: old.combat.combatantUuid,
      expectedRevision: 2,
      actions: { value: 1, unit: "actions" },
      distance: { value: distance, unit: "meters" },
    },
  });
}
it("runs the existing Running wrapper even within normal distance and preserves failed-check translation", async () => {
  value = runningFixture();
  const completed = await continueRelativeMovement(value);
  expect(f.segmentRoll).toHaveBeenCalledTimes(1);
  expect(f.segmentRoll).toHaveBeenCalledWith(actor, 15, 3, expect.anything());
  expect(completed.action.status).toBe("complete");
  expect(effects).toBe(2);
  expect(completed.action.stages[0]?.receipt).toMatchObject({
    kind: "d6-roll",
    result: { success: false, request: { score: 6, difficulty: 15 } },
  });
  await continueRelativeMovement(structuredClone(completed));
  expect(f.segmentRoll).toHaveBeenCalledTimes(1);
  expect(effects).toBe(2);
  await relativeMovementContent(completed, actor);
  const vm = f.render.mock.calls.at(-1)?.[1] as Record<string, unknown>;
  expect(JSON.stringify(vm.movementAudit)).toContain("normal");
  expect(JSON.stringify(vm.movementOutcome)).toContain("remaining");
  expect(vm.trackedAction).toBe(true);
});
it("repairs a captured Running save without re-entering the wrapper, and keeps cancellation free", async () => {
  value = runningFixture();
  failRecord = true;
  await expect(continueRelativeMovement(value)).rejects.toThrow();
  expect(value.action.stages[0]?.state).toBe("claimed");
  await continueRelativeMovement(value);
  expect(f.segmentRoll).toHaveBeenCalledTimes(1);
  expect(effects).toBe(2);
  value = runningFixture();
  f.segmentRoll.mockResolvedValueOnce(null);
  const pending = await continueRelativeMovement(value);
  expect(pending.action.stages[0]?.state).toBe("pending");
  expect(effects).toBe(2);
});
it("keeps an orphaned claimed Running roll uncertain after reload", async () => {
  value = runningFixture();
  const stage = required(value.action.stages[0]);
  value = {
    ...value,
    action: claimFirstEditionActionStage(value.action, stage.id, "owner", {
      kind: "d6-roll",
      request: {
        contractVersion: 2,
        kind: "attribute",
        label: "Running",
        score: 6,
        resultModifier: 0,
        difficulty: 15,
        heroPointUse: "none",
        rollMode: "selfroll",
        source: {
          actorId: "actor",
          actorName: "Mover",
          attributeId: "agility",
        },
      },
      runtime: {
        profileId: "first-edition",
        successEvaluator: "first-edition-meets",
        wildPolicy: "first-edition",
      },
    }),
  };
  await expect(
    continueRelativeMovement(structuredClone(value)),
  ).rejects.toThrow();
  expect(f.segmentRoll).not.toHaveBeenCalled();
  expect(effects).toBe(0);
});

it("renders the actual Running VM through Design's exact optional audit template", async () => {
  const labels = JSON.parse(readFileSync("lang/en.json", "utf8")) as Record<
    string,
    string
  >;
  Object.assign(game, {
    i18n: {
      localize: (key: string) => labels[key] ?? key,
      format: (key: string, data: Record<string, string | number>) =>
        (labels[key] ?? key).replace(
          /\{([^}]+)\}/g,
          (_match: string, name: string) => String(data[name] ?? ""),
        ),
    },
  });
  const h = Handlebars.create();
  h.registerHelper("localize", (key: string) => labels[key] ?? key);
  const render = h.compile(
    readFileSync(
      process.env.D6_MOVEMENT_TEMPLATE ??
        "templates/actor/character/first-edition-movement-card.hbs",
      "utf8",
    ),
  );
  f.render.mockImplementation((_path: string, vm: unknown) =>
    Promise.resolve(render(vm)),
  );
  value = runningFixture();
  const pending = parseHTML(
    await relativeMovementContent(value, actor),
  ).document;
  expect(pending.querySelector("article")?.textContent).toContain(
    "3\u00a0m requested · 3\u00a0m normal segment",
  );
  expect(pending.querySelector("article")?.textContent).toContain(
    "Maximum 6\u00a0m · Running difficulty 15",
  );
  expect(pending.querySelector("article")?.textContent).not.toContain(
    "Free through",
  );
  expect(
    pending
      .querySelector("[data-d6-movement-root-action]")
      ?.hasAttribute("disabled"),
  ).toBe(true);
  const done = await continueRelativeMovement(value),
    document = parseHTML(await relativeMovementContent(done, actor)).document;
  expect(document.querySelector("article")?.textContent).toContain(
    "Running failed. Remaining normal allowance at resolution: 0\u00a0m.",
  );
  expect(
    document.querySelectorAll("[data-d6-movement-result-id]"),
  ).toHaveLength(1);
});
