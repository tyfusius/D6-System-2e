import type {
  D6SettingAssetV1,
  D6SettingAttributeV2,
  D6SettingProfileV5,
  D6SettingProfilePaletteV1,
  D6SettingProfileTypographyV1,
  D6SettingSkillV1,
  D6System2eTerminologyContribution,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { themeRegistry } from "../registries/themes";
import { applicationV2FormOptions } from "../foundry/application-v2-form-options";
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
  synchronizedSettingProfileColor,
  validateSettingProfilePalette,
} from "./setting-profile";
import {
  healthTerminologyGroupLabel,
  mergeTerminologyOverrideEntries,
  settingProfileTerminologyFields,
  type TerminologyOverrideFieldDefinition,
  terminologyOverrideValue,
} from "./terminology-overrides";
import {
  availableHealthModelsForProfile,
  currentConfiguredHealthModel,
} from "./health-model-library";
import {
  resolveSettingLogo,
  resolveSettingLogoPresentation,
  resolveSettingProfilePalette,
} from "./presentation-theme";
import { currentConfiguredRulesProfile } from "./rules-profile-library";
import {
  D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY,
  applySettingProfileTypographyReplacement,
  availableSettingProfileFonts,
  loadSettingProfileFontForRole,
  resolveSettingProfileTypography,
  subscribeSettingProfileTypographyEditor,
  validateSettingProfileTypography,
} from "./setting-profile-typography";
import { D6System2eFontLibraryApplication } from "./setting-profile-font-library-application";

const SettingProfileApplicationBase =
  foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.api.ApplicationV2,
  );

interface MutableSettingProfile {
  attributes: D6SettingAttributeV2[];
  description: string;
  healthLabels: Record<
    string,
    { states: Record<string, string>; track: string }
  >;
  id: string;
  label: string;
  logo: string;
  logoAsWatermark: boolean;
  originRulesFamily?: D6SettingProfileV5["originRulesFamily"];
  palette: D6SettingProfilePaletteV1;
  typography: D6SettingProfileTypographyV1;
  skills: D6SettingSkillV1[];
  terminology: D6System2eTerminologyContribution;
  version: D6SettingProfileV5["version"];
  wildDie: {
    one: D6SettingAssetV1;
    oneSound: string;
    six: D6SettingAssetV1;
    sixSound: string;
  };
}

type SettingProfileFormControl =
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

interface SettingProfileFormControlState {
  readonly checked: boolean | undefined;
  readonly name: string;
  readonly occurrence: number;
  readonly value: string;
}

function editableProfile(profile: D6SettingProfileV5): MutableSettingProfile {
  const editable = structuredClone(profile) as unknown as MutableSettingProfile;
  editable.logo = resolveSettingLogo(editable.logo);
  editable.palette = structuredClone(
    profile.palette ??
      resolveSettingProfilePalette(themeRegistry.current(), profile) ?? {
        accent: "#c89b45",
        accentBright: "#f0c96c",
        background: "#0a0d12",
        muted: "#9a968d",
        text: "#eeeae0",
      },
  );
  editable.typography = structuredClone(
    profile.typography ?? D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY,
  );
  return editable;
}

type PaletteField = keyof D6SettingProfilePaletteV1;
const PALETTE_FIELDS = [
  "accent",
  "accentBright",
  "background",
  "text",
  "muted",
] as const satisfies readonly PaletteField[];

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

