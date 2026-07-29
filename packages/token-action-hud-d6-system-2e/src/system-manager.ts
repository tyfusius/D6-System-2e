import type { CoreSystemManager } from "./core-contract";
import { isTokenActionHudCoreModule } from "./core-contract";
import { createD6System2eActionHandler } from "./action-handler";
import { createD6System2eDefaults } from "./defaults";
import { createD6System2eRollHandler } from "./roll-handler";

type CoreSystemManagerConstructor = new () => CoreSystemManager;

export function createD6System2eSystemManager(
  coreModuleValue: unknown,
): CoreSystemManagerConstructor {
  if (!isTokenActionHudCoreModule(coreModuleValue)) {
    throw new TypeError(
      "Token Action HUD Core SystemManager API is unavailable.",
    );
  }
  const ActionHandler = createD6System2eActionHandler(coreModuleValue);
  const RollHandler = createD6System2eRollHandler(coreModuleValue);
  const BaseSystemManager = coreModuleValue.api.SystemManager;

  return class D6System2eSystemManager extends BaseSystemManager {
    getActionHandler(): InstanceType<typeof ActionHandler> {
      return new ActionHandler();
    }

    getAvailableRollHandlers(): Readonly<Record<string, string>> {
      return {
        core: game.i18n.localize("D6E2_TAH.CoreRollHandler"),
      };
    }

    getRollHandler(): InstanceType<typeof RollHandler> {
      return new RollHandler();
    }

    registerDefaults(): ReturnType<typeof createD6System2eDefaults> {
      return createD6System2eDefaults();
    }

    override registerSettings(
      coreUpdate: (...args: unknown[]) => unknown,
    ): void {
      void coreUpdate;
    }
  };
}
