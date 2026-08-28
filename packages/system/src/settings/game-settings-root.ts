import { SYSTEM_ID } from "../constants";
import {
  D6System2eFirstEditionSettings,
  D6System2eSecondEditionSettings,
} from "./settings-application";
import { D6System2eSettingProfileApplication } from "./setting-profile-application";
import {
  createSettingProfile,
  availableSettingProfiles,
  currentSettingProfile,
  currentSettingProfileSelection,
  deleteWorldSettingProfile,
  duplicateSettingProfile,
  exportSettingProfile,
  importSettingProfile,
  saveWorldSettingProfile,
  storedWorldSettingProfiles,
} from "./setting-profile";
import { settingProfileAssetDiagnostics } from "../foundry/setting-profile-storage";
import { activateSettingProfile } from "../foundry/setting-profile-service";
import { D6System2eRulesProfileApplication } from "./rules-profile-application";
import {
  availableRulesProfiles,
  createWorldRulesProfile,
  currentConfiguredRulesProfile,
  deleteWorldRulesProfile,
  duplicateRulesProfile,
  exportRulesProfile,
  importRulesProfile,
  rulesProfileDiagnostics,
  rulesProfileSettingsWorkspace,
  saveWorldRulesProfile,
  selectRulesProfile,
  storedWorldRulesProfiles,
} from "./rules-profile-library";
import { availableProfilePresets } from "../registries/profile-presets";
import {
  activateProfilePreset,
  previewProfilePreset,
} from "../foundry/profile-preset-service";
import type {
  D6ProfilePresetPreviewV1,
  D6ResolvedProfilePresetV1,
} from "@d6-system-2e/core";
import { SHARED_SETTING_KEYS } from "./settings-catalog";
import {
  resolvePersonalThemeSelection,
  resolveSettingLogo,
} from "./presentation-theme";
import { themeRegistry } from "../registries/themes";
import { stringSetting } from "./setting-values";

const ROOT_SELECTOR = "[data-d6e2-system-mode-setup]";
const TRANSACTION_SETTINGS_SELECTOR =
  "[data-d6e2-character-transaction-settings]";
const PERSONAL_THEME_SELECTOR = "[data-d6e2-personal-theme]";
const PERSONAL_THEME_CHOICE_SELECTOR = "[data-d6e2-personal-theme-choice]";
const SECOND_EDITION_MENU = `${SYSTEM_ID}.d6SystemSecondEdition`;
const FIRST_EDITION_MENU = `${SYSTEM_ID}.openD6FirstEdition`;

function localized(key: string): string {
  return game.i18n.localize(key);
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text) result.textContent = text;
  return result;
}

function htmlEscape(value: string): string {
  const node = document.createElement("span");
  node.textContent = value;
  return node.innerHTML;
}

type ProfileSource = "bundled" | "module" | "world";

function shortProfileSource(source: ProfileSource): string {
  return localized(`D6E2.Settings.Profile.Source.${source}`);
}

function replaceProfileBadges(
  container: HTMLElement | null,
  source: ProfileSource,
  customized = false,
): void {
  if (!container) return;
  const sourceBadge = element(
    "span",
    "d6e2-profile-badge",
    shortProfileSource(source),
  );
  sourceBadge.dataset.source = source;
  const badges = [sourceBadge];
  if (customized) {
    const customizedBadge = element(
      "span",
      "d6e2-profile-badge is-customized",
      localized("D6E2.Settings.Profile.Customized"),
    );
    badges.push(customizedBadge);
  }
  container.replaceChildren(...badges);
}

function buildProfilePlate(
  kind: "rules" | "setting",
  caption: string,
  select: HTMLSelectElement,
): HTMLLabelElement {
  const plate = element("label", `d6e2-profile-plate is-${kind}`);
  const mark = element("span", "d6e2-profile-plate-mark");
  if (kind === "setting") {
    const image = element("img");
    image.alt = "";
    image.dataset.d6e2ProfilePlateImage = "";
    mark.append(image);
  } else {
    const icon = element("i", "fa-solid fa-dice-d6");
    icon.setAttribute("aria-hidden", "true");
    mark.append(icon);
  }
  const copy = element("span", "d6e2-profile-plate-copy");
  copy.append(element("small", undefined, caption));
  const title = element("strong");
  title.dataset.d6e2ProfilePlateTitle = kind;
  const badges = element("span", "d6e2-profile-badges");
  badges.dataset.d6e2ProfilePlateBadges = kind;
  copy.append(title, badges);
  const chevron = element("i", "fa-solid fa-chevron-down");
  chevron.setAttribute("aria-hidden", "true");
  plate.append(mark, copy, chevron, select);
  return plate;
}

function buildManageMenu(
  profile: "rules" | "setting",
  actions: readonly (readonly [string, string, string])[],
): HTMLDetailsElement {
  const details = element("details", "d6e2-profile-manage");
  const summary = element("summary");
  const summaryIcon = element("i", "fa-solid fa-ellipsis");
  summaryIcon.setAttribute("aria-hidden", "true");
  summary.append(
    summaryIcon,
    element("span", undefined, localized("D6E2.Settings.Profile.Manage")),
  );
  const menu = element("div", "d6e2-profile-manage-menu");
  menu.setAttribute("role", "menu");
  for (const [action, icon, label] of actions) {
    const button = element("button");
    button.type = "button";
    button.setAttribute("role", "menuitem");
    if (profile === "rules") button.dataset.d6e2RulesProfileAction = action;
    else button.dataset.d6e2ProfileAction = action;
    if (action === "delete") button.classList.add("is-destructive");
    const iconElement = element("i", `fa-solid ${icon}`);
    iconElement.setAttribute("aria-hidden", "true");
    button.append(iconElement, element("span", undefined, label));
    menu.append(button);
  }
  menu.addEventListener("click", () => details.removeAttribute("open"));
  details.append(summary, menu);
  return details;
}

