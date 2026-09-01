import {
  actionEconomyRollPlan,
  advancedSkillAugmentedScore,
  canDoubleDown,
  canRerollFailedRoll,
  D6_ROLL_CONTRACT_VERSION,
  d6MvSrp,
  d6MvVsm,
  doublingDownRequest,
  formatPipScore,
  firstEditionActiveDefensePlan,
  firstEditionExplosiveRangeForDistance,
  firstEditionGrenadeTargetingDifficulty,
  firstEditionRangedCombatDifficultyPlan,
  firstEditionStrengthAdjustedThrowRanges,
  augmentationInstallDifficulty,
  augmentationInstallMinutes,
  cyberwareDisableTurns,
  hackingConsequence,
  freeformMagicDifficulty,
  freeformMagicUntrainedPenalty,
  D6_FIRST_EDITION_ADVENTURE_MAGIC_CONTRACT_VERSION,
  D6_FIRST_EDITION_FANTASY_MAGIC_CONTRACT_VERSION,
  magicPointCastingCost,
  magicPointPool,
  recoverMagicPoints,
  isFirstEditionWoundLevel,
  type FirstEditionMovementPlan,
  type D6MagicCastResultV1,
  type D6FirstEditionAdventureMagicCastResultV1,
  type D6FirstEditionFantasyMagicCastResultV1,
  type D6MagicPointCastResultV1,
  type D6MagicPointPoolV1,
  type D6PsionicPowerRollOptionsV1,
  type D6FreeformMagicDesignV1,
  heroPointSpendLimit,
  heroPointRerollRequest,
  isSecondEditionCondition,
  secondEditionConditionAllowsActions,
  secondEditionCoverDefensePlan,
  secondEditionAutofirePlan,
  secondEditionBrawnAdjustedThrowRanges,
  secondEditionExplosiveRangeForDistance,
  secondEditionDefenseForPosture,
  secondEditionDefenseKind,
  secondEditionDodgeDefense,
  secondEditionRangeForDistance,
  secondEditionMachineWeaponAttackPlan,
  secondEditionMachineResistancePlan,
  secondEditionNoDodgeDefensePlan,
  secondEditionResistancePlan,
  secondEditionStaticDefense,
  secondEditionWeaponAttackKind,
  specializationScore,
  resolveD6MatchingRewardPlan,
  observeD6MatchingCombination,
  SUPERHEROIC_DIE_CODE_CAPS,
  superheroicDieCodeCapPlan,
  type D6HeroPointUse,
  type D6EnvironmentEffectV1,
  type D6EnvironmentRollContext,
  type D6EnvironmentThreat,
  type D6AdvancedSkillRollContext,
  type D6RollInvocationOptionsV1,
  type D6ParticipantKind,
  type D6RollKind,
  type D6RollMode,
  type D6RollOpposition,
  type D6RollRequestV1,
  type D6RollResultV1,
  type D6MatchingResultV1,
  type D6ResistanceRollContext,
  type D6RollSource,
  type D6RollContextV1,
  type D6ScaleRollApplication,
  type D6ScaleRollContext,
  type D6SecondEditionAutofireRollContext,
  type D6WildDieChoice,
  type D6WildDiePolicy,
  type D6WeaponAttackRollContext,
  type D6WeaponDamageContinuationRollContext,
  type ActionDeclarationAssistanceMode,
  type FirstEditionActiveDefenseKind,
  type SecondEditionAttackKind,
  type SecondEditionRangeBand,
} from "@d6-system-2e/core";
import { executeD6Roll } from "../../application/rolls/execute-roll";
import { completedUnrollableExtraordinaryPowerResult } from "./extraordinary-power-unrollable-result";
import { currentSettingProfile } from "../../settings/setting-profile";
import { resolveSettingLogo } from "../../settings/presentation-theme";
import { SYSTEM_ID } from "../../constants";
import {
  currentTerminology,
  terminologyActorLabel,
  terminologyAttributeLabel,
  terminologyConditionLabel,
  terminologyResourceLabel,
} from "../../registries/terminology";
import { currentConfiguredRulesProfile } from "../../settings/rules-profile-library";
import { applyD6MatchingReward } from "../matching-reward-service";
import {
  freeD6FeatureRollModifier,
  persistFreeD6FeatureRollAudit,
  privacySafeFreeD6FeatureRollResult,
} from "../free-d6-feature-service";
import { matchingDetectorForProfile } from "../../registries/matching-evaluators";
import {
  currentScaleRuntimeStrategy,
  scaleRuntimeStrategy,
  type ScaleRuntimeSide,
  type ScaleRuntimeStrategy,
} from "../../settings/scale";
import { currentFirstEditionGenreProfile } from "../../settings/first-edition-genre-profile";
import {
  currentAttributeRole,
  currentAttributeRuntimeStrategy,
} from "../../settings/attributes";
import {
  booleanSetting,
  currentActionDeclarationAssistance,
  currentDefaultRollMode,
  numberSetting,
  stringSetting,
} from "../../settings/setting-values";
import {
  FIRST_EDITION_OPTION_KEYS,
  SECOND_EDITION_OPTION_KEYS,
  SHARED_SETTING_KEYS,
  TYFUSIUS_HOMEBREW_SETTING_KEYS,
} from "../../settings/settings-catalog";
import { currentOptionalCapabilityRuntime } from "../../settings/optional-capabilities";
import { currentActionEconomyRuntimeStrategy } from "../../settings/action-economy";
import { currentDefenseRuntimeStrategy } from "../../settings/defenses";
import { currentSecondEditionHyperLethalProfile } from "../../settings/hyper-lethal";
import { currentSecondEditionCampaignProfile } from "../../settings/campaign-profile";
import {
  currentMetaCurrencyRuntimeStrategy,
  currentRetryRuntimeStrategy,
  currentSuccessRuntimeStrategy,
  currentWildDieRuntimeStrategy,
} from "../../settings/roll-outcome";
import {
  currentCombinedPipScore,
  currentEffectivePipScore,
} from "../../settings/pip-rules";
import { advancedSkillIssues } from "../skill-module";
import { itemDescriptionExcerpt } from "../item-description";
import { integer, record, stringValue } from "../sheets/values";
import { readCombatantRound } from "../combat-service";
import { d6MvActorPenaltyScore } from "../d6mv-condition-service";
import {
  freeD6ConsequencePenaltyProjection,
  freeD6ConsequenceSuiteActive,
  freeD6FatigueAllowsActions,
} from "../free-d6-consequence-service";
import { clearSecondEditionCombatantFeint } from "../combat-service";
import { readActorEnvironmentEffect } from "../environment-state";
import { extraordinaryPowerMaintenancePenalty } from "../extraordinary-power-state";
import {
  d6System2eDiceAppearance,
  waitForDiceSoNiceRollAnimation,
} from "../dice-so-nice";
import {
  actorHeroPointBalance,
  transactActorHeroPoints,
} from "../hero-point-service";
import {
  openD6CharacterPointSpendLimit,
  readOpenD6RollResources,
  transactOpenD6RollResources,
  validateOpenD6RollResourceRequest,
} from "../open-d6-roll-resource-service";
import { resolveWeaponDamageBase } from "./weapon-damage-base";
import { applyWildTriumphRewards } from "../wild-triumph-reward-service";
import { chatVisibilityForMode } from "./chat-visibility";
import { bindDifficultySuggestionComboboxes } from "./difficulty-combobox";
import { combinedActionBlocksRoll } from "../combined-action-state";
import {
  actorHealthResolutionStrategy,
  currentHealthResolutionStrategy,
  readActorHealth,
} from "../health-runtime";

function activeStrengthAttributeId(): string {
  return currentAttributeRole("strength");
}
import {
  promptWildChoiceDialog,
  requestGmWildChoice,
  requiresGmWildChoice,
  wildDecisionViewModel,
} from "./roll-authority";
import { withAuthorizedMagicPointUpdate } from "../mechanical-edit-guard";
import { readActorPsionics, recordPsionicAttempt } from "../psionics-service";
import {
  canInstallAugmentation,
  cyberpunkModuleActive,
  readActorCyberpunk,
} from "../cyberpunk-service";

interface RollDialogResult {
  readonly advancedSkillItemId?: string;
  readonly target?: {
    readonly attack?: D6WeaponAttackRollContext;
    readonly damageScale?: D6ScaleRollContext;
    readonly outOfRange: boolean;
    readonly scale: D6ScaleRollContext;
  };
  readonly difficulty?: number;
  readonly difficultySelection?: NonNullable<
    D6WeaponAttackRollContext["difficultySelection"]
  >;
  readonly characterPointSpend: number;
  readonly fatePointUse: "active" | "none" | "spend";
  readonly heroPointUse: D6HeroPointUse;
  readonly heroPointSpend: number;
  readonly manualDiceAdjustment: number;
  readonly mapPenaltyDice: number;
  readonly opposition?: D6RollOpposition;
  readonly resultModifier: number;
  readonly rollMode: D6RollMode;
}

interface RollMapDialogContext {
  readonly assistance: ActionDeclarationAssistanceMode;
  readonly initialDice: number;
  readonly trackedDice: number;
}

export interface RollTargetOption {
  readonly actorId: string;
  readonly attackKind?: SecondEditionAttackKind;
  readonly defense?: number;
  readonly defenseKind?: "dodge" | "parry" | "range";
  readonly defenseSourcePage?: 33 | 73 | 94 | 98 | 111 | 180 | 183;
  readonly defenseStrategy?: D6WeaponAttackRollContext["defenseStrategy"];
  readonly damageScale?: D6ScaleRollContext;
  readonly distance?: number;
  readonly feintPenalty?: number;
  readonly id: string;
  readonly hidden?: boolean;
  readonly img: string;
  readonly name: string;
  readonly optionLabel: string;
  readonly outOfRange: boolean;
  readonly purpose: D6ScaleRollApplication;
  readonly rangeBand?: SecondEditionRangeBand;
  readonly rangeLabel: string;
  readonly scale: D6ScaleRollContext;
  readonly selected: boolean;
  readonly srp?: {
    readonly psyche: number;
    readonly ready: number;
    readonly surprised: number;
  };
  readonly vsm?: {
    readonly mobile: number;
    readonly static: number;
  };
  readonly weaponId?: string;
}

export function ordinaryWeaponAttackRollMode(
  requested: D6RollMode,
  targetHidden: boolean,
): D6RollMode {
  return targetHidden && requested !== "blindroll" && requested !== "gmroll"
    ? "gmroll"
    : requested;
}

export interface RollTargetContext {
  readonly hasAuthoritativeTargetDifficulty: boolean;
  readonly hasTargets: boolean;
  readonly purpose: D6ScaleRollApplication;
  readonly showCoverModifier?: boolean;
  readonly showTargetDodging?: boolean;
  readonly showSrpMode?: boolean;
  readonly showVsmMode?: boolean;
  readonly selectedTarget: RollTargetOption | null;
  readonly targets: readonly RollTargetOption[];
}

interface AdvancedSkillContextOption extends D6AdvancedSkillRollContext {
  readonly augmentedScore: number;
  readonly augmentedScoreLabel: string;
  readonly description: string;
  readonly scoreLabel: string;
}

function environmentRollContext(
  target: Pick<FoundryActorDocument, "id" | "name">,
  threat: D6EnvironmentThreat | D6EnvironmentEffectV1,
  action: D6EnvironmentRollContext["action"],
  failureCondition = "none",
): D6EnvironmentRollContext {
  return Object.freeze({
    action,
    difficulty: threat.difficulty,
    failureCondition,
    halfMove: threat.halfMove,
    hazard: threat.hazard,
    penaltyScore: threat.penaltyScore,
    severity: threat.severity,
    sourcePage: threat.sourcePage,
    targetActorId: target.id,
    targetName: target.name,
  });
}

function environmentConditionLabel(value: string): string {
  return isSecondEditionCondition(value)
    ? terminologyConditionLabel(currentTerminology(), value)
    : game.i18n.localize("D6E2.Environment.NoCondition");
}

interface RequestedRollDialog {
  close(): Promise<void>;
}

interface InternalRollInvocationOptions extends D6RollInvocationOptionsV1 {
  readonly automaticResultModifier?: number;
  readonly automaticResultModifierLabel?: string;
  readonly captureRollResult?: (result: D6RollResultV1) => Promise<void> | void;
  readonly captureRollExecution?: (
    result: D6RollResultV1,
    artifacts: readonly FoundryRoll[],
  ) => Promise<void> | void;
  readonly completeBelowOneDieAsFailure?: boolean;
  readonly fixedRollMode?: D6RollMode;
  readonly ignoreActionEconomy?: boolean;
  readonly ignoreTrackedMapPenalty?: boolean;
  readonly ignoreConditionPenalty?: boolean;
  readonly suppressChatMessage?: boolean;
  readonly targetContext?: RollTargetContext;
  readonly captureChatMessage?: (
    message: FoundryChatMessageDocument,
  ) => Promise<void> | void;
}

export interface D6OrdinaryRollInvocationOptions extends D6RollInvocationOptionsV1 {
  /** Internal workflow boundary: numeric-only continuations never inherit the
   * profile's ordinary standalone matching resolution. */
  readonly forceTotalResolution?: true;
}

type WeaponDamageContinuationBase = Omit<
  D6WeaponDamageContinuationRollContext,
  "scale"
>;

interface ExplosiveItemRollOptions extends D6RollInvocationOptionsV1 {
  readonly captureChatMessage?: (
    message: FoundryChatMessageDocument,
  ) => Promise<void> | void;
  readonly explosive?: {
    readonly bypassPlacement: true;
    readonly targetContext?: RollTargetContext;
  };
}

const requestedRollDialogs = new Map<string, RequestedRollDialog>();
const cancelledRequestedRollIds = new Set<string>();

