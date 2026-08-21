import type { D6RulesProfileV3, D6RulesStrategySlot } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import {
  bundledRulesStrategyChoices,
  currentConfiguredRulesProfile,
  rulesProfileDiagnostics,
  saveNewWorldRulesProfile,
  saveWorldRulesProfile,
  selectRulesProfile,
} from "./rules-profile-library";
import { availableHealthModelsForProfile } from "./health-model-library";
import { applicationV2FormOptions } from "../foundry/application-v2-form-options";
import { D6System2eHealthModelLibraryApplication } from "./health-model-library-application";

const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);

const SLOT_KEYS: Readonly<Record<D6RulesStrategySlot, string>> = Object.freeze({
  actionEconomy: "ActionEconomy",
  activeDefenses: "ActiveDefenses",
  advancement: "Advancement",
  attributes: "Attributes",
  health: "Health",
  initiative: "Initiative",
  movement: "Movement",
  metaCurrency: "MetaCurrency",
  pips: "Pips",
  retries: "Retries",
  successEvaluator: "SuccessEvaluator",
  wildDie: "WildDie",
});

type MutableProfile = {
  -readonly [K in keyof D6RulesProfileV3]: D6RulesProfileV3[K];
};

export class D6System2eRulesProfileApplication extends Base {
  static override PARTS = {
    form: {
      template: `systems/${SYSTEM_ID}/templates/settings/rules-profile.hbs`,
    },
  };

  #draft = structuredClone(currentConfiguredRulesProfile()) as MutableProfile;
  #activeTab = "identity";
  #isNew = false;

  withDraft(
    profile: D6RulesProfileV3,
    options: { readonly isNew?: boolean } = {},
  ): this {
    this.#draft = structuredClone(profile);
    this.#isNew = options.isNew === true;
    return this;
  }

