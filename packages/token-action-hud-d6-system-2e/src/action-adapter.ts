import { isD6System2eApiV2 } from "@d6-system-2e/core";
import { buildCombatSurface, type CombatSurfaceLabels } from "./combat-surface";
import { SECTION_IDS } from "./default-layout";
import { tokenActionHudCoreApi, type CoreActionPort } from "./hud-core-port";
import { actionScope } from "./settings";

type ActionPortConstructor = new () => CoreActionPort;

function labels(): CombatSurfaceLabels {
  return {
    actionsForfeited: game.i18n.localize("D6E2_TAH.ActionsForfeited"),
    completeNext: game.i18n.localize("D6E2_TAH.CompleteNext"),
    damage: game.i18n.localize("D6E2_TAH.Damage"),
    noDeclaration: game.i18n.localize("D6E2_TAH.NoDeclaration"),
    resetDeclaration: game.i18n.localize("D6E2_TAH.ResetDeclaration"),
  };
}

export function createActionAdapter(
  coreModule: unknown,
): ActionPortConstructor {
  const Base = tokenActionHudCoreApi(coreModule).ActionHandler;
  return class D6ActionAdapter extends Base {
    async buildSystemActions(): Promise<void> {
      if (!this.actor || !this.token) return;
      const api = game.system.api;
      if (!isD6System2eApiV2(api)) {
        throw new Error(
          "D6 System Second Edition public API v2 is unavailable.",
        );
      }
      const surface = buildCombatSurface(
        api.read.actor(this.actor),
        api.combat.read(this.actor),
        actionScope(),
        labels(),
        game.user?.isGM === true,
      );
      for (const section of surface) {
        if (section.actions.length === 0) continue;
        await this.addActions(section.actions, {
          id: SECTION_IDS[section.id],
          type: "system",
        });
      }
    }
  };
}