export async function cancelRequestedRollDialog(
  requestId: string,
): Promise<void> {
  cancelledRequestedRollIds.add(requestId);
  const dialog = requestedRollDialogs.get(requestId);
  if (dialog) await dialog.close();
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

function htmlEscape(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

function machineCrewActors(
  machine: FoundryActorDocument,
): readonly FoundryActorDocument[] {
  const members = record(machine.system.crew).members;
  if (!Array.isArray(members)) return Object.freeze([]);
  const seen = new Set<string>();
  return Object.freeze(
    members.flatMap((value) => {
      const actorId = stringValue(record(value).actorId);
      const actor = actorId ? game.actors?.get(actorId) : undefined;
      if (
        !actor ||
        seen.has(actor.id) ||
        !["character", "creature", "npc"].includes(actor.type)
      ) {
        return [];
      }
      seen.add(actor.id);
      return [actor];
    }),
  );
}

function crewGunnery(actor: FoundryActorDocument): {
  readonly attributeId: string;
  readonly itemId: string;
  readonly score: number;
} {
  const skill = actor.items.contents.find(
    (candidate) =>
      candidate.type === "skill" && candidate.system.key === "gunnery",
  );
  const attributeId = skill
    ? stringValue(skill.system.attributeId)
    : "mechanical";
  const attribute = record(record(actor.system.attributes)[attributeId]);
  return {
    attributeId,
    itemId: skill?.id ?? "",
    score: skill
      ? currentCombinedPipScore(
          integer(attribute.score),
          integer(skill.system.score),
        )
      : currentEffectivePipScore(integer(attribute.score)),
  };
}

async function promptMachineCrew(
  machine: FoundryActorDocument,
  crew: readonly FoundryActorDocument[],
): Promise<FoundryActorDocument | null> {
  const available = crew.filter(
    (actor) => game.user?.isGM === true || actor.isOwner === true,
  );
  if (available.length === 0) {
    ui.notifications.warn(game.i18n.localize("D6E2.Machine.NoUsableCrew"));
    return null;
  }
  if (available.length === 1) return available[0] ?? null;
  const options = available
    .map((actor) => {
      const gunnery = crewGunnery(actor);
      return `<option value="${htmlEscape(actor.id)}">${htmlEscape(actor.name)} · ${htmlEscape(formatPipScore(gunnery.score))}</option>`;
    })
    .join("");
  const selected = await foundry.applications.api.DialogV2.wait<string | null>({
    buttons: [
      {
        action: "cancel",
        callback: () => null,
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "select",
        callback: (_event, button) => {
          const control = button.form?.elements.namedItem("crewActorId");
          return control instanceof HTMLSelectElement ? control.value : null;
        },
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-crosshairs",
        label: game.i18n.localize("D6E2.Machine.OperateWeapon"),
      },
    ],
    classes: ["d6e2", "od6roll-dialog", "d6e2-machine-crew-dialog"],
    content: `<div class="od6-dialog-shell">
        <p>${game.i18n.format("D6E2.Machine.SelectGunnerHelp", { machine: htmlEscape(machine.name) })}</p>
        <label>
          <span>${game.i18n.localize("D6E2.Machine.Gunner")}</span>
          <select name="crewActorId">${options}</select>
        </label>
      </div>`,
    modal: true,
    rejectClose: false,
    window: {
      icon: "fa-solid fa-user-astronaut",
      title: game.i18n.localize("D6E2.Machine.SelectGunner"),
    },
  });
  return typeof selected === "string"
    ? (available.find((actor) => actor.id === selected) ?? null)
    : null;
}

async function rollMachineWeaponAttack(
  machine: FoundryActorDocument,
  weapon: FoundryItemDocument,
): Promise<D6RollResultV1 | null> {
  const crew = machineCrewActors(machine);
  if (crew.length === 0) {
    ui.notifications.warn(game.i18n.localize("D6E2.Machine.NoCrew"));
    return null;
  }
  const gunner = await promptMachineCrew(machine, crew);
  if (!gunner) return null;
  const gunnery = crewGunnery(gunner);
  const plan = secondEditionMachineWeaponAttackPlan({
    assignedCrewCount: crew.length,
    crewGunneryScore: gunnery.score,
    kind: machine.type === "starship" ? "starship" : "vehicle",
    minimumCrew: integer(record(machine.system.crew).minimum),
    weaponAttackBonusScore: currentEffectivePipScore(
      integer(weapon.system.attackBonus),
    ),
  });
  return executeActorRoll(gunner, {
    context: {
      machineCrew: {
        assignedCrewCount: plan.assignedCrewCount,
        crewActorId: gunner.id,
        crewName: gunner.name,
        crewPenaltyScore: plan.crewPenaltyScore,
        crewSkillItemId: gunnery.itemId,
        crewSkillScore: plan.crewGunneryScore,
        machineActorId: machine.id,
        machineKind: machine.type === "starship" ? "starship" : "vehicle",
        machineName: machine.name,
        minimumCrew: plan.minimumCrew,
        missingCrewCount: plan.missingCrewCount,
        sourcePage: plan.sourcePage,
        weaponAttackBonusScore: plan.weaponAttackBonusScore,
      },
    },
    kind: "weapon-attack",
    label: `${machine.name} · ${weapon.name} · ${game.i18n.localize("D6E2.Combat.Attack")}`,
    score: plan.score,
    source: {
      actorId: gunner.id,
      actorName: gunner.name,
      attributeId: gunnery.attributeId,
      ...(gunnery.itemId ? { itemId: gunnery.itemId } : {}),
    },
    targetContext: buildWeaponAttackTargetContext(machine, weapon),
  });
}

function inputNumber(form: HTMLFormElement, name: string): number | undefined {
  const control = form.elements.namedItem(name);
  if (!(control instanceof HTMLInputElement) || control.value.trim() === "") {
    return undefined;
  }
  const value = Number.isFinite(control.valueAsNumber)
    ? control.valueAsNumber
    : Number(control.value);
  return Number.isFinite(value) ? Math.trunc(value) : undefined;
}

function selectValue(form: HTMLFormElement, name: string): string {
  const control = form.elements.namedItem(name);
  return control instanceof HTMLSelectElement ||
    control instanceof HTMLInputElement
    ? control.value
    : "";
}

function participantKind(value: string): D6ParticipantKind {
  return value === "player-character" || value === "non-player-character"
    ? value
    : "unknown";
}

interface RuntimeScaleValue {
  readonly side?: ScaleRuntimeSide;
  readonly value: number;
}

function normalizedScaleSide(
  value: unknown,
  magnitude: number,
  inferredLarger: boolean,
): ScaleRuntimeSide {
  if (
    value === "human" ||
    value === "larger" ||
    value === "smaller" ||
    value === "unresolved"
  ) {
    return value;
  }
  if (magnitude === 0) return "human";
  return inferredLarger ? "larger" : "unresolved";
}

function actorScaleValue(
  actor: FoundryActorDocument,
  strategy: ScaleRuntimeStrategy,
): RuntimeScaleValue {
  const raw = integer(actor.system.scale);
  if (strategy.family === "ranked") {
    return Object.freeze({ value: Math.min(6, Math.max(0, raw)) });
  }
  const value = Math.max(0, raw);
  return Object.freeze({
    side: normalizedScaleSide(
      actor.system.scaleSide,
      value,
      actor.type === "vehicle" || actor.type === "starship",
    ),
    value,
  });
}

function attackSourceScaleValue(
  actor: FoundryActorDocument,
  strategy: ScaleRuntimeStrategy,
  weapon?: FoundryItemDocument,
): RuntimeScaleValue {
  const itemValue = weapon ? Math.max(0, integer(weapon.system.scale)) : 0;
  if (itemValue === 0) return actorScaleValue(actor, strategy);
  if (strategy.family === "ranked") {
    return Object.freeze({ value: Math.min(6, itemValue) });
  }
  return Object.freeze({
    side: normalizedScaleSide(
      weapon?.system.scaleSide,
      itemValue,
      weapon?.type === "vehicle-weapon" || weapon?.type === "starship-weapon",
    ),
    value: itemValue,
  });
}

function targetStaticDefense(
  actor: FoundryActorDocument,
  attackKind: SecondEditionAttackKind,
  srpMode: "psyche" | "ready" | "surprised" = "ready",
): number {
  if (actor.type === "vehicle" || actor.type === "starship") {
    const hull = record(record(actor.system.attributes).hull);
    return secondEditionStaticDefense(
      currentEffectivePipScore(integer(hull.score)),
    );
  }
  if (currentDefenseRuntimeStrategy().family === "srp") {
    const attributes = record(actor.system.attributes);
    return d6MvSrp({
      dexterityScore: currentEffectivePipScore(
        integer(record(attributes.agility).score),
      ),
      perceptionScore: currentEffectivePipScore(
        integer(record(attributes.perception).score),
      ),
      willpowerScore: currentEffectivePipScore(
        integer(record(attributes.charm).score),
      ),
    })[srpMode];
  }
  const defenseKind = secondEditionDefenseKind(attackKind);
  const defenses = record(actor.system.defenses);
  const override =
    actor.type === "creature"
      ? integer(
          defenses[defenseKind === "dodge" ? "dodgeOverride" : "parryOverride"],
        )
      : 0;
  const posture =
    record(actor.system.movement).posture === "prone" ? "prone" : "standing";
  const attributeId = defenseKind === "dodge" ? "perception" : "agility";
  const attribute = record(record(actor.system.attributes)[attributeId]);
  const flying = actor.items.contents.find(
    (item) => item.type === "skill" && item.system.key === "flying-zero-g",
  );
  const dodgeBasis =
    defenseKind === "dodge" &&
    currentSecondEditionCampaignProfile().scienceFictionSkills &&
    defenses.dodgeBasis === "flying" &&
    flying
      ? "flying"
      : "perception";
  const agility = record(record(actor.system.attributes).agility);
  const base = secondEditionDefenseForPosture(
    override > 0
      ? override
      : defenseKind === "dodge"
        ? secondEditionDodgeDefense(
            currentEffectivePipScore(integer(attribute.score)),
            currentEffectivePipScore(integer(agility.score)),
            currentEffectivePipScore(integer(flying?.system.score)),
            dodgeBasis,
          )
        : secondEditionStaticDefense(
            currentEffectivePipScore(integer(attribute.score)),
          ),
    attackKind,
    posture,
  );
  const fullDefense = readCombatantRound(actor)?.secondEditionFullDefense;
  return (
    base +
    (fullDefense === undefined
      ? 0
      : defenseKind === "dodge"
        ? fullDefense.acrobaticsBonus
        : fullDefense.meleeBonus)
  );
}

function activeFeintAgainst(
  targetActorId: string,
  targetTokenId: string,
): { readonly actor: FoundryActorDocument; readonly penalty: number } | null {
  const combat = (
    game as FoundryGame & {
      readonly combat?: {
        readonly combatants?: {
          readonly contents?: readonly {
            readonly actor?: FoundryActorDocument | null;
          }[];
        };
      };
    }
  ).combat;
  for (const combatant of combat?.combatants?.contents ?? []) {
    const source = combatant.actor;
    if (!source) continue;
    const feint = readCombatantRound(source)?.secondEditionFeint;
    if (
      feint?.targetActorId === targetActorId &&
      (!feint.targetTokenId?.length || feint.targetTokenId === targetTokenId)
    ) {
      return { actor: source, penalty: feint.defensePenalty };
    }
  }
  return null;
}

function gridDistance(
  source: FoundryTokenPlaceable,
  target: FoundryTokenPlaceable,
): number | undefined {
  if (!source.center || !target.center || !canvas.grid) return undefined;
  const measured = canvas.grid.measurePath([source.center, target.center]);
  return Number.isFinite(measured.distance)
    ? Math.max(0, Math.floor(measured.distance))
    : undefined;
}

function rangeLabel(
  band: SecondEditionRangeBand | undefined,
  outOfRange: boolean,
): string {
  if (outOfRange) return game.i18n.localize("D6E2.Combat.Range.OutOfRange");
  if (!band) return game.i18n.localize("D6E2.Combat.RangeUnmeasured");
  return game.i18n.localize(
    band === "melee"
      ? "D6E2.Combat.Range.Melee"
      : band === "point-blank"
        ? "D6E2.Combat.Range.PointBlank"
        : band === "short"
          ? "D6E2.Combat.Range.Short"
          : band === "medium"
            ? "D6E2.Combat.Range.Medium"
            : "D6E2.Combat.Range.Long",
  );
}

export function weaponTargetDifficultyPreview(input: {
  readonly coverModifier?: number | undefined;
  readonly defense?: number | undefined;
  readonly defenseStrategy?: string | undefined;
  readonly outOfRange?: boolean | undefined;
  readonly rangeBand?: string | undefined;
  readonly targetDodging?: boolean | undefined;
}): number | undefined {
  if (input.outOfRange === true || !Number.isFinite(input.defense)) {
    return undefined;
  }
  const rangedBand =
    input.rangeBand === "point-blank" ||
    input.rangeBand === "short" ||
    input.rangeBand === "medium" ||
    input.rangeBand === "long"
      ? input.rangeBand
      : undefined;
  const rangeDefense =
    input.defenseStrategy === "fixed-range" && rangedBand !== undefined
      ? secondEditionNoDodgeDefensePlan(
          rangedBand,
          input.targetDodging === true,
        ).defense
      : input.defenseStrategy === "grenade-targeting" &&
          rangedBand !== undefined
        ? firstEditionGrenadeTargetingDifficulty(rangedBand)
        : input.defense;
  return secondEditionCoverDefensePlan(
    rangeDefense ?? 0,
    Math.max(0, Math.trunc(input.coverModifier ?? 0)),
  ).defense;
}

export function weaponTargetDifficultyControlState(input: {
  readonly currentValue: string;
  readonly difficultySource?: "calculated" | "custom" | undefined;
  readonly manualDifficulty?: string | undefined;
  readonly targetDifficulty?: number | undefined;
  readonly wasTargetControlled: boolean;
}): {
  readonly difficultySource?: "calculated" | "custom" | undefined;
  readonly manualDifficulty?: string | undefined;
  readonly readOnly: boolean;
  readonly targetControlled: boolean;
  readonly value: string;
} {
  if (Number.isFinite(input.targetDifficulty)) {
    const entered = Number(input.currentValue);
    const custom =
      input.difficultySource === "custom" &&
      input.currentValue.trim().length > 0 &&
      Number.isFinite(entered);
    return Object.freeze({
      difficultySource: custom ? "custom" : "calculated",
      manualDifficulty: input.wasTargetControlled
        ? (input.manualDifficulty ?? "")
        : input.currentValue,
      readOnly: false,
      targetControlled: true,
      value: custom
        ? String(Math.trunc(entered))
        : String(Math.trunc(input.targetDifficulty ?? 0)),
    });
  }
  return Object.freeze({
    readOnly: false,
    targetControlled: false,
    value: input.wasTargetControlled
      ? (input.manualDifficulty ?? "")
      : input.currentValue,
  });
}

export function weaponAttackDifficultySelection(input: {
  readonly customDifficulty?: number | undefined;
  readonly customSelected: boolean;
  readonly targetDifficulty?: number | undefined;
}): NonNullable<D6WeaponAttackRollContext["difficultySelection"]> | undefined {
  if (!Number.isFinite(input.targetDifficulty)) return undefined;
  const calculatedValue = Math.trunc(input.targetDifficulty ?? 0);
  return Object.freeze({
    calculatedValue,
    source:
      input.customSelected && Number.isFinite(input.customDifficulty)
        ? "custom"
        : "calculated",
    value:
      input.customSelected && Number.isFinite(input.customDifficulty)
        ? Math.trunc(input.customDifficulty ?? 0)
        : calculatedValue,
  });
}

export function buildWeaponAttackTargetContext(
  actor: FoundryActorDocument,
  weapon: FoundryItemDocument,
  purpose: "attack" | "damage" = "attack",
  preferredTarget?: Pick<
    D6WeaponAttackRollContext,
    "targetActorId" | "targetTokenId"
  >,
): RollTargetContext {
  const defenseStrategy = currentDefenseRuntimeStrategy();
  const scaleStrategy = currentScaleRuntimeStrategy();
  const thrownExplosive =
    weapon.type === "weapon" &&
    stringValue(weapon.system.weaponKind) === "thrown-explosive";
  const firstEditionThrownExplosive =
    defenseStrategy.family === "active" && thrownExplosive;
  const firstEditionGrenade =
    purpose === "attack" && firstEditionThrownExplosive;
  const secondEditionThrownExplosive =
    (defenseStrategy.family === "static" ||
      defenseStrategy.family === "range") &&
    thrownExplosive;
  const manualDefenseTarget =
    purpose === "attack" &&
    defenseStrategy.targeting === "manual" &&
    !firstEditionGrenade;
  const range = record(weapon.system.range);
  const printedRanges = {
    long: integer(range.long),
    medium: integer(range.medium),
    short: integer(range.short),
    shortMinimum: integer(range.shortMinimum),
  };
  const strength = record(
    record(actor.system.attributes)[activeStrengthAttributeId()],
  );
  const ranges =
    firstEditionThrownExplosive &&
    booleanSetting(
      TYFUSIUS_HOMEBREW_SETTING_KEYS.firstEditionStrengthGrenadeRanges,
      false,
    )
      ? firstEditionStrengthAdjustedThrowRanges(
          printedRanges,
          currentEffectivePipScore(integer(strength.score)),
        )
      : secondEditionThrownExplosive &&
          booleanSetting(
            TYFUSIUS_HOMEBREW_SETTING_KEYS.secondEditionBrawnGrenadeRanges,
            false,
          )
        ? secondEditionBrawnAdjustedThrowRanges(
            printedRanges,
            currentEffectivePipScore(integer(strength.score)),
          )
        : printedRanges;
  const attackKind =
    firstEditionGrenade || secondEditionThrownExplosive
      ? ("ranged" as const)
      : secondEditionWeaponAttackKind(ranges);
  const defenseKind = secondEditionDefenseKind(attackKind);
  const sourceScale = attackSourceScaleValue(actor, scaleStrategy, weapon);
  const sourceRank = sourceScale.value;
  const sceneTokens = canvas.tokens?.placeables ?? [];
  const sourceTokens = actor.getActiveTokens?.() ?? [];
  const sourceIds = new Set(sourceTokens.map((token) => token.id));
  const sourceToken =
    sourceTokens.find((token) => token.controlled && token.center) ??
    sourceTokens.find((token) => token.center) ??
    sceneTokens.find((token) => token.actor?.id === actor.id && token.center);
  const selectedIds = new Set(
    preferredTarget?.targetTokenId
      ? [preferredTarget.targetTokenId]
      : Array.from(game.user?.targets ?? [], (token) => token.id),
  );
  const targets = sceneTokens
    .flatMap<RollTargetOption>((token) => {
      const targetActor = token.actor;
      const name = token.name?.trim() ?? targetActor?.name.trim() ?? "";
      if (
        !targetActor ||
        !name ||
        token.isPreview === true ||
        token.visible === false ||
        sourceIds.has(token.id) ||
        targetActor.id === actor.id ||
        !["character", "creature", "npc", "starship", "vehicle"].includes(
          targetActor.type,
        )
      ) {
        return [];
      }
      const targetScale = actorScaleValue(targetActor, scaleStrategy);
      const targetRank = targetScale.value;
      const machineTarget =
        targetActor.type === "vehicle" || targetActor.type === "starship";
      const scale = scaleStrategy.interaction(
        sourceRank,
        targetRank,
        sourceScale.side,
        targetScale.side,
      );
      const distance =
        sourceToken === undefined
          ? undefined
          : gridDistance(sourceToken, token);
      const resolution =
        distance === undefined
          ? undefined
          : firstEditionGrenade
            ? firstEditionExplosiveRangeForDistance(distance, ranges)
            : secondEditionThrownExplosive
              ? secondEditionExplosiveRangeForDistance(distance, ranges)
              : secondEditionRangeForDistance(
                  distance,
                  ranges,
                  canvas.scene?.grid?.distance ?? 1,
                );
      const resolvedRangeBand =
        resolution?.band === null ? undefined : resolution?.band;
      const noDodgeTarget =
        purpose === "attack" &&
        attackKind === "ranged" &&
        !machineTarget &&
        defenseStrategy.targeting === "fixed-range";
      const grenadeTarget = firstEditionGrenade;
      const rangeBand =
        (noDodgeTarget || (manualDefenseTarget && attackKind === "ranged")) &&
        resolvedRangeBand === "short" &&
        distance !== undefined &&
        distance <=
          (manualDefenseTarget ? 3 : (canvas.scene?.grid?.distance ?? 1))
          ? "point-blank"
          : resolvedRangeBand;
      const fixedRangeDefense =
        (noDodgeTarget || grenadeTarget) &&
        rangeBand !== undefined &&
        rangeBand !== "melee"
          ? grenadeTarget
            ? firstEditionGrenadeTargetingDifficulty(rangeBand)
            : secondEditionNoDodgeDefensePlan(rangeBand).defense
          : undefined;
      const completedActiveDefense = manualDefenseTarget
        ? readCombatantRound(targetActor)?.firstEditionActiveDefense
        : undefined;
      const applicableActiveDefense =
        attackKind === "ranged" && completedActiveDefense?.kind === "dodge"
          ? completedActiveDefense
          : undefined;
      const firstEditionRangePlan =
        manualDefenseTarget &&
        attackKind === "ranged" &&
        rangeBand !== undefined &&
        rangeBand !== "melee" &&
        resolution?.outOfRange !== true
          ? firstEditionRangedCombatDifficultyPlan(
              rangeBand,
              applicableActiveDefense?.difficulty,
            )
          : undefined;
      const feint =
        purpose === "attack" && !manualDefenseTarget
          ? activeFeintAgainst(targetActor.id, token.id)
          : null;
      const tokenDocument = token.document as
        (typeof token.document & { readonly hidden?: boolean }) | undefined;
      const tokenImage = tokenDocument?.texture?.src?.trim() ?? "";
      const hidden = tokenDocument?.hidden === true;
      const actorImage = targetActor.img.trim();
      const resolvedRangeLabel = rangeLabel(
        rangeBand,
        resolution?.outOfRange === true,
      );
      const targetType = targetActor.type as
        "character" | "creature" | "npc" | "starship" | "vehicle";
      const targetTypeLabel = terminologyActorLabel(
        currentTerminology(),
        targetType,
        "singular",
        game.i18n.localize(`TYPES.Actor.${targetType}`),
      );
      const optionLabel = `${name} · ${targetTypeLabel} · ${resolvedRangeLabel}${
        distance === undefined
          ? ""
          : ` · ${distance} ${game.i18n.localize("D6E2.Combat.Meters")}`
      }`;
      const targetAttributes = record(targetActor.system.attributes);
      const srp =
        defenseStrategy.family === "srp" && !machineTarget
          ? (() => {
              const defense = d6MvSrp({
                dexterityScore: currentEffectivePipScore(
                  integer(record(targetAttributes.agility).score),
                ),
                perceptionScore: currentEffectivePipScore(
                  integer(record(targetAttributes.perception).score),
                ),
                willpowerScore: currentEffectivePipScore(
                  integer(record(targetAttributes.charm).score),
                ),
              });
              const rangeDifficulty =
                attackKind === "ranged" &&
                rangeBand !== undefined &&
                rangeBand !== "melee"
                  ? secondEditionNoDodgeDefensePlan(rangeBand).defense
                  : 0;
              return Object.freeze({
                psyche: Math.max(0, rangeDifficulty + defense.psyche),
                ready: Math.max(0, rangeDifficulty + defense.ready),
                surprised: Math.max(0, rangeDifficulty + defense.surprised),
              });
            })()
          : undefined;
      const vsm =
        defenseStrategy.family === "srp" && machineTarget
          ? (() => {
              const scale = targetScale.value === 2 ? "grand" : "vehicle";
              const defense = d6MvVsm({
                frameScore: currentEffectivePipScore(
                  integer(record(targetAttributes.hull).score),
                ),
                maneuverabilityScore: currentEffectivePipScore(
                  integer(record(targetAttributes.maneuverability).score),
                ),
                scale,
              });
              const rangeDifficulty =
                attackKind === "ranged" &&
                rangeBand !== undefined &&
                rangeBand !== "melee"
                  ? secondEditionNoDodgeDefensePlan(rangeBand).defense
                  : 0;
              return Object.freeze({
                mobile: Math.max(0, rangeDifficulty + defense.mobile),
                static: Math.max(0, rangeDifficulty + defense.static),
              });
            })()
          : undefined;
      const scaleContext: D6ScaleRollContext = Object.freeze({
        application: purpose,
        family: scaleStrategy.family,
        modifierScore: grenadeTarget
          ? 0
          : purpose === "damage"
            ? scale.attackerDamageBonusScore
            : scale.attackerAttackBonusScore,
        sourcePage: scaleStrategy.sourcePage,
        sourceActorId: actor.id,
        sourceName: actor.name,
        sourceRank,
        ...(sourceScale.side === undefined
          ? {}
          : { sourceSide: sourceScale.side }),
        ...(sourceToken === undefined ? {} : { sourceTokenId: sourceToken.id }),
        targetActorId: targetActor.id,
        targetName: name,
        targetRank,
        ...(targetScale.side === undefined
          ? {}
          : { targetSide: targetScale.side }),
        targetTokenId: token.id,
        strategyId: scaleStrategy.id,
        ...(purpose === "damage" && scale.sourceDamageMultiplier !== undefined
          ? { totalMultiplier: scale.sourceDamageMultiplier }
          : {}),
        ...(scale.resolved === false ? { resolved: false } : {}),
      });
      const damageScaleContext: D6ScaleRollContext = Object.freeze({
        ...scaleContext,
        application: "damage",
        modifierScore: grenadeTarget ? 0 : scale.attackerDamageBonusScore,
        ...(scale.sourceDamageMultiplier === undefined
          ? {}
          : { totalMultiplier: scale.sourceDamageMultiplier }),
      });
      return [
        Object.freeze({
          actorId: targetActor.id,
          ...(purpose === "attack" &&
          (!manualDefenseTarget || firstEditionRangePlan !== undefined)
            ? {
                attackKind,
                defense: Math.max(
                  0,
                  (firstEditionRangePlan !== undefined
                    ? firstEditionRangePlan.defense
                    : noDodgeTarget || grenadeTarget
                      ? (fixedRangeDefense ?? 0)
                      : (srp?.ready ??
                          vsm?.static ??
                          targetStaticDefense(targetActor, attackKind)) +
                        (attackKind === "ranged"
                          ? scale.targetDodgeBonus
                          : 0)) - (feint?.penalty ?? 0),
                ),
                defenseKind:
                  firstEditionRangePlan !== undefined
                    ? applicableActiveDefense === undefined
                      ? "range"
                      : "dodge"
                    : noDodgeTarget || grenadeTarget
                      ? "range"
                      : defenseKind,
                defenseSourcePage: firstEditionRangePlan
                  ? 73
                  : grenadeTarget
                    ? 111
                    : noDodgeTarget
                      ? 94
                      : machineTarget
                        ? vsm !== undefined
                          ? 98
                          : targetActor.type === "starship"
                            ? 183
                            : 180
                        : 33,
                defenseStrategy: firstEditionRangePlan
                  ? applicableActiveDefense === undefined
                    ? "first-edition-range"
                    : "first-edition-active-defense"
                  : grenadeTarget
                    ? "grenade-targeting"
                    : srp !== undefined
                      ? "d6mv-srp"
                      : vsm !== undefined
                        ? "d6mv-vsm"
                        : noDodgeTarget
                          ? "fixed-range"
                          : machineTarget
                            ? "machine-defense"
                            : attackKind === "ranged"
                              ? "static-dodge"
                              : "static-parry",
                ...(feint === null ? {} : { feintPenalty: feint.penalty }),
              }
            : {}),
          ...(distance === undefined ? {} : { distance }),
          damageScale: damageScaleContext,
          id: token.id,
          hidden,
          img: tokenImage.length > 0 ? tokenImage : actorImage,
          name,
          optionLabel,
          outOfRange:
            purpose === "attack" &&
            (resolution?.outOfRange === true ||
              ((noDodgeTarget || grenadeTarget) && resolution === undefined)),
          purpose,
          ...(rangeBand === undefined ? {} : { rangeBand }),
          rangeLabel: resolvedRangeLabel,
          scale: scaleContext,
          selected:
            selectedIds.has(token.id) ||
            (preferredTarget?.targetTokenId === undefined &&
              preferredTarget?.targetActorId === targetActor.id),
          ...(srp === undefined ? {} : { srp }),
          ...(vsm === undefined ? {} : { vsm }),
          weaponId: weapon.id,
        }),
      ];
    })
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
  const selectedTarget = targets.find((target) => target.selected) ?? null;
  return Object.freeze({
    hasAuthoritativeTargetDifficulty: targets.some(
      (target) => target.defense !== undefined,
    ),
    hasTargets: targets.length > 0,
    purpose,
    selectedTarget,
    showSrpMode:
      defenseStrategy.family === "srp" &&
      purpose === "attack" &&
      targets.some((target) => target.srp !== undefined),
    showVsmMode:
      defenseStrategy.family === "srp" &&
      purpose === "attack" &&
      targets.some((target) => target.vsm !== undefined),
    showCoverModifier:
      purpose === "attack" &&
      attackKind === "ranged" &&
      !firstEditionGrenade &&
      !manualDefenseTarget,
    showTargetDodging:
      purpose === "attack" &&
      attackKind === "ranged" &&
      defenseStrategy.targeting === "fixed-range",
    targets: Object.freeze(targets),
  });
}

export function buildResistanceSourceContext(
  actor: FoundryActorDocument,
  preferredSource?: D6ScaleRollContext,
): RollTargetContext {
  const activeScaleStrategy = currentScaleRuntimeStrategy();
  const sceneTokens = canvas.tokens?.placeables ?? [];
  const sourceTokens = actor.getActiveTokens?.() ?? [];
  const sourceIds = new Set(sourceTokens.map((token) => token.id));
  const selectedIds = new Set(
    preferredSource?.sourceTokenId
      ? [preferredSource.sourceTokenId]
      : Array.from(game.user?.targets ?? [], (token) => token.id),
  );
  const targetScale = actorScaleValue(actor, activeScaleStrategy);
  const targetRank = targetScale.value;
  const targetToken =
    sourceTokens.find((token) => token.controlled) ?? sourceTokens[0];
  const sceneTargets = sceneTokens
    .flatMap<RollTargetOption>((token) => {
      const sourceActor = token.actor;
      const name = token.name?.trim() ?? sourceActor?.name.trim() ?? "";
      if (
        !sourceActor ||
        !name ||
        token.isPreview === true ||
        token.visible === false ||
        sourceIds.has(token.id) ||
        sourceActor.id === actor.id
      ) {
        return [];
      }
      const sourceScale = actorScaleValue(sourceActor, activeScaleStrategy);
      const sourceRank = sourceScale.value;
      const scale = activeScaleStrategy.interaction(
        sourceRank,
        targetRank,
        sourceScale.side,
        targetScale.side,
      );
      const tokenImage = token.document?.texture?.src?.trim() ?? "";
      const actorImage = sourceActor.img.trim();
      return [
        Object.freeze({
          actorId: sourceActor.id,
          id: token.id,
          img: tokenImage.length > 0 ? tokenImage : actorImage,
          name,
          optionLabel: name,
          outOfRange: false,
          purpose: "resistance" as const,
          rangeLabel: "",
          scale: Object.freeze({
            application: "resistance" as const,
            family: activeScaleStrategy.family,
            modifierScore: scale.targetResistanceBonusScore,
            sourcePage: activeScaleStrategy.sourcePage,
            sourceActorId: sourceActor.id,
            sourceName: name,
            sourceRank,
            ...(sourceScale.side === undefined
              ? {}
              : { sourceSide: sourceScale.side }),
            sourceTokenId: token.id,
            targetActorId: actor.id,
            targetName: actor.name,
            targetRank,
            ...(targetScale.side === undefined
              ? {}
              : { targetSide: targetScale.side }),
            strategyId: activeScaleStrategy.id,
            ...(scale.targetResistanceMultiplier === undefined
              ? {}
              : { totalMultiplier: scale.targetResistanceMultiplier }),
            ...(scale.resolved === false ? { resolved: false } : {}),
            ...(targetToken === undefined
              ? {}
              : { targetTokenId: targetToken.id }),
          }),
          selected:
            preferredSource === undefined
              ? selectedIds.has(token.id)
              : sourceActor.id === preferredSource.sourceActorId &&
                (preferredSource.sourceTokenId === undefined ||
                  token.id === preferredSource.sourceTokenId),
        }),
      ];
    })
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
  const preferredTarget = sceneTargets.find((target) => target.selected);
  const preferredActor =
    preferredSource === undefined
      ? undefined
      : game.actors?.get(preferredSource.sourceActorId);
  const preferredScaleStrategy = scaleRuntimeStrategy(
    preferredSource?.strategyId,
  );
  const preferredScale =
    preferredSource === undefined
      ? undefined
      : preferredScaleStrategy.interaction(
          preferredSource.sourceRank,
          preferredSource.targetRank,
          preferredSource.sourceSide,
          preferredSource.targetSide,
        );
  const targets =
    preferredSource === undefined || preferredTarget !== undefined
      ? sceneTargets
      : [
          ...sceneTargets,
          Object.freeze({
            actorId: preferredSource.sourceActorId,
            id:
              preferredSource.sourceTokenId ??
              `actor:${preferredSource.sourceActorId}`,
            img: preferredActor?.img.trim() ?? "",
            name:
              preferredSource.sourceName.trim().length > 0
                ? preferredSource.sourceName
                : (preferredActor?.name ??
                  game.i18n.localize("D6E2.Combat.Damage.OriginalSource")),
            optionLabel:
              preferredSource.sourceName.trim().length > 0
                ? preferredSource.sourceName
                : (preferredActor?.name ??
                  game.i18n.localize("D6E2.Combat.Damage.OriginalSource")),
            outOfRange: false,
            purpose: "resistance" as const,
            rangeLabel: "",
            scale: Object.freeze({
              application: "resistance" as const,
              family: preferredScaleStrategy.family,
              modifierScore: preferredScale?.targetResistanceBonusScore ?? 0,
              sourcePage: preferredScaleStrategy.sourcePage,
              sourceActorId: preferredSource.sourceActorId,
              sourceName: preferredSource.sourceName,
              sourceRank: preferredSource.sourceRank,
              ...(preferredSource.sourceSide === undefined
                ? {}
                : { sourceSide: preferredSource.sourceSide }),
              ...(preferredSource.sourceTokenId === undefined
                ? {}
                : { sourceTokenId: preferredSource.sourceTokenId }),
              targetActorId: actor.id,
              targetName: actor.name,
              targetRank: preferredSource.targetRank,
              ...(preferredSource.targetSide === undefined
                ? {}
                : { targetSide: preferredSource.targetSide }),
              strategyId: preferredScaleStrategy.id,
              ...(preferredScale?.targetResistanceMultiplier === undefined
                ? {}
                : {
                    totalMultiplier: preferredScale.targetResistanceMultiplier,
                  }),
              ...(preferredScale?.resolved === false
                ? { resolved: false }
                : {}),
              ...(targetToken === undefined
                ? {}
                : { targetTokenId: targetToken.id }),
            }),
            selected: true,
          }),
        ];
  const selectedTarget = targets.find((target) => target.selected) ?? null;
  return Object.freeze({
    hasAuthoritativeTargetDifficulty: false,
    hasTargets: targets.length > 0,
    purpose: "resistance",
    selectedTarget,
    targets: Object.freeze(targets),
  });
}

function selectedRollTarget(form: HTMLFormElement): RollDialogResult["target"] {
  const control = form.elements.namedItem("targetId");
  if (!(control instanceof HTMLSelectElement) || control.value.length === 0) {
    return undefined;
  }
  const option = control.selectedOptions[0];
  if (!option) return undefined;
  const srpModeValue = selectValue(form, "d6mvSrpMode");
  const d6mvSrpMode =
    srpModeValue === "surprised" || srpModeValue === "psyche"
      ? srpModeValue
      : "ready";
  const srpDataKey =
    `srp${d6mvSrpMode[0]?.toUpperCase()}${d6mvSrpMode.slice(1)}` as
      "srpPsyche" | "srpReady" | "srpSurprised";
  const srpDefense = option.dataset[srpDataKey];
  const vsmMode =
    selectValue(form, "d6mvVsmMode") === "mobile" ? "mobile" : "static";
  const vsmDataKey = vsmMode === "mobile" ? "vsmMobile" : "vsmStatic";
  const vsmDefense = option.dataset[vsmDataKey];
  const defenseValue =
    option.dataset.defenseStrategy === "d6mv-srp" && srpDefense
      ? srpDefense
      : option.dataset.defenseStrategy === "d6mv-vsm" && vsmDefense
        ? vsmDefense
        : (option.dataset.defense?.trim() ?? "");
  const defense = defenseValue.length > 0 ? Number(defenseValue) : NaN;
  const hasAuthoritativeDefense = Number.isFinite(defense);
  const distanceValue = option.dataset.distance?.trim() ?? "";
  const distance = distanceValue.length > 0 ? Number(distanceValue) : NaN;
  const attackKind = option.dataset.attackKind === "melee" ? "melee" : "ranged";
  const defenseStrategy = option.dataset.defenseStrategy;
  const selectedRangeBand = option.dataset.rangeBand;
  const targetDodging = inputChecked(form, "targetDodging");
  const fixedRangePlan =
    defenseStrategy === "fixed-range" &&
    (selectedRangeBand === "point-blank" ||
      selectedRangeBand === "short" ||
      selectedRangeBand === "medium" ||
      selectedRangeBand === "long")
      ? secondEditionNoDodgeDefensePlan(selectedRangeBand, targetDodging)
      : undefined;
  const grenadeTargetingDifficulty =
    defenseStrategy === "grenade-targeting" &&
    (selectedRangeBand === "point-blank" ||
      selectedRangeBand === "short" ||
      selectedRangeBand === "medium" ||
      selectedRangeBand === "long")
      ? firstEditionGrenadeTargetingDifficulty(selectedRangeBand)
      : undefined;
  const coverDefense = hasAuthoritativeDefense
    ? secondEditionCoverDefensePlan(
        grenadeTargetingDifficulty ?? fixedRangePlan?.defense ?? defense,
        attackKind === "ranged"
          ? (inputNumber(form, "coverDefenseModifier") ?? 0)
          : 0,
      )
    : undefined;
  const rangeBand = option.dataset.rangeBand;
  const purpose =
    option.dataset.scaleApplication === "damage" ||
    option.dataset.scaleApplication === "resistance"
      ? option.dataset.scaleApplication
      : "attack";
  const modifierScore = Math.max(
    0,
    Math.trunc(Number(option.dataset.scaleModifier) || 0),
  );
  const scaleFamily =
    option.dataset.scaleFamily === "scalar" ? "scalar" : "ranked";
  const sourceRank = Math.max(
    0,
    scaleFamily === "ranked"
      ? Math.min(6, Math.trunc(Number(option.dataset.sourceScale) || 0))
      : Math.trunc(Number(option.dataset.sourceScale) || 0),
  );
  const targetRank = Math.max(
    0,
    scaleFamily === "ranked"
      ? Math.min(6, Math.trunc(Number(option.dataset.targetScale) || 0))
      : Math.trunc(Number(option.dataset.targetScale) || 0),
  );
  const sourceSide = normalizedScaleSide(
    option.dataset.sourceScaleSide,
    sourceRank,
    false,
  );
  const targetSide = normalizedScaleSide(
    option.dataset.targetScaleSide,
    targetRank,
    false,
  );
  const targetActorId = option.dataset.actorId ?? "";
  const targetHidden = option.dataset.hidden === "true";
  const targetName = option.dataset.name ?? "";
  const targetTokenId = option.value;
  const damageScaleFamily =
    option.dataset.damageScaleFamily === "scalar" ? "scalar" : "ranked";
  const damageSourceRank = Math.max(
    0,
    Math.trunc(Number(option.dataset.damageScaleSourceRank) || 0),
  );
  const damageTargetRank = Math.max(
    0,
    Math.trunc(Number(option.dataset.damageScaleTargetRank) || 0),
  );
  const damageScale: D6ScaleRollContext | undefined =
    option.dataset.damageScaleApplication === "damage"
      ? {
          application: "damage",
          family: damageScaleFamily,
          modifierScore: Math.max(
            0,
            Math.trunc(Number(option.dataset.damageScaleModifier) || 0),
          ),
          ...(option.dataset.damageScaleResolved === "false"
            ? { resolved: false }
            : {}),
          sourceActorId: option.dataset.damageScaleSourceActorId ?? "",
          sourceName: option.dataset.damageScaleSourceName ?? "",
          sourcePage: Math.max(
            0,
            Math.trunc(Number(option.dataset.damageScaleSourcePage) || 196),
          ),
          sourceRank: damageSourceRank,
          ...(damageScaleFamily === "scalar"
            ? {
                sourceSide: normalizedScaleSide(
                  option.dataset.damageScaleSourceSide,
                  damageSourceRank,
                  false,
                ),
              }
            : {}),
          ...(option.dataset.damageScaleSourceTokenId
            ? { sourceTokenId: option.dataset.damageScaleSourceTokenId }
            : {}),
          targetActorId: option.dataset.damageScaleTargetActorId ?? "",
          targetName: option.dataset.damageScaleTargetName ?? "",
          targetRank: damageTargetRank,
          ...(damageScaleFamily === "scalar"
            ? {
                targetSide: normalizedScaleSide(
                  option.dataset.damageScaleTargetSide,
                  damageTargetRank,
                  false,
                ),
              }
            : {}),
          ...(option.dataset.damageScaleStrategyId
            ? { strategyId: option.dataset.damageScaleStrategyId }
            : {}),
          ...(option.dataset.damageScaleTargetTokenId
            ? { targetTokenId: option.dataset.damageScaleTargetTokenId }
            : {}),
        }
      : undefined;
  return {
    ...(purpose === "attack" && coverDefense !== undefined
      ? {
          attack: {
            attackKind,
            baseDefense: coverDefense.baseDefense,
            coverModifier: coverDefense.coverModifier,
            coverSourcePage: 30,
            defense: coverDefense.defense,
            defenseKind:
              option.dataset.defenseKind === "range"
                ? "range"
                : attackKind === "ranged"
                  ? "dodge"
                  : "parry",
            defenseSourcePage: Math.trunc(
              Number(option.dataset.defenseSourcePage),
            ) as 33 | 73 | 94 | 98 | 111 | 180 | 183,
            defenseStrategy:
              defenseStrategy === "first-edition-active-defense" ||
              defenseStrategy === "first-edition-range" ||
              defenseStrategy === "fixed-range" ||
              defenseStrategy === "grenade-targeting" ||
              defenseStrategy === "machine-defense" ||
              defenseStrategy === "d6mv-srp" ||
              defenseStrategy === "d6mv-vsm" ||
              defenseStrategy === "static-dodge" ||
              defenseStrategy === "static-parry"
                ? defenseStrategy
                : attackKind === "ranged"
                  ? "static-dodge"
                  : "static-parry",
            ...(defenseStrategy === "d6mv-srp" ? { d6mvSrpMode } : {}),
            ...(defenseStrategy === "d6mv-vsm" ? { d6mvVsmMode: vsmMode } : {}),
            ...(Number(option.dataset.feintPenalty) > 0
              ? {
                  feintPenalty: Math.trunc(Number(option.dataset.feintPenalty)),
                }
              : {}),
            ...(Number.isFinite(distance)
              ? { distance: Math.max(0, distance) }
              : {}),
            ...(rangeBand === "melee" ||
            rangeBand === "point-blank" ||
            rangeBand === "short" ||
            rangeBand === "medium" ||
            rangeBand === "long"
              ? { rangeBand }
              : {}),
            targetActorId,
            ...(targetHidden ? { targetHidden: true } : {}),
            ...(fixedRangePlan?.targetDodging === true
              ? { targetDodging: true }
              : {}),
            targetName,
            targetTokenId,
            weaponId: option.dataset.weaponId ?? "",
          },
        }
      : {}),
    ...(damageScale === undefined ? {} : { damageScale }),
    outOfRange: option.dataset.outOfRange === "true",
    scale: {
      application: purpose,
      family: scaleFamily,
      modifierScore,
      ...(option.dataset.scaleResolved === "false" ? { resolved: false } : {}),
      sourcePage: Math.max(
        0,
        Math.trunc(Number(option.dataset.scaleSourcePage) || 196),
      ),
      sourceActorId: option.dataset.scaleSourceActorId ?? "",
      sourceName: option.dataset.scaleSourceName ?? "",
      sourceRank,
      ...(scaleFamily === "scalar" ? { sourceSide } : {}),
      ...(option.dataset.scaleSourceTokenId
        ? { sourceTokenId: option.dataset.scaleSourceTokenId }
        : {}),
      targetActorId:
        purpose === "resistance"
          ? (option.dataset.scaleTargetActorId ?? "")
          : targetActorId,
      targetName:
        purpose === "resistance"
          ? (option.dataset.scaleTargetName ?? "")
          : targetName,
      targetRank,
      ...(scaleFamily === "scalar" ? { targetSide } : {}),
      ...(option.dataset.scaleStrategyId
        ? { strategyId: option.dataset.scaleStrategyId }
        : {}),
      ...(option.dataset.scaleTargetTokenId
        ? { targetTokenId: option.dataset.scaleTargetTokenId }
        : {}),
    },
  };
}

export function synchronizeCombatRollTarget(targetId: string): void {
  canvas.tokens?.setTargets(targetId.length > 0 ? [targetId] : [], {
    mode: "replace",
  });
}

function updateRollPreview(dialog: { readonly element: HTMLElement }): void {
  const shell = dialog.element.querySelector<HTMLElement>(".od6roll-shell");
  const advancedSelect = dialog.element.querySelector<HTMLSelectElement>(
    'select[name="advancedSkillItemId"]',
  );
  const selectedAdvancedSkillItemId =
    advancedSelect?.dataset.selectedItemId ?? "";
  if (advancedSelect && selectedAdvancedSkillItemId.length > 0) {
    advancedSelect.value = selectedAdvancedSkillItemId;
    delete advancedSelect.dataset.selectedItemId;
  }
  const rollDescription = dialog.element.querySelector<HTMLElement>(
    "[data-roll-description]",
  );
  if (rollDescription) {
    const selectedDescription =
      advancedSelect?.value.length && advancedSelect.selectedOptions[0]
        ? (advancedSelect.selectedOptions[0].dataset.description ?? "")
        : (rollDescription.dataset.baseDescription ?? "");
    rollDescription.textContent = selectedDescription;
    rollDescription.hidden = selectedDescription.length === 0;
  }
  const select = dialog.element.querySelector<HTMLSelectElement>(
    'select[name="targetId"]',
  );
  const image = dialog.element.querySelector<HTMLImageElement>(
    "[data-target-image]",
  );
  const placeholder = dialog.element.querySelector<HTMLElement>(
    "[data-target-placeholder]",
  );
  const name = dialog.element.querySelector<HTMLElement>("[data-target-name]");
  const range = dialog.element.querySelector<HTMLElement>(
    "[data-target-range]",
  );
  const defense = dialog.element.querySelector<HTMLElement>(
    "[data-target-defense]",
  );
  const scale = dialog.element.querySelector<HTMLElement>(
    "[data-target-scale]",
  );
  const scores =
    dialog.element.querySelectorAll<HTMLElement>("[data-roll-score]");
  const finalPoolPenalty = dialog.element.querySelector<HTMLElement>(
    "[data-final-pool-penalty]",
  );
  const doubledScore = dialog.element.querySelector<HTMLElement>(
    "[data-roll-doubled-score]",
  );
  const finalDifficulty = dialog.element.querySelector<HTMLElement>(
    "[data-final-difficulty]",
  );
  const selectedTargetId =
    select?.closest<HTMLElement>("[data-selected-target-id]")?.dataset
      .selectedTargetId ?? "";
  if (select?.value.length === 0 && selectedTargetId.length > 0) {
    select.value = selectedTargetId;
  }
  const option = select?.selectedOptions[0];
  const targetImage = option?.dataset.image ?? "";
  if (name && image && placeholder) {
    name.textContent =
      option?.dataset.name ?? game.i18n.localize("D6E2.Combat.NoTarget");
    image.hidden = targetImage.length === 0;
    placeholder.hidden = targetImage.length > 0;
    if (targetImage) image.src = targetImage;
    else image.removeAttribute("src");
  }
  const rangeText = option?.dataset.rangeLabel ?? "";
  const distance = option?.dataset.distance ?? "";
  if (range) {
    range.hidden = rangeText.length === 0;
    range.textContent = rangeText
      ? `${rangeText}${distance ? ` · ${distance} ${game.i18n.localize("D6E2.Combat.Meters")}` : ""}`
      : "";
  }
  const srpModeControl = dialog.element.querySelector<HTMLSelectElement>(
    'select[name="d6mvSrpMode"]',
  );
  const srpMode = srpModeControl?.value ?? "ready";
  const srpDataKey = `srp${srpMode[0]?.toUpperCase()}${srpMode.slice(1)}` as
    "srpPsyche" | "srpReady" | "srpSurprised";
  const srpDefense = option?.dataset[srpDataKey];
  const vsmModeControl = dialog.element.querySelector<HTMLSelectElement>(
    'select[name="d6mvVsmMode"]',
  );
  const vsmMode = vsmModeControl?.value === "mobile" ? "mobile" : "static";
  const vsmDataKey = vsmMode === "mobile" ? "vsmMobile" : "vsmStatic";
  const vsmDefense = option?.dataset[vsmDataKey];
  const defenseValue =
    option?.dataset.defenseStrategy === "d6mv-srp" && srpDefense
      ? srpDefense
      : option?.dataset.defenseStrategy === "d6mv-vsm" && vsmDefense
        ? vsmDefense
        : (option?.dataset.defense ?? "");
  const srpControl = dialog.element.querySelector<HTMLElement>(
    "[data-d6mv-srp-control]",
  );
  const vsmControl = dialog.element.querySelector<HTMLElement>(
    "[data-d6mv-vsm-control]",
  );
  if (srpControl)
    srpControl.hidden = option?.dataset.defenseStrategy !== "d6mv-srp";
  if (vsmControl)
    vsmControl.hidden = option?.dataset.defenseStrategy !== "d6mv-vsm";
  const defenseKind = option?.dataset.defenseKind ?? "";
  const targetOutOfRange = option?.dataset.outOfRange === "true";
  const dodgingInput = dialog.element.querySelector<HTMLInputElement>(
    'input[name="targetDodging"]',
  );
  const dodgingControl = dodgingInput?.closest<HTMLElement>(
    "[data-target-dodging-control]",
  );
  const allowsDodging =
    option?.dataset.defenseStrategy === "fixed-range" &&
    option.dataset.rangeBand === "long";
  if (dodgingInput) {
    dodgingInput.disabled = !allowsDodging;
    if (!allowsDodging) dodgingInput.checked = false;
  }
  if (dodgingControl) dodgingControl.hidden = !allowsDodging;
  const coverInput = dialog.element.querySelector<HTMLInputElement>(
    'input[name="coverDefenseModifier"]',
  );
  const coverModifier = Math.max(0, Math.trunc(Number(coverInput?.value) || 0));
  const effectiveTargetDifficulty = weaponTargetDifficultyPreview({
    coverModifier,
    ...(defenseValue.length > 0 ? { defense: Number(defenseValue) } : {}),
    defenseStrategy: option?.dataset.defenseStrategy,
    outOfRange: targetOutOfRange,
    rangeBand: option?.dataset.rangeBand,
    targetDodging: dodgingInput?.checked === true,
  });
  if (defense) {
    defense.textContent = targetOutOfRange
      ? game.i18n.localize("D6E2.Combat.RangeDifficultyOutOfRange")
      : effectiveTargetDifficulty !== undefined
        ? `${game.i18n.localize(
            defenseKind === "parry"
              ? "D6E2.Combat.Parry"
              : defenseKind === "range"
                ? "D6E2.Combat.RangeDifficulty"
                : "D6E2.Combat.Dodge",
          )} ${effectiveTargetDifficulty}`
        : game.i18n.localize("D6E2.Combat.TargetDefensePending");
  }
  const scaleModifier = Math.max(
    0,
    Math.trunc(Number(option?.dataset.scaleModifier) || 0),
  );
  const sourceScale = option?.dataset.sourceScale ?? "";
  const targetScale = option?.dataset.targetScale ?? "";
  if (scale) {
    scale.hidden = !option || (sourceScale === "" && targetScale === "");
    const scalar = option?.dataset.scaleFamily === "scalar";
    const sourceLabel = scalar
      ? `${game.i18n.localize(`D6E2.Combat.ScaleSide.${normalizedScaleSide(option.dataset.sourceScaleSide, Number(sourceScale), false)}`)} ${formatPipScore(Number(sourceScale))}`
      : sourceScale;
    const targetLabel = scalar
      ? `${game.i18n.localize(`D6E2.Combat.ScaleSide.${normalizedScaleSide(option.dataset.targetScaleSide, Number(targetScale), false)}`)} ${formatPipScore(Number(targetScale))}`
      : targetScale;
    const resolvedLabel =
      option?.dataset.scaleResolved === "false"
        ? ` · ${game.i18n.localize("D6E2.Combat.ScaleSide.unresolved")}`
        : "";
    scale.textContent = option
      ? `${game.i18n.localize(scalar ? "D6E2.Combat.ScaleValue" : "D6E2.Combat.ScaleRank")} ${sourceLabel} → ${targetLabel} · +${formatPipScore(scaleModifier)}${resolvedLabel}`
      : "";
  }
  const baseScore = Math.max(
    0,
    Math.trunc(
      Number(select?.dataset.baseScore ?? shell?.dataset.baseScore) || 0,
    ),
  );
  const mapInput = dialog.element.querySelector<HTMLInputElement>(
    'input[name="mapPenaltyDice"]',
  );
  const mapPenaltyDice = Math.max(0, Math.trunc(Number(mapInput?.value) || 0));
  const manualDiceInput = dialog.element.querySelector<HTMLInputElement>(
    'input[name="manualDiceAdjustment"]',
  );
  const manualDiceAdjustment = Math.trunc(Number(manualDiceInput?.value) || 0);
  const adjustedScore = Math.max(
    0,
    baseScore + scaleModifier + manualDiceAdjustment * 3 - mapPenaltyDice * 3,
  );
  const cap = shell?.dataset.dieCodeCap as
    keyof typeof SUPERHEROIC_DIE_CODE_CAPS | undefined;
  const capEnabled =
    cap !== undefined && Object.hasOwn(SUPERHEROIC_DIE_CODE_CAPS, cap);
  const bypassed =
    dialog.element.querySelector<HTMLInputElement>(
      'input[name="bypassDieCodeCap"]',
    )?.checked === true;
  const displayedScore = capEnabled
    ? superheroicDieCodeCapPlan(adjustedScore, cap, bypassed).cappedScore
    : adjustedScore;
  scores.forEach((score) => {
    score.textContent = formatPipScore(displayedScore);
  });
  if (finalPoolPenalty) {
    const fixedPoolPenaltyScore = Math.max(
      0,
      Math.trunc(Number(shell?.dataset.fixedPoolPenaltyScore) || 0),
    );
    const displayedPenaltyScore =
      fixedPoolPenaltyScore +
      mapPenaltyDice * 3 +
      Math.max(0, -manualDiceAdjustment * 3);
    finalPoolPenalty.hidden = displayedPenaltyScore === 0;
    finalPoolPenalty.textContent = `(-${formatPipScore(displayedPenaltyScore)})`;
  }
  if (doubledScore) {
    doubledScore.textContent = formatPipScore(
      capEnabled
        ? superheroicDieCodeCapPlan(adjustedScore * 2, cap).cappedScore
        : adjustedScore * 2,
    );
  }
  const form = (select ?? mapInput)?.closest("form");
  const difficulty = form?.elements.namedItem("difficulty");
  const fixedDifficulty =
    select?.dataset.fixedDifficulty === "true" ||
    (difficulty instanceof HTMLInputElement &&
      difficulty.dataset.difficultyLocked === "true");
  const targetControlsDifficulty =
    !fixedDifficulty &&
    option !== undefined &&
    option.value.length > 0 &&
    option.dataset.scaleApplication === "attack" &&
    effectiveTargetDifficulty !== undefined;
  if (difficulty instanceof HTMLInputElement && !fixedDifficulty) {
    const difficultyState = weaponTargetDifficultyControlState({
      currentValue: difficulty.value,
      difficultySource:
        difficulty.dataset.difficultySource === "custom"
          ? "custom"
          : difficulty.dataset.difficultySource === "calculated"
            ? "calculated"
            : undefined,
      manualDifficulty: difficulty.dataset.manualDifficulty,
      ...(targetControlsDifficulty
        ? { targetDifficulty: effectiveTargetDifficulty }
        : {}),
      wasTargetControlled: difficulty.dataset.targetDifficultyLocked === "true",
    });
    difficulty.value = difficultyState.value;
    difficulty.readOnly = difficultyState.readOnly;
    if (difficultyState.targetControlled) {
      difficulty.dataset.manualDifficulty =
        difficultyState.manualDifficulty ?? "";
      difficulty.dataset.targetDifficultyLocked = "true";
      difficulty.dataset.difficultySource =
        difficultyState.difficultySource ?? "calculated";
    } else {
      delete difficulty.dataset.manualDifficulty;
      delete difficulty.dataset.targetDifficultyLocked;
      delete difficulty.dataset.difficultySource;
    }
  }
  if (finalDifficulty) {
    const displayedDifficulty =
      targetControlsDifficulty &&
      !(
        difficulty instanceof HTMLInputElement &&
        difficulty.dataset.difficultySource === "custom"
      )
        ? effectiveTargetDifficulty
        : difficulty instanceof HTMLInputElement && difficulty.value.trim()
          ? Number(difficulty.value)
          : undefined;
    finalDifficulty.textContent = Number.isFinite(displayedDifficulty)
      ? String(Math.trunc(displayedDifficulty ?? 0))
      : "—";
  }
}

async function promptForRoll(
  actor: FoundryActorDocument,
  label: string,
  score: number,
  kind: D6RollKind,
  rollContext?: D6RollContextV1,
  sourceItemId?: string,
  sourceAttributeId?: string,
  sourceDescription = "",
  advancedSkillContexts: readonly AdvancedSkillContextOption[] = [],
  automaticPenaltyScore = 0,
  mapContext?: RollMapDialogContext,
  targetContext?: RollTargetContext,
  fixedDifficulty?: number,
  baselineAttributeScore = 0,
  options: InternalRollInvocationOptions = {},
): Promise<RollDialogResult | null> {
  const metaCurrencyStrategy = currentMetaCurrencyRuntimeStrategy();
  const openD6Resources = readOpenD6RollResources(actor);
  const openD6RollResources =
    metaCurrencyStrategy.id ===
    "open-d6.meta-currency.character-and-fate-points";
  const characterPointLimit = Math.min(
    openD6Resources.characterPoints,
    openD6CharacterPointSpendLimit(
      actor,
      kind,
      rollContext,
      sourceItemId,
      sourceAttributeId,
    ),
  );
  const successStrategy = currentSuccessRuntimeStrategy();
  const terminology = currentTerminology();
  const heroPointStrategy = metaCurrencyStrategy.heroPointStrategy ?? "heroic";
  const campaign = currentSecondEditionCampaignProfile();
  const superheroicCap = campaign.superheroicDieCodeCap;
  const heroPoints = actorHeroPointBalance(actor);
  const heroPointLimit = heroPointSpendLimit(
    heroPointStrategy,
    heroPoints,
    baselineAttributeScore,
  );
  const requestedRoll = options.requestedRoll;
  const pendingDialogId =
    requestedRoll?.requestId ??
    (rollContext?.explosive
      ? `explosive:${rollContext.explosive.requestId}:damage:${rollContext.explosive.zone}`
      : undefined);
  if (pendingDialogId && cancelledRequestedRollIds.delete(pendingDialogId)) {
    return null;
  }
  const defaultRollMode =
    requestedRoll?.rollMode ??
    options.fixedRollMode ??
    currentDefaultRollMode();
  const defaultDifficulty =
    fixedDifficulty ??
    Math.trunc(numberSetting(SHARED_SETTING_KEYS.defaultDifficulty, 0));
  const difficultySuggestions =
    currentConfiguredRulesProfile().difficultyLadder;
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/roll/dialog.hbs`,
    {
      actionPenaltyLabel:
        automaticPenaltyScore > 0
          ? `−${formatPipScore(automaticPenaltyScore)}`
          : undefined,
      automaticResultModifier: options.automaticResultModifier ?? 0,
      automaticResultModifierIcon: options.automaticResultModifierLabel
        ? "fa-burst"
        : "fa-shield-halved",
      automaticResultModifierLabel:
        options.automaticResultModifierLabel ??
        game.i18n.localize("D6E2.Combat.FirstEdition.FullDefenseBonus"),
      hasAutomaticResultModifier: (options.automaticResultModifier ?? 0) !== 0,
      actor,
      characterPointLabel: terminologyResourceLabel(
        terminology,
        "characterPoints",
      ),
      characterPointLimit,
      characterPoints: openD6Resources.characterPoints,
      advancedSkillContexts,
      dialogAdvancedSkillContexts: advancedSkillContexts.map((advanced) => ({
        ...advanced,
        optionLabel: `${advanced.label} · +${advanced.scoreLabel} · ${advanced.augmentedScoreLabel}`,
      })),
      selectedAdvancedSkillItemId: options.advancedSkillItemId,
      blindRollSelected: defaultRollMode === "blindroll",
      defaultDifficulty: defaultDifficulty > 0 ? defaultDifficulty : undefined,
      difficultySuggestions,
      hasDifficultySuggestions: difficultySuggestions.length > 0,
      fixedDifficulty,
      fatePointActive: openD6Resources.fatePointActive,
      fatePointLabel: terminologyResourceLabel(terminology, "fatePoints"),
      fatePoints: openD6Resources.fatePoints,
      finalDifficulty: defaultDifficulty > 0 ? defaultDifficulty : "—",
      finalPoolPenaltyLabel: `-${formatPipScore(
        automaticPenaltyScore +
          (options.combinedAction?.penaltyScore ?? 0) +
          (mapContext?.initialDice ?? 0) * 3,
      )}`,
      fixedPoolPenaltyScore:
        automaticPenaltyScore + (options.combinedAction?.penaltyScore ?? 0),
      hasFinalPoolPenalty:
        automaticPenaltyScore +
          (options.combinedAction?.penaltyScore ?? 0) +
          (mapContext?.initialDice ?? 0) * 3 >
        0,
      hasFixedDifficulty: fixedDifficulty !== undefined,
      gmRollSelected: defaultRollMode === "gmroll",
      label,
      hasRollDescriptionRegion:
        sourceDescription.length > 0 ||
        advancedSkillContexts.some(
          (advanced) => advanced.description.length > 0,
        ),
      rollDescription: sourceDescription,
      requestedRoll:
        requestedRoll === undefined
          ? undefined
          : {
              ...requestedRoll,
              visibilityIcon:
                requestedRoll.visibility === "hidden"
                  ? "fa-eye-slash"
                  : requestedRoll.visibility === "private"
                    ? "fa-user-shield"
                    : "fa-earth-americas",
              visibilityLabel: game.i18n.localize(
                requestedRoll.visibility === "public"
                  ? "D6E2.RequestRoll.Visibility.Public"
                  : requestedRoll.visibility === "private"
                    ? "D6E2.RequestRoll.Visibility.Private"
                    : "D6E2.RequestRoll.Visibility.Hidden",
              ),
            },
      rollModeLocked:
        requestedRoll !== undefined || options.fixedRollMode !== undefined,
      publicRollSelected: defaultRollMode === "publicroll",
      baseScore: score,
      dieCodeCap: superheroicCap === "none" ? "" : superheroicCap,
      dieCodeCapDice:
        superheroicCap === "none"
          ? 0
          : SUPERHEROIC_DIE_CODE_CAPS[superheroicCap],
      mapAssistanceLabel: game.i18n.localize(
        mapContext?.assistance === "manual"
          ? "D6E2.Roll.Map.ManualHelp"
          : mapContext?.trackedDice
            ? "D6E2.Roll.Map.TrackedHelp"
            : "D6E2.Roll.Map.OptionalHelp",
      ),
      mapPenaltyDice: mapContext?.initialDice ?? 0,
      manualDiceAdjustment: 0,
      mapTrackedDice: mapContext?.trackedDice ?? 0,
      scoreLabel: formatPipScore(
        Math.max(0, score - (mapContext?.initialDice ?? 0) * 3),
      ),
      selfRollSelected: defaultRollMode === "selfroll",
      showDifficultyControls:
        kind !== "resistance" &&
        booleanSetting(SHARED_SETTING_KEYS.showDifficultyControls, true),
      showHeroPointDouble:
        metaCurrencyStrategy.rollSpend === "double-die-code" && heroPoints > 0,
      showSuperheroicCapBypass:
        actor.type === "character" &&
        campaign.superheroicHeroPoints &&
        superheroicCap !== "none" &&
        heroPoints > 0,
      showHeroPointDice:
        (metaCurrencyStrategy.rollSpend === "bonus-ordinary-dice" ||
          metaCurrencyStrategy.rollSpend === "bonus-wild-dice") &&
        heroPointLimit > 0,
      showOpenD6CharacterPoints: openD6RollResources && characterPointLimit > 0,
      showOpenD6FatePoint:
        openD6RollResources &&
        (openD6Resources.fatePointActive || openD6Resources.fatePoints > 0),
      heroPointDiceWild: metaCurrencyStrategy.rollSpend === "bonus-wild-dice",
      heroPointLimit,
      heroPointStrategy,
      showModifierControls:
        kind !== "resistance" &&
        booleanSetting(SHARED_SETTING_KEYS.showModifierControls, true),
      showOppositionControls:
        kind === "resistance"
          ? false
          : booleanSetting(SHARED_SETTING_KEYS.showOppositionControls, true),
      doubledScoreLabel: formatPipScore(
        Math.max(0, score - (mapContext?.initialDice ?? 0) * 3) * 2,
      ),
      hasAdvancedSkillContexts: advancedSkillContexts.length > 0,
      hasActionPenalty: automaticPenaltyScore > 0,
      showFinalPoolPenalty: targetContext?.purpose === "attack",
      showMapControl: mapContext !== undefined,
      targetContext:
        targetContext === undefined
          ? undefined
          : {
              ...targetContext,
              baseScore: score,
              label: game.i18n.localize(
                targetContext.purpose === "resistance"
                  ? "D6E2.Combat.DamageSource"
                  : "D6E2.Combat.Target",
              ),
              showDefense: targetContext.purpose === "attack",
              showRange: targetContext.purpose === "attack",
              fixedDifficulty,
              hasFixedDifficulty: fixedDifficulty !== undefined,
              fixedDifficultyLabel: game.i18n.localize(
                successStrategy.threshold === "meets"
                  ? "D6E2.Combat.Damage.ResistanceThresholdMeet"
                  : "D6E2.Combat.Damage.ResistanceThresholdExceed",
              ),
            },
      heroPoints,
    },
  );
  try {
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
              const target = selectedRollTarget(form);
              const difficultyControl = form.elements.namedItem("difficulty");
              const enteredDifficulty = inputNumber(form, "difficulty");
              const difficultySelection = weaponAttackDifficultySelection({
                customDifficulty: enteredDifficulty,
                customSelected:
                  difficultyControl instanceof HTMLInputElement &&
                  difficultyControl.dataset.difficultySource === "custom",
                targetDifficulty: target?.attack?.defense,
              });
              const difficulty =
                difficultySelection?.value ?? enteredDifficulty;
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
              const rollMode: D6RollMode =
                options.fixedRollMode ??
                (["publicroll", "gmroll", "blindroll", "selfroll"].includes(
                  selectedMode,
                )
                  ? (selectedMode as D6RollMode)
                  : "publicroll");
              return {
                ...(advancedSkillItemId.length > 0
                  ? { advancedSkillItemId }
                  : {}),
                ...(oppositionTotal === undefined && difficulty !== undefined
                  ? { difficulty }
                  : {}),
                ...(oppositionTotal === undefined &&
                difficultySelection !== undefined
                  ? { difficultySelection }
                  : {}),
                ...(target === undefined ? {} : { target }),
                characterPointSpend: Math.min(
                  characterPointLimit,
                  Math.max(
                    0,
                    Math.trunc(inputNumber(form, "characterPointSpend") ?? 0),
                  ),
                ),
                fatePointUse: openD6Resources.fatePointActive
                  ? "active"
                  : inputChecked(form, "spendFatePoint")
                    ? "spend"
                    : "none",
                heroPointSpend: Math.min(
                  heroPointLimit,
                  Math.max(
                    0,
                    Math.trunc(inputNumber(form, "heroPointSpend") ?? 0),
                  ),
                ),
                heroPointUse: inputChecked(form, "bypassDieCodeCap")
                  ? "superheroic-bypass-cap"
                  : inputChecked(form, "doubleDieCode")
                    ? "double-die-code"
                    : Math.trunc(inputNumber(form, "heroPointSpend") ?? 0) > 0
                      ? heroPointStrategy === "classic"
                        ? "classic-bonus-wild-dice"
                        : "basic-bonus-dice"
                      : "none",
                mapPenaltyDice: Math.max(
                  0,
                  Math.trunc(inputNumber(form, "mapPenaltyDice") ?? 0),
                ),
                manualDiceAdjustment: Math.trunc(
                  inputNumber(form, "manualDiceAdjustment") ?? 0,
                ),
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
        position: { width: 720 },
        rejectClose: false,
        render: (_event, dialog) => {
          requestAnimationFrame(() => {
            const scrollOwner =
              dialog.element.querySelector<HTMLElement>(".window-content");
            const control = Array.from(
              dialog.element.querySelectorAll<HTMLElement>(
                '.dialog-content :is(input:not([type="hidden"]), select, button):not([disabled])',
              ),
            ).find((element) => element.getClientRects().length > 0);
            if (control) control.focus({ preventScroll: true });
            if (scrollOwner) scrollOwner.scrollTop = 0;
          });
          const targetSelect = dialog.element.querySelector<HTMLSelectElement>(
            'select[name="targetId"]',
          );
          if (targetSelect) {
            targetSelect.addEventListener("change", () => {
              if (targetSelect.dataset.targetPurpose === "attack") {
                synchronizeCombatRollTarget(targetSelect.value);
              }
              updateRollPreview(dialog);
            });
          }
          dialog.element
            .querySelector<HTMLSelectElement>(
              'select[name="advancedSkillItemId"]',
            )
            ?.addEventListener("change", () => updateRollPreview(dialog));
          dialog.element
            .querySelector<HTMLSelectElement>('select[name="d6mvSrpMode"]')
            ?.addEventListener("change", () => updateRollPreview(dialog));
          dialog.element
            .querySelector<HTMLSelectElement>('select[name="d6mvVsmMode"]')
            ?.addEventListener("change", () => updateRollPreview(dialog));
          dialog.element
            .querySelector<HTMLInputElement>('input[name="mapPenaltyDice"]')
            ?.addEventListener("input", () => updateRollPreview(dialog));
          dialog.element
            .querySelector<HTMLInputElement>(
              'input[name="manualDiceAdjustment"]',
            )
            ?.addEventListener("input", () => updateRollPreview(dialog));
          for (const name of ["doubleDieCode", "bypassDieCodeCap"]) {
            dialog.element
              .querySelector<HTMLInputElement>(`input[name="${name}"]`)
              ?.addEventListener("change", (event) => {
                const changed = event.currentTarget as HTMLInputElement;
                if (changed.checked) {
                  const other =
                    name === "doubleDieCode"
                      ? "bypassDieCodeCap"
                      : "doubleDieCode";
                  const otherInput =
                    dialog.element.querySelector<HTMLInputElement>(
                      `input[name="${other}"]`,
                    );
                  if (otherInput) otherInput.checked = false;
                }
                updateRollPreview(dialog);
              });
          }
          dialog.element
            .querySelectorAll<HTMLButtonElement>("[data-hero-point-step]")
            .forEach((button) => {
              button.addEventListener("click", () => {
                const input = dialog.element.querySelector<HTMLInputElement>(
                  'input[name="heroPointSpend"]',
                );
                const output = dialog.element.querySelector<HTMLOutputElement>(
                  "[data-hero-point-value]",
                );
                if (!input || !output) return;
                const next = Math.min(
                  heroPointLimit,
                  Math.max(
                    0,
                    Math.trunc(Number(input.value) || 0) +
                      Math.trunc(Number(button.dataset.heroPointStep) || 0),
                  ),
                );
                input.value = String(next);
                output.value = String(next);
              });
            });
          dialog.element
            .querySelectorAll<HTMLButtonElement>("[data-character-point-step]")
            .forEach((button) => {
              button.addEventListener("click", () => {
                const input = dialog.element.querySelector<HTMLInputElement>(
                  'input[name="characterPointSpend"]',
                );
                const output = dialog.element.querySelector<HTMLOutputElement>(
                  "[data-character-point-value]",
                );
                if (!input || !output) return;
                const next = Math.min(
                  characterPointLimit,
                  Math.max(
                    0,
                    Math.trunc(Number(input.value) || 0) +
                      Math.trunc(
                        Number(button.dataset.characterPointStep) || 0,
                      ),
                  ),
                );
                input.value = String(next);
                output.value = String(next);
              });
            });
          dialog.element
            .querySelector<HTMLInputElement>('input[name="targetDodging"]')
            ?.addEventListener("change", () => updateRollPreview(dialog));
          dialog.element
            .querySelector<HTMLInputElement>(
              'input[name="coverDefenseModifier"]',
            )
            ?.addEventListener("input", () => updateRollPreview(dialog));
          const markTargetDifficultyInput = (input: HTMLInputElement): void => {
            if (
              input.dataset.targetDifficultyLocked === "true" &&
              input.dataset.difficultyLocked !== "true"
            ) {
              input.dataset.difficultySource =
                input.value.trim().length > 0 ? "custom" : "calculated";
            }
          };
          if (dialog.element.querySelector("[data-difficulty-combobox]")) {
            bindDifficultySuggestionComboboxes(dialog.element, (input) => {
              markTargetDifficultyInput(input);
              updateRollPreview(dialog);
            });
          } else {
            const difficultyInput =
              dialog.element.querySelector<HTMLInputElement>(
                'input[name="difficulty"]',
              );
            difficultyInput?.addEventListener("input", () => {
              markTargetDifficultyInput(difficultyInput);
              updateRollPreview(dialog);
            });
          }
          updateRollPreview(dialog);
          if (pendingDialogId) {
            requestedRollDialogs.set(pendingDialogId, dialog);
            if (cancelledRequestedRollIds.delete(pendingDialogId)) {
              void dialog.close();
            }
          }
        },
        window: {
          icon: "fa-solid fa-dice-d6",
          title: `${game.i18n.localize("D6E2.Roll.Action")} · ${label}`,
        },
      });
    return result && typeof result === "object" ? result : null;
  } finally {
    if (pendingDialogId) {
      requestedRollDialogs.delete(pendingDialogId);
      cancelledRequestedRollIds.delete(pendingDialogId);
    }
  }
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
  const resourceLabel = currentMetaCurrencyAwardLabel();
  return requiresGmWildChoice(choices, result)
    ? requestGmWildChoice(choices, result, resourceLabel)
    : promptWildChoiceDialog(
        choices,
        wildDecisionViewModel(choices, result, {
          actorName: result.request.source.actorName,
          resourceLabel,
        }),
      );
}

function currentMetaCurrencyAwardLabel(): string {
  const terminology = currentTerminology();
  return currentMetaCurrencyRuntimeStrategy().id ===
    "open-d6.meta-currency.character-and-fate-points"
    ? terminologyResourceLabel(terminology, "fatePoints")
    : terminologyResourceLabel(terminology, "heroPoints");
}

export function resourceQuantityEvidence(
  resourceLabel: string,
  quantity: number,
): string {
  return `${resourceLabel} +${quantity}`;
}

function wildDieAudit(policy: D6WildDiePolicy): {
  readonly label: string;
  readonly source: string;
} {
  const suffix =
    policy === "first-edition"
      ? "OpenD6"
      : policy === "second-edition-basic"
        ? "Basic"
        : policy === "second-edition-classic"
          ? "Classic"
          : policy === "second-edition-simple"
            ? "Simple"
            : "Core";
  return {
    label: game.i18n.localize(`D6E2.Roll.WildStrategy.${suffix}`),
    source: game.i18n.localize(`D6E2.Roll.WildStrategy.${suffix}Source`),
  };
}

async function rolledBatch(
  count: number,
  denomination: "d6" | "dw" = "d6",
  explodeOnSix = false,
): Promise<{
  readonly artifact: FoundryRoll | null;
  readonly faces: readonly number[];
}> {
  if (count === 0) return { artifact: null, faces: Object.freeze([]) };
  const roll = await new Roll(
    `${count}${denomination}${explodeOnSix ? "x6" : ""}`,
    {},
    {
      appearance: d6System2eDiceAppearance(denomination),
    },
  ).evaluate();
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
  if (
    currentMetaCurrencyRuntimeStrategy().automaticRollTransactions === "none"
  ) {
    return;
  }
  if (!booleanSetting(SECOND_EDITION_OPTION_KEYS.autoHeroPoints, true)) {
    return;
  }
  if (result.heroPointAward === 0 && result.heroPointSpent === 0) return;
  await transactActorHeroPoints(
    actor,
    result.heroPointSpent,
    result.heroPointAward,
  );
}

async function applyOpenD6RollResourceTransaction(
  actor: FoundryActorDocument,
  result: D6RollResultV1,
): Promise<void> {
  if (
    (result.characterPointsSpent ?? 0) === 0 &&
    (result.fatePointsSpent ?? 0) === 0
  ) {
    return;
  }
  await transactOpenD6RollResources(actor, result);
}

function firstEditionMagicSkillLabel(skillKey: string): string {
  return (
    currentFirstEditionGenreProfile().skills.find(({ key }) => key === skillKey)
      ?.name ?? skillKey
  );
}

async function postRoll(
  actor: FoundryActorDocument,
  result: D6RollResultV1,
  artifacts: readonly unknown[],
  existingMessage?: FoundryChatMessageDocument,
): Promise<FoundryChatMessageDocument> {
  const heroPoints = actorHeroPointBalance(actor);
  const metaCurrencyStrategy = currentMetaCurrencyRuntimeStrategy();
  const showHeroPointReroll =
    metaCurrencyStrategy.failedRollReroll &&
    heroPoints > 0 &&
    canRerollFailedRoll(result);
  const showDoublingDown =
    currentRetryRuntimeStrategy().followUp === "doubling-down" &&
    canDoubleDown(result);
  const wildDieStrategy = wildDieAudit(result.wildPolicy);
  const highestDiscardedIndex =
    result.wildOutcome === "penalty"
      ? result.baseFaces.indexOf(Math.max(...result.baseFaces))
      : -1;
  const baseFaces = result.baseFaces.map((value, index) => ({
    discarded: index === highestDiscardedIndex,
    value,
  }));
  const wildFaces = result.wildFaces.map((value, index) => ({
    discarded:
      index === 0 &&
      (result.wildOutcome === "penalty" ||
        (result.wildPolicy === "second-edition-classic" &&
          result.wildOutcome === "complication")),
    markClass: value === 1 ? "is-one" : value === 6 ? "is-six" : "",
    value,
  }));
  const terminology = currentTerminology();
  const characterPointLabel = terminologyResourceLabel(
    terminology,
    "characterPoints",
  );
  const metaCurrencyAwardLabel = currentMetaCurrencyAwardLabel();
  const characterPointFaces = (result.characterPointFaces ?? []).map(
    (value) => ({
      label: characterPointLabel,
      markClass: value === 6 ? "is-six" : "",
      value,
    }),
  );
  const matchingObservation = result.matchingObservation;
  const matchingRewardFailed = matchingObservation?.reward?.status === "failed";
  const matchingReward =
    matchingObservation?.reward?.status === "granted"
      ? matchingObservation.reward
      : undefined;
  const rollCap = result.request.context?.superheroicDieCodeCap?.cap;
  const preCapScore =
    result.request.heroPointUse === "double-die-code"
      ? result.request.score * 2
      : result.request.score;
  const capPlan =
    rollCap === undefined
      ? undefined
      : superheroicDieCodeCapPlan(
          preCapScore,
          rollCap,
          result.request.heroPointUse === "superheroic-bypass-cap",
        );
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/roll/chat-card.hbs`,
    {
      actionEconomyContext:
        result.request.context?.actionEconomy === undefined
          ? undefined
          : {
              ...result.request.context.actionEconomy,
              hasActionCount:
                result.request.context.actionEconomy.actionCount !== undefined,
              actionCountLabel: game.i18n.localize(
                (result.request.context.actionEconomy.actionCountLabel ??
                  currentActionEconomyRuntimeStrategy().actionCountLabel) ===
                  "action-total"
                  ? "D6E2.Combat.FirstEdition.ActionTotal"
                  : "D6E2.Combat.Actions",
              ),
              hasRound:
                result.request.context.actionEconomy.round !== undefined,
              mapSourceLabel: game.i18n.localize(
                result.request.context.actionEconomy.mapPenaltySource ===
                  "tracked"
                  ? "D6E2.Roll.Map.SourceTracked"
                  : result.request.context.actionEconomy.mapPenaltySource ===
                      "manual"
                    ? "D6E2.Roll.Map.SourceManual"
                    : "D6E2.Roll.Map.SourceNone",
              ),
            },
      actor,
      settingLogo: resolveSettingLogo(currentSettingProfile().logo),
      hasSuperheroicDieCodeCap: capPlan !== undefined,
      superheroicDieCodeCapContext:
        capPlan === undefined
          ? undefined
          : {
              ...capPlan,
              cappedScoreLabel: formatPipScore(capPlan.cappedScore),
              originalScoreLabel: formatPipScore(capPlan.originalScore),
            },
      advancedSkillContext:
        result.request.context?.advancedSkill === undefined
          ? undefined
          : {
              ...result.request.context.advancedSkill,
              scoreLabel: formatPipScore(
                result.request.context.advancedSkill.score,
              ),
            },
      baseFaces,
      characterPointFaces,
      characterPointLabel,
      characterPointsSpent: result.characterPointsSpent ?? 0,
      difficulty: result.difficulty,
      d6mv:
        result.d6mv === undefined
          ? undefined
          : {
              ...result.d6mv,
              consequenceLabel: game.i18n.localize(
                `D6E2.Roll.D6MV.Consequence.${result.d6mv.consequence}`,
              ),
              degreeLabel: game.i18n.localize(
                `D6E2.Roll.D6MV.Degree.${result.d6mv.degree}`,
              ),
              hasAllyAward: result.d6mv.allyHeroPointAward > 0,
              hasSelfAward: result.d6mv.selfHeroPointAward > 0,
              allyAwardLabel: game.i18n.format(
                "D6E2.Roll.D6MV.AllyAwardPending",
                {
                  resource: resourceQuantityEvidence(
                    metaCurrencyAwardLabel,
                    result.d6mv.allyHeroPointAward,
                  ),
                },
              ),
              selfAwardLabel: resourceQuantityEvidence(
                metaCurrencyAwardLabel,
                result.d6mv.selfHeroPointAward,
              ),
            },
      hasDifficulty: result.difficulty !== undefined,
      hasD6MvEvidence: result.d6mv !== undefined,
      hasCombinedActionContext:
        result.request.context?.combinedAction !== undefined,
      combinedActionContext:
        result.request.context?.combinedAction === undefined
          ? undefined
          : {
              ...result.request.context.combinedAction,
              bonusLabel: formatPipScore(
                result.request.context.combinedAction.allocatedBonusScore,
              ),
              penaltyLabel: formatPipScore(
                result.request.context.combinedAction.commandPenaltyScore,
              ),
              stageLabel: game.i18n.localize(
                result.request.context.combinedAction.stage === "command"
                  ? "D6E2.CombinedActions.CommandRoll"
                  : "D6E2.CombinedActions.PrimaryRoll",
              ),
            },
      hasAdvancedSkillContext:
        result.request.context?.advancedSkill !== undefined,
      hasActionEconomyContext:
        result.request.context?.actionEconomy !== undefined,
      hasFirstEditionActiveDefenseContext:
        result.request.context?.firstEditionActiveDefense !== undefined,
      hasFirstEditionDurationContext:
        result.request.context?.firstEditionDuration !== undefined,
      hasFirstEditionMovementContext:
        result.request.context?.firstEditionMovement !== undefined,
      hasFirstEditionMortalityContext:
        result.request.context?.firstEditionMortality !== undefined,
      hasEnvironmentContext: result.request.context?.environment !== undefined,
      hasFeatureEffects:
        result.request.context?.featureEffects?.effects.some(
          ({ private: hidden }) => !hidden,
        ) === true,
      featureEffects:
        result.request.context?.featureEffects?.effects
          .filter(({ private: hidden }) => !hidden)
          .map((effect) => ({
            ...effect,
            scoreLabel: formatPipScore(effect.score),
          })) ?? [],
      hasMachineCrewContext: result.request.context?.machineCrew !== undefined,
      hasManualDiceAdjustment:
        result.request.context?.manualDiceAdjustment !== undefined,
      manualDiceAdjustment:
        result.request.context?.manualDiceAdjustment === undefined
          ? undefined
          : {
              ...result.request.context.manualDiceAdjustment,
              label: `${result.request.context.manualDiceAdjustment.dice > 0 ? "+" : "−"}${Math.abs(result.request.context.manualDiceAdjustment.dice)}D`,
            },
      hasMagicContext: result.request.context?.magic !== undefined,
      hasMatchingObservation: matchingObservation !== undefined,
      matchingObservation:
        matchingObservation === undefined
          ? undefined
          : {
              evaluatorLabel: game.i18n.localize(
                matchingObservation.evaluator.evaluator.label,
              ),
              patternLabel: game.i18n.localize(
                matchingObservation.best.patternLabel,
              ),
              reward:
                matchingReward === undefined
                  ? undefined
                  : {
                      characterPoints: matchingReward.characterPoints,
                      characterPointsLabel: characterPointLabel,
                      hasCharacterPoints: matchingReward.characterPoints > 0,
                      hasMetaCurrency: matchingReward.metaCurrency > 0,
                      metaCurrency: matchingReward.metaCurrency,
                      metaCurrencyLabel: metaCurrencyAwardLabel,
                    },
              rewardFailed: matchingRewardFailed,
              rewardRetry:
                matchingRewardFailed &&
                (actor.isOwner === true || game.user?.isGM === true),
            },
      hasPsionicsContext: result.request.context?.psionics !== undefined,
      hasResistanceContext: result.request.context?.resistance !== undefined,
      hasScaleContext: result.request.context?.scale !== undefined,
      hasSuperheroicEquipmentContext:
        result.request.context?.superheroicEquipment !== undefined,
      superheroicEquipmentContext: result.request.context?.superheroicEquipment,
      hasWeaponAttackContext:
        result.request.context?.weaponAttack !== undefined,
      hasWeaponDamageContext:
        result.request.context?.weaponDamage !== undefined,
      hasOpposition: result.opposition !== undefined,
      hasDoublingDownContext:
        result.request.context?.doublingDown !== undefined,
      doublingDownContext: result.request.context?.doublingDown,
      heroPointAward: result.heroPointAward,
      heroPointReroll: result.request.heroPointUse === "reroll-failed",
      heroPointSpent: result.heroPointSpent,
      heroPointUseLabel: game.i18n.localize(
        result.request.heroPointUse === "basic-bonus-dice"
          ? "D6E2.Roll.HeroPoint.Strategy.Basic"
          : result.request.heroPointUse === "classic-bonus-wild-dice"
            ? "D6E2.Roll.HeroPoint.Strategy.Classic"
            : result.request.heroPointUse === "reroll-failed"
              ? "D6E2.Roll.HeroPoint.Strategy.Reroll"
              : result.request.heroPointUse === "superheroic-bypass-cap"
                ? "D6E2.Roll.HeroPoint.Strategy.SuperheroicCap"
                : "D6E2.Roll.HeroPoint.Strategy.Heroic",
      ),
      fatePointApplied:
        result.request.openD6Resources?.fatePoint !== undefined &&
        result.request.openD6Resources.fatePoint !== "none",
      fatePointLabel: terminologyResourceLabel(terminology, "fatePoints"),
      fatePointsSpent: result.fatePointsSpent ?? 0,
      firstEditionActiveDefenseContext:
        result.request.context?.firstEditionActiveDefense === undefined
          ? undefined
          : {
              ...result.request.context.firstEditionActiveDefense,
              kindLabel: game.i18n.localize(
                result.request.context.firstEditionActiveDefense.kind ===
                  "block"
                  ? "D6E2.Combat.Block"
                  : result.request.context.firstEditionActiveDefense.kind ===
                      "dodge"
                    ? "D6E2.Combat.Dodge"
                    : "D6E2.Combat.Parry",
              ),
              modeLabel: game.i18n.localize(
                result.request.context.firstEditionActiveDefense.mode === "full"
                  ? "D6E2.Combat.FirstEdition.FullDefense"
                  : "D6E2.Combat.FirstEdition.PartialDefense",
              ),
            },
      firstEditionDurationContext:
        result.request.context?.firstEditionDuration === undefined
          ? undefined
          : {
              ...result.request.context.firstEditionDuration,
              actorName: result.request.source.actorName,
              duration: result.total,
              unitLabel: game.i18n.localize(
                "D6E2.Combat.FirstEdition.Consciousness.Minutes",
              ),
            },
      firstEditionMovementContext:
        result.request.context?.firstEditionMovement === undefined
          ? undefined
          : {
              ...result.request.context.firstEditionMovement,
              typeLabel: game.i18n.localize(
                `D6E2.Combat.FirstEdition.Movement.${result.request.context.firstEditionMovement.type}`,
              ),
            },
      firstEditionMortalityContext:
        result.request.context?.firstEditionMortality,
      environmentContext:
        result.request.context?.environment === undefined
          ? undefined
          : {
              ...result.request.context.environment,
              actionLabel: game.i18n.localize(
                `D6E2.Environment.Action.${result.request.context.environment.action}`,
              ),
              failureConditionLabel: environmentConditionLabel(
                result.request.context.environment.failureCondition,
              ),
              hazardLabel: game.i18n.localize(
                `D6E2.Environment.Hazard.${result.request.context.environment.hazard}`,
              ),
              penaltyLabel: formatPipScore(
                result.request.context.environment.penaltyScore,
              ),
              severityLabel: game.i18n.localize(
                `D6E2.Environment.Severity.${result.request.context.environment.severity}`,
              ),
            },
      machineCrewContext:
        result.request.context?.machineCrew === undefined
          ? undefined
          : {
              ...result.request.context.machineCrew,
              crewPenaltyLabel: formatPipScore(
                result.request.context.machineCrew.crewPenaltyScore,
              ),
              crewSkillScoreLabel: formatPipScore(
                result.request.context.machineCrew.crewSkillScore,
              ),
              weaponAttackBonusLabel: formatPipScore(
                result.request.context.machineCrew.weaponAttackBonusScore,
              ),
            },
      magicContext:
        result.request.context?.magic === undefined
          ? undefined
          : "strategy" in result.request.context.magic
            ? {
                ...result.request.context.magic,
                castLabel: game.i18n.localize(
                  result.request.context.magic.tradition === "miracles"
                    ? "D6E2.Magic.FirstEdition.Cast.Miracle"
                    : result.request.context.magic.tradition === "psionics"
                      ? "D6E2.Magic.FirstEdition.Cast.Psionic"
                      : "D6E2.Magic.FirstEdition.Cast.Spell",
                ),
                firstEdition: true,
                schoolLabel: game.i18n.localize(
                  result.request.context.magic.tradition === "miracles"
                    ? "D6E2.Magic.FirstEdition.Tradition.Miracles"
                    : result.request.context.magic.tradition === "psionics"
                      ? "D6E2.Magic.FirstEdition.Tradition.Psionics"
                      : "D6E2.Magic.FirstEdition.Tradition.Magic",
                ),
                skillLabel: firstEditionMagicSkillLabel(
                  result.request.context.magic.skillKey,
                ),
                untrainedLabel: game.i18n.localize(
                  result.request.context.magic.untrainedPenalty === 0
                    ? "D6E2.Magic.FirstEdition.Trained"
                    : "D6E2.Magic.FirstEdition.UntrainedFive",
                ),
              }
            : {
                ...result.request.context.magic,
                castingTimeLabel: game.i18n.localize(
                  `D6E2.Magic.CastingTime.${result.request.context.magic.castingTime}`,
                ),
                durationLabel: game.i18n.localize(
                  `D6E2.Magic.Duration.${result.request.context.magic.duration}`,
                ),
                rangeLabel: game.i18n.localize(
                  `D6E2.Magic.Range.${result.request.context.magic.range}`,
                ),
                resistanceLabel: game.i18n.localize(
                  `D6E2.Magic.Resistance.${result.request.context.magic.resistance}`,
                ),
                schoolLabel: game.i18n.localize(
                  `D6E2.Magic.School.${result.request.context.magic.school}`,
                ),
                targetLabel: game.i18n.localize(
                  `D6E2.Magic.Target.${result.request.context.magic.target}`,
                ),
                untrainedLabel: game.i18n.localize(
                  result.request.context.magic.untrainedPenalty === 0
                    ? "D6E2.Magic.Trained"
                    : result.request.context.magic.untrainedPenalty === 5
                      ? "D6E2.Magic.UntrainedFive"
                      : "D6E2.Magic.UntrainedTen",
                ),
              },
      psionicsContext:
        result.request.context?.psionics === undefined
          ? undefined
          : {
              ...result.request.context.psionics,
              disciplineLabels: result.request.context.psionics.disciplines
                .map((discipline) =>
                  game.i18n.localize(`D6E2.Psionics.Discipline.${discipline}`),
                )
                .join(" + "),
            },
      opposition: result.opposition,
      oppositionName: result.request.opposition?.name,
      requestedRoll:
        result.request.context?.requestedRoll === undefined
          ? undefined
          : {
              ...result.request.context.requestedRoll,
              visibilityLabel: game.i18n.localize(
                result.request.context.requestedRoll.visibility === "public"
                  ? "D6E2.RequestRoll.Visibility.Public"
                  : result.request.context.requestedRoll.visibility ===
                      "private"
                    ? "D6E2.RequestRoll.Visibility.Private"
                    : "D6E2.RequestRoll.Visibility.Hidden",
              ),
            },
      resistanceContext:
        result.request.context?.resistance === undefined
          ? undefined
          : {
              ...result.request.context.resistance,
              armorScoreLabel: formatPipScore(
                result.request.context.resistance.armorScore,
              ),
              brawnScoreLabel: formatPipScore(
                result.request.context.resistance.brawnScore,
              ),
              armorContributors:
                result.request.context.resistance.armorContributors.map(
                  (item) => ({
                    ...item,
                    scoreLabel: formatPipScore(item.score),
                  }),
                ),
              maximumScoreLabel:
                result.request.context.resistance.maximumScore === undefined
                  ? undefined
                  : formatPipScore(
                      result.request.context.resistance.maximumScore,
                    ),
              uncappedScoreLabel:
                result.request.context.resistance.uncappedScore === undefined
                  ? undefined
                  : formatPipScore(
                      result.request.context.resistance.uncappedScore,
                    ),
            },
      scaleContext:
        result.request.context?.scale === undefined
          ? undefined
          : {
              ...result.request.context.scale,
              applicationLabel: game.i18n.localize(
                result.request.context.scale.application === "resistance" &&
                  result.request.context.resistance?.kind === "machine"
                  ? "D6E2.Combat.ScaleApplication.machineResistance"
                  : `D6E2.Combat.ScaleApplication.${result.request.context.scale.application}`,
              ),
              modifierLabel: formatPipScore(
                result.request.context.scale.modifierScore,
              ),
              sourceValueLabel:
                result.request.context.scale.family === "scalar"
                  ? `${game.i18n.localize(`D6E2.Combat.ScaleSide.${result.request.context.scale.sourceSide ?? "unresolved"}`)} ${formatPipScore(result.request.context.scale.sourceRank)}`
                  : String(result.request.context.scale.sourceRank),
              targetValueLabel:
                result.request.context.scale.family === "scalar"
                  ? `${game.i18n.localize(`D6E2.Combat.ScaleSide.${result.request.context.scale.targetSide ?? "unresolved"}`)} ${formatPipScore(result.request.context.scale.targetRank)}`
                  : String(result.request.context.scale.targetRank),
            },
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
      weaponAttackContext:
        result.request.context?.weaponAttack === undefined
          ? undefined
          : {
              ...result.request.context.weaponAttack,
              defenseLabel: game.i18n.localize(
                result.request.context.weaponAttack.difficultySelection
                  ?.source === "custom"
                  ? "D6E2.ActionThread.CalculatedDifficulty"
                  : result.request.context.weaponAttack.defenseKind === "dodge"
                    ? "D6E2.Combat.Dodge"
                    : result.request.context.weaponAttack.defenseKind ===
                        "range"
                      ? "D6E2.Combat.RangeDifficulty"
                      : "D6E2.Combat.Parry",
              ),
              defenseStrategyLabel: game.i18n.localize(
                result.request.context.weaponAttack.defenseStrategy ===
                  "first-edition-range"
                  ? "D6E2.Combat.RangeDifficulty"
                  : result.request.context.weaponAttack.defenseStrategy ===
                      "first-edition-active-defense"
                    ? "D6E2.Combat.Dodge"
                    : result.request.context.weaponAttack.defenseStrategy ===
                        "grenade-targeting"
                      ? "D6E2.Combat.GrenadeTargeting"
                      : result.request.context.weaponAttack.defenseStrategy ===
                          "fixed-range"
                        ? "D6E2.Combat.NoDodge.FixedRange"
                        : result.request.context.weaponAttack
                              .defenseStrategy === "d6mv-vsm"
                          ? "D6E2.Roll.D6MV.VsmDefense"
                          : result.request.context.weaponAttack
                                .defenseStrategy === "machine-defense"
                            ? "D6E2.Combat.MachineDefense"
                            : result.request.context.weaponAttack
                                  .defenseKind === "parry"
                              ? "D6E2.Combat.Parry"
                              : "D6E2.Combat.Dodge",
              ),
              rangeLabel:
                result.request.context.weaponAttack.rangeBand === undefined
                  ? game.i18n.localize("D6E2.Combat.RangeUnmeasured")
                  : rangeLabel(
                      result.request.context.weaponAttack.rangeBand,
                      false,
                    ),
            },
      weaponDamageContext:
        result.request.context?.weaponDamage === undefined
          ? undefined
          : {
              ...result.request.context.weaponDamage,
              attributeLabel:
                terminologyAttributeLabel(
                  terminology,
                  result.request.context.weaponDamage.attributeId,
                ) ?? result.request.context.weaponDamage.attributeId,
              baseKindLabel: game.i18n.localize(
                `D6E2.Roll.WeaponDamage.${result.request.context.weaponDamage.baseKind}`,
              ),
              baseScoreLabel: formatPipScore(
                result.request.context.weaponDamage.baseScore,
              ),
              listedDamageScoreLabel: formatPipScore(
                result.request.context.weaponDamage.listedDamageScore,
              ),
            },
      wildFaces,
      wildDieStrategy,
      wildTriumph:
        result.wildTriumph === undefined
          ? undefined
          : {
              ...result.wildTriumph,
              characterPointLabel,
              metaCurrencyAwardLabel,
            },
      wildOutcomeLabel: game.i18n.localize(
        `D6E2.Roll.Outcome.${result.wildOutcome}`,
      ),
    },
  );
  const privacySafeResult = privacySafeFreeD6FeatureRollResult(result);
  const flags = {
    [SYSTEM_ID]: {
      roll: structuredClone(privacySafeResult),
      ...(result.request.context?.scale === undefined
        ? {}
        : { scale: result.request.context.scale }),
      ...(result.request.context?.weaponAttack === undefined
        ? {}
        : {
            attackKind: result.request.context.weaponAttack.attackKind,
            baseDefense: result.request.context.weaponAttack.baseDefense,
            coverModifier: result.request.context.weaponAttack.coverModifier,
            defense: result.request.context.weaponAttack.defense,
            defenseKind: result.request.context.weaponAttack.defenseKind,
            defenseSourcePage:
              result.request.context.weaponAttack.defenseSourcePage ?? "",
            defenseStrategy:
              result.request.context.weaponAttack.defenseStrategy ?? "",
            feintPenalty: result.request.context.weaponAttack.feintPenalty ?? 0,
            rangeBand: result.request.context.weaponAttack.rangeBand ?? "",
            targetActorId: result.request.context.weaponAttack.targetActorId,
            targetDodging:
              result.request.context.weaponAttack.targetDodging ?? false,
            targetTokenId:
              result.request.context.weaponAttack.targetTokenId ?? "",
            weaponId: result.request.context.weaponAttack.weaponId,
          }),
    },
  };
  if (existingMessage) {
    await persistFreeD6FeatureRollAudit(actor, existingMessage.id, result);
    await existingMessage.update({ content, flags });
    return existingMessage;
  }
  const message = await ChatMessage.create({
    ...visibilityForMode(result.request.rollMode),
    content,
    flags,
    rolls: artifacts.filter(
      (artifact): artifact is FoundryRoll => artifact !== null,
    ),
    speaker: ChatMessage.getSpeaker({ actor }),
  });
  try {
    await persistFreeD6FeatureRollAudit(actor, message.id, result);
  } catch (error) {
    await message.delete();
    throw error;
  }
  return message;
}

async function playSettingWildDieSound(result: D6RollResultV1): Promise<void> {
  const firstWild = result.wildFaceGroups?.[0]?.[0] ?? result.wildFaces[0];
  const profile = currentSettingProfile();
  const src =
    firstWild === 1
      ? profile.wildDie.oneSound
      : firstWild === 6
        ? profile.wildDie.sixSound
        : "";
  if (!src) return;
  const audioHelper = (
    foundry as unknown as {
      readonly audio?: {
        readonly AudioHelper?: {
          play(
            options: {
              readonly autoplay: boolean;
              readonly loop: boolean;
              readonly src: string;
              readonly volume: number;
            },
            broadcast: boolean,
          ): Promise<unknown>;
        };
      };
    }
  ).audio?.AudioHelper;
  try {
    await audioHelper?.play(
      { autoplay: true, loop: false, src, volume: 0.55 },
      false,
    );
  } catch (error) {
    console.warn(`${SYSTEM_ID} | Could not play Wild Die result sound`, error);
  }
}

async function appendMatchingHomebrewObservation(
  actor: FoundryActorDocument,
  result: D6RollResultV1,
): Promise<D6RollResultV1> {
  if (
    !(["attribute", "skill"] as const).includes(result.request.kind as never)
  ) {
    return result;
  }
  const profile = currentConfiguredRulesProfile();
  const policy = profile.homebrew.matchingRewards?.find(
    (candidate) => candidate.enabled,
  );
  if (!policy) return result;
  const resolution = matchingDetectorForProfile(profile, policy.detectorId);
  if (resolution?.evaluator.id !== policy.evaluatorId) {
    return result;
  }
  const observed = observeD6MatchingCombination(result, resolution.evaluator);
  const observation = observed.matchingObservation;
  if (!observation) return result;
  const rewardPlan = resolveD6MatchingRewardPlan(policy, {
    evaluatorId: resolution.evaluator.id,
    operationId:
      result.request.context?.requestedRoll?.requestId === undefined
        ? `matching-reward:${foundry.utils.randomID()}`
        : `matching-reward:${result.request.context.requestedRoll.requestId}`,
    patternId: observation.best.patternId,
    detectorId: policy.detectorId,
  });
  const reward =
    rewardPlan === undefined
      ? undefined
      : await applyD6MatchingReward(actor, rewardPlan);
  const matchingObservation: D6MatchingResultV1 = Object.freeze({
    ...observation,
    ...(reward === undefined ? {} : { reward }),
  });
  return Object.freeze({ ...result, matchingObservation });
}

export async function retryD6MatchingObservationReward(
  message: FoundryChatMessageDocument,
): Promise<boolean> {
  const value = message.getFlag(SYSTEM_ID, "roll");
  if (
    typeof value !== "object" ||
    value === null ||
    !("contractVersion" in value) ||
    value.contractVersion !== D6_ROLL_CONTRACT_VERSION
  ) {
    return false;
  }
  const result = value as D6RollResultV1;
  const observation = result.matchingObservation;
  const failed = observation?.reward;
  if (!observation || failed?.status !== "failed") return false;
  const actor =
    game.actors?.contents.find(
      (candidate) => candidate.id === result.request.source.actorId,
    ) ?? null;
  if (!actor || (actor.isOwner !== true && game.user?.isGM !== true)) {
    return false;
  }
  const reward = await applyD6MatchingReward(actor, {
    characterPoints: failed.characterPoints,
    evaluatorId: failed.evaluatorId,
    metaCurrency: failed.metaCurrency,
    operationId: failed.operationId,
    patternId: failed.patternId,
    patternLabel: failed.patternLabel,
    detectorId: failed.detectorId,
    version: failed.version,
  });
  const updated: D6RollResultV1 = Object.freeze({
    ...result,
    matchingObservation: Object.freeze({ ...observation, reward }),
  });
  await postRoll(actor, updated, message.rolls ?? Object.freeze([]), message);
  return reward.status === "granted";
}

async function executePreparedRoll(
  actor: FoundryActorDocument,
  request: D6RollRequestV1,
  suppressChatMessage = false,
  captureChatMessage?: (
    message: FoundryChatMessageDocument,
  ) => Promise<void> | void,
  captureRollResult?: (result: D6RollResultV1) => Promise<void> | void,
  captureRollExecution?: (
    result: D6RollResultV1,
    artifacts: readonly FoundryRoll[],
  ) => Promise<void> | void,
): Promise<D6RollResultV1 | null> {
  validateOpenD6RollResourceRequest(actor, request);
  let pendingMessage: FoundryChatMessageDocument | undefined;
  const executed = await executeD6Roll(
    request,
    {
      profileId: currentConfiguredRulesProfile().id,
      successEvaluator: currentSuccessRuntimeStrategy().evaluator,
      wildPolicy: currentWildDieRuntimeStrategy().policy,
    },
    {
      chooseWildDie: promptWildChoice,
      ...(suppressChatMessage
        ? {}
        : {
            presentWildDieRoll: async (
              result: D6RollResultV1,
              artifacts: readonly unknown[],
            ) => {
              pendingMessage = await postRoll(actor, result, artifacts);
              await waitForDiceSoNiceRollAnimation(pendingMessage.id);
            },
          }),
      rollBaseDice: rolledBatch,
      rollCharacterPointDie: () => rolledBatch(1, "d6", true),
      rollWildDie: (explodeOnSix) => rolledBatch(1, "dw", explodeOnSix),
    },
    {
      automaticSuccess: booleanSetting(
        TYFUSIUS_HOMEBREW_SETTING_KEYS.wildTriumphAutomaticSuccess,
        false,
      ),
      characterPointAward: numberSetting(
        TYFUSIUS_HOMEBREW_SETTING_KEYS.wildTriumphCharacterPointAward,
        0,
      ),
      enabled: booleanSetting(
        TYFUSIUS_HOMEBREW_SETTING_KEYS.wildTriumphEnabled,
        false,
      ),
      metaCurrencyAward: numberSetting(
        TYFUSIUS_HOMEBREW_SETTING_KEYS.wildTriumphMetaCurrencyAward,
        0,
      ),
      threshold: numberSetting(
        TYFUSIUS_HOMEBREW_SETTING_KEYS.wildTriumphThreshold,
        3,
      ),
    },
  );
  if (!executed) {
    await pendingMessage?.delete();
    return null;
  }
  await applyHeroPointTransaction(actor, executed.result);
  await applyOpenD6RollResourceTransaction(actor, executed.result);
  await applyWildTriumphRewards(actor, executed.result);
  const finalResult = await appendMatchingHomebrewObservation(
    actor,
    executed.result,
  );
  await captureRollResult?.(finalResult);
  await captureRollExecution?.(
    finalResult,
    executed.artifacts.filter(
      (artifact): artifact is FoundryRoll => artifact !== null,
    ),
  );
  if (suppressChatMessage) {
    await playSettingWildDieSound(finalResult);
    return finalResult;
  }
  const finalMessage = await postRoll(
    actor,
    finalResult,
    executed.artifacts,
    pendingMessage,
  );
  await captureChatMessage?.(finalMessage);
  await waitForDiceSoNiceRollAnimation(finalMessage.id);
  await playSettingWildDieSound(finalResult);
  return finalResult;
}

function gadgetRollContext(
  actor: FoundryActorDocument,
  requestSource: { readonly kind: string; readonly source: D6RollSource },
  itemId: string | undefined,
): NonNullable<D6RollContextV1["superheroicEquipment"]> | undefined {
  if (!itemId) return undefined;
  if (!currentSecondEditionCampaignProfile().gadgetsGear) {
    throw new Error("D6E2.GadgetsGear.Error.ModuleRequired");
  }
  const item = actor.items.get(itemId);
  if (
    item?.type !== "gear" ||
    item.system.superheroicEquipmentKind !== "gadget"
  ) {
    throw new Error("D6E2.GadgetsGear.Error.GadgetRequired");
  }
  if (item.system.equipped !== true) {
    throw new Error("D6E2.GadgetsGear.Error.EquippedRequired");
  }
  if (item.system.superheroicEquipmentState !== "ready") {
    throw new Error("D6E2.GadgetsGear.Error.ReadyRequired");
  }
  const targetKind = stringValue(item.system.gadgetTargetKind, "skill");
  const targetId = stringValue(item.system.gadgetTargetId);
  const validTarget =
    (targetKind === "attribute" &&
      requestSource.kind === "attribute" &&
      requestSource.source.attributeId === targetId) ||
    (targetKind === "skill" &&
      requestSource.kind === "skill" &&
      requestSource.source.itemId === targetId);
  if (!validTarget) {
    throw new Error("D6E2.GadgetsGear.Error.TargetRequired");
  }
  const useCase = stringValue(item.system.gadgetUseCase).trim();
  if (!useCase) throw new Error("D6E2.GadgetsGear.Error.UseCaseRequired");
  return Object.freeze({
    bonusScore: 3 as const,
    itemId: item.id,
    itemName: item.name,
    sourcePage: 227 as const,
    useCase,
  });
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
    readonly context?: D6RollContextV1;
    readonly fixedDifficulty?: number;
    readonly targetContext?: RollTargetContext;
    readonly weaponDamageContinuation?: WeaponDamageContinuationBase;
  },
  options: InternalRollInvocationOptions = {},
): Promise<D6RollResultV1 | null> {
  if (
    combinedActionBlocksRoll(
      actor,
      requestSource.kind,
      requestSource.source.itemId,
      options.combinedAction?.context.groupId,
    )
  ) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.CombinedActions.ActionLocked"),
    );
    return null;
  }
  const roundState = readCombatantRound(actor);
  const combinedCommandRoll =
    options.combinedAction?.context.stage === "command";
  const actionEconomyStrategy = currentActionEconomyRuntimeStrategy();
  const secondEditionActionSegments =
    actionEconomyStrategy.declaration === "ordered-actions";
  const firstEditionFlexibleActions =
    actionEconomyStrategy.declaration === "action-commitment";
  const appliesActionPenalty =
    options.ignoreActionEconomy !== true &&
    ["attribute", "skill", "weapon-attack"].includes(requestSource.kind);
  const assistance = currentActionDeclarationAssistance();
  const health = record(actor.system.health);
  const activeHealth = readActorHealth(actor);
  const firstEditionDamage =
    activeHealth.damageStrategyId.startsWith("open-d6.");
  const firstEditionStuns = record(health.firstEditionStuns);
  const firstEditionStunPenalty =
    firstEditionDamage &&
    booleanSetting(FIRST_EDITION_OPTION_KEYS.trackStuns, false)
      ? Math.min(2, Math.max(0, integer(firstEditionStuns.penaltyDice))) * 3
      : 0;
  const effectiveFirstEditionWound = isFirstEditionWoundLevel(
    activeHealth.track?.currentStateId,
  )
    ? activeHealth.track.currentStateId
    : "healthy";
  const firstEditionConsciousness = stringValue(
    record(health.firstEditionState).consciousness,
  );
  const condition = isSecondEditionCondition(activeHealth.track?.currentStateId)
    ? activeHealth.track.currentStateId
    : "healthy";
  const environmentEffect =
    currentOptionalCapabilityRuntime().environments.state === "active"
      ? readActorEnvironmentEffect(actor)
      : null;
  const environmentPenalty = environmentEffect?.penaltyScore ?? 0;
  const extraordinaryPowerPenalty = appliesActionPenalty
    ? extraordinaryPowerMaintenancePenalty(actor).score
    : 0;
  const environmentContext: D6EnvironmentRollContext | undefined =
    requestSource.context?.environment ??
    (environmentEffect && environmentPenalty > 0
      ? environmentRollContext(actor, environmentEffect, "affected-roll")
      : undefined);
  const superheroicEquipmentContext = gadgetRollContext(
    actor,
    requestSource,
    options.gadgetBonus?.itemId,
  );
  if (
    !firstEditionDamage &&
    secondEditionActionSegments &&
    appliesActionPenalty &&
    roundState?.actionForfeiture?.reason === "wounded"
  ) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Combat.Error.ActionsForfeitedByWound"),
    );
    return null;
  }
  if (
    !firstEditionDamage &&
    secondEditionActionSegments &&
    appliesActionPenalty &&
    !secondEditionConditionAllowsActions(condition)
  ) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Combat.Error.ConditionCannotAct"),
    );
    return null;
  }
  if (
    firstEditionDamage &&
    appliesActionPenalty &&
    (["mortally-wounded", "dead"].includes(effectiveFirstEditionWound) ||
      ["unconscious", "unresolved"].includes(firstEditionConsciousness))
  ) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Combat.Error.ConditionCannotAct"),
    );
    return null;
  }
  if (
    freeD6ConsequenceSuiteActive() &&
    appliesActionPenalty &&
    !freeD6FatigueAllowsActions(actor)
  ) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Combat.Error.ConditionCannotAct"),
    );
    return null;
  }
  if (
    secondEditionActionSegments &&
    appliesActionPenalty &&
    assistance === "enforced" &&
    roundState !== null &&
    roundState.actions.length === 0
  ) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Combat.Error.DeclarationRequired"),
    );
    return null;
  }
  const trackedMapPenalty =
    secondEditionActionSegments &&
    appliesActionPenalty &&
    roundState?.actions.length
      ? roundState.actionPenaltyScore
      : firstEditionFlexibleActions &&
          appliesActionPenalty &&
          roundState?.firstEditionCommitment
        ? roundState.firstEditionActionPenaltyScore
        : 0;
  const appliedTrackedMapPenalty =
    options.ignoreTrackedMapPenalty || combinedCommandRoll
      ? 0
      : trackedMapPenalty;
  const movementPenalty =
    secondEditionActionSegments &&
    appliesActionPenalty &&
    requestSource.kind !== "attribute"
      ? (roundState?.movementSkillPenaltyScore ?? 0)
      : 0;
  const conditionPenalty =
    options.ignoreConditionPenalty === true
      ? 0
      : appliesActionPenalty
        ? freeD6ConsequenceSuiteActive()
          ? freeD6ConsequencePenaltyProjection(actor).totalPenaltyScore +
            (firstEditionDamage ? firstEditionStunPenalty : 0)
          : activeHealth.damageStrategyId === "d6mv.damage.strength-multiples"
            ? d6MvActorPenaltyScore(actor)
            : (activeHealth.track?.currentState.penaltyScore ?? 0) +
              (firstEditionDamage ? firstEditionStunPenalty : 0)
        : 0;
  const featureBonusScore = options.featureBonus?.score === 9 ? 9 : 0;
  const ownedFeatureModifier = freeD6FeatureRollModifier(actor, requestSource);
  const resolvedFeatureBonusScore =
    featureBonusScore + ownedFeatureModifier.totalScore;
  const gadgetBonusScore = superheroicEquipmentContext?.bonusScore ?? 0;
  const initialRollPlan = actionEconomyRollPlan({
    assistance,
    baseScore:
      requestSource.score + resolvedFeatureBonusScore + gadgetBonusScore,
    conditionPenaltyScore: conditionPenalty,
    environmentPenaltyScore: environmentPenalty,
    extraordinaryPowerPenaltyScore: extraordinaryPowerPenalty,
    movementPenaltyScore: movementPenalty,
    rollCostsAction: appliesActionPenalty,
    trackedMapPenaltyScore: appliedTrackedMapPenalty,
  });
  const automaticPenalty =
    conditionPenalty + movementPenalty + environmentPenalty;
  const dialogAdvancedSkillContexts = requestSource.advancedSkillContexts?.map(
    (context) => {
      const augmentedScore =
        context.augmentedScore -
        automaticPenalty -
        initialRollPlan.mapPenaltyScore;
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
    requestSource.score +
      (options.combinedAction?.bonusScore ?? 0) -
      (options.combinedAction?.penaltyScore ?? 0) +
      resolvedFeatureBonusScore +
      gadgetBonusScore -
      automaticPenalty -
      extraordinaryPowerPenalty,
    requestSource.kind,
    requestSource.context,
    requestSource.source.itemId,
    requestSource.source.attributeId,
    itemDescriptionExcerpt(
      actor.items.get(requestSource.source.itemId ?? "")?.system.description,
      520,
    ),
    dialogAdvancedSkillContexts,
    automaticPenalty + extraordinaryPowerPenalty,
    appliesActionPenalty && !combinedCommandRoll
      ? {
          assistance,
          initialDice: initialRollPlan.mapPenaltyScore / 3,
          trackedDice: initialRollPlan.trackedMapPenaltyScore / 3,
        }
      : undefined,
    requestSource.targetContext,
    options.combinedAction?.context.stage === "command"
      ? options.combinedAction.context.commandDifficulty
      : requestSource.fixedDifficulty,
    currentEffectivePipScore(
      integer(
        record(
          record(actor.system.attributes)[requestSource.source.attributeId],
        ).score,
      ),
    ),
    options,
  );
  if (!controls) return null;
  if (controls.target?.outOfRange) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Combat.Error.TargetOutOfRange"),
    );
    return null;
  }
  const advancedSkill = requestSource.advancedSkillContexts?.find(
    (candidate) =>
      candidate.itemId ===
      (controls.advancedSkillItemId ?? options.advancedSkillItemId),
  );
  const unpenalizedScore =
    advancedSkill === undefined
      ? requestSource.score
      : advancedSkillAugmentedScore(requestSource.score, advancedSkill.score);
  const scaleModifierScore = controls.target?.scale.modifierScore ?? 0;
  const finalRollPlan = actionEconomyRollPlan({
    assistance,
    baseScore: Math.max(
      0,
      unpenalizedScore +
        (options.combinedAction?.bonusScore ?? 0) -
        (options.combinedAction?.penaltyScore ?? 0) +
        resolvedFeatureBonusScore +
        gadgetBonusScore +
        controls.manualDiceAdjustment * 3 +
        scaleModifierScore,
    ),
    conditionPenaltyScore: conditionPenalty,
    environmentPenaltyScore: environmentPenalty,
    extraordinaryPowerPenaltyScore: extraordinaryPowerPenalty,
    manualMapDice: combinedCommandRoll ? 0 : controls.mapPenaltyDice,
    movementPenaltyScore: movementPenalty,
    rollCostsAction: appliesActionPenalty,
    trackedMapPenaltyScore: appliedTrackedMapPenalty,
  });
  const campaignProfile = currentSecondEditionCampaignProfile();
  const superheroicDieCodeCap =
    actor.type === "character" &&
    campaignProfile.superheroicDieCodeCap !== "none"
      ? campaignProfile.superheroicDieCodeCap
      : undefined;
  const request: D6RollRequestV1 = Object.freeze({
    contractVersion: D6_ROLL_CONTRACT_VERSION,
    ...(advancedSkill === undefined &&
    finalRollPlan.totalPenaltyScore === 0 &&
    options.requestedRoll === undefined &&
    options.combinedAction === undefined &&
    resolvedFeatureBonusScore === 0 &&
    gadgetBonusScore === 0 &&
    controls.manualDiceAdjustment === 0 &&
    scaleModifierScore === 0 &&
    requestSource.context === undefined &&
    superheroicDieCodeCap === undefined &&
    controls.target === undefined
      ? {}
      : {
          context: {
            ...requestSource.context,
            ...(options.combinedAction === undefined
              ? {}
              : { combinedAction: options.combinedAction.context }),
            ...(superheroicDieCodeCap === undefined
              ? {}
              : {
                  superheroicDieCodeCap: {
                    cap: superheroicDieCodeCap,
                    sourcePage: 208 as const,
                  },
                }),
            ...(environmentContext === undefined
              ? {}
              : { environment: environmentContext }),
            ...(finalRollPlan.totalPenaltyScore === 0
              ? {}
              : {
                  actionEconomy: {
                    ...(roundState?.actions.length
                      ? { actionCount: roundState.actions.length }
                      : roundState?.firstEditionCommitment
                        ? {
                            actionCount:
                              roundState.firstEditionCommitment
                                .plannedActionCount,
                          }
                        : {}),
                    actionPenaltyScore: finalRollPlan.mapPenaltyScore,
                    actionCountLabel: actionEconomyStrategy.actionCountLabel,
                    condition: firstEditionDamage
                      ? effectiveFirstEditionWound
                      : condition,
                    conditionPenaltyScore: conditionPenalty,
                    environmentPenaltyScore: environmentPenalty,
                    extraordinaryPowerPenaltyScore: extraordinaryPowerPenalty,
                    mapPenaltyScore: finalRollPlan.mapPenaltyScore,
                    mapPenaltySource: finalRollPlan.mapPenaltySource,
                    movementSkillPenaltyScore: movementPenalty,
                    penaltyLabel: `−${formatPipScore(
                      finalRollPlan.totalPenaltyScore,
                    )}`,
                    penaltyScore: finalRollPlan.totalPenaltyScore,
                    ...(roundState === null ? {} : { round: roundState.round }),
                    strategyId: actionEconomyStrategy.id,
                    trackedPenaltyScore: finalRollPlan.trackedMapPenaltyScore,
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
            ...(options.requestedRoll === undefined
              ? {}
              : { requestedRoll: options.requestedRoll }),
            ...(featureBonusScore === 0 || options.featureBonus === undefined
              ? {}
              : { featureBonus: options.featureBonus }),
            ...(ownedFeatureModifier.effects.length === 0
              ? {}
              : {
                  featureEffects: {
                    effects: ownedFeatureModifier.effects,
                    privateEffectCount: 0,
                    version: 1 as const,
                  },
                }),
            ...(superheroicEquipmentContext === undefined
              ? {}
              : { superheroicEquipment: superheroicEquipmentContext }),
            ...(controls.manualDiceAdjustment === 0
              ? {}
              : {
                  manualDiceAdjustment: {
                    dice: controls.manualDiceAdjustment,
                    score: controls.manualDiceAdjustment * 3,
                  },
                }),
            ...(controls.target === undefined
              ? {}
              : { scale: controls.target.scale }),
            ...(controls.target?.attack === undefined
              ? {}
              : {
                  weaponAttack: {
                    attackKind: controls.target.attack.attackKind,
                    baseDefense: controls.target.attack.baseDefense,
                    coverModifier: controls.target.attack.coverModifier,
                    coverSourcePage: controls.target.attack.coverSourcePage,
                    defense: controls.target.attack.defense,
                    defenseKind: controls.target.attack.defenseKind,
                    ...(controls.difficultySelection === undefined
                      ? {}
                      : {
                          difficultySelection: controls.difficultySelection,
                        }),
                    ...(controls.target.attack.defenseSourcePage === undefined
                      ? {}
                      : {
                          defenseSourcePage:
                            controls.target.attack.defenseSourcePage,
                        }),
                    ...(controls.target.attack.defenseStrategy === undefined
                      ? {}
                      : {
                          defenseStrategy:
                            controls.target.attack.defenseStrategy,
                        }),
                    ...(controls.target.attack.distance === undefined
                      ? {}
                      : { distance: controls.target.attack.distance }),
                    ...(controls.target.attack.feintPenalty === undefined
                      ? {}
                      : { feintPenalty: controls.target.attack.feintPenalty }),
                    ...(controls.target.attack.rangeBand === undefined
                      ? {}
                      : { rangeBand: controls.target.attack.rangeBand }),
                    targetActorId: controls.target.attack.targetActorId,
                    ...(controls.target.attack.targetHidden === true
                      ? { targetHidden: true }
                      : {}),
                    targetName: controls.target.attack.targetName,
                    ...(controls.target.attack.targetDodging === true
                      ? { targetDodging: true }
                      : {}),
                    ...(controls.target.attack.targetTokenId === undefined
                      ? {}
                      : {
                          targetTokenId: controls.target.attack.targetTokenId,
                        }),
                    weaponId: controls.target.attack.weaponId,
                  },
                }),
            ...(controls.target?.attack === undefined ||
            controls.target.damageScale === undefined ||
            requestSource.weaponDamageContinuation === undefined
              ? {}
              : {
                  weaponDamageContinuation: {
                    ...requestSource.weaponDamageContinuation,
                    scale: controls.target.damageScale,
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
    ...(controls.heroPointSpend > 0
      ? { heroPointSpend: controls.heroPointSpend }
      : {}),
    ...(controls.characterPointSpend > 0 || controls.fatePointUse !== "none"
      ? {
          openD6Resources: {
            characterPointSpend: controls.characterPointSpend,
            fatePoint: controls.fatePointUse,
          },
        }
      : {}),
    ...(controls.opposition === undefined
      ? {}
      : { opposition: controls.opposition }),
    resultModifier:
      controls.resultModifier + (options.automaticResultModifier ?? 0),
    ...(controls.target?.attack?.targetHidden === true
      ? { rollMode: ordinaryWeaponAttackRollMode(controls.rollMode, true) }
      : { rollMode: controls.rollMode }),
    score: finalRollPlan.effectiveScore,
    source: requestSource.source,
  });
  if (!finalRollPlan.legal) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Combat.Error.PoolBelowOneDie"),
    );
    return options.completeBelowOneDieAsFailure === true
      ? completedUnrollableExtraordinaryPowerResult(
          request,
          currentConfiguredRulesProfile().id,
          currentWildDieRuntimeStrategy().policy,
        )
      : null;
  }
  return executePreparedRoll(
    actor,
    request,
    options.suppressChatMessage === true,
    options.captureChatMessage,
    options.captureRollResult,
    options.captureRollExecution,
  );
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
  const metaCurrency = currentMetaCurrencyRuntimeStrategy();
  if (metaCurrency.heroPointStrategy === null) {
    throw new RangeError("D6E2.Roll.HeroPoint.SecondEditionRequired");
  }
  if (!metaCurrency.failedRollReroll) {
    throw new RangeError("D6E2.Roll.HeroPoint.HeroicRequired");
  }
  const balance = actorHeroPointBalance(actor);
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
  if (currentRetryRuntimeStrategy().followUp !== "doubling-down") {
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
  options: D6OrdinaryRollInvocationOptions = {},
): Promise<D6RollResultV1 | null> {
  const actor = actorDocument(actorValue);
  const attribute = record(record(actor.system.attributes)[attributeId]);
  const score = currentEffectivePipScore(integer(attribute.score));
  const terminology = currentTerminology();
  const label =
    terminologyAttributeLabel(terminology, attributeId) ??
    attributeId
      .replaceAll("-", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return executeActorRoll(
    actor,
    {
      kind: "attribute",
      label,
      score,
      source: {
        actorId: actor.id,
        actorName: actor.name,
        attributeId,
      },
    },
    options,
  );
}

export async function rollFirstEditionRecoveryCheck(
  actorValue: object,
  label: string,
  attributeId: string,
  fixedDifficulty?: number,
  skillItemId?: string,
  fixedScore?: number,
  ignoreConditionPenalty = false,
  durationContext?: D6RollContextV1["firstEditionDuration"],
): Promise<D6RollResultV1 | null> {
  const actor = actorDocument(actorValue);
  if (actor.isOwner !== true) {
    throw new Error("D6E2.Roll.OwnerRequired");
  }
  const skill = skillItemId ? actor.items.get(skillItemId) : undefined;
  if (skillItemId && skill?.type !== "skill") {
    throw new RangeError(
      `Recovery skill ${skillItemId} is not embedded in ${actor.name}.`,
    );
  }
  const governingAttributeId = skill
    ? stringValue(skill.system.attributeId) || attributeId
    : attributeId;
  const attribute = record(
    record(actor.system.attributes)[governingAttributeId],
  );
  const score = Number.isSafeInteger(fixedScore)
    ? Math.max(3, fixedScore ?? 3)
    : skill
      ? currentCombinedPipScore(
          integer(attribute.score),
          integer(skill.system.score),
        )
      : currentEffectivePipScore(integer(attribute.score));
  return executeActorRoll(
    actor,
    {
      ...(fixedDifficulty === undefined ? {} : { fixedDifficulty }),
      ...(durationContext === undefined
        ? {}
        : { context: { firstEditionDuration: durationContext } }),
      kind: skill ? "skill" : "attribute",
      label,
      score,
      source: {
        actorId: actor.id,
        actorName: actor.name,
        attributeId: governingAttributeId,
        ...(skill ? { itemId: skill.id } : {}),
      },
    },
    { ignoreActionEconomy: true, ignoreConditionPenalty },
  );
}

/** Roll a First Edition Strength or medicine healing check outside combat actions. */
export async function rollFirstEditionHealingCheck(
  actorValue: object,
  label: string,
  fixedDifficulty?: number,
  medicineItemId?: string,
): Promise<D6RollResultV1 | null> {
  return rollFirstEditionRecoveryCheck(
    actorValue,
    label,
    currentAttributeRole("strength"),
    fixedDifficulty,
    medicineItemId,
  );
}

/** Execute a mandatory end-of-round mortality check without an editable dialog. */
export async function rollFirstEditionAutomatedMortalityCheck(
  actorValue: object,
  label: string,
  difficulty: number,
  context: {
    readonly checkId: string;
    readonly completedRounds: number;
    readonly elapsedMinutes: number;
    readonly sourcePage: 76;
  },
): Promise<D6RollResultV1> {
  const actor = actorDocument(actorValue);
  if (actor.isOwner !== true) {
    throw new Error("D6E2.Roll.OwnerRequired");
  }
  const strengthId = currentAttributeRole("strength");
  const brawn = record(record(actor.system.attributes)[strengthId]);
  const result = await executePreparedRoll(
    actor,
    Object.freeze({
      contractVersion: D6_ROLL_CONTRACT_VERSION,
      context: { firstEditionMortality: context },
      difficulty,
      heroPointUse: "none",
      kind: "attribute",
      label,
      resultModifier: 0,
      rollMode: currentDefaultRollMode(),
      score: currentEffectivePipScore(integer(brawn.score)),
      source: {
        actorId: actor.id,
        actorName: actor.name,
        attributeId: strengthId,
      },
    }),
  );
  if (!result) {
    throw new Error("The mandatory mortality check did not produce a result.");
  }
  return result;
}

export async function rollFirstEditionUnconsciousDuration(
  actorValue: object,
): Promise<D6RollResultV1 | null> {
  return rollFirstEditionRecoveryCheck(
    actorValue,
    game.i18n.localize(
      "D6E2.Combat.FirstEdition.Consciousness.UnconsciousDuration",
    ),
    currentAttributeRole("strength"),
    undefined,
    undefined,
    30,
    false,
    {
      effect: "unconscious",
      source: "incapacitation",
      unit: "minutes",
    },
  );
}

/** Roll the legacy accumulating-stuns threshold duration of 2D minutes. */
export async function rollFirstEditionAccumulatingStunDuration(
  actorValue: object,
): Promise<D6RollResultV1 | null> {
  return rollFirstEditionRecoveryCheck(
    actorValue,
    game.i18n.localize(
      "D6E2.Combat.FirstEdition.AccumulatingStuns.UnconsciousDuration",
    ),
    currentAttributeRole("strength"),
    undefined,
    undefined,
    6,
    true,
    {
      effect: "unconscious",
      source: "accumulating-stuns",
      unit: "minutes",
    },
  );
}

const FIRST_EDITION_DEFENSE_SKILLS: Readonly<
  Record<FirstEditionActiveDefenseKind, string>
> = Object.freeze({
  block: "brawling",
  dodge: "dodge",
  parry: "melee-combat",
});

export async function rollFirstEditionDefense(
  actorValue: object,
  kind: FirstEditionActiveDefenseKind,
): Promise<D6RollResultV1 | null> {
  const actor = actorDocument(actorValue);
  if (
    currentDefenseRuntimeStrategy().activeDefense !== "committed-roll" ||
    currentDefenseRuntimeStrategy().reaction !== "triggered-interrupt"
  ) {
    throw new RangeError(
      "D6E2.Combat.Error.FirstEditionActiveDefensesInactive",
    );
  }
  const roundState = readCombatantRound(actor);
  if (!roundState) {
    ui.notifications.warn(game.i18n.localize("D6E2.Combat.Error.NotInCombat"));
    return null;
  }
  const commitment = roundState.firstEditionCommitment;
  if (!commitment || commitment.defense === "none") {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Combat.Error.FirstEditionDefenseRequired"),
    );
    return null;
  }
  if (roundState.firstEditionActiveDefense) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Combat.Error.FirstEditionDefenseLocked"),
    );
    return null;
  }
  const skillKey = FIRST_EDITION_DEFENSE_SKILLS[kind];
  const skill = actor.items.contents.find(
    (candidate) =>
      candidate.type === "skill" && candidate.system.key === skillKey,
  );
  if (!skill) {
    ui.notifications.warn(
      game.i18n.format("D6E2.Combat.Error.FirstEditionDefenseSkillRequired", {
        skill: skillKey,
      }),
    );
    return null;
  }
  const attributeId = stringValue(skill.system.attributeId);
  const attribute = record(record(actor.system.attributes)[attributeId]);
  const score = currentCombinedPipScore(
    integer(attribute.score),
    integer(skill.system.score),
  );
  const mode = commitment.defense === "full-defense" ? "full" : "partial";
  const plan = firstEditionActiveDefensePlan(
    kind,
    mode,
    score,
    roundState.firstEditionActionPenaltyScore,
  );
  if (!plan.legal) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Combat.Error.PoolBelowOneDie"),
    );
    return null;
  }
  const label = game.i18n.localize(
    kind === "block"
      ? "D6E2.Combat.Block"
      : kind === "dodge"
        ? "D6E2.Combat.Dodge"
        : "D6E2.Combat.Parry",
  );
  const result = await executeActorRoll(
    actor,
    {
      context: {
        firstEditionActiveDefense: {
          kind,
          mode,
          resultModifier: plan.resultModifier,
          sourcePage: 73,
        },
      },
      kind: "skill",
      label,
      score,
      source: {
        actorId: actor.id,
        actorName: actor.name,
        attributeId,
        itemId: skill.id,
      },
    },
    {
      automaticResultModifier: plan.resultModifier,
      ignoreTrackedMapPenalty: mode === "full",
    },
  );
  if (!result) return null;
  try {
    await game.system.api?.combat.recordFirstEditionDefense(actor, {
      consumeAction: commitment.spentActionCount === 0,
      difficulty: result.total,
      expectedRevision: roundState.revision,
      kind,
      label,
      mode,
      sourceId: skill.id,
      total: result.total,
    });
  } catch (error) {
    ui.notifications.warn(
      game.i18n.localize(
        error instanceof Error ? error.message : String(error),
      ),
    );
  }
  return result;
}

function advancedSkillContextOptions(
  actor: FoundryActorDocument,
  baseSkill: FoundryItemDocument,
  baseScore: number,
): readonly AdvancedSkillContextOption[] {
  const capabilities = currentOptionalCapabilityRuntime();
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
          description: itemDescriptionExcerpt(
            candidate.system.description,
            520,
          ),
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
  options: D6OrdinaryRollInvocationOptions = {},
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
      currentOptionalCapabilityRuntime().advancedSkills.state === "active"
        ? currentEffectivePipScore(integer(parent.system.score))
        : currentCombinedPipScore(
            integer(parentAttribute.score),
            integer(parent.system.score),
          );
    const specializationLabel = `${parent.name}: ${skill.name}`;
    const specializationPool = specializationScore(
      parentScore,
      currentEffectivePipScore(integer(skill.system.score)),
    );
    const source = {
      actorId: actor.id,
      actorName: actor.name,
      attributeId: parentAttributeId,
      itemId: skill.id,
    };
    return executeActorRoll(
      actor,
      {
        kind: "skill",
        label: specializationLabel,
        score: specializationPool,
        source,
      },
      options,
    );
  }
  const attributeId =
    typeof skill.system.attributeId === "string"
      ? skill.system.attributeId
      : "";
  const advanced = skill.system.training === "advanced";
  const psionic = skill.system.training === "psionic";
  if (psionic && !currentSecondEditionCampaignProfile().psionics) {
    ui.notifications.warn(game.i18n.localize("D6E2.Psionics.ModuleRequired"));
    return null;
  }
  const advancedSkillsActive =
    currentOptionalCapabilityRuntime().advancedSkills.state === "active";
  if (advanced && !advancedSkillsActive) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Roll.AdvancedSkillInactive"),
    );
    return null;
  }
  const secondEditionAdvanced = advanced && advancedSkillsActive;
  const attribute = record(record(actor.system.attributes)[attributeId]);
  const score =
    secondEditionAdvanced || psionic
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
  const source = {
    actorId: actor.id,
    actorName: actor.name,
    attributeId,
    itemId: skill.id,
  };
  return executeActorRoll(
    actor,
    {
      advancedSkillContexts:
        secondEditionAdvanced || psionic
          ? []
          : advancedSkillContextOptions(actor, skill, score),
      kind: "skill",
      label: skill.name,
      score,
      source,
    },
    options,
  );
}

