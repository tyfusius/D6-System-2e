import type { D6RulesProfileV1, D6RulesStrategySlot } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import {
  bundledRulesStrategyChoices,
  currentConfiguredRulesProfile,
  rulesProfileDiagnostics,
  saveNewWorldRulesProfile,
  saveWorldRulesProfile,
  selectRulesProfile,
} from "./rules-profile-library";
import {
  availableHealthModels,
  healthModelForStrategy,
} from "./health-model-library";

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
  -readonly [K in keyof D6RulesProfileV1]: D6RulesProfileV1[K];
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
    profile: D6RulesProfileV1,
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
    if (id) this.#activateTab(id);
  };

  #activateTab(id: string): void {
    this.#activeTab = id;
    for (const tab of Array.from(
      this.element.querySelectorAll<HTMLButtonElement>(
        "[data-rules-profile-tab]",
      ),
    )) {
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
  }

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
    if (rulesProfileDiagnostics(this.#draft).length > 0) {
      this.#activeTab = "mechanics";
      ui.notifications.warn(
        game.i18n.localize("D6E2.Settings.RulesProfile.DiagnosticsBlocked"),
      );
      await this.render({ force: true });
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
    classes: ["d6e2", "d6e2-rules-profile"],
    form: {
      closeOnSubmit: false,
      handler: this.#submit,
      submitOnChange: false,
    },
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
    this.#activateTab(this.#activeTab);
  }

  override _prepareContext(): Promise<Record<string, unknown>> {
    const localized = (key: string): string => game.i18n.localize(key);
    return Promise.resolve({
      canEditProfileId: this.#isNew,
      diagnostics: rulesProfileDiagnostics(this.#draft).map((diagnostic) => ({
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
        const selectedHealthModel = healthModelForStrategy(selected)?.id;
        const healthOptions = availableHealthModels().map((model) => ({
          label: localized(model.label),
          selected: selectedHealthModel === model.id,
          value: model.id,
        }));
        return {
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
        };
      }),
      profile: this.#draft,
    });
  }
}
