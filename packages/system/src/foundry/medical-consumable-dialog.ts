import type { D6RollMode } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { applicationV2FormOptions } from "./application-v2-form-options";
import { startMedicalConsumableRoot } from "./medical-consumable-root";
import { readActorHealth } from "./health-runtime";
import { readCombatantRound } from "./combat-service";
import { currentActionEconomyRuntimeStrategy } from "../settings/action-economy";
import { currentConfiguredRulesProfile } from "../settings/rules-profile-library";
import { foundryRandomId } from "./foundry-random-id";
import { medicalUseDialogVM } from "./medical-consumable-view-model";
import { rollVisibility } from "./rolls/roll-dialog-controls";

const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);

function safePatients(
  administrator: FoundryActorDocument & { readonly uuid?: string },
) {
  const actors = new Map<
    string,
    FoundryActorDocument & { readonly uuid?: string }
  >();
  if (administrator.uuid) actors.set(administrator.uuid, administrator);
  for (const user of game.users?.contents ?? []) {
    const actor = user.active ? user.character : undefined;
    if (actor?.type === "character" && actor.uuid)
      actors.set(actor.uuid, actor);
  }
  for (const token of canvas.tokens?.placeables ?? []) {
    const actor = token.visible === true ? token.actor : undefined;
    if (actor?.uuid && ["character", "creature"].includes(actor.type))
      actors.set(actor.uuid, actor);
  }
  return [...actors.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

function patientApprovalAvailable(patient: FoundryActorDocument): boolean {
  const requester = game.user;
  if (
    !requester ||
    requester.isGM ||
    patient.testUserPermission(requester, "OWNER")
  )
    return true;
  return (game.users?.contents ?? []).some(
    (candidate) =>
      candidate.active &&
      !candidate.isGM &&
      patient.testUserPermission(candidate, "OWNER"),
  );
}

export class D6MedicalConsumableUseDialog extends Base {
  static override PARTS = {
    form: {
      template: `systems/${SYSTEM_ID}/templates/dialog/medical-consumable-use.hbs`,
    },
  };
  #item!: FoundryItemDocument & { readonly uuid?: string };
  #pending = false;
  #useMode: "self" | "administer" = "self";
  #patientUuid = "";
  #rollMode?: D6RollMode;
  #operation?: { readonly rootMessageId: string; readonly useId: string };

  withItem(item: FoundryItemDocument & { readonly uuid?: string }): this {
    this.#item = item;
    return this;
  }

  static readonly #cancel = async function (
    this: D6MedicalConsumableUseDialog,
  ): Promise<void> {
    if (!this.#pending) await this.close();
  };

  static readonly #submit = async function (
    this: D6MedicalConsumableUseDialog,
  ): Promise<void> {
    if (this.#pending) return;
    const administrator = this.#item.parent as
      (FoundryActorDocument & { readonly uuid?: string }) | null;
    const patientUuid = this.element.querySelector<HTMLSelectElement>(
      '[name="patientUuid"]',
    )?.value;
    const useMode =
      this.element.querySelector<HTMLSelectElement>('[name="useMode"]')?.value;
    const rollMode = this.element.querySelector<HTMLSelectElement>(
      '[name="rollMode"]',
    )?.value as D6RollMode | undefined;
    if (
      !administrator?.uuid ||
      !patientUuid ||
      !rollMode ||
      (useMode !== "self" && useMode !== "administer") ||
      (useMode === "self") !== (patientUuid === administrator.uuid)
    )
      return;
    this.#rollMode = rollMode;
    const patient = (await fromUuid(patientUuid)) as
      (FoundryActorDocument & { readonly uuid?: string }) | null;
    if (!patient?.uuid) return;
    this.#pending = true;
    this.#operation ??= {
      rootMessageId: foundryRandomId(16).slice(0, 16),
      useId: foundryRandomId(16).slice(0, 16),
    };
    await this.render({ force: true });
    try {
      await startMedicalConsumableRoot({
        administrator,
        patient,
        item: this.#item,
        rollMode,
        ...this.#operation,
      });
      await this.close();
    } catch (error) {
      const key = error instanceof Error ? error.message : String(error);
      ui.notifications.warn(
        key.startsWith("D6E2.") ? game.i18n.localize(key) : key,
      );
      this.#pending = false;
      await this.render({ force: true });
    }
  };

  static override DEFAULT_OPTIONS = {
    actions: {
      cancelMedicalConsumableUse: this.#cancel,
      submitMedicalConsumableUse: this.#submit,
    },
    classes: ["d6e2", "d6e2-medical-use-dialog"],
    form: applicationV2FormOptions({
      closeOnSubmit: false,
      handler: () => Promise.resolve(undefined),
      submitOnChange: false,
    }),
    position: { width: 440 },
    tag: "form",
    window: {
      icon: "fa-solid fa-syringe",
      resizable: false,
      title: "D6E2.Medical.UseTitle",
    },
  };

  override async _onRender(
    context: Record<string, unknown>,
    options: { readonly parts: readonly string[] },
  ): Promise<void> {
    await super._onRender(context, options);
    this.element
      .querySelector<HTMLSelectElement>('[name="useMode"]')
      ?.addEventListener("change", (event) => {
        const value = (event.currentTarget as HTMLSelectElement).value;
        if (value !== "self" && value !== "administer") return;
        this.#useMode = value;
        const administrator = this.#item.parent as
          (FoundryActorDocument & { readonly uuid?: string }) | null;
        const patients = administrator ? safePatients(administrator) : [];
        this.#patientUuid =
          value === "self"
            ? (administrator?.uuid ?? "")
            : (patients.find(({ uuid }) => uuid !== administrator?.uuid)
                ?.uuid ?? "");
        void this.render({ force: true });
      });
    this.element
      .querySelector<HTMLSelectElement>('[name="patientUuid"]')
      ?.addEventListener("change", (event) => {
        this.#patientUuid = (event.currentTarget as HTMLSelectElement).value;
        void this.render({ force: true });
      });
    this.element
      .querySelector<HTMLSelectElement>('[name="rollMode"]')
      ?.addEventListener("change", (event) => {
        const value = (event.currentTarget as HTMLSelectElement).value;
        if (["publicroll", "gmroll", "selfroll", "blindroll"].includes(value))
          this.#rollMode = value as D6RollMode;
      });
  }

  override _prepareContext(): Promise<Record<string, unknown>> {
    const administrator = this.#item.parent as
      (FoundryActorDocument & { readonly uuid?: string }) | null;
    const allPatients = administrator ? safePatients(administrator) : [];
    const patients =
      this.#useMode === "self"
        ? allPatients.filter(({ uuid }) => uuid === administrator?.uuid)
        : allPatients.filter(({ uuid }) => uuid !== administrator?.uuid);
    const selected = patients.some(({ uuid }) => uuid === this.#patientUuid)
      ? this.#patientUuid
      : (patients[0]?.uuid ?? "");
    this.#patientUuid = selected;
    const patient = patients.find(({ uuid }) => uuid === selected);
    const profile = currentConfiguredRulesProfile();
    const health = patient ? readActorHealth(patient) : undefined;
    const physiology = (
      patient?.system.medical as { physiology?: { kind?: unknown } } | undefined
    )?.physiology?.kind;
    const consciousness = (
      patient?.system.health as
        { firstEditionState?: { consciousness?: unknown } } | undefined
    )?.firstEditionState?.consciousness;
    const marker = patient?.system.medical as
      { stim?: { version?: unknown; status?: unknown } } | undefined;
    const round = administrator ? readCombatantRound(administrator) : null;
    const eligibilityKey = !profile.homebrew.tyfusiusMedicalConsumables
      ? "D6E2.Medical.RulesDisabled"
      : Number(this.#item.system.quantity) < 1
        ? "D6E2.Medical.Error.NoDoses"
        : !patient
          ? "D6E2.Medical.Unavailable"
          : !patientApprovalAvailable(patient)
            ? "D6E2.Medical.Error.PatientControllerUnavailable"
            : physiology === "unknown"
              ? "D6E2.Medical.Error.UnknownPhysiology"
              : physiology !== "biological"
                ? "D6E2.Medical.Error.MechanicalPatient"
                : health?.kind !== "track" ||
                    health.modelId !== "open-d6.health.wound-track" ||
                    health.damageStrategyId !== "open-d6.damage.wounds"
                  ? "D6E2.Medical.Error.UnsupportedHealthModel"
                  : consciousness === "unconscious" ||
                      !["wounded", "severely-wounded"].includes(
                        String(health.track?.currentStateId),
                      )
                    ? "D6E2.Medical.Error.IneligibleInjury"
                    : marker?.stim?.version === 1
                      ? "D6E2.Medical.Error.ActiveEffect"
                      : round &&
                          currentActionEconomyRuntimeStrategy().declaration !==
                            "action-commitment"
                        ? "D6E2.Medical.Error.ActionUnavailable"
                        : "D6E2.Medical.Ready";
    const eligible = eligibilityKey === "D6E2.Medical.Ready";
    const rollMode =
      this.#rollMode ??
      ((game.settings.get("core", "rollMode") ?? "publicroll") as D6RollMode);
    this.#rollMode = rollMode;
    return Promise.resolve(
      structuredClone(
        medicalUseDialogVM({
          title: game.i18n.localize("D6E2.Medical.UseTitle"),
          useMode: this.#useMode,
          useModeOptions: [
            {
              value: "self",
              label: game.i18n.localize("D6E2.Medical.Self"),
              selected: this.#useMode === "self",
            },
            {
              value: "administer",
              label: game.i18n.localize("D6E2.Medical.Administer"),
              selected: this.#useMode === "administer",
            },
          ],
          patientUuid: selected,
          patientOptions: patients.map((actor) => ({
            value: actor.uuid ?? "",
            label: actor.name,
            selected: actor.uuid === selected,
          })),
          rollMode,
          rollModeOptions: (
            ["publicroll", "gmroll", "selfroll", "blindroll"] as const
          ).map((value) => ({
            value,
            label: rollVisibility(value, game.i18n.localize.bind(game.i18n))
              .label,
            selected: value === rollMode,
          })),
          doseLabel: game.i18n.format("D6E2.Medical.DosesRemaining", {
            quantity: Number(this.#item.system.quantity) || 0,
          }),
          effectLabel: game.i18n.localize("D6E2.Medical.ModelBEffect"),
          durationLabel: game.i18n.localize("D6E2.Medical.ModelBDuration"),
          actionCostLabel: game.i18n.localize("D6E2.Medical.OneAction"),
          eligibilityLabel: game.i18n.localize(eligibilityKey),
          eligible,
          pending: this.#pending,
          submitLabel: game.i18n.localize("D6E2.Medical.UseStim"),
          cancelLabel: game.i18n.localize("D6E2.Cancel"),
        }),
      ) as unknown as Record<string, unknown>,
    );
  }
}

export function openMedicalConsumableUseDialog(
  item: FoundryItemDocument,
): void {
  void new D6MedicalConsumableUseDialog().withItem(item).render(true);
}
