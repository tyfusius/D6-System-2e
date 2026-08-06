import {
  formatPipScore,
  isSecondEditionCondition,
  SECOND_EDITION_CONDITIONS,
  secondEditionMachineRepairPlan,
  secondEditionStaticDefense,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../../constants";
import { currentRulesProfile } from "../../settings/rules-compatibility";
import { currentTerminology } from "../../registries/terminology";
import {
  currentCombinedPipScore,
  currentEffectivePipScore,
} from "../../settings/pip-rules";
import { integer, record } from "./values";
import { openDocumentImagePicker } from "./open-document-image-picker";
import { resolveMachineRepair } from "../machine-damage-service";
import {
  actorItemDropData,
  applyActorItemDrop,
  canTransferActorItem,
  confirmActorItemTransfer,
  itemFromDropData,
  previewActorItemDrop,
  sortActorItem,
  transferActorItem,
} from "../actor-item-drop-service";

const MachineSheetBase = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2,
);

interface SheetTab {
  readonly cssClass: string;
  readonly group: string;
  readonly icon: string;
  readonly id: string;
  readonly label: string;
}

interface MachineSheetContext extends Record<string, unknown> {
  tab?: SheetTab;
  tabs: Readonly<Record<string, SheetTab>>;
}

const SYSTEM_LABELS: Readonly<Record<string, string>> = {
  engines: "D6E2.Machine.Engines",
  hull: "D6E2.Machine.Hull",
  maneuverability: "D6E2.Machine.Maneuverability",
  navicomp: "D6E2.Machine.Navicomp",
};

function conditionLabel(value: string): string {
  return game.i18n.localize(
    `D6E2.Condition.${value
      .split("-")
      .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
      .join("")}`,
  );
}

function expandDottedUpdate(
  flattened: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const expanded: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(flattened)) {
    const parts = path.split(".");
    let cursor = expanded;
    for (const part of parts.slice(0, -1)) {
      const child = cursor[part];
      if (typeof child !== "object" || child === null || Array.isArray(child)) {
        cursor[part] = {};
      }
      cursor = cursor[part] as Record<string, unknown>;
    }
    const leaf = parts.at(-1);
    if (leaf) cursor[leaf] = value;
  }
  return expanded;
}