export async function rollExtraordinaryPowerSkill(
  actorValue: object,
  itemId: string,
  context: NonNullable<D6RollContextV1["extraordinaryPower"]>,
  difficulty: number,
  powerLabel: string,
): Promise<D6RollResultV1 | null> {
  return executeExtraordinaryPowerSkillRoll(
    actorValue,
    itemId,
    context,
    `${powerLabel} · `,
    difficulty,
    true,
  );
}

export async function rollExtraordinaryPowerSkillDirect(
  actorValue: object,
  itemId: string,
  context: NonNullable<D6RollContextV1["extraordinaryPower"]>,
): Promise<D6RollResultV1 | null> {
  return executeExtraordinaryPowerSkillRoll(actorValue, itemId, context, "");
}

async function executeExtraordinaryPowerSkillRoll(
  actorValue: object,
  itemId: string,
  context: NonNullable<D6RollContextV1["extraordinaryPower"]>,
  labelPrefix: string,
  fixedDifficulty?: number,
  completeBelowOneDieAsFailure = false,
): Promise<D6RollResultV1 | null> {
  const actor = actorDocument(actorValue);
  const skill = actor.items.get(itemId);
  if (skill?.type !== "skill") {
    throw new RangeError(`Skill ${itemId} is not embedded in ${actor.name}.`);
  }
  const attributeId = stringValue(skill.system.attributeId);
  const attribute = record(record(actor.system.attributes)[attributeId]);
  const standalone =
    skill.system.training === "advanced" || skill.system.training === "psionic";
  const score = standalone
    ? currentEffectivePipScore(integer(skill.system.score))
    : currentCombinedPipScore(
        integer(attribute.score),
        integer(skill.system.score),
      );
  return executeActorRoll(
    actor,
    {
      context: { extraordinaryPower: context },
      ...(fixedDifficulty === undefined ? {} : { fixedDifficulty }),
      kind: "skill",
      label: `${labelPrefix}${skill.name}`,
      score: Math.max(0, score - context.frameworkPenaltyScore),
      source: {
        actorId: actor.id,
        actorName: actor.name,
        attributeId,
        itemId: skill.id,
      },
    },
    { completeBelowOneDieAsFailure },
  );
}