function downloadRulesProfile(): void {
  const profile = currentConfiguredRulesProfile();
  const blob = new Blob(
    [JSON.stringify(exportRulesProfile(profile), null, 2)],
    {
      type: "application/json",
    },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `${profile.id}.rules-profile.json`;
  link.href = url;
  link.hidden = true;
  document.body.append(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

async function chooseRulesProfileImport(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.accept = "application/json,.json";
    input.type = "file";
    input.hidden = true;
    document.body.append(input);
    input.addEventListener(
      "change",
      () => {
        const file = input.files?.[0];
        input.remove();
        if (!file) {
          resolve(null);
          return;
        }
        void file
          .text()
          .then((source) => resolve(JSON.parse(source) as unknown))
          .catch(reject);
      },
      { once: true },
    );
    input.click();
  });
}

async function promptRulesProfileDeletion(): Promise<void> {
  const world = storedWorldRulesProfiles();
  const candidates = Object.values(world.profiles)
    .filter(({ id }) => id !== world.activeProfileId)
    .sort((left, right) => left.label.localeCompare(right.label));
  if (candidates.length === 0) {
    ui.notifications.warn(
      localized("D6E2.Settings.RulesProfile.NoDeletableProfiles"),
    );
    return;
  }
  const options = candidates
    .map(
      ({ id, label }) =>
        `<option value="${htmlEscape(id)}">${htmlEscape(label)}</option>`,
    )
    .join("");
  const selected = await foundry.applications.api.DialogV2.wait<string | null>({
    buttons: [
      {
        action: "cancel",
        callback: () => null,
        label: localized("D6E2.Cancel"),
      },
      {
        action: "delete",
        callback: (_event, button) => {
          const control = button.form?.elements.namedItem("profileId");
          return control instanceof HTMLSelectElement ? control.value : null;
        },
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-trash",
        label: localized("D6E2.Settings.RulesProfile.Delete"),
      },
    ],
    classes: ["d6e2", "od6roll-dialog", "d6e2-confirm-dialog"],
    content: `<div class="od6-dialog-shell"><p>${localized("D6E2.Settings.RulesProfile.DeleteHelp")}</p><label><span>${localized("D6E2.Settings.RulesProfile.DeleteSelect")}</span><select name="profileId">${options}</select></label></div>`,
    modal: true,
    position: { width: 520 },
    rejectClose: false,
    window: {
      icon: "fa-solid fa-trash",
      title: localized("D6E2.Settings.RulesProfile.Delete"),
    },
  });
  if (!selected) return;
  await deleteWorldRulesProfile(selected);
  ui.notifications.info(localized("D6E2.Settings.RulesProfile.Deleted"));
}

function downloadSettingProfile(): void {
  const profile = currentSettingProfile();
  const blob = new Blob(
    [JSON.stringify(exportSettingProfile(profile), null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `${profile.id}.setting-profile.json`;
  link.href = url;
  link.hidden = true;
  document.body.append(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

async function chooseSettingProfileImport(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.accept = "application/json,.json";
    input.type = "file";
    input.hidden = true;
    document.body.append(input);
    input.addEventListener(
      "change",
      () => {
        const file = input.files?.[0];
        input.remove();
        if (!file) {
          resolve(null);
          return;
        }
        void file
          .text()
          .then((source) => resolve(JSON.parse(source) as unknown))
          .catch(reject);
      },
      { once: true },
    );
    input.click();
  });
}

async function promptSettingProfileDeletion(): Promise<void> {
  const world = storedWorldSettingProfiles();
  const candidates = Object.values(world.profiles)
    .filter(({ id }) => id !== world.activeProfileId)
    .sort((left, right) => left.label.localeCompare(right.label));
  if (candidates.length === 0) {
    ui.notifications.warn(
      localized("D6E2.Settings.SettingProfile.NoDeletableProfiles"),
    );
    return;
  }
  const options = candidates
    .map(
      ({ id, label }) =>
        `<option value="${htmlEscape(id)}">${htmlEscape(label)}</option>`,
    )
    .join("");
  const selected = await foundry.applications.api.DialogV2.wait<string | null>({
    buttons: [
      {
        action: "cancel",
        callback: () => null,
        label: localized("D6E2.Cancel"),
      },
      {
        action: "delete",
        callback: (_event, button) => {
          const control = button.form?.elements.namedItem("profileId");
          return control instanceof HTMLSelectElement ? control.value : null;
        },
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-trash",
        label: localized("D6E2.Settings.SettingProfile.Delete"),
      },
    ],
    classes: ["d6e2", "od6roll-dialog", "d6e2-confirm-dialog"],
    content: `<div class="od6-dialog-shell"><p>${localized("D6E2.Settings.SettingProfile.DeleteHelp")}</p><label><span>${localized("D6E2.Settings.SettingProfile.DeleteSelect")}</span><select name="profileId">${options}</select></label></div>`,
    modal: true,
    position: { width: 520 },
    rejectClose: false,
    window: {
      icon: "fa-solid fa-trash",
      title: localized("D6E2.Settings.SettingProfile.Delete"),
    },
  });
  if (!selected) return;
  await deleteWorldSettingProfile(selected);
  ui.notifications.info(localized("D6E2.Settings.SettingProfile.Deleted"));
}

function removeNativeEditionMenuRows(category: HTMLElement): void {
  for (const key of [SECOND_EDITION_MENU, FIRST_EDITION_MENU]) {
    category
      .querySelector<HTMLButtonElement>(`button[data-key="${key}"]`)
      ?.closest<HTMLElement>(".form-group")
      ?.remove();
  }
}

function removeNativePersonalThemeRow(category: HTMLElement): void {
  category
    .querySelector<HTMLElement>(
      `:is(input, select)[name="${SYSTEM_ID}.${SHARED_SETTING_KEYS.userTheme}"]`,
    )
    ?.closest<HTMLElement>(".form-group")
    ?.remove();
}

function personalThemeButton(
  id: string,
  label: string,
  selected: boolean,
  theme: ReturnType<typeof themeRegistry.current>[number] | undefined,
  unavailable = false,
): HTMLButtonElement {
  const button = element("button", "d6e2-personal-theme-choice");
  button.type = "button";
  button.dataset.d6e2PersonalThemeChoice = id;
  button.setAttribute("role", "radio");
  button.setAttribute("aria-checked", String(selected));
  button.tabIndex = selected ? 0 : -1;
  button.classList.toggle("is-selected", selected);
  button.classList.toggle("is-unavailable", unavailable);

  const palette = element("span", "d6e2-personal-theme-palette");
  palette.setAttribute("aria-hidden", "true");
  for (const color of [
    theme?.tokens.background,
    theme?.tokens.accent,
    theme?.tokens.accentBright,
  ]) {
    const swatch = element("span");
    if (color) swatch.style.setProperty("--d6e2-theme-swatch", color);
    palette.append(swatch);
  }
  const copy = element("span", "d6e2-personal-theme-choice-copy");
  copy.append(element("strong", undefined, label));
  if (unavailable) {
    copy.append(
      element(
        "small",
        "d6e2-personal-theme-unavailable",
        localized("D6E2.Settings.PersonalTheme.UnavailableBadge"),
      ),
    );
  }
  const state = element("i", "fa-solid fa-circle-check");
  state.setAttribute("aria-hidden", "true");
  button.append(palette, copy, state);
  return button;
}

function updatePersonalThemeSetup(
  category: HTMLElement,
  focusThemeId?: string,
  setup?: HTMLElement,
): void {
  const section =
    setup ?? category.querySelector<HTMLElement>(PERSONAL_THEME_SELECTOR);
  const choices = section?.querySelector<HTMLElement>(
    ".d6e2-personal-theme-choices",
  );
  if (!section || !choices) return;
  const themes = themeRegistry.current();
  const requestedId = stringSetting(SHARED_SETTING_KEYS.userTheme, "inherit");
  const profile = currentSettingProfile();
  const selection = resolvePersonalThemeSelection(themes, profile, requestedId);
  const inherited = resolvePersonalThemeSelection(themes, profile, "inherit");
  const buttons = [
    personalThemeButton(
      "inherit",
      localized("D6E2.Settings.Theme.Inherit"),
      requestedId === "inherit",
      inherited.effectiveTheme,
    ),
    ...themes.map((theme) =>
      personalThemeButton(
        theme.id,
        theme.label,
        requestedId === theme.id,
        theme,
      ),
    ),
    ...(!selection.available && !selection.inherits
      ? [
          personalThemeButton(
            requestedId,
            game.i18n.format(
              "D6E2.Settings.PersonalTheme.UnavailablePersonalTheme",
              { id: requestedId },
            ),
            true,
            selection.effectiveTheme,
            true,
          ),
        ]
      : []),
  ];
  choices.replaceChildren(...buttons);
  const status = section.querySelector<HTMLElement>(
    "[data-d6e2-personal-theme-status]",
  );
  if (status) {
    status.hidden = selection.available || selection.inherits;
    status.textContent =
      selection.available || selection.inherits
        ? ""
        : game.i18n.format(
            "D6E2.Settings.PersonalTheme.UnavailableExplanation",
            { id: requestedId },
          );
  }
  if (focusThemeId) {
    Array.from(
      choices.querySelectorAll<HTMLButtonElement>(
        PERSONAL_THEME_CHOICE_SELECTOR,
      ),
    )
      .find(({ dataset }) => dataset.d6e2PersonalThemeChoice === focusThemeId)
      ?.focus();
  }
}

function choosePersonalTheme(category: HTMLElement, requestedId: string): void {
  const section = category.querySelector<HTMLElement>(PERSONAL_THEME_SELECTOR);
  if (!section || section.dataset.busy === "true") return;
  if (stringSetting(SHARED_SETTING_KEYS.userTheme, "inherit") === requestedId) {
    updatePersonalThemeSetup(category, requestedId);
    return;
  }
  section.dataset.busy = "true";
  for (const button of Array.from(
    section.querySelectorAll<HTMLButtonElement>(PERSONAL_THEME_CHOICE_SELECTOR),
  )) {
    button.disabled = true;
  }
  void game.settings
    .set(SYSTEM_ID, SHARED_SETTING_KEYS.userTheme, requestedId)
    .then(() => updatePersonalThemeSetup(category, requestedId))
    .catch(() =>
      ui.notifications.warn(
        localized("D6E2.Settings.PersonalTheme.SaveFailed"),
      ),
    )
    .finally(() => {
      delete section.dataset.busy;
      for (const button of Array.from(
        section.querySelectorAll<HTMLButtonElement>(
          PERSONAL_THEME_CHOICE_SELECTOR,
        ),
      )) {
        button.disabled = false;
      }
    });
}

export function buildPersonalThemeSetup(category: HTMLElement): HTMLElement {
  const section = element("section", "d6e2-personal-theme-settings");
  section.dataset.d6e2PersonalTheme = "";
  section.setAttribute("aria-labelledby", "d6e2-personal-theme-heading");
  const header = element("header");
  header.append(
    element(
      "p",
      "od6v2-eyebrow",
      localized("D6E2.Settings.PersonalTheme.Eyebrow"),
    ),
    element("h3", undefined, localized("D6E2.Settings.PersonalTheme.Title")),
    element(
      "p",
      undefined,
      localized("D6E2.Settings.PersonalTheme.ClientOnlyHelp"),
    ),
  );
  header.querySelector("h3")?.setAttribute("id", "d6e2-personal-theme-heading");
  const choices = element("div", "d6e2-personal-theme-choices");
  choices.setAttribute("role", "radiogroup");
  choices.setAttribute("aria-labelledby", "d6e2-personal-theme-heading");
  const status = element("p", "d6e2-personal-theme-status");
  status.dataset.d6e2PersonalThemeStatus = "";
  status.setAttribute("role", "status");
  status.hidden = true;
  section.append(header, choices, status);
  section.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      PERSONAL_THEME_CHOICE_SELECTOR,
    );
    if (button && !button.disabled) {
      choosePersonalTheme(
        category,
        button.dataset.d6e2PersonalThemeChoice ?? "inherit",
      );
    }
  });
  section.addEventListener("keydown", (event) => {
    if (!(event instanceof KeyboardEvent)) return;
    const current = (event.target as HTMLElement).closest<HTMLButtonElement>(
      PERSONAL_THEME_CHOICE_SELECTOR,
    );
    if (!current) return;
    const buttons = Array.from(
      choices.querySelectorAll<HTMLButtonElement>(
        PERSONAL_THEME_CHOICE_SELECTOR,
      ),
    );
    const currentIndex = buttons.indexOf(current);
    let nextIndex: number | undefined;
    if (["ArrowRight", "ArrowDown"].includes(event.key)) {
      nextIndex = (currentIndex + 1) % buttons.length;
    } else if (["ArrowLeft", "ArrowUp"].includes(event.key)) {
      nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
    } else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = buttons.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    const next = buttons[nextIndex];
    if (next)
      choosePersonalTheme(
        category,
        next.dataset.d6e2PersonalThemeChoice ?? "inherit",
      );
  });
  updatePersonalThemeSetup(category, undefined, section);
  return section;
}

function groupCharacterTransactionSettings(
  category: HTMLElement,
  root: HTMLElement,
): void {
  if (category.querySelector(TRANSACTION_SETTINGS_SELECTOR)) return;
  const rows = [
    SHARED_SETTING_KEYS.characterCurrencyTransactions,
    SHARED_SETTING_KEYS.characterEquipmentTransfers,
  ].flatMap((key) => {
    const row = category
      .querySelector<HTMLInputElement>(`input[name="${SYSTEM_ID}.${key}"]`)
      ?.closest<HTMLElement>(".form-group");
    return row ? [row] : [];
  });
  if (rows.length !== 2) return;

  const section = element("section", "d6e2-character-transaction-settings");
  section.dataset.d6e2CharacterTransactionSettings = "";
  const heading = element("header");
  heading.append(
    element(
      "p",
      "od6v2-eyebrow",
      localized("D6E2.Settings.Shared.Transactions.Eyebrow"),
    ),
    element(
      "h3",
      undefined,
      localized("D6E2.Settings.Shared.Transactions.Title"),
    ),
    element(
      "p",
      undefined,
      localized("D6E2.Settings.Shared.Transactions.Hint"),
    ),
  );
  const choices = element("div", "d6e2-character-transaction-choices");
  choices.append(...rows);
  section.append(heading, choices);
  root.insertAdjacentElement("afterend", section);
}

function selectedProfilePreset(
  root: HTMLElement,
): D6ResolvedProfilePresetV1 | undefined {
  const id = root.querySelector<HTMLSelectElement>(
    "[data-d6e2-profile-preset]",
  )?.value;
  return availableProfilePresets().find(({ preset }) => preset.id === id);
}

function matchingProfilePreset(): D6ResolvedProfilePresetV1 | undefined {
  const rulesProfileId = currentConfiguredRulesProfile().id;
  const settingProfileId = currentSettingProfileSelection().activeProfileId;
  return availableProfilePresets().find(
    ({ preset }) =>
      preset.selection.rulesProfileId === rulesProfileId &&
      preset.selection.settingProfileId === settingProfileId,
  );
}

function updateProfilePresetSetup(
  category: HTMLElement,
  busy = false,
  requestedId?: string,
): void {
  const root = category.querySelector<HTMLElement>(ROOT_SELECTOR);
  if (!root) return;
  const select = root.querySelector<HTMLSelectElement>(
    "[data-d6e2-profile-preset]",
  );
  if (!select) return;
  const presets = availableProfilePresets();
  const preferredId =
    requestedId ??
    (select.value ? select.value : matchingProfilePreset()?.preset.id);
  select.replaceChildren(
    ...presets.map(({ preset, source }) => {
      const sourceLabel =
        source === "bundled"
          ? localized("D6E2.Settings.ProfilePreset.Source.bundled")
          : localized("D6E2.Settings.ProfilePreset.Source.module");
      const option = element(
        "option",
        undefined,
        `${preset.label} · ${sourceLabel}`,
      );
      option.value = preset.id;
      option.selected = preset.id === preferredId;
      return option;
    }),
  );
  if (select.selectedIndex < 0 && presets.length > 0) select.selectedIndex = 0;
  select.disabled = busy || presets.length === 0;
  const choices = root.querySelector<HTMLElement>(
    "[data-d6e2-profile-preset-choices]",
  );
  if (choices) {
    choices.replaceChildren(
      ...presets.map(({ preset, source }) => {
        const rules = availableRulesProfiles().find(
          ({ id }) => id === preset.selection.rulesProfileId,
        );
        const setting = availableSettingProfiles().find(
          ({ profile }) => profile.id === preset.selection.settingProfileId,
        );
        const button = element("button", "d6e2-profile-preset-tile");
        button.type = "button";
        button.dataset.d6e2ProfilePresetChoice = preset.id;
        button.disabled = busy;
        button.title = preset.label;
        const selected = preset.id === select.value;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
        const mark = element("span", "d6e2-profile-preset-mark");
        const icon = element("i", "fa-solid fa-layer-group");
        icon.setAttribute("aria-hidden", "true");
        mark.append(icon);
        const copy = element("span", "d6e2-profile-preset-tile-copy");
        copy.append(
          element("strong", undefined, preset.label),
          element(
            "small",
            undefined,
            `${rules?.label ?? preset.selection.rulesProfileId} · ${setting?.profile.label ?? preset.selection.settingProfileId}`,
          ),
        );
        const badge = element(
          "span",
          "d6e2-profile-badge",
          shortProfileSource(source),
        );
        badge.dataset.source = source;
        button.append(mark, copy, badge);
        return button;
      }),
    );
  }
  const apply = root.querySelector<HTMLButtonElement>(
    "[data-d6e2-apply-profile-preset]",
  );
  if (apply) apply.disabled = busy || presets.length === 0;
  const selected = selectedProfilePreset(root);
  const description = root.querySelector<HTMLElement>(
    "[data-d6e2-profile-preset-description]",
  );
  if (description)
    description.textContent =
      selected?.preset.description ??
      localized("D6E2.Settings.ProfilePreset.Empty");
  const pairing = root.querySelector<HTMLElement>(
    "[data-d6e2-profile-preset-pairing]",
  );
  if (pairing && selected) {
    const rules = availableRulesProfiles().find(
      ({ id }) => id === selected.preset.selection.rulesProfileId,
    );
    const setting = availableSettingProfiles().find(
      ({ profile }) =>
        profile.id === selected.preset.selection.settingProfileId,
    );
    pairing.textContent = game.i18n.format(
      "D6E2.Settings.ProfilePreset.Pairing",
      {
        rules: rules?.label ?? selected.preset.selection.rulesProfileId,
        setting:
          setting?.profile.label ?? selected.preset.selection.settingProfileId,
      },
    );
  }
  const status = root.querySelector<HTMLElement>(
    "[data-d6e2-profile-preset-status]",
  );
  if (status) {
    status.textContent =
      selected?.preset.id === matchingProfilePreset()?.preset.id
        ? localized("D6E2.Settings.ProfilePreset.Active")
        : localized("D6E2.Settings.ProfilePreset.Available");
  }
}

async function confirmProfilePresetActivation(
  resolved: D6ResolvedProfilePresetV1,
  preview: D6ProfilePresetPreviewV1,
): Promise<boolean> {
  const rulesProfileId = resolved.preset.selection.rulesProfileId;
  const settingProfileId = resolved.preset.selection.settingProfileId;
  const rulesProfile = availableRulesProfiles().find(
    ({ id }) => id === rulesProfileId,
  );
  const settingProfile = availableSettingProfiles().find(
    ({ profile }) => profile.id === settingProfileId,
  );
  const profileSelection = (label: string, id: string): string =>
    `<span>${htmlEscape(label)}</span><small>${htmlEscape(id)}</small>`;
  const changeSummary = game.i18n.format(
    "D6E2.Settings.ProfilePreset.ChangeSummary",
    {
      changed: preview.changedCount,
      unchanged: preview.unchangedCount,
    },
  );
  const reload = preview.requiresReload
    ? localized("D6E2.Settings.ProfilePreset.ReloadRequired")
    : localized("D6E2.Settings.ProfilePreset.ReloadNotRequired");
  return (
    (await foundry.applications.api.DialogV2.wait<boolean>({
      buttons: [
        {
          action: "cancel",
          callback: () => false,
          label: localized("D6E2.Cancel"),
        },
        {
          action: "apply",
          callback: () => true,
          class: "od6roll-submit",
          default: true,
          icon: "fa-solid fa-check",
          label: localized("D6E2.Settings.ProfilePreset.Apply"),
        },
      ],
      classes: ["d6e2", "od6roll-dialog", "d6e2-confirm-dialog"],
      content: `<div class="od6-dialog-shell d6e2-profile-preset-confirm"><p>${htmlEscape(resolved.preset.description)}</p><dl><div><dt>${localized("D6E2.Settings.ProfilePreset.RulesProfile")}</dt><dd>${profileSelection(rulesProfile?.label ?? rulesProfileId, rulesProfileId)}</dd></div><div><dt>${localized("D6E2.Settings.ProfilePreset.SettingProfile")}</dt><dd>${profileSelection(settingProfile?.profile.label ?? settingProfileId, settingProfileId)}</dd></div></dl><p><strong>${htmlEscape(changeSummary)}</strong><br>${htmlEscape(reload)}</p></div>`,
      modal: true,
      position: { width: 520 },
      rejectClose: false,
      window: {
        icon: "fa-solid fa-layer-group",
        title: game.i18n.format("D6E2.Settings.ProfilePreset.ConfirmTitle", {
          preset: resolved.preset.label,
        }),
      },
    })) === true
  );
}

function buildProfilePresetSetup(category: HTMLElement): HTMLElement {
  const section = element(
    "section",
    "d6e2-root-setting-block d6e2-profile-preset-block",
  );
  section.setAttribute("aria-labelledby", "d6e2-profile-preset-heading");
  const header = element("header");
  header.append(
    element(
      "p",
      "d6e2-system-mode-setup-eyebrow",
      localized("D6E2.Settings.ProfilePreset.Eyebrow"),
    ),
    element("h2", undefined, localized("D6E2.Settings.ProfilePreset.Heading")),
    element("p", undefined, localized("D6E2.Settings.ProfilePreset.Help")),
  );
  header.querySelector("h2")?.setAttribute("id", "d6e2-profile-preset-heading");
  const controls = element("div", "d6e2-profile-preset-controls");
  const selectLabel = element("label", "d6e2-visually-hidden");
  selectLabel.append(
    element("span", undefined, localized("D6E2.Settings.ProfilePreset.Choose")),
  );
  const select = element("select");
  select.dataset.d6e2ProfilePreset = "";
  selectLabel.append(select);
  const choices = element("div", "d6e2-profile-preset-choices");
  choices.dataset.d6e2ProfilePresetChoices = "";
  const apply = element("button", "d6e2-game-mode-configure");
  apply.type = "button";
  apply.dataset.d6e2ApplyProfilePreset = "";
  apply.append(
    element("i", "fa-solid fa-magnifying-glass"),
    element(
      "span",
      undefined,
      localized("D6E2.Settings.ProfilePreset.ReviewApply"),
    ),
  );
  controls.append(selectLabel, choices, apply);
  const summary = element("div", "d6e2-profile-preset-summary");
  const description = element("p");
  description.dataset.d6e2ProfilePresetDescription = "";
  const metadata = element("div");
  const pairing = element("span");
  pairing.dataset.d6e2ProfilePresetPairing = "";
  const status = element("strong");
  status.dataset.d6e2ProfilePresetStatus = "";
  metadata.append(pairing, status);
  summary.append(description, metadata);
  section.append(header, controls, summary);
  select.addEventListener("change", () =>
    updateProfilePresetSetup(category, false, select.value),
  );
  choices.addEventListener("click", (event) => {
    const requested = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-d6e2-profile-preset-choice]",
    )?.dataset.d6e2ProfilePresetChoice;
    if (!requested) return;
    select.value = requested;
    updateProfilePresetSetup(category, false, requested);
  });
  apply.addEventListener("click", () => {
    const selected = selectedProfilePreset(
      section.closest(ROOT_SELECTOR) ?? section,
    );
    if (!selected) return;
    updateProfilePresetSetup(category, true, selected.preset.id);
    void previewProfilePreset(selected.preset.selection)
      .then(async (preview) => {
        if (!(await confirmProfilePresetActivation(selected, preview))) return;
        const result = await activateProfilePreset(selected.preset.selection);
        ui.notifications.info(
          game.i18n.format("D6E2.Settings.ProfilePreset.Applied", {
            changed: result.preview.changedCount,
            unchanged: result.preview.unchangedCount,
          }),
        );
      })
      .catch((error: unknown) =>
        ui.notifications.warn(
          game.i18n.format("D6E2.Settings.ProfilePreset.Failed", {
            error: error instanceof Error ? error.message : String(error),
          }),
        ),
      )
      .finally(() => {
        updateSystemModeSetup(category);
        updateSettingProfileSetup(category);
        updateProfilePresetSetup(category, false, selected.preset.id);
      });
  });
  return section;
}

