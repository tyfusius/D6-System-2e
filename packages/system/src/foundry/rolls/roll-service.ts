import {
  actionEconomyRollPlan,
  advancedSkillAugmentedScore,
  canDoubleDown,
  canRerollFailedRoll,
  D6_ROLL_CONTRACT_VERSION,
  doublingDownRequest,
  formatPipScore,
  firstEditionActiveDefensePlan,
  firstEditionWoundPenaltyScore,
  isFirstEditionWoundLevel,
  type FirstEditionMovementPlan,
  heroPointBalanceAfter,
  heroPointRerollRequest,
  isSecondEditionCondition,
  secondEditionConditionAllowsActions,
  secondEditionConditionPenaltyScore,
  secondEditionDefenseForPosture,
  secondEditionDefenseKind,
  secondEditionRangeForDistance,
  secondEditionMachineWeaponAttackPlan,
  secondEditionResistancePlan,
  secondEditionScaleInteraction,
  secondEditionStaticDefense,
  secondEditionWeaponAttackKind,
  specializationScore,
  type D6HeroPointUse,
  type D6AdvancedSkillRollContext,
  type D6RollInvocationOptionsV1,
  type D6ParticipantKind,
  type D6RollKind,
  type D6RollMode,
  type D6RollOpposition,
  type D6RollRequestV1,
  type D6RollResultV1,
  type D6RollContextV1,
  type D6ScaleRollApplication,
  type D6ScaleRollContext,
  type D6WildDieChoice,
  type D6WeaponAttackRollContext,
  type ActionDeclarationAssistanceMode,
  type FirstEditionActiveDefenseKind,
  type SecondEditionAttackKind,
  type SecondEditionRangeBand,
} from "@d6-system-2e/core";
import { executeD6Roll } from "../../application/rolls/execute-roll";
import { SYSTEM_ID } from "../../constants";
import { currentTerminology } from "../../registries/terminology";
import { currentRulesProfile } from "../../settings/rules-compatibility";
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
} from "../../settings/settings-catalog";
import { currentEditionCapabilityProfile } from "../../settings/edition-capabilities";
import {
  currentCombinedPipScore,
  currentEffectivePipScore,
} from "../../settings/pip-rules";
import { advancedSkillIssues } from "../skill-module";
import { integer, record, stringValue } from "../sheets/values";
import { readCombatantRound } from "../combat-service";
import { d6System2eDiceAppearance } from "../dice-so-nice";
import { chatVisibilityForMode } from "./chat-visibility";
import {
  promptWildChoiceDialog,
  requestGmWildChoice,
  requiresGmWildChoice,
} from "./roll-authority";

interface RollDialogResult {
  readonly advancedSkillItemId?: string;
  readonly target?: {
    readonly attack?: D6WeaponAttackRollContext;
    readonly outOfRange: boolean;
    readonly scale: D6ScaleRollContext;
  };
  readonly difficulty?: number;
  readonly heroPointUse: D6HeroPointUse;
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
  readonly defenseKind?: "dodge" | "parry";
  readonly distance?: number;
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
  readonly selectedTarget: RollTargetOption | null;
  readonly targets: readonly RollTargetOption[];
}

interface AdvancedSkillContextOption extends D6AdvancedSkillRollContext {
  readonly augmentedScore: number;
  readonly augmentedScoreLabel: string;
  readonly scoreLabel: string;
}

interface RequestedRollDialog {
  close(): Promise<void>;
}

