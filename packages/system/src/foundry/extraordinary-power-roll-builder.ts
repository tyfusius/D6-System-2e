import {
  D6_EXTRAORDINARY_POWER_ROLL_PLAN_CONTRACT_VERSION,
  type D6ExtraordinaryPowerRollPlanResultV1,
  type D6RollMode,
  formatPipScore,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { resolvedExtraordinaryPowerFramework } from "../registries/extraordinary-powers";
import { currentConfiguredRulesProfile } from "../settings/rules-profile-library";
import { currentDefaultRollMode } from "../settings/setting-values";
import {
  executeExtraordinaryPowerRollPlan,
  retryExtraordinaryPowerRollSummary,
  type ExtraordinaryPowerRollProgress,
} from "./extraordinary-power-service";
import { bindDifficultySuggestionComboboxes } from "./rolls/difficulty-combobox";

const ApplicationV2 = foundry.applications.api.ApplicationV2;
const BuilderApplication =
  foundry.applications.api.HandlebarsApplicationMixin(ApplicationV2);

type BuilderPhase =
  "complete" | "compose" | "executing" | "interrupted" | "review";

interface BuilderRow {
  readonly difficulty: string;
  readonly id: string;
  readonly roleId: string;
}

interface BuilderRowError {
  readonly field: "builder" | "difficulty" | "role";
  readonly id: string;
  readonly key: string;
}

let rowSequence = 0;

function nextRowId(): string {
  rowSequence += 1;
  return `force-step-${rowSequence}`;
}

function actorDocument(value: object): FoundryActorDocument {
  const actor = value as Partial<FoundryActorDocument>;
  if (
    typeof actor.id !== "string" ||
    typeof actor.items !== "object" ||
    typeof actor.system !== "object"
  ) {
    throw new TypeError(
      "Extraordinary-power roll builders require a Foundry Actor document.",
    );
  }
  return actor as FoundryActorDocument;
}

export function extraordinaryPowerRollBuilderInitialRows(
  frameworkId: string,
  powerId?: string,
): readonly BuilderRow[] {
  const framework = resolvedExtraordinaryPowerFramework(frameworkId);
  if (!framework) {
    throw new RangeError(
      `Unknown extraordinary-power framework ${frameworkId}.`,
    );
  }
  const power = powerId
    ? framework.powers.find(({ id }) => id === powerId)
    : undefined;
  if (powerId && !power) {
    throw new RangeError(`Unknown extraordinary power ${powerId}.`);
  }
  return Object.freeze(
    (power?.checks ?? []).map((check) =>
      Object.freeze({
        difficulty: String(check.difficulty),
        id: nextRowId(),
        roleId: check.skillRoleId,
      }),
    ),
  );
}

function rollModeLabel(mode: D6RollMode): string {
  const suffix =
    mode === "gmroll"
      ? "Gm"
      : mode === "blindroll"
        ? "Blind"
        : mode === "selfroll"
          ? "Self"
          : "Public";
  return game.i18n.localize(`D6E2.Roll.Mode.${suffix}`);
}

function resultCanBeDisclosed(mode: D6RollMode): boolean {
  return mode !== "blindroll" || game.user?.isGM === true;
}

class D6ExtraordinaryPowerRollBuilder extends BuilderApplication {
  static override PARTS = {
    content: {
      template: `systems/${SYSTEM_ID}/templates/apps/extraordinary-power-roll-builder.hbs`,
    },
  };

  static override DEFAULT_OPTIONS = {
    classes: ["d6-system-2e", "d6e2-force-roll-builder"],
    id: "d6e2-force-roll-builder",
    position: { height: "auto", width: 820 },
    window: {
      icon: "fa-solid fa-sparkles",
      resizable: true,
      title: "D6E2.ExtraordinaryPower.RollBuilderTitle",
    },
  };

  readonly #actor: FoundryActorDocument;
  readonly #frameworkId: string;
  readonly #powerId: string | undefined;
  #errors: BuilderRowError[] = [];
  #phase: BuilderPhase = "compose";
  #progress: ExtraordinaryPowerRollProgress | undefined;
  #result: D6ExtraordinaryPowerRollPlanResultV1 | undefined;
  #rows: BuilderRow[];
  #summaryFailed = false;
  #summaryRetrying = false;
  #submitting = false;

  constructor(actorValue: object, frameworkId: string, powerId?: string) {
    super();
    this.#actor = actorDocument(actorValue);
    this.#frameworkId = frameworkId;
    this.#powerId = powerId;
    this.#rows = [
      ...extraordinaryPowerRollBuilderInitialRows(frameworkId, powerId),
    ];
  }

  readonly #clickHandler = (event: Event): void => {
    const target = event.target;
    if (target instanceof HTMLElement) void this.#handleClick(target);
  };

  readonly #inputHandler = (event: Event): void => {
    const target = event.target;
    if (
      !(target instanceof HTMLInputElement) &&
      !(target instanceof HTMLSelectElement)
    )
      return;
    const stepId = target.closest<HTMLElement>("[data-force-roll-step]")
      ?.dataset.stepId;
    const field = target.matches("[data-step-role]") ? "role" : "difficulty";
    this.#errors = this.#errors.filter(
      (error) => error.id !== stepId || error.field !== field,
    );
    target.removeAttribute("aria-invalid");
  };

  #captureRows(): void {
    this.#rows = Array.from(
      this.element.querySelectorAll<HTMLElement>("[data-force-roll-step]"),
    ).map((element) => ({
      difficulty:
        element.querySelector<HTMLInputElement>("[data-step-difficulty]")
          ?.value ?? "",
      id: element.dataset.stepId ?? nextRowId(),
      roleId:
        element.querySelector<HTMLSelectElement>("[data-step-role]")?.value ??
        "",
    }));
  }

  #validateRows(): readonly BuilderRowError[] {
    const framework = resolvedExtraordinaryPowerFramework(this.#frameworkId);
    const state = game.system.api?.extraordinaryPowers.read(
      this.#actor,
      this.#frameworkId,
    );
    if (this.#actor.isOwner !== true) {
      return [
        {
          field: "builder",
          id: "builder",
          key: "D6E2.ExtraordinaryPower.OwnerRequired",
        },
      ];
    }
    if (!framework || !state || this.#rows.length === 0) {
      return [
        {
          field: "builder",
          id: "builder",
          key: "D6E2.ExtraordinaryPower.RollPlanEmpty",
        },
      ];
    }
    const seen = new Set<string>();
    const errors: BuilderRowError[] = [];
    for (const row of this.#rows) {
      const role = framework.skillRoles.find(({ id }) => id === row.roleId);
      const binding = state.skillBindings.find(
        ({ roleId }) => roleId === row.roleId,
      );
      if (!role || seen.has(row.roleId) || binding?.available !== true) {
        errors.push({
          field: "role",
          id: row.id,
          key:
            binding?.available === false
              ? "D6E2.ExtraordinaryPower.BindingsRequired"
              : "D6E2.ExtraordinaryPower.RollPlanRoleInvalid",
        });
      }
      seen.add(row.roleId);
      const difficulty = Number(row.difficulty);
      if (
        !row.difficulty.trim() ||
        !Number.isSafeInteger(difficulty) ||
        difficulty < 0
      ) {
        errors.push({
          field: "difficulty",
          id: row.id,
          key: "D6E2.ExtraordinaryPower.RollPlanDifficultyInvalid",
        });
      }
    }
    const power = this.#powerId
      ? state.powers.find(({ id }) => id === this.#powerId)
      : undefined;
    if (this.#powerId && power?.available !== true) {
      errors.push({
        field: "builder",
        id: "builder",
        key: "D6E2.ExtraordinaryPower.BindingsRequired",
      });
    }
    return errors;
  }

  override _prepareContext(): Promise<Record<string, unknown>> {
    const framework = resolvedExtraordinaryPowerFramework(this.#frameworkId);
    if (!framework) {
      throw new RangeError(
        `Unknown extraordinary-power framework ${this.#frameworkId}.`,
      );
    }
    const state = game.system.api?.extraordinaryPowers.read(
      this.#actor,
      framework.id,
    );
    const power = this.#powerId
      ? framework.powers.find(({ id }) => id === this.#powerId)
      : undefined;
    const statePower = this.#powerId
      ? state?.powers.find(({ id }) => id === this.#powerId)
      : undefined;
    const difficultySuggestions =
      currentConfiguredRulesProfile().difficultyLadder;
    const selectedRoleIds = new Set(this.#rows.map(({ roleId }) => roleId));
    const rows = this.#rows.map((row, index) => {
      const role = framework.skillRoles.find(({ id }) => id === row.roleId);
      const binding = state?.skillBindings.find(
        ({ roleId }) => roleId === row.roleId,
      );
      const roleError = this.#errors.find(
        (error) => error.id === row.id && error.field === "role",
      );
      const difficultyError = this.#errors.find(
        (error) => error.id === row.id && error.field === "difficulty",
      );
      const roll =
        this.#result?.rolls[index] ?? this.#progress?.completedRolls[index];
      const disclosed = roll
        ? resultCanBeDisclosed(roll.request.rollMode)
        : false;
      const status = roll
        ? disclosed
          ? roll.success === true
            ? "succeeded"
            : "failed"
          : "hidden"
        : this.#progress?.activeIndex === index &&
            this.#progress.status === "interrupted"
          ? "interrupted"
          : this.#progress?.activeIndex === index && this.#phase === "executing"
            ? "rolling"
            : "pending";
      return {
        ...row,
        canMoveDown: this.#phase === "compose" && index < this.#rows.length - 1,
        canMoveUp: this.#phase === "compose" && index > 0,
        difficultyEditable: this.#phase === "compose",
        difficultyError: difficultyError
          ? game.i18n.localize(difficultyError.key)
          : undefined,
        difficultyErrorId: `${row.id}-error`,
        difficultyHelpId: `${row.id}-difficulty-help`,
        difficultyInputId: `${row.id}-difficulty`,
        difficultyLabelId: `${row.id}-difficulty-label`,
        difficultyListId: `${row.id}-difficulty-listbox`,
        difficultySource: power ? "power-definition" : "custom",
        difficultySuggestions: difficultySuggestions.map((entry) => ({
          ...entry,
          optionId: `${row.id}-difficulty-option-${entry.id}`,
          selected: String(entry.value) === row.difficulty,
        })),
        displayIndex: index + 1,
        hasDifficultyError: difficultyError !== undefined,
        hasRoleError: roleError !== undefined,
        hasDisclosedResult: disclosed && roll !== undefined,
        resultDifficulty: disclosed ? roll?.request.difficulty : undefined,
        resultStatusLabel: game.i18n.localize(
          `D6E2.ExtraordinaryPower.StepStatus.${status}`,
        ),
        resultTotal: disclosed ? roll?.total : undefined,
        roleLabel: role?.label ?? row.roleId,
        difficultyToggleLabel: game.i18n.format(
          "D6E2.ExtraordinaryPower.DifficultySuggestionsFor",
          { skill: role?.label ?? row.roleId },
        ),
        roleError: roleError ? game.i18n.localize(roleError.key) : undefined,
        roleErrorId: `${row.id}-role-error`,
        roles: framework.skillRoles.map((candidate) => ({
          available:
            state?.skillBindings.find(({ roleId }) => roleId === candidate.id)
              ?.available === true,
          disabled:
            selectedRoleIds.has(candidate.id) && candidate.id !== row.roleId,
          id: candidate.id,
          label: candidate.label,
          selected: candidate.id === row.roleId,
          selectedAttribute: candidate.id === row.roleId ? "selected" : "",
        })),
        score:
          binding?.available === true
            ? formatPipScore(binding.score)
            : undefined,
        skillItemId: binding?.available === true ? binding.itemId : undefined,
        stableRoleId: role?.id,
        stableStepId: row.id,
        status,
      };
    });
    const disclosedRolls =
      this.#result?.rolls.filter(({ request }) =>
        resultCanBeDisclosed(request.rollMode),
      ) ?? [];
    const resultHidden =
      disclosedRolls.length !== (this.#result?.rolls.length ?? 0);
    const successCount = disclosedRolls.filter(
      ({ success }) => success === true,
    ).length;
    const builderError = this.#errors.find(({ id }) => id === "builder");
    const rollMode = currentDefaultRollMode();
    return Promise.resolve({
      actorLabel: this.#actor.name,
      blockingReasons: this.#errors.map(({ key }) => game.i18n.localize(key)),
      builderError: builderError
        ? game.i18n.localize(builderError.key)
        : undefined,
      canAdd:
        this.#phase === "compose" &&
        this.#rows.length < framework.skillRoles.length,
      canCompose: this.#phase !== "executing",
      canExecute: this.#phase === "review",
      canReview: this.#phase === "compose",
      capabilities: {
        canAddCheck:
          this.#phase === "compose" &&
          this.#rows.length < framework.skillRoles.length,
        canEdit: this.#phase === "compose" && this.#actor.isOwner === true,
        canExecute: this.#phase === "review" && this.#actor.isOwner === true,
        canReorder: this.#phase === "compose" && this.#actor.isOwner === true,
      },
      difficultySuggestions,
      frameworkLabel: framework.label,
      hasBlockingReasons: this.#errors.length > 0,
      hasResult: this.#result !== undefined,
      isComplete: this.#phase === "complete" || this.#phase === "interrupted",
      isSettling: this.#submitting,
      isCompose: this.#phase === "compose",
      isExecuting: this.#phase === "executing",
      isReview: this.#phase === "review",
      hasSummaryFailure: this.#summaryFailed,
      isSummaryRetrying: this.#summaryRetrying,
      outcomeClass:
        !resultHidden && this.#result?.overallSuccess
          ? "has-succeeded"
          : "has-failed",
      outcomeLabel: resultHidden
        ? game.i18n.localize("D6E2.ExtraordinaryPower.RollPlanHidden")
        : this.#result?.status === "cancelled"
          ? game.i18n.localize("D6E2.ExtraordinaryPower.RollPlanCancelled")
          : this.#result?.overallSuccess
            ? game.i18n.localize("D6E2.ExtraordinaryPower.RollPlanSucceeded")
            : game.i18n.localize("D6E2.ExtraordinaryPower.RollPlanFailed"),
      phase: this.#phase,
      phaseLabel: game.i18n.localize(
        `D6E2.ExtraordinaryPower.BuilderPhase.${this.#phase}`,
      ),
      progressLabel:
        this.#phase === "executing"
          ? this.#progress?.status === "finalizing"
            ? game.i18n.format("D6E2.ExtraordinaryPower.Finalizing", {
                count: this.#progress.completedRolls.length,
                total: this.#rows.length,
              })
            : game.i18n.format("D6E2.ExtraordinaryPower.Progress", {
                current: Math.min(
                  (this.#progress?.activeIndex ?? 0) + 1,
                  this.#rows.length,
                ),
                total: this.#rows.length,
              })
          : undefined,
      powerLabel:
        power?.label ??
        game.i18n.localize("D6E2.ExtraordinaryPower.CustomRollPlan"),
      resultCountLabel: resultHidden
        ? undefined
        : game.i18n.format("D6E2.ExtraordinaryPower.ResultCount", {
            count: successCount,
            total: this.#rows.length,
          }),
      rollModeLabel: rollModeLabel(rollMode),
      permissions: {
        isGm: game.user?.isGM === true,
        isOwner: this.#actor.isOwner === true,
      },
      showSetupRecovery:
        builderError !== undefined ||
        (this.#powerId !== undefined && statePower?.available !== true) ||
        state?.skillBindings.some(({ available }) => !available) === true,
      rows,
      sharedPenalty: Math.max(0, this.#rows.length - 1),
    });
  }

  override async _onRender(
    context: Record<string, unknown>,
    options: { readonly parts: readonly string[] },
  ): Promise<void> {
    await super._onRender(context, options);
    this.element.removeEventListener("click", this.#clickHandler);
    this.element.addEventListener("click", this.#clickHandler);
    this.element.removeEventListener("input", this.#inputHandler);
    this.element.addEventListener("input", this.#inputHandler);
    this.element.removeEventListener("change", this.#inputHandler);
    this.element.addEventListener("change", this.#inputHandler);
    bindDifficultySuggestionComboboxes(this.element, (input) => {
      const stepId = input.closest<HTMLElement>("[data-force-roll-step]")
        ?.dataset.stepId;
      this.#errors = this.#errors.filter(
        (error) => error.id !== stepId || error.field !== "difficulty",
      );
      input.removeAttribute("aria-invalid");
    });
    if (this.#errors.length > 0) {
      const invalid = this.element.querySelector<HTMLElement>(
        '[aria-invalid="true"]',
      );
      (
        invalid ?? this.element.querySelector<HTMLElement>('[role="alert"]')
      )?.focus();
    }
  }

  async #execute(): Promise<void> {
    const steps = this.#rows.map((entry) => ({
      difficulty: Number(entry.difficulty),
      skillRoleId: entry.roleId,
    }));
    if (this.#submitting) return;
    this.#submitting = true;
    this.#summaryFailed = false;
    this.#phase = "executing";
    this.#progress = {
      activeIndex: 0,
      checkCount: steps.length,
      completedRolls: [],
      status: "rolling",
    };
    this.render();
    try {
      this.#result = await executeExtraordinaryPowerRollPlan(
        this.#actor,
        {
          contractVersion: D6_EXTRAORDINARY_POWER_ROLL_PLAN_CONTRACT_VERSION,
          frameworkId: this.#frameworkId,
          label:
            resolvedExtraordinaryPowerFramework(this.#frameworkId)?.powers.find(
              ({ id }) => id === this.#powerId,
            )?.label ??
            game.i18n.localize("D6E2.ExtraordinaryPower.CustomRollPlan"),
          ...(this.#powerId ? { powerId: this.#powerId } : {}),
          steps,
        },
        {
          onProgress: (progress) => {
            this.#progress = progress;
            if (progress.status === "interrupted") {
              this.#phase = "interrupted";
            }
            this.render();
          },
          onPresentationFailure: ({ kind }) => {
            if (kind === "summary") this.#summaryFailed = true;
          },
        },
      );
      this.#phase =
        this.#result.status === "cancelled" ? "interrupted" : "complete";
      this.render();
    } finally {
      this.#submitting = false;
    }
  }

  async #handleClick(target: HTMLElement): Promise<void> {
    const control = target.closest<HTMLElement>("[data-action]");
    if (!control || this.#submitting || this.#phase === "executing") return;
    if (this.#phase === "compose") this.#captureRows();
    const action = control.dataset.action;
    const row = control.closest<HTMLElement>("[data-force-roll-step]");
    const rowIndex = this.#rows.findIndex(
      ({ id }) => id === row?.dataset.stepId,
    );
    if (
      action === "toggleDifficultySuggestions" ||
      action === "chooseDifficulty"
    )
      return;
    if (action === "retrySummary") {
      if (!this.#result || !this.#summaryFailed || this.#summaryRetrying)
        return;
      this.#summaryRetrying = true;
      this.render();
      try {
        await retryExtraordinaryPowerRollSummary(this.#result);
        this.#summaryFailed = false;
      } catch {
        this.#summaryFailed = true;
      } finally {
        this.#summaryRetrying = false;
        this.render();
      }
      return;
    }
    if (action === "resolveSetup") {
      await this.close();
      const sheet = this.#actor.sheet as FoundryDocumentSheet & {
        showExtraordinaryPowerSkills?: () => void;
      };
      if (typeof sheet.showExtraordinaryPowerSkills === "function") {
        sheet.showExtraordinaryPowerSkills();
      } else {
        sheet.render(true);
      }
      return;
    }
    if (action === "addStep") {
      const framework = resolvedExtraordinaryPowerFramework(this.#frameworkId);
      const used = new Set(this.#rows.map(({ roleId }) => roleId));
      const roleId = framework?.skillRoles.find(({ id }) => !used.has(id))?.id;
      if (roleId) this.#rows.push({ difficulty: "", id: nextRowId(), roleId });
      this.#errors = [];
      this.render();
      return;
    }
    if (action === "removeStep" && rowIndex >= 0) {
      this.#rows.splice(rowIndex, 1);
      this.#errors = [];
      this.render();
      return;
    }
    if (action === "moveStepUp" && rowIndex > 0) {
      const current = this.#rows[rowIndex];
      const previous = this.#rows[rowIndex - 1];
      if (current && previous)
        this.#rows.splice(rowIndex - 1, 2, current, previous);
      this.render();
      return;
    }
    if (
      action === "moveStepDown" &&
      rowIndex >= 0 &&
      rowIndex < this.#rows.length - 1
    ) {
      const current = this.#rows[rowIndex];
      const next = this.#rows[rowIndex + 1];
      if (current && next) this.#rows.splice(rowIndex, 2, next, current);
      this.render();
      return;
    }
    if (action === "backToCompose") {
      if (this.#summaryFailed) return;
      this.#phase = "compose";
      this.#result = undefined;
      this.#progress = undefined;
      this.render();
      return;
    }
    if (action === "reviewPlan") {
      this.#errors = [...this.#validateRows()];
      if (this.#errors.length === 0) this.#phase = "review";
      this.render();
      return;
    }
    if (action !== "executePlan" || this.#phase !== "review") return;
    this.#errors = [...this.#validateRows()];
    if (this.#errors.length > 0) {
      this.#phase = "compose";
      this.render();
      return;
    }
    try {
      await this.#execute();
    } catch (error) {
      this.#phase = "compose";
      const key = error instanceof Error ? error.message : String(error);
      this.#errors = [
        {
          field: "builder",
          id: "builder",
          key: key.startsWith("D6E2.")
            ? key
            : "D6E2.ExtraordinaryPower.RollPlanInvalid",
        },
      ];
      this.render();
    }
  }
}

export function openExtraordinaryPowerRollBuilder(
  actor: object,
  frameworkId: string,
  powerId?: string,
): void {
  new D6ExtraordinaryPowerRollBuilder(actor, frameworkId, powerId).render({
    force: true,
  });
}