function updateSystemModeSetup(category: HTMLElement, busy = false): void {
  const root = category.querySelector<HTMLElement>(ROOT_SELECTOR);
  if (!root) return;
  const profile = currentConfiguredRulesProfile();
  const select = root.querySelector<HTMLSelectElement>(
    "[data-d6e2-rules-profile]",
  );
  select?.replaceChildren(
    ...availableRulesProfiles().map((entry) => {
      const option = element("option", undefined, entry.label);
      option.value = entry.id;
      option.selected = entry.id === profile.id;
      return option;
    }),
  );
  if (select) select.disabled = busy;
  for (const button of Array.from(
    root.querySelectorAll<HTMLButtonElement>(
      "[data-d6e2-configure-active-rules], [data-d6e2-rules-profile-action]",
    ),
  )) {
    button.disabled = busy;
  }
  root
    .querySelector<HTMLButtonElement>("[data-d6e2-configure-active-rules]")
    ?.setAttribute(
      "aria-label",
      game.i18n.format("D6E2.Settings.RulesProfile.ConfigureActiveHint", {
        profile: profile.label,
      }),
    );
  const current = root.querySelector<HTMLElement>("[data-d6e2-current-mode]");
  if (current) current.textContent = profile.label;
  const resolved = root.querySelector<HTMLElement>(
    "[data-d6e2-resolved-profile]",
  );
  if (resolved)
    resolved.textContent = localized(
      `D6E2.Settings.RulesProfile.Source.${profile.source.kind}`,
    );
  const plateTitle = root.querySelector<HTMLElement>(
    '[data-d6e2-profile-plate-title="rules"]',
  );
  if (plateTitle) plateTitle.textContent = profile.label;
  replaceProfileBadges(
    root.querySelector<HTMLElement>('[data-d6e2-profile-plate-badges="rules"]'),
    profile.source.kind,
    profile.source.kind === "world",
  );
}

