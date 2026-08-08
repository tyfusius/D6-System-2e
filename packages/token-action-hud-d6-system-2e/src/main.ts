import { isD6System2eApiV2 } from "@d6-system-2e/core";
import { preloadTokenActionHudCoreTemplates } from "./core-template-readiness";
import { createD6System2eSystemManager } from "./system-manager";

const MODULE_ID = "token-action-hud-d6-system-2e";
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
  call(hook: string, ...args: readonly unknown[]): unknown;
  once(
    hook: string,
    callback: (...args: readonly unknown[]) => unknown,
  ): number;
}

function coreTemplateLoader(): unknown {
  return (
    globalThis as unknown as {
      readonly foundry?: {
        readonly applications?: { readonly handlebars?: unknown };
      };
    }
  ).foundry?.applications?.handlebars;
}

async function install(coreModule: unknown): Promise<boolean> {
  if (!isD6System2eApiV2(game.system.api)) return false;
  const module = (game as unknown as RuntimeGame).modules?.get(MODULE_ID);
  if (!module) {
    console.error(
      "Token Action HUD D6 System Second Edition | Module document unavailable",
    );
    return true;
  }

  await preloadTokenActionHudCoreTemplates(coreTemplateLoader());

  module.api = {
    requiredCoreModuleVersion: REQUIRED_CORE_MODULE_VERSION,
    SystemManager: createD6System2eSystemManager(coreModule),
  };
  (Hooks as unknown as RuntimeHooks).call("tokenActionHudSystemReady", module);
  console.info(
    "Token Action HUD D6 System Second Edition | Public API v2 verified",
  );
  return true;
}

(Hooks as unknown as RuntimeHooks).once(
  "tokenActionHudCoreApiReady",
  async (coreModule: unknown) => {
    if (await install(coreModule)) return;
    (Hooks as unknown as RuntimeHooks).once("ready", async () => {
      if (!(await install(coreModule))) {
        console.error(
          "Token Action HUD D6 System Second Edition | Public API v2 unavailable",
        );
      }
    });
  },
);