function humanizeFontReference(ref: string): string {
  const id = ref.split("/").at(-1) ?? ref;
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toLocaleUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function fontProviderLabel(ownerId: string): string {
  const modules = (
    game as typeof game & {
      readonly modules?: ReadonlyMap<string, { readonly title?: string }>;
    }
  ).modules;
  return modules?.get(ownerId)?.title ?? humanizeFontReference(ownerId);
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
  #previewPalette = structuredClone(this.#draft.palette);
  #previewTypography = structuredClone(this.#draft.typography);
  #typographyPreviewGeneration = { body: 0, display: 0 };
  #typographyPreviewAvailable = { body: true, display: true };
  #activeProfileTab = "identity";
  #assetDiagnostics: readonly SettingProfileAssetDiagnostic[] = [];
  #paletteValidation: ReturnType<typeof validateSettingProfilePalette> = {
    valid: true,
  };
  #unsubscribeTypographyEditor: (() => void) | null = null;
  readonly #typographyEditorSubscriber = {
    applySettingProfileTypographyReplacement: (
      removedRef: string,
      replacements: Readonly<
        Partial<Record<keyof D6SettingProfileTypographyV1, string>>
      >,
    ) =>
      this.applySettingProfileTypographyReplacement(removedRef, replacements),
    refreshSettingProfileFontAvailability: () =>
      this.refreshSettingProfileFontAvailability(),
  };

  #captureFormControlState(): readonly SettingProfileFormControlState[] {
    const occurrences = new Map<string, number>();
    return Array.from(
      this.element.querySelectorAll<SettingProfileFormControl>("[name]"),
    ).map((control) => {
      const occurrence = occurrences.get(control.name) ?? 0;
      occurrences.set(control.name, occurrence + 1);
      const checkable =
        control instanceof HTMLInputElement &&
        (control.type === "checkbox" || control.type === "radio");
      return {
        checked: checkable ? control.checked : undefined,
        name: control.name,
        occurrence,
        value: control.value,
      };
    });
  }

  #restoreFormControlState(
    state: readonly SettingProfileFormControlState[],
  ): void {
    for (const entry of state) {
      const control = this.element.querySelectorAll<SettingProfileFormControl>(
        `[name="${CSS.escape(entry.name)}"]`,
      )[entry.occurrence];
      if (!control) continue;
      control.value = entry.value;
      if (entry.checked !== undefined && control instanceof HTMLInputElement) {
        control.checked = entry.checked;
      }
    }
  }

  async refreshSettingProfileFontAvailability(): Promise<void> {
    const controlState = this.#captureFormControlState();
    const activeElement = document.activeElement;
    const focusedAction =
      activeElement instanceof HTMLElement
        ? activeElement.dataset.action
        : undefined;
    const focusedName =
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLSelectElement ||
      activeElement instanceof HTMLTextAreaElement
        ? activeElement.name || undefined
        : undefined;
    const focused =
      activeElement instanceof HTMLElement &&
      this.element.contains(activeElement)
        ? {
            action: focusedAction,
            actionIndex: focusedAction
              ? Array.from(
                  this.element.querySelectorAll<HTMLElement>(
                    `[data-action="${CSS.escape(focusedAction)}"]`,
                  ),
                ).indexOf(activeElement)
              : undefined,
            id: activeElement.id || undefined,
            name: focusedName,
            nameIndex: focusedName
              ? Array.from(
                  this.element.querySelectorAll<SettingProfileFormControl>(
                    `[name="${CSS.escape(focusedName)}"]`,
                  ),
                ).indexOf(activeElement as SettingProfileFormControl)
              : undefined,
            tab: activeElement.dataset.profileTab,
          }
        : undefined;
    const panel = this.element.querySelector<HTMLElement>(
      ".d6e2-setting-profile-panel.is-active",
    );
    const scrollTop = panel?.scrollTop ?? 0;
    await this.render({ force: true });
    this.#restoreFormControlState(controlState);
    const refreshedPanel = this.element.querySelector<HTMLElement>(
      ".d6e2-setting-profile-panel.is-active",
    );
    if (refreshedPanel) refreshedPanel.scrollTop = scrollTop;
    const namedControl = focused?.name
      ? this.element.querySelectorAll<SettingProfileFormControl>(
          `[name="${CSS.escape(focused.name)}"]`,
        )[focused.nameIndex ?? 0]
      : null;
    const control =
      (namedControl instanceof HTMLElement ? namedControl : null) ??
      (focused?.id
        ? this.element.querySelector<HTMLElement>(`#${CSS.escape(focused.id)}`)
        : null) ??
      (focused?.tab
        ? this.element.querySelector<HTMLElement>(
            `[data-profile-tab="${CSS.escape(focused.tab)}"]`,
          )
        : null) ??
      (focused?.action
        ? this.element.querySelectorAll<HTMLElement>(
            `[data-action="${CSS.escape(focused.action)}"]`,
          )[focused.actionIndex ?? 0]
        : null);
    control?.focus({ preventScroll: true });
  }

  applySettingProfileTypographyReplacement(
    removedRef: string,
    replacements: Readonly<
      Partial<Record<keyof D6SettingProfileTypographyV1, string>>
    >,
  ): void {
    const previous = this.#draft.typography;
    const next = applySettingProfileTypographyReplacement(
      previous,
      removedRef,
      replacements,
    );
    const changedRoles = (["display", "body"] as const).filter(
      (role) => previous[role] !== next[role],
    );
    if (changedRoles.length === 0) return;
    this.#draft.typography = next;
    this.#previewTypography = { ...next };
    const fonts = availableSettingProfileFonts();
    for (const role of changedRoles) {
      const replacement = next[role];
      const select = this.element.querySelector<HTMLSelectElement>(
        `select[name="profile.typography.${role}"]`,
      );
      if (select) {
        for (const option of Array.from(select.options)) {
          if (option.value === removedRef) option.remove();
        }
        select.value = replacement;
      }
      const selectedFont = fonts.find(({ ref }) => ref === replacement);
      const status = this.element.querySelector<HTMLElement>(
        `#d6e2-typography-${role}-status`,
      );
      if (status) {
        status.textContent =
          selectedFont?.source === "module"
            ? game.i18n.format(
                "D6E2.Settings.SettingProfile.Typography.ProvidedBy",
                { provider: fontProviderLabel(selectedFont.ownerId) },
              )
            : selectedFont?.source === "world"
              ? game.i18n.localize(
                  "D6E2.Settings.SettingProfile.Typography.LocalFont",
                )
              : game.i18n.localize(
                  "D6E2.Settings.SettingProfile.Typography.BuiltIn",
                );
      }
      void this.#updateTypographyPreview(role, replacement);
    }
  }

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

  readonly #paletteInputHandler = (event: Event): void => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const field = input.dataset.paletteField as PaletteField | undefined;
    const source = input.dataset.paletteSource as "hex" | "picker" | undefined;
    if (!field || !source || !PALETTE_FIELDS.includes(field)) return;
    const synchronized = synchronizedSettingProfileColor(source, input.value);
    if (source === "hex") {
      this.#draft.palette = {
        ...this.#draft.palette,
        [field]: input.value.trim().toLocaleLowerCase(),
      };
    }
    if (synchronized) {
      for (const peer of Array.from(
        this.element.querySelectorAll<HTMLInputElement>(
          `[data-palette-field="${field}"]`,
        ),
      )) {
        if (peer !== input) peer.value = synchronized;
      }
      this.#draft.palette = { ...this.#draft.palette, [field]: synchronized };
      this.#previewPalette = { ...this.#previewPalette, [field]: synchronized };
      this.element
        .querySelector<HTMLElement>("[data-setting-palette-preview]")
        ?.style.setProperty(`--d6e2-preview-${field}`, synchronized);
    }
    this.#paletteValidation = validateSettingProfilePalette(
      this.#draft.palette,
    );
    this.#updatePaletteValidationPresentation();
  };

  async #updateTypographyPreview(
    role: keyof D6SettingProfileTypographyV1,
    requestedId: string,
  ): Promise<void> {
    const generation = ++this.#typographyPreviewGeneration[role];
    const fallback = resolveSettingProfileTypography({
      ...this.#draft.typography,
      [role]: D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY[role],
    });
    this.#previewTypography = { ...this.#draft.typography };
    const preview = this.element.querySelector<HTMLElement>(
      "[data-setting-typography-preview]",
    );
    preview?.style.setProperty(
      `--d6e2-preview-font-${role}`,
      fallback[role].family,
    );
    const status = preview?.querySelector<HTMLElement>(
      "[data-setting-typography-status]",
    );
    if (status) {
      status.textContent = game.i18n.localize(
        "D6E2.Settings.SettingProfile.Typography.PreviewLoading",
      );
    }
    const loaded = await loadSettingProfileFontForRole(requestedId, role);
    if (
      generation !== this.#typographyPreviewGeneration[role] ||
      this.#draft.typography[role] !== requestedId
    ) {
      return;
    }
    preview?.style.setProperty(`--d6e2-preview-font-${role}`, loaded.family);
    this.#typographyPreviewAvailable[role] = loaded.available;
    if (status) {
      status.textContent = Object.values(
        this.#typographyPreviewAvailable,
      ).every(Boolean)
        ? game.i18n.localize(
            "D6E2.Settings.SettingProfile.Typography.PreviewReady",
          )
        : game.i18n.localize(
            "D6E2.Settings.SettingProfile.Typography.Unavailable",
          );
    }
  }

  #paletteValidationMessage(): string {
    if (this.#paletteValidation.valid) return "";
    return this.#paletteValidation.reason === "contrast"
      ? game.i18n.format("D6E2.Settings.SettingProfile.PaletteContrastError", {
          ratio: (this.#paletteValidation.ratio ?? 0).toFixed(2),
          threshold: this.#paletteValidation.threshold ?? 4.5,
          surface: game.i18n.localize(
            `D6E2.Settings.SettingProfile.PaletteSurface.${this.#paletteValidation.surface ?? "background"}`,
          ),
        })
      : game.i18n.localize("D6E2.Settings.SettingProfile.PaletteHexError");
  }

  #updatePaletteValidationPresentation(): void {
    const validation = this.#paletteValidation;
    const message = this.#paletteValidationMessage();
    for (const field of PALETTE_FIELDS) {
      const failed = !validation.valid && validation.field === field;
      this.element
        .querySelector<HTMLInputElement>(`[name="profile.palette.${field}"]`)
        ?.setAttribute("aria-invalid", String(failed));
      const error = this.element.querySelector<HTMLElement>(
        `#d6e2-setting-profile-palette-${field}-error`,
      );
      if (error) error.textContent = failed ? message : "";
    }
    const summary = this.element.querySelector<HTMLElement>(
      "[data-setting-palette-summary]",
    );
    if (summary) {
      summary.classList.toggle("is-hidden", validation.valid);
      const link = summary.querySelector<HTMLAnchorElement>("a");
      if (link && !validation.valid) {
        link.href = `#d6e2-setting-profile-palette-${validation.field ?? "accent"}`;
        link.textContent = message;
      }
    }
    for (const status of Array.from(
      this.element.querySelectorAll<HTMLElement>(
        "[data-palette-validation-status]",
      ),
    )) {
      status.classList.toggle(
        "is-hidden",
        status.dataset.paletteValidationStatus === "passed"
          ? !validation.valid
          : validation.valid,
      );
    }
  }

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
    this.#previewPalette = structuredClone(this.#draft.palette);
    this.#previewTypography = structuredClone(this.#draft.typography);
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

  static readonly #addLocalFont = function (
    this: D6System2eSettingProfileApplication,
  ): void {
    this.#readVisibleForm();
    new D6System2eFontLibraryApplication().render({ force: true });
  };

  static readonly #submit = async function (
    this: D6System2eSettingProfileApplication,
  ): Promise<void> {
    this.#readVisibleForm();
    this.#paletteValidation = validateSettingProfilePalette(
      this.#draft.palette,
    );
    if (!this.#paletteValidation.valid) {
      this.#activeProfileTab = "identity";
      ui.notifications.warn(
        game.i18n.localize(
          "D6E2.Settings.SettingProfile.PaletteValidationFailed",
        ),
      );
      await this.render({ force: true });
      this.element
        .querySelector<HTMLInputElement>(
          `[name="profile.palette.${this.#paletteValidation.field ?? "accent"}"]`,
        )
        ?.focus();
      return;
    }
    const typographyValidation = validateSettingProfileTypography(
      this.#draft.typography,
    );
    if (
      !typographyValidation.valid &&
      typographyValidation.reason !== "unavailable"
    ) {
      this.#activeProfileTab = "identity";
      ui.notifications.warn(
        game.i18n.localize(
          "D6E2.Settings.SettingProfile.Typography.ValidationFailed",
        ),
      );
      await this.render({ force: true });
      this.element
        .querySelector<HTMLSelectElement>(
          `[name="profile.typography.${typographyValidation.role ?? "display"}"]`,
        )
        ?.focus();
      return;
    }
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
      addLocalFont: this.#addLocalFont,
      addSkill: this.#addSkill,
      pickAsset: this.#pickAsset,
      removeSkill: this.#removeSkill,
      restoreProfile: this.#restoreProfile,
    },
    classes: ["d6e2", "d6e2-setting-profile"],
    form: applicationV2FormOptions({
      closeOnSubmit: false,
      handler: this.#submit,
      submitOnChange: false,
    }),
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
    this.#draft.palette = Object.fromEntries(
      PALETTE_FIELDS.map((field) => [
        field,
        value(`profile.palette.${field}`).trim(),
      ]),
    ) as unknown as D6SettingProfilePaletteV1;
    this.#draft.typography = {
      body: value("profile.typography.body"),
      display: value("profile.typography.display"),
    };
    this.#draft.terminology = mergeTerminologyOverrideEntries(
      this.#draft.terminology,
      this.#visibleTerminologyFields().map(({ path }) => [
        path,
        value(`terminology.${path}`),
      ]),
    );
    for (const group of Array.from(
      form.querySelectorAll<HTMLElement>("[data-health-model-id]"),
    )) {
      const modelId = group.dataset.healthModelId;
      if (!modelId) continue;
      const track = value(`health.${modelId}.track`);
      const states = Object.fromEntries(
        Array.from(
          group.querySelectorAll<HTMLInputElement>("[data-health-state-id]"),
        ).map((input) => [
          input.dataset.healthStateId ?? "",
          input.value.trim(),
        ]),
      );
      this.#draft.healthLabels[modelId] = { states, track };
    }
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

  #visibleTerminologyFields(): readonly TerminologyOverrideFieldDefinition[] {
    const healthStrategyId = currentConfiguredHealthModel(
      currentConfiguredRulesProfile(),
    ).damageStrategyId;
    return settingProfileTerminologyFields(healthStrategyId);
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

  readonly #typographyInputHandler = async (event: Event): Promise<void> => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) return;
    const role = select.dataset.typographyRole as
      keyof D6SettingProfileTypographyV1 | undefined;
    if (role !== "body" && role !== "display") return;
    this.#draft.typography = {
      ...this.#draft.typography,
      [role]: select.value,
    };
    await this.#updateTypographyPreview(role, select.value);
  };

  readonly #queueTypographyInput = (event: Event): void => {
    void this.#typographyInputHandler(event);
  };

  readonly #queueDrop = (event: DragEvent): void => {
    void this.#dropHandler(event);
  };

  override async _onRender(
    context: Record<string, unknown>,
    options: { readonly parts: readonly string[] },
  ): Promise<void> {
    await super._onRender(context, options);
    this.#unsubscribeTypographyEditor ??=
      subscribeSettingProfileTypographyEditor(this.#typographyEditorSubscriber);
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
    this.element.removeEventListener("input", this.#paletteInputHandler);
    this.element.addEventListener("input", this.#paletteInputHandler);
    this.element.removeEventListener("change", this.#queueTypographyInput);
    this.element.addEventListener("change", this.#queueTypographyInput);
    this.#activateProfileTab(this.#activeProfileTab, false);
    for (const role of ["display", "body"] as const) {
      void this.#updateTypographyPreview(role, this.#draft.typography[role]);
    }
  }

  override async close(): Promise<void> {
    await super.close();
    this.#unsubscribeTypographyEditor?.();
    this.#unsubscribeTypographyEditor = null;
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
    const healthStrategyId = currentConfiguredHealthModel(
      currentConfiguredRulesProfile(),
    ).damageStrategyId;
    const rulesProfile = currentConfiguredRulesProfile();
    const activeHealthModel = currentConfiguredHealthModel(rulesProfile);
    const availableHealthModels = availableHealthModelsForProfile(rulesProfile);
    const availableIds = new Set(availableHealthModels.map(({ id }) => id));
    const healthModels = [
      ...availableHealthModels
        .map((model) => ({
          active: model.id === activeHealthModel.id,
          cssClass: model.id === activeHealthModel.id ? "is-active" : "",
          id: model.id,
          label: game.i18n.localize(model.label),
          states:
            model.kind === "pool"
              ? []
              : model.track.states.map((state) => ({
                  id: state.id,
                  inherited: game.i18n.localize(state.label),
                  value:
                    this.#draft.healthLabels[model.id]?.states[state.id] ?? "",
                })),
          trackInherited: game.i18n.localize(model.label),
          trackValue: this.#draft.healthLabels[model.id]?.track ?? "",
          unavailable: false,
        }))
        .sort((left, right) => Number(right.active) - Number(left.active)),
      ...Object.entries(this.#draft.healthLabels).flatMap(
        ([modelId, labels]) =>
          availableIds.has(modelId)
            ? []
            : [
                {
                  active: false,
                  cssClass: "is-unavailable",
                  id: modelId,
                  label: modelId,
                  states: Object.entries(labels.states).map(
                    ([stateId, stateLabel]) => ({
                      id: stateId,
                      inherited: stateId,
                      value: stateLabel,
                    }),
                  ),
                  trackInherited: modelId,
                  trackValue: labels.track,
                  unavailable: true,
                },
              ],
      ),
    ];
    const visibleTerminologyFields = this.#visibleTerminologyFields();
    const profileLogo = resolveSettingLogo(this.#draft.logo);
    const profileLogoPresentation = resolveSettingLogoPresentation(profileLogo);
    const paletteValidation = this.#paletteValidation;
    const paletteValidationMessage = this.#paletteValidationMessage();
    const previewPalette = this.#previewPalette;
    const resolvedTypography = resolveSettingProfileTypography(
      this.#previewTypography,
    );
    const fontChoices = availableSettingProfileFonts();
    const typographyRoles = (["display", "body"] as const).map((role) => {
      const requestedId = this.#draft.typography[role];
      const available = fontChoices.filter(({ roles }) => roles.includes(role));
      const unavailable = !available.some(({ ref }) => ref === requestedId);
      const selectedFont = available.find(({ ref }) => ref === requestedId);
      const sources = [
        {
          fonts: available.filter(({ source }) => source === "system"),
          label: game.i18n.localize(
            "D6E2.Settings.SettingProfile.Typography.BuiltIn",
          ),
        },
        {
          fonts: available.filter(({ source }) => source === "world"),
          label: game.i18n.localize(
            "D6E2.Settings.SettingProfile.Typography.LocalFonts",
          ),
        },
        ...[
          ...new Set(
            available
              .filter(({ source }) => source === "module")
              .map(({ ownerId }) => ownerId),
          ),
        ].map((ownerId) => ({
          fonts: available.filter((font) => font.ownerId === ownerId),
          label: game.i18n.format(
            "D6E2.Settings.SettingProfile.Typography.FromProvider",
            { provider: fontProviderLabel(ownerId) },
          ),
        })),
      ];
      return {
        help: game.i18n.localize(
          `D6E2.Settings.SettingProfile.Typography.${role}Help`,
        ),
        id: role,
        label: game.i18n.localize(
          `D6E2.Settings.SettingProfile.Typography.${role}`,
        ),
        groups: sources
          .filter(({ fonts }) => fonts.length > 0)
          .map(({ fonts, label }) => ({
            label,
            options: fonts.map(({ label: fontLabel, ref }) => ({
              id: ref,
              label: fontLabel,
              selected: ref === requestedId,
            })),
          })),
        unavailableOption: unavailable
          ? {
              id: requestedId,
              label: `${humanizeFontReference(requestedId)} — ${game.i18n.localize("D6E2.Settings.SettingProfile.Typography.Unavailable")}`,
            }
          : undefined,
        unavailable,
        status: unavailable
          ? game.i18n.localize(
              "D6E2.Settings.SettingProfile.Typography.Unavailable",
            )
          : selectedFont?.source === "module"
            ? game.i18n.format(
                "D6E2.Settings.SettingProfile.Typography.ProvidedBy",
                { provider: fontProviderLabel(selectedFont.ownerId) },
              )
            : selectedFont?.source === "world"
              ? game.i18n.localize(
                  "D6E2.Settings.SettingProfile.Typography.LocalFont",
                )
              : game.i18n.localize(
                  "D6E2.Settings.SettingProfile.Typography.BuiltIn",
                ),
      };
    });
    const paletteGroups = [
      {
        help: game.i18n.localize(
          "D6E2.Settings.SettingProfile.PalettePrimaryHelp",
        ),
        label: game.i18n.localize(
          "D6E2.Settings.SettingProfile.PalettePrimary",
        ),
        fields: ["accent", "accentBright"] as const,
      },
      {
        help: game.i18n.localize(
          "D6E2.Settings.SettingProfile.PaletteReadabilityHelp",
        ),
        label: game.i18n.localize(
          "D6E2.Settings.SettingProfile.PaletteReadability",
        ),
        fields: ["background", "text", "muted"] as const,
      },
    ].map((group) => ({
      ...group,
      fields: group.fields.map((field) => ({
        error: paletteValidation.valid
          ? undefined
          : paletteValidation.field === field,
        errorMessage:
          !paletteValidation.valid && paletteValidation.field === field
            ? paletteValidationMessage
            : undefined,
        help: game.i18n.localize(
          `D6E2.Settings.SettingProfile.Palette.${field}Help`,
        ),
        id: field,
        label: game.i18n.localize(
          `D6E2.Settings.SettingProfile.Palette.${field}`,
        ),
        pickerValue: previewPalette[field],
        value: this.#draft.palette[field],
      })),
    }));
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
      healthModels,
      paletteGroups,
      paletteError: paletteValidation.valid
        ? undefined
        : {
            message: paletteValidationMessage,
            target: `d6e2-setting-profile-palette-${paletteValidation.field ?? "accent"}`,
          },
      paletteAttentionClass: paletteValidation.valid
        ? "is-contrast is-attention is-hidden"
        : "is-contrast is-attention",
      palettePassedClass: paletteValidation.valid
        ? "is-contrast"
        : "is-contrast is-hidden",
      paletteSummaryClass: paletteValidation.valid
        ? "d6e2-setting-profile-palette-summary is-hidden"
        : "d6e2-setting-profile-palette-summary",
      paletteValidationPassed: paletteValidation.valid,
      palettePreviewStyle: PALETTE_FIELDS.map(
        (field) => `--d6e2-preview-${field}: ${previewPalette[field]}`,
      ).join("; "),
      typographyPreviewStyle: [
        `--d6e2-preview-font-display: ${resolvedTypography.display.family}`,
        `--d6e2-preview-font-body: ${resolvedTypography.body.family}`,
      ].join("; "),
      typographyRoles,
      profile: this.#draft,
      profileLogo: foundry.utils.getRoute(profileLogo),
      profileLogoBrand: profileLogoPresentation.brand,
      profileLogoBranding: profileLogoPresentation.mode,
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
        terminology: game.i18n.localize(
          "D6E2.Settings.SettingProfile.TabMeta.Terminology",
        ),
        wildDie: game.i18n.localize(
          "D6E2.Settings.SettingProfile.TabMeta.WildDie",
        ),
      },
      terminologyGroups: [
        "presentation",
        "actors",
        "items",
        "conditions",
        "attributes",
        "resources",
        "details",
        "metaphysics",
        "machines",
      ].map((group) => ({
        fields: visibleTerminologyFields
          .filter((definition) => definition.group === group)
          .map((definition) => ({
            inherited: game.i18n.localize(definition.defaultLabel),
            label: definition.nameLabel
              ? game.i18n.format(definition.label, {
                  name: game.i18n.localize(definition.nameLabel),
                })
              : game.i18n.localize(definition.label),
            path: definition.path,
            value: terminologyOverrideValue(
              this.#draft.terminology,
              definition.path,
            ),
          })),
        label: game.i18n.localize(
          group === "conditions"
            ? healthTerminologyGroupLabel(healthStrategyId)
            : `D6E2.Settings.Terminology.${group.charAt(0).toUpperCase()}${group.slice(1)}`,
        ),
        id: group,
      })),
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