function updateSettingProfileSetup(category: HTMLElement, busy = false): void {
  const root = category.querySelector<HTMLElement>(ROOT_SELECTOR);
  if (!root) return;
  const selection = currentSettingProfileSelection();
  const select = root.querySelector<HTMLSelectElement>(
    "[data-d6e2-setting-profile]",
  );
  if (!select) return;
  select.replaceChildren(
    ...[...availableSettingProfiles()]
      .sort((left, right) =>
        left.profile.label.localeCompare(right.profile.label),
      )
      .map(({ profile, source }) => {
        const sourceLabel = localized(
          `D6E2.Settings.SettingProfile.Source.${source}`,
        );
        const option = element(
          "option",
          undefined,
          `${profile.label} · ${sourceLabel}`,
        );
        option.value = profile.id;
        option.selected = profile.id === selection.activeProfileId;
        return option;
      }),
    ...(!selection.available
      ? [
          (() => {
            const option = element(
              "option",
              undefined,
              game.i18n.format(
                "D6E2.Settings.SettingProfile.UnavailableSelection",
                { id: selection.activeProfileId },
              ),
            );
            option.value = selection.activeProfileId;
            option.selected = true;
            option.disabled = true;
            return option;
          })(),
        ]
      : []),
  );
  select.disabled = busy;
  for (const button of Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-d6e2-profile-action]"),
  )) {
    button.disabled = busy;
  }
  const currentLabel = selection.available
    ? currentSettingProfile().label
    : game.i18n.format("D6E2.Settings.SettingProfile.UnavailableFallback", {
        fallback: selection.resolved.profile.label,
        id: selection.activeProfileId,
      });
  const summary = root.querySelector<HTMLElement>(
    "[data-d6e2-current-setting-profile]",
  );
  if (summary) summary.textContent = currentLabel;
  const plateTitle = root.querySelector<HTMLElement>(
    '[data-d6e2-profile-plate-title="setting"]',
  );
  if (plateTitle) plateTitle.textContent = currentLabel;
  replaceProfileBadges(
    root.querySelector<HTMLElement>(
      '[data-d6e2-profile-plate-badges="setting"]',
    ),
    selection.resolved.source,
    selection.resolved.source === "world",
  );
  const plateImage = root.querySelector<HTMLImageElement>(
    "[data-d6e2-profile-plate-image]",
  );
  if (plateImage)
    plateImage.src = resolveSettingLogo(selection.resolved.profile.logo);
}