interface InternalRollInvocationOptions extends D6RollInvocationOptionsV1 {
  readonly automaticResultModifier?: number;
  readonly ignoreActionEconomy?: boolean;
  readonly ignoreTrackedMapPenalty?: boolean;
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
  if (override > 0) {
    return secondEditionDefenseForPosture(override, attackKind, posture);
  }
  const attributeId = defenseKind === "dodge" ? "perception" : "agility";
  const attribute = record(record(actor.system.attributes)[attributeId]);
  return secondEditionDefenseForPosture(
    secondEditionStaticDefense(
      currentEffectivePipScore(integer(attribute.score)),
    ),
    attackKind,
    posture,
  );
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
  if (
    currentEditionCapabilityProfile().defenses.strategy !== "static-defenses"
  ) {
    return Object.freeze({
      hasTargets: false,
      purpose,
      selectedTarget: null,
      targets: Object.freeze([]),
    });
  }
  const range = record(weapon.system.range);
  const ranges = {
    long: integer(range.long),
    medium: integer(range.medium),
    short: integer(range.short),
  };
  const attackKind = secondEditionWeaponAttackKind(ranges);
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
      const scale = secondEditionScaleInteraction(sourceRank, targetRank);
      const distance =
        sourceToken === undefined
          ? undefined
          : gridDistance(sourceToken, token);
      const resolution =
        distance === undefined
          ? undefined
          : secondEditionRangeForDistance(
              distance,
              ranges,
              canvas.scene?.grid?.distance ?? 1,
            );
      const rangeBand =
        resolution?.band === null ? undefined : resolution?.band;
      const tokenImage = token.document?.texture?.src?.trim() ?? "";
      const actorImage = targetActor.img.trim();
      const scaleContext: D6ScaleRollContext = Object.freeze({
        application: purpose,
        modifierScore:
          purpose === "damage"
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
                defense:
                  targetStaticDefense(targetActor, attackKind) +
                  (attackKind === "ranged" ? scale.targetDodgeBonus : 0),
                defenseKind,
              }
            : {}),
          ...(distance === undefined ? {} : { distance }),
          id: token.id,
          img: tokenImage.length > 0 ? tokenImage : actorImage,
          name,
          outOfRange: purpose === "attack" && resolution?.outOfRange === true,
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
            defense: Number.isFinite(defense)
              ? Math.max(0, Math.trunc(defense))
              : 0,
            defenseKind: attackKind === "ranged" ? "dodge" : "parry",
            ...(Number.isFinite(distance)
              ? { distance: Math.max(0, distance) }
              : {}),
            ...(rangeBand === "melee" ||
            rangeBand === "short" ||
            rangeBand === "medium" ||
            rangeBand === "long"
              ? { rangeBand }
              : {}),
            targetActorId,
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
  if (defense) {
    defense.textContent = defenseValue
      ? `${game.i18n.localize(
          defenseKind === "parry" ? "D6E2.Combat.Parry" : "D6E2.Combat.Dodge",
        )} ${defenseValue}`
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
      Number(
        select?.dataset.baseScore ??
          dialog.element.querySelector<HTMLElement>(".od6roll-shell")?.dataset
            .baseScore,
      ) || 0,
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
  scores.forEach((score) => {
    score.textContent = formatPipScore(adjustedScore);
  });
  if (doubledScore) {
    doubledScore.textContent = formatPipScore(adjustedScore * 2);
  }
  const form = (select ?? mapInput)?.closest("form");
  const difficulty = form?.elements.namedItem("difficulty");
  if (
    difficulty instanceof HTMLInputElement &&
    option?.dataset.scaleApplication === "attack"
  ) {
    difficulty.value = defenseValue;
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
  options: InternalRollInvocationOptions = {},
): Promise<RollDialogResult | null> {
  const profile = currentRulesProfile();
  const resources = record(actor.system.resources);
  const heroPoints = integer(record(resources.heroPoints).value);
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
        !profile.compatibility.firstEditionMetaCurrency && heroPoints > 0,
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
                heroPointUse: inputChecked(form, "doubleDieCode")
                  ? "double-die-code"
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

async function rolledBatch(
  count: number,
  denomination: "d6" | "dw" = "d6",
): Promise<{
  readonly artifact: FoundryRoll | null;
  readonly faces: readonly number[];
}> {
  if (count === 0) return { artifact: null, faces: Object.freeze([]) };
  const roll = await new Roll(
    `${count}${denomination}`,
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
      hasFirstEditionActiveDefenseContext:
        result.request.context?.firstEditionActiveDefense !== undefined,
      hasFirstEditionMovementContext:
        result.request.context?.firstEditionMovement !== undefined,
      hasMachineCrewContext: result.request.context?.machineCrew !== undefined,
      hasResistanceContext: result.request.context?.resistance !== undefined,
      hasScaleContext: result.request.context?.scale !== undefined,
      hasWeaponAttackContext:
        result.request.context?.weaponAttack !== undefined,
      hasOpposition: result.opposition !== undefined,
      hasDoublingDownContext:
        result.request.context?.doublingDown !== undefined,
      doublingDownContext: result.request.context?.doublingDown,
      heroPointAward: result.heroPointAward,
      heroPointReroll: result.request.heroPointUse === "reroll-failed",
      heroPointSpent: result.heroPointSpent,
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
            },
      scaleContext:
        result.request.context?.scale === undefined
          ? undefined
          : {
              ...result.request.context.scale,
              applicationLabel: game.i18n.localize(
                `D6E2.Combat.ScaleApplication.${result.request.context.scale.application}`,
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
                  : "D6E2.Combat.Parry",
              ),
              rangeLabel:
                result.request.context.weaponAttack.rangeBand === undefined
                  ? game.i18n.localize("D6E2.Combat.RangeUnmeasured")
                  : rangeLabel(
                      result.request.context.weaponAttack.rangeBand,
                      false,
                    ),
            },
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
        ...(result.request.context?.scale === undefined
          ? {}
          : { scale: result.request.context.scale }),
        ...(result.request.context?.weaponAttack === undefined
          ? {}
          : {
              attackKind: result.request.context.weaponAttack.attackKind,
              defense: result.request.context.weaponAttack.defense,
              defenseKind: result.request.context.weaponAttack.defenseKind,
              rangeBand: result.request.context.weaponAttack.rangeBand ?? "",
              targetActorId: result.request.context.weaponAttack.targetActorId,
              targetTokenId:
                result.request.context.weaponAttack.targetTokenId ?? "",
              weaponId: result.request.context.weaponAttack.weaponId,
            }),
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
    rollWildDie: () => rolledBatch(1, "dw"),
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
    readonly context?: D6RollContextV1;
    readonly fixedDifficulty?: number;
    readonly targetContext?: RollTargetContext;
  },
  options: InternalRollInvocationOptions = {},
): Promise<D6RollResultV1 | null> {
  const roundState = readCombatantRound(actor);
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
  const firstEditionConsciousness = stringValue(
    record(health.firstEditionState).consciousness,
  );
  const condition = isSecondEditionCondition(healthCondition)
    ? healthCondition
    : "healthy";
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
    (["mortally-wounded", "dead"].includes(firstEditionWound) ||
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
  const appliedTrackedMapPenalty = options.ignoreTrackedMapPenalty
    ? 0
    : trackedMapPenalty;
  const movementPenalty =
    secondEditionActionSegments &&
    appliesActionPenalty &&
    requestSource.kind !== "attribute"
      ? (roundState?.movementSkillPenaltyScore ?? 0)
      : 0;
  const conditionPenalty = appliesActionPenalty
    ? firstEditionDamage
      ? firstEditionWoundPenaltyScore(firstEditionWound)
      : secondEditionActionSegments
        ? secondEditionConditionPenaltyScore(condition)
        : 0
    : 0;
  const featureBonusScore = options.featureBonus?.score === 9 ? 9 : 0;
  const initialRollPlan = actionEconomyRollPlan({
    assistance,
    baseScore: requestSource.score + featureBonusScore,
    conditionPenaltyScore: conditionPenalty,
    movementPenaltyScore: movementPenalty,
    rollCostsAction: appliesActionPenalty,
    trackedMapPenaltyScore: appliedTrackedMapPenalty,
  });
  const automaticPenalty = conditionPenalty + movementPenalty;
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
    requestSource.score + featureBonusScore - automaticPenalty,
    requestSource.kind,
    dialogAdvancedSkillContexts,
    automaticPenalty > 0 ? `−${formatPipScore(automaticPenalty)}` : undefined,
    appliesActionPenalty
      ? {
          assistance,
          initialDice: initialRollPlan.mapPenaltyScore / 3,
          trackedDice: initialRollPlan.trackedMapPenaltyScore / 3,
        }
      : undefined,
    requestSource.targetContext,
    requestSource.fixedDifficulty,
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
    baseScore: unpenalizedScore + featureBonusScore + scaleModifierScore,
    conditionPenaltyScore: conditionPenalty,
    manualMapDice: controls.mapPenaltyDice,
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
  const request: D6RollRequestV1 = Object.freeze({
    contractVersion: D6_ROLL_CONTRACT_VERSION,
    ...(advancedSkill === undefined &&
    finalRollPlan.totalPenaltyScore === 0 &&
    options.requestedRoll === undefined &&
    featureBonusScore === 0 &&
    scaleModifierScore === 0 &&
    requestSource.context === undefined &&
    controls.target === undefined
      ? {}
      : {
          context: {
            ...requestSource.context,
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
            ...(controls.target === undefined
              ? {}
              : { scale: controls.target.scale }),
            ...(controls.target?.attack === undefined
              ? {}
              : {
                  weaponAttack: {
                    attackKind: controls.target.attack.attackKind,
                    defense: controls.target.attack.defense,
                    defenseKind: controls.target.attack.defenseKind,
                    ...(controls.target.attack.distance === undefined
                      ? {}
                      : { distance: controls.target.attack.distance }),
                    ...(controls.target.attack.rangeBand === undefined
                      ? {}
                      : { rangeBand: controls.target.attack.rangeBand }),
                    targetActorId: controls.target.attack.targetActorId,
                    targetName: controls.target.attack.targetName,
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
  options: D6RollInvocationOptionsV1 = {},
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
    { ignoreActionEconomy: true },
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
    "brawn",
    fixedDifficulty,
    medicineItemId,
  );
}

export async function rollFirstEditionUnconsciousDuration(
  actorValue: object,
): Promise<D6RollResultV1 | null> {
  return rollFirstEditionRecoveryCheck(
    actorValue,
    game.i18n.localize(
      "D6E2.Combat.FirstEdition.Consciousness.UnconsciousDuration",
    ),
    "brawn",
    undefined,
    undefined,
    30,
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
  return executeActorRoll(
    actor,
    {
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
    },
    options,
  );
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
      targetContext: buildWeaponAttackTargetContext(actor, item, "damage"),
    });
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
  return executeActorRoll(actor, {
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
  });
}

export function actorResistancePlan(actor: FoundryActorDocument) {
  const brawn = record(record(actor.system.attributes).brawn);
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
  return secondEditionResistancePlan(
    currentEffectivePipScore(integer(brawn.score)),
    armor,
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
  const plan = actorResistancePlan(actor);
  return executeActorRoll(actor, {
    context: {
      resistance: {
        armorContributors: plan.contributors.map((item) => ({
          itemId: item.id,
          label: item.label,
          score: item.score,
        })),
        armorScore: plan.armorScore,
        brawnScore: plan.brawnScore,
        sourcePage:
          damageStrategy === "open-d6-wounds-or-body-points" ? 76 : 34,
        strategy:
          damageStrategy === "open-d6-wounds-or-body-points"
            ? "open-d6-wound-levels"
            : "second-edition-conditions",
      },
    },
    kind: "resistance",
    label: game.i18n.localize("D6E2.Combat.Resistance"),
    ...(damageTotal === undefined
      ? {}
      : { fixedDifficulty: Math.max(0, Math.trunc(damageTotal)) }),
    score: plan.score,
    source: {
      actorId: actor.id,
      actorName: actor.name,
      attributeId: "brawn",
    },
    targetContext: buildResistanceSourceContext(actor, preferredSource),
  });
}
