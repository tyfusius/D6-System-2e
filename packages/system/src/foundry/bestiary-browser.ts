import { formatPipScore, type D6BestiaryPreviewV1 } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { bestiaryRegistry } from "../registries/bestiary";
import { bestiaryProfileFacets } from "./bestiary-browser-model";
import { registerSceneControlApplicationButton } from "./scene-control-application-buttons";
import {
  bestiaryCreatureLabel,
  bestiaryDocumentAccess,
  createWorldCatalogCreature,
  currentWorldBestiaryCatalog,
  deleteBestiaryDocument,
  duplicateBestiaryDocument,
  openBestiaryDocument,
  refreshBestiaryDocuments,
  removeBestiaryDocument,
  restoreBestiaryDocument,
} from "./bestiary-document-repository";

const { ApplicationV2 } = foundry.applications.api;
const BestiaryApplication =
  foundry.applications.api.HandlebarsApplicationMixin.bind(
    foundry.applications.api,
  )(ApplicationV2);

interface SceneControlTool {
  readonly active?: boolean;
  readonly button?: boolean;
  readonly icon: string;
  readonly name: string;
  readonly onChange: () => void;
  readonly order?: number;
  readonly title: string;
}

interface SceneControls {
  readonly tokens?: { readonly tools: Record<string, SceneControlTool> };
}

function htmlEscape(value: string): string {
  const node = document.createElement("span");
  node.textContent = value;
  return node.innerHTML;
}

function issueLabel(issue: string, preview: D6BestiaryPreviewV1): string {
  if (issue === "rules-profile-incompatible") {
    const target =
      preview.rulesProfile.suggested?.label ??
      game.i18n.localize("D6E2.Bestiary.ProfileCompatibleGeneric");
    return game.i18n.format("D6E2.Bestiary.Issue.rules-profile-incompatible", {
      current: preview.rulesProfile.active.label,
      target,
    });
  }
  if (issue === "setting-profile-incompatible") {
    const target =
      preview.settingProfile.suggested?.label ??
      game.i18n.localize("D6E2.Bestiary.ProfileCompatibleGeneric");
    return game.i18n.format(
      "D6E2.Bestiary.Issue.setting-profile-incompatible",
      {
        current: preview.settingProfile.active.label,
        target,
      },
    );
  }
  return game.i18n.localize(`D6E2.Bestiary.Issue.${issue}`);
}

async function confirmRulesProfileSwitch(
  current: string,
  target: string,
): Promise<boolean> {
  return (
    (await foundry.applications.api.DialogV2.wait<boolean>({
      buttons: [
        {
          action: "cancel",
          callback: () => false,
          label: game.i18n.localize("D6E2.Cancel"),
        },
        {
          action: "switch",
          callback: () => true,
          class: "od6roll-submit",
          default: true,
          icon: "fa-solid fa-shuffle",
          label: game.i18n.localize("D6E2.Bestiary.ProfileSwitchAction"),
        },
      ],
      classes: ["d6e2", "od6roll-dialog", "d6e2-confirm-dialog"],
      content: `<div class="od6-dialog-shell"><p>${game.i18n.format("D6E2.Bestiary.ProfileSwitchConfirm", { current: htmlEscape(current), target: htmlEscape(target) })}</p><p>${game.i18n.localize("D6E2.Bestiary.ProfileSwitchConsequences")}</p></div>`,
      modal: true,
      position: { width: 520 },
      rejectClose: false,
      window: {
        icon: "fa-solid fa-shuffle",
        title: game.i18n.localize("D6E2.Bestiary.ProfileSwitchTitle"),
      },
    })) === true
  );
}

