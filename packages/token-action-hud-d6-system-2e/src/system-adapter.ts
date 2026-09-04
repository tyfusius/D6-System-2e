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
    getActionHandler(): InstanceType<typeof Actions> {
      return new Actions();
    }

    getAvailableRollHandlers(): Readonly<Record<string, string>> {
      return { d6e2: game.i18n.localize("D6E2_TAH.CoreRollHandler") };
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
