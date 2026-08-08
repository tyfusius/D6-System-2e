import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  preloadTokenActionHudCoreTemplates,
  TOKEN_ACTION_HUD_CORE_TEMPLATES,
} from "./core-template-readiness";

describe("Token Action HUD Core template readiness", () => {
  it("preloads every v2.1 partial before the system-ready hook continues", async () => {
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const loadTemplates = vi.fn(() => pending);
    let complete = false;

    const preload = preloadTokenActionHudCoreTemplates({ loadTemplates }).then(
      (result) => {
        complete = true;
        return result;
      },
    );

    expect(loadTemplates).toHaveBeenCalledWith(TOKEN_ACTION_HUD_CORE_TEMPLATES);
    expect(TOKEN_ACTION_HUD_CORE_TEMPLATES).toContain(
      "modules/token-action-hud-core/templates/list-subgroup.hbs",
    );
    expect(complete).toBe(false);

    release?.();
    await expect(preload).resolves.toBe(true);
    expect(complete).toBe(true);
  });

  it("declines an unavailable loader without throwing", async () => {
    await expect(preloadTokenActionHudCoreTemplates(null)).resolves.toBe(false);
  });

  it("awaits template readiness before announcing the system adapter", () => {
    const main = readFileSync(
      resolve(
        process.cwd(),
        "packages/token-action-hud-d6-system-2e/src/main.ts",
      ),
      "utf8",
    );

    expect(
      main.indexOf("await preloadTokenActionHudCoreTemplates"),
    ).toBeLessThan(main.indexOf('call("tokenActionHudSystemReady"'));
  });
});
