import {
  acceptedWildDieChoice,
  advancedSkillAugmentedScore,
  canDoubleDown,
  canRerollFailedRoll,
  D6_ROLL_CONTRACT_VERSION,
  doublingDownRequest,
  formatPipScore,
  heroPointBalanceAfter,
  heroPointRerollRequest,
  specializationScore,
  validateAdvancedSkill,
  type D6HeroPointUse,
  type D6AdvancedSkillRollContext,
  type D6ParticipantKind,
  type D6RollMode,
  type D6RollOpposition,
  type D6RollRequestV1,
  type D6RollResultV1,
  type D6WildDieChoice,
} from "@d6-system-2e/core";
import { executeD6Roll } from "../../application/rolls/execute-roll";
import { SYSTEM_ID } from "../../constants";
import { currentTerminology } from "../../registries/terminology";
import { currentRulesProfile } from "../../settings/rules-compatibility";
import {
  booleanSetting,
  currentDefaultRollMode,
  numberSetting,
  stringSetting,
} from "../../settings/setting-values";
import {
  FIRST_EDITION_OPTION_KEYS,
  SECOND_EDITION_OPTION_KEYS,
  SHARED_SETTING_KEYS,
} from "../../settings/settings-catalog";
import { currentEditionCapabilityProfile } from "../../settings/edition-capabilities";
import {
  currentCombinedPipScore,
  currentEffectivePipScore,
} from "../../settings/pip-rules";
import { integer, record, stringValue } from "../sheets/values";
import { readCombatantRound } from "../combat-service";
import { chatVisibilityForMode } from "./chat-visibility";

interface RollDialogResult {
  readonly advancedSkillItemId?: string;
  readonly difficulty?: number;
  readonly heroPointUse: D6HeroPointUse;
  readonly opposition?: D6RollOpposition;
  readonly resultModifier: number;
  readonly rollMode: D6RollMode;
}

interface AdvancedSkillContextOption extends D6AdvancedSkillRollContext {
  readonly augmentedScore: number;
  readonly augmentedScoreLabel: string;
  readonly scoreLabel: string;
}

function inputChecked(form: HTMLFormElement, name: string): boolean {
  const control = form.elements.namedItem(name);
  return control instanceof HTMLInputElement && control.checked;
}

function actorDocument(value: object): FoundryActorDocument {
  const actor = value as Partial<FoundryActorDocument>;
  if (
    typeof actor.id !== "string" ||
    typeof actor.name !== "string" ||
    typeof actor.system !== "object"
  ) {
    throw new TypeError(
      "The public roll API requires a Foundry Actor document.",
    );
  }
  return actor as FoundryActorDocument;
}

function inputNumber(form: HTMLFormElement, name: string): number | undefined {
  const control = form.elements.namedItem(name);
  if (!(control instanceof HTMLInputElement) || control.value.trim() === "") {
    return undefined;
  }
  return Number.isFinite(control.valueAsNumber)
    ? Math.trunc(control.valueAsNumber)
    : undefined;
}

function selectValue(form: HTMLFormElement, name: string): string {
  const control = form.elements.namedItem(name);
  return control instanceof HTMLSelectElement ? control.value : "";
}

function participantKind(value: string): D6ParticipantKind {
  return value === "player-character" || value === "non-player-character"
    ? value
    : "unknown";
}