function buildActiveRulesConfigureButton(): HTMLButtonElement {
  const button = element("button", "d6e2-game-mode-configure");
  button.type = "button";
  button.dataset.d6e2ConfigureActiveRules = "";
  const iconElement = element("i", "fa-solid fa-sliders");
  iconElement.setAttribute("aria-hidden", "true");
  button.append(
    iconElement,
    element(
      "span",
      undefined,
      localized("D6E2.Settings.RulesProfile.ConfigureActive"),
    ),
  );
  return button;
}

function buildSystemModeSetup(category: HTMLElement): HTMLElement {
  const root = element("section", "d6e2-root-setting-block");
  root.setAttribute("aria-labelledby", "d6e2-game-mode-heading");

  const header = element("header");
  header.append(
    element(
      "p",
      "d6e2-system-mode-setup-eyebrow",
      localized("D6E2.Settings.GameMode.Eyebrow"),
    ),
    element("h2", undefined, localized("D6E2.Settings.GameMode.Heading")),
    element("p", undefined, localized("D6E2.Settings.GameMode.Hint")),
  );
  header.querySelector("h2")?.setAttribute("id", "d6e2-game-mode-heading");

  const selector = element("div", "d6e2-game-mode-selector");
  const choices = element("div", "d6e2-setting-profile-selector");
  const select = element("select");
  select.dataset.d6e2RulesProfile = "";
  select.setAttribute(
    "aria-label",
    localized("D6E2.Settings.RulesProfile.Active"),
  );
  const profilePlate = buildProfilePlate(
    "rules",
    localized("D6E2.Settings.RulesProfile.Active"),
    select,
  );
  const profileActions = element("div", "d6e2-setting-profile-root-actions");
  const create = element("button");
  create.type = "button";
  create.dataset.d6e2RulesProfileAction = "create";
  const createIcon = element("i", "fa-solid fa-plus");
  createIcon.setAttribute("aria-hidden", "true");
  create.append(
    createIcon,
    element("span", undefined, localized("D6E2.Settings.RulesProfile.Create")),
  );
  profileActions.append(buildActiveRulesConfigureButton(), create);
  profileActions.append(
    buildManageMenu("rules", [
      [
        "duplicate",
        "fa-copy",
        localized("D6E2.Settings.RulesProfile.Duplicate"),
      ],
      [
        "import",
        "fa-file-import",
        localized("D6E2.Settings.RulesProfile.Import"),
      ],
      [
        "export",
        "fa-file-export",
        localized("D6E2.Settings.RulesProfile.Export"),
      ],
      ["delete", "fa-trash", localized("D6E2.Settings.RulesProfile.Delete")],
    ]),
  );
  choices.append(profilePlate, profileActions);
  selector.append(choices);

  const current = element("span");
  current.dataset.d6e2CurrentMode = "";
  current.className = "d6e2-visually-hidden";
  const resolved = element("small");
  resolved.dataset.d6e2ResolvedProfile = "";
  resolved.className = "d6e2-visually-hidden";

  root.append(header, selector, current, resolved);
  select.addEventListener("change", () => {
    const requested = select.value;
    updateSystemModeSetup(category, true);
    void selectRulesProfile(requested)
      .then(() => {
        updateSystemModeSetup(category);
      })
      .catch(() =>
        ui.notifications.warn(
          localized("D6E2.Settings.RulesProfile.SaveFailed"),
        ),
      )
      .finally(() => updateSystemModeSetup(category));
  });
  root.addEventListener("click", (event) => {
    const rulesAction = (
      event.target as HTMLElement
    ).closest<HTMLButtonElement>("[data-d6e2-rules-profile-action]")?.dataset
      .d6e2RulesProfileAction;
    if (rulesAction === "create") {
      updateSystemModeSetup(category, true);
      const isNew = true;
      const draft = createWorldRulesProfile();
      new D6System2eRulesProfileApplication()
        .withDraft(draft, { isNew })
        .render(true);
      updateSystemModeSetup(category);
      return;
    }
    if (rulesAction === "export") {
      downloadRulesProfile();
      return;
    }
    if (rulesAction === "duplicate") {
      updateSystemModeSetup(category, true);
      void saveWorldRulesProfile(duplicateRulesProfile())
        .then((profile) => selectRulesProfile(profile.id))
        .then(() =>
          ui.notifications.info(
            localized("D6E2.Settings.RulesProfile.Duplicated"),
          ),
        )
        .catch(() =>
          ui.notifications.warn(
            localized("D6E2.Settings.RulesProfile.SaveFailed"),
          ),
        )
        .finally(() => updateSystemModeSetup(category));
      return;
    }
    if (rulesAction === "import") {
      updateSystemModeSetup(category, true);
      void chooseRulesProfileImport()
        .then((value) => {
          if (value === null) return null;
          const profile = importRulesProfile(value);
          if (rulesProfileDiagnostics(profile).length > 0)
            throw new TypeError("Imported Rules Profile is unavailable.");
          return saveWorldRulesProfile(profile);
        })
        .then((profile) =>
          profile ? selectRulesProfile(profile.id) : undefined,
        )
        .then((result) => {
          if (result)
            ui.notifications.info(
              localized("D6E2.Settings.RulesProfile.Imported"),
            );
        })
        .catch(() =>
          ui.notifications.warn(
            localized("D6E2.Settings.RulesProfile.ImportFailed"),
          ),
        )
        .finally(() => updateSystemModeSetup(category));
      return;
    }
    if (rulesAction === "delete") {
      updateSystemModeSetup(category, true);
      void promptRulesProfileDeletion()
        .catch(() =>
          ui.notifications.warn(
            localized("D6E2.Settings.RulesProfile.DeleteFailed"),
          ),
        )
        .finally(() => updateSystemModeSetup(category));
      return;
    }
    const configureTarget = (
      event.target as HTMLElement
    ).closest<HTMLButtonElement>("[data-d6e2-configure-active-rules]");
    if (configureTarget && !configureTarget.disabled) {
      if (
        rulesProfileSettingsWorkspace(currentConfiguredRulesProfile()) ===
        "open-d6"
      ) {
        new D6System2eFirstEditionSettings().render(true);
      } else {
        new D6System2eSecondEditionSettings().render(true);
      }
      return;
    }
  });
  return root;
}

