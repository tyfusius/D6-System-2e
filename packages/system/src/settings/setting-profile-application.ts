import type {
  D6SettingAssetV1,
  D6SettingAttributeV2,
  D6SettingProfileV3,
  D6SettingSkillV1,
  D6System2eTerminologyContribution,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { DEFAULT_SKILL_IMAGE } from "../document-default-images";
import {
  ensureSettingProfileDirectory,
  type SettingProfileAssetDiagnostic,
  settingProfileAssetDiagnostics,
  settingProfileDirectory,
} from "../foundry/setting-profile-storage";
import {
  editableCurrentSettingProfile,
  currentSettingActiveAttributes,
  hasCustomSettingProfile,
  resetCurrentSettingProfile,
  saveCurrentSettingProfile,
} from "./setting-profile";

const SettingProfileApplicationBase =
  foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.api.ApplicationV2,
  );

interface MutableSettingProfile {
  attributes: D6SettingAttributeV2[];
  description: string;
  id: string;
  label: string;
  logo: string;
  logoAsWatermark: boolean;
  originRulesFamily?: D6SettingProfileV3["originRulesFamily"];
  skills: D6SettingSkillV1[];
  terminology: D6System2eTerminologyContribution;
  version: D6SettingProfileV3["version"];
  wildDie: {
    one: D6SettingAssetV1;
    oneSound: string;
    six: D6SettingAssetV1;
    sixSound: string;
  };
}

function editableProfile(profile: D6SettingProfileV3): MutableSettingProfile {
  return structuredClone(profile) as MutableSettingProfile;
}

function slug(value: string): string {
  const normalized = value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return /^[a-z]/u.test(normalized)
    ? normalized
    : `skill-${normalized || "new"}`;
}

function documentFromDrop(value: unknown): FoundryItemDocument | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<FoundryItemDocument>;
  return item.type === "skill" && item.system
    ? (value as FoundryItemDocument)
    : null;
}

export class D6System2eSettingProfileApplication extends SettingProfileApplicationBase {
  static override PARTS = {
    form: {
      template: `systems/${SYSTEM_ID}/templates/settings/setting-profile.hbs`,
    },
  };

  #draft = editableProfile(editableCurrentSettingProfile());
  #activeProfileTab = "identity";
  #assetDiagnostics: readonly SettingProfileAssetDiagnostic[] = [];

