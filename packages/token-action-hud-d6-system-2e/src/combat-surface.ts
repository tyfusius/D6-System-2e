import {
  formatDieCode,
  type D6ActorAttributeReadModelV1,
  type D6ActorReadModelV1,
  type D6ActorSkillReadModelV1,
  type D6CombatantRoundReadModelV1,
} from "@d6-system-2e/core";
import { encodeHudCommand } from "./command-codec";
import type { CoreHudAction } from "./hud-core-port";

export type HudActionScope = "all-rollable" | "combat";
export type D6HudSectionId = "abilities" | "round" | "weapons";

export interface D6HudSection {
  readonly actions: readonly CoreHudAction[];
  readonly id: D6HudSectionId;
}

export interface CombatSurfaceLabels {
  readonly actionsForfeited: string;
  readonly completeNext: string;
  readonly damage: string;
  readonly noDeclaration: string;
  readonly resetDeclaration: string;
}

function compareName(
  left: { readonly label?: string; readonly name?: string },
  right: { readonly label?: string; readonly name?: string },
): number {
  return (left.label ?? left.name ?? "").localeCompare(
    right.label ?? right.name ?? "",
  );
}

function rollAction(
  ability: D6ActorAttributeReadModelV1 | D6ActorSkillReadModelV1,
  kind: "attribute" | "skill",
): CoreHudAction {
  return {
    encodedValue: encodeHudCommand({ id: ability.id, kind }),
    id: `${kind}-${ability.id}`,
    info1: { text: formatDieCode(ability.code) },
    name: ability.label,
  };
}

function combatAbilities(
  actor: D6ActorReadModelV1,
  round: D6CombatantRoundReadModelV1 | null,
  scope: HudActionScope,
): readonly CoreHudAction[] {
  if (scope === "all-rollable") {
    return [
      ...actor.attributes
        .filter(({ rollable }) => rollable)
        .map((ability) => rollAction(ability, "attribute")),
      ...actor.skills
        .filter(({ rollable }) => rollable)
        .toSorted(compareName)
        .map((ability) => rollAction(ability, "skill")),
    ];
  }

  const equipped = actor.items.filter(({ equipped }) => equipped);
  const skillKeys = new Set(
    equipped.map(({ attackSkillKey }) => attackSkillKey).filter(Boolean),
  );
  const attributeIds = new Set(
    equipped.map(({ attackAttributeId }) => attackAttributeId).filter(Boolean),
  );
  const selectedSkills = actor.skills.filter(
    ({ key, rollable }) => rollable && skillKeys.has(key),
  );
  for (const skill of selectedSkills) attributeIds.delete(skill.attributeId);

  const current = round?.currentAction;
  const currentSkillId =
    current?.kind === "skill" ? current.sourceId : undefined;
  const currentAttributeId =
    current?.kind === "attribute" ? current.sourceId : undefined;
  const defenseId = round?.firstEditionActiveDefense?.sourceId;

  const skills = actor.skills.filter(
    ({ id, key, rollable }) =>
      rollable &&
      (skillKeys.has(key) || id === currentSkillId || id === defenseId),
  );
  const attributes = actor.attributes.filter(
    ({ id, rollable }) =>
      rollable &&
      (attributeIds.has(id) || id === currentAttributeId || id === defenseId),
  );

  return [
    ...attributes.map((ability) => rollAction(ability, "attribute")),
    ...skills
      .toSorted(compareName)
      .map((ability) => rollAction(ability, "skill")),
  ];
}

function roundActions(
  round: D6CombatantRoundReadModelV1 | null,
  labels: CombatSurfaceLabels,
  isGm: boolean,
): readonly CoreHudAction[] {
  const action: CoreHudAction = {
    encodedValue: encodeHudCommand({
      id: round?.currentAction ? "run-current" : "open",
      kind: "round",
    }),
    id: "round-current",
    info1: { text: round?.penaltyLabel ?? "—" },
    name:
      round?.actionForfeiture?.reason === "wounded"
        ? labels.actionsForfeited
        : (round?.currentAction?.label ?? labels.noDeclaration),
  };
  const controls: CoreHudAction[] = [action];
  if (round?.currentAction) {
    controls.push({
      encodedValue: encodeHudCommand({ id: "complete", kind: "round" }),
      id: "round-complete",
      name: labels.completeNext,
    });
  }
  if (isGm && round && round.actions.length > 0) {
    controls.push({
      encodedValue: encodeHudCommand({ id: "reset", kind: "round" }),
      id: "round-reset",
      name: labels.resetDeclaration,
    });
  }
  return controls;
}

function weaponActions(
  actor: D6ActorReadModelV1,
  labels: CombatSurfaceLabels,
): readonly CoreHudAction[] {
  return actor.items
    .filter(({ equipped }) => equipped)
    .toSorted(compareName)
    .flatMap((item) =>
      item.modes.map((mode): CoreHudAction =>
        mode === "attack"
          ? {
              encodedValue: encodeHudCommand({
                id: item.id,
                kind:
                  item.invocation === "thrown-explosive"
                    ? "explosive"
                    : "weapon-attack",
              }),
              id: `weapon-${item.id}-attack`,
              image: item.image,
              name: item.name,
            }
          : {
              encodedValue: encodeHudCommand({
                id: item.id,
                kind: "weapon-damage",
              }),
              id: `weapon-${item.id}-damage`,
              image: item.image,
              info1: { text: formatDieCode(item.damageCode) },
              name: `${item.name} · ${labels.damage}`,
            },
      ),
    );
}

export function buildCombatSurface(
  actor: D6ActorReadModelV1,
  round: D6CombatantRoundReadModelV1 | null,
  scope: HudActionScope,
  labels: CombatSurfaceLabels,
  isGm: boolean,
): readonly D6HudSection[] {
  return Object.freeze([
    Object.freeze({ id: "round", actions: roundActions(round, labels, isGm) }),
    Object.freeze({ id: "weapons", actions: weaponActions(actor, labels) }),
    Object.freeze({
      id: "abilities",
      actions: combatAbilities(actor, round, scope),
    }),
  ]);
}