function buildSettingProfileSetup(category: HTMLElement): HTMLElement {
  const section = element("section", "d6e2-root-setting-block");
  section.setAttribute("aria-labelledby", "d6e2-setting-profile-heading");
  const header = element("header");
  header.append(
    element(
      "p",
      "d6e2-system-mode-setup-eyebrow",
      localized("D6E2.Settings.SettingProfile.RootEyebrow"),
    ),
    element(
      "h2",
      undefined,
      localized("D6E2.Settings.SettingProfile.RootHeading"),
    ),
    element("p", undefined, localized("D6E2.Settings.SettingProfile.RootHelp")),
  );
  header
    .querySelector("h2")
    ?.setAttribute("id", "d6e2-setting-profile-heading");

  const controls = element("div", "d6e2-setting-profile-selector");
  const select = element("select");
  select.dataset.d6e2SettingProfile = "";
  select.setAttribute(
    "aria-label",
    localized("D6E2.Settings.SettingProfile.ActiveProfile"),
  );
  const profilePlate = buildProfilePlate(
    "setting",
    localized("D6E2.Settings.SettingProfile.ActiveProfile"),
    select,
  );
  const actions = element("div", "d6e2-setting-profile-root-actions");
  for (const [action, key, icon] of [
    ["edit", "Edit", "fa-sliders"],
    ["create", "Create", "fa-plus"],
  ] as const) {
    const button = element("button");
    button.type = "button";
    button.dataset.d6e2ProfileAction = action;
    const iconElement = element("i", `fa-solid ${icon}`);
    iconElement.setAttribute("aria-hidden", "true");
    button.append(
      iconElement,
      element(
        "span",
        undefined,
        localized(`D6E2.Settings.SettingProfile.${key}`),
      ),
    );
    actions.append(button);
  }
  actions.append(
    buildManageMenu("setting", [
      [
        "duplicate",
        "fa-copy",
        localized("D6E2.Settings.SettingProfile.Duplicate"),
      ],
      [
        "import",
        "fa-file-import",
        localized("D6E2.Settings.SettingProfile.Import"),
      ],
      [
        "export",
        "fa-file-export",
        localized("D6E2.Settings.SettingProfile.Export"),
      ],
      ["delete", "fa-trash", localized("D6E2.Settings.SettingProfile.Delete")],
    ]),
  );
  controls.append(profilePlate, actions);

  const summary = element("div", "d6e2-system-mode-summary");
  summary.append(
    element(
      "strong",
      undefined,
      localized("D6E2.Settings.SettingProfile.CurrentProfile"),
    ),
  );
  const current = element("span");
  current.dataset.d6e2CurrentSettingProfile = "";
  current.className = "d6e2-visually-hidden";
  summary.append(current);
  summary.classList.add("d6e2-visually-hidden");
  section.append(header, controls, summary);

  select.addEventListener("change", () => {
    const requestedProfileId = select.value;
    updateSettingProfileSetup(category, true);
    void activateSettingProfile(requestedProfileId)
      .catch(() =>
        ui.notifications.warn(
          localized("D6E2.Settings.SettingProfile.SelectValidationFailed"),
        ),
      )
      .finally(() => updateSettingProfileSetup(category));
  });
  section.addEventListener("click", (event) => {
    const action = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-d6e2-profile-action]",
    )?.dataset.d6e2ProfileAction;
    if (action === "edit") {
      new D6System2eSettingProfileApplication().render(true);
    }
    if (action === "create") {
      updateSettingProfileSetup(category, true);
      void createSettingProfile()
        .then(() => new D6System2eSettingProfileApplication().render(true))
        .catch(() =>
          ui.notifications.warn(
            localized("D6E2.Settings.SettingProfile.CreateFailed"),
          ),
        )
        .finally(() => updateSettingProfileSetup(category));
    }
    if (action === "export") {
      downloadSettingProfile();
      return;
    }
    if (action === "duplicate") {
      updateSettingProfileSetup(category, true);
      const draft = duplicateSettingProfile();
      void settingProfileAssetDiagnostics(draft)
        .then((diagnostics) => {
          if (diagnostics.length > 0)
            throw new TypeError("Setting Profile assets are unavailable.");
          return saveWorldSettingProfile(draft);
        })
        .then((profile) => activateSettingProfile(profile.id))
        .then(() =>
          ui.notifications.info(
            localized("D6E2.Settings.SettingProfile.Duplicated"),
          ),
        )
        .catch(() =>
          ui.notifications.warn(
            localized("D6E2.Settings.SettingProfile.SaveFailed"),
          ),
        )
        .finally(() => updateSettingProfileSetup(category));
      return;
    }
    if (action === "import") {
      updateSettingProfileSetup(category, true);
      void chooseSettingProfileImport()
        .then(async (value) => {
          if (value === null) return null;
          const profile = importSettingProfile(value);
          if ((await settingProfileAssetDiagnostics(profile)).length > 0) {
            throw new TypeError(
              "Imported Setting Profile assets are unavailable.",
            );
          }
          return saveWorldSettingProfile(profile);
        })
        .then((profile) =>
          profile ? activateSettingProfile(profile.id) : undefined,
        )
        .then((result) => {
          if (result)
            ui.notifications.info(
              localized("D6E2.Settings.SettingProfile.Imported"),
            );
        })
        .catch(() =>
          ui.notifications.warn(
            localized("D6E2.Settings.SettingProfile.ImportFailed"),
          ),
        )
        .finally(() => updateSettingProfileSetup(category));
      return;
    }
    if (action === "delete") {
      updateSettingProfileSetup(category, true);
      void promptSettingProfileDeletion()
        .catch(() =>
          ui.notifications.warn(
            localized("D6E2.Settings.SettingProfile.DeleteFailed"),
          ),
        )
        .finally(() => updateSettingProfileSetup(category));
      return;
    }
  });
  return section;
}