async function promptForRoll(
  actor: FoundryActorDocument,
  label: string,
  score: number,
  advancedSkillContexts: readonly AdvancedSkillContextOption[] = [],
  actionPenaltyLabel?: string,
): Promise<RollDialogResult | null> {
  const profile = currentRulesProfile();
  const resources = record(actor.system.resources);
  const heroPoints = integer(record(resources.heroPoints).value);
  const defaultRollMode = currentDefaultRollMode();
  const defaultDifficulty = Math.trunc(
    numberSetting(SHARED_SETTING_KEYS.defaultDifficulty, 0),
  );
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/roll/dialog.hbs`,
    {
      actionPenaltyLabel,
      actor,
      advancedSkillContexts,
      blindRollSelected: defaultRollMode === "blindroll",
      defaultDifficulty: defaultDifficulty > 0 ? defaultDifficulty : undefined,
      gmRollSelected: defaultRollMode === "gmroll",
      label,
      publicRollSelected: defaultRollMode === "publicroll",
      scoreLabel: formatPipScore(score),
      selfRollSelected: defaultRollMode === "selfroll",
      showDifficultyControls: booleanSetting(
        SHARED_SETTING_KEYS.showDifficultyControls,
        true,
      ),
      showHeroPointDouble:
        !profile.compatibility.firstEditionMetaCurrency && heroPoints > 0,
      showModifierControls: booleanSetting(
        SHARED_SETTING_KEYS.showModifierControls,
        true,
      ),
      showOppositionControls: booleanSetting(
        SHARED_SETTING_KEYS.showOppositionControls,
        true,
      ),
      doubledScoreLabel: formatPipScore(score * 2),
      hasAdvancedSkillContexts: advancedSkillContexts.length > 0,
      hasActionPenalty: actionPenaltyLabel !== undefined,
      heroPoints,
    },
  );
  const result =
    await foundry.applications.api.DialogV2.wait<RollDialogResult | null>({
      buttons: [
        {
          action: "cancel",
          class: "od6roll-cancel",
          callback: () => null,
          label: game.i18n.localize("D6E2.Cancel"),
        },
        {
          action: "roll",
          class: "od6roll-submit",
          callback: (_event, button) => {
            const form = button.form;
            if (!form) throw new Error("The D6 roll form is unavailable.");
            const difficulty = inputNumber(form, "difficulty");
            const oppositionTotal = inputNumber(form, "oppositionTotal");
            const oppositionWildDie = inputNumber(form, "oppositionWildDie");
            const oppositionNameControl =
              form.elements.namedItem("oppositionName");
            const enteredOppositionName =
              oppositionNameControl instanceof HTMLInputElement
                ? oppositionNameControl.value.trim()
                : "";
            const resultModifier = inputNumber(form, "resultModifier") ?? 0;
            const advancedSkillItemId = selectValue(
              form,
              "advancedSkillItemId",
            );
            const selectedMode = selectValue(form, "rollMode");
            const rollMode: D6RollMode = [
              "publicroll",
              "gmroll",
              "blindroll",
              "selfroll",
            ].includes(selectedMode)
              ? (selectedMode as D6RollMode)
              : "publicroll";
            return {
              ...(advancedSkillItemId.length > 0
                ? { advancedSkillItemId }
                : {}),
              ...(oppositionTotal === undefined && difficulty !== undefined
                ? { difficulty }
                : {}),
              heroPointUse: inputChecked(form, "doubleDieCode")
                ? "double-die-code"
                : "none",
              ...(oppositionTotal === undefined
                ? {}
                : {
                    opposition: {
                      actorKind: participantKind(
                        selectValue(form, "actorKind"),
                      ),
                      name:
                        enteredOppositionName.length > 0
                          ? enteredOppositionName
                          : game.i18n.localize(
                              "D6E2.Roll.Opposition.DefaultName",
                            ),
                      opponentKind: participantKind(
                        selectValue(form, "opponentKind"),
                      ),
                      total: oppositionTotal,
                      ...(oppositionWildDie === undefined
                        ? {}
                        : { wildDieFace: oppositionWildDie }),
                    },
                  }),
              resultModifier,
              rollMode,
            };
          },
          default: true,
          icon: "fa-solid fa-dice-d6",
          label: game.i18n.localize("D6E2.Roll.Action"),
        },
      ],
      classes: ["d6e2", "d6e2-roll-dialog", "od6roll-dialog"],
      content,
      modal: true,
      rejectClose: false,
      window: {
        icon: "fa-solid fa-dice-d6",
        title: `${game.i18n.localize("D6E2.Roll.Action")} · ${label}`,
      },
    });
  return result ?? null;
}

async function promptWildChoice(
  choices: readonly D6WildDieChoice[],
  result: D6RollResultV1,
): Promise<D6WildDieChoice | null> {
  if (choices.includes("first-edition-complication")) {
    const strategy = stringSetting(
      FIRST_EDITION_OPTION_KEYS.wildOneStrategy,
      "prompt",
    );
    if (
      strategy === "complication" &&
      choices.includes("first-edition-complication")
    ) {
      return "first-edition-complication";
    }
    if (
      strategy === "removeHighest" &&
      choices.includes("first-edition-remove-highest")
    ) {
      return "first-edition-remove-highest";
    }
  }
  const gmChoice = choices.includes("second-edition-partial");
  if (gmChoice && game.user?.isGM !== true) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Roll.GmComplicationRequired"),
    );
    return null;
  }
  const labels: Readonly<Record<D6WildDieChoice, string>> = {
    "first-edition-complication": "D6E2.Roll.Choice.Complication",
    "first-edition-remove-highest": "D6E2.Roll.Choice.RemoveHighest",
    "second-edition-exceptional": "D6E2.Roll.Choice.Exceptional",
    "second-edition-failure": "D6E2.Roll.Choice.Failure",
    "second-edition-ordinary": "D6E2.Roll.Choice.Ordinary",
    "second-edition-partial": "D6E2.Roll.Choice.Partial",
  };
  const icons: Readonly<Record<D6WildDieChoice, string>> = {
    "first-edition-complication": "fa-solid fa-triangle-exclamation",
    "first-edition-remove-highest": "fa-solid fa-dice-one",
    "second-edition-exceptional": "fa-solid fa-star",
    "second-edition-failure": "fa-solid fa-xmark",
    "second-edition-ordinary": "fa-solid fa-check",
    "second-edition-partial": "fa-solid fa-code-branch",
  };
  const selected: unknown =
    await foundry.applications.api.DialogV2.wait<D6WildDieChoice | null>({
      buttons: [
        ...choices.map((choice) => ({
          action: choice,
          callback: () => choice,
          icon: icons[choice],
          label: game.i18n.localize(labels[choice]),
        })),
        {
          action: "cancel",
          callback: () => null,
          label: game.i18n.localize("D6E2.Cancel"),
        },
      ],
      classes: [
        "d6e2",
        "d6e2-wild-dialog",
        "od6roll-dialog",
        "od6roll-wild-one-dialog",
      ],
      content: `<div class="od6-dialog-shell">
        <p>${game.i18n.localize("D6E2.Roll.WildChoiceHelp")}</p>
        <div class="od6roll-preview">
          <span>${game.i18n.localize("D6E2.Roll.Total")}</span>
          <strong>${result.total}</strong>
        </div>
      </div>`,
      modal: true,
      rejectClose: false,
      window: {
        icon: "fa-solid fa-dice-one",
        title: game.i18n.localize("D6E2.Roll.WildChoice"),
      },
    });
  return acceptedWildDieChoice(choices, selected);
}

async function rolledBatch(count: number): Promise<{
  readonly artifact: FoundryRoll | null;
  readonly faces: readonly number[];
}> {
  if (count === 0) return { artifact: null, faces: Object.freeze([]) };
  const roll = await new Roll(`${count}d6`).evaluate();
  return Object.freeze({
    artifact: roll,
    faces: Object.freeze(
      roll.dice.flatMap((term) =>
        term.results
          .filter((result) => result.active !== false)
          .map((result) => result.result),
      ),
    ),
  });
}

function visibilityForMode(mode: D6RollMode) {
  const gmIds =
    game.users?.contents.filter((user) => user.isGM).map((user) => user.id) ??
    [];
  return chatVisibilityForMode(mode, gmIds, game.user?.id);
}

async function applyHeroPointTransaction(
  actor: FoundryActorDocument,
  result: D6RollResultV1,
): Promise<void> {
  if (currentRulesProfile().compatibility.firstEditionMetaCurrency) {
    return;
  }
  if (!booleanSetting(SECOND_EDITION_OPTION_KEYS.autoHeroPoints, true)) {
    return;
  }
  if (result.heroPointAward === 0 && result.heroPointSpent === 0) return;
  const resources = record(actor.system.resources);
  const heroPoints = record(resources.heroPoints);
  const current = integer(heroPoints.value);
  await actor.update({
    "system.resources.heroPoints.value": heroPointBalanceAfter(
      current,
      result.heroPointSpent,
      result.heroPointAward,
    ),
  });
}

async function postRoll(
  actor: FoundryActorDocument,
  result: D6RollResultV1,
  artifacts: readonly unknown[],
): Promise<void> {
  const resources = record(actor.system.resources);
  const heroPoints = integer(record(resources.heroPoints).value);
  const secondEditionHeroPoints =
    !currentRulesProfile().compatibility.firstEditionMetaCurrency;
  const showHeroPointReroll =
    secondEditionHeroPoints && heroPoints > 0 && canRerollFailedRoll(result);
  const showDoublingDown =
    currentEditionCapabilityProfile().retries.strategy ===
      "second-edition-doubling-down" && canDoubleDown(result);
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/roll/chat-card.hbs`,
    {
      actionEconomyContext: result.request.context?.actionEconomy,
      actor,
      advancedSkillContext:
        result.request.context?.advancedSkill === undefined
          ? undefined
          : {
              ...result.request.context.advancedSkill,
              scoreLabel: formatPipScore(
                result.request.context.advancedSkill.score,
              ),
            },
      baseFaces: result.baseFaces,
      difficulty: result.difficulty,
      hasDifficulty: result.difficulty !== undefined,
      hasAdvancedSkillContext:
        result.request.context?.advancedSkill !== undefined,
      hasActionEconomyContext:
        result.request.context?.actionEconomy !== undefined,
      hasOpposition: result.opposition !== undefined,
      hasDoublingDownContext:
        result.request.context?.doublingDown !== undefined,
      doublingDownContext: result.request.context?.doublingDown,
      heroPointAward: result.heroPointAward,
      heroPointReroll: result.request.heroPointUse === "reroll-failed",
      heroPointSpent: result.heroPointSpent,
      opposition: result.opposition,
      oppositionName: result.request.opposition?.name,
      request: result.request,
      result,
      successClass:
        result.success === undefined
          ? "is-unresolved"
          : result.success
            ? "is-success"
            : "is-failure",
      showRollFooter:
        result.wildOutcome !== "normal" ||
        result.heroPointAward > 0 ||
        result.heroPointSpent > 0,
      showDoublingDown,
      showHeroPointReroll,
      showRollFollowUps: showHeroPointReroll || showDoublingDown,
      wildFaces: result.wildFaces,
      wildOutcomeLabel: game.i18n.localize(
        `D6E2.Roll.Outcome.${result.wildOutcome}`,
      ),
    },
  );
  await ChatMessage.create({
    ...visibilityForMode(result.request.rollMode),
    content,
    flags: {
      [SYSTEM_ID]: {
        roll: structuredClone(result),
      },
    },
    rolls: artifacts.filter(
      (artifact): artifact is FoundryRoll => artifact !== null,
    ),
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}

async function executePreparedRoll(
  actor: FoundryActorDocument,
  request: D6RollRequestV1,
): Promise<D6RollResultV1 | null> {
  const executed = await executeD6Roll(request, currentRulesProfile(), {
    chooseWildDie: promptWildChoice,
    rollBaseDice: rolledBatch,
    rollWildDie: () => rolledBatch(1),
  });
  if (!executed) return null;
  await applyHeroPointTransaction(actor, executed.result);
  await postRoll(actor, executed.result, executed.artifacts);
  return executed.result;
}

async function executeActorRoll(
  actor: FoundryActorDocument,
  requestSource: Omit<
    D6RollRequestV1,
    | "contractVersion"
    | "context"
    | "difficulty"
    | "heroPointUse"
    | "opposition"
    | "resultModifier"
    | "rollMode"
  > & {
    readonly advancedSkillContexts?: readonly AdvancedSkillContextOption[];
  },
): Promise<D6RollResultV1 | null> {
  const roundState = readCombatantRound(actor);
  const secondEditionActionSegments =
    currentEditionCapabilityProfile().actionEconomy.strategy ===
    "second-edition-action-segments";
  const appliesActionPenalty = [
    "attribute",
    "resistance",
    "skill",
    "weapon-attack",
  ].includes(requestSource.kind);
  const actionPenalty =
    secondEditionActionSegments &&
    appliesActionPenalty &&
    roundState?.actions.length
      ? roundState.penaltyScore
      : 0;
  const dialogAdvancedSkillContexts = requestSource.advancedSkillContexts?.map(
    (context) => {
      const augmentedScore = context.augmentedScore - actionPenalty;
      return {
        ...context,
        augmentedScore,
        augmentedScoreLabel: formatPipScore(augmentedScore),
      };
    },
  );
  const controls = await promptForRoll(
    actor,
    requestSource.label,
    requestSource.score - actionPenalty,
    dialogAdvancedSkillContexts,
    actionPenalty > 0 ? roundState?.penaltyLabel : undefined,
  );
  if (!controls) return null;
  const advancedSkill = requestSource.advancedSkillContexts?.find(
    (candidate) => candidate.itemId === controls.advancedSkillItemId,
  );
  const unpenalizedScore =
    advancedSkill === undefined
      ? requestSource.score
      : advancedSkillAugmentedScore(requestSource.score, advancedSkill.score);
  const score = unpenalizedScore - actionPenalty;
  if (score < 3) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Combat.Error.PoolBelowOneDie"),
    );
    return null;
  }
  const request: D6RollRequestV1 = Object.freeze({
    contractVersion: D6_ROLL_CONTRACT_VERSION,
    ...(advancedSkill === undefined && actionPenalty === 0
      ? {}
      : {
          context: {
            ...(actionPenalty === 0 || roundState === null
              ? {}
              : {
                  actionEconomy: {
                    actionCount: roundState.actions.length,
                    penaltyLabel: roundState.penaltyLabel,
                    penaltyScore: actionPenalty,
                    round: roundState.round,
                  },
                }),
            ...(advancedSkill === undefined
              ? {}
              : {
                  advancedSkill: {
                    itemId: advancedSkill.itemId,
                    label: advancedSkill.label,
                    score: advancedSkill.score,
                  },
                }),
          },
        }),
    ...(controls.difficulty === undefined
      ? {}
      : { difficulty: controls.difficulty }),
    kind: requestSource.kind,
    label: requestSource.label,
    heroPointUse: controls.heroPointUse,
    ...(controls.opposition === undefined
      ? {}
      : { opposition: controls.opposition }),
    resultModifier: controls.resultModifier,
    rollMode: controls.rollMode,
    score,
    source: requestSource.source,
  });
  return executePreparedRoll(actor, request);
}

