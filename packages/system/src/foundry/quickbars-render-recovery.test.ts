import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { parseHTML } from "linkedom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./roll-requests", () => ({
  activeNonGmOwners: vi.fn(),
  activeRollRequests: vi.fn(),
  executeHighlightedRollRequest: vi.fn(),
  registerRollRequestSocket: vi.fn(),
  requestActorRoll: vi.fn(),
  subscribeActiveRollRequests: vi.fn(),
  subscribeHighlightedRollRequests: vi.fn(),
}));
vi.mock("./combined-actions", () => ({
  combinedActionsEnabled: vi.fn(),
  registerCombinedActionSocket: vi.fn(),
  registerCombinedActionLifecycle: vi.fn(),
  startCombinedAction: vi.fn(),
}));
vi.mock("./scene-control-application-buttons", () => ({
  registerSceneControlApplicationButton: vi.fn(),
}));
vi.mock("../settings/setting-values", () => ({ booleanSetting: () => true }));

const handlebars = Handlebars.create();
handlebars.registerHelper("localize", (key: string) => key);
const template = handlebars.compile(
  readFileSync(
    new URL(
      "../../../../templates/apps/active-tasks-quickbar.hbs",
      import.meta.url,
    ),
    "utf8",
  ),
);
function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}
/** The cached 14.367 runtime queues render calls, but rendered is false in
 * RENDERING. Hold HTML replacement to reproduce the native lost notification. */
