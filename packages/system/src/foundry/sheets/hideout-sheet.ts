import { hideoutRelocationPlan } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../../constants";
import { currentSecondEditionCampaignProfile } from "../../settings/campaign-profile";
import { hideoutFeatureRegistry } from "../../registries/hideout-features";
import { openDocumentImagePicker } from "./open-document-image-picker";
import { integer, record, stringValue } from "./values";

const HideoutSheetBase = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2,
);

function html(value: string): string {
  return value.replace(
    /[&<>"']/gu,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function field(button: FoundryDialogButton, name: string): string {
  const control = button.form?.elements.namedItem(name);
  return control instanceof HTMLInputElement ||
    control instanceof HTMLTextAreaElement ||
    control instanceof HTMLSelectElement
    ? control.value.trim()
    : "";
}

export class D6System2eHideoutSheet extends HideoutSheetBase {
  static PARTS = {
    main: {
      scrollable: [""],
      template: `systems/${SYSTEM_ID}/templates/actor/hideout-sheet.hbs`,
    },
  };

  static readonly #editImage = async function (
    this: D6System2eHideoutSheet,
  ): Promise<void> {
    await openDocumentImagePicker(this.actor);
  };

  static readonly #addCustomFeature = async function (
    this: D6System2eHideoutSheet,
  ): Promise<void> {
    if (!this.isEditable || !currentSecondEditionCampaignProfile().hiddenBases)
      return;
    const result = await foundry.applications.api.DialogV2.wait<{
      label: string;
      description: string;
    } | null>({
      buttons: [
        {
          action: "cancel",
          callback: () => null,
          label: game.i18n.localize("D6E2.Cancel"),
        },
        {
          action: "add",
          callback: (_event, button) => ({
            description: field(button, "description"),
            label: field(button, "label"),
          }),
          class: "od6roll-submit",
          default: true,
          icon: "fa-solid fa-plus",
          label: game.i18n.localize("D6E2.Hideout.AddFeature"),
        },
      ],
      classes: ["d6e2", "od6roll-dialog"],
      content: `<div class="od6-dialog-shell">
        <label><span>${game.i18n.localize("D6E2.Hideout.FeatureName")}</span><input name="label" required /></label>
        <label><span>${game.i18n.localize("D6E2.Hideout.FeatureNotes")}</span><textarea name="description" rows="5"></textarea></label>
      </div>`,
      modal: true,
      rejectClose: false,
      window: {
        icon: "fa-solid fa-building-shield",
        title: game.i18n.localize("D6E2.Hideout.AddCustomFeature"),
      },
    });
    if (!result?.label) return;
    const features = records(this.actor.system.features);
    await this.actor.update({
      "system.features": [
        ...features,
        {
          catalogId: "",
          catalogVersion: 0,
          description: result.description,
          featureId: `custom.${crypto.randomUUID()}`,
          instanceId: crypto.randomUUID(),
          label: result.label,
          sourceBook: "",
          sourcePage: 0,
        },
      ],
    });
    this.render();
  };

  static readonly #addCatalogFeature = async function (
    this: D6System2eHideoutSheet,
  ): Promise<void> {
    if (!this.isEditable || !currentSecondEditionCampaignProfile().hiddenBases)
      return;
    const available = hideoutFeatureRegistry
      .current()
      .flatMap((catalog) =>
        catalog.entries.map((feature) => ({ catalog, feature })),
      );
    if (available.length === 0) {
      ui.notifications.warn(
        game.i18n.localize("D6E2.Hideout.NoCatalogFeatures"),
      );
      return;
    }
    const options = available
      .map(
        ({ feature }) =>
          `<option value="${html(feature.id)}">${html(feature.label)}</option>`,
      )
      .join("");
    const selected = await foundry.applications.api.DialogV2.wait<
      string | null
    >({
      buttons: [
        {
          action: "cancel",
          callback: () => null,
          label: game.i18n.localize("D6E2.Cancel"),
        },
        {
          action: "add",
          callback: (_event, button) => field(button, "featureId"),
          class: "od6roll-submit",
          default: true,
          icon: "fa-solid fa-plus",
          label: game.i18n.localize("D6E2.Hideout.AddFeature"),
        },
      ],
      classes: ["d6e2", "od6roll-dialog"],
      content: `<div class="od6-dialog-shell"><p>${game.i18n.localize("D6E2.Hideout.CatalogHelp")}</p><label><span>${game.i18n.localize("D6E2.Hideout.Feature")}</span><select name="featureId">${options}</select></label></div>`,
      modal: true,
      rejectClose: false,
      window: {
        icon: "fa-solid fa-box-archive",
        title: game.i18n.localize("D6E2.Hideout.AddCatalogFeature"),
      },
    });
    const resolved = available.find(({ feature }) => feature.id === selected);
    if (!resolved) return;
    const features = records(this.actor.system.features);
    const selectedIds = new Set(
      features.map((entry) => stringValue(entry.featureId)),
    );
    const missing = (resolved.feature.prerequisiteIds ?? []).filter(
      (id) => !selectedIds.has(id),
    );
    if (missing.length > 0) {
      ui.notifications.warn(
        game.i18n.format("D6E2.Hideout.MissingPrerequisite", {
          ids: missing.join(", "),
        }),
      );
      return;
    }
    if (
      resolved.feature.repeatable !== true &&
      selectedIds.has(resolved.feature.id)
    ) {
      ui.notifications.warn(game.i18n.localize("D6E2.Hideout.NotRepeatable"));
      return;
    }
    await this.actor.update({
      "system.features": [
        ...features,
        {
          catalogId: resolved.catalog.id,
          catalogVersion: resolved.catalog.version,
          description: resolved.feature.description ?? "",
          featureId: resolved.feature.id,
          instanceId: crypto.randomUUID(),
          label: resolved.feature.label,
          sourceBook: resolved.feature.source.book,
          sourcePage: resolved.feature.source.page,
        },
      ],
    });
    this.render();
  };

  static readonly #removeFeature = async function (
    this: D6System2eHideoutSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.isEditable) return;
    const instanceId =
      target.closest<HTMLElement>("[data-feature-id]")?.dataset.featureId;
    if (!instanceId) return;
    await this.actor.update({
      "system.features": records(this.actor.system.features).filter(
        (entry) => stringValue(entry.instanceId) !== instanceId,
      ),
    });
    this.render();
  };

  static readonly #addMember = async function (
    this: D6System2eHideoutSheet,
  ): Promise<void> {
    if (!this.isEditable) return;
    const members = records(this.actor.system.members);
    const ids = new Set(members.map((entry) => stringValue(entry.actorId)));
    const candidates = (game.actors?.contents ?? [])
      .filter((actor) => ["character", "creature", "npc"].includes(actor.type))
      .filter(
        (actor) =>
          !ids.has(actor.id) &&
          (game.user?.isGM === true || actor.isOwner === true),
      )
      .sort((left, right) => left.name.localeCompare(right.name));
    if (candidates.length === 0) {
      ui.notifications.warn(
        game.i18n.localize("D6E2.Hideout.NoMemberCandidates"),
      );
      return;
    }
    const options = candidates
      .map(
        (actor) =>
          `<option value="${html(actor.id)}">${html(actor.name)}</option>`,
      )
      .join("");
    const selected = await foundry.applications.api.DialogV2.wait<
      string | null
    >({
      buttons: [
        {
          action: "cancel",
          callback: () => null,
          label: game.i18n.localize("D6E2.Cancel"),
        },
        {
          action: "add",
          callback: (_event, button) => field(button, "actorId"),
          class: "od6roll-submit",
          default: true,
          icon: "fa-solid fa-user-plus",
          label: game.i18n.localize("D6E2.Hideout.AddMember"),
        },
      ],
      classes: ["d6e2", "od6roll-dialog"],
      content: `<div class="od6-dialog-shell"><label><span>${game.i18n.localize("D6E2.Hideout.Member")}</span><select name="actorId">${options}</select></label></div>`,
      modal: true,
      rejectClose: false,
      window: {
        icon: "fa-solid fa-users",
        title: game.i18n.localize("D6E2.Hideout.AddMember"),
      },
    });
    const actor = candidates.find((candidate) => candidate.id === selected);
    if (!actor) return;
    await this.actor.update({
      "system.members": [...members, { actorId: actor.id, name: actor.name }],
    });
    this.render();
  };

  static readonly #openMember = function (
    this: D6System2eHideoutSheet,
    _event: Event,
    target: HTMLElement,
  ): void {
    const actorId =
      target.closest<HTMLElement>("[data-member-id]")?.dataset.memberId;
    if (actorId) game.actors?.get(actorId)?.sheet.render(true);
  };

  static readonly #removeMember = async function (
    this: D6System2eHideoutSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.isEditable) return;
    const actorId =
      target.closest<HTMLElement>("[data-member-id]")?.dataset.memberId;
    if (!actorId) return;
    await this.actor.update({
      "system.members": records(this.actor.system.members).filter(
        (entry) => stringValue(entry.actorId) !== actorId,
      ),
    });
    this.render();
  };

  static readonly #submitSheet = async function (
    this: D6System2eHideoutSheet,
    _event: SubmitEvent,
    _form: HTMLFormElement,
    formData: FoundryFormData,
  ): Promise<void> {
    if (!this.isEditable) return;
    await this.actor.update(formData.object);
    ui.notifications.info(game.i18n.localize("D6E2.Hideout.Saved"));
    this.render();
  };

  static DEFAULT_OPTIONS = {
    actions: {
      addCatalogFeature: this.#addCatalogFeature,
      addCustomFeature: this.#addCustomFeature,
      addMember: this.#addMember,
      editImage: this.#editImage,
      openMember: this.#openMember,
      removeFeature: this.#removeFeature,
      removeMember: this.#removeMember,
    },
    classes: [
      "d6e2",
      "od6s-character-v2",
      "od6-theme-classic",
      "d6e2-hideout-sheet",
    ],
    form: {
      closeOnSubmit: false,
      handler: this.#submitSheet,
      submitOnChange: false,
      submitOnClose: true,
    },
    position: { height: 820, width: 860 },
    tag: "form",
    window: { icon: "fa-solid fa-building-shield", resizable: true },
  };

  _prepareContext(): Promise<Record<string, unknown>> {
    const system = record(this.actor.system);
    const features = records(system.features);
    const relocation = record(system.relocation);
    const override = integer(relocation.monthsOverride);
    const plan = hideoutRelocationPlan(
      features.length,
      integer(relocation.monthsCompleted),
      override > 0 ? override : undefined,
    );
    const active = currentSecondEditionCampaignProfile().hiddenBases;
    return Promise.resolve({
      active,
      acquisitions: [
        {
          label: game.i18n.localize("D6E2.Hideout.GmGranted"),
          value: "gm-granted",
        },
        {
          label: game.i18n.localize("D6E2.Hideout.TalentPurchased"),
          value: "talent-purchased",
        },
        { label: game.i18n.localize("D6E2.Hideout.Pooled"), value: "pooled" },
      ],
      actor: this.actor,
      canEdit: active && this.isEditable,
      editable: this.isEditable,
      features: features.map((entry) => ({
        canEdit: active && this.isEditable,
        description: stringValue(entry.description),
        id: stringValue(entry.instanceId),
        label: stringValue(entry.label),
        source:
          integer(entry.sourcePage) > 0
            ? `${stringValue(entry.sourceBook)} p. ${String(integer(entry.sourcePage))}`
            : game.i18n.localize("D6E2.Hideout.CustomFeature"),
      })),
      featureSummary: {
        class: features.length > integer(system.featureLimit) ? "is-over" : "",
        count: features.length,
        limit: integer(system.featureLimit),
      },
      gm: game.user?.isGM === true,
      locationTypes: ["urban", "country", "wild", "custom"].map((value) => ({
        label: game.i18n.localize(`D6E2.Hideout.Location.${value}`),
        selected: system.locationType === value,
        value,
      })),
      members: records(system.members).map((entry) => {
        const actorId = stringValue(entry.actorId);
        const actor = game.actors?.get(actorId);
        return {
          actorId,
          canEdit: active && this.isEditable,
          cssClass: actor ? "" : "is-missing",
          img: actor?.img ?? "icons/svg/mystery-man.svg",
          missing: !actor,
          name: actor?.name ?? stringValue(entry.name),
        };
      }),
      ownershipKinds: [
        {
          label: game.i18n.localize("D6E2.Hideout.Individual"),
          value: "individual",
        },
        { label: game.i18n.localize("D6E2.Hideout.Group"), value: "group" },
      ],
      plan,
      relocationStates: [
        "ready",
        "compromised",
        "destroyed",
        "relocating",
        "rebuilding",
      ].map((value) => ({
        label: game.i18n.localize(`D6E2.Hideout.State.${value}`),
        selected: relocation.state === value,
        value,
      })),
      system,
    });
  }
}