export async function rerollFailedRoll(
  actorValue: object,
  previousResult: D6RollResultV1,
): Promise<D6RollResultV1 | null> {
  const actor = actorDocument(actorValue);
  if (actor.isOwner !== true) {
    throw new Error("D6E2.Roll.HeroPoint.OwnerRequired");
  }
  if (previousResult.request.source.actorId !== actor.id) {
    throw new RangeError("D6E2.Roll.HeroPoint.ActorMismatch");
  }
  if (currentRulesProfile().compatibility.firstEditionMetaCurrency) {
    throw new RangeError("D6E2.Roll.HeroPoint.SecondEditionRequired");
  }
  const resources = record(actor.system.resources);
  const balance = integer(record(resources.heroPoints).value);
  if (balance < 1) {
    throw new RangeError("D6E2.Roll.HeroPoint.NoneAvailable");
  }
  return executePreparedRoll(actor, heroPointRerollRequest(previousResult));
}

export async function doubleDownFailedRoll(
  actorValue: object,
  previousResult: D6RollResultV1,
  narration?: string,
): Promise<D6RollResultV1 | null> {
  const actor = actorDocument(actorValue);
  if (actor.isOwner !== true) {
    throw new Error("D6E2.Roll.DoublingDown.OwnerRequired");
  }
  if (previousResult.request.source.actorId !== actor.id) {
    throw new RangeError("D6E2.Roll.DoublingDown.ActorMismatch");
  }
  if (
    currentEditionCapabilityProfile().retries.strategy !==
    "second-edition-doubling-down"
  ) {
    throw new RangeError("D6E2.Roll.DoublingDown.SecondEditionRequired");
  }
  return executePreparedRoll(
    actor,
    doublingDownRequest(previousResult, narration),
  );
}

