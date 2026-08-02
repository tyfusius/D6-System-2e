import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rollService = readFileSync(
  new URL("./roll-service.ts", import.meta.url),
  "utf8",
);
const dialog = readFileSync(
  new URL("../../../../../templates/roll/dialog.hbs", import.meta.url),
  "utf8",
);
const chatCard = readFileSync(
  new URL("../../../../../templates/roll/chat-card.hbs", import.meta.url),
  "utf8",
);
const chatCardActions = readFileSync(
  new URL("./chat-card-actions.ts", import.meta.url),
  "utf8",
);
const characterSheet = readFileSync(
  new URL("../sheets/character-sheet.ts", import.meta.url),
  "utf8",
);
const tokenMovementController = readFileSync(
  new URL("../token-movement-controller.ts", import.meta.url),
  "utf8",
);
const tokenMovementService = readFileSync(
  new URL("../token-movement-service.ts", import.meta.url),
  "utf8",
);
const combatTemplate = readFileSync(
  new URL(
    "../../../../../templates/actor/character/combat.hbs",
    import.meta.url,
  ),
  "utf8",
);
const combatDeclarationTemplate = readFileSync(
  new URL(
    "../../../../../templates/actor/character/combat-declaration.hbs",
    import.meta.url,
  ),
  "utf8",
);
const firstEditionActionsTemplate = readFileSync(
  new URL(
    "../../../../../templates/actor/character/first-edition-actions.hbs",
    import.meta.url,
  ),
  "utf8",
);
const combatService = readFileSync(
  new URL("../combat-service.ts", import.meta.url),
  "utf8",
);
const damageResolution = readFileSync(
  new URL("./damage-resolution.ts", import.meta.url),
  "utf8",
);
const itemTemplate = readFileSync(
  new URL("../../../../../templates/item/item-sheet.hbs", import.meta.url),
  "utf8",
);