  readonly #profileTabClickHandler = (event: Event): void => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-profile-tab]",
    );
    const tabId = target?.dataset.profileTab;
    if (tabId) this.#activateProfileTab(tabId, false);
  };

  readonly #profileTabKeydownHandler = (event: KeyboardEvent): void => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-profile-tab]",
    );
    if (!target) return;
    const tabs = Array.from(
      this.element.querySelectorAll<HTMLButtonElement>(
        "button[data-profile-tab]",
      ),
    );
    const index = tabs.indexOf(target);
    if (index < 0) return;
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    const next = tabs[nextIndex];
    if (next?.dataset.profileTab) {
      this.#activateProfileTab(next.dataset.profileTab, true);
    }
  };

  readonly #profileIdInputHandler = (event: Event): void => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.name !== "profile.id") {
      return;
    }
    const output = this.element.querySelector<HTMLOutputElement>(
      "[data-setting-profile-directory]",
    );
    if (output) {
      output.value = settingProfileDirectory(slug(input.value));
      output.title = output.value;
    }
  };

  #activateProfileTab(tabId: string, focus: boolean): void {
    const tabs = Array.from(
      this.element.querySelectorAll<HTMLButtonElement>(
        "button[data-profile-tab]",
      ),
    );
    const selected =
      tabs.find((tab) => tab.dataset.profileTab === tabId) ?? tabs[0];
    const selectedId = selected?.dataset.profileTab;
    if (!selected || !selectedId) return;
    this.#activeProfileTab = selectedId;
    for (const tab of tabs) {
      const active = tab === selected;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    for (const panel of Array.from(
      this.element.querySelectorAll<HTMLElement>("[data-profile-panel]"),
    )) {
      const active = panel.dataset.profilePanel === selectedId;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    }
    if (focus) selected.focus();
  }

  static readonly #addSkill = async function (
    this: D6System2eSettingProfileApplication,
  ): Promise<void> {
    this.#readVisibleForm();
    const attributeId =
      currentSettingActiveAttributes()[0]?.id ??
      this.#draft.attributes[0]?.id ??
      "agility";
    const key = this.#uniqueSkillKey("new-skill");
    this.#draft.skills.push({
      attributeId,
      description: "",
      img: DEFAULT_SKILL_IMAGE,
      key,
      name: game.i18n.localize("D6E2.Settings.SettingProfile.NewSkill"),
      training: "standard",
    });
    await this.render({ force: true });
  };

  static readonly #removeSkill = async function (
    this: D6System2eSettingProfileApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    this.#readVisibleForm();
    const index = Number(target.dataset.skillIndex);
    if (!Number.isInteger(index)) return;
    this.#draft.skills.splice(index, 1);
    await this.render({ force: true });
  };

  static readonly #restoreProfile = async function (
    this: D6System2eSettingProfileApplication,
  ): Promise<void> {
    const confirmed = await foundry.applications.api.DialogV2.wait<boolean>({
      buttons: [
        {
          action: "cancel",
          callback: () => false,
          label: game.i18n.localize("D6E2.Cancel"),
        },
        {
          action: "reset",
          callback: () => true,
          class: "od6roll-submit",
          default: true,
          label: game.i18n.localize("D6E2.Settings.SettingProfile.Reset"),
        },
      ],
      classes: ["d6e2", "od6roll-dialog", "d6e2-confirm-dialog"],
      content: `<div class="od6-dialog-shell"><p>${game.i18n.localize("D6E2.Settings.SettingProfile.ResetConfirm")}</p></div>`,
      modal: true,
      position: { width: 520 },
      rejectClose: false,
      window: {
        title: game.i18n.localize("D6E2.Settings.SettingProfile.Reset"),
      },
    });
    if (!confirmed) return;
    await resetCurrentSettingProfile();
    this.#draft = editableProfile(editableCurrentSettingProfile());
    ui.notifications.info(
      game.i18n.localize("D6E2.Settings.SettingProfile.ResetComplete"),
    );
    await this.render({ force: true });
  };

  static readonly #pickAsset = async function (
    this: D6System2eSettingProfileApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const inputName = target.dataset.inputName ?? "";
    const input = this.element.querySelector<HTMLInputElement>(
      `input[name="${inputName}"]`,
    );
    if (!input) return;
    this.#readVisibleForm();
    let profileDirectory = input.value;
    try {
      profileDirectory = await ensureSettingProfileDirectory(this.#draft.id);
    } catch {
      ui.notifications.warn(
        game.i18n.localize(
          "D6E2.Settings.SettingProfile.DirectoryCreateFailed",
        ),
      );
    }
    const picker = new foundry.applications.apps.FilePicker.implementation({
      callback: (path) => {
        input.value = path;
      },
      current: input.value.startsWith(`${profileDirectory}/`)
        ? input.value
        : profileDirectory,
      document: this,
      type: target.dataset.assetType === "audio" ? "audio" : "image",
    });
    await picker.browse();
  };

  static readonly #submit = async function (
    this: D6System2eSettingProfileApplication,
  ): Promise<void> {
    this.#readVisibleForm();
    this.#assetDiagnostics = await settingProfileAssetDiagnostics(this.#draft);
    if (this.#assetDiagnostics.length > 0) {
      ui.notifications.warn(
        game.i18n.localize(
          "D6E2.Settings.SettingProfile.AssetValidationFailed",
        ),
      );
      await this.render({ force: true });
      return;
    }
    try {
      await ensureSettingProfileDirectory(this.#draft.id);
    } catch {
      ui.notifications.warn(
        game.i18n.localize(
          "D6E2.Settings.SettingProfile.DirectoryCreateFailed",
        ),
      );
    }
    try {
      await saveCurrentSettingProfile(this.#draft);
    } catch {
      ui.notifications.warn(
        game.i18n.localize("D6E2.Settings.SettingProfile.DuplicateId"),
      );
      return;
    }
    ui.notifications.info(
      game.i18n.localize("D6E2.Settings.SettingProfile.Saved"),
    );
    await this.close();
  };

  static override DEFAULT_OPTIONS = {
    actions: {
      addSkill: this.#addSkill,
      pickAsset: this.#pickAsset,
      removeSkill: this.#removeSkill,
      restoreProfile: this.#restoreProfile,
    },
    classes: ["d6e2", "d6e2-setting-profile"],
    form: {
      closeOnSubmit: false,
      handler: this.#submit,
      submitOnChange: false,
    },
    id: "d6e2-setting-profile",
    position: { height: 780, width: 920 },
    tag: "form",
    window: {
      icon: "fa-solid fa-layer-group",
      resizable: true,
      title: "D6E2.Settings.SettingProfile.Title",
    },
  };

  #uniqueSkillKey(base: string): string {
    const used = new Set(this.#draft.skills.map(({ key }) => key));
    let candidate = slug(base);
    let suffix = 2;
    while (used.has(candidate)) candidate = `${slug(base)}-${suffix++}`;
    return candidate;
  }

  #readVisibleForm(): void {
    const form = this.element as HTMLFormElement;
    const value = (name: string): string =>
      form.querySelector<HTMLInputElement | HTMLSelectElement>(
        `[name="${name}"]`,
      )?.value ?? "";
    const checked = (name: string): boolean =>
      form.querySelector<HTMLInputElement>(`[name="${name}"]`)?.checked ===
      true;
    this.#draft.id = slug(value("profile.id"));
    this.#draft.label = value("profile.label").trim();
    this.#draft.description = value("profile.description").trim();
    this.#draft.logo = value("profile.logo").trim();
    this.#draft.logoAsWatermark = checked("profile.logoAsWatermark");
    this.#draft.attributes = this.#draft.attributes.map((attribute, index) => ({
      id: attribute.id,
      label: value(`attribute.${index}.label`).trim() || attribute.label,
    }));
    this.#draft.skills = this.#draft.skills.map((skill, index) => ({
      attributeId: value(`skill.${index}.attributeId`) || skill.attributeId,
      description: value(`skill.${index}.description`).trim(),
      img: value(`skill.${index}.img`).trim() || DEFAULT_SKILL_IMAGE,
      key: slug(value(`skill.${index}.key`) || skill.key),
      name: value(`skill.${index}.name`).trim() || skill.name,
      training: (value(`skill.${index}.training`) ||
        "standard") as D6SettingSkillV1["training"],
    }));
    const face = (prefix: "one" | "six"): D6SettingAssetV1 => ({
      kind: value(`wildDie.${prefix}.kind`) === "image" ? "image" : "text",
      value: value(`wildDie.${prefix}.value`).trim(),
    });
    this.#draft.wildDie = {
      one: face("one"),
      oneSound: value("wildDie.oneSound").trim(),
      six: face("six"),
      sixSound: value("wildDie.sixSound").trim(),
    };
  }

  readonly #dropHandler = async (event: DragEvent): Promise<void> => {
    event.preventDefault();
    const raw = event.dataTransfer?.getData("text/plain") ?? "";
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as { readonly uuid?: unknown };
      const item = documentFromDrop(
        typeof data.uuid === "string" ? await fromUuid(data.uuid) : null,
      );
      if (!item) {
        ui.notifications.warn(
          game.i18n.localize("D6E2.Settings.SettingProfile.DropSkillOnly"),
        );
        return;
      }
      this.#readVisibleForm();
      const rawKey =
        typeof item.system.key === "string" ? item.system.key : item.name;
      const key = this.#uniqueSkillKey(rawKey);
      this.#draft.skills.push({
        attributeId:
          typeof item.system.attributeId === "string"
            ? item.system.attributeId
            : (this.#draft.attributes[0]?.id ?? "agility"),
        description:
          typeof item.system.description === "string"
            ? item.system.description
            : "",
        img: item.img || DEFAULT_SKILL_IMAGE,
        key,
        name: item.name,
        training:
          item.system.training === "advanced" ||
          item.system.training === "psionic"
            ? item.system.training
            : "standard",
      });
      await this.render({ force: true });
    } catch {
      ui.notifications.warn(
        game.i18n.localize("D6E2.Settings.SettingProfile.DropSkillOnly"),
      );
    }
  };

  readonly #queueDrop = (event: DragEvent): void => {
    void this.#dropHandler(event);
  };

  override async _onRender(
    context: Record<string, unknown>,
    options: { readonly parts: readonly string[] },
  ): Promise<void> {
    await super._onRender(context, options);
    this.element.addEventListener("dragover", (event) =>
      event.preventDefault(),
    );
    this.element.removeEventListener("drop", this.#queueDrop);
    this.element.addEventListener("drop", this.#queueDrop);
    this.element.removeEventListener("click", this.#profileTabClickHandler);
    this.element.addEventListener("click", this.#profileTabClickHandler);
    this.element.removeEventListener("keydown", this.#profileTabKeydownHandler);
    this.element.addEventListener("keydown", this.#profileTabKeydownHandler);
    this.element.removeEventListener("input", this.#profileIdInputHandler);
    this.element.addEventListener("input", this.#profileIdInputHandler);
    this.#activateProfileTab(this.#activeProfileTab, false);
  }

  override async _prepareContext(): Promise<Record<string, unknown>> {
    const diagnostics =
      this.#assetDiagnostics.length > 0
        ? this.#assetDiagnostics
        : await settingProfileAssetDiagnostics(this.#draft);
    const activeAttributeIds = new Set(
      currentSettingActiveAttributes().map(({ id }) => id),
    );
    const activeAttributeCount = this.#draft.attributes.filter(({ id }) =>
      activeAttributeIds.has(id),
    ).length;
    const format = (key: string, data: Record<string, unknown>): string =>
      game.i18n.format(key, data);
    return {
      assetDiagnostics: diagnostics.map((diagnostic) => ({
        ...diagnostic,
        message: game.i18n.format(
          diagnostic.code === "invalid-path"
            ? "D6E2.Settings.SettingProfile.AssetInvalidPath"
            : "D6E2.Settings.SettingProfile.AssetMissing",
          { field: diagnostic.field, path: diagnostic.path },
        ),
      })),
      attributes: this.#draft.attributes.map((attribute, index) => ({
        ...attribute,
        activeFromRules: activeAttributeIds.has(attribute.id),
        index,
      })),
      custom: hasCustomSettingProfile(),
      profile: this.#draft,
      settingDirectory: settingProfileDirectory(this.#draft.id),
      tabMeta: {
        attributes: format("D6E2.Settings.SettingProfile.TabMeta.Attributes", {
          active: activeAttributeCount,
          total: this.#draft.attributes.length,
        }),
        identity: game.i18n.localize(
          "D6E2.Settings.SettingProfile.TabMeta.Identity",
        ),
        skills: format("D6E2.Settings.SettingProfile.TabMeta.Skills", {
          count: this.#draft.skills.length,
        }),
        wildDie: game.i18n.localize(
          "D6E2.Settings.SettingProfile.TabMeta.WildDie",
        ),
      },
      skills: this.#draft.skills.map((skill, index) => ({
        ...skill,
        attributeChoices: this.#draft.attributes.map((attribute) => ({
          ...attribute,
          selected: attribute.id === skill.attributeId,
        })),
        advanced: skill.training === "advanced",
        displayIndex: index + 1,
        index,
        psionic: skill.training === "psionic",
        standard: skill.training === "standard",
      })),
      wildFaces: (["one", "six"] as const).map((id) => ({
        dieValue: id === "one" ? "1" : "6",
        id,
        image: this.#draft.wildDie[id].kind === "image",
        label: game.i18n.localize(
          id === "one"
            ? "D6E2.Settings.SettingProfile.FaceOne"
            : "D6E2.Settings.SettingProfile.FaceSix",
        ),
        sound: this.#draft.wildDie[`${id}Sound`],
        text: this.#draft.wildDie[id].kind === "text",
        value: this.#draft.wildDie[id].value,
      })),
    };
  }
}