export async function rollAttribute(
  actorValue: object,
  attributeId: string,
): Promise<D6RollResultV1 | null> {
  const actor = actorDocument(actorValue);
  const attribute = record(record(actor.system.attributes)[attributeId]);
  const score = currentEffectivePipScore(integer(attribute.score));
  const terminology = currentTerminology();
  const label =
    terminology.attributes[attributeId] ??
    attributeId
      .replaceAll("-", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return executeActorRoll(actor, {
    kind: "attribute",
    label,
    score,
    source: {
      actorId: actor.id,
      actorName: actor.name,
      attributeId,
    },
  });
}

function embeddedSkillScore(
  actor: FoundryActorDocument,
  skill: FoundryItemDocument,
): number {
  if (skill.system.training === "advanced") {
    return currentEffectivePipScore(integer(skill.system.score));
  }
  const attributeId = stringValue(skill.system.attributeId);
  const attribute = record(record(actor.system.attributes)[attributeId]);
  return currentCombinedPipScore(
    integer(attribute.score),
    integer(skill.system.score),
  );
}

function advancedSkillIssues(
  actor: FoundryActorDocument,
  skill: FoundryItemDocument,
): readonly string[] {
  const prerequisiteKeys = Array.isArray(skill.system.prerequisiteSkillKeys)
    ? skill.system.prerequisiteSkillKeys.filter(
        (key): key is string => typeof key === "string",
      )
    : [];
  const byKey = new Map(
    actor.items.contents
      .filter((item) => item.type === "skill")
      .map((item) => [stringValue(item.system.key), item]),
  );
  return validateAdvancedSkill({
    prerequisiteScores: prerequisiteKeys.map((key) => {
      const prerequisite = byKey.get(key);
      return prerequisite ? embeddedSkillScore(actor, prerequisite) : 0;
    }),
    score: currentEffectivePipScore(integer(skill.system.score)),
  });
}

function advancedSkillContextOptions(
  actor: FoundryActorDocument,
  baseSkill: FoundryItemDocument,
  baseScore: number,
): readonly AdvancedSkillContextOption[] {
  const capabilities = currentEditionCapabilityProfile();
  if (capabilities.advancedSkills.state !== "active") {
    return Object.freeze([]);
  }
  const baseKey = stringValue(baseSkill.system.key);
  if (baseKey.length === 0) return Object.freeze([]);
  return Object.freeze(
    actor.items.contents
      .filter((candidate) => {
        const prerequisiteKeys = Array.isArray(
          candidate.system.prerequisiteSkillKeys,
        )
          ? candidate.system.prerequisiteSkillKeys
          : [];
        return (
          candidate.type === "skill" &&
          candidate.system.training === "advanced" &&
          prerequisiteKeys.includes(baseKey) &&
          advancedSkillIssues(actor, candidate).length === 0
        );
      })
      .map((candidate) => {
        const score = currentEffectivePipScore(integer(candidate.system.score));
        const augmentedScore = advancedSkillAugmentedScore(baseScore, score);
        return Object.freeze({
          augmentedScore,
          augmentedScoreLabel: formatPipScore(augmentedScore),
          itemId: candidate.id,
          label: candidate.name,
          score,
          scoreLabel: formatPipScore(score),
        });
      })
      .sort((left, right) => left.label.localeCompare(right.label)),
  );
}

export async function rollSkill(
  actorValue: object,
  itemId: string,
): Promise<D6RollResultV1 | null> {
  const actor = actorDocument(actorValue);
  const skill = actor.items.get(itemId);
  if (!skill || !["skill", "specialization"].includes(skill.type)) {
    throw new RangeError(`Skill ${itemId} is not embedded in ${actor.name}.`);
  }
  if (skill.type === "specialization") {
    const parentSkillId =
      typeof skill.system.parentSkillId === "string"
        ? skill.system.parentSkillId
        : "";
    const parentSkillKey =
      typeof skill.system.parentSkillKey === "string"
        ? skill.system.parentSkillKey
        : "";
    const parent =
      actor.items.get(parentSkillId) ??
      actor.items.contents.find(
        (item) => item.type === "skill" && item.system.key === parentSkillKey,
      );
    if (parent?.type !== "skill") {
      ui.notifications.warn(
        game.i18n.localize("D6E2.Roll.SpecializationParentRequired"),
      );
      return null;
    }
    const parentAttributeId =
      typeof parent.system.attributeId === "string"
        ? parent.system.attributeId
        : "";
    const parentAttribute = record(
      record(actor.system.attributes)[parentAttributeId],
    );
    const parentScore =
      parent.system.training === "advanced" &&
      currentEditionCapabilityProfile().advancedSkills.state === "active"
        ? currentEffectivePipScore(integer(parent.system.score))
        : currentCombinedPipScore(
            integer(parentAttribute.score),
            integer(parent.system.score),
          );
    return executeActorRoll(actor, {
      kind: "skill",
      label: `${parent.name}: ${skill.name}`,
      score: specializationScore(
        parentScore,
        currentEffectivePipScore(integer(skill.system.score)),
      ),
      source: {
        actorId: actor.id,
        actorName: actor.name,
        attributeId: parentAttributeId,
        itemId: skill.id,
      },
    });
  }
  const attributeId =
    typeof skill.system.attributeId === "string"
      ? skill.system.attributeId
      : "";
  const advanced = skill.system.training === "advanced";
  const advancedSkillsActive =
    currentEditionCapabilityProfile().advancedSkills.state === "active";
  if (advanced && !advancedSkillsActive) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Roll.AdvancedSkillInactive"),
    );
    return null;
  }
  const secondEditionAdvanced = advanced && advancedSkillsActive;
  const attribute = record(record(actor.system.attributes)[attributeId]);
  const score = secondEditionAdvanced
    ? currentEffectivePipScore(integer(skill.system.score))
    : currentCombinedPipScore(
        integer(attribute.score),
        integer(skill.system.score),
      );
  if (secondEditionAdvanced) {
    const issues = advancedSkillIssues(actor, skill);
    if (issues.length > 0) {
      ui.notifications.warn(
        game.i18n.localize("D6E2.Roll.AdvancedPrerequisitesRequired"),
      );
      return null;
    }
  }
  return executeActorRoll(actor, {
    advancedSkillContexts: secondEditionAdvanced
      ? []
      : advancedSkillContextOptions(actor, skill, score),
    kind: "skill",
    label: skill.name,
    score,
    source: {
      actorId: actor.id,
      actorName: actor.name,
      attributeId,
      itemId: skill.id,
    },
  });
}

