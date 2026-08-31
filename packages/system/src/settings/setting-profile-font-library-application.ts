import { SYSTEM_ID } from "../constants";
import {
  D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY,
  addWorldSettingProfileFont,
  availableSettingProfileFonts,
  loadSettingProfileFontForRole,
  removeWorldSettingProfileFontAndSynchronizeDrafts,
  settingProfileFontUsage,
  validLocalFontPath,
} from "./setting-profile-typography";

const FontLibraryBase = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function settingProfileLabel(profileId: string): string {
  const stored = record(game.settings.get(SYSTEM_ID, "worldSettingProfiles"));
  const profile = record(record(stored.profiles)[profileId]);
  return typeof profile.label === "string" && profile.label.trim()
    ? profile.label.trim()
    : profileId;
}

function moduleTitle(ownerId: string): string {
  const modules = (
    game as typeof game & {
      readonly modules?: ReadonlyMap<string, { readonly title?: string }>;
    }
  ).modules;
  return modules?.get(ownerId)?.title ?? ownerId;
}

function updateAddFontDialogValidity(root: HTMLElement): void {
  const label = root.querySelector<HTMLInputElement>('input[name="fontLabel"]');
  const display = root.querySelector<HTMLInputElement>(
    'input[name="fontDisplay"]',
  );
  const body = root.querySelector<HTMLInputElement>('input[name="fontBody"]');
  const acknowledgement = root.querySelector<HTMLInputElement>(
    'input[name="fontAcknowledgement"]',
  );
  const add = root.querySelector<HTMLButtonElement>(
    'button[data-action="add"]',
  );
  const roleError = root.querySelector<HTMLElement>("[data-font-role-error]");
  const hasRole = display?.checked === true || body?.checked === true;
  const valid = Boolean(
    label?.value.trim() && hasRole && acknowledgement?.checked,
  );
  if (add) {
    add.disabled = !valid;
    add.setAttribute("aria-disabled", String(!valid));
  }
  if (roleError) {
    roleError.textContent = hasRole
      ? ""
      : game.i18n.localize(
          "D6E2.Settings.SettingProfile.Typography.ChooseRole",
        );
  }
}

export class D6System2eFontLibraryApplication extends FontLibraryBase {
  static override PARTS = {
    form: {
      template: `systems/${SYSTEM_ID}/templates/settings/setting-profile-font-library.hbs`,
    },
  };

