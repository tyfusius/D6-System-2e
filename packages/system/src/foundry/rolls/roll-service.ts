import {
  actionEconomyRollPlan,
  advancedSkillAugmentedScore,
  canDoubleDown,
  canRerollFailedRoll,
  D6_ROLL_CONTRACT_VERSION,
  doublingDownRequest,
  formatPipScore,
  firstEditionActiveDefensePlan,
  firstEditionExplosiveRangeForDistance,
  firstEditionGrenadeTargetingDifficulty,
  firstEditionStrengthAdjustedThrowRanges,
  firstEditionBodyPointWound,
  augmentationInstallDifficulty,
  augmentationInstallMinutes,
  cyberwareDisableTurns,
  hackingConsequence,
  firstEditionWoundPenaltyScore,
  freeformMagicDifficulty,
  freeformMagicUntrainedPenalty,
  firstEditionStrengthDamageScore,
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
  secondEditionConditionPenaltyScore,
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
  secondEditionScaleInteraction,
  secondEditionStaticDefense,
  secondEditionWeaponAttackKind,
  specializationScore,
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
  type D6RollSource,
  type D6RollContextV1,
  type D6ScaleRollApplication,
  type D6ScaleRollContext,
  type D6WildDieChoice,
  type D6WildDiePolicy,
  type D6WeaponAttackRollContext,
  type ActionDeclarationAssistanceMode,
  type FirstEditionActiveDefenseKind,
  type SecondEditionAttackKind,
  type SecondEditionRangeBand,
} from "@d6-system-2e/core";
import { executeD6Roll } from "../../application/rolls/execute-roll";
import { SYSTEM_ID } from "../../constants";
import {
  currentTerminology,
  terminologyAttributeLabel,
} from "../../registries/terminology";
import { currentRulesProfile } from "../../settings/rules-compatibility";
import {
  currentFirstEditionGenreProfile,
  firstEditionAttributeRole,
} from "../../settings/first-edition-genre-profile";
import {
  booleanSetting,
  currentActionDeclarationAssistance,
  currentDefaultRollMode,
  currentFirstEditionDamageMode,
  numberSetting,
  stringSetting,
} from "../../settings/setting-values";
import {
  FIRST_EDITION_OPTION_KEYS,
  SECOND_EDITION_OPTION_KEYS,
  SHARED_SETTING_KEYS,
  TYFUSIUS_HOMEBREW_SETTING_KEYS,
} from "../../settings/settings-catalog";
import { currentEditionCapabilityProfile } from "../../settings/edition-capabilities";
import { currentSecondEditionHyperLethalProfile } from "../../settings/hyper-lethal";
import { currentSecondEditionHeroPointStrategy } from "../../settings/hero-points";
import { currentSecondEditionCampaignProfile } from "../../settings/campaign-profile";
import {
  currentCombinedPipScore,
  currentEffectivePipScore,
} from "../../settings/pip-rules";
import { advancedSkillIssues } from "../skill-module";
import { integer, record, stringValue } from "../sheets/values";
import { readCombatantRound } from "../combat-service";
import { clearSecondEditionCombatantFeint } from "../combat-service";
import { readActorEnvironmentEffect } from "../environment-state";
import {
  d6System2eDiceAppearance,
  waitForDiceSoNiceRollAnimation,
} from "../dice-so-nice";
import {
  actorHeroPointBalance,
  transactActorHeroPoints,
} from "../hero-point-service";
import { chatVisibilityForMode } from "./chat-visibility";
import { combinedActionBlocksRoll } from "../combined-action-state";

function activeStrengthAttributeId(): string {
  return currentRulesProfile().compatibility.firstEditionAttributes
    ? firstEditionAttributeRole("strength")
    : "brawn";
}
import {
  promptWildChoiceDialog,
  requestGmWildChoice,
  requiresGmWildChoice,
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
    readonly outOfRange: boolean;
    readonly scale: D6ScaleRollContext;
  };
  readonly difficulty?: number;
  readonly heroPointUse: D6HeroPointUse;
  readonly heroPointSpend: number;
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

interface RollTargetOption {
  readonly actorId: string;
  readonly attackKind?: SecondEditionAttackKind;
  readonly defense?: number;
  readonly defenseKind?: "dodge" | "parry" | "range";
  readonly defenseSourcePage?: 33 | 94 | 111 | 180 | 183;
  readonly defenseStrategy?: D6WeaponAttackRollContext["defenseStrategy"];
  readonly distance?: number;
  readonly feintPenalty?: number;
  readonly id: string;
  readonly img: string;
  readonly name: string;
  readonly outOfRange: boolean;
  readonly purpose: D6ScaleRollApplication;
  readonly rangeBand?: SecondEditionRangeBand;
  readonly rangeLabel: string;
  readonly scale: D6ScaleRollContext;
  readonly selected: boolean;
  readonly weaponId?: string;
}

interface RollTargetContext {
  readonly hasTargets: boolean;
  readonly purpose: D6ScaleRollApplication;
  readonly showCoverModifier?: boolean;
  readonly showTargetDodging?: boolean;
  readonly selectedTarget: RollTargetOption | null;
  readonly targets: readonly RollTargetOption[];
}

