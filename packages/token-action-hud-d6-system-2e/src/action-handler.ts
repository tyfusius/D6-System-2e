import {
  formatDieCode,
  isD6System2eApiV2,
  type D6ActorReadModelV1,
} from "@d6-system-2e/core";
import {
  type CoreActionHandler,
  type HudAction,
  isTokenActionHudCoreModule,
} from "./core-contract";
import { HUD_GROUP_IDS } from "./defaults";

type CoreActionHandlerConstructor = new () => CoreActionHandler;

function encoded(delimiter: string, ...parts: readonly string[]): string {
  return parts.join(delimiter);
}

function localized(key: string): string {
  return game.i18n.localize(key);
}

function actorModel(actor: object): D6ActorReadModelV1 {
  const api = game.system.api;
  if (!isD6System2eApiV2(api)) {
    throw new Error("D6 System Second Edition public API v2 is unavailable.");
  }
  return api.read.actor(actor);
}

function byName(
  left: { readonly name?: string; readonly label?: string },
  right: { readonly name?: string; readonly label?: string },
): number {
  return (left.name ?? left.label ?? "").localeCompare(
    right.name ?? right.label ?? "",
  );
}

export function createD6System2eActionHandler(
  coreModuleValue: unknown,
): CoreActionHandlerConstructor {
  if (!isTokenActionHudCoreModule(coreModuleValue)) {
    throw new TypeError(
      "Token Action HUD Core ActionHandler API is unavailable.",
    );
  }
  const BaseActionHandler = coreModuleValue.api.ActionHandler;

  return class D6System2eActionHandler extends BaseActionHandler {
    async buildSystemActions(): Promise<void> {
      const actor = this.actor;
      if (!actor || !this.token) return;

      const model = actorModel(actor);
      await this.buildCombat(actor);
      await this.buildAttributes(model);
      await this.buildSkills(model);
      await this.buildWeapons(model);
      await this.buildFeatures(model);
    }

    private async buildCombat(actor: object): Promise<void> {
      const api = game.system.api;
      if (!isD6System2eApiV2(api)) return;
      const state = api.combat.read(actor);
      const actions: HudAction[] = [
        {
          encodedValue: encoded(this.delimiter, "combat", "summary"),
          id: "combat-summary",
          info1: {
            text: state?.penaltyLabel ?? "—",
          },
          name:
            state?.actionForfeiture?.reason === "wounded"
              ? localized("D6E2_TAH.ActionsForfeited")
              : (state?.currentAction?.label ??
                localized("D6E2_TAH.NoDeclaration")),
        },
      ];
      if (state?.currentAction) {
        actions.push({
          encodedValue: encoded(this.delimiter, "combat", "complete"),
          id: "combat-complete",
          name: localized("D6E2_TAH.CompleteNext"),
        });
      }
      if (state && state.actions.length > 0 && game.user?.isGM === true) {
        actions.push({
          encodedValue: encoded(this.delimiter, "combat", "reset"),
          id: "combat-reset",
          name: localized("D6E2_TAH.ResetDeclaration"),
        });
      }
      await this.addActions(actions, {
        id: HUD_GROUP_IDS.combat,
        type: "system",
      });
    }

    private async buildAttributes(model: D6ActorReadModelV1): Promise<void> {
      const actions = model.attributes
        .filter(({ rollable }) => rollable)
        .map(({ code, id, label }): HudAction => ({
          encodedValue: encoded(this.delimiter, "attribute", id),
          id,
          info1: { text: formatDieCode(code) },
          name: label,
        }));
      await this.addActions(actions, {
        id: HUD_GROUP_IDS.attributes,
        type: "system",
      });
    }

    private async buildSkills(model: D6ActorReadModelV1): Promise<void> {
      const actions = model.skills
        .filter(({ rollable }) => rollable)
        .toSorted(byName)
        .map(({ code, id, label }): HudAction => ({
          encodedValue: encoded(this.delimiter, "skill", id),
          id,
          info1: { text: formatDieCode(code) },
          name: label,
        }));
      await this.addActions(actions, {
        id: HUD_GROUP_IDS.skills,
        type: "system",
      });
    }

    private async buildWeapons(model: D6ActorReadModelV1): Promise<void> {
      const actions = model.items
        .filter(({ equipped }) => equipped)
        .toSorted(byName)
        .flatMap((item) =>
          item.modes.map((mode): HudAction => ({
            encodedValue: encoded(
              this.delimiter,
              mode === "attack" && item.invocation === "thrown-explosive"
                ? "item-explosive"
                : mode === "attack"
                  ? "item-attack"
                  : "item-damage",
              item.id,
            ),
            id: `${item.id}-${mode}`,
            image: item.image,
            ...(mode === "damage"
              ? {
                  info1: {
                    text: formatDieCode(item.damageCode),
                  },
                }
              : {}),
            name:
              mode === "attack"
                ? item.name
                : `${item.name} · ${localized("D6E2_TAH.Damage")}`,
          })),
        );
      await this.addActions(actions, {
        id: HUD_GROUP_IDS.weapons,
        type: "system",
      });
    }

    private async buildFeatures(model: D6ActorReadModelV1): Promise<void> {
      const actions = model.features
        .filter(
          (feature) =>
            ["asset", "trouble"].includes(feature.type) &&
            feature.capabilityState === "active" &&
            feature.sessionUses < feature.sessionMaximum,
        )
        .toSorted(byName)
        .flatMap((feature): readonly HudAction[] => {
          const info1 = {
            text: game.i18n.format("D6E2_TAH.Uses", {
              maximum: feature.sessionMaximum,
              used: feature.sessionUses,
            }),
          };
          if (feature.type === "trouble") {
            return [
              {
                encodedValue: encoded(
                  this.delimiter,
                  "feature-trouble",
                  feature.id,
                ),
                id: feature.id,
                image: feature.image,
                info1,
                name: feature.name,
              },
            ];
          }
          return [
            {
              encodedValue: encoded(
                this.delimiter,
                "feature-hero-point",
                feature.id,
              ),
              id: `${feature.id}-hero-point`,
              image: feature.image,
              info1,
              name: `${feature.name} · ${localized("D6E2_TAH.GainHeroPoint")}`,
            },
            {
              encodedValue: encoded(
                this.delimiter,
                "feature-roll-bonus",
                feature.id,
              ),
              id: `${feature.id}-roll-bonus`,
              image: feature.image,
              info1,
              name: `${feature.name} · ${localized("D6E2_TAH.RollBonus")}`,
            },
          ];
        });
      await this.addActions(actions, {
        id: HUD_GROUP_IDS.features,
        type: "system",
      });
    }
  };
}