  static readonly #add = async function (
    this: D6System2eFontLibraryApplication,
  ): Promise<void> {
    const picker = new foundry.applications.apps.FilePicker.implementation({
      callback: async (path) => {
        if (!validLocalFontPath(path)) {
          ui.notifications.warn(
            game.i18n.localize(
              "D6E2.Settings.SettingProfile.Typography.InvalidFont",
            ),
          );
          return;
        }
        let preview: FontFace;
        try {
          preview = new FontFace(
            "d6e2-local-font-preview",
            `url("${foundry.utils.getRoute(path)}")`,
          );
          await preview.load();
          (document.fonts as FontFaceSet & { add(face: FontFace): void }).add(
            preview,
          );
        } catch {
          ui.notifications.warn(
            game.i18n.localize(
              "D6E2.Settings.SettingProfile.Typography.FontLoadFailed",
            ),
          );
          return;
        }
        try {
          const selected = await foundry.applications.api.DialogV2.wait<{
            acknowledged: boolean;
            label: string;
            roles: readonly ("body" | "display")[];
          } | null>({
            buttons: [
              {
                action: "cancel",
                callback: () => null,
                label: game.i18n.localize("D6E2.Cancel"),
              },
              {
                action: "add",
                callback: (_event, button) => {
                  const label = button.form?.elements.namedItem("fontLabel");
                  const body = button.form?.elements.namedItem("fontBody");
                  const display =
                    button.form?.elements.namedItem("fontDisplay");
                  const acknowledgement = button.form?.elements.namedItem(
                    "fontAcknowledgement",
                  );
                  return {
                    acknowledged:
                      acknowledgement instanceof HTMLInputElement &&
                      acknowledgement.checked,
                    label:
                      label instanceof HTMLInputElement
                        ? label.value.trim()
                        : "",
                    roles: [
                      ...(display instanceof HTMLInputElement && display.checked
                        ? (["display"] as const)
                        : []),
                      ...(body instanceof HTMLInputElement && body.checked
                        ? (["body"] as const)
                        : []),
                    ],
                  };
                },
                class: "od6roll-submit",
                default: true,
                label: game.i18n.localize(
                  "D6E2.Settings.SettingProfile.Typography.Add",
                ),
              },
            ],
            classes: ["d6e2", "od6roll-dialog", "d6e2-font-add-dialog"],
            content: `<div class="od6-dialog-shell d6e2-font-add-flow"><p>${escapeHtml(game.i18n.localize("D6E2.Settings.SettingProfile.Typography.LicensingHelp"))}</p><div class="d6e2-font-add-preview" style="font-family: 'd6e2-local-font-preview', sans-serif"><small>${escapeHtml(game.i18n.localize("D6E2.Settings.SettingProfile.Typography.PreviewLabel"))}</small><strong>Open D6 · 3D+2</strong><span>${escapeHtml(game.i18n.localize("D6E2.Settings.SettingProfile.Typography.PreviewSample"))}</span></div><label><span>${escapeHtml(game.i18n.localize("D6E2.Settings.SettingProfile.Typography.FontLabel"))}</span><input name="fontLabel" required></label><label><span>${escapeHtml(game.i18n.localize("D6E2.Settings.SettingProfile.Typography.FontFile"))}</span><input value="${escapeHtml(path)}" readonly></label><fieldset><legend>${escapeHtml(game.i18n.localize("D6E2.Settings.SettingProfile.Typography.RecommendedUse"))}</legend><div class="d6e2-font-role-options" role="group" aria-describedby="d6e2-font-role-error"><label><input type="checkbox" name="fontDisplay" checked> ${escapeHtml(game.i18n.localize("D6E2.Settings.SettingProfile.Typography.display"))}</label><label><input type="checkbox" name="fontBody"> ${escapeHtml(game.i18n.localize("D6E2.Settings.SettingProfile.Typography.body"))}</label></div><small id="d6e2-font-role-error" class="d6e2-font-role-error" data-font-role-error aria-live="polite"></small></fieldset><p>${escapeHtml(game.i18n.localize("D6E2.Settings.SettingProfile.Typography.FallbackHelp"))}</p><label class="d6e2-font-license-confirmation"><input type="checkbox" name="fontAcknowledgement" required> <span>${escapeHtml(game.i18n.localize("D6E2.Settings.SettingProfile.Typography.Acknowledgement"))}</span></label><p>${escapeHtml(game.i18n.localize("D6E2.Settings.SettingProfile.Typography.PortabilityHelp"))}</p><p class="d6e2-font-load-status" aria-live="polite"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> ${escapeHtml(game.i18n.localize("D6E2.Settings.SettingProfile.Typography.LoadedBeforeAdd"))}</p></div>`,
            modal: true,
            position: { width: 520 },
            rejectClose: false,
            render: (_event, dialog) => {
              const update = () => updateAddFontDialogValidity(dialog.element);
              dialog.element.addEventListener("change", update);
              dialog.element.addEventListener("input", update);
              update();
              dialog.element
                .querySelector<HTMLInputElement>('input[name="fontLabel"]')
                ?.focus();
            },
            window: {
              title: game.i18n.localize(
                "D6E2.Settings.SettingProfile.Typography.AddLocal",
              ),
            },
          });
          if (!selected) return;
          if (
            !selected.acknowledged ||
            !selected.label ||
            selected.roles.length === 0
          ) {
            ui.notifications.warn(
              game.i18n.localize(
                "D6E2.Settings.SettingProfile.Typography.InvalidFont",
              ),
            );
            return;
          }
          const added = await addWorldSettingProfileFont({
            label: selected.label,
            path,
            roles: selected.roles,
          });
          await this.render({ force: true });
          this.element
            .querySelector<HTMLElement>(`[data-font-ref="world/${added.id}"]`)
            ?.focus();
        } catch {
          ui.notifications.error(
            game.i18n.localize(
              "D6E2.Settings.SettingProfile.Typography.AddFailed",
            ),
          );
        } finally {
          (
            document.fonts as FontFaceSet & { delete(face: FontFace): boolean }
          ).delete(preview);
        }
      },
      current: "",
      document: this,
      type: "any" as never,
    });
    await picker.browse();
  };

  static readonly #remove = async function (
    this: D6System2eFontLibraryApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const ref = target.dataset.fontRef ?? "";
    const font = availableSettingProfileFonts().find(
      (entry) => entry.ref === ref,
    );
    if (font?.source !== "world") return;
    const usages = settingProfileFontUsage(ref);
    const usedRoles = (["display", "body"] as const).filter((role) =>
      usages.some((usage) => usage.role === role),
    );
    const replacementFields = usedRoles
      .map((role) => {
        const options = availableSettingProfileFonts()
          .filter((entry) => entry.ref !== ref && entry.roles.includes(role))
          .map(
            (entry) =>
              `<option value="${escapeHtml(entry.ref)}"${entry.ref === D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY[role] ? " selected" : ""}>${escapeHtml(entry.label)}</option>`,
          )
          .join("");
        return `<label><span>${escapeHtml(game.i18n.localize(`D6E2.Settings.SettingProfile.Typography.${role}`))}</span><select name="replacement.${role}" required>${options}</select></label>`;
      })
      .join("");
    const usageList = usages.length
      ? `<ul class="d6e2-font-library-usage-list">${usages
          .map(
            ({ profileId, role }) =>
              `<li><strong>${escapeHtml(settingProfileLabel(profileId))}</strong><span>${escapeHtml(game.i18n.localize(`D6E2.Settings.SettingProfile.Typography.${role}`))}</span></li>`,
          )
          .join("")}</ul>`
      : `<p>${escapeHtml(game.i18n.localize("D6E2.Settings.SettingProfile.Typography.Unused"))}</p>`;
    const replacements = await foundry.applications.api.DialogV2.wait<Readonly<
      Partial<Record<"body" | "display", string>>
    > | null>({
      buttons: [
        {
          action: "cancel",
          callback: () => null,
          label: game.i18n.localize("D6E2.Cancel"),
        },
        {
          action: "remove",
          callback: (_event, button) =>
            Object.fromEntries(
              usedRoles.map((role) => {
                const control = button.form?.elements.namedItem(
                  `replacement.${role}`,
                );
                return [
                  role,
                  control instanceof HTMLSelectElement ? control.value : "",
                ];
              }),
            ),
          class: "od6roll-submit",
          default: true,
          label: game.i18n.localize(
            usages.length
              ? "D6E2.Settings.SettingProfile.Typography.ReplaceRemove"
              : "D6E2.Settings.SettingProfile.Typography.Remove",
          ),
        },
      ],
      classes: ["d6e2", "od6roll-dialog", "d6e2-confirm-dialog"],
      content: `<div class="od6-dialog-shell d6e2-font-remove-flow"><header><strong>${escapeHtml(font.label)}</strong><small>${escapeHtml(font.path ?? "")}</small></header>${usageList}${replacementFields}</div>`,
      modal: true,
      position: { width: 520 },
      rejectClose: false,
      window: {
        title: game.i18n.localize(
          "D6E2.Settings.SettingProfile.Typography.Remove",
        ),
      },
    });
    if (!replacements) return;
    const localRefs = availableSettingProfileFonts()
      .filter((entry) => entry.source === "world")
      .map((entry) => entry.ref);
    const index = localRefs.indexOf(ref);
    const focusRef = localRefs[index + 1] ?? localRefs[index - 1];
    try {
      await removeWorldSettingProfileFontAndSynchronizeDrafts(
        ref,
        replacements,
      );
      await this.render({ force: true });
      const focusTarget = focusRef
        ? this.element.querySelector<HTMLElement>(
            `[data-font-ref="${focusRef}"]`,
          )
        : this.element.querySelector<HTMLElement>("[data-action='addFont']");
      focusTarget?.focus();
    } catch {
      ui.notifications.error(
        game.i18n.localize(
          "D6E2.Settings.SettingProfile.Typography.RemoveFailed",
        ),
      );
      target.focus();
    }
  };

  static override DEFAULT_OPTIONS = {
    actions: { addFont: this.#add, removeFont: this.#remove },
    classes: ["d6e2", "d6e2-font-library"],
    id: "d6e2-font-library",
    position: { height: 640, width: 720 },
    window: {
      icon: "fa-solid fa-font",
      resizable: true,
      title: "D6E2.Settings.SettingProfile.Typography.Manage",
    },
  };

  override async _prepareContext(): Promise<Record<string, unknown>> {
    const fonts = availableSettingProfileFonts();
    const map = async (source: "module" | "system" | "world") =>
      await Promise.all(
        fonts
          .filter((font) => font.source === source)
          .map(async (font) => {
            const role = font.roles.includes("display") ? "display" : "body";
            const loaded = await loadSettingProfileFontForRole(font.ref, role);
            return {
              ...font,
              available: loaded.available,
              roleLabels: font.roles.map((fontRole) =>
                game.i18n.localize(
                  `D6E2.Settings.SettingProfile.Typography.${fontRole}`,
                ),
              ),
              sampleStyle: `--d6e2-font-library-sample: ${loaded.family}`,
              status: game.i18n.localize(
                loaded.available
                  ? "D6E2.Settings.SettingProfile.Typography.Available"
                  : "D6E2.Settings.SettingProfile.Typography.LoadUnavailable",
              ),
              statusClass: loaded.available ? "is-available" : "is-unavailable",
              statusIcon: loaded.available
                ? "fa-solid fa-circle-check"
                : "fa-solid fa-triangle-exclamation",
              usageCount: settingProfileFontUsage(font.ref).length,
            };
          }),
      );
    const moduleFonts = await map("module");
    const moduleProviders = [
      ...new Set(moduleFonts.map(({ ownerId }) => ownerId)),
    ].map((ownerId) => ({
      fonts: moduleFonts.filter((font) => font.ownerId === ownerId),
      label: moduleTitle(ownerId),
    }));
    return {
      builtInFonts: await map("system"),
      localFonts: await map("world"),
      moduleProviders,
    };
  }
}