interface AdvancedSkillContextOption extends D6AdvancedSkillRollContext {
  readonly augmentedScore: number;
  readonly augmentedScoreLabel: string;
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
  const key: Readonly<Record<string, string>> = Object.freeze({
    dead: "D6E2.Condition.Dead",
    healthy: "D6E2.Condition.Healthy",
    incapacitated: "D6E2.Condition.Incapacitated",
    "mortally-wounded": "D6E2.Condition.MortallyWounded",
    staggered: "D6E2.Condition.Staggered",
    stunned: "D6E2.Condition.Stunned",
    wounded: "D6E2.Condition.Wounded",
  });
  return game.i18n.localize(key[value] ?? "D6E2.Environment.NoCondition");
}

interface RequestedRollDialog {
  close(): Promise<void>;
}

interface InternalRollInvocationOptions extends D6RollInvocationOptionsV1 {
  readonly automaticResultModifier?: number;
  readonly ignoreActionEconomy?: boolean;
  readonly ignoreTrackedMapPenalty?: boolean;
  readonly ignoreConditionPenalty?: boolean;
}

const requestedRollDialogs = new Map<string, RequestedRollDialog>();
const cancelledRequestedRollIds = new Set<string>();

export function cancelRequestedRollDialog(requestId: string): void {
  cancelledRequestedRollIds.add(requestId);
  const dialog = requestedRollDialogs.get(requestId);
  if (dialog) void dialog.close();
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

function scaleRank(actor: FoundryActorDocument): number {
  const raw = integer(actor.system.scale);
  return Math.min(6, Math.max(0, raw));
}

function attackSourceScaleRank(
  actor: FoundryActorDocument,
  weapon?: FoundryItemDocument,
): number {
  const itemRank = weapon ? integer(weapon.system.scale) : 0;
  return itemRank > 0 ? Math.min(6, itemRank) : scaleRank(actor);
}

function targetStaticDefense(
  actor: FoundryActorDocument,
  attackKind: SecondEditionAttackKind,
): number {
  if (actor.type === "vehicle" || actor.type === "starship") {
    const hull = record(record(actor.system.attributes).hull);
    return secondEditionStaticDefense(
      currentEffectivePipScore(integer(hull.score)),
    );
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

export function buildWeaponAttackTargetContext(
  actor: FoundryActorDocument,
  weapon: FoundryItemDocument,
  purpose: "attack" | "damage" = "attack",
): RollTargetContext {
  const defenseStrategy = currentEditionCapabilityProfile().defenses.strategy;
  const thrownExplosive =
    weapon.type === "weapon" &&
    stringValue(weapon.system.weaponKind) === "thrown-explosive";
  const firstEditionThrownExplosive =
    defenseStrategy === "active-defense-scheduler" && thrownExplosive;
  const firstEditionGrenade =
    purpose === "attack" && firstEditionThrownExplosive;
  const secondEditionThrownExplosive =
    (defenseStrategy === "static-defenses" ||
      defenseStrategy === "no-dodge-range-difficulties") &&
    thrownExplosive;
  if (
    !firstEditionGrenade &&
    defenseStrategy !== "static-defenses" &&
    defenseStrategy !== "no-dodge-range-difficulties"
  ) {
    return Object.freeze({
      hasTargets: false,
      purpose,
      selectedTarget: null,
      targets: Object.freeze([]),
    });
  }
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
  const sourceRank = attackSourceScaleRank(actor, weapon);
  const sceneTokens = canvas.tokens?.placeables ?? [];
  const sourceTokens = actor.getActiveTokens?.() ?? [];
  const sourceIds = new Set(sourceTokens.map((token) => token.id));
  const sourceToken =
    sourceTokens.find((token) => token.controlled && token.center) ??
    sourceTokens.find((token) => token.center) ??
    sceneTokens.find((token) => token.actor?.id === actor.id && token.center);
  const selectedIds = new Set(
    Array.from(game.user?.targets ?? [], (token) => token.id),
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
      const targetRank = scaleRank(targetActor);
      const machineTarget =
        targetActor.type === "vehicle" || targetActor.type === "starship";
      const scale = secondEditionScaleInteraction(sourceRank, targetRank);
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
        defenseStrategy === "no-dodge-range-difficulties";
      const grenadeTarget = firstEditionGrenade;
      const rangeBand =
        noDodgeTarget &&
        resolvedRangeBand === "short" &&
        distance !== undefined &&
        distance <= (canvas.scene?.grid?.distance ?? 1)
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
      const feint =
        purpose === "attack"
          ? activeFeintAgainst(targetActor.id, token.id)
          : null;
      const tokenImage = token.document?.texture?.src?.trim() ?? "";
      const actorImage = targetActor.img.trim();
      const scaleContext: D6ScaleRollContext = Object.freeze({
        application: purpose,
        modifierScore: grenadeTarget
          ? 0
          : purpose === "damage"
            ? scale.attackerDamageBonusScore
            : scale.attackerAttackBonusScore,
        sourcePage: 196,
        sourceActorId: actor.id,
        sourceName: actor.name,
        sourceRank,
        ...(sourceToken === undefined ? {} : { sourceTokenId: sourceToken.id }),
        targetActorId: targetActor.id,
        targetName: name,
        targetRank,
        targetTokenId: token.id,
      });
      return [
        Object.freeze({
          actorId: targetActor.id,
          ...(purpose === "attack"
            ? {
                attackKind,
                defense: Math.max(
                  0,
                  (noDodgeTarget || grenadeTarget
                    ? (fixedRangeDefense ?? 0)
                    : targetStaticDefense(targetActor, attackKind) +
                      (attackKind === "ranged" ? scale.targetDodgeBonus : 0)) -
                    (feint?.penalty ?? 0),
                ),
                defenseKind:
                  noDodgeTarget || grenadeTarget ? "range" : defenseKind,
                defenseSourcePage: grenadeTarget
                  ? 111
                  : noDodgeTarget
                    ? 94
                    : machineTarget
                      ? targetActor.type === "starship"
                        ? 183
                        : 180
                      : 33,
                defenseStrategy: grenadeTarget
                  ? "grenade-targeting"
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
          id: token.id,
          img: tokenImage.length > 0 ? tokenImage : actorImage,
          name,
          outOfRange:
            purpose === "attack" &&
            (resolution?.outOfRange === true ||
              ((noDodgeTarget || grenadeTarget) && resolution === undefined)),
          purpose,
          ...(rangeBand === undefined ? {} : { rangeBand }),
          rangeLabel: rangeLabel(rangeBand, resolution?.outOfRange === true),
          scale: scaleContext,
          selected: selectedIds.has(token.id),
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
    hasTargets: targets.length > 0,
    purpose,
    selectedTarget,
    showCoverModifier:
      purpose === "attack" && attackKind === "ranged" && !firstEditionGrenade,
    showTargetDodging:
      purpose === "attack" &&
      attackKind === "ranged" &&
      defenseStrategy === "no-dodge-range-difficulties",
    targets: Object.freeze(targets),
  });
}

export function buildResistanceSourceContext(
  actor: FoundryActorDocument,
  preferredSource?: D6ScaleRollContext,
): RollTargetContext {
  const sceneTokens = canvas.tokens?.placeables ?? [];
  const sourceTokens = actor.getActiveTokens?.() ?? [];
  const sourceIds = new Set(sourceTokens.map((token) => token.id));
  const selectedIds = new Set(
    preferredSource?.sourceTokenId
      ? [preferredSource.sourceTokenId]
      : Array.from(game.user?.targets ?? [], (token) => token.id),
  );
  const targetRank = scaleRank(actor);
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
      const sourceRank = scaleRank(sourceActor);
      const scale = secondEditionScaleInteraction(sourceRank, targetRank);
      const tokenImage = token.document?.texture?.src?.trim() ?? "";
      const actorImage = sourceActor.img.trim();
      return [
        Object.freeze({
          actorId: sourceActor.id,
          id: token.id,
          img: tokenImage.length > 0 ? tokenImage : actorImage,
          name,
          outOfRange: false,
          purpose: "resistance" as const,
          rangeLabel: "",
          scale: Object.freeze({
            application: "resistance" as const,
            modifierScore: scale.targetResistanceBonusScore,
            sourcePage: 196 as const,
            sourceActorId: sourceActor.id,
            sourceName: name,
            sourceRank,
            sourceTokenId: token.id,
            targetActorId: actor.id,
            targetName: actor.name,
            targetRank,
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
  const preferredScale =
    preferredSource === undefined
      ? undefined
      : secondEditionScaleInteraction(
          preferredSource.sourceRank,
          preferredSource.targetRank,
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
            outOfRange: false,
            purpose: "resistance" as const,
            rangeLabel: "",
            scale: Object.freeze({
              application: "resistance" as const,
              modifierScore: preferredScale?.targetResistanceBonusScore ?? 0,
              sourcePage: 196 as const,
              sourceActorId: preferredSource.sourceActorId,
              sourceName: preferredSource.sourceName,
              sourceRank: preferredSource.sourceRank,
              ...(preferredSource.sourceTokenId === undefined
                ? {}
                : { sourceTokenId: preferredSource.sourceTokenId }),
              targetActorId: actor.id,
              targetName: actor.name,
              targetRank: preferredSource.targetRank,
              ...(targetToken === undefined
                ? {}
                : { targetTokenId: targetToken.id }),
            }),
            selected: true,
          }),
        ];
  const selectedTarget = targets.find((target) => target.selected) ?? null;
  return Object.freeze({
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
  const defense = Number(option.dataset.defense);
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
  const coverDefense = secondEditionCoverDefensePlan(
    grenadeTargetingDifficulty ?? fixedRangePlan?.defense ?? defense,
    attackKind === "ranged"
      ? (inputNumber(form, "coverDefenseModifier") ?? 0)
      : 0,
  );
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
  const sourceRank = Math.max(
    0,
    Math.min(6, Math.trunc(Number(option.dataset.sourceScale) || 0)),
  );
  const targetRank = Math.max(
    0,
    Math.min(6, Math.trunc(Number(option.dataset.targetScale) || 0)),
  );
  const targetActorId = option.dataset.actorId ?? "";
  const targetName = option.dataset.name ?? "";
  const targetTokenId = option.value;
  return {
    ...(purpose === "attack"
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
            ) as 33 | 94 | 111 | 180 | 183,
            defenseStrategy:
              defenseStrategy === "fixed-range" ||
              defenseStrategy === "grenade-targeting" ||
              defenseStrategy === "machine-defense" ||
              defenseStrategy === "static-dodge" ||
              defenseStrategy === "static-parry"
                ? defenseStrategy
                : attackKind === "ranged"
                  ? "static-dodge"
                  : "static-parry",
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
            ...(fixedRangePlan?.targetDodging === true
              ? { targetDodging: true }
              : {}),
            targetName,
            targetTokenId,
            weaponId: option.dataset.weaponId ?? "",
          },
        }
      : {}),
    outOfRange: option.dataset.outOfRange === "true",
    scale: {
      application: purpose,
      modifierScore,
      sourcePage: 196,
      sourceActorId: option.dataset.scaleSourceActorId ?? "",
      sourceName: option.dataset.scaleSourceName ?? "",
      sourceRank,
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
      ...(option.dataset.scaleTargetTokenId
        ? { targetTokenId: option.dataset.scaleTargetTokenId }
        : {}),
    },
  };
}

function updateRollPreview(dialog: { readonly element: HTMLElement }): void {
  const shell = dialog.element.querySelector<HTMLElement>(".od6roll-shell");
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
  const doubledScore = dialog.element.querySelector<HTMLElement>(
    "[data-roll-doubled-score]",
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
  const defenseValue = option?.dataset.defense ?? "";
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
  const fixedRangePreview =
    option?.dataset.defenseStrategy === "fixed-range" &&
    (option.dataset.rangeBand === "point-blank" ||
      option.dataset.rangeBand === "short" ||
      option.dataset.rangeBand === "medium" ||
      option.dataset.rangeBand === "long")
      ? secondEditionNoDodgeDefensePlan(
          option.dataset.rangeBand,
          dodgingInput?.checked === true,
        ).defense
      : undefined;
  const grenadeTargetingPreview =
    option?.dataset.defenseStrategy === "grenade-targeting" &&
    (option.dataset.rangeBand === "point-blank" ||
      option.dataset.rangeBand === "short" ||
      option.dataset.rangeBand === "medium" ||
      option.dataset.rangeBand === "long")
      ? firstEditionGrenadeTargetingDifficulty(option.dataset.rangeBand)
      : undefined;
  const effectiveDefense =
    defenseValue.length > 0
      ? secondEditionCoverDefensePlan(
          fixedRangePreview ?? Number(defenseValue),
          coverModifier,
        ).defense
      : undefined;
  const effectiveTargetDifficulty = targetOutOfRange
    ? undefined
    : grenadeTargetingPreview === undefined
      ? effectiveDefense
      : secondEditionCoverDefensePlan(grenadeTargetingPreview, coverModifier)
          .defense;
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
    scale.textContent = option
      ? `${game.i18n.localize("D6E2.Combat.ScaleRank")} ${sourceScale} → ${targetScale} · +${formatPipScore(scaleModifier)}`
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
  const adjustedScore = Math.max(
    0,
    baseScore + scaleModifier - mapPenaltyDice * 3,
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
  if (doubledScore) {
    doubledScore.textContent = formatPipScore(
      capEnabled
        ? superheroicDieCodeCapPlan(adjustedScore * 2, cap).cappedScore
        : adjustedScore * 2,
    );
  }
  const form = (select ?? mapInput)?.closest("form");
  const difficulty = form?.elements.namedItem("difficulty");
  if (
    difficulty instanceof HTMLInputElement &&
    option?.dataset.scaleApplication === "attack"
  ) {
    difficulty.value = effectiveTargetDifficulty?.toString() ?? "";
  }
}

async function promptForRoll(
  actor: FoundryActorDocument,
  label: string,
  score: number,
  kind: D6RollKind,
  advancedSkillContexts: readonly AdvancedSkillContextOption[] = [],
  automaticPenaltyLabel?: string,
  mapContext?: RollMapDialogContext,
  targetContext?: RollTargetContext,
  fixedDifficulty?: number,
  baselineAttributeScore = 0,
  options: InternalRollInvocationOptions = {},
): Promise<RollDialogResult | null> {
  const profile = currentRulesProfile();
  const heroPointStrategy = currentSecondEditionHeroPointStrategy();
  const campaign = currentSecondEditionCampaignProfile();
  const superheroicCap = campaign.superheroicDieCodeCap;
  const heroPoints = actorHeroPointBalance(actor);
  const heroPointLimit = heroPointSpendLimit(
    heroPointStrategy,
    heroPoints,
    baselineAttributeScore,
  );
  const requestedRoll = options.requestedRoll;
  if (
    requestedRoll &&
    cancelledRequestedRollIds.delete(requestedRoll.requestId)
  ) {
    return null;
  }
  const defaultRollMode = requestedRoll?.rollMode ?? currentDefaultRollMode();
  const defaultDifficulty =
    fixedDifficulty ??
    Math.trunc(numberSetting(SHARED_SETTING_KEYS.defaultDifficulty, 0));
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/roll/dialog.hbs`,
    {
      actionPenaltyLabel: automaticPenaltyLabel,
      automaticResultModifier: options.automaticResultModifier ?? 0,
      hasAutomaticResultModifier: (options.automaticResultModifier ?? 0) !== 0,
      actor,
      advancedSkillContexts,
      advancedSkillContextOptions: Object.fromEntries(
        advancedSkillContexts.map((advanced) => [
          advanced.itemId,
          `${advanced.label} · +${advanced.scoreLabel} · ${advanced.augmentedScoreLabel}`,
        ]),
      ),
      selectedAdvancedSkillItemId: options.advancedSkillItemId,
      blindRollSelected: defaultRollMode === "blindroll",
      defaultDifficulty: defaultDifficulty > 0 ? defaultDifficulty : undefined,
      fixedDifficulty,
      hasFixedDifficulty: fixedDifficulty !== undefined,
      gmRollSelected: defaultRollMode === "gmroll",
      label,
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
      rollModeLocked: requestedRoll !== undefined,
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
      mapTrackedDice: mapContext?.trackedDice ?? 0,
      scoreLabel: formatPipScore(
        Math.max(0, score - (mapContext?.initialDice ?? 0) * 3),
      ),
      selfRollSelected: defaultRollMode === "selfroll",
      showDifficultyControls:
        kind !== "resistance" &&
        booleanSetting(SHARED_SETTING_KEYS.showDifficultyControls, true),
      showHeroPointDouble:
        !profile.compatibility.firstEditionMetaCurrency &&
        heroPointStrategy === "heroic" &&
        heroPoints > 0,
      showSuperheroicCapBypass:
        actor.type === "character" &&
        campaign.superheroicHeroPoints &&
        superheroicCap !== "none" &&
        heroPoints > 0,
      showHeroPointDice:
        !profile.compatibility.firstEditionMetaCurrency &&
        heroPointStrategy !== "heroic" &&
        heroPointLimit > 0,
      heroPointDiceWild: heroPointStrategy === "classic",
      heroPointLimit,
      heroPointStrategy,
      showModifierControls:
        kind !== "resistance" &&
        booleanSetting(SHARED_SETTING_KEYS.showModifierControls, true),
      showOppositionControls:
        kind === "resistance" || targetContext?.hasTargets === true
          ? false
          : booleanSetting(SHARED_SETTING_KEYS.showOppositionControls, true),
      doubledScoreLabel: formatPipScore(
        Math.max(0, score - (mapContext?.initialDice ?? 0) * 3) * 2,
      ),
      hasAdvancedSkillContexts: advancedSkillContexts.length > 0,
      hasActionPenalty: automaticPenaltyLabel !== undefined,
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
                profile.compatibility.firstEditionSuccessEvaluator
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
              const difficulty = inputNumber(form, "difficulty");
              const target = selectedRollTarget(form);
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
                ...(target === undefined ? {} : { target }),
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
        render: (_event, dialog) => {
          const targetSelect = dialog.element.querySelector<HTMLSelectElement>(
            'select[name="targetId"]',
          );
          if (targetSelect) {
            targetSelect.addEventListener("change", () =>
              updateRollPreview(dialog),
            );
          }
          dialog.element
            .querySelector<HTMLInputElement>('input[name="mapPenaltyDice"]')
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
            .querySelector<HTMLInputElement>('input[name="targetDodging"]')
            ?.addEventListener("change", () => updateRollPreview(dialog));
          dialog.element
            .querySelector<HTMLInputElement>(
              'input[name="coverDefenseModifier"]',
            )
            ?.addEventListener("input", () => updateRollPreview(dialog));
          updateRollPreview(dialog);
          if (requestedRoll) {
            requestedRollDialogs.set(requestedRoll.requestId, dialog);
            if (cancelledRequestedRollIds.delete(requestedRoll.requestId)) {
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
    if (requestedRoll) {
      requestedRollDialogs.delete(requestedRoll.requestId);
      cancelledRequestedRollIds.delete(requestedRoll.requestId);
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
  return requiresGmWildChoice(choices, result)
    ? requestGmWildChoice(choices, result)
    : promptWildChoiceDialog(choices, result.total);
}

function currentWildDiePolicy(): D6WildDiePolicy {
  const strategy = currentEditionCapabilityProfile().wildDie.strategy;
  if (strategy === "open-d6-critical-one") return "first-edition";
  if (strategy === "second-edition-basic") return "second-edition-basic";
  if (strategy === "second-edition-classic") return "second-edition-classic";
  if (strategy === "second-edition-simple") return "second-edition-simple";
  return "second-edition";
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
  if (currentRulesProfile().compatibility.firstEditionMetaCurrency) {
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
  const heroPointStrategy = currentSecondEditionHeroPointStrategy();
  const secondEditionHeroPoints =
    !currentRulesProfile().compatibility.firstEditionMetaCurrency;
  const showHeroPointReroll =
    secondEditionHeroPoints &&
    heroPointStrategy === "heroic" &&
    heroPoints > 0 &&
    canRerollFailedRoll(result);
  const showDoublingDown =
    currentEditionCapabilityProfile().retries.strategy ===
      "second-edition-doubling-down" && canDoubleDown(result);
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
    value,
  }));
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
                currentEditionCapabilityProfile().actionEconomy.strategy ===
                  "open-d6-flexible-action-allotment"
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
      difficulty: result.difficulty,
      hasDifficulty: result.difficulty !== undefined,
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
      hasFirstEditionMovementContext:
        result.request.context?.firstEditionMovement !== undefined,
      hasFirstEditionMortalityContext:
        result.request.context?.firstEditionMortality !== undefined,
      hasEnvironmentContext: result.request.context?.environment !== undefined,
      hasMachineCrewContext: result.request.context?.machineCrew !== undefined,
      hasMagicContext: result.request.context?.magic !== undefined,
      hasPsionicsContext: result.request.context?.psionics !== undefined,
      hasResistanceContext: result.request.context?.resistance !== undefined,
      hasScaleContext: result.request.context?.scale !== undefined,
      hasSuperheroicEquipmentContext:
        result.request.context?.superheroicEquipment !== undefined,
      superheroicEquipmentContext: result.request.context?.superheroicEquipment,
      hasWeaponAttackContext:
        result.request.context?.weaponAttack !== undefined,
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
                schoolLabel: game.i18n.localize(
                  `D6E2.Magic.School.${result.request.context.magic.school}`,
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
                result.request.context.weaponAttack.defenseKind === "dodge"
                  ? "D6E2.Combat.Dodge"
                  : result.request.context.weaponAttack.defenseKind === "range"
                    ? "D6E2.Combat.RangeDifficulty"
                    : "D6E2.Combat.Parry",
              ),
              defenseStrategyLabel: game.i18n.localize(
                result.request.context.weaponAttack.defenseStrategy ===
                  "grenade-targeting"
                  ? "D6E2.Combat.GrenadeTargeting"
                  : result.request.context.weaponAttack.defenseStrategy ===
                      "fixed-range"
                    ? "D6E2.Combat.NoDodge.FixedRange"
                    : result.request.context.weaponAttack.defenseStrategy ===
                        "machine-defense"
                      ? "D6E2.Combat.MachineDefense"
                      : result.request.context.weaponAttack.defenseKind ===
                          "parry"
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
      wildFaces,
      wildDieStrategy,
      wildOutcomeLabel: game.i18n.localize(
        `D6E2.Roll.Outcome.${result.wildOutcome}`,
      ),
    },
  );
  const flags = {
    [SYSTEM_ID]: {
      roll: structuredClone(result),
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
    await existingMessage.update({ content, flags });
    return existingMessage;
  }
  return ChatMessage.create({
    ...visibilityForMode(result.request.rollMode),
    content,
    flags,
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
  let pendingMessage: FoundryChatMessageDocument | undefined;
  const executed = await executeD6Roll(
    request,
    currentRulesProfile(),
    {
      chooseWildDie: promptWildChoice,
      presentWildDieRoll: async (result, artifacts) => {
        pendingMessage = await postRoll(actor, result, artifacts);
        await waitForDiceSoNiceRollAnimation(pendingMessage.id);
      },
      rollBaseDice: rolledBatch,
      rollWildDie: (explodeOnSix) => rolledBatch(1, "dw", explodeOnSix),
    },
    currentWildDiePolicy(),
  );
  if (!executed) {
    await pendingMessage?.delete();
    return null;
  }
  await applyHeroPointTransaction(actor, executed.result);
  await postRoll(actor, executed.result, executed.artifacts, pendingMessage);
  return executed.result;
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
  const secondEditionActionSegments =
    currentEditionCapabilityProfile().actionEconomy.strategy ===
    "second-edition-action-segments";
  const firstEditionFlexibleActions =
    currentEditionCapabilityProfile().actionEconomy.strategy ===
    "open-d6-flexible-action-allotment";
  const appliesActionPenalty =
    options.ignoreActionEconomy !== true &&
    ["attribute", "skill", "weapon-attack"].includes(requestSource.kind);
  const assistance = currentActionDeclarationAssistance();
  const healthCondition = record(actor.system.health).condition;
  const health = record(actor.system.health);
  const firstEditionDamage =
    currentEditionCapabilityProfile().damage.strategy ===
    "open-d6-wounds-or-body-points";
  const firstEditionWound = isFirstEditionWoundLevel(health.firstEditionWound)
    ? health.firstEditionWound
    : "healthy";
  const firstEditionDamageMode = currentFirstEditionDamageMode();
  const firstEditionBodyPoints = record(health.firstEditionBodyPoints);
  const firstEditionStuns = record(health.firstEditionStuns);
  const firstEditionStunPenalty =
    firstEditionDamage &&
    booleanSetting(FIRST_EDITION_OPTION_KEYS.trackStuns, false)
      ? Math.min(2, Math.max(0, integer(firstEditionStuns.penaltyDice))) * 3
      : 0;
  const effectiveFirstEditionWound =
    firstEditionDamageMode === "wounds"
      ? firstEditionWound
      : firstEditionBodyPointWound(
          integer(firstEditionBodyPoints.current),
          integer(firstEditionBodyPoints.maximum),
        );
  const firstEditionConsciousness = stringValue(
    record(health.firstEditionState).consciousness,
  );
  const condition = isSecondEditionCondition(healthCondition)
    ? healthCondition
    : "healthy";
  const environmentEffect =
    currentEditionCapabilityProfile().environments.state === "active"
      ? readActorEnvironmentEffect(actor)
      : null;
  const environmentPenalty = environmentEffect?.penaltyScore ?? 0;
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
        ? firstEditionDamage
          ? (firstEditionDamageMode === "body-points"
              ? 0
              : firstEditionWoundPenaltyScore(effectiveFirstEditionWound)) +
            firstEditionStunPenalty
          : secondEditionActionSegments
            ? secondEditionConditionPenaltyScore(condition)
            : 0
        : 0;
  const featureBonusScore = options.featureBonus?.score === 9 ? 9 : 0;
  const gadgetBonusScore = superheroicEquipmentContext?.bonusScore ?? 0;
  const initialRollPlan = actionEconomyRollPlan({
    assistance,
    baseScore: requestSource.score + featureBonusScore + gadgetBonusScore,
    conditionPenaltyScore: conditionPenalty,
    environmentPenaltyScore: environmentPenalty,
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
      featureBonusScore +
      gadgetBonusScore -
      automaticPenalty,
    requestSource.kind,
    dialogAdvancedSkillContexts,
    automaticPenalty > 0 ? `−${formatPipScore(automaticPenalty)}` : undefined,
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
  if (controls.target?.attack && controls.target.outOfRange) {
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
    baseScore:
      unpenalizedScore +
      (options.combinedAction?.bonusScore ?? 0) -
      (options.combinedAction?.penaltyScore ?? 0) +
      featureBonusScore +
      gadgetBonusScore +
      scaleModifierScore,
    conditionPenaltyScore: conditionPenalty,
    environmentPenaltyScore: environmentPenalty,
    manualMapDice: combinedCommandRoll ? 0 : controls.mapPenaltyDice,
    movementPenaltyScore: movementPenalty,
    rollCostsAction: appliesActionPenalty,
    trackedMapPenaltyScore: appliedTrackedMapPenalty,
  });
  if (!finalRollPlan.legal) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Combat.Error.PoolBelowOneDie"),
    );
    return null;
  }
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
    featureBonusScore === 0 &&
    gadgetBonusScore === 0 &&
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
                    condition: firstEditionDamage
                      ? firstEditionWound
                      : condition,
                    conditionPenaltyScore: conditionPenalty,
                    environmentPenaltyScore: environmentPenalty,
                    mapPenaltyScore: finalRollPlan.mapPenaltyScore,
                    mapPenaltySource: finalRollPlan.mapPenaltySource,
                    movementSkillPenaltyScore: movementPenalty,
                    penaltyLabel: `−${formatPipScore(
                      finalRollPlan.totalPenaltyScore,
                    )}`,
                    penaltyScore: finalRollPlan.totalPenaltyScore,
                    ...(roundState === null ? {} : { round: roundState.round }),
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
            ...(superheroicEquipmentContext === undefined
              ? {}
              : { superheroicEquipment: superheroicEquipmentContext }),
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
    ...(controls.opposition === undefined
      ? {}
      : { opposition: controls.opposition }),
    resultModifier:
      controls.resultModifier + (options.automaticResultModifier ?? 0),
    rollMode: controls.rollMode,
    score: finalRollPlan.effectiveScore,
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
  if (currentSecondEditionHeroPointStrategy() !== "heroic") {
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
  options: D6RollInvocationOptionsV1 = {},
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
    firstEditionAttributeRole("strength"),
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
  const strengthId = firstEditionAttributeRole("strength");
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
    firstEditionAttributeRole("strength"),
    undefined,
    undefined,
    30,
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
    firstEditionAttributeRole("strength"),
    undefined,
    undefined,
    6,
    true,
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
  const capabilities = currentEditionCapabilityProfile();
  if (
    capabilities.actionEconomy.strategy !==
      "open-d6-flexible-action-allotment" ||
    capabilities.defenses.strategy !== "active-defense-scheduler"
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
  options: D6RollInvocationOptionsV1 = {},
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
    return executeActorRoll(
      actor,
      {
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
    currentEditionCapabilityProfile().advancedSkills.state === "active";
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
      source: {
        actorId: actor.id,
        actorName: actor.name,
        attributeId,
        itemId: skill.id,
      },
    },
    options,
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
    !currentRulesProfile().compatibility.firstEditionAttributes ||
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
    !currentRulesProfile().compatibility.firstEditionAttributes ||
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
      manifestation,
      remaining: nextPool.current,
      maximum: nextPool.maximum,
      schoolLabel: game.i18n.localize(`D6E2.Magic.School.${design.school}`),
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
    const pending = record(
      record(
        (item as FoundryItemDocument & { readonly flags?: unknown }).flags,
      )[SYSTEM_ID],
    ).pendingAutofire;
    const autofire = record(pending);
    const damageModifier = Math.max(0, integer(autofire.damageModifier));
    const fixedDamageScore = currentEffectivePipScore(
      integer(item.system.damage),
    );
    const strengthDamageScore =
      item.type === "weapon" &&
      item.system.damageBasis === "strength-damage" &&
      currentRulesProfile().compatibility.firstEditionAttributes
        ? firstEditionStrengthDamageScore(
            currentEffectivePipScore(
              integer(
                record(
                  record(actor.system.attributes)[activeStrengthAttributeId()],
                ).score,
              ),
            ),
          )
        : 0;
    const result = await executeActorRoll(
      actor,
      {
        ...(damageModifier > 0
          ? {
              context: {
                autofire: {
                  attackModifier: -Math.max(0, integer(autofire.spend)),
                  damageModifier,
                  maximum: Math.max(0, integer(autofire.maximum)),
                  sourcePage: 163,
                  spend: Math.max(0, integer(autofire.spend)),
                },
              },
            }
          : {}),
        kind: "damage",
        label: `${item.name} · ${game.i18n.localize("D6E2.Item.Damage")}`,
        score: fixedDamageScore + strengthDamageScore,
        source: {
          actorId: actor.id,
          actorName: actor.name,
          attributeId: "",
          itemId: item.id,
        },
        targetContext: buildWeaponAttackTargetContext(actor, item, "damage"),
      },
      { ...options, automaticResultModifier: damageModifier },
    );
    if (damageModifier > 0 && result) {
      await item.update({ [`flags.${SYSTEM_ID}.pendingAutofire`]: null });
    }
    return result;
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
      targetContext: buildWeaponAttackTargetContext(actor, item),
    },
    { ...options, automaticResultModifier: autofirePlan.attackModifier },
  );
  if (result && autofirePlan.spend > 0) {
    await item.update({ [`flags.${SYSTEM_ID}.pendingAutofire`]: autofirePlan });
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
  const nativeSecondEdition =
    currentEditionCapabilityProfile().damage.strategy ===
    "second-edition-condition-track";
  const bodyPoints =
    !nativeSecondEdition && currentFirstEditionDamageMode() !== "wounds";
  return secondEditionResistancePlan(
    bodyPoints ? 0 : currentEffectivePipScore(integer(brawn.score)),
    armor,
    nativeSecondEdition ? hyperLethal.maximumResistanceScore : undefined,
  );
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

export async function rollResistanceAgainst(
  actorValue: object,
  preferredSource?: D6ScaleRollContext,
  damageTotal?: number,
): Promise<D6RollResultV1 | null> {
  const actor = actorDocument(actorValue);
  const damageStrategy = currentEditionCapabilityProfile().damage.strategy;
  if (
    damageStrategy !== "second-edition-condition-track" &&
    damageStrategy !== "open-d6-wounds-or-body-points"
  )
    return null;
  const machine = ["starship", "vehicle"].includes(actor.type);
  const machinePlan = machine ? machineResistancePlan(actor) : null;
  const personalPlan = machine ? null : actorResistancePlan(actor);
  const machineKind = machine
    ? actor.type === "starship"
      ? "starship"
      : "vehicle"
    : undefined;
  if (machine && damageStrategy !== "second-edition-condition-track") {
    return null;
  }
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
  return executeActorRoll(actor, {
    context: {
      resistance: {
        armorContributors: contributors.map((item) => ({
          itemId: item.id,
          label: item.label,
          score: item.score,
        })),
        armorScore: protectionScore,
        baseLabel: game.i18n.localize(
          machine
            ? "D6E2.Machine.Hull"
            : damageStrategy === "open-d6-wounds-or-body-points" &&
                currentFirstEditionDamageMode() !== "wounds"
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
          : damageStrategy === "open-d6-wounds-or-body-points"
            ? 76
            : 34,
        strategy: machine
          ? "second-edition-machine-conditions"
          : damageStrategy === "open-d6-wounds-or-body-points"
            ? currentFirstEditionDamageMode() === "wounds"
              ? "open-d6-wound-levels"
              : "open-d6-body-points"
            : "second-edition-conditions",
      },
    },
    kind: "resistance",
    label: game.i18n.localize("D6E2.Combat.Resistance"),
    ...(damageTotal === undefined
      ? {}
      : { fixedDifficulty: Math.max(0, Math.trunc(damageTotal)) }),
    score: machinePlan?.score ?? personalPlan?.score ?? 0,
    source: {
      actorId: actor.id,
      actorName: actor.name,
      attributeId:
        machine || currentFirstEditionDamageMode() === "wounds"
          ? machine
            ? "hull"
            : "brawn"
          : "",
    },
    targetContext: buildResistanceSourceContext(actor, preferredSource),
  });
}