  readonly #tabClick = (event: Event): void => {
    const id = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-rules-profile-tab]",
    )?.dataset.rulesProfileTab;
    if (id) this.#activateTab(id, false);
  };

  readonly #tabKeydown = (event: KeyboardEvent): void => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-rules-profile-tab]",
    );
    if (!target) return;
    const tabs = Array.from(
      this.element.querySelectorAll<HTMLButtonElement>(
        "[data-rules-profile-tab]",
      ),
    );
    const index = tabs.indexOf(target);
    const key = event.key;
    const next =
      key === "Home"
        ? 0
        : key === "End"
          ? tabs.length - 1
          : key === "ArrowRight"
            ? (index + 1) % tabs.length
            : key === "ArrowLeft"
              ? (index - 1 + tabs.length) % tabs.length
              : -1;
    if (next < 0) return;
    event.preventDefault();
    const id = tabs[next]?.dataset.rulesProfileTab;
    if (id) this.#activateTab(id, true);
  };

  #activateTab(id: string, focus = false): void {
    this.#activeTab = id;
    const tabs = Array.from(
      this.element.querySelectorAll<HTMLButtonElement>(
        "[data-rules-profile-tab]",
      ),
    );
    for (const tab of tabs) {
      const active = tab.dataset.rulesProfileTab === id;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    for (const panel of Array.from(
      this.element.querySelectorAll<HTMLElement>("[data-rules-profile-panel]"),
    )) {
      const active = panel.dataset.rulesProfilePanel === id;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    }
    if (focus) tabs.find((tab) => tab.dataset.rulesProfileTab === id)?.focus();
  }

  static readonly #manageHealth = function (
    this: D6System2eRulesProfileApplication,
  ): void {
    const selected =
      (this.element as HTMLFormElement).querySelector<HTMLSelectElement>(
        '[name="strategy.health"]',
      )?.value ?? this.#draft.strategies.health;
    this.#draft.strategies = Object.freeze({
      ...this.#draft.strategies,
      health: selected,
    });
    new D6System2eHealthModelLibraryApplication()
      .withProfile(this.#draft, {
        isNewProfile: this.#isNew,
        onChanged: async (healthModels, selectedModelId) => {
          this.#draft.healthModels = Object.freeze(healthModels);
          this.#draft.strategies = Object.freeze({
            ...this.#draft.strategies,
            health: selectedModelId,
          });
          await this.render({ force: true });
        },
      })
      .render(true);
  };

  static readonly #submit = async function (
    this: D6System2eRulesProfileApplication,
  ): Promise<void> {
    const form = this.element as HTMLFormElement;
    const value = (name: string): string =>
      form
        .querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)
        ?.value.trim() ?? "";
    this.#draft.label = value("profile.label");
    this.#draft.description = value("profile.description");
    if (this.#isNew) {
      this.#draft.id = value("profile.id").toLocaleLowerCase();
    }
    this.#draft.strategies = Object.freeze({
      ...this.#draft.strategies,
      ...Object.fromEntries(
        Object.keys(SLOT_KEYS).map((slot) => [slot, value(`strategy.${slot}`)]),
      ),
    });
    const invalid: HTMLInputElement[] = [];
    this.#draft.difficultyLadder = Object.freeze(
      this.#draft.difficultyLadder.map((entry) => {
        const labelInput = form.querySelector<HTMLInputElement>(
          `[name="difficulty.${entry.id}.label"]`,
        );
        const valueInput = form.querySelector<HTMLInputElement>(
          `[name="difficulty.${entry.id}.value"]`,
        );
        const label = labelInput?.value.trim() ?? "";
        const rawValue = valueInput?.value.trim() ?? "";
        const numeric = Number(rawValue);
        for (const input of [labelInput, valueInput]) {
          input?.removeAttribute("aria-invalid");
          input?.removeAttribute("aria-errormessage");
        }
        if (!label && labelInput) invalid.push(labelInput);
        if (!rawValue || !Number.isFinite(numeric)) {
          if (valueInput) invalid.push(valueInput);
        }
        return {
          id: entry.id,
          label: label || entry.label,
          value:
            rawValue && Number.isFinite(numeric)
              ? Math.trunc(numeric)
              : entry.value,
        };
      }),
    );
    if (invalid.length > 0) {
      for (const input of invalid) {
        input.setAttribute("aria-invalid", "true");
        input.setAttribute("aria-errormessage", "d6e2-difficulty-error");
      }
      this.#activateTab("difficulty", false);
      invalid[0]?.focus();
      ui.notifications.warn(
        game.i18n.localize("D6E2.Settings.RulesProfile.DifficultyInvalid"),
      );
      return;
    }
    if (rulesProfileDiagnostics(this.#draft).length > 0) {
      this.#activeTab = "mechanics";
      ui.notifications.warn(
        game.i18n.localize("D6E2.Settings.RulesProfile.DiagnosticsBlocked"),
      );
      await this.render({ force: true });
      this.element.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    try {
      const profile = this.#isNew
        ? await saveNewWorldRulesProfile(this.#draft)
        : await saveWorldRulesProfile(this.#draft);
      await selectRulesProfile(profile.id);
      ui.notifications.info(
        game.i18n.localize("D6E2.Settings.RulesProfile.Saved"),
      );
      await this.close();
    } catch {
      ui.notifications.warn(
        game.i18n.localize("D6E2.Settings.RulesProfile.SaveFailed"),
      );
    }
  };

  static override DEFAULT_OPTIONS = {
    actions: {
      manageHealth: this.#manageHealth,
    },
    classes: ["d6e2", "d6e2-rules-profile"],
    form: applicationV2FormOptions({
      closeOnSubmit: false,
      handler: this.#submit,
      submitOnChange: false,
    }),
    id: "d6e2-rules-profile",
    position: { height: 720, width: 760 },
    tag: "form",
    window: {
      icon: "fa-solid fa-gears",
      resizable: true,
      title: "D6E2.Settings.RulesProfile.Title",
    },
  };

  override async _onRender(
    context: Record<string, unknown>,
    options: { readonly parts: readonly string[] },
  ): Promise<void> {
    await super._onRender(context, options);
    this.element.removeEventListener("click", this.#tabClick);
    this.element.addEventListener("click", this.#tabClick);
    this.element.removeEventListener("keydown", this.#tabKeydown);
    this.element.addEventListener("keydown", this.#tabKeydown);
    this.#activateTab(this.#activeTab);
  }

  override _prepareContext(): Promise<Record<string, unknown>> {
    const localized = (key: string): string => game.i18n.localize(key);
    const diagnostics = rulesProfileDiagnostics(this.#draft);
    return Promise.resolve({
      canEditProfileId: this.#isNew,
      diagnostics: diagnostics.map((diagnostic) => ({
        ...diagnostic,
        message:
          diagnostic.code === "unavailable-strategy"
            ? game.i18n.format(
                "D6E2.Settings.RulesProfile.UnavailableStrategy",
                { strategy: diagnostic.message },
              )
            : diagnostic.message,
      })),
      mechanics: Object.entries(SLOT_KEYS).map(([slot, key]) => {
        const typedSlot = slot as D6RulesStrategySlot;
        const [secondEdition, openD6] = bundledRulesStrategyChoices[typedSlot];
        const selected = this.#draft.strategies[typedSlot];
        const selectedHealthModel = selected;
        const healthOptions = availableHealthModelsForProfile(this.#draft).map(
          (model) => ({
            label: localized(model.label),
            selected: selectedHealthModel === model.id,
            value: model.id,
          }),
        );
        if (
          typedSlot === "health" &&
          !healthOptions.some(({ value }) => value === selectedHealthModel)
        ) {
          healthOptions.unshift({
            label: game.i18n.format(
              "D6E2.Settings.HealthModel.UnavailableSelected",
              { id: selectedHealthModel },
            ),
            selected: true,
            value: selectedHealthModel,
          });
        }
        return {
          health: typedSlot === "health",
          help: localized(`D6E2.Settings.RulesProfile.Mechanic.${key}.Help`),
          label: localized(`D6E2.Settings.RulesProfile.Mechanic.${key}.Label`),
          options:
            typedSlot === "health"
              ? healthOptions
              : [
                  {
                    label: localized("D6E2.Settings.GameMode.SecondEdition"),
                    selected: selected === secondEdition,
                    value: secondEdition,
                  },
                  {
                    label: localized("D6E2.Settings.GameMode.OpenD6"),
                    selected: selected === openD6,
                    value: openD6,
                  },
                ],
          slot,
          invalid: diagnostics.some(
            (diagnostic) => diagnostic.slot === typedSlot,
          ),
        };
      }),
      difficultyLadder: this.#draft.difficultyLadder,
      profile: this.#draft,
    });
  }
}