function htmlEscape(value: string): string {
  return value.replace(
    /[&<>"']/g,
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

async function confirmItemDeletion(itemName: string): Promise<boolean> {
  const result = await foundry.applications.api.DialogV2.wait<boolean>({
    buttons: [
      {
        action: "cancel",
        callback: () => false,
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "delete",
        callback: () => true,
        class: "is-danger",
        default: true,
        icon: "fa-solid fa-trash",
        label: game.i18n.localize("D6E2.Delete"),
      },
    ],
    classes: ["d6e2", "od6roll-dialog", "d6e2-delete-item-dialog"],
    content: `<div class="od6-dialog-shell"><p>${htmlEscape(
      game.i18n.format("D6E2.DeleteItemConfirm", { item: itemName }),
    )}</p></div>`,
    modal: true,
    rejectClose: false,
    window: {
      icon: "fa-solid fa-trash",
      title: game.i18n.localize("D6E2.Delete"),
    },
  });
  return result === true;
}

function crewMemberSources(
  actor: FoundryActorDocument,
): readonly { readonly actorId: string; readonly name: string }[] {
  const members = record(actor.system.crew).members;
  if (!Array.isArray(members)) return [];
  return members.flatMap((value) => {
    const member = record(value);
    const actorId =
      typeof member.actorId === "string" ? member.actorId.trim() : "";
    if (!actorId) return [];
    return [
      {
        actorId,
        name: typeof member.name === "string" ? member.name : "",
      },
    ];
  });
}

export class D6System2eMachineSheet extends MachineSheetBase {
  readonly #clearDropState = (): void => {
    this.element.classList.remove("is-item-drop-target");
  };

  readonly #dragOver = (event: DragEvent): void => {
    if (!this.isEditable) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    this.element.classList.add("is-item-drop-target");
  };

  readonly #dragItem = (event: DragEvent): void => {
    if (!this.isEditable || !event.dataTransfer) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const itemId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    const item = itemId ? this.actor.items.get(itemId) : undefined;
    if (!item) return;
    const data = item.toDragData?.() ?? { type: "Item", uuid: item.uuid };
    const serialized = JSON.stringify(data);
    event.dataTransfer.setData("application/json", serialized);
    event.dataTransfer.setData("text/plain", serialized);
    event.dataTransfer.effectAllowed = "copyMove";
  };

  readonly #dropItem = async (event: DragEvent): Promise<void> => {
    this.#clearDropState();
    if (!this.isEditable) return;
    const data = actorItemDropData(event);
    if (!data) return;
    const item = await itemFromDropData(data);
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    if (
      Hooks.callAll?.("dropActorSheetData", this.actor, this, data) === false
    ) {
      return;
    }
    if (item.parent?.id === this.actor.id) {
      const target = event.target;
      const row =
        target instanceof HTMLElement
          ? target.closest<HTMLElement>("[data-item-id]")
          : null;
      const targetItem = row?.dataset.itemId
        ? this.actor.items.get(row.dataset.itemId)
        : undefined;
      const siblingItems = row?.parentElement
        ? Array.from(
            row.parentElement.querySelectorAll<HTMLElement>(
              ":scope > [data-item-id]",
            ),
          ).flatMap((element) => {
            const sibling = element.dataset.itemId
              ? this.actor.items.get(element.dataset.itemId)
              : undefined;
            return sibling ? [sibling] : [];
          })
        : [];
      if (
        targetItem &&
        (await sortActorItem(this.actor, item, targetItem, siblingItems))
      )
        this.render();
      return;
    }
    if (item.parent?.documentName === "Actor") {
      const transferPreview = canTransferActorItem(this.actor, item);
      if (!transferPreview.canApply) {
        ui.notifications.warn(
          game.i18n.localize(
            `D6E2.Drop.Issue.${transferPreview.issue ?? "drop-data"}`,
          ),
        );
        return;
      }
      if (!(await confirmActorItemTransfer(item, this.actor))) return;
      try {
        await transferActorItem(this.actor, item);
        ui.notifications.info(
          game.i18n.format("D6E2.Drop.ItemTransferred", { name: item.name }),
        );
        this.render();
      } catch (error) {
        ui.notifications.warn(
          game.i18n.localize(
            error instanceof Error ? error.message : "D6E2.Drop.Error",
          ),
        );
      }
      return;
    }
    const preview = previewActorItemDrop(this.actor, item);
    if (!preview.canApply) {
      ui.notifications.warn(
        game.i18n.localize(`D6E2.Drop.Issue.${preview.issue ?? "drop-data"}`),
      );
      return;
    }
    try {
      await applyActorItemDrop(this.actor, item);
      ui.notifications.info(
        game.i18n.format("D6E2.Drop.ItemAdded", { name: item.name }),
      );
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : "D6E2.Drop.Error",
        ),
      );
    }
  };

  #deferredInputRender = false;
  #inputFocused = false;

  readonly #trackInputFocusIn = (event: FocusEvent): void => {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      this.#inputFocused = true;
    }
  };

  readonly #trackInputFocusOut = (): void => {
    queueMicrotask(() => {
      const element = this.element;
      if (!(element instanceof HTMLElement)) {
        this.#inputFocused = false;
        this.#deferredInputRender = false;
        return;
      }
      const active = element.ownerDocument.activeElement;
      this.#inputFocused =
        element.contains(active) &&
        (active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement);
      if (!this.#inputFocused && this.#deferredInputRender) this.render(true);
    });
  };

  static readonly #editImage = async function (
    this: D6System2eMachineSheet,
  ): Promise<void> {
    await openDocumentImagePicker(this.actor);
  };

  readonly #persistFieldChange = (event: Event): void => {
    const input = event.target;
    if (
      !(input instanceof HTMLInputElement) &&
      !(input instanceof HTMLSelectElement) &&
      !(input instanceof HTMLTextAreaElement)
    ) {
      return;
    }
    if (
      !input.name ||
      input.disabled ||
      !this.isEditable ||
      (input instanceof HTMLInputElement && input.type === "number")
    ) {
      return;
    }
    const value =
      input instanceof HTMLInputElement && input.type === "checkbox"
        ? input.checked
        : input.value;
    void this.actor.update(expandDottedUpdate({ [input.name]: value }));
  };

  readonly #persistNumericInput = (event: FocusEvent): void => {
    const input = event.target;
    if (
      !(input instanceof HTMLInputElement) ||
      input.type !== "number" ||
      !input.name ||
      input.disabled ||
      !this.isEditable
    ) {
      return;
    }
    void this.actor.update(
      expandDottedUpdate({
        [input.name]: Number.isFinite(input.valueAsNumber)
          ? input.valueAsNumber
          : 0,
      }),
    );
  };

  static PARTS = {
    header: {
      template: `systems/${SYSTEM_ID}/templates/actor/machine/header.hbs`,
    },
    tabs: {
      template: "templates/generic/tab-navigation.hbs",
    },
    systems: {
      scrollable: [""],
      template: `systems/${SYSTEM_ID}/templates/actor/machine/systems.hbs`,
    },
    combat: {
      scrollable: [""],
      template: `systems/${SYSTEM_ID}/templates/actor/machine/combat.hbs`,
    },
    cargo: {
      scrollable: [""],
      template: `systems/${SYSTEM_ID}/templates/actor/machine/cargo.hbs`,
    },
    biography: {
      scrollable: [""],
      template: `systems/${SYSTEM_ID}/templates/actor/machine/biography.hbs`,
    },
  };

  static readonly #createItem = async function (
    this: D6System2eMachineSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.isEditable) return;
    const requested = target.dataset.itemType;
    const machineType = this.actor.type;
    const allowed =
      machineType === "starship"
        ? new Set(["armor", "starship-gear", "starship-weapon"])
        : new Set(["armor", "vehicle-gear", "vehicle-weapon"]);
    if (!requested || !allowed.has(requested)) return;
    const labelKeys: Readonly<Record<string, string>> = {
      armor: "D6E2.New.Armor",
      "starship-gear": "D6E2.New.StarshipGear",
      "starship-weapon": "D6E2.New.StarshipWeapon",
      "vehicle-gear": "D6E2.New.VehicleGear",
      "vehicle-weapon": "D6E2.New.VehicleWeapon",
    };
    const created = await this.actor.createEmbeddedDocuments("Item", [
      {
        name: game.i18n.localize(labelKeys[requested] ?? "D6E2.New.Item"),
        system: { context: machineType },
        type: requested,
      },
    ]);
    created[0]?.sheet.render(true);
    this.render();
  };

  static readonly #editItem = function (
    this: D6System2eMachineSheet,
    _event: Event,
    target: HTMLElement,
  ): void {
    const itemId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    const item = itemId ? this.actor.items.get(itemId) : undefined;
    item?.sheet.render(true);
  };

  static readonly #deleteItem = async function (
    this: D6System2eMachineSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.isEditable) return;
    const itemId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    if (!itemId) return;
    const item = this.actor.items.get(itemId);
    if (!item || !(await confirmItemDeletion(item.name))) return;
    await (
      this.actor as FoundryActorDocument & {
        deleteEmbeddedDocuments(
          documentName: "Item",
          ids: readonly string[],
        ): Promise<unknown>;
      }
    ).deleteEmbeddedDocuments("Item", [item.id]);
    this.render();
  };

  static readonly #rollSystem = async function (
    this: D6System2eMachineSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const systemId =
      target.closest<HTMLElement>("[data-system-id]")?.dataset.systemId;
    if (!systemId) return;
    await game.system.api?.roll.attribute(this.actor, systemId);
  };

  static readonly #rollWeaponDamage = async function (
    this: D6System2eMachineSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const itemId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    if (!itemId) return;
    await game.system.api?.roll.item(this.actor, itemId, "damage");
  };

  static readonly #rollWeaponAttack = async function (
    this: D6System2eMachineSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const itemId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    if (!itemId) return;
    await game.system.api?.roll.item(this.actor, itemId, "attack");
  };

  static readonly #addCrew = async function (
    this: D6System2eMachineSheet,
  ): Promise<void> {
    if (!this.isEditable) return;
    const existing = crewMemberSources(this.actor);
    const existingIds = new Set(existing.map((member) => member.actorId));
    const candidates = (game.actors?.contents ?? [])
      .filter(
        (actor) =>
          ["character", "creature", "npc"].includes(actor.type) &&
          !existingIds.has(actor.id) &&
          (game.user?.isGM === true || actor.isOwner === true),
      )
      .sort((left, right) => left.name.localeCompare(right.name));
    if (candidates.length === 0) {
      ui.notifications.warn(
        game.i18n.localize("D6E2.Machine.NoCrewCandidates"),
      );
      return;
    }
    const options = candidates
      .map(
        (actor) =>
          `<option value="${htmlEscape(actor.id)}">${htmlEscape(actor.name)}</option>`,
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
          callback: (_event, button) => {
            const control = button.form?.elements.namedItem("crewActorId");
            return control instanceof HTMLSelectElement ? control.value : null;
          },
          class: "od6roll-submit",
          default: true,
          icon: "fa-solid fa-user-plus",
          label: game.i18n.localize("D6E2.Machine.AddCrew"),
        },
      ],
      classes: ["d6e2", "od6roll-dialog", "d6e2-machine-crew-dialog"],
      content: `<div class="od6-dialog-shell">
          <p>${game.i18n.localize("D6E2.Machine.AddCrewHelp")}</p>
          <label>
            <span>${game.i18n.localize("D6E2.Machine.CrewMember")}</span>
            <select name="crewActorId">${options}</select>
          </label>
        </div>`,
      modal: true,
      rejectClose: false,
      window: {
        icon: "fa-solid fa-users",
        title: game.i18n.localize("D6E2.Machine.AddCrew"),
      },
    });
    const crewActor =
      typeof selected === "string"
        ? candidates.find((actor) => actor.id === selected)
        : undefined;
    if (!crewActor) return;
    await this.actor.update({
      "system.crew.members": [
        ...existing,
        { actorId: crewActor.id, name: crewActor.name },
      ],
    });
    this.render();
  };

  static readonly #openCrew = function (
    this: D6System2eMachineSheet,
    _event: Event,
    target: HTMLElement,
  ): void {
    const actorId = target.closest<HTMLElement>("[data-crew-actor-id]")?.dataset
      .crewActorId;
    if (actorId) game.actors?.get(actorId)?.sheet.render(true);
  };

  static readonly #removeCrew = async function (
    this: D6System2eMachineSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.isEditable) return;
    const actorId = target.closest<HTMLElement>("[data-crew-actor-id]")?.dataset
      .crewActorId;
    if (!actorId) return;
    const member = game.actors?.get(actorId);
    const confirmed = await foundry.applications.api.DialogV2.wait<boolean>({
      buttons: [
        {
          action: "cancel",
          callback: () => false,
          label: game.i18n.localize("D6E2.Cancel"),
        },
        {
          action: "remove",
          callback: () => true,
          class: "od6roll-submit",
          default: true,
          icon: "fa-solid fa-user-minus",
          label: game.i18n.localize("D6E2.Machine.RemoveCrew"),
        },
      ],
      classes: ["d6e2", "od6roll-dialog", "d6e2-machine-crew-dialog"],
      content: `<p>${game.i18n.format("D6E2.Machine.RemoveCrewHelp", { name: htmlEscape(member?.name ?? actorId) })}</p>`,
      modal: true,
      rejectClose: false,
      window: {
        icon: "fa-solid fa-user-minus",
        title: game.i18n.localize("D6E2.Machine.RemoveCrew"),
      },
    });
    if (confirmed !== true) return;
    await this.actor.update({
      "system.crew.members": crewMemberSources(this.actor).filter(
        (candidate) => candidate.actorId !== actorId,
      ),
    });
    this.render();
  };

  static readonly #setCondition = async function (
    this: D6System2eMachineSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.isEditable) return;
    const condition =
      target.closest<HTMLElement>("[data-condition]")?.dataset.condition;
    if (!isSecondEditionCondition(condition)) return;
    await game.system.api?.health.condition(this.actor, condition);
    this.render();
  };

  static readonly #repair = async function (
    this: D6System2eMachineSheet,
  ): Promise<void> {
    if (!this.isEditable) return;
    const candidates = (game.actors?.contents ?? [])
      .filter(
        (actor) =>
          ["character", "creature", "npc"].includes(actor.type) &&
          actor.isOwner === true,
      )
      .sort((left, right) => left.name.localeCompare(right.name));
    if (candidates.length === 0) {
      ui.notifications.warn(
        game.i18n.localize("D6E2.Machine.NoRepairCandidates"),
      );
      return;
    }
    const options = candidates
      .map(
        (actor) =>
          `<option value="${htmlEscape(actor.id)}">${htmlEscape(actor.name)}</option>`,
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
          action: "repair",
          callback: (_event, button) => {
            const control = button.form?.elements.namedItem("repairerActorId");
            return control instanceof HTMLSelectElement ? control.value : null;
          },
          class: "od6roll-submit",
          default: true,
          icon: "fa-solid fa-screwdriver-wrench",
          label: game.i18n.localize("D6E2.Machine.RepairAction"),
        },
      ],
      classes: ["d6e2", "od6roll-dialog", "d6e2-machine-repair-dialog"],
      content: `<div class="od6-dialog-shell">
        <p>${game.i18n.localize("D6E2.Machine.RepairHelp")}</p>
        <label><span>${game.i18n.localize("D6E2.Machine.Repairer")}</span>
          <select name="repairerActorId">${options}</select>
        </label>
      </div>`,
      modal: true,
      rejectClose: false,
      window: {
        icon: "fa-solid fa-screwdriver-wrench",
        title: game.i18n.localize("D6E2.Machine.RepairAction"),
      },
    });
    const repairer =
      typeof selected === "string"
        ? candidates.find((actor) => actor.id === selected)
        : undefined;
    if (!repairer) return;
    try {
      const result = await resolveMachineRepair(this.actor, repairer);
      if (result.roll === null) return;
      ui.notifications.info(
        game.i18n.format(
          result.repaired
            ? "D6E2.Machine.RepairSuccess"
            : "D6E2.Machine.RepairFailure",
          { machine: this.actor.name },
        ),
      );
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };

  static readonly #toggleEquipped = async function (
    this: D6System2eMachineSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.isEditable || !(target instanceof HTMLInputElement)) return;
    const itemId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    const item = itemId ? this.actor.items.get(itemId) : undefined;
    if (!item) return;
    await item.update({ "system.equipped": target.checked });
    this.render();
  };

  static readonly #submitSheet = async function (
    this: D6System2eMachineSheet,
    _event: SubmitEvent,
    _form: HTMLFormElement,
    formData: FoundryFormData,
  ): Promise<void> {
    if (!this.isEditable) return;
    await this.actor.update(formData.object);
  };

  static DEFAULT_OPTIONS = {
    actions: {
      addCrew: this.#addCrew,
      createItem: this.#createItem,
      deleteItem: this.#deleteItem,
      editImage: this.#editImage,
      editItem: this.#editItem,
      openCrew: this.#openCrew,
      removeCrew: this.#removeCrew,
      repair: this.#repair,
      rollSystem: this.#rollSystem,
      rollWeaponAttack: this.#rollWeaponAttack,
      rollWeaponDamage: this.#rollWeaponDamage,
      setCondition: this.#setCondition,
      toggleEquipped: this.#toggleEquipped,
    },
    classes: [
      "d6e2",
      "d6e2-machine-v2",
      "od6s-character-v2",
      "od6-theme-classic",
    ],
    form: {
      closeOnSubmit: false,
      handler: this.#submitSheet,
      submitOnChange: false,
      submitOnClose: true,
    },
    position: {
      height: 790,
      width: 920,
    },
    tag: "form",
    window: {
      icon: "fa-solid fa-shuttle-space",
      resizable: true,
    },
  };

  _prepareContext(): Promise<MachineSheetContext> {
    const terminology = currentTerminology();
    const system = record(this.actor.system);
    const attributes = record(system.attributes);
    const starship = this.actor.type === "starship";
    const systemIds = starship
      ? ["navicomp", "maneuverability", "engines", "hull"]
      : ["maneuverability", "hull"];
    const machineSystems = systemIds.map((id) => {
      const score = integer(record(attributes[id]).score);
      const effectiveScore = currentEffectivePipScore(score);
      return {
        id,
        label:
          id === "hull"
            ? ((starship
                ? terminology.machines.starshipToughness
                : terminology.machines.vehicleToughness) ??
              game.i18n.localize(SYSTEM_LABELS[id] ?? id))
            : game.i18n.localize(SYSTEM_LABELS[id] ?? id),
        score,
        scoreLabel: formatPipScore(effectiveScore),
      };
    });
    const hullScore = currentEffectivePipScore(
      integer(record(attributes.hull).score),
    );
    const protectionKey = starship ? "shields" : "armor";
    const protectionScore = currentEffectivePipScore(
      integer(record(system[protectionKey]).score),
    );
    const health = record(system.health);
    const condition = isSecondEditionCondition(health.condition)
      ? health.condition
      : "healthy";
    const repairPlan = secondEditionMachineRepairPlan(
      starship ? "starship" : "vehicle",
      condition,
    );
    const conditions = SECOND_EDITION_CONDITIONS.map((value) => ({
      cssClass: condition === value ? "is-current" : "",
      current: condition === value,
      label: conditionLabel(value),
      value,
    }));
    const weaponType = starship ? "starship-weapon" : "vehicle-weapon";
    const gearType = starship ? "starship-gear" : "vehicle-gear";
    const weapons = this.actor.items.contents
      .filter((item) => item.type === weaponType)
      .map((item) => ({
        attackBonusLabel: formatPipScore(
          currentEffectivePipScore(integer(item.system.attackBonus)),
        ),
        damageLabel: formatPipScore(
          currentEffectivePipScore(integer(item.system.damage)),
        ),
        equipped: item.system.equipped === true,
        id: item.id,
        img: item.img,
        name: item.name,
      }));
    const gear = this.actor.items.contents
      .filter((item) => [gearType, "armor"].includes(item.type))
      .map((item) => ({
        equipped: item.system.equipped === true,
        id: item.id,
        img: item.img,
        name: item.name,
        typeLabel: game.i18n.localize(
          item.type === "armor"
            ? "D6E2.Item.Armor"
            : starship
              ? "D6E2.Item.StarshipGear"
              : "D6E2.Item.VehicleGear",
        ),
      }));
    const profile = currentRulesProfile();
    const secondEditionMachineRules =
      !profile.compatibility.firstEditionActiveDefenses &&
      !profile.compatibility.firstEditionDamage;
    const minimumCrew = starship
      ? Math.max(1, integer(record(system.crew).minimum))
      : 0;
    const crew = crewMemberSources(this.actor).map((member) => {
      const actor = game.actors?.get(member.actorId);
      const gunnery = actor?.items.contents.find(
        (item) => item.type === "skill" && item.system.key === "gunnery",
      );
      const attributeId =
        typeof gunnery?.system.attributeId === "string"
          ? gunnery.system.attributeId
          : "mechanical";
      const attribute = record(record(actor?.system.attributes)[attributeId]);
      const score = actor
        ? gunnery
          ? currentCombinedPipScore(
              integer(attribute.score),
              integer(gunnery.system.score),
            )
          : currentEffectivePipScore(integer(attribute.score))
        : 0;
      return {
        actorId: member.actorId,
        cssClass: actor === undefined ? "is-missing" : "",
        img: actor?.img ?? "icons/svg/mystery-man.svg",
        missing: actor === undefined,
        name: actor?.name ?? member.name,
        scoreLabel: actor
          ? formatPipScore(score)
          : game.i18n.localize("D6E2.Machine.MissingCrew"),
      };
    });
    const assignedCrewCount = crew.filter((member) => !member.missing).length;
    const missingCrewCount = starship
      ? Math.max(0, minimumCrew - assignedCrewCount)
      : 0;

    return Promise.resolve({
      actor: this.actor,
      capacityLabel: game.i18n.localize(
        starship ? "D6E2.Machine.MinimumCrew" : "D6E2.Machine.Passengers",
      ),
      capacityMinimum: starship ? 1 : 0,
      capacityName: starship ? "system.crew.minimum" : "system.passengers",
      capacityValue: starship
        ? Math.max(1, integer(record(system.crew).minimum))
        : integer(system.passengers),
      combat: {
        condition,
        conditionLabel: conditionLabel(condition),
        conditions,
        defense: secondEditionStaticDefense(hullScore),
        resistanceLabel: formatPipScore(
          currentCombinedPipScore(hullScore, protectionScore),
        ),
        repair:
          secondEditionMachineRules && repairPlan
            ? {
                difficulty: repairPlan.difficulty,
                sourcePage: repairPlan.sourcePage,
              }
            : null,
        weapons,
      },
      crew,
      crewSummary: {
        assigned: assignedCrewCount,
        cssClass: missingCrewCount > 0 ? "is-understaffed" : "",
        minimum: minimumCrew,
        missing: missingCrewCount,
        penaltyLabel:
          missingCrewCount > 0
            ? `−${formatPipScore(missingCrewCount * 3)}`
            : formatPipScore(0),
      },
      editable: this.isEditable,
      gear,
      machineSystems,
      machineIcon: starship ? "fa-shuttle-space" : "fa-truck-monster",
      machineTypeLabel: game.i18n.localize(
        starship ? "D6E2.Actor.Starship" : "D6E2.Actor.Vehicle",
      ),
      interstellarDrive:
        starship && terminology.machines.interstellarDrive
          ? {
              label: terminology.machines.interstellarDrive,
              value: Number(system.interstellarDrive) || 0,
            }
          : null,
      toughnessLabel:
        (starship
          ? terminology.machines.starshipToughness
          : terminology.machines.vehicleToughness) ??
        game.i18n.localize("D6E2.Machine.Resistance"),
      protectionLabel: game.i18n.localize(
        starship ? "D6E2.Machine.Shields" : "D6E2.Machine.Armor",
      ),
      protectionName: `system.${protectionKey}.score`,
      protectionScore: integer(record(system[protectionKey]).score),
      protectionScoreLabel: formatPipScore(protectionScore),
      secondEditionMachineRules,
      sourcePages: starship ? "D62e pp. 176–181" : "D62e pp. 181–183",
      starship,
      system,
      tabs: this.#tabs(),
      weaponType,
      gearType,
    });
  }

  _preparePartContext(
    partId: string,
    context: MachineSheetContext,
  ): Promise<MachineSheetContext> {
    if (!["header", "tabs"].includes(partId)) {
      const tab = context.tabs[partId];
      if (tab) context.tab = tab;
    }
    return Promise.resolve(context);
  }

  override async _onRender(
    context: MachineSheetContext,
    options: Record<string, unknown>,
  ): Promise<void> {
    await super._onRender(context, options);
    const element = this.element;
    element.addEventListener("dragover", this.#dragOver);
    element.addEventListener("dragstart", this.#dragItem);
    element.addEventListener("dragleave", this.#clearDropState);
    element.addEventListener("drop", (event) => {
      void this.#dropItem(event);
    });
    element.addEventListener("focusin", this.#trackInputFocusIn);
    element.addEventListener("change", this.#persistFieldChange);
    element.addEventListener("focusout", this.#persistNumericInput);
    element.addEventListener("focusout", this.#trackInputFocusOut);
  }

  override render(force?: boolean): unknown {
    if (this.#inputFocused) {
      this.#deferredInputRender = true;
      return this;
    }
    this.#deferredInputRender = false;
    return super.render(force);
  }

  #tabs(): Readonly<Record<string, SheetTab>> {
    const group = "primary";
    this.tabGroups[group] ||= "systems";
    const definitions = {
      systems: {
        icon: "fa-solid fa-gauge-high",
        label: "D6E2.Machine.Systems",
      },
      combat: {
        icon: "fa-solid fa-crosshairs",
        label: "D6E2.Tab.Combat",
      },
      cargo: {
        icon: "fa-solid fa-boxes-stacked",
        label: "D6E2.Machine.Cargo",
      },
      biography: {
        icon: "fa-solid fa-book-open",
        label: "D6E2.Machine.Notes",
      },
    } as const;
    return Object.fromEntries(
      Object.entries(definitions).map(([id, definition]) => [
        id,
        {
          cssClass: this.tabGroups[group] === id ? "active" : "",
          group,
          icon: definition.icon,
          id,
          label: definition.label,
        },
      ]),
    );
  }
}
