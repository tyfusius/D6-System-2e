import { resolveD6Roll } from "@d6-system-2e/core";
import type {
  FirstEditionActionRoot,
  FirstEditionActionStage,
  FirstEditionClaimInput,
  FirstEditionEffectPlan,
  FirstEditionSerializedRoll,
  FirstEditionStageReceipt,
} from "./first-edition-action-contract";

export const object = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
export const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 512;
export const integer = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
export const keys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean => Object.keys(value).every((key) => allowed.includes(key));
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    const record = object(item);
    return record
      ? Object.fromEntries(
          Object.entries(record).sort(([a], [b]) => a.localeCompare(b)),
        )
      : item;
  });
}
export function quantity(
  value: unknown,
  units: readonly string[],
  whole = true,
): boolean {
  const v = object(value);
  return Boolean(
    v &&
    keys(v, ["value", "unit"]) &&
    units.includes(String(v.unit)) &&
    (whole ? integer(v.value) : finite(v.value) && v.value >= 0),
  );
}
export function clock(value: unknown): boolean {
  const v = object(value);
  return Boolean(
    v &&
    keys(v, ["checkId", "combatUuid", "completedRounds", "elapsedMinutes"]) &&
    text(v.checkId) &&
    (v.combatUuid === undefined || text(v.combatUuid)) &&
    quantity(v.completedRounds, ["rounds"]) &&
    quantity(v.elapsedMinutes, ["minutes"]),
  );
}
export function actorBinding(value: unknown): boolean {
  const v = object(value);
  return Boolean(
    v &&
    keys(v, ["actorId", "actorUuid", "sceneId", "tokenUuid"]) &&
    text(v.actorId) &&
    text(v.actorUuid) &&
    ((v.sceneId === undefined && v.tokenUuid === undefined) ||
      (text(v.sceneId) && text(v.tokenUuid))),
  );
}
function pixelPoint(value: unknown): boolean {
  const v = object(value);
  return Boolean(
    v &&
    keys(v, ["x", "y", "unit"]) &&
    finite(v.x) &&
    finite(v.y) &&
    v.unit === "pixels",
  );
}
function health(value: unknown): boolean {
  const v = object(value);
  if (!v) return false;
  if (v.kind === "wounds")
    return keys(v, ["kind", "stateId"]) && text(v.stateId);
  const current = object(v.current);
  return (
    v.kind === "body-points" &&
    keys(v, ["kind", "current", "maximum", "derivedWoundStateId"]) &&
    Boolean(
      current &&
      keys(current, ["value", "unit"]) &&
      Number.isSafeInteger(current.value) &&
      current.unit === "points",
    ) &&
    quantity(v.maximum, ["points"]) &&
    Number(object(v.current)?.value) <= Number(object(v.maximum)?.value) &&
    (v.derivedWoundStateId === undefined || text(v.derivedWoundStateId))
  );
}
export function effectPlan(value: unknown): value is FirstEditionEffectPlan {
  const v = object(value);
  if (!v || !text(v.actorUuid)) return false;
  if (v.kind === "token-translation") {
    const measurement = object(v.measurement);
    return (
      keys(v, [
        "kind",
        "actorUuid",
        "sceneId",
        "tokenUuid",
        "from",
        "to",
        "distance",
        "measurement",
      ]) &&
      text(v.sceneId) &&
      text(v.tokenUuid) &&
      pixelPoint(v.from) &&
      pixelPoint(v.to) &&
      quantity(v.distance, ["meters"], false) &&
      Boolean(
        measurement &&
        keys(measurement, ["sceneUnits", "gridDistance", "gridSize"]) &&
        text(measurement.sceneUnits) &&
        finite(measurement.gridDistance) &&
        measurement.gridDistance > 0 &&
        finite(measurement.gridSize) &&
        measurement.gridSize > 0,
      )
    );
  }
  if (
    ["action-spend", "segment-movement", "ordered-completion"].includes(
      String(v.kind),
    )
  )
    return (
      keys(v, [
        "kind",
        "actorUuid",
        "combatUuid",
        "combatantUuid",
        "expectedRevision",
        "actions",
        "distance",
      ]) &&
      text(v.combatUuid) &&
      text(v.combatantUuid) &&
      integer(v.expectedRevision) &&
      quantity(v.actions, ["actions"]) &&
      (v.kind === "segment-movement"
        ? quantity(v.distance, ["meters"], false)
        : v.distance === undefined)
    );
  if (v.kind === "body-point-skill-loss")
    return (
      keys(v, ["kind", "actorUuid", "lossScore"]) &&
      (v.lossScore === 3 || v.lossScore === 6)
    );
  if (v.kind === "medical-consumable-use")
    return (
      keys(v, [
        "kind",
        "actorUuid",
        "administratorActorUuid",
        "itemUuid",
        "useId",
        "effectId",
        "durationRoll",
        "durationSeconds",
        "actionCost",
        "doseCost",
        "beforeQuantity",
        "physiology",
        "injury",
      ]) &&
      text(v.administratorActorUuid) &&
      text(v.itemUuid) &&
      text(v.useId) &&
      text(v.effectId) &&
      integer(v.durationRoll) &&
      v.durationRoll >= 1 &&
      v.durationRoll <= 6 &&
      v.durationSeconds === v.durationRoll * 5 &&
      quantity(v.actionCost, ["actions"]) &&
      object(v.actionCost)?.value === 1 &&
      quantity(v.doseCost, ["doses"]) &&
      object(v.doseCost)?.value === 1 &&
      quantity(v.beforeQuantity, ["doses"]) &&
      Number(object(v.beforeQuantity)?.value) >= 1 &&
      v.physiology === "biological" &&
      ["wounded", "severely-wounded"].includes(String(v.injury))
    );
  if (v.kind === "health-change")
    return (
      keys(v, [
        "kind",
        "actorUuid",
        "healthModelId",
        "before",
        "after",
        "clock",
        "rest",
      ]) &&
      text(v.healthModelId) &&
      health(v.before) &&
      health(v.after) &&
      object(v.before)?.kind === object(v.after)?.kind &&
      (v.clock === undefined || clock(v.clock)) &&
      (v.rest === undefined || quantity(v.rest, ["minutes", "days", "weeks"]))
    );
  if (v.kind === "mortality-clock")
    return (
      keys(v, ["kind", "actorUuid", "healthModelId", "before", "after"]) &&
      text(v.healthModelId) &&
      clock(v.before) &&
      clock(v.after)
    );
  return (
    v.kind === "item-score-change" &&
    keys(v, ["kind", "actorUuid", "itemUuid", "before", "after"]) &&
    text(v.itemUuid) &&
    quantity(v.before, ["pips"]) &&
    quantity(v.after, ["pips"])
  );
}
export function stageSpec(
  value: unknown,
  root: FirstEditionActionRoot,
): boolean {
  const v = object(value);
  if (!v || !text(v.controllerUserId) || !actorBinding(v.subject)) return false;
  const role =
    root.initiation === "movement"
      ? "mover"
      : root.initiation === "medical-consumable" &&
          (v.kind !== "effect" ||
            object(v.plan)?.kind !== "medical-consumable-use")
        ? "administrator"
        : (v.purpose === "medicine" || v.purpose === "body-point-amount") &&
            root.subjects.some((s) => s.role === "healer")
          ? "healer"
          : "patient";
  if (
    canonical(v.subject) !==
    canonical(root.subjects.find((s) => s.role === role)?.actor)
  )
    return false;
  const common = ["kind", "controllerUserId", "subject"];
  if (v.kind === "effect") {
    if (
      !keys(v, [...common, "plan"]) ||
      !effectPlan(v.plan) ||
      v.plan.actorUuid !== object(v.subject)?.actorUuid
    )
      return false;
    if (v.plan.kind === "body-point-skill-loss")
      return (
        root.initiation === "healing" &&
        [
          "open-d6.damage.body-points",
          "open-d6.damage.body-points-with-wounds",
        ].includes(root.runtime.damageStrategyId ?? "")
      );
    if (v.plan.kind === "medical-consumable-use")
      return (
        root.initiation === "medical-consumable" &&
        v.plan.administratorActorUuid ===
          root.subjects.find((subject) => subject.role === "administrator")
            ?.actor.actorUuid
      );
    if (v.plan.kind === "token-translation")
      return (
        v.plan.tokenUuid === object(v.subject)?.tokenUuid &&
        v.plan.sceneId === object(v.subject)?.sceneId
      );
    if (v.plan.kind === "health-change" || v.plan.kind === "mortality-clock")
      return v.plan.healthModelId === root.runtime.healthModelId;
    if (
      ["action-spend", "segment-movement", "ordered-completion"].includes(
        v.plan.kind,
      )
    )
      return text(root.runtime.actionEconomyStrategyId);
    return true;
  }
  if (v.kind === "plain-d6")
    return (
      keys(v, [...common, "purpose", "unit", "dice"]) &&
      ((v.purpose === "body-point-amount" && v.unit === "points") ||
        (v.purpose === "duration" && v.unit === "rounds")) &&
      integer(v.dice) &&
      v.dice > 0 &&
      v.dice <= 100
    );
  const source = object(v.source);
  return (
    v.kind === "d6-roll" &&
    keys(v, [
      ...common,
      "purpose",
      "unit",
      "source",
      "fixedDifficulty",
      "fixedScore",
    ]) &&
    [
      "movement",
      "segment-running",
      "natural-healing",
      "medicine",
      "survival",
      "duration",
    ].includes(String(v.purpose)) &&
    v.unit === (v.purpose === "duration" ? "minutes" : "check") &&
    Boolean(
      source &&
      keys(source, ["attributeId", "itemId"]) &&
      text(source.attributeId) &&
      (source.itemId === undefined || text(source.itemId)),
    ) &&
    (v.fixedDifficulty === undefined || integer(v.fixedDifficulty)) &&
    (v.fixedScore === undefined || integer(v.fixedScore))
  );
}
const mode = (value: unknown): boolean =>
  ["publicroll", "gmroll", "blindroll", "selfroll"].includes(String(value));
