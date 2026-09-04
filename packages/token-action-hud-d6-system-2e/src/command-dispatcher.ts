import { isD6System2eApiV2 } from "@d6-system-2e/core";
import { decodeHudCommand } from "./command-codec";
import { tokenActionHudCoreApi, type CoreRollPort } from "./hud-core-port";

type RollPortConstructor = new () => CoreRollPort;

function report(error: unknown): void {
  const message =
    error instanceof Error ? game.i18n.localize(error.message) : String(error);
  ui.notifications.error(message);
}

export function createCommandDispatcher(
  coreModule: unknown,
): RollPortConstructor {
  const Base = tokenActionHudCoreApi(coreModule).RollHandler;
  return class D6CommandDispatcher extends Base {
    override async handleActionClick(
      _event: Event,
      encodedValue: string,
    ): Promise<unknown> {
      const command = decodeHudCommand(encodedValue);
      if (!command) return this.throwInvalidValueErr();
      const api = game.system.api;
      if (!isD6System2eApiV2(api)) {
        report(
          new Error("D6 System Second Edition public API v2 is unavailable."),
        );
        return undefined;
      }
      try {
        if (command.kind === "attribute") {
          await api.roll.attribute(this.actor, command.id);
        } else if (command.kind === "skill") {
          await api.roll.skill(this.actor, command.id);
        } else if (command.kind === "weapon-attack") {
          await api.roll.item(this.actor, command.id, "attack");
        } else if (command.kind === "weapon-damage") {
          await api.roll.item(this.actor, command.id, "damage");
        } else if (command.kind === "explosive") {
          await api.explosives.begin(this.actor, command.id);
        } else {
          await dispatchRoundCommand(api, this.actor, command.id, () =>
            this.throwInvalidValueErr(),
          );
        }
      } catch (error) {
        report(error);
      }
      return undefined;
    }
  };
}

async function dispatchRoundCommand(
  api: NonNullable<typeof game.system.api>,
  actor: object,
  command: "complete" | "open" | "reset" | "run-current",
  invalid: () => unknown,
): Promise<void> {
  const round = api.combat.read(actor);
  if (command === "open") {
    if (!api.ui) invalid();
    else api.ui.openActorSheet(actor, { tab: "combat" });
    return;
  }
  if (!round) {
    invalid();
    return;
  }
  if (command === "complete") {
    await api.combat.completeNext(actor, round.revision);
    return;
  }
  if (command === "reset") {
    await api.combat.reset(actor, round.revision);
    return;
  }
  const current = round.currentAction;
  if (!current) {
    invalid();
    return;
  }
  if (current.kind === "attribute" && current.sourceId) {
    await api.roll.attribute(actor, current.sourceId);
  } else if (current.kind === "skill" && current.sourceId) {
    await api.roll.skill(actor, current.sourceId);
  } else if (current.kind === "attack" && current.sourceId) {
    await api.roll.item(actor, current.sourceId, "attack");
  } else if (current.kind === "move" || current.kind === "other") {
    await api.combat.completeNext(actor, round.revision);
  } else {
    invalid();
  }
}