export async function rollPsionicPower(
  actorValue: object,
  powerId: string,
  options: D6PsionicPowerRollOptionsV1 = {},
): Promise<D6RollResultV1 | null> {
  const actor = actorDocument(actorValue);
  if (actor.isOwner !== true) throw new Error("D6E2.Psionics.OwnerRequired");
  if (!currentSecondEditionCampaignProfile().psionics) {
    ui.notifications.warn(game.i18n.localize("D6E2.Psionics.ModuleRequired"));
    return null;
  }
  const state = readActorPsionics(actor);
  const power = state.powers.find((candidate) => candidate.id === powerId);
  if (!power) throw new RangeError(`Unknown psionic power ${powerId}.`);
  if (!power.available || power.poolScore < 3) {
    ui.notifications.warn(game.i18n.localize("D6E2.Psionics.TrainingRequired"));
    return null;
  }
  const difficultyModifier = Math.max(
    0,
    Math.trunc(options.difficultyModifier ?? 0),
  );
  const scalingDifficulty =
    power.recentAttempts * (power.scalingDifficultyPerAttempt ?? 0);
  const sourceItemId = state.disciplines.find(({ trained }) => trained)?.itemId;
  const roll = await executeActorRoll(actor, {
    context: {
      psionics: {
        baseDifficulty: power.baseDifficulty,
        difficultyModifier,
        disciplines: power.disciplines,
        powerId,
        recentAttempts: power.recentAttempts,
        scalingDifficulty,
        sourceBook: power.source.book,
        sourcePage: power.source.page,
      },
    },
    fixedDifficulty:
      power.baseDifficulty + scalingDifficulty + difficultyModifier,
    kind: "skill",
    label: power.label,
    score: power.poolScore,
    source: {
      actorId: actor.id,
      actorName: actor.name,
      attributeId: "psionics",
      ...(sourceItemId ? { itemId: sourceItemId } : {}),
    },
  });
  if (roll) await recordPsionicAttempt(actor, powerId);
  return roll;
}

