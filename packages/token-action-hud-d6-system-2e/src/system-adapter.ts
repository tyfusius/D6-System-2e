import { createActionAdapter } from "./action-adapter";
import { createCommandDispatcher } from "./command-dispatcher";
import { defaultHudLayout } from "./default-layout";
import { tokenActionHudCoreApi, type CoreSystemPort } from "./hud-core-port";
import { registerHudSettings } from "./settings";

type SystemPortConstructor = new () => CoreSystemPort;

export function createSystemAdapter(
  coreModule: unknown,
): SystemPortConstructor {
  const core = tokenActionHudCoreApi(coreModule);
  const Actions = createActionAdapter(coreModule);
  const Commands = createCommandDispatcher(coreModule);
  return class D6SystemAdapter extends core.SystemManager {
    override async init(): Promise<void> {
      await super.init();
      // Core registers this world setting during init and resolves its handler
      // afterward. Repair our old alias before that lookup, with GM authority.
      if (
        game.user?.isGM &&
        game.settings.get("token-action-hud-core", "rollHandler") === "d6e2"
      ) {
        await game.settings.set("token-action-hud-core", "rollHandler", "core");
      }
    }

    getActionHandler(): InstanceType<typeof Actions> {
      return new Actions();
    }

    getAvailableRollHandlers(): Readonly<Record<string, string>> {
      return { core: game.i18n.localize("D6E2_TAH.CoreRollHandler") };
    }

    getRollHandler(): InstanceType<typeof Commands> {
      return new Commands();
    }

    registerDefaults(): ReturnType<typeof defaultHudLayout> {
      return defaultHudLayout();
    }

    override registerSettings(): void {
      registerHudSettings();
    }
  };
}
