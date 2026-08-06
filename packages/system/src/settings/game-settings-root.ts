import { SYSTEM_ID } from "../constants";
import { currentRulesProfile } from "./rules-compatibility";
import { applyGameMode, currentGameMode, type GameMode } from "./game-mode";

const ROOT_SELECTOR = "[data-d6e2-system-mode-setup]";
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

function modeLabel(mode: GameMode): string {
  return localized(
    mode === "open-d6"
      ? "D6E2.Settings.GameMode.OpenD6"
      : "D6E2.Settings.GameMode.SecondEdition",
  );
}

function updateMenuButton(
  category: HTMLElement,
  key: string,
  active: boolean,
): void {
  const button = category.querySelector<HTMLButtonElement>(
    `button[data-key="${key}"]`,
  );
  if (!button) return;
  button.disabled = !active;
  button.setAttribute("aria-disabled", String(!active));
  const row = button.closest<HTMLElement>(".form-group");
  row?.classList.toggle("d6e2-edition-menu-active", active);
  row?.classList.toggle("d6e2-edition-menu-inactive", !active);
}

function updateSystemModeSetup(
  category: HTMLElement,
  mode: GameMode,
  busy = false,
): void {
  const root = category.querySelector<HTMLElement>(ROOT_SELECTOR);
  if (!root) return;
  for (const button of Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-d6e2-game-mode]"),
  )) {
    const selected = button.dataset.d6e2GameMode === mode;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-checked", String(selected));
    button.disabled = busy;
  }
  const current = root.querySelector<HTMLElement>("[data-d6e2-current-mode]");
  if (current) current.textContent = modeLabel(mode);
  const resolved = root.querySelector<HTMLElement>(
    "[data-d6e2-resolved-profile]",
  );
  if (resolved) {
    const profile = currentRulesProfile();
    resolved.textContent = localized(
      profile.id === "custom"
        ? "D6E2.Settings.GameMode.ProfileCustom"
        : "D6E2.Settings.GameMode.ProfileBaseline",
    );
  }
  updateMenuButton(category, SECOND_EDITION_MENU, mode === "second-edition");
  updateMenuButton(category, FIRST_EDITION_MENU, mode === "open-d6");
}

function buildModeButton(
  mode: GameMode,
  titleKey: string,
  shortKey: string,
): HTMLButtonElement {
  const button = element("button", "d6e2-game-mode-choice");
  button.type = "button";
  button.dataset.d6e2GameMode = mode;
  button.setAttribute("role", "radio");
  button.append(
    element("strong", undefined, localized(titleKey)),
    element("small", undefined, localized(shortKey)),
  );
  return button;
}

function buildSystemModeSetup(category: HTMLElement): HTMLElement {
  const root = element("section", "d6e2-system-mode-setup");
  root.dataset.d6e2SystemModeSetup = "";
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
  selector.setAttribute("role", "radiogroup");
  selector.setAttribute("aria-label", localized("D6E2.Settings.GameMode.Name"));
  selector.append(
    buildModeButton(
      "second-edition",
      "D6E2.Settings.GameMode.SecondEdition",
      "D6E2.Settings.GameMode.SecondEditionShort",
    ),
    buildModeButton(
      "open-d6",
      "D6E2.Settings.GameMode.OpenD6",
      "D6E2.Settings.GameMode.OpenD6Short",
    ),
  );

  const summary = element("div", "d6e2-system-mode-summary");
  const summaryHeading = element(
    "strong",
    undefined,
    localized("D6E2.Settings.GameMode.CurrentSystemMode"),
  );
  const current = element("span");
  current.dataset.d6e2CurrentMode = "";
  const resolved = element("small");
  resolved.dataset.d6e2ResolvedProfile = "";
  summary.append(summaryHeading, current, resolved);

  root.append(header, selector, summary);
  root.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-d6e2-game-mode]",
    );
    if (!target || target.disabled) return;
    const requested = target.dataset.d6e2GameMode;
    if (requested !== "open-d6" && requested !== "second-edition") return;
    if (requested === currentGameMode()) return;
    updateSystemModeSetup(category, requested, true);
    void applyGameMode(requested)
      .then((result) => {
        if (result.failed.length > 0) {
          ui.notifications.warn(localized("D6E2.Settings.GameMode.SaveFailed"));
        }
      })
      .catch(() => {
        ui.notifications.warn(localized("D6E2.Settings.GameMode.SaveFailed"));
      })
      .finally(() => updateSystemModeSetup(category, currentGameMode()));
  });
  return root;
}

export function synchronizeGameSettingsRoot(): void {
  for (const category of Array.from(
    document.querySelectorAll<HTMLElement>(
      '#settings-config [data-category="system"]',
    ),
  )) {
    updateSystemModeSetup(category, currentGameMode());
  }
}

export function registerGameSettingsRootEnhancement(): void {
  Hooks.on("renderSettingsConfig", (...args: unknown[]) => {
    const application = args[0] as { element?: HTMLElement } | undefined;
    const root = application?.element;
    const category = root?.querySelector<HTMLElement>(
      '[data-category="system"]',
    );
    if (!category || game.user?.isGM !== true) return;
    category.querySelector(ROOT_SELECTOR)?.remove();
    category.prepend(buildSystemModeSetup(category));
    updateSystemModeSetup(category, currentGameMode());
  });
  Hooks.on("d6e2GameModeChanged", synchronizeGameSettingsRoot);
}