export type CyberpunkHackOutcome =
  "data" | "disable" | "fry" | "misdirect" | "operate";

function cyberpunkSkillPool(
  actor: FoundryActorDocument,
  key: "computers" | "medicine",
): {
  readonly attributeId: string;
  readonly item: FoundryItemDocument;
  readonly score: number;
} {
  const item = actor.items.contents.find(
    (candidate) =>
      candidate.type === "skill" && stringValue(candidate.system.key) === key,
  );
  if (!item) throw new Error("D6E2.Cyberpunk.SkillRequired");
  const attributeId = stringValue(item.system.attributeId) || "technical";
  const attribute = record(record(actor.system.attributes)[attributeId]);
  return Object.freeze({
    attributeId,
    item,
    score: currentCombinedPipScore(
      integer(attribute.score),
      integer(item.system.score),
    ),
  });
}

async function postCyberpunkResult(
  actor: FoundryActorDocument,
  context: Record<string, unknown>,
): Promise<void> {
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/roll/cyberpunk-result.hbs`,
    context,
  );
  await ChatMessage.create({
    content,
    flags: { [SYSTEM_ID]: { cyberpunk: structuredClone(context) } },
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}

export async function rollCyberpunkHack(
  actorValue: object,
  targetLabel: string,
  firewallValue: number,
  outcome: CyberpunkHackOutcome,
  targetActorValue?: object,
  targetItemId?: string,
): Promise<D6RollResultV1 | null> {
  const actor = actorDocument(actorValue);
  if (actor.isOwner !== true) throw new Error("D6E2.Cyberpunk.OwnerRequired");
  if (!cyberpunkModuleActive())
    throw new Error("D6E2.Cyberpunk.ModuleRequired");
  const firewall = Math.max(0, Math.trunc(firewallValue));
  const targetLabelSafe =
    targetLabel.trim() || game.i18n.localize("D6E2.Cyberpunk.NetworkTarget");
  if (outcome === "disable" && (!targetActorValue || !targetItemId)) {
    throw new Error("D6E2.Cyberpunk.CyberwareTargetRequired");
  }
  const pool = cyberpunkSkillPool(actor, "computers");
  const result = await executeActorRoll(actor, {
    context: {
      cyberpunk: {
        action: "hack",
        sourcePage: 192,
        targetLabel: targetLabelSafe,
      },
    },
    fixedDifficulty: firewall,
    kind: "skill",
    label: game.i18n.format("D6E2.Cyberpunk.HackLabel", {
      target: targetLabelSafe,
    }),
    score: pool.score,
    source: {
      actorId: actor.id,
      actorName: actor.name,
      attributeId: pool.attributeId,
      itemId: pool.item.id,
    },
  });
  if (!result?.difficulty) return result;
  let consequence = "none";
  let consequenceDie = 0;
  let damageTotal = 0;
  let disableTurns = 0;
  if (!result.success) {
    const failureMargin = Math.max(0, -result.difficulty.margin);
    if (failureMargin >= 5) {
      const roll = await new Roll("1d6").evaluate();
      consequenceDie = Math.trunc(roll.total);
      consequence = hackingConsequence(failureMargin, consequenceDie);
    }
  } else if (targetActorValue && targetItemId && outcome === "disable") {
    const targetActor = actorDocument(targetActorValue);
    const targetItem = targetActor.items.get(targetItemId);
    if (targetItem?.type !== "cybernetic") {
      throw new Error("D6E2.Cyberpunk.CyberwareTargetRequired");
    }
    const combat = (
      game as FoundryGame & {
        readonly combat?: {
          readonly id: string;
          readonly combatants: {
            readonly contents: readonly {
              readonly actor?: { readonly id: string } | null;
              readonly id: string;
            }[];
          };
          readonly round?: number;
          readonly turn?: number;
          readonly turns: readonly { readonly id: string }[];
        };
      }
    ).combat;
    const combatant = combat?.combatants.contents.find(
      (candidate) => candidate.actor?.id === targetActor.id,
    );
    if (!combat || !combatant) throw new Error("D6E2.Cyberpunk.CombatRequired");
    const targetTurn = combat.turns.findIndex(
      (candidate) => candidate.id === combatant.id,
    );
    disableTurns = Math.max(1, cyberwareDisableTurns(pool.score));
    const currentTurn = integer(combat.turn);
    const untilRound =
      integer(combat.round) + disableTurns - (targetTurn > currentTurn ? 1 : 0);
    await targetItem.update({
      "system.disabled": {
        combatId: combat.id,
        untilRound,
        untilTurn: Math.max(0, targetTurn),
      },
    });
  } else if (targetActorValue && targetItemId && outcome === "fry") {
    const targetActor = actorDocument(targetActorValue);
    const damage = await new Roll("2d6").evaluate();
    damageTotal = Math.max(0, Math.trunc(damage.total));
    await rollResistanceAgainst(targetActor, undefined, damageTotal);
  }
  await postCyberpunkResult(actor, {
    action: "hack",
    consequence,
    consequenceDie,
    damageTotal,
    disableTurns,
    firewall,
    outcome,
    sourcePage: 192,
    success: result.success === true,
    targetLabel: targetLabelSafe,
  });
  return result;
}

export async function rollCyberpunkInstallation(
  targetActorValue: object,
  itemId: string,
  installerActorValue: object,
): Promise<D6RollResultV1 | null> {
  const target = actorDocument(targetActorValue);
  const installer = actorDocument(installerActorValue);
  if (target.isOwner !== true || installer.isOwner !== true) {
    throw new Error("D6E2.Cyberpunk.OwnerRequired");
  }
  if (!cyberpunkModuleActive())
    throw new Error("D6E2.Cyberpunk.ModuleRequired");
  if (!currentSecondEditionCampaignProfile().perksFlawsTalents) {
    throw new Error("D6E2.Cyberpunk.TalentsRequired");
  }
  const item = target.items.get(itemId);
  if (item?.type !== "cybernetic") {
    throw new Error("D6E2.Cyberpunk.CyberwareTargetRequired");
  }
  if (item.system.installed === true)
    throw new Error("D6E2.Cyberpunk.AlreadyInstalled");
  if (!canInstallAugmentation(target, item)) {
    throw new Error("D6E2.Cyberpunk.CapacityExceeded");
  }
  const state = readActorCyberpunk(target);
  const previousCount =
    stringValue(item.system.augmentationKind) === "bioware"
      ? state.biowareCount
      : state.cyberwareCount;
  const difficulty = augmentationInstallDifficulty(previousCount);
  const minutes = augmentationInstallMinutes(previousCount);
  const pool = cyberpunkSkillPool(installer, "medicine");
  const result = await executeActorRoll(installer, {
    context: {
      cyberpunk: { action: "install", sourcePage: 195, targetLabel: item.name },
    },
    fixedDifficulty: difficulty,
    kind: "skill",
    label: game.i18n.format("D6E2.Cyberpunk.InstallLabel", {
      target: item.name,
    }),
    score: pool.score,
    source: {
      actorId: installer.id,
      actorName: installer.name,
      attributeId: pool.attributeId,
      itemId: pool.item.id,
    },
  });
  if (!result) return null;
  const complication = result.success !== true && result.wildFaces.at(0) === 1;
  if (result.success) {
    await item.update({
      "system.equipped": true,
      "system.installed": true,
      "system.installation": {
        difficulty,
        installerName: installer.name,
        minutes,
        previousCount,
      },
    });
  } else if (complication) {
    await item.update({ "system.quantity": 0 });
    await rollResistanceAgainst(target, undefined, difficulty);
  }
  await postCyberpunkResult(installer, {
    action: "install",
    complication,
    difficulty,
    installerName: installer.name,
    minutes,
    sourcePage: 195,
    success: result.success === true,
    targetLabel: item.name,
  });
  return result;
}

const FREEFORM_MAGIC_SCHOOL_ALIASES = Object.freeze({
  alteration: ["alteration", "change"],
  apportation: ["apportation", "movement"],
  conjuration: ["conjuration", "creation"],
  divination: ["divination", "knowledge"],
} as const);

function freeformMagicDesign(
  item: FoundryItemDocument,
): D6FreeformMagicDesignV1 {
  return Object.freeze({
    castingTime: stringValue(
      item.system.castingTime,
      "action",
    ) as D6FreeformMagicDesignV1["castingTime"],
    duration: stringValue(
      item.system.duration,
      "instant",
    ) as D6FreeformMagicDesignV1["duration"],
    power: Math.max(1, integer(item.system.power)),
    range: stringValue(
      item.system.range,
      "melee",
    ) as D6FreeformMagicDesignV1["range"],
    resistance: stringValue(
      item.system.resistance,
      "partial",
    ) as D6FreeformMagicDesignV1["resistance"],
    school: stringValue(
      item.system.school,
      "alteration",
    ) as D6FreeformMagicDesignV1["school"],
    target: stringValue(
      item.system.target,
      "one",
    ) as D6FreeformMagicDesignV1["target"],
  });
}

export async function castFreeformMagic(
  actorValue: object,
  manifestationId: string,
): Promise<D6MagicCastResultV1 | null> {
  const actor = actorDocument(actorValue);
  if (actor.isOwner !== true) throw new Error("D6E2.Magic.OwnerRequired");
  const manifestation = actor.items.get(manifestationId);
  if (manifestation?.type !== "manifestation") {
    throw new RangeError(
      `Manifestation ${manifestationId} is not embedded in ${actor.name}.`,
    );
  }
  if (manifestation.system.magicSystem === "first-edition-fantasy") {
    return castFirstEditionFantasyMagic(actor, manifestation);
  }
  if (manifestation.system.magicSystem === "first-edition-adventure") {
    return castFirstEditionAdventureMagic(actor, manifestation);
  }
  if (!currentSecondEditionCampaignProfile().freeformSkillBasedMagic) {
    ui.notifications.warn(game.i18n.localize("D6E2.Magic.ModuleRequired"));
    return null;
  }
  const design = freeformMagicDesign(manifestation);
  const difficulty = freeformMagicDifficulty(design);
  if (currentSecondEditionCampaignProfile().magicPointsCasting) {
    return castMagicPoints(actor, manifestation, design, difficulty);
  }
  const parent = actor.items.contents.find(
    (candidate) =>
      candidate.type === "skill" && candidate.system.key === "spell-school",
  );
  const aliases: readonly string[] =
    FREEFORM_MAGIC_SCHOOL_ALIASES[design.school];
  const specialization = parent
    ? actor.items.contents.find((candidate) => {
        if (candidate.type !== "specialization") return false;
        const linked =
          candidate.system.parentSkillId === parent.id ||
          candidate.system.parentSkillKey === "spell-school";
        const key = stringValue(candidate.system.key).toLocaleLowerCase();
        const name = candidate.name.trim().toLocaleLowerCase();
        return (
          linked &&
          aliases.some((alias) => name === alias || key.endsWith(`-${alias}`))
        );
      })
    : undefined;
  const magicAttribute = record(record(actor.system.attributes).magic);
  const attributeScore = currentEffectivePipScore(
    integer(magicAttribute.score),
  );
  const parentSkillScore = parent
    ? currentEffectivePipScore(integer(parent.system.score))
    : 0;
  const untrainedPenalty = freeformMagicUntrainedPenalty(
    specialization !== undefined,
    attributeScore,
    parentSkillScore,
  );
  const baseScore = currentCombinedPipScore(attributeScore, parentSkillScore);
  const score = specialization
    ? specializationScore(
        baseScore,
        currentEffectivePipScore(integer(specialization.system.score)),
      )
    : Math.max(3, baseScore);
  const roll = await executeActorRoll(actor, {
    context: {
      magic: {
        castingTime: design.castingTime,
        duration: design.duration,
        manifestationId,
        power: design.power,
        range: design.range,
        resistance: design.resistance,
        school: design.school,
        sourcePages: [145, 159],
        target: design.target,
        untrainedPenalty,
      },
    },
    fixedDifficulty: difficulty.difficulty + untrainedPenalty,
    kind: "skill",
    label: `${manifestation.name} · ${game.i18n.localize(`D6E2.Magic.School.${design.school}`)}`,
    score,
    source: {
      actorId: actor.id,
      actorName: actor.name,
      attributeId: "magic",
      ...(specialization
        ? { itemId: specialization.id }
        : parent
          ? { itemId: parent.id }
          : {}),
    },
  });
  if (!roll) return null;
  return Object.freeze({
    design,
    difficulty,
    manifestationId,
    roll,
    ...(specialization ? { schoolSpecializationId: specialization.id } : {}),
    untrainedPenalty,
  });
}

async function castFirstEditionFantasyMagic(
  actor: FoundryActorDocument,
  manifestation: FoundryItemDocument,
): Promise<D6FirstEditionFantasyMagicCastResultV1 | null> {
  if (
    currentAttributeRuntimeStrategy().family !== "open-d6" ||
    currentFirstEditionGenreProfile().genreId !== "open-d6-fantasy-d6-system-2e"
  ) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Magic.FirstEditionFantasyRequired"),
    );
    return null;
  }
  const stored = record(manifestation.system.firstEdition);
  const tradition = stored.tradition === "miracles" ? "miracles" : "magic";
  const skillKey = stringValue(
    stored.skillKey,
    tradition === "miracles" ? "miracles-favor" : "magic-alteration",
  );
  const difficulty = Math.max(
    tradition === "miracles" ? 5 : 2,
    integer(stored.difficulty),
  );
  const sourcePage = Math.max(83, integer(stored.sourcePage));
  const skill = actor.items.contents.find(
    (candidate) =>
      candidate.type === "skill" &&
      stringValue(candidate.system.key) === skillKey,
  );
  const attribute = record(record(actor.system.attributes).extranormal);
  const attributeScore = currentEffectivePipScore(integer(attribute.score));
  const skillScore = skill
    ? currentEffectivePipScore(integer(skill.system.score))
    : 0;
  const untrainedPenalty = skill ? 0 : 5;
  const roll = await executeActorRoll(actor, {
    context: {
      magic: {
        difficulty,
        manifestationId: manifestation.id,
        skillKey,
        sourceBook: "D6 Fantasy",
        sourcePage,
        strategy: "first-edition-fantasy",
        tradition,
        untrainedPenalty,
      },
    },
    fixedDifficulty: difficulty + untrainedPenalty,
    kind: "skill",
    label: `${manifestation.name} · ${game.i18n.localize(
      tradition === "miracles"
        ? "D6E2.Magic.FirstEdition.Miracle"
        : "D6E2.Magic.FirstEdition.Spell",
    )}`,
    score: currentCombinedPipScore(attributeScore, skillScore),
    source: {
      actorId: actor.id,
      actorName: actor.name,
      attributeId: "extranormal",
      ...(skill ? { itemId: skill.id } : {}),
    },
  });
  if (!roll) return null;
  return Object.freeze({
    contractVersion: D6_FIRST_EDITION_FANTASY_MAGIC_CONTRACT_VERSION,
    design: Object.freeze({ difficulty, skillKey, sourcePage, tradition }),
    manifestationId: manifestation.id,
    roll,
    strategy: "first-edition-fantasy",
    untrainedPenalty,
  });
}

async function castFirstEditionAdventureMagic(
  actor: FoundryActorDocument,
  manifestation: FoundryItemDocument,
): Promise<D6FirstEditionAdventureMagicCastResultV1 | null> {
  if (
    currentAttributeRuntimeStrategy().family !== "open-d6" ||
    currentFirstEditionGenreProfile().genreId !==
      "open-d6-adventure-d6-system-2e"
  ) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Magic.FirstEditionAdventureRequired"),
    );
    return null;
  }
  const stored = record(manifestation.system.firstEdition);
  const tradition = stored.tradition === "psionics" ? "psionics" : "magic";
  const skillKey = stringValue(
    stored.skillKey,
    tradition === "psionics" ? "psionics-telepathy" : "magic-alteration",
  );
  const difficulty = Math.max(2, integer(stored.difficulty));
  const sourcePage = Math.max(83, integer(stored.sourcePage));
  const skill = actor.items.contents.find(
    (candidate) =>
      candidate.type === "skill" &&
      stringValue(candidate.system.key) === skillKey,
  );
  const attribute = record(record(actor.system.attributes).extranormal);
  const attributeScore = currentEffectivePipScore(integer(attribute.score));
  const skillScore = skill
    ? currentEffectivePipScore(integer(skill.system.score))
    : 0;
  const untrainedPenalty = skill ? 0 : 5;
  const roll = await executeActorRoll(actor, {
    context: {
      magic: {
        difficulty,
        manifestationId: manifestation.id,
        skillKey,
        sourceBook: "D6 Adventure",
        sourcePage,
        strategy: "first-edition-adventure",
        tradition,
        untrainedPenalty,
      },
    },
    fixedDifficulty: difficulty + untrainedPenalty,
    kind: "skill",
    label: `${manifestation.name} · ${game.i18n.localize(
      tradition === "psionics"
        ? "D6E2.Magic.FirstEdition.Psionic"
        : "D6E2.Magic.FirstEdition.Spell",
    )}`,
    score: currentCombinedPipScore(attributeScore, skillScore),
    source: {
      actorId: actor.id,
      actorName: actor.name,
      attributeId: "extranormal",
      ...(skill ? { itemId: skill.id } : {}),
    },
  });
  if (!roll) return null;
  return Object.freeze({
    contractVersion: D6_FIRST_EDITION_ADVENTURE_MAGIC_CONTRACT_VERSION,
    design: Object.freeze({ difficulty, skillKey, sourcePage, tradition }),
    manifestationId: manifestation.id,
    roll,
    strategy: "first-edition-adventure",
    untrainedPenalty,
  });
}

function mysticalAlignmentSkill(
  actor: FoundryActorDocument,
): FoundryItemDocument | undefined {
  return actor.items.contents.find(
    (candidate) =>
      candidate.type === "skill" &&
      stringValue(candidate.system.key) === "mystical-alignment",
  );
}

export function actorMagicPointPool(actorValue: object): D6MagicPointPoolV1 {
  const actor = actorDocument(actorValue);
  const magic = record(record(actor.system.attributes).magic);
  const alignment = mysticalAlignmentSkill(actor);
  const stored = record(record(actor.system.resources).magicPoints);
  const derived = magicPointPool(
    integer(stored.value),
    currentEffectivePipScore(integer(magic.score)),
    currentEffectivePipScore(integer(alignment?.system.score)),
  );
  return stored.initialized === true
    ? derived
    : Object.freeze({ ...derived, current: derived.maximum });
}

async function persistMagicPointBalance(
  actor: FoundryActorDocument,
  value: number,
): Promise<void> {
  await withAuthorizedMagicPointUpdate(actor, () =>
    actor.update({
      "system.resources.magicPoints.initialized": true,
      "system.resources.magicPoints.value": value,
    }),
  );
}

export async function recoverActorMagicPoints(
  actorValue: object,
  hours = 1,
): Promise<D6MagicPointPoolV1> {
  const actor = actorDocument(actorValue);
  if (actor.isOwner !== true) throw new Error("D6E2.Magic.OwnerRequired");
  if (!currentSecondEditionCampaignProfile().magicPointsCasting) {
    throw new Error("D6E2.Magic.MagicPointsModuleRequired");
  }
  const recovered = recoverMagicPoints(actorMagicPointPool(actor), hours);
  await persistMagicPointBalance(actor, recovered.current);
  return recovered;
}

async function castMagicPoints(
  actor: FoundryActorDocument,
  manifestation: FoundryItemDocument,
  design: D6FreeformMagicDesignV1,
  difficulty: ReturnType<typeof freeformMagicDifficulty>,
): Promise<D6MagicPointCastResultV1 | null> {
  const alignment = mysticalAlignmentSkill(actor);
  if (currentEffectivePipScore(integer(alignment?.system.score)) < 3) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Magic.MysticalAlignmentRequired"),
    );
    return null;
  }
  const pool = actorMagicPointPool(actor);
  const cost = magicPointCastingCost(difficulty.difficulty);
  if (pool.current < cost) {
    ui.notifications.warn(
      game.i18n.format("D6E2.Magic.InsufficientMagicPoints", {
        cost,
        current: pool.current,
      }),
    );
    return null;
  }
  const nextPool = Object.freeze({ ...pool, current: pool.current - cost });
  await persistMagicPointBalance(actor, nextPool.current);
  const result: D6MagicPointCastResultV1 = Object.freeze({
    cost,
    design,
    difficulty,
    manifestationId: manifestation.id,
    pool: nextPool,
    sourcePages: [160, 162] as const,
    strategy: "magic-points",
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/roll/magic-point-cast.hbs`,
    {
      actor,
      cost,
      difficulty: difficulty.difficulty,
      castingTimeLabel: game.i18n.localize(
        `D6E2.Magic.CastingTime.${design.castingTime}`,
      ),
      durationLabel: game.i18n.localize(
        `D6E2.Magic.Duration.${design.duration}`,
      ),
      manifestation,
      remaining: nextPool.current,
      maximum: nextPool.maximum,
      rangeLabel: game.i18n.localize(`D6E2.Magic.Range.${design.range}`),
      resistanceLabel: game.i18n.localize(
        `D6E2.Magic.Resistance.${design.resistance}`,
      ),
      schoolLabel: game.i18n.localize(`D6E2.Magic.School.${design.school}`),
      targetLabel: game.i18n.localize(`D6E2.Magic.Target.${design.target}`),
    },
  );
  await ChatMessage.create({
    content,
    flags: {
      [SYSTEM_ID]: {
        magicPointCast: structuredClone(result),
      },
    },
    speaker: ChatMessage.getSpeaker({ actor }),
  });
  return result;
}

