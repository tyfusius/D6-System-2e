import { RULES_COMPATIBILITY_KEYS } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import {
  applyRulesCompatibilitySelection,
  COMPATIBILITY_SETTING_KEYS,
  OPEN_D6_MASTER_SETTING,
} from "./rules-compatibility";
import {
  settingsForCategory,
  type SettingCategory,
  type SystemSettingDefinition,
} from "./settings-catalog";

const SettingsApplicationBase =
  foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.api.ApplicationV2,
  );

interface SettingView {
  readonly checked: boolean;
  readonly choices: readonly {
    readonly label: string;
    readonly selected: boolean;
    readonly value: string;
  }[];
  readonly hint: string;
  readonly inputType: "checkbox" | "number" | "text";
  readonly key: string;
  readonly label: string;
  readonly master: boolean;
  readonly max?: number;
  readonly min?: number;
  readonly step?: number;
  readonly value: boolean | number | string;
}

function settingView(definition: SystemSettingDefinition): SettingView {
  const value = game.settings.get(SYSTEM_ID, definition.key) as
    boolean | number | string;
  return {
    checked: value === true,
    choices: Object.entries(definition.choices ?? {}).map(
      ([choiceValue, label]) => ({
        label: game.i18n.localize(label),
        selected: String(value) === choiceValue,
        value: choiceValue,
      }),
    ),
    hint: game.i18n.localize(definition.hint),
    inputType:
      definition.type === "boolean"
        ? "checkbox"
        : definition.type === "number"
          ? "number"
          : "text",
    key: definition.key,
    label: game.i18n.localize(definition.name),
    master: definition.key === OPEN_D6_MASTER_SETTING,
    ...(definition.max === undefined ? {} : { max: definition.max }),
    ...(definition.min === undefined ? {} : { min: definition.min }),
    ...(definition.step === undefined ? {} : { step: definition.step }),
    value,
  };
}

function valueFromForm(
  definition: SystemSettingDefinition,
  object: Record<string, unknown>,
): boolean | number | string {
  const value = object[definition.key];
  if (definition.type === "boolean") return value === true;
  if (definition.type === "number") {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : Number(definition.default);
  }
  return typeof value === "string" ? value : String(definition.default);
}

abstract class D6System2eSettingsApplication extends SettingsApplicationBase {
  static readonly category: Exclude<SettingCategory, "shared">;

  static PARTS = {
    form: {
      template: `systems/${SYSTEM_ID}/templates/settings/edition-settings.hbs`,
    },
  };

  static readonly #togglePreset = function (
    this: D6System2eSettingsApplication,
    _event: Event,
    target: HTMLElement,
  ): void {
    const master = target as HTMLInputElement;
    if (master.type !== "checkbox") return;
    const form = master.closest("form");
    const inputs = form
      ? Array.from(
          form.querySelectorAll<HTMLInputElement>(
            "[data-first-edition-compatibility]",
          ),
        )
      : [];
    for (const input of inputs) {
      input.checked = master.checked;
    }
  };

  static readonly #submit = async function (
    this: D6System2eSettingsApplication,
    _event: SubmitEvent,
    _form: HTMLFormElement,
    formData: FoundryFormData,
  ): Promise<void> {
    const constructor = this
      .constructor as typeof D6System2eSettingsApplication;
    const definitions = settingsForCategory(constructor.category);
    const object = formData.object;

    if (constructor.category === "first-edition") {
      const master = object[OPEN_D6_MASTER_SETTING] === true;
      const selection = Object.fromEntries(
        RULES_COMPATIBILITY_KEYS.map((key) => {
          const settingKey = COMPATIBILITY_SETTING_KEYS[key];
          return [key, master || object[settingKey] === true];
        }),
      ) as unknown as Readonly<
        Record<(typeof RULES_COMPATIBILITY_KEYS)[number], boolean>
      >;
      const result = await applyRulesCompatibilitySelection(selection);
      if (result.failed.length > 0) {
        ui.notifications.warn(game.i18n.localize("D6E2.Settings.SaveFailed"));
        return;
      }
    }

    const compatibilityKeys = new Set<string>([
      OPEN_D6_MASTER_SETTING,
      ...Object.values(COMPATIBILITY_SETTING_KEYS),
    ]);
    for (const definition of definitions) {
      if (compatibilityKeys.has(definition.key)) continue;
      await game.settings.set(
        SYSTEM_ID,
        definition.key,
        valueFromForm(definition, object),
      );
    }
    await this.close();
  };

  static DEFAULT_OPTIONS = {
    actions: {
      togglePreset: this.#togglePreset,
    },
    classes: ["d6e2", "od6s-settings-v2", "d6e2-settings-v2"],
    form: {
      closeOnSubmit: false,
      handler: this.#submit,
      submitOnChange: false,
    },
    position: {
      height: "auto",
      width: 680,
    },
    tag: "form",
    window: {
      icon: "fa-solid fa-sliders",
      resizable: true,
    },
  };

  _prepareContext(): Promise<Record<string, unknown>> {
    const constructor = this
      .constructor as typeof D6System2eSettingsApplication;
    const settings = settingsForCategory(constructor.category).map(settingView);
    const master = settings.find((setting) => setting.master);
    return Promise.resolve({
      category: constructor.category,
      editionOptions: settings.filter(
        (setting) =>
          !setting.master &&
          !Object.values(COMPATIBILITY_SETTING_KEYS).includes(setting.key),
      ),
      hasMaster: master !== undefined,
      master,
      rulesCompatibility: settings.filter((setting) =>
        Object.values(COMPATIBILITY_SETTING_KEYS).includes(setting.key),
      ),
      title:
        constructor.category === "first-edition"
          ? game.i18n.localize("D6E2.Settings.FirstEdition.Menu.Name")
          : game.i18n.localize("D6E2.Settings.SecondEdition.Menu.Name"),
    });
  }
}

export class D6System2eFirstEditionSettings extends D6System2eSettingsApplication {
  static override readonly category = "first-edition" as const;
  static override DEFAULT_OPTIONS = {
    ...D6System2eSettingsApplication.DEFAULT_OPTIONS,
    id: "d6e2-first-edition-settings",
    window: {
      ...D6System2eSettingsApplication.DEFAULT_OPTIONS.window,
      title: "D6E2.Settings.FirstEdition.Menu.Name",
    },
  };
}

export class D6System2eSecondEditionSettings extends D6System2eSettingsApplication {
  static override readonly category = "second-edition" as const;
  static override DEFAULT_OPTIONS = {
    ...D6System2eSettingsApplication.DEFAULT_OPTIONS,
    id: "d6e2-second-edition-settings",
    window: {
      ...D6System2eSettingsApplication.DEFAULT_OPTIONS.window,
      title: "D6E2.Settings.SecondEdition.Menu.Name",
    },
  };
}
