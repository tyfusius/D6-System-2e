import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rollService = readFileSync(
  new URL("./roll-service.ts", import.meta.url),
  "utf8",
);
const rollRequests = readFileSync(
  new URL("../roll-requests.ts", import.meta.url),
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
const ordinaryAttackThread = readFileSync(
  new URL("./ordinary-attack-thread.ts", import.meta.url),
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
const firstEditionQueueTemplate = readFileSync(
  new URL(
    "../../../../../templates/actor/character/first-edition-action-queue.hbs",
    import.meta.url,
  ),
  "utf8",
);
const combatService = readFileSync(
  new URL("../combat-service.ts", import.meta.url),
  "utf8",
);
const advancementService = readFileSync(
  new URL("../advancement-service.ts", import.meta.url),
  "utf8",
);
const secondEditionAdvancementService = readFileSync(
  new URL("../second-edition-advancement-service.ts", import.meta.url),
  "utf8",
);
const heroPointSettings = readFileSync(
  new URL("../../settings/hero-points.ts", import.meta.url),
  "utf8",
);
const rollOutcomeSettings = readFileSync(
  new URL("../../settings/roll-outcome.ts", import.meta.url),
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
const styles = readFileSync(
  new URL("../../../../../styles/d6-system-2e.css", import.meta.url),
  "utf8",
);

describe("Second Edition combat UI contracts", () => {
  it("dispatches action economy from one runtime strategy", () => {
    expect(combatService).toContain("currentActionEconomyRuntimeStrategy");
    expect(rollService).toContain("currentActionEconomyRuntimeStrategy");
    expect(characterSheet).toContain("currentActionEconomyRuntimeStrategy");
    expect(combatService).not.toContain(
      "currentEditionCapabilityProfile().actionEconomy",
    );
    expect(rollService).not.toContain("capabilities.actionEconomy.strategy");
    expect(characterSheet).not.toContain(
      "editionCapabilities.actionEconomy.strategy",
    );
  });

  it("dispatches every defense consumer from one runtime strategy", () => {
    expect(combatService).toContain("currentDefenseRuntimeStrategy");
    expect(rollService).toContain("currentDefenseRuntimeStrategy");
    expect(characterSheet).toContain("currentDefenseRuntimeStrategy");
    expect(chatCardActions).toContain("currentDefenseRuntimeStrategy");
    expect(combatService).not.toContain(
      "currentEditionCapabilityProfile().defenses.strategy",
    );
    expect(characterSheet).not.toContain(
      "editionCapabilities.defenses.strategy",
    );
  });

  it("dispatches movement from one runtime strategy", () => {
    expect(combatService).toContain("currentMovementRuntimeStrategy");
    expect(characterSheet).toContain("currentMovementRuntimeStrategy");
    expect(tokenMovementService).toContain("currentMovementRuntimeStrategy");
    expect(tokenMovementService).not.toContain(
      "currentEditionCapabilityProfile().movement.strategy",
    );
    expect(characterSheet).not.toContain(
      "editionCapabilities.movement.strategy",
    );
  });

  it("dispatches every advancement consumer from one runtime strategy", () => {
    expect(advancementService).toContain("currentAdvancementRuntimeStrategy");
    expect(secondEditionAdvancementService).toContain(
      "currentAdvancementRuntimeStrategy",
    );
    expect(characterSheet).toContain("currentAdvancementRuntimeStrategy");
    expect(rollOutcomeSettings).toContain("currentAdvancementRuntimeStrategy");
    expect(heroPointSettings).toContain("currentMetaCurrencyRuntimeStrategy");
    expect(advancementService).not.toContain(
      "currentEditionCapabilityProfile().advancement",
    );
    expect(secondEditionAdvancementService).not.toContain(
      "currentEditionCapabilityProfile().advancement",
    );
    expect(characterSheet).not.toContain("editionCapabilities.advancement");
    expect(heroPointSettings).not.toContain(
      "SECOND_EDITION_OPTION_KEYS.advancementStrategy",
    );
  });

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
    expect(dialog).toContain('data-target-purpose="{{targetContext.purpose}}"');
    expect(dialog).toContain("{{target.optionLabel}}");
    expect(dialog).toContain('data-defense="{{target.defense}}"');
    expect(dialog).toContain('data-range-band="{{target.rangeBand}}"');
    expect(dialog).toContain('data-out-of-range="{{target.outOfRange}}"');
    expect(dialog).toContain('data-hidden="{{target.hidden}}"');
    expect(rollService).toContain("buildWeaponAttackTargetContext");
    expect(rollService).toContain("synchronizeCombatRollTarget(");
    expect(rollService).toContain(
      'targetSelect.dataset.targetPurpose === "attack"',
    );
    expect(rollService).toContain("hasAuthoritativeTargetDifficulty");
    expect(rollService).toContain(
      "difficulty.readOnly = difficultyState.readOnly",
    );
    expect(rollService).toContain("!fixedDifficulty &&");
    expect(rollService).toContain("weaponTargetDifficultyControlState");
    expect(dialog).toContain('data-difficulty-locked="true"');
    expect(dialog).toContain(
      "{{else if targetContext.hasAuthoritativeTargetDifficulty}}",
    );
    expect(rollService).toContain("if (controls.target?.outOfRange)");
    expect(dialog).toContain("data-target-difficulty-input");
    expect(rollService).toContain("TargetOutOfRange");
    expect(rollService).toContain("weaponAttack:");
    expect(rollService).toContain("ordinaryWeaponAttackRollMode(");
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
    expect(rollService).toContain("currentScaleRuntimeStrategy");
    expect(rollService).toContain("scaleRuntimeStrategy");
    expect(rollService).not.toContain("secondEditionScaleInteraction");
    expect(rollService).toContain(
      'buildWeaponAttackTargetContext(actor, item, "damage")',
    );
    expect(rollService).toContain(
      "buildResistanceSourceContext(actor, preferredSource)",
    );
    expect(rollService).toContain("Number(control.value)");
    expect(combatTemplate).toContain("d6e2-scalar-scale-panel");
    expect(combatTemplate).toContain("{{#if combat.scaleScalar}}");
    expect(combatTemplate).toContain('name="system.scaleSide"');
  });

  it("offers the page-32 finish-prone movement choice", () => {
    expect(characterSheet).toContain(
      'movementStrategy.distance === "fixed-mode"',
    );
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
    expect(rollService).toContain("readActorHealth(actor)");
    expect(rollService).toContain(
      "activeHealth.track?.currentState.penaltyScore",
    );
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

  it("adds an optional ordered First Edition queue and segment gate", () => {
    expect(firstEditionQueueTemplate).toContain("data-first-edition-queue");
    expect(firstEditionQueueTemplate).toContain('name="actionSource"');
    expect(firstEditionQueueTemplate).toContain('name="actionLabel"');
    expect(characterSheet).toContain(
      'actionEconomyStrategy.turnScheduling === "round-robin-segments"',
    );
    expect(characterSheet).toContain("firstEditionNextCombatantId");
    expect(combatTemplate).toContain("firstEditionSegmentedActions");
    expect(combatTemplate).toContain("firstEditionActionState.waitingLabels");
  });

  it("preserves target, range, and defense as visible chat audit data", () => {
    expect(chatCard).toContain("hasWeaponAttackContext");
    expect(chatCard).toContain("weaponAttackContext.targetName");
    expect(chatCard).toContain("weaponAttackContext.rangeLabel");
    expect(chatCard).toContain("weaponAttackContext.defense");
    expect(rollService).toContain("targetActorId:");
    expect(rollService).toContain("targetTokenId:");
    expect(rollService).toContain(
      "difficultySelection: controls.difficultySelection",
    );
    expect(rollService).toContain("markTargetDifficultyInput(input)");
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
    expect(dialog).toContain("D6E2.Roll.FinalDifficulty");
    expect(dialog).toContain("data-final-difficulty");
    expect(rollService).toContain('"[data-final-difficulty]"');
    expect(rollService).toContain(
      "finalDifficulty.textContent = Number.isFinite(displayedDifficulty)",
    );
    expect(dialog).toContain(
      'data-defense-strategy="{{target.defenseStrategy}}"',
    );
    expect(dialog).toContain(
      'data-defense-source-page="{{target.defenseSourcePage}}"',
    );
    expect(dialog).toContain('name="targetDodging"');
    expect(dialog).toContain("targetContext.showTargetDodging");
    expect(rollService).toContain(
      'defenseStrategy.targeting === "fixed-range"',
    );
    expect(rollService).toContain("secondEditionNoDodgeDefensePlan");
    expect(rollService).toContain("(canvas.scene?.grid?.distance ?? 1)");
    expect(rollService).toContain("defenseStrategy: firstEditionRangePlan");
    expect(rollService).toContain('? "fixed-range"');
    expect(chatCard).toContain("weaponAttackContext.defenseSourcePage");
    expect(chatCard).toContain("weaponAttackContext.targetDodging");
    expect(characterSheet).toContain("secondEditionDodgeDefense");
    expect(combatTemplate).toContain("combat.secondEditionDodgeDefense");
    expect(combatTemplate).toContain("D6E2.Combat.NoDodgeDefenseHelp");
  });

  it("applies signed manual dice adjustments to the live pool and chat audit", () => {
    expect(dialog).toContain('name="manualDiceAdjustment"');
    expect(dialog).toContain('min="-99"');
    expect(rollService).toContain(
      "baseScore + scaleModifier + manualDiceAdjustment * 3 - mapPenaltyDice * 3",
    );
    expect(rollService).toContain(
      "controls.manualDiceAdjustment * 3 +\n        scaleModifierScore",
    );
    expect(rollService).toContain("baseScore: Math.max(");
    expect(rollService).toContain('input[name="manualDiceAdjustment"]');
    expect(chatCard).toContain("hasManualDiceAdjustment");
    expect(chatCard).toContain("manualDiceAdjustment.label");
  });

  it("shows the combined attack-pool penalty beside the effective final pool", () => {
    expect(dialog).toContain("data-final-pool-penalty");
    expect(dialog).toContain("({{finalPoolPenaltyLabel}})");
    expect(rollService).toContain(
      'showFinalPoolPenalty: targetContext?.purpose === "attack"',
    );
    expect(rollService).toContain(
      "fixedPoolPenaltyScore +\n      mapPenaltyDice * 3 +\n      Math.max(0, -manualDiceAdjustment * 3)",
    );
    expect(rollService).toContain(
      "automaticPenalty -\n      extraordinaryPowerPenalty",
    );
    expect(dialog).toContain('class="od6roll-final-pool-value"');
    const finalPoolValueRule =
      /\.od6roll-preview-stat\s+\.od6roll-final-pool-value\s*\{([^}]*)\}/s.exec(
        styles,
      )?.[1] ?? "";
    expect(finalPoolValueRule).toContain("font-family: inherit;");
    expect(finalPoolValueRule).toContain("font-size: inherit;");
    expect(styles).toContain(".od6roll-final-pool small");
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
    expect(rollService).toContain('kind === "resistance"');
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
    expect(damageResolution).toContain("requestActorResistanceRoll(");
    expect(damageResolution).toContain("appendIntegratedResistanceRoll(");
    expect(damageResolution).toContain("flag.resistanceRoll");
    expect(damageResolution).toContain(
      "D6E2.Combat.Damage.ResistanceEvidenceMissing",
    );
    expect(rollRequests).toContain('kind: "resistance"');
    expect(rollRequests).toContain(
      "activeNonGmOwners(actor)[0] ?? currentUser",
    );
    expect(rollRequests).toContain("rollResistanceAgainst(");
    expect(rollRequests).toContain(
      "requestedResistanceRollPresentation(result, rollArtifacts)",
    );
    expect(rollService).toContain("suppressChatMessage");
    expect(rollRequests).toContain('delivery: "open-roll-window"');
    expect(rollRequests).toContain(
      'visibility: options.visibility ?? "public"',
    );
    expect(damageResolution).toContain("damageResult.total");
    expect(damageResolution).toContain("setActorHealthTrack(");
    expect(damageResolution).toContain("forfeitWoundedCombatantActions(");
    expect(damageResolution).toContain("actionsForfeited");
    expect(damageResolution).toContain("damageActorHealthPool(");
    expect(damageResolution).toContain("firstEditionDamageResolution(");
    expect(damageResolution).toContain(
      'resistance?.wildOutcome === "complication"',
    );
    expect(damageResolution).toContain("damageResolutionStatus(");
    expect(damageResolution).toContain("renderAppliedSummary(card, flag)");
    expect(damageResolution).toContain('className = "od6chat-damage-result"');
    expect(damageResolution).toContain("damageConditionSeverity(");
    expect(damageResolution).toContain("notifyAppliedCondition(");
    expect(damageResolution).toContain("flag.incomingLabel ??");
    expect(damageResolution).toContain(
      "damageOutcomeLabel(flag.strategy, flag.incoming)",
    );
    expect(damageResolution).toContain(
      'prevented: damageConditionLabel(flag.strategy, "stunned")',
    );
    expect(damageResolution).toContain('setAttribute("role", "status")');
    expect(damageResolution).toContain('setAttribute("aria-atomic", "true")');
    expect(damageResolution).toContain('setAttribute("aria-live", "polite")');
    expect(styles).toContain(".od6chat-damage-result-condition");
    expect(styles).toContain(".od6chat-integrated-resistance");
    expect(styles).toContain(".od6chat-damage-resolution.is-fatal");
    expect(dialog).toContain("targetContext.fixedDifficulty");
    expect(dialog).toContain("targetContext.fixedDifficultyLabel");
    expect(dialog).toContain("hidden");
  });

  it("stacks chat audit headings above full-width detail content", () => {
    const auditRule =
      /\.od6chat-combat-audit\s*\{([^}]*)\}/s.exec(styles)?.[1] ?? "";
    const labelRule =
      /\.od6chat-combat-audit\s*>\s*span\s*\{([^}]*)\}/s.exec(styles)?.[1] ??
      "";
    expect(auditRule).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(labelRule).not.toContain("grid-row: 1 / span 2");
  });

  it("continues a successful personal-weapon hit into exact-target damage", () => {
    expect(chatCardActions).toContain("successfulWeaponDamageFollowUp(");
    expect(ordinaryAttackThread).toContain("rollSuccessfulWeaponAttackDamage(");
    expect(ordinaryAttackThread).toContain("claimD6OrdinaryAttackDamage");
    expect(ordinaryAttackThread).toContain("suppressChatMessage: true");
    expect(ordinaryAttackThread).toContain(
      "appendD6InitiatingActionPresentation",
    );
    expect(ordinaryAttackThread).toContain(
      "resolveInitiatingActionDamageTarget",
    );
    expect(rollService).toContain("lockedDamageTargetContext(");
    expect(rollService).toContain(
      "plan.scale.targetActorId !== attack.targetActorId",
    );
    expect(rollService).toContain(
      "plan.scale.targetTokenId !== attack.targetTokenId",
    );
    expect(rollService).toContain("targets: Object.freeze([selectedTarget])");
    expect(rollService).toContain("weaponDamageContinuation:");
    expect(rollService).toContain("d6BoundWeaponDamageAutofire(");
    expect(rollService).toContain("D6E2.Combat.Damage.TargetUnavailable");
    expect(styles).toContain(".od6chat-ordinary-thread");
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

  it("routes authored custom outcomes through their stable result IDs", () => {
    expect(damageResolution).toContain(
      "healthDamageResultForStrategyPredicate",
    );
    expect(damageResolution).toContain("`d6e2.${resolution.incoming}`");
    expect(damageResolution).toContain(
      "resolution.damageTotal - resolution.resistanceTotal",
    );
    expect(damageResolution).toContain(
      "applyActorHealthDamageOutcome(target, authoredIncoming)",
    );
    expect(damageResolution).toContain("incoming: authoredIncoming");
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
      'const strategy: DamageResolutionStrategy = machine\n      ? "second-edition-machine-conditions"',
    );
    expect(damageResolution).toContain("strategy,\n      targetActorId");
    expect(damageResolution).toContain("!machine &&");
    expect(damageResolution).toContain("!customConditionTrack &&");
    expect(damageResolution).toContain("!healthCommand.prevented &&");
    expect(damageResolution).toContain('appliedStateId === "wounded"');
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