async function confirmCatalogAction(
  titleKey: string,
  bodyKey: string,
  actionKey: string,
  name: string,
  danger = false,
): Promise<boolean> {
  return (
    (await foundry.applications.api.DialogV2.wait<boolean>({
      buttons: [
        {
          action: "cancel",
          callback: () => false,
          label: game.i18n.localize("D6E2.Cancel"),
        },
        {
          action: "confirm",
          callback: () => true,
          class: danger ? "d6e2-danger-action" : "od6roll-submit",
          default: !danger,
          icon: danger ? "fa-solid fa-trash" : "fa-solid fa-box-archive",
          label: game.i18n.localize(actionKey),
        },
      ],
      classes: ["d6e2", "od6roll-dialog", "d6e2-confirm-dialog"],
      content: `<div class="od6-dialog-shell"><p>${game.i18n.format(bodyKey, { name: htmlEscape(name) })}</p></div>`,
      modal: true,
      position: { width: 460 },
      rejectClose: false,
      window: {
        icon: danger ? "fa-solid fa-trash" : "fa-solid fa-box-archive",
        title: game.i18n.localize(titleKey),
      },
    })) === true
  );
}

class D6System2eBestiaryBrowser extends BestiaryApplication {
  static override PARTS = {
    content: {
      template: `systems/${SYSTEM_ID}/templates/apps/bestiary-browser.hbs`,
    },
  };

  static override DEFAULT_OPTIONS = {
    classes: ["d6-system-2e", "d6e2-bestiary-browser"],
    id: "d6e2-bestiary-browser",
    position: { height: "auto", width: 880 },
    window: {
      icon: "fa-solid fa-dragon",
      resizable: true,
      title: "D6E2.Bestiary.WindowTitle",
    },
  };