function environmentSkillScore(
  actor: FoundryActorDocument,
  skill: FoundryItemDocument,
): { readonly attributeId: string; readonly score: number } {
  if (skill.type !== "skill") {
    throw new RangeError(`Environment aid source ${skill.id} is not a Skill.`);
  }
  const attributeId = stringValue(skill.system.attributeId) || "brawn";
  const attribute = record(record(actor.system.attributes)[attributeId]);
  return Object.freeze({
    attributeId,
    score: currentCombinedPipScore(
      integer(attribute.score),
      integer(skill.system.score),
    ),
  });
}

export async function rollSecondEditionEnvironmentExposure(
  actorValue: object,
  threat: D6EnvironmentThreat,
  failureCondition: string,
): Promise<D6RollResultV1 | null> {
  const actor = actorDocument(actorValue);
  const stamina = actor.items.contents.find(
    (item) => item.type === "skill" && item.system.key === "stamina",
  );
  const source = stamina
    ? environmentSkillScore(actor, stamina)
    : {
        attributeId: "brawn",
        score: currentEffectivePipScore(
          integer(record(record(actor.system.attributes).brawn).score),
        ),
      };
  return executeActorRoll(
    actor,
    {
      context: {
        environment: environmentRollContext(
          actor,
          threat,
          "exposure",
          failureCondition,
        ),
      },
      fixedDifficulty: threat.difficulty,
      kind: stamina ? "skill" : "attribute",
      label: stamina?.name ?? game.i18n.localize("D6E2.Attribute.Brawn"),
      score: source.score,
      source: {
        actorId: actor.id,
        actorName: actor.name,
        attributeId: source.attributeId,
        ...(stamina ? { itemId: stamina.id } : {}),
      },
    },
    { ignoreActionEconomy: true },
  );
}

