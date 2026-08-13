import { isD6System2eApiV2 } from "@d6-system-2e/core";
import {
  type CoreRollHandler,
  isTokenActionHudCoreModule,
} from "./core-contract";

type CoreRollHandlerConstructor = new () => CoreRollHandler;

function notifyError(error: unknown): void {
  const message =
    error instanceof Error ? game.i18n.localize(error.message) : String(error);
  (
    ui.notifications as unknown as {
      error(message: string): void;
    }
  ).error(message);
}

export function createD6System2eRollHandler(
  coreModuleValue: unknown,
): CoreRollHandlerConstructor {
  if (!isTokenActionHudCoreModule(coreModuleValue)) {
    throw new TypeError(
      "Token Action HUD Core RollHandler API is unavailable.",
    );
  }
  const BaseRollHandler = coreModuleValue.api.RollHandler;

  return class D6System2eRollHandler extends BaseRollHandler {
    override async handleActionClick(
      _event: Event,
      encodedValue: string,
    ): Promise<unknown> {
      const [actionType, actionId, ...extra] = encodedValue.split(
        this.delimiter,
      );
      if (!actionType || !actionId || extra.length > 0) {
        return this.throwInvalidValueErr();
      }
      const api = game.system.api;
      if (!isD6System2eApiV2(api)) {
        notifyError(
          new Error("D6 System Second Edition public API v2 is unavailable."),
        );
        return undefined;
      }

      try {
        switch (actionType) {
          case "attribute":
            await api.roll.attribute(this.actor, actionId);
            return undefined;
          case "skill":
            await api.roll.skill(this.actor, actionId);
            return undefined;
          case "item-attack":
            await api.roll.item(this.actor, actionId, "attack");
            return undefined;
          case "item-damage":
            await api.roll.item(this.actor, actionId, "damage");
            return undefined;
          case "feature-trouble":
          case "feature-hero-point":
          case "feature-roll-bonus": {
            const state = api.features.read(this.actor);
            await api.features.invoke(this.actor, actionId, {
              ...(actionType === "feature-hero-point"
                ? { choice: "hero-point" as const }
                : actionType === "feature-roll-bonus"
                  ? { choice: "roll-bonus" as const }
                  : {}),
              expectedRevision: state.revision,
            });
            return undefined;
          }
          case "combat": {
            if (actionId === "summary") {
              const state = api.combat.read(this.actor);
              const action = state?.currentAction;
              if (!action) {
                if (!api.ui) return this.throwInvalidValueErr();
                api.ui.openActorSheet(this.actor, { tab: "combat" });
                return undefined;
              }
              switch (action.kind) {
                case "attribute":
                  if (!action.sourceId) return this.throwInvalidValueErr();
                  await api.roll.attribute(this.actor, action.sourceId);
                  return undefined;
                case "skill":
                  if (!action.sourceId) return this.throwInvalidValueErr();
                  await api.roll.skill(this.actor, action.sourceId);
                  return undefined;
                case "attack":
                  if (!action.sourceId) return this.throwInvalidValueErr();
                  await api.roll.item(this.actor, action.sourceId, "attack");
                  return undefined;
                case "move":
                case "other":
                  await api.combat.completeNext(this.actor, state.revision);
                  return undefined;
                default:
                  return this.throwInvalidValueErr();
              }
            }
            const state = api.combat.read(this.actor);
            if (!state) return this.throwInvalidValueErr();
            if (actionId === "complete") {
              await api.combat.completeNext(this.actor, state.revision);
              return undefined;
            }
            if (actionId === "reset") {
              await api.combat.reset(this.actor, state.revision);
              return undefined;
            }
            return this.throwInvalidValueErr();
          }
          default:
            return this.throwInvalidValueErr();
        }
      } catch (error) {
        notifyError(error);
        return undefined;
      }
    }
  };
}