export async function rollItem(
  actorValue: object,
  itemId: string,
  mode: "attack" | "damage" = "attack",
): Promise<D6RollResultV1 | null> {
  const actor = actorDocument(actorValue);
  const item = actor.items.get(itemId);
  if (
    !item ||
    !["starship-weapon", "vehicle-weapon", "weapon"].includes(item.type)
  ) {
    throw new RangeError(`Weapon ${itemId} is not embedded in ${actor.name}.`);
  }
  if (mode === "damage") {
    return executeActorRoll(actor, {
      kind: "damage",
      label: `${item.name} · ${game.i18n.localize("D6E2.Item.Damage")}`,
      score: currentEffectivePipScore(integer(item.system.damage)),
      source: {
        actorId: actor.id,
        actorName: actor.name,
        attributeId: "",
        itemId: item.id,
      },
    });
  }
  const attackSkillKey =
    typeof item.system.attackSkillKey === "string"
      ? item.system.attackSkillKey
      : "";
  const linkedSkill = actor.items.contents.find(
    (candidate) =>
      candidate.type === "skill" && candidate.system.key === attackSkillKey,
  );
  if (linkedSkill) return rollSkill(actor, linkedSkill.id);
  const attributeId =
    typeof item.system.attackAttributeId === "string"
      ? item.system.attackAttributeId
      : "agility";
  const attribute = record(record(actor.system.attributes)[attributeId]);
  return executeActorRoll(actor, {
    kind: "weapon-attack",
    label: item.name,
    score: currentEffectivePipScore(integer(attribute.score)),
    source: {
      actorId: actor.id,
      actorName: actor.name,
      attributeId,
      itemId: item.id,
    },
  });
}