export async function rollSecondEditionEnvironmentAid(
  helperValue: object,
  skillItemId: string,
  targetValue: object,
  effect: D6EnvironmentEffectV1,
): Promise<D6RollResultV1 | null> {
  const helper = actorDocument(helperValue);
  const target = actorDocument(targetValue);
  const skill = helper.items.get(skillItemId);
  if (!skill) throw new RangeError("D6E2.Environment.Error.AidSkillMissing");
  const source = environmentSkillScore(helper, skill);
  return executeActorRoll(helper, {
    context: {
      environment: environmentRollContext(
        target,
        effect,
        "recovery",
        effect.appliedCondition,
      ),
    },
    fixedDifficulty: effect.difficulty,
    kind: "skill",
    label: skill.name,
    score: source.score,
    source: {
      actorId: helper.id,
      actorName: helper.name,
      attributeId: source.attributeId,
      itemId: skill.id,
    },
  });
}

const FIRST_EDITION_MOVEMENT_SKILLS = Object.freeze({
  climb: { attributeId: "brawn", key: "climb-jump" },
  fly: { attributeId: "agility", key: "flying-zero-g" },
  land: { attributeId: "agility", key: "running" },
  swim: { attributeId: "brawn", key: "swim" },
});

export async function rollFirstEditionMovementCheck(
  actorValue: object,
  plan: FirstEditionMovementPlan,
): Promise<D6RollResultV1 | null> {
  const actor = actorDocument(actorValue);
  if (!plan.rollRequired) return null;
  const source = FIRST_EDITION_MOVEMENT_SKILLS[plan.type];
  const skill = actor.items.contents.find(
    (candidate) =>
      candidate.type === "skill" && candidate.system.key === source.key,
  );
  const attributeId = skill
    ? stringValue(skill.system.attributeId) || source.attributeId
    : source.attributeId;
  const attribute = record(record(actor.system.attributes)[attributeId]);
  const score = skill
    ? currentCombinedPipScore(
        integer(attribute.score),
        integer(skill.system.score),
      )
    : currentEffectivePipScore(integer(attribute.score));
  return executeActorRoll(actor, {
    context: {
      firstEditionMovement: {
        difficulty: plan.difficulty,
        distance: plan.distance,
        sourcePage: plan.type === "land" ? 63 : 64,
        type: plan.type,
      },
    },
    fixedDifficulty: plan.difficulty,
    kind: skill ? "skill" : "attribute",
    label:
      skill?.name ??
      game.i18n.localize(`D6E2.Combat.FirstEdition.Movement.${plan.type}`),
    score,
    source: {
      actorId: actor.id,
      actorName: actor.name,
      attributeId,
      ...(skill ? { itemId: skill.id } : {}),
    },
  });
}

export async function rollFirstEditionSegmentRunningCheck(
  actorValue: object,
  difficulty: number,
  distance: number,
): Promise<D6RollResultV1 | null> {
  const plan: FirstEditionMovementPlan = {
    actionRequired: true,
    difficulty,
    distance,
    freeDistance: 0,
    maximumDistance: distance,
    movementRate: distance,
    rollRequired: true,
    type: "land",
  };
  return rollFirstEditionMovementCheck(actorValue, plan);
}

function lockedDamageTargetContext(
  actor: FoundryActorDocument,
  item: FoundryItemDocument,
  attack: D6WeaponAttackRollContext,
  plan: D6WeaponDamageContinuationRollContext,
): RollTargetContext | null {
  if (
    plan.scale.application !== "damage" ||
    plan.scale.sourceActorId !== actor.id ||
    plan.scale.targetActorId !== attack.targetActorId ||
    plan.scale.targetTokenId !== attack.targetTokenId
  )
    return null;
  const target = game.actors?.get(attack.targetActorId);
  const selectedTarget: RollTargetOption = Object.freeze({
    actorId: attack.targetActorId,
    damageScale: plan.scale,
    id: attack.targetTokenId ?? attack.targetActorId,
    img: target?.img.trim() ?? "",
    name: attack.targetName,
    optionLabel: attack.targetName,
    outOfRange: false,
    purpose: "damage",
    rangeLabel: "",
    scale: plan.scale,
    selected: true,
    weaponId: item.id,
  });
  return Object.freeze({
    hasAuthoritativeTargetDifficulty: false,
    hasTargets: true,
    purpose: "damage",
    selectedTarget,
    targets: Object.freeze([selectedTarget]),
  });
}

interface PendingAutofireState {
  readonly attackModifier?: unknown;
  readonly bindingId?: unknown;
  readonly damageModifier?: unknown;
  readonly maximum?: unknown;
  readonly sourcePage?: unknown;
  readonly spend?: unknown;
}

