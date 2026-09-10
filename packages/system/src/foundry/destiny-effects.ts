import { requireDestinyValue } from "@d6-system-2e/core";
import {
  destinyDifficultyShift,
  type D6DestinyEffectV1,
  type D6RollRequestV1,
} from "@d6-system-2e/core";
import { currentConfiguredRulesProfile } from "../settings/rules-profile-library";
import { SYSTEM_ID } from "../constants";
import {
  destinyEnabled,
  destinyPrimaryGM,
  destinyPublicState,
  refreshDestinyView,
  requestDestiny,
} from "./destiny-service";
import { foundryRandomId } from "./foundry-random-id";
import { record } from "./sheets/values";

const text = (key: string) => game.i18n.localize(`D6E2.Destiny.${key}`);
function escape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
}

/** Keeps one effect open while its owning workflow is paused before commitment. */
export async function offerDestinyEffect(
  effect: Omit<D6DestinyEffectV1, "status" | "spendId" | "after">,
  required = false,
): Promise<D6DestinyEffectV1> {
  let state = await refreshDestinyView();
  let current = Object.values(state.effects).find((e) => e.key === effect.key);
  if (current) {
    if (
      current.before !== effect.before ||
      current.kind !== effect.kind ||
      current.actorId !== effect.actorId
    )
      throw new Error("D6E2.Destiny.Error.EffectIdentity");
    if (current.spendId) return current;
    if (current.status !== "open")
      throw new Error("D6E2.Destiny.Error.EffectClosed");
  } else {
    state = await requestDestiny({ kind: "open-effect", effect });
    current = state.effects[effect.id];
  }
  if (!current) throw new Error("D6E2.Destiny.Error.EffectMissing");
  const id = current.id;
  const side = game.user?.isGM ? "dark" : "light";
  const available =
    state.coins.some((c) => c.face === side && !c.reservationId) &&
    (current.side === "either" || current.side === side);
  const buttons = [
    {
      action: "cancel",
      label: text(required ? "CancelActivation" : "ContinueWithoutSpend"),
      callback: () => "continue",
    },
    ...(available
      ? [
          {
            action: "spend",
            label: text("CommitSpend"),
            callback: () => "spend",
          },
        ]
      : []),
  ];
  const choice = await foundry.applications.api.DialogV2.wait<string | null>({
    buttons,
    classes: ["d6e2", "od6roll-dialog"],
    modal: true,
    rejectClose: false,
    window: { title: text("EffectWindow") },
    content: `<p>${escape(current.label)}</p><p>${escape(text(required ? "TalentActivationHelp" : "EffectWindowHelp"))}</p><p>${escape(text(side === "light" ? "LightSpend" : "DarkSpend"))}</p>`,
  });
  state = await refreshDestinyView();
  current = state.effects[id];
  if (!current) throw new Error("D6E2.Destiny.Error.EffectMissing");
  if (choice === "spend" && !current.spendId) {
    const coin = state.coins.find((c) => c.face === side && !c.reservationId);
    if (!coin) throw new Error("D6E2.Destiny.Error.CoinUnavailable");
    state = await requestDestiny({
      kind: "spend",
      effectId: id,
      coinId: coin.id,
    });
    current = requireDestinyValue(state.effects[id]);
  }
  if (current.status === "open") {
    state = await requestDestiny({ kind: "close-effect", effectId: id });
    current = requireDestinyValue(state.effects[id]);
  }
  if (required && !current.spendId)
    throw new Error("D6E2.Destiny.Error.TalentCancelled");
  return current;
}

export async function prepareDestinyRoll(
  actor: FoundryActorDocument,
  request: D6RollRequestV1,
): Promise<D6RollRequestV1> {
  const costs = [
    ...new Set(
      (request.context?.distinctionEffects?.effects ?? []).map((e) => e.itemId),
    ),
  ].filter((id) => {
    const item = actor.items.get(id);
    const cost = record(item?.getFlag?.(SYSTEM_ID, "destinyCost"));
    return (
      item?.type === "talent" &&
      cost.version === 1 &&
      cost.enabled === true &&
      cost.cost === 1
    );
  });
  if (costs.length > 1)
    throw new Error("D6E2.Destiny.Error.MultipleTalentCosts");
  if (
    !destinyEnabled() ||
    destinyPublicState().status !== "active" ||
    !destinyPrimaryGM()
  ) {
    if (costs.length) throw new Error("D6E2.Destiny.Error.TalentUnavailable");
    return request;
  }
  const power = request.context?.extraordinaryPower;
  const activation = power?.activationId ?? foundryRandomId();
  const key = power?.activationId
    ? `roll:${activation}:${power.checkIndex}`
    : `roll:${activation}`;
  const evidence: D6DestinyEffectV1[] = [];
  for (const id of costs)
    evidence.push(
      await offerDestinyEffect(
        {
          id: foundryRandomId(),
          key: `talent:${activation}:${id}`,
          kind: "talent",
          actorId: actor.id,
          userId: requireDestinyValue(game.user).id,
          label: requireDestinyValue(actor.items.get(id)).name,
          side: game.user?.isGM ? "dark" : "light",
          before: 1,
          ladder: [],
        },
        true,
      ),
    );
  let difficulty = request.difficulty;
  const ladder = currentConfiguredRulesProfile().difficultyLadder.map(
    (e) => e.value,
  );
  const playerTask = (game.users?.contents ?? []).some(
    (u) => !u.isGM && actor.testUserPermission(u, "OWNER"),
  );
  const lightDirection = playerTask ? "lower" : "raise";
  if (difficulty !== undefined && ladder.includes(difficulty)) {
    const side = game.user?.isGM ? "dark" : "light";
    let eligible = true;
    try {
      destinyDifficultyShift(difficulty, ladder, side, lightDirection);
    } catch {
      eligible = false;
    }
    if (eligible) {
      const effect = await offerDestinyEffect({
        id: foundryRandomId(),
        key,
        kind: "difficulty",
        actorId: actor.id,
        userId: requireDestinyValue(game.user).id,
        label: request.label,
        side: "either",
        before: difficulty,
        ladder,
        lightDirection,
        ...(game.user?.isGM && request.rollMode === "publicroll"
          ? { public: true }
          : {}),
      });
      if (effect.spendId) {
        difficulty = effect.after;
        evidence.push(effect);
      }
    }
  }
  if (!evidence.length) return request;
  return {
    ...request,
    ...(difficulty === undefined ? {} : { difficulty }),
    context: {
      ...request.context,
      destiny: {
        version: 1,
        effects: evidence.map((e) => ({
          id: e.id,
          kind: e.kind,
          before: e.before,
          after: e.after,
          spendId: requireDestinyValue(e.spendId),
        })),
      },
    },
  };
}