export function claimInput(
  value: unknown,
  root: FirstEditionActionRoot,
  stage: FirstEditionActionStage,
): value is FirstEditionClaimInput {
  const v = object(value);
  if (v?.kind !== stage.spec.kind) return false;
  if (stage.spec.kind === "effect") return keys(v, ["kind"]);
  if (stage.spec.kind === "plain-d6")
    return (
      keys(v, ["kind", "dice", "rollMode"]) &&
      v.dice === stage.spec.dice &&
      mode(v.rollMode)
    );
  const request = object(v.request),
    source = object(request?.source),
    runtime = object(v.runtime);
  return (
    keys(v, ["kind", "request", "runtime"]) &&
    Boolean(
      request &&
      source &&
      runtime &&
      keys(runtime, [
        "profileId",
        "successEvaluator",
        "wildPolicy",
        "wildTriumph",
      ]) &&
      runtime.profileId === root.runtime.profileId &&
      wildTriumph(runtime.wildTriumph) &&
      ["first-edition-meets", "second-edition-strict"].includes(
        String(runtime.successEvaluator),
      ) &&
      [
        "first-edition",
        "second-edition",
        "second-edition-basic",
        "second-edition-classic",
        "second-edition-simple",
        "d6mv",
      ].includes(String(runtime.wildPolicy)) &&
      (root.initiation !== "round-mortality" ||
        (object(object(request.context)?.firstEditionMortality)?.checkId ===
          root.clock?.checkId &&
          object(object(request.context)?.firstEditionMortality)
            ?.completedRounds === root.clock?.completedRounds.value &&
          object(object(request.context)?.firstEditionMortality)
            ?.elapsedMinutes === root.clock?.elapsedMinutes.value)) &&
      request.contractVersion === 2 &&
      request.kind === (stage.spec.source.itemId ? "skill" : "attribute") &&
      source.actorId === stage.spec.subject.actorId &&
      source.attributeId === stage.spec.source.attributeId &&
      source.itemId === stage.spec.source.itemId &&
      integer(request.score) &&
      Number.isSafeInteger(request.resultModifier) &&
      mode(request.rollMode) &&
      (stage.spec.fixedDifficulty === undefined ||
        request.difficulty === stage.spec.fixedDifficulty) &&
      (stage.spec.fixedScore === undefined ||
        request.score === stage.spec.fixedScore) &&
      (stage.spec.purpose !== "duration" ||
        object(object(request.context)?.firstEditionDuration)?.unit ===
          "minutes"),
    )
  );
}
function wildTriumph(value: unknown): boolean {
  if (value === undefined) return true;
  const v = object(value);
  return Boolean(
    v &&
    keys(v, [
      "automaticSuccess",
      "characterPointAward",
      "enabled",
      "metaCurrencyAward",
      "threshold",
    ]) &&
    typeof v.automaticSuccess === "boolean" &&
    typeof v.enabled === "boolean" &&
    integer(v.threshold) &&
    v.threshold > 0 &&
    (v.characterPointAward === undefined || integer(v.characterPointAward)) &&
    (v.metaCurrencyAward === undefined || integer(v.metaCurrencyAward)),
  );
}
function artifacts(
  value: unknown,
): value is readonly FirstEditionSerializedRoll[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 100 &&
    value.every((raw: unknown) => {
      const v = object(raw),
        e = object(v?.evidence);
      return Boolean(
        v &&
        keys(v, ["version", "evidence", "serialized"]) &&
        v.version === 1 &&
        typeof v.serialized === "string" &&
        v.serialized.length > 0 &&
        v.serialized.length <= 100_000 &&
        e &&
        keys(e, ["faces", "fingerprint", "formula", "total"]) &&
        text(e.formula) &&
        finite(e.total) &&
        typeof e.fingerprint === "string" &&
        /^[a-f0-9]{64}$/u.test(e.fingerprint) &&
        Array.isArray(e.faces) &&
        e.faces.length <= 1000 &&
        e.faces.every(
          (face: unknown) => integer(face) && face >= 1 && face <= 6,
        ),
      );
    })
  );
}
export function stageReceipt(
  value: unknown,
  stage: FirstEditionActionStage,
): value is FirstEditionStageReceipt {
  const v = object(value);
  if (!v || !stage.claim || v.kind !== stage.claim.kind) return false;
  if (stage.claim.kind === "effect")
    return (
      stage.spec.kind === "effect" &&
      keys(v, [
        "kind",
        "receiptKey",
        "plan",
        "outcome",
        "authorityReceiptId",
      ]) &&
      v.receiptKey === `${stage.id}:effect` &&
      canonical(v.plan) === canonical(stage.spec.plan) &&
      ["applied", "no-change"].includes(String(v.outcome)) &&
      (v.outcome !== "no-change" || noChangePlan(stage.spec.plan)) &&
      text(v.authorityReceiptId)
    );
  if (!artifacts(v.artifacts)) return false;
  const faces = v.artifacts.flatMap((artifact) => artifact.evidence.faces);
  if (stage.claim.kind === "plain-d6")
    return (
      keys(v, ["kind", "total", "faces", "artifacts"]) &&
      Array.isArray(v.faces) &&
      canonical(v.faces) === canonical(faces) &&
      faces.length === stage.claim.dice &&
      v.total === faces.reduce((sum, face) => sum + face, 0)
    );
  if (!keys(v, ["kind", "result", "artifacts"])) return false;
  try {
    const result = v.result as Extract<
      FirstEditionStageReceipt,
      { kind: "d6-roll" }
    >["result"];
    if (canonical(result.request) !== canonical(stage.claim.request))
      return false;
    const replay = resolveD6Roll({
      ...stage.claim.runtime,
      request: stage.claim.request,
      baseFaces: result.baseFaces,
      wildFaces: result.wildFaces,
      ...(result.wildFaceGroups
        ? { wildFaceGroups: result.wildFaceGroups }
        : {}),
      ...(result.characterPointFaceGroups
        ? { characterPointFaceGroups: result.characterPointFaceGroups }
        : {}),
      ...(result.wildChoice ? { choice: result.wildChoice } : {}),
    });
    const { matchingObservation: _observation, ...numeric } = result;
    void _observation;
    const ordinary = [
      ...result.baseFaces,
      ...(result.characterPointFaces ?? []),
    ];
    return (
      !replay.requiresWildExplosion &&
      replay.pendingChoices.length === 0 &&
      canonical(replay) === canonical(numeric) &&
      canonical(faces.slice(0, ordinary.length)) === canonical(ordinary) &&
      canonical(faces.slice(ordinary.length).sort()) ===
        canonical([...result.wildFaces].sort())
    );
  } catch {
    return false;
  }
}
function noChangePlan(plan: FirstEditionEffectPlan): boolean {
  if (plan.kind === "token-translation")
    return (
      canonical(plan.from) === canonical(plan.to) && plan.distance.value === 0
    );
  if (
    plan.kind === "health-change" ||
    plan.kind === "mortality-clock" ||
    plan.kind === "item-score-change"
  )
    return canonical(plan.before) === canonical(plan.after);
  // A command may advance a revision/queue even when its numeric action cost is zero.
  return false;
}