describe("Second Edition combat UI contracts", () => {
  it("creates a responsive-combat action container without Hero Point follow-ups", () => {
    expect(chatCardActions).toContain(
      'html.querySelector<HTMLElement>(".od6chat-actions")',
    );
    expect(chatCardActions).toContain('document.createElement("div")');
    expect(chatCardActions).toContain('actions.className = "od6chat-actions"');
  });

  it("clones immutable Magic Point results at the Foundry flag boundary", () => {
    expect(rollService).toContain("magicPointCast: structuredClone(result)");
  });

  it("carries a selected scene target and its static defense into the roll", () => {
    expect(dialog).toContain('name="targetId"');
    expect(dialog).toContain('data-defense="{{target.defense}}"');
    expect(dialog).toContain('data-range-band="{{target.rangeBand}}"');
    expect(dialog).toContain('data-out-of-range="{{target.outOfRange}}"');
    expect(rollService).toContain("buildWeaponAttackTargetContext");
    expect(rollService).toContain("TargetOutOfRange");
    expect(rollService).toContain("weaponAttack:");
  });

  it("applies and audits relative scale for attack, damage, and resistance", () => {
    expect(dialog).toContain(
      'data-scale-modifier="{{target.scale.modifierScore}}"',
    );
    expect(dialog).toContain(
      'data-scale-source-actor-id="{{target.scale.sourceActorId}}"',
    );
    expect(dialog).toContain(
      'data-scale-target-actor-id="{{target.scale.targetActorId}}"',
    );
    expect(dialog).toContain("data-roll-doubled-score");
    expect(chatCard).toContain("hasScaleContext");
    expect(chatCard).toContain("scaleContext.modifierLabel");
    expect(rollService).toContain("secondEditionScaleInteraction");
    expect(rollService).toContain(
      'buildWeaponAttackTargetContext(actor, item, "damage")',
    );
    expect(rollService).toContain(
      "buildResistanceSourceContext(actor, preferredSource)",
    );
    expect(rollService).toContain("Number(control.value)");
  });

  it("offers the page-32 finish-prone movement choice", () => {
    expect(characterSheet).toMatch(/===\s+"second-edition-segment-movement"/);
    expect(combatDeclarationTemplate).toContain('name="endProne"');
    expect(combatDeclarationTemplate).toContain("Movement.EndProne");
    expect(characterSheet).toContain("endProne.disabled");
    expect(characterSheet).toContain("D6E2.Combat.Movement.EndProne");
  });

  it("requires an explicit valid canvas destination for automatic Token movement", () => {
    expect(combatTemplate).toContain('data-action="moveSecondEditionToken"');
    expect(characterSheet).toContain("chooseTokenMovementDestination");
    expect(tokenMovementController).toContain('runtime.stage.on("pointermove"');
    expect(tokenMovementController).toContain('runtime.stage.on("pointerdown"');
    expect(tokenMovementController).toContain("state?.canMove");
    expect(tokenMovementService).toContain('type: "move"');
    expect(tokenMovementService).toContain("completeNextCombatantAction");
    expect(tokenMovementService).toContain("originDocument");
  });

  it("declares real roll sources and previews the final legal pool", () => {
    expect(combatDeclarationTemplate).toContain('name="actionSource"');
    expect(combatDeclarationTemplate).toContain("data-declaration-add");
    expect(combatDeclarationTemplate).toContain("data-declaration-remove");
    expect(combatDeclarationTemplate).toContain("data-declaration-summary");
    expect(characterSheet).toContain("combatDeclarationOptions(this.actor)");
    expect(characterSheet).toContain(
      "option.dataset.score = String(source.score)",
    );
    expect(characterSheet).toContain("option.textContent =");
    expect(characterSheet).toContain("effectiveScore >= 3");
    expect(characterSheet).toContain("declare.disabled = invalid");
    expect(combatService).toContain("secondEditionDeclarationPlan");
    expect(combatService).toContain("D6E2.Combat.Error.InvalidActionSource");
    expect(combatService).toContain(
      "D6E2.Combat.Error.DeclarationPoolBelowOneDie",
    );
  });

  it("separates MAP, movement, and condition penalties", () => {
    expect(rollService).toContain("roundState.actionPenaltyScore");
    expect(rollService).toContain("roundState?.movementSkillPenaltyScore");
    expect(rollService).toContain("secondEditionConditionPenaltyScore");
    expect(rollService).toContain("secondEditionConditionAllowsActions");
    expect(rollService).toContain("actionEconomyRollPlan");
    expect(rollService).toContain("currentActionDeclarationAssistance");
    expect(dialog).toContain('name="mapPenaltyDice"');
    expect(dialog).toContain('min="0"');
    expect(chatCard).toContain("actionEconomyContext.mapSourceLabel");
    expect(chatCard).toContain("actionEconomyContext.actionCountLabel");
  });

  it("applies and audits active environment penalties across roll kinds", () => {
    expect(rollService).toContain("readActorEnvironmentEffect(actor)");
    expect(rollService).toContain(
      "environmentPenaltyScore: environmentPenalty",
    );
    expect(rollService).toContain('"affected-roll"');
    expect(rollService).toContain("rollSecondEditionEnvironmentExposure");
    expect(rollService).toContain("rollSecondEditionEnvironmentAid");
    expect(chatCard).toContain("hasEnvironmentContext");
    expect(chatCard).toContain("environmentContext.hazardLabel");
    expect(chatCard).toContain("environmentContext.sourcePage");
  });

  it("locks and visibly explains remaining actions after a fresh Wound", () => {
    expect(combatService).toContain("forfeitRemainingCombatActions");
    expect(rollService).toContain("roundState?.actionForfeiture?.reason");
    expect(rollService).toContain("D6E2.Combat.Error.ActionsForfeitedByWound");
    expect(combatTemplate).toContain("combat.roundState.actionForfeiture");
    expect(combatTemplate).toContain("D6E2.Combat.ActionsForfeitedSource");
  });

  it("supports count-only First Edition commitments without exact actions", () => {
    expect(combatTemplate).toContain("combat.firstEditionActionsActive");
    expect(combatTemplate).toContain('data-action="commitFirstEditionActions"');
    expect(combatTemplate).toContain('data-action="spendFirstEditionAction"');
    expect(firstEditionActionsTemplate).toContain('name="plannedActionCount"');
    expect(firstEditionActionsTemplate).toContain('name="actionAllotment"');
    expect(firstEditionActionsTemplate).toContain('name="defense"');
    expect(firstEditionActionsTemplate).toContain('name="actionAlreadySpent"');
    expect(characterSheet).toContain("combat.commitFirstEdition");
    expect(characterSheet).toContain("combat.spendFirstEdition");
    expect(rollService).toContain("roundState.firstEditionActionPenaltyScore");
  });

  it("preserves target, range, and defense as visible chat audit data", () => {
    expect(chatCard).toContain("hasWeaponAttackContext");
    expect(chatCard).toContain("weaponAttackContext.targetName");
    expect(chatCard).toContain("weaponAttackContext.rangeLabel");
    expect(chatCard).toContain("weaponAttackContext.defense");
    expect(rollService).toContain("targetActorId:");
    expect(rollService).toContain("targetTokenId:");
  });

  it("adds only GM-adjudicated flat Cover to targeted ranged defense", () => {
    expect(dialog).toContain("targetContext.showCoverModifier");
    expect(dialog).toContain('name="coverDefenseModifier"');
    expect(dialog).toContain('min="0"');
    expect(rollService).toContain("secondEditionCoverDefensePlan");
    expect(rollService).toContain('attackKind === "ranged"');
    expect(rollService).toContain("coverSourcePage: 30");
    expect(rollService).toContain(
      "coverModifier: result.request.context.weaponAttack.coverModifier",
    );
    expect(chatCard).toContain("weaponAttackContext.coverModifier");
    expect(chatCard).toContain("weaponAttackContext.baseDefense");
    expect(chatCard).toContain("weaponAttackContext.coverSourcePage");
  });

  it("makes No Dodge range difficulty explicit and auditable", () => {
    expect(dialog).toContain(
      'data-defense-strategy="{{target.defenseStrategy}}"',
    );
    expect(dialog).toContain(
      'data-defense-source-page="{{target.defenseSourcePage}}"',
    );
    expect(dialog).toContain('name="targetDodging"');
    expect(dialog).toContain("targetContext.showTargetDodging");
    expect(rollService).toContain('"no-dodge-range-difficulties"');
    expect(rollService).toContain("secondEditionNoDodgeDefensePlan");
    expect(rollService).toContain(
      "distance <= (canvas.scene?.grid?.distance ?? 1)",
    );
    expect(rollService).toContain("defenseStrategy: grenadeTarget");
    expect(rollService).toContain(
      ': noDodgeTarget\n                    ? "fixed-range"',
    );
    expect(chatCard).toContain("weaponAttackContext.defenseSourcePage");
    expect(chatCard).toContain("weaponAttackContext.targetDodging");
    expect(characterSheet).toContain("secondEditionDodgeDefense");
    expect(combatTemplate).toContain("combat.secondEditionDodgeDefense");
    expect(combatTemplate).toContain("D6E2.Combat.NoDodgeDefenseHelp");
  });

  it("uses the persisted Flying basis for both displayed and targeted Dodge", () => {
    expect(characterSheet).toContain("resolveSecondEditionDodgeDefense");
    expect(characterSheet).toContain('defenses.dodgeBasis === "flying"');
    expect(combatTemplate).toContain('name="system.defenses.dodgeBasis"');
    expect(combatTemplate).toContain("D6E2.Combat.FlyingDieCode");
    expect(rollService).toContain("secondEditionDodgeDefense");
    expect(rollService).toContain('defenses.dodgeBasis === "flying"');
  });

  it("preserves crew Gunnery, machine, bonus, and shortfall as chat audit data", () => {
    expect(rollService).toContain("secondEditionMachineWeaponAttackPlan");
    expect(rollService).toContain("machineCrew:");
    expect(chatCard).toContain("hasMachineCrewContext");
    expect(chatCard).toContain("machineCrewContext.crewName");
    expect(chatCard).toContain("machineCrewContext.machineName");
    expect(chatCard).toContain("machineCrewContext.missingCrewCount");
  });

  it("offers a resistance roll that is independent of action penalties", () => {
    expect(characterSheet).toContain("actorResistancePlan(this.actor)");
    expect(characterSheet).toContain("roll.resistance(this.actor)");
    expect(combatTemplate).toContain('data-action="rollResistance"');
    expect(combatTemplate).toContain("combat.resistance.scoreLabel");
    expect(rollService).toContain(
      '["attribute", "skill", "weapon-attack"].includes',
    );
    expect(rollService).toContain('kind !== "resistance"');
    expect(rollService).toContain(
      'kind === "resistance" || targetContext?.hasTargets === true',
    );
    expect(chatCard).toContain("hasResistanceContext");
    expect(chatCard).toContain("resistanceContext.armorContributors");
  });

  it("makes the only permitted armor stacking case explicit", () => {
    expect(itemTemplate).toContain("armorStackingOptions");
    expect(itemTemplate).toContain("selected=item.system.stackingTag");
  });

  it("keeps personal damage application GM-controlled and auditable", () => {
    expect(damageResolution).toContain("game.user?.isGM !== true");
    expect(damageResolution).toContain(
      'button.dataset.action = "resolveDamage"',
    );
    expect(damageResolution).toContain("rollResistanceAgainst(");
    expect(damageResolution).toContain("damageResult.total");
    expect(damageResolution).toContain("setActorCondition(");
    expect(damageResolution).toContain("forfeitWoundedCombatantActions(");
    expect(damageResolution).toContain("actionsForfeited");
    expect(damageResolution).toContain("setActorFirstEditionWound(");
    expect(damageResolution).toContain("firstEditionDamageResolution(");
    expect(damageResolution).toContain(
      'resistance?.wildOutcome === "complication"',
    );
    expect(damageResolution).toContain("damageResolutionStatus(");
    expect(damageResolution).toContain("renderAppliedSummary(card, flag)");
    expect(dialog).toContain("targetContext.fixedDifficulty");
    expect(dialog).toContain("targetContext.fixedDifficultyLabel");
    expect(dialog).toContain("hidden");
  });

  it("audits Hyper-lethal resistance caps and Killing Blow survival", () => {
    expect(rollService).toContain("currentSecondEditionHyperLethalProfile");
    expect(rollService).toContain("maximumResistanceScore");
    expect(chatCard).toContain("resistanceContext.maximumScoreLabel");
    expect(chatCard).toContain("resistanceContext.maximumSourcePage");
    expect(combatTemplate).toContain("combat.resistance.maximumClass");
    expect(damageResolution).toContain("promptKillingBlowSurvival");
    expect(damageResolution).toContain("spendActorHeroPoint(target)");
    expect(damageResolution).toContain("killingBlowPrevented");
  });

  it("resolves machine damage against Hull plus protection without personal side effects", () => {
    expect(rollService).toContain("machineResistancePlan(actor)");
    expect(rollService).toContain("secondEditionMachineResistancePlan");
    expect(rollService).toContain("second-edition-machine-conditions");
    expect(damageResolution).toContain("isMachineDamageTarget(target)");
    expect(damageResolution).toContain(
      "const hyperLethal: SecondEditionHyperLethalProfile = machine",
    );
    expect(damageResolution).toContain(
      'strategy: machine\n        ? "second-edition-machine-conditions"',
    );
    expect(damageResolution).toContain(
      "!machine && !applied.prevented && applied.current",
    );
    expect(chatCard).toContain("resistanceContext.baseLabel");
    expect(chatCard).toContain("resistanceContext.protectionLabel");
    expect(rollService).toContain(
      '"D6E2.Combat.ScaleApplication.machineResistance"',
    );
  });

  it("keeps First Edition healing checks visible and locks rules difficulties", () => {
    expect(combatTemplate).toContain("combat.firstEditionHealing");
    expect(combatTemplate).toContain('data-action="resolveNaturalHealing"');
    expect(combatTemplate).toContain('data-action="resolveAssistedHealing"');
    expect(combatTemplate).toContain('data-action="resolveMortalityCheck"');
    expect(characterSheet).toContain("resolveFirstEditionNaturalHealing");
    expect(characterSheet).toContain("resolveFirstEditionAssistedHealing");
    expect(characterSheet).toContain("resolveFirstEditionMortalityCheck");
    expect(combatTemplate).toContain("Mortality.Stabilize");
    expect(chatCard).toContain("hasFirstEditionMortalityContext");
    expect(rollService).toContain("rollFirstEditionAutomatedMortalityCheck");
    expect(dialog).toContain("hasFixedDifficulty");
    expect(dialog).toContain('value="{{fixedDifficulty}}"');
    expect(dialog).toContain('name="difficulty"');
    expect(dialog).toContain("hidden");
    expect(rollService).toContain("ignoreActionEconomy");
  });
});
