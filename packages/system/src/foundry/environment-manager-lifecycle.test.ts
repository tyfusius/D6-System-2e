import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ enabled: true }));
vi.mock("./environment-service", () => ({
  d6EnvironmentsEnabled: () => state.enabled,
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("does not rebuild scene controls or a closed environment manager for Actor updates", async () => {
  vi.resetModules();
  state.enabled = true;
  const render = vi.fn();
  const controls = vi.fn();
  class Application {
    rendered = false;
    render() {
      this.rendered = true;
      render();
    }
    close() {
      this.rendered = false;
    }
  }
  vi.stubGlobal("foundry", {
    applications: {
      api: {
        ApplicationV2: Application,
        HandlebarsApplicationMixin: (base: typeof Application) => base,
      },
    },
  });
  const hooks = new Map<string, (...args: unknown[]) => void>();
  vi.stubGlobal("Hooks", {
    on: (name: string, fn: (...args: unknown[]) => void) => hooks.set(name, fn),
  });
  vi.stubGlobal("ui", { controls: { render: controls } });
  const { registerD6EnvironmentManager, toggleD6EnvironmentManager } =
    await import("./environment-manager");
  registerD6EnvironmentManager();
  const update = (changes: unknown) => hooks.get("updateActor")?.({}, changes);
  update({ "system.environment.active": true });
  expect(render).not.toHaveBeenCalled();
  expect(controls).not.toHaveBeenCalled();
  toggleD6EnvironmentManager();
  render.mockClear();
  update({ "system.health.condition": "wounded" });
  expect(render).not.toHaveBeenCalled();
  update({ system: { environment: { active: true } } });
  expect(render).toHaveBeenCalledTimes(1);
  update({ "system.attributes.brawn.score": 9 });
  expect(render).toHaveBeenCalledTimes(2);
  expect(controls).not.toHaveBeenCalled();
  state.enabled = false;
  hooks.get("d6e2EnvironmentChanged")?.();
  update({ name: "Changed" });
  expect(render).toHaveBeenCalledTimes(2);
  expect(controls).toHaveBeenCalledTimes(1);
});