export function d6BoundWeaponDamageAutofire(
  plan: D6WeaponDamageContinuationRollContext | undefined,
  pending: PendingAutofireState,
): D6SecondEditionAutofireRollContext | undefined {
  if (plan) return plan.autofire;
  if (stringValue(pending.bindingId).trim()) return undefined;
  const damageModifier = Math.max(0, integer(pending.damageModifier));
  const spend = Math.max(0, integer(pending.spend));
  if (damageModifier === 0 || spend === 0) return undefined;
  return Object.freeze({
    attackModifier: -spend,
    damageModifier,
    maximum: Math.max(0, integer(pending.maximum)),
    sourcePage: 163,
    spend,
  });
}

export function d6BoundWeaponDamageConsumesPending(
  plan: D6WeaponDamageContinuationRollContext | undefined,
  pending: PendingAutofireState,
): boolean {
  return (
    plan === undefined || stringValue(pending.bindingId) === plan.bindingId
  );
}

export function d6PendingAutofireForAttack(
  bindingId: string,
  autofire: D6SecondEditionAutofireRollContext,
):
  (D6SecondEditionAutofireRollContext & { readonly bindingId: string }) | null {
  return autofire.spend > 0 ? Object.freeze({ ...autofire, bindingId }) : null;
}

export function d6WeaponDamageBaseForContinuation(
  plan: D6WeaponDamageContinuationRollContext | undefined,
  current: () => ReturnType<typeof resolveWeaponDamageBase>,
): Pick<D6WeaponDamageContinuationRollContext, "score" | "weaponDamage"> {
  if (plan) return { score: plan.score, weaponDamage: plan.weaponDamage };
  const resolved = current();
  return {
    score: resolved.score,
    weaponDamage: {
      attributeId: resolved.attributeId,
      baseKind: resolved.baseKind,
      baseScore: resolved.baseScore,
      configuredSkillKey: resolved.configuredSkillKey,
      listedDamageScore: resolved.listedDamageScore,
      ...(resolved.skillItemId ? { skillItemId: resolved.skillItemId } : {}),
      ...(resolved.skillName ? { skillName: resolved.skillName } : {}),
    },
  };
}

async function rollWeaponDamage(
  actor: FoundryActorDocument,
  item: FoundryItemDocument,
  options: InternalRollInvocationOptions,
  targetContext = buildWeaponAttackTargetContext(actor, item, "damage"),
  boundPlan?: D6WeaponDamageContinuationRollContext,
): Promise<D6RollResultV1 | null> {
  const pending = record(
    record((item as FoundryItemDocument & { readonly flags?: unknown }).flags)[
      SYSTEM_ID
    ],
  ).pendingAutofire;
  const pendingAutofire = record(pending);
  const autofire = d6BoundWeaponDamageAutofire(boundPlan, pendingAutofire);
  const damageModifier = autofire?.damageModifier ?? 0;
  const damageBase = d6WeaponDamageBaseForContinuation(boundPlan, () =>
    resolveWeaponDamageBase(
      actor,
      item,
      activeStrengthAttributeId(),
      currentAttributeRuntimeStrategy().family === "open-d6",
    ),
  );
  const result = await executeActorRoll(
    actor,
    {
      context: {
        ...(autofire
          ? {
              autofire: {
                attackModifier: autofire.attackModifier,
                damageModifier,
                maximum: autofire.maximum,
                sourcePage: 163,
                spend: autofire.spend,
              },
            }
          : {}),
        weaponDamage: damageBase.weaponDamage,
      },
      kind: "damage",
      label: `${item.name} · ${game.i18n.localize("D6E2.Item.Damage")}`,
      score: damageBase.score,
      source: {
        actorId: actor.id,
        actorName: actor.name,
        attributeId: damageBase.weaponDamage.attributeId,
        itemId: item.id,
      },
      targetContext,
    },
    {
      ...options,
      automaticResultModifier: damageModifier,
      ...(damageModifier > 0
        ? {
            automaticResultModifierLabel: game.i18n.localize(
              "D6E2.Combat.ActiveResponsive.AutofireDamageBonus",
            ),
          }
        : {}),
    },
  );
  if (damageModifier > 0 && result) {
    if (d6BoundWeaponDamageConsumesPending(boundPlan, pendingAutofire)) {
      await item.update({ [`flags.${SYSTEM_ID}.pendingAutofire`]: null });
    }
  }
  return result;
}

export async function rollSuccessfulWeaponAttackDamage(
  actorValue: object,
  attackResult: D6RollResultV1,
  damagePlan: D6WeaponDamageContinuationRollContext,
  continuation: {
    readonly captureRollExecution?: (
      result: D6RollResultV1,
      artifacts: readonly FoundryRoll[],
    ) => Promise<void> | void;
    readonly fixedRollMode?: D6RollMode;
    readonly suppressChatMessage?: boolean;
  } = {},
): Promise<D6RollResultV1 | null> {
  const actor = actorDocument(actorValue);
  const attack = attackResult.request.context?.weaponAttack;
  const capturedPlan = attackResult.request.context?.weaponDamageContinuation;
  if (!attack || !capturedPlan) {
    throw new RangeError("D6E2.Combat.Damage.SuccessfulHitRequired");
  }
  if (
    actor.isOwner !== true ||
    attackResult.success !== true ||
    attackResult.request.kind !== "weapon-attack" ||
    attackResult.request.source.actorId !== actor.id ||
    attackResult.request.source.itemId !== attack.weaponId
  ) {
    throw new RangeError("D6E2.Combat.Damage.SuccessfulHitRequired");
  }
  if (JSON.stringify(capturedPlan) !== JSON.stringify(damagePlan)) {
    throw new RangeError("D6E2.Combat.Damage.SuccessfulHitRequired");
  }
  const item = actor.items.get(attack.weaponId);
  if (item?.type !== "weapon") {
    throw new RangeError("D6E2.Combat.Damage.WeaponUnavailable");
  }
  const targetContext = lockedDamageTargetContext(
    actor,
    item,
    attack,
    damagePlan,
  );
  if (!targetContext) {
    throw new RangeError("D6E2.Combat.Damage.TargetUnavailable");
  }
  return rollWeaponDamage(
    actor,
    item,
    {
      ...(continuation.captureRollExecution
        ? { captureRollExecution: continuation.captureRollExecution }
        : {}),
      ...(continuation.fixedRollMode
        ? { fixedRollMode: continuation.fixedRollMode }
        : {}),
      suppressChatMessage: continuation.suppressChatMessage === true,
    },
    targetContext,
    damagePlan,
  );
}

export async function rollItem(
  actorValue: object,
  itemId: string,
  mode: "attack" | "damage" = "attack",
  options: D6RollInvocationOptionsV1 = {},
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
    return rollWeaponDamage(actor, item, options);
  }
  const explosiveOptions = (options as ExplosiveItemRollOptions).explosive;
  if (
    item.type === "weapon" &&
    stringValue(item.system.weaponKind) === "thrown-explosive" &&
    explosiveOptions?.bypassPlacement !== true
  ) {
    const { beginD6ThrownExplosiveThrow } =
      await import("../explosives/explosive-service");
    return beginD6ThrownExplosiveThrow(actor, item, options);
  }
  if (actor.type === "starship" || actor.type === "vehicle") {
    return rollMachineWeaponAttack(actor, item);
  }
  const attackSkillKey =
    typeof item.system.attackSkillKey === "string"
      ? item.system.attackSkillKey
      : "";
  const linkedSkill = actor.items.contents.find(
    (candidate) =>
      candidate.type === "skill" && candidate.system.key === attackSkillKey,
  );
  const attributeId = linkedSkill
    ? stringValue(linkedSkill.system.attributeId)
    : typeof item.system.attackAttributeId === "string"
      ? item.system.attackAttributeId
      : "agility";
  const attribute = record(record(actor.system.attributes)[attributeId]);
  const linkedSkillScore =
    linkedSkill?.system.training === "advanced"
      ? currentEffectivePipScore(integer(linkedSkill.system.score))
      : linkedSkill
        ? currentCombinedPipScore(
            integer(attribute.score),
            integer(linkedSkill.system.score),
          )
        : currentEffectivePipScore(integer(attribute.score));
  const attackBonus = currentEffectivePipScore(
    integer(item.system.attackBonus),
  );
  const autofireRating = currentSecondEditionCampaignProfile()
    .activeResponsiveCombat
    ? Math.max(0, integer(item.system.autofireRating))
    : 0;
  const autofireLimit = Math.max(
    autofireRating,
    Math.floor(linkedSkillScore / 3),
  );
  let autofireSpend = 0;
  if (autofireRating > 0 && autofireLimit > 0) {
    const autofireOptions = Array.from(
      { length: autofireLimit + 1 },
      (_, value) => `<option value="${value}">${value}</option>`,
    ).join("");
    autofireSpend =
      (await foundry.applications.api.DialogV2.wait<number>({
        buttons: [
          {
            action: "cancel",
            callback: () => 0,
            label: game.i18n.localize("D6E2.Cancel"),
          },
          {
            action: "apply",
            callback: (_event, button) => {
              const form = button.form;
              return form
                ? Math.max(
                    0,
                    integer(
                      (
                        form.elements.namedItem(
                          "autofireSpend",
                        ) as HTMLSelectElement | null
                      )?.value,
                    ),
                  )
                : 0;
            },
            label: game.i18n.localize(
              "D6E2.Combat.ActiveResponsive.ApplyAutofire",
            ),
          },
        ],
        classes: ["d6e2", "od6roll-dialog"],
        content: `<label>${game.i18n.localize("D6E2.Combat.ActiveResponsive.AutofireSpend")}<select name="autofireSpend">${autofireOptions}</select></label>`,
        window: {
          title: game.i18n.localize("D6E2.Combat.ActiveResponsive.Autofire"),
        },
      })) ?? 0;
  }
  const autofirePlan = secondEditionAutofirePlan(
    autofireRating,
    linkedSkillScore,
    autofireSpend,
  );
  const damageBase = resolveWeaponDamageBase(
    actor,
    item,
    activeStrengthAttributeId(),
    currentAttributeRuntimeStrategy().family === "open-d6",
  );
  const { score: damageScore, ...weaponDamage } = damageBase;
  const damageBindingId = foundry.utils.randomID();
  const result = await executeActorRoll(
    actor,
    {
      ...(autofirePlan.spend > 0
        ? { context: { autofire: autofirePlan } }
        : {}),
      kind: "weapon-attack",
      label: `${item.name} · ${game.i18n.localize("D6E2.Combat.Attack")}`,
      score: linkedSkillScore + attackBonus,
      source: {
        actorId: actor.id,
        actorName: actor.name,
        attributeId,
        itemId: item.id,
      },
      weaponDamageContinuation: {
        ...(autofirePlan.spend > 0 ? { autofire: autofirePlan } : {}),
        bindingId: damageBindingId,
        score: damageScore,
        weaponDamage,
      },
      targetContext:
        explosiveOptions?.targetContext ??
        (options as InternalRollInvocationOptions).targetContext ??
        buildWeaponAttackTargetContext(actor, item),
    },
    { ...options, automaticResultModifier: autofirePlan.attackModifier },
  );
  if (result) {
    await item.update({
      [`flags.${SYSTEM_ID}.pendingAutofire`]: d6PendingAutofireForAttack(
        damageBindingId,
        autofirePlan,
      ),
    });
  }
  const weaponAttack = result?.request.context?.weaponAttack;
  if (weaponAttack?.feintPenalty && weaponAttack.targetActorId) {
    const feint = activeFeintAgainst(
      weaponAttack.targetActorId,
      weaponAttack.targetTokenId ?? "",
    );
    if (
      feint !== null &&
      (feint.actor.isOwner === true || game.user?.isGM === true)
    ) {
      await clearSecondEditionCombatantFeint(feint.actor);
    }
  }
  return result;
}

/** Execute a Riposte through the ordinary Weapon builder while binding the
 * original attacker as the authoritative target. Presentation is captured by
 * the initiating root; this function never creates a child ChatMessage. */
export async function rollSecondEditionRiposteAttack(
  actorValue: object,
  itemId: string,
  target: Pick<D6WeaponAttackRollContext, "targetActorId" | "targetTokenId">,
  options: D6RollInvocationOptionsV1,
  captureExecution: (
    result: D6RollResultV1,
    artifacts: readonly FoundryRoll[],
  ) => Promise<void> | void,
): Promise<D6RollResultV1 | null> {
  const actor = actorDocument(actorValue);
  const item = actor.items.get(itemId);
  if (item?.type !== "weapon" || item.system.attackSkillKey !== "melee")
    throw new RangeError("D6E2.ActionThread.ReactionUnavailable");
  return rollItem(actor, itemId, "attack", {
    ...options,
    captureRollExecution: captureExecution,
    suppressChatMessage: true,
    targetContext: buildWeaponAttackTargetContext(
      actor,
      item,
      "attack",
      target,
    ),
  } as InternalRollInvocationOptions);
}

export async function rollPlacedThrownExplosiveAttack(
  actor: object,
  itemId: string,
  targetContext: RollTargetContext | undefined,
  options: D6RollInvocationOptionsV1 = {},
): Promise<D6RollResultV1 | null> {
  return rollItem(actor, itemId, "attack", {
    ...options,
    explosive: {
      bypassPlacement: true,
      ...(targetContext ? { targetContext } : {}),
    },
  } as D6RollInvocationOptionsV1);
}

export interface PlacedThrownExplosiveAttackOutcome {
  readonly message: FoundryChatMessageDocument;
  readonly result: D6RollResultV1;
}

export async function rollPlacedThrownExplosiveAttackWithMessage(
  actor: object,
  itemId: string,
  targetContext: RollTargetContext | undefined,
  options: D6RollInvocationOptionsV1 = {},
): Promise<PlacedThrownExplosiveAttackOutcome | null> {
  let message: FoundryChatMessageDocument | undefined;
  const result = await rollItem(actor, itemId, "attack", {
    ...options,
    captureChatMessage: (created: FoundryChatMessageDocument) => {
      message = created;
    },
    explosive: {
      bypassPlacement: true,
      ...(targetContext ? { targetContext } : {}),
    },
  } as D6RollInvocationOptionsV1);
  if (!result) return null;
  if (!message) throw new Error("D6E2.Explosive.Thread.AttackMessageMissing");
  return Object.freeze({ message, result });
}

export function explosiveWeaponDamageScore(
  actorValue: object,
  itemId: string,
): number {
  const actor = actorDocument(actorValue);
  const item = actor.items.get(itemId);
  if (item?.type !== "weapon")
    throw new RangeError("D6E2.Explosive.Error.WeaponUnavailable");
  return resolveWeaponDamageBase(
    actor,
    item,
    activeStrengthAttributeId(),
    currentAttributeRuntimeStrategy().family === "open-d6",
  ).score;
}

export interface ExplosiveDamageTarget {
  readonly actor: object;
  readonly hidden: boolean;
  readonly name: string;
  readonly tokenId: string;
}

/** Open the ordinary Damage builder for one shared explosive-zone pool without
 * creating an independent Damage ChatMessage. Closing the builder returns null
 * and leaves the caller's durable stage pending. */
export async function rollExplosiveZoneDamage(
  sourceActorValue: object,
  itemId: string,
  damageScore: number,
  damageKind: "physical" | "stun",
  requestId: string,
  zone: 1 | 2 | 3 | 4,
  target: ExplosiveDamageTarget,
  rollMode: D6RollMode,
  captureExecution: (
    result: D6RollResultV1,
    artifacts: readonly FoundryRoll[],
  ) => Promise<void>,
): Promise<D6RollResultV1 | null> {
  const sourceActor = actorDocument(sourceActorValue);
  const item = sourceActor.items.get(itemId);
  if (item?.type !== "weapon")
    throw new RangeError("D6E2.Explosive.Error.WeaponUnavailable");
  const score = Math.max(0, Math.trunc(damageScore));
  if (score < 3) return null;
  const targetActor = actorDocument(target.actor);
  const request = explosiveDamageRequest(
    sourceActor,
    item,
    targetActor,
    target,
    score,
    damageKind,
    requestId,
    zone,
    rollMode,
  );
  return executeActorRoll(
    sourceActor,
    {
      ...(request.context === undefined ? {} : { context: request.context }),
      kind: request.kind,
      label: request.label,
      score: request.score,
      source: request.source,
    },
    {
      captureRollExecution: captureExecution,
      fixedRollMode: rollMode,
      suppressChatMessage: true,
    },
  );
}

/** Roll one zone pool once, then project that immutable result to each target's
 * ordinary damage/resistance card without widening chat visibility. */
export async function rollExplosiveZoneDamageAgainst(
  sourceActorValue: object,
  itemId: string,
  damageScore: number,
  damageKind: "physical" | "stun",
  requestId: string,
  zone: 1 | 2 | 3 | 4,
  targets: readonly ExplosiveDamageTarget[],
): Promise<readonly D6RollResultV1[] | null> {
  const sourceActor = actorDocument(sourceActorValue);
  const item = sourceActor.items.get(itemId);
  if (item?.type !== "weapon")
    throw new RangeError("D6E2.Explosive.Error.WeaponUnavailable");
  const score = Math.max(0, Math.trunc(damageScore));
  if (score < 3 || targets.length === 0) return null;
  const orderedTargets = [...targets].sort(
    (left, right) => Number(left.hidden) - Number(right.hidden),
  );
  const first = orderedTargets[0];
  if (!first) return null;
  const firstActor = actorDocument(first.actor);
  const damage = await executePreparedRoll(
    sourceActor,
    explosiveDamageRequest(
      sourceActor,
      item,
      firstActor,
      first,
      score,
      damageKind,
      requestId,
      zone,
    ),
  );
  if (!damage) return null;
  const results: D6RollResultV1[] = [damage];
  for (const target of orderedTargets.slice(1)) {
    const targetActor = actorDocument(target.actor);
    const projected = Object.freeze({
      ...damage,
      request: explosiveDamageRequest(
        sourceActor,
        item,
        targetActor,
        target,
        score,
        damageKind,
        requestId,
        zone,
      ),
    }) satisfies D6RollResultV1;
    await postRoll(sourceActor, projected, Object.freeze([]));
    results.push(projected);
  }
  return Object.freeze(results);
}

function explosiveDamageRequest(
  sourceActor: FoundryActorDocument,
  item: FoundryItemDocument,
  targetActor: FoundryActorDocument,
  target: ExplosiveDamageTarget,
  score: number,
  damageKind: "physical" | "stun",
  requestId: string,
  zone: 1 | 2 | 3 | 4,
  rollMode: D6RollMode = target.hidden ? "gmroll" : currentDefaultRollMode(),
): D6RollRequestV1 {
  return Object.freeze({
    contractVersion: D6_ROLL_CONTRACT_VERSION,
    context: {
      explosive: { damageKind, requestId, zone },
      scale: {
        application: "damage" as const,
        family: "ranked" as const,
        modifierScore: 0,
        sourcePage: 0,
        sourceActorId: sourceActor.id,
        sourceName: sourceActor.name,
        sourceRank: 0,
        targetActorId: targetActor.id,
        targetName: target.name,
        targetRank: 0,
        targetTokenId: target.tokenId,
      },
      weaponDamage: {
        attributeId: "",
        baseKind: "fixed" as const,
        baseScore: score,
        configuredSkillKey: "",
        listedDamageScore: score,
      },
    },
    kind: "damage",
    label: `${item.name} · ${game.i18n.localize("D6E2.Explosive.Damage")}`,
    heroPointUse: "none",
    resultModifier: 0,
    rollMode,
    score,
    source: {
      actorId: sourceActor.id,
      actorName: sourceActor.name,
      attributeId: "",
      itemId: item.id,
    },
  });
}

export function actorResistancePlan(actor: FoundryActorDocument) {
  const brawn = record(
    record(actor.system.attributes)[activeStrengthAttributeId()],
  );
  const armor = actor.items.contents
    .filter((item) => item.type === "armor" && item.system.equipped === true)
    .map((item) => ({
      id: item.id,
      label: item.name,
      score: Math.max(
        currentEffectivePipScore(integer(item.system.physicalResistance)),
        currentEffectivePipScore(integer(item.system.energyResistance)),
      ),
      stackingTag: stringValue(item.system.stackingTag),
    }));
  const hyperLethal = currentSecondEditionHyperLethalProfile();
  const healthStrategy = actorHealthResolutionStrategy(actor);
  const nativeSecondEdition = healthStrategy.family === "conditions";
  const bodyPoints = healthStrategy.resistance === "armor-only";
  const plan = secondEditionResistancePlan(
    bodyPoints ? 0 : currentEffectivePipScore(integer(brawn.score)),
    armor,
    nativeSecondEdition ? hyperLethal.maximumResistanceScore : undefined,
  );
  const round = readCombatantRound(actor);
  const fullDefense = round?.secondEditionFullDefense;
  const d6MvBonus =
    healthStrategy.family === "d6mv-injury" &&
    fullDefense?.sourcePage === 62 &&
    round?.completedActionIds.length === 1
      ? (fullDefense.physicalResistanceBonus ?? 0)
      : 0;
  return d6MvBonus === 0
    ? plan
    : Object.freeze({
        ...plan,
        brawnScore: plan.brawnScore + d6MvBonus,
        score: plan.score + d6MvBonus,
        uncappedScore: plan.uncappedScore + d6MvBonus,
      });
}

export function machineResistancePlan(actor: FoundryActorDocument) {
  if (!["starship", "vehicle"].includes(actor.type)) {
    throw new TypeError(
      "Machine resistance requires a Vehicle or Starship Actor.",
    );
  }
  const system = record(actor.system);
  const hull = record(record(system.attributes).hull);
  const machineKind = actor.type === "starship" ? "starship" : "vehicle";
  const protection = record(
    system[machineKind === "starship" ? "shields" : "armor"],
  );
  return secondEditionMachineResistancePlan(
    machineKind,
    currentEffectivePipScore(integer(hull.score)),
    currentEffectivePipScore(integer(protection.score)),
  );
}

export async function rollResistance(
  actorValue: object,
): Promise<D6RollResultV1 | null> {
  return rollResistanceAgainst(actorValue);
}

export function resistanceRollContext(
  actor: FoundryActorDocument,
): D6ResistanceRollContext | null {
  const machine = ["starship", "vehicle"].includes(actor.type);
  const healthStrategy = machine
    ? currentHealthResolutionStrategy()
    : actorHealthResolutionStrategy(actor);
  if (machine && healthStrategy.family !== "conditions") return null;
  const machinePlan = machine ? machineResistancePlan(actor) : null;
  const personalPlan = machine ? null : actorResistancePlan(actor);
  const machineKind = machine
    ? actor.type === "starship"
      ? "starship"
      : "vehicle"
    : undefined;
  const baseScore = machinePlan?.hullScore ?? personalPlan?.brawnScore ?? 0;
  const protectionScore =
    machinePlan?.protectionScore ?? personalPlan?.armorScore ?? 0;
  const contributors = machine
    ? [
        {
          id: `${machineKind}-protection`,
          label: game.i18n.localize(
            machineKind === "starship"
              ? "D6E2.Machine.Shields"
              : "D6E2.Machine.Armor",
          ),
          score: protectionScore,
        },
      ]
    : (personalPlan?.contributors ?? []);
  return Object.freeze({
    armorContributors: Object.freeze(
      contributors.map((item) =>
        Object.freeze({
          itemId: item.id,
          label: item.label,
          score: item.score,
        }),
      ),
    ),
    armorScore: protectionScore,
    baseLabel: game.i18n.localize(
      machine
        ? "D6E2.Machine.Hull"
        : healthStrategy.resistance === "armor-only"
          ? "D6E2.Combat.FirstEdition.BodyPoints.ArmorOnly"
          : "D6E2.Attribute.Brawn",
    ),
    brawnScore: baseScore,
    ...(personalPlan === null
      ? {}
      : {
          capped: personalPlan.capped,
          ...(personalPlan.maximumScore === undefined
            ? {}
            : {
                maximumScore: personalPlan.maximumScore,
                maximumSourcePage: 90 as const,
              }),
          uncappedScore: personalPlan.uncappedScore,
        }),
    kind: machine ? "machine" : "personal",
    ...(machineKind === undefined ? {} : { machineKind }),
    protectionLabel: game.i18n.localize(
      machineKind === "starship"
        ? "D6E2.Machine.Shields"
        : machineKind === "vehicle"
          ? "D6E2.Machine.Armor"
          : "D6E2.Item.Armor",
    ),
    sourcePage: machine
      ? (machinePlan?.sourcePage ?? 183)
      : healthStrategy.family !== "conditions"
        ? 76
        : 34,
    strategy: machine
      ? "second-edition-machine-conditions"
      : healthStrategy.family !== "conditions"
        ? healthStrategy.family === "wounds"
          ? "open-d6-wound-levels"
          : "open-d6-body-points"
        : "second-edition-conditions",
  });
}

export async function rollResistanceAgainst(
  actorValue: object,
  preferredSource?: D6ScaleRollContext,
  damageTotal?: number,
  options: D6RollInvocationOptionsV1 = {},
  suppressChatMessage = false,
  captureExecution?: (
    result: D6RollResultV1,
    artifacts: readonly FoundryRoll[],
  ) => Promise<void> | void,
): Promise<D6RollResultV1 | null> {
  const actor = actorDocument(actorValue);
  const context = resistanceRollContext(actor);
  if (!context) return null;
  return executeActorRoll(
    actor,
    {
      context: {
        resistance: context,
      },
      kind: "resistance",
      label: game.i18n.localize("D6E2.Combat.Resistance"),
      ...(damageTotal === undefined
        ? {}
        : { fixedDifficulty: Math.max(0, Math.trunc(damageTotal)) }),
      score:
        context.maximumScore === undefined
          ? context.brawnScore + context.armorScore
          : Math.min(
              context.brawnScore + context.armorScore,
              context.maximumScore,
            ),
      source: {
        actorId: actor.id,
        actorName: actor.name,
        attributeId:
          context.kind === "machine" || context.brawnScore > 0
            ? context.kind === "machine"
              ? "hull"
              : "brawn"
            : "",
      },
      targetContext: buildResistanceSourceContext(actor, preferredSource),
    },
    {
      ...options,
      ...(captureExecution ? { captureRollExecution: captureExecution } : {}),
      suppressChatMessage,
    },
  );
}
