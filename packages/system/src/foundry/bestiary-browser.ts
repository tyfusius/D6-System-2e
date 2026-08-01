import { formatPipScore } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { bestiaryRegistry } from "../registries/bestiary";

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

function issueLabel(issue: string): string {
  return game.i18n.localize(`D6E2.Bestiary.Issue.${issue}`);
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
    position: { height: "auto", width: 640 },
    window: {
      icon: "fa-solid fa-dragon",
      resizable: true,
      title: "D6E2.Bestiary.Title",
    },
  };

  readonly #clickHandler = (event: Event): void => {
    const target = event.target;
    if (target instanceof HTMLElement) void this.#click(target);
  };

  override _prepareContext(): Promise<Record<string, unknown>> {
    if (game.user?.isGM !== true) {
      return Promise.resolve({ catalogs: [], entryCount: 0, isGm: false });
    }
    const catalogs = bestiaryRegistry.current().map((catalog) => ({
      ...catalog,
      entries: catalog.entries.map((entry) => {
        const preview = game.system.api?.bestiary.preview(entry.id);
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
          issueLabels: (preview?.issues ?? []).map(issueLabel),
          itemCount: preview?.itemAdditions.length ?? 0,
          magicPoints: preview?.magicPoints ?? 0,
          scale: preview?.scale ?? 0,
        };
      }),
    }));
    return Promise.resolve({
      catalogs,
      entryCount: catalogs.reduce(
        (total, catalog) => total + catalog.entries.length,
        0,
      ),
      isGm: true,
      sourceReference: "D6 System: Second Edition, pp. 165–167",
    });
  }

  override async _onRender(
    context: Record<string, unknown>,
    options: { readonly parts: readonly string[] },
  ): Promise<void> {
    await super._onRender(context, options);
    this.element.removeEventListener("click", this.#clickHandler);
    this.element.addEventListener("click", this.#clickHandler);
  }

  async #click(target: HTMLElement): Promise<void> {
    const control = target.closest<HTMLElement>("[data-action]");
    if (!control || game.user?.isGM !== true) return;
    if (control.dataset.action !== "createCreature") return;
    const entryId = control.dataset.entryId ?? "";
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
}

let browser: D6System2eBestiaryBrowser | undefined;

export function toggleD6BestiaryBrowser(): void {
  if (game.user?.isGM !== true) return;
  if (browser?.rendered) void browser.close();
  else {
    browser ??= new D6System2eBestiaryBrowser();
    browser.render({ force: true });
  }
}

function refresh(): void {
  if (game.user?.isGM !== true && browser?.rendered) void browser.close();
  else if (browser?.rendered) browser.render();
  ui.controls?.render({ reset: true });
}

export function registerD6BestiaryBrowser(): void {
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
      title: game.i18n.localize("D6E2.Bestiary.Title"),
    };
  });
  Hooks.on("d6e2BestiaryChanged", refresh);
}