function buildRootSetup(category: HTMLElement): HTMLElement {
  const root = element("div", "d6e2-system-mode-setup");
  root.dataset.d6e2SystemModeSetup = "";
  root.append(
    buildProfilePresetSetup(category),
    buildSystemModeSetup(category),
    buildSettingProfileSetup(category),
  );
  return root;
}

export function synchronizeGameSettingsRoot(): void {
  for (const category of Array.from(
    document.querySelectorAll<HTMLElement>(
      '#settings-config [data-category="system"]',
    ),
  )) {
    updatePersonalThemeSetup(category);
    updateSystemModeSetup(category);
    updateSettingProfileSetup(category);
    updateProfilePresetSetup(category);
  }
}

export function registerGameSettingsRootEnhancement(): void {
  Hooks.on("renderSettingsConfig", (...args: unknown[]) => {
    const application = args[0] as { element?: HTMLElement } | undefined;
    const root = application?.element;
    const category = root?.querySelector<HTMLElement>(
      '[data-category="system"]',
    );
    if (!category) return;
    category.querySelector(PERSONAL_THEME_SELECTOR)?.remove();
    removeNativePersonalThemeRow(category);
    const personalTheme = buildPersonalThemeSetup(category);
    if (game.user?.isGM !== true) {
      category.prepend(personalTheme);
      return;
    }
    category.querySelector(ROOT_SELECTOR)?.remove();
    removeNativeEditionMenuRows(category);
    const rootSetup = buildRootSetup(category);
    category.prepend(rootSetup, personalTheme);
    groupCharacterTransactionSettings(category, rootSetup);
    updateSystemModeSetup(category);
    updateSettingProfileSetup(category);
    updateProfilePresetSetup(category);
  });
  Hooks.on("d6e2GameModeChanged", synchronizeGameSettingsRoot);
  Hooks.on("d6e2RulesProfileChanged", synchronizeGameSettingsRoot);
  Hooks.on("d6e2RulesProfilesChanged", synchronizeGameSettingsRoot);
  Hooks.on("d6e2SettingProfileChanged", synchronizeGameSettingsRoot);
  Hooks.on("d6e2SettingProfilesChanged", synchronizeGameSettingsRoot);
  Hooks.on("d6e2ProfilePresetChanged", synchronizeGameSettingsRoot);
  Hooks.on("d6e2ProfilePresetsChanged", synchronizeGameSettingsRoot);
  Hooks.on("d6e2ThemesChanged", synchronizeGameSettingsRoot);
}
