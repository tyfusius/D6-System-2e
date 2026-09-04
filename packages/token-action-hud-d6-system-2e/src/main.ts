import { isD6System2eApiV2 } from "@d6-system-2e/core";
import { createSystemAdapter } from "./system-adapter";
import { installTokenAnchor } from "./token-anchor";
import { migrateLegacyHudLayout } from "./layout-migration";
import { MODULE_ID } from "./settings";

const REQUIRED_CORE_MODULE_VERSION = "2.1";

interface RuntimeModule {
  api?: unknown;
}

interface RuntimeGame {
  readonly modules?: {
    get(id: string): RuntimeModule | undefined;
  };
}

interface RuntimeHooks {
  callAll?(hook: string, ...args: unknown[]): boolean;
  once(
    hook: string,
    callback: (...args: readonly unknown[]) => unknown,
  ): number;
}

function install(coreModule: unknown): boolean {
  if (!isD6System2eApiV2(game.system.api)) return false;
  const module = (game as unknown as RuntimeGame).modules?.get(MODULE_ID);
  if (!module) {
    console.error(
      "Token Action HUD D6 System Second Edition | Module document unavailable",
    );
    return true;
  }

  module.api = {
    requiredCoreModuleVersion: REQUIRED_CORE_MODULE_VERSION,
    SystemManager: createSystemAdapter(coreModule),
  };
  (Hooks as unknown as RuntimeHooks).callAll?.(
    "tokenActionHudSystemReady",
    module,
  );
  (Hooks as unknown as RuntimeHooks).once("tokenActionHudReady", async () => {
    await migrateLegacyHudLayout();
    installTokenAnchor();
  });
  console.info(
    "Token Action HUD D6 System Second Edition | Combat HUD adapter ready",
  );
  return true;
}

(Hooks as unknown as RuntimeHooks).once(
  "tokenActionHudCoreApiReady",
  (coreModule: unknown) => {
    if (install(coreModule)) return;
    (Hooks as unknown as RuntimeHooks).once("ready", () => {
      if (!install(coreModule)) {
        console.error(
          "Token Action HUD D6 System Second Edition | Public API v2 unavailable",
        );
      }
    });
  },
);
