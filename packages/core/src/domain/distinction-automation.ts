import {
  D6_DISTINCTION_AUTOMATION_VERSION,
  type D6DistinctionMechanicDisposition,
  type D6DistinctionRollChoiceV1,
  type D6DistinctionRollEffectV1,
  type D6DistinctionRollEvaluationV1,
  type D6DistinctionRollScopeV1,
  type D6DistinctionSourceV1,
} from "../contracts/distinction-automation";
import type { D6FeatureMechanicV1 } from "../contracts/feature-catalogs";

export function classifyDistinctionMechanic(
  mechanic: D6FeatureMechanicV1,
): D6DistinctionMechanicDisposition {
  if (mechanic.kind === "narrative") return "narrative-only";
  if (
    mechanic.kind === "roll-modifier" &&
    mechanic.automatic === true &&
    mechanic.application !== undefined &&
    Number.isSafeInteger(mechanic.score)
  ) {
    return "automatic";
  }
  if (
    mechanic.kind === "roll-modifier" ||
    mechanic.kind === "action-modifier" ||
    mechanic.kind === "movement-modifier" ||
    mechanic.kind === "reroll" ||
    mechanic.kind === "resource" ||
    mechanic.kind === "trained-use" ||
    mechanic.kind === "usage-limit"
  ) {
    return "declaration";
  }
  return "stored-only";
}

function selectorMatches(
  selector: string | undefined,
  scope: D6DistinctionRollScopeV1,
): boolean {
  if (!selector) return true;
  return selector === scope.itemId || selector === scope.attributeId;
}

/**
 * Resolves current native Item snapshots on demand. It never edits an Actor or
 * persists derived scores, so grant/remove/regrant and reload are idempotent.
 */
export function resolveDistinctionRollEffects(
  sources: readonly D6DistinctionSourceV1[],
  scope: D6DistinctionRollScopeV1,
): D6DistinctionRollEvaluationV1 {
  const choices: D6DistinctionRollChoiceV1[] = [];
  const effects: D6DistinctionRollEffectV1[] = [];
  const inert: D6DistinctionRollEvaluationV1["inert"][number][] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    source.mechanics.forEach((mechanic, index) => {
      const effectId = `${source.definitionId}:${source.itemId}:${index}`;
      const identity = `${source.itemId}:${effectId}`;
      if (seen.has(identity)) return;
      seen.add(identity);
      const disposition = classifyDistinctionMechanic(mechanic);
      const application = mechanic.application;
      const contextualChoice =
        disposition === "declaration" &&
        mechanic.kind === "roll-modifier" &&
        mechanic.automatic !== true &&
        application !== undefined &&
        Number.isSafeInteger(mechanic.score) &&
        scope.applications.includes(application) &&
        selectorMatches(mechanic.selector, scope);
      if (contextualChoice) {
        const score =
          (mechanic.score ?? 0) * (mechanic.perRank ? source.rank : 1);
        if (Number.isSafeInteger(score) && score !== 0) {
          choices.push(
            Object.freeze({
              application,
              definitionId: source.definitionId,
              effectId,
              itemId: source.itemId,
              label: source.label,
              private: source.private,
              score,
            }),
          );
          return;
        }
      }
      if (disposition !== "automatic") {
        inert.push(
          Object.freeze({
            definitionId: source.definitionId,
            disposition,
            effectId,
            itemId: source.itemId,
            kind: mechanic.kind,
          }),
        );
        return;
      }
      if (application === undefined) return;
      if (
        !scope.applications.includes(application) ||
        !selectorMatches(mechanic.selector, scope)
      ) {
        return;
      }
      const score =
        (mechanic.score ?? 0) * (mechanic.perRank ? source.rank : 1);
      if (!Number.isSafeInteger(score) || score === 0) return;
      effects.push(
        Object.freeze({
          application,
          definitionId: source.definitionId,
          effectId,
          itemId: source.itemId,
          label: source.label,
          mode: "automatic",
          private: source.private,
          score,
        }),
      );
    });
  }

  return Object.freeze({
    choices: Object.freeze(choices),
    effects: Object.freeze(effects),
    inert: Object.freeze(inert),
    totalScore: effects.reduce((total, effect) => total + effect.score, 0),
    version: D6_DISTINCTION_AUTOMATION_VERSION,
  });
}

/** Applies only choices presented by the same immutable evaluation snapshot. */
export function applyDistinctionRollChoices(
  evaluation: D6DistinctionRollEvaluationV1,
  selectedEffectIds: readonly string[],
): D6DistinctionRollEvaluationV1 {
  const selected = new Set(selectedEffectIds);
  const chosen = evaluation.choices
    .filter((choice) => selected.has(choice.effectId))
    .map((choice) => Object.freeze({ ...choice, mode: "chosen" as const }));
  const effects = Object.freeze([...evaluation.effects, ...chosen]);
  return Object.freeze({
    ...evaluation,
    effects,
    totalScore: effects.reduce((total, effect) => total + effect.score, 0),
  });
}