class RuntimeApplication {
  static RENDER_STATES = {
    RENDERING: 1,
    RENDERED: 2,
    NONE: 0,
    CLOSED: -1,
    CLOSING: -2,
    ERROR: -3,
  };
  static instances: RuntimeApplication[] = [];
  static DEFAULT_OPTIONS = {};
  static PARTS = {};
  state = 0;
  readonly element = document.createElement("div");
  tail = Promise.resolve();
  gate: ReturnType<typeof deferred> | undefined;
  renderCalls = 0;
  constructor() {
    RuntimeApplication.instances.push(this);
  }
  get rendered() {
    return this.state === 2;
  }
  _prepareContext(): Promise<Record<string, unknown>> {
    return Promise.resolve({});
  }
  _onRender(
    _context: Record<string, unknown>,
    _options: { parts: readonly string[] },
  ): Promise<void> {
    void _context;
    void _options;
    return Promise.resolve();
  }
  render(options: { force?: boolean } = {}): Promise<void> {
    this.renderCalls += 1;
    this.tail = this.tail.then(async () => {
      if (this.state <= 0 && !options.force) return;
      this.state = 1;
      const context = await this._prepareContext();
      const gate = this.gate;
      this.gate = undefined;
      if (gate) await gate.promise;
      this.element.innerHTML = template(context);
      this.state = 2;
      await this._onRender(context, { parts: ["content"] });
    });
    return this.tail;
  }
  close(): Promise<void> {
    this.state = -1;
    return Promise.resolve();
  }
}
beforeEach(() => {
  vi.resetModules();
  RuntimeApplication.instances = [];
  const { document, window } = parseHTML("<html><body></body></html>");
  vi.stubGlobal("document", document);
  vi.stubGlobal("HTMLElement", window.HTMLElement);
  vi.stubGlobal("foundry", {
    applications: {
      api: {
        ApplicationV2: RuntimeApplication,
        HandlebarsApplicationMixin: (base: typeof RuntimeApplication) => base,
      },
    },
  });
  vi.stubGlobal("game", {
    user: { id: "owner", isGM: false },
    users: { get: () => ({ active: true }) },
    i18n: { localize: (key: string) => key },
  });
  vi.stubGlobal("ui", {
    controls: { render: vi.fn() },
    notifications: { warn: vi.fn() },
  });
  vi.stubGlobal("Hooks", { on: vi.fn(), once: vi.fn() });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function fixture(reopen: () => Promise<"dismissed" | "resolved">) {
  const pending = await import("../application/pending-interactions");
  const quickbars = await import("./quickbars");
  pending.registerD6PendingInteraction({
    id: "request",
    label: "Weapon Attack",
    controllerUserId: "owner",
    createdAt: 1,
    kind: "requested-roll",
    reopen,
  });
  quickbars.registerD6System2eQuickbars();
  quickbars.toggleActiveTasksQuickbar();
  const application = RuntimeApplication.instances[0];
  if (!application) throw new Error("Missing Active Tasks application");
  await application.tail;
  return { application, pending, quickbars };
}
describe("Active Tasks terminal render recovery", () => {
  it("renders a fast failure after the in-flight opening render, enabling Reopen again", async () => {
    const operation = vi.fn<() => Promise<"dismissed" | "resolved">>(() =>
      Promise.reject(new Error("TargetUnavailable")),
    );
    const { application, pending } = await fixture(operation);
    const gate = deferred();
    application.gate = gate;
    await pending.reopenD6PendingInteraction("request");
    expect(application.state).toBe(1);
    expect(pending.activeD6PendingInteractions("owner")[0]?.status).toBe(
      "failed",
    );
    gate.resolve();
    await application.tail;
    const button = application.element.querySelector(
      '[data-action="reopenTask"]',
    );
    expect(application.element.textContent).toContain("D6E2.Tasks.Failed");
    expect(button?.hasAttribute("disabled")).toBe(false);
    expect(button?.getAttribute("aria-busy")).toBeNull();
    // A repaired target can reopen through the same still-visible window.
    operation.mockResolvedValueOnce("dismissed");
    await pending.reopenD6PendingInteraction("request");
    await application.tail;
    expect(operation).toHaveBeenCalledTimes(2);
    expect(pending.activeD6PendingInteractions("owner")[0]?.status).toBe(
      "pending",
    );
    expect(
      application.element
        .querySelector('[data-action="reopenTask"]')
        ?.hasAttribute("disabled"),
    ).toBe(false);
  });
  it("queues the dismissed state and does not open a manually closed window", async () => {
    const { application, pending, quickbars } = await fixture(() =>
      Promise.resolve("dismissed"),
    );
    const gate = deferred();
    application.gate = gate;
    await pending.reopenD6PendingInteraction("request");
    gate.resolve();
    await application.tail;
    expect(
      application.element
        .querySelector('[data-action="reopenTask"]')
        ?.hasAttribute("disabled"),
    ).toBe(false);
    await application.close();
    const calls = application.renderCalls;
    await pending.reopenD6PendingInteraction("request");
    quickbars.synchronizeQuickbarAvailability();
    expect(application.renderCalls).toBe(calls);
    expect(application.state).toBe(-1);
  });
});

it("ignores unrelated document edits and coalesces relevant changes without reopening a closed quickbar", async () => {
  const { application } = await fixture(() => Promise.resolve("dismissed"));
  // Hook registration is a spy; the test reads calls without invoking an unbound method.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const hooks = vi.mocked(Hooks.on).mock.calls;
  const actorHook = hooks.find(([name]) => name === "updateActor")?.[1];
  const itemHook = hooks.find(([name]) => name === "updateItem")?.[1];
  if (!actorHook || !itemHook) throw new Error("Missing hooks");
  const before = application.renderCalls;
  actorHook({}, { "system.health.condition": "wounded" });
  itemHook({ type: "weapon" }, { "system.ammo.value": 24 });
  await Promise.resolve();
  expect(application.renderCalls).toBe(before);
  actorHook({}, { name: "Renamed" });
  itemHook({ type: "skill" }, { "system.score": 12 });
  itemHook({ type: "skill" }, { "system.score": 15 });
  await Promise.resolve();
  await application.tail;
  expect(application.renderCalls).toBe(before + 1);
  actorHook({}, { ownership: { player: 0 } });
  await application.close();
  await Promise.resolve();
  expect(application.renderCalls).toBe(before + 1);
});