  readonly #clickHandler = (event: Event): void => {
    const target = event.target;
    if (target instanceof HTMLElement) void this.#click(target);
  };

  readonly #inputHandler = (event: Event): void => {
    if (event.target instanceof HTMLInputElement) this.#applyFilters();
  };

  #profileFilterId = "";
  #showRemoved = false;

  resetFilters(): void {
    this.#profileFilterId = "";
  }

  override async _prepareContext(): Promise<Record<string, unknown>> {
    if (game.user?.isGM !== true) {
      return { catalogs: [], entryCount: 0, isGm: false };
    }
    await refreshBestiaryDocuments();
    const previews: D6BestiaryPreviewV1[] = [];
    const worldCatalog = currentWorldBestiaryCatalog();
    const registeredCatalogs = [
      ...bestiaryRegistry.current(),
      ...(worldCatalog ? [worldCatalog] : []),
    ];
    const allCatalogs = registeredCatalogs.map((catalog) => {
      const entries = catalog.entries.map((entry) => {
        const preview = game.system.api?.bestiary.preview(entry.id);
        const documentAccess = bestiaryDocumentAccess(entry.id);
        const removed = documentAccess?.listed === false;
        if (preview && (!removed || this.#showRemoved)) previews.push(preview);
        const issueLabels = preview
          ? preview.issues.map((issue) => issueLabel(issue, preview))
          : [];
        const profileSwitch =
          preview &&
          (!preview.rulesProfile.compatible ||
            !preview.settingProfile.compatible) &&
          preview.rulesProfile.suggested &&
          preview.settingProfile.suggested
            ? {
                label: `${preview.rulesProfile.suggested.label} + ${preview.settingProfile.suggested.label}`,
                rulesProfileId: preview.rulesProfile.suggested.id,
                settingProfileId: preview.settingProfile.suggested.id,
              }
            : null;
        return {
          ...entry,
          attributes: (preview?.attributeScores ?? []).map((attribute) => ({
            ...attribute,
            label: game.i18n.localize(
              `D6E2.Attribute.${attribute.attributeId[0]?.toUpperCase() ?? ""}${attribute.attributeId.slice(1)}`,
            ),
            scoreLabel: formatPipScore(attribute.score),
          })),
          canCreate: preview?.canCreate === true,
          defenseOverrides: preview?.defenseOverrides ?? entry.defenseOverrides,
          issueTooltip: issueLabels.length
            ? game.i18n.format("D6E2.Bestiary.ProfileRequirements", {
                count: issueLabels.length,
                issues: issueLabels.join(" • "),
              })
            : "",
          itemCount: preview?.itemAdditions.length ?? 0,
          magicPoints: preview?.magicPoints ?? 0,
          profileSwitch,
          compatibleProfileIds:
            preview?.rulesProfile.options.map(({ id }) => id).join(" ") ?? "",
          scale: preview?.scale ?? 0,
          documentAccess,
          hasManageActions: documentAccess !== null || profileSwitch !== null,
          canEditSource: documentAccess?.editable === true,
          removed,
          worldOwned: documentAccess?.worldOwned === true,
        };
      });
      return {
        ...catalog,
        entries,
        isWorldCatalog: catalog.ownerId === "world",
      };
    });
    const removedCount = allCatalogs.reduce(
      (total, catalog) =>
        total + catalog.entries.filter((entry) => entry.removed).length,
      0,
    );
    const catalogs = allCatalogs.map((catalog) => ({
      ...catalog,
      entries: catalog.entries.filter(
        (entry) => this.#showRemoved || !entry.removed,
      ),
    }));
    const profileFacets = bestiaryProfileFacets(previews);
    const activeProfile = previews[0]?.rulesProfile.active;
    if (
      !this.#profileFilterId ||
      !profileFacets.some(({ id }) => id === this.#profileFilterId)
    ) {
      this.#profileFilterId = activeProfile?.id ?? "*";
    }
    const entryCount = catalogs.reduce(
      (total, catalog) => total + catalog.entries.length,
      0,
    );
    const visibleEntryCount = catalogs.reduce(
      (total, catalog) =>
        total +
        catalog.entries.filter((entry) =>
          this.#profileFilterId === "*"
            ? true
            : entry.compatibleProfileIds
                .split(" ")
                .includes(this.#profileFilterId),
        ).length,
      0,
    );
    const creature = bestiaryCreatureLabel("singular");
    const creatures = bestiaryCreatureLabel("plural");
    return {
      catalogs,
      activeProfile,
      allProfilesSelected: this.#profileFilterId === "*",
      entryCount,
      isGm: true,
      profileFacets: profileFacets.map((facet) => ({
        ...facet,
        selected: facet.id === this.#profileFilterId,
      })),
      sourceReference: "D6 System: Second Edition, pp. 165–167",
      removedCount,
      showRemoved: this.#showRemoved,
      visibleEntryCount,
      vocabulary: {
        filters: game.i18n.format("D6E2.Bestiary.Filters", { creatures }),
        help: game.i18n.format("D6E2.Bestiary.Help", {
          creature,
          creatures,
        }),
        newCreature: game.i18n.format("D6E2.Bestiary.NewCreature", {
          creature,
        }),
        title: game.i18n.format("D6E2.Bestiary.Title", { creatures }),
      },
    };
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
    this.#applyFilters();
  }

  #applyFilters(): void {
    const query =
      this.element
        .querySelector<HTMLInputElement>("[data-bestiary-search]")
        ?.value.trim()
        .toLocaleLowerCase() ?? "";
    let visibleCount = 0;
    for (const entry of Array.from(
      this.element.querySelectorAll<HTMLElement>(".d6e2-bestiary-entry"),
    )) {
      const profileIds = (entry.dataset.profileIds ?? "").split(" ");
      const profileMatches =
        this.#profileFilterId === "*" ||
        profileIds.includes(this.#profileFilterId);
      const queryMatches =
        !query || entry.innerText.toLocaleLowerCase().includes(query);
      const visible = profileMatches && queryMatches;
      entry.hidden = !visible;
      if (visible) visibleCount += 1;
    }
    for (const catalog of Array.from(
      this.element.querySelectorAll<HTMLElement>(".d6e2-bestiary-catalog"),
    )) {
      catalog.hidden =
        catalog.querySelector(".d6e2-bestiary-entry:not([hidden])") === null;
    }
    for (const control of Array.from(
      this.element.querySelectorAll<HTMLElement>(
        '[data-action="filterProfile"]',
      ),
    )) {
      control.setAttribute(
        "aria-pressed",
        String(control.dataset.profileId === this.#profileFilterId),
      );
    }
    const count = this.element.querySelector<HTMLElement>(
      "[data-bestiary-visible-count]",
    );
    if (count) count.textContent = String(visibleCount);
    const empty = this.element.querySelector<HTMLElement>(
      "[data-bestiary-no-results]",
    );
    if (empty) empty.hidden = visibleCount > 0;
  }

  async #click(target: HTMLElement): Promise<void> {
    const control = target.closest<HTMLElement>("[data-action]");
    if (!control || game.user?.isGM !== true) return;
    if (control.dataset.action === "filterProfile") {
      this.#profileFilterId = control.dataset.profileId ?? "*";
      this.#applyFilters();
      return;
    }
    if (control.dataset.action === "toggleRemovedCreatures") {
      this.#showRemoved = !this.#showRemoved;
      await this.render({ force: true });
      return;
    }
    if (control.dataset.action === "newCatalogCreature") {
      try {
        const document = await createWorldCatalogCreature();
        document.sheet.render(true);
        ui.notifications.info(
          game.i18n.localize("D6E2.Bestiary.CatalogCreatureCreated"),
        );
        await this.render({ force: true });
      } catch (error) {
        this.#notifyError(error, "D6E2.Bestiary.CreationFailed");
      }
      return;
    }
    const entryId = control.dataset.entryId ?? "";
    const entryName = control.dataset.entryName ?? entryId;
    if (control.dataset.action === "openCreatureSource") {
      try {
        openBestiaryDocument(entryId);
      } catch (error) {
        this.#notifyError(error, "D6E2.Bestiary.SourceUnavailable");
      }
      return;
    }
    if (
      control.dataset.action === "duplicateCreature" ||
      control.dataset.action === "copyCreatureToProfiles"
    ) {
      try {
        const document = await duplicateBestiaryDocument(
          entryId,
          control.dataset.action === "copyCreatureToProfiles",
        );
        document.sheet.render(true);
        ui.notifications.info(
          game.i18n.localize("D6E2.Bestiary.CopiedToWorldCatalog"),
        );
        await this.render({ force: true });
      } catch (error) {
        this.#notifyError(error, "D6E2.Bestiary.SourceUnavailable");
      }
      return;
    }
    if (control.dataset.action === "removeCreatureFromCatalog") {
      if (
        !(await confirmCatalogAction(
          "D6E2.Bestiary.RemoveTitle",
          "D6E2.Bestiary.RemoveConfirm",
          "D6E2.Bestiary.Remove",
          entryName,
        ))
      )
        return;
      try {
        await removeBestiaryDocument(entryId);
        ui.notifications.info(game.i18n.localize("D6E2.Bestiary.Removed"));
      } catch (error) {
        this.#notifyError(error, "D6E2.Bestiary.ProtectedSource");
      }
      return;
    }
    if (control.dataset.action === "restoreCatalogCreature") {
      try {
        await restoreBestiaryDocument(entryId);
        ui.notifications.info(game.i18n.localize("D6E2.Bestiary.Restored"));
      } catch (error) {
        this.#notifyError(error, "D6E2.Bestiary.ProtectedSource");
      }
      return;
    }
    if (control.dataset.action === "deleteCatalogCreature") {
      if (
        !(await confirmCatalogAction(
          "D6E2.Bestiary.DeleteTitle",
          "D6E2.Bestiary.DeleteConfirm",
          "D6E2.Bestiary.Delete",
          entryName,
          true,
        ))
      )
        return;
      try {
        await deleteBestiaryDocument(entryId);
        ui.notifications.info(game.i18n.localize("D6E2.Bestiary.Deleted"));
      } catch (error) {
        this.#notifyError(error, "D6E2.Bestiary.ProtectedSource");
      }
      return;
    }
    if (control.dataset.action === "switchProfiles") {
      const preview = game.system.api?.bestiary.preview(entryId);
      const requested = control.dataset.rulesProfileId ?? "";
      const requestedSetting = control.dataset.settingProfileId ?? "";
      const targetProfile = preview?.rulesProfile.options.find(
        ({ id }) => id === requested,
      );
      const targetSetting = preview?.settingProfile.suggested;
      if (
        !preview ||
        !targetProfile ||
        targetSetting?.id !== requestedSetting
      ) {
        ui.notifications.warn(
          game.i18n.localize("D6E2.Bestiary.ProfileUnavailable"),
        );
        return;
      }
      const confirmed = await confirmRulesProfileSwitch(
        `${preview.rulesProfile.active.label} + ${preview.settingProfile.active.label}`,
        `${targetProfile.label} + ${targetSetting.label}`,
      );
      if (!confirmed) return;
      control.setAttribute("aria-busy", "true");
      if (control instanceof HTMLButtonElement) control.disabled = true;
      try {
        await game.system.api?.bestiary.activateProfiles(
          entryId,
          targetProfile.id,
          targetSetting.id,
        );
        ui.notifications.info(
          game.i18n.format("D6E2.Bestiary.ProfileSwitched", {
            profile: `${targetProfile.label} + ${targetSetting.label}`,
          }),
        );
        await this.render({ force: true });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "D6E2.Bestiary.ProfileUnavailable";
        ui.notifications.warn(
          message.startsWith("D6E2.") ? game.i18n.localize(message) : message,
        );
      } finally {
        control.removeAttribute("aria-busy");
        if (control instanceof HTMLButtonElement) control.disabled = false;
      }
      return;
    }
    if (control.dataset.action !== "createCreature") return;
    control.setAttribute("aria-busy", "true");
    if (control instanceof HTMLButtonElement) control.disabled = true;
    try {
      const result = await game.system.api?.bestiary.create(entryId);
      const actor = result ? game.actors?.get(result.actorId) : undefined;
      actor?.sheet.render(true);
      ui.notifications.info(game.i18n.localize("D6E2.Bestiary.Created"));
      this.render();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "D6E2.Bestiary.CreationFailed";
      ui.notifications.warn(
        message.startsWith("D6E2.") ? game.i18n.localize(message) : message,
      );
    } finally {
      control.removeAttribute("aria-busy");
      if (control instanceof HTMLButtonElement) control.disabled = false;
    }
  }

  #notifyError(error: unknown, fallback: string): void {
    const message = error instanceof Error ? error.message : fallback;
    ui.notifications.warn(
      message.startsWith("D6E2.") ? game.i18n.localize(message) : message,
    );
  }
}

let browser: D6System2eBestiaryBrowser | undefined;

export function toggleD6BestiaryBrowser(): void {
  if (game.user?.isGM !== true) return;
  if (browser?.rendered) void browser.close();
  else {
    browser ??= new D6System2eBestiaryBrowser();
    browser.resetFilters();
    browser.render({ force: true });
  }
}

function refresh(): void {
  if (game.user?.isGM !== true && browser?.rendered) void browser.close();
  else if (browser?.rendered) browser.render();
  ui.controls?.render({ reset: true });
}

function refreshForProfileChange(): void {
  browser?.resetFilters();
  refresh();
}

export function registerD6BestiaryBrowser(): void {
  registerSceneControlApplicationButton(
    "d6System2eBestiary",
    toggleD6BestiaryBrowser,
  );
  Hooks.on("getSceneControlButtons", (value: unknown) => {
    if (game.user?.isGM !== true) return;
    const tools = (value as SceneControls).tokens?.tools;
    if (!tools) return;
    tools.d6System2eBestiary = {
      active: browser?.rendered === true,
      button: true,
      icon: "fa-solid fa-dragon",
      name: "d6System2eBestiary",
      onChange: toggleD6BestiaryBrowser,
      order: Object.keys(tools).length,
      title: game.i18n.format("D6E2.Bestiary.Title", {
        creatures: bestiaryCreatureLabel("plural"),
      }),
    };
  });
  Hooks.on("d6e2BestiaryChanged", refresh);
  Hooks.on("d6e2RulesProfileChanged", refreshForProfileChange);
  Hooks.on("d6e2SettingProfileChanged", refreshForProfileChange);
  Hooks.on("d6e2ProfilePresetChanged", refreshForProfileChange);
}
