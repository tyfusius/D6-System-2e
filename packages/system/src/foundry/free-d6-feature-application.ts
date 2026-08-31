import { SYSTEM_ID } from "../constants";
import { featureEconomyRegistry } from "../registries/feature-economy";
import {
  applyFreeD6FeatureTransaction,
  approveFreeD6FeatureRequest,
  cancelFreeD6FeatureRequest,
  freeD6FeatureRequests,
  previewFreeD6FeatureTransaction,
  rejectFreeD6FeatureRequest,
  requestFreeD6FeatureTransaction,
} from "./free-d6-feature-service";
import { record } from "./sheets/values";

const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);

function defaultPointValue(value: {
  readonly kind: string;
  readonly value?: number;
  readonly minimum?: number;
  readonly values?: readonly number[];
}): number {
  if (value.kind === "exact") return value.value ?? 0;
  if (value.kind === "choices") return value.values?.[0] ?? 0;
  return value.minimum ?? 0;
}

export function freeD6FeatureRequestViews(
  actor: FoundryActorDocument,
): readonly Readonly<{
  canApprove: boolean;
  canCancel: boolean;
  canReject: boolean;
  focusLabel: string;
  id: string;
  label: string;
  private: boolean;
  privacyLabel: string;
  provider: string;
  providerAvailable: boolean;
  requesterLabel: string;
  selectedValue: number;
  statusLabel: string;
}>[] {
  const availableDefinitionIds = new Set(
    featureEconomyRegistry
      .current()
      .flatMap(({ definitions }) => definitions.map(({ id }) => id)),
  );
  const currentUserId = game.user?.id;
  const isGM = game.user?.isGM === true;
  return Object.freeze(
    freeD6FeatureRequests(actor)
      .filter((request) => isGM || request.requesterId === currentUserId)
      .map((request) => {
        const requesterName = game.users
          ?.get(request.requesterId)
          ?.name?.trim();
        return Object.freeze({
          canApprove: isGM && request.status === "pending",
          canCancel: isGM || request.requesterId === currentUserId,
          canReject: isGM && request.status === "pending",
          focusLabel:
            request.focus.trim() ||
            game.i18n.localize("D6E2.FreeD6.Features.NoFocus"),
          id: request.id,
          label: request.definitionLabel,
          private: request.private,
          privacyLabel: game.i18n.localize(
            request.private
              ? "D6E2.FreeD6.Features.PrivacyPrivate"
              : "D6E2.FreeD6.Features.PrivacyShared",
          ),
          provider: request.providerLabel ?? "",
          providerAvailable: availableDefinitionIds.has(request.definitionId),
          requesterLabel:
            requesterName && requesterName.length > 0
              ? requesterName
              : game.i18n.localize("D6E2.FreeD6.Features.UnknownRequester"),
          selectedValue: request.selectedValue,
          statusLabel: game.i18n.localize(
            request.status === "rejected"
              ? "D6E2.FreeD6.Features.RequestRejected"
              : "D6E2.FreeD6.Features.RequestPending",
          ),
        });
      }),
  );
}

export class D6System2eFreeD6FeatureApplication extends Base {
  static override PARTS = {
    form: {
      template: `systems/${SYSTEM_ID}/templates/actor/character/free-d6-feature-browser.hbs`,
    },
  };

  #actor!: FoundryActorDocument;
  readonly #drafts = new Map<
    string,
    Readonly<{ focus: string; private: boolean; value: string }>
  >();
  readonly #errors = new Map<string, string>();
  readonly #previews = new Map<
    string,
    Readonly<{
      balanceAfter: number;
      balanceBefore: number;
      cost: number;
      focus: string;
      private: boolean;
      value: number;
    }>
  >();

  withActor(actor: FoundryActorDocument): this {
    this.#actor = actor;
    return this;
  }

  #readDraft(row: HTMLElement): Readonly<{
    definitionId: string;
    focus: string;
    private: boolean;
    rawValue: string;
  }> | null {
    const definitionId = row.dataset.definitionId;
    const valueControl = row.querySelector<
      HTMLInputElement | HTMLSelectElement
    >("[data-feature-value]");
    if (!definitionId || !valueControl) return null;
    const draft = Object.freeze({
      definitionId,
      focus:
        row.querySelector<HTMLInputElement>("[data-feature-focus]")?.value ??
        "",
      private:
        row.querySelector<HTMLInputElement>("[data-feature-private]")
          ?.checked === true,
      rawValue: valueControl.value,
    });
    this.#drafts.set(
      definitionId,
      Object.freeze({
        focus: draft.focus,
        private: draft.private,
        value: draft.rawValue,
      }),
    );
    return draft;
  }

  #rerenderAndFocus(selector: string): void {
    this.render({ force: true });
    queueMicrotask(() =>
      this.element.querySelector<HTMLElement>(selector)?.focus(),
    );
  }

  static readonly #preview = function (
    this: D6System2eFreeD6FeatureApplication,
    _event: Event,
    target: HTMLElement,
  ): void {
    const row = target.closest<HTMLElement>("[data-definition-id]");
    if (!row) return;
    const draft = this.#readDraft(row);
    if (!draft) return;
    const controlId = row.dataset.valueControlId ?? "";
    const value = Number(draft.rawValue);
    if (
      !/^(?:0|[1-9]\d*)$/u.test(draft.rawValue) ||
      !Number.isSafeInteger(value)
    ) {
      this.#previews.delete(draft.definitionId);
      this.#errors.set(
        draft.definitionId,
        game.i18n.localize("D6E2.FreeD6.Features.Error.InvalidValue"),
      );
      this.#rerenderAndFocus(`#${CSS.escape(controlId)}`);
      return;
    }
    try {
      const preview = previewFreeD6FeatureTransaction({
        actor: this.#actor,
        definitionId: draft.definitionId,
        operation: "acquire",
        phase:
          record(this.#actor.system.creation).active === true
            ? "creation"
            : "advancement",
        selectedValue: value,
        transactionId: `preview:${draft.definitionId}`,
      });
      this.#errors.delete(draft.definitionId);
      this.#previews.set(
        draft.definitionId,
        Object.freeze({
          balanceAfter: preview.balanceAfter,
          balanceBefore: preview.balanceBefore,
          cost: preview.cost,
          focus: draft.focus,
          private: draft.private,
          value,
        }),
      );
      this.#rerenderAndFocus(
        `[data-definition-id="${CSS.escape(draft.definitionId)}"] [data-action="acquireFeature"]`,
      );
    } catch (error) {
      const key = error instanceof Error ? error.message : String(error);
      this.#previews.delete(draft.definitionId);
      this.#errors.set(
        draft.definitionId,
        key.startsWith("D6E2.") ? game.i18n.localize(key) : key,
      );
      this.#rerenderAndFocus(`#${CSS.escape(controlId)}`);
    }
  };

  static readonly #acquire = async function (
    this: D6System2eFreeD6FeatureApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const row = target.closest<HTMLElement>("[data-definition-id]");
    const definitionId = row?.dataset.definitionId;
    if (!row || !definitionId) return;
    const draft = this.#readDraft(row);
    const preview = this.#previews.get(definitionId);
    const value = Number(draft?.rawValue);
    if (
      !draft ||
      preview?.value !== value ||
      preview.focus !== draft.focus ||
      preview.private !== draft.private
    ) {
      D6System2eFreeD6FeatureApplication.#preview.call(this, _event, target);
      return;
    }
    try {
      const input = {
        actor: this.#actor,
        definitionId,
        focus: draft.focus,
        operation: "acquire" as const,
        phase:
          record(this.#actor.system.creation).active === true
            ? ("creation" as const)
            : ("advancement" as const),
        private: draft.private,
        selectedValue: value,
        transactionId: foundry.utils.randomID(),
      };
      if (game.user?.isGM === true) {
        await applyFreeD6FeatureTransaction(input);
      } else {
        await requestFreeD6FeatureTransaction(input);
        ui.notifications.info(
          game.i18n.localize("D6E2.FreeD6.Features.RequestSent"),
        );
      }
      await this.#actor.sheet.render(true);
      await this.close();
    } catch (error) {
      const key = error instanceof Error ? error.message : String(error);
      ui.notifications.warn(
        key.startsWith("D6E2.") ? game.i18n.localize(key) : key,
      );
    }
  };

  static readonly #reject = async function (
    this: D6System2eFreeD6FeatureApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const requestId =
      target.closest<HTMLElement>("[data-request-id]")?.dataset.requestId;
    if (!requestId || game.user?.isGM !== true) return;
    await rejectFreeD6FeatureRequest(this.#actor, requestId);
    this.render({ force: true });
  };

  static readonly #cancelRequest = async function (
    this: D6System2eFreeD6FeatureApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const requestId =
      target.closest<HTMLElement>("[data-request-id]")?.dataset.requestId;
    if (!requestId) return;
    await cancelFreeD6FeatureRequest(this.#actor, requestId);
    this.render({ force: true });
  };

  static readonly #approve = async function (
    this: D6System2eFreeD6FeatureApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const requestId =
      target.closest<HTMLElement>("[data-request-id]")?.dataset.requestId;
    if (!requestId || game.user?.isGM !== true) return;
    try {
      await approveFreeD6FeatureRequest(this.#actor, requestId);
      await this.#actor.sheet.render(true);
      this.render({ force: true });
    } catch (error) {
      const key = error instanceof Error ? error.message : String(error);
      ui.notifications.warn(
        key.startsWith("D6E2.") ? game.i18n.localize(key) : key,
      );
    }
  };

  static override DEFAULT_OPTIONS = {
    actions: {
      acquireFeature: this.#acquire,
      approveFeatureRequest: this.#approve,
      cancelFeatureRequest: this.#cancelRequest,
      previewFeatureTransaction: this.#preview,
      rejectFeatureRequest: this.#reject,
    },
    classes: ["d6e2", "d6e2-free-d6-feature-browser"],
    position: { height: 640, width: 720 },
    tag: "form",
    window: {
      icon: "fa-solid fa-star",
      resizable: true,
      title: "D6E2.FreeD6.Features.ManageTitle",
    },
  };

  override _prepareContext(): Promise<Record<string, unknown>> {
    const owned = new Set(
      this.#actor.items.contents
        .filter((item) => ["perk", "flaw"].includes(item.type))
        .map((item) => String(record(item.system.featureEconomy).definitionId)),
    );
    return Promise.resolve({
      creation: record(this.#actor.system.creation).active === true,
      isGM: game.user?.isGM === true,
      requests: freeD6FeatureRequestViews(this.#actor),
      definitions: featureEconomyRegistry.current().flatMap((catalog) =>
        catalog.definitions
          .filter(({ actorTypes }) => actorTypes.includes(this.#actor.type))
          .map((definition, definitionIndex) => {
            const mechanicalEffectCount = definition.effects.filter(
              ({ kind }) => kind !== "narrative-only",
            ).length;
            const draft = this.#drafts.get(definition.id);
            const preview = this.#previews.get(definition.id);
            const error = this.#errors.get(definition.id) ?? "";
            const defaultValue = defaultPointValue(definition.pointValue);
            const available = !owned.has(definition.id);
            return {
              ...definition,
              available,
              availabilityLabel: game.i18n.localize(
                owned.has(definition.id)
                  ? "D6E2.FreeD6.Features.AlreadyOwned"
                  : "D6E2.FreeD6.Features.Available",
              ),
              draftFocus: draft?.focus ?? "",
              draftPrivate: draft?.private ?? false,
              draftValue: draft?.value ?? String(defaultValue),
              error,
              ariaInvalid: error.length > 0 ? "true" : "false",
              errorId: `d6e2-feature-value-error-${definitionIndex}`,
              fixedValue: definition.pointValue.kind === "exact",
              maximumValue:
                definition.pointValue.kind === "range"
                  ? definition.pointValue.maximum
                  : definition.pointValue.kind === "exact"
                    ? definition.pointValue.value
                    : Number.MAX_SAFE_INTEGER,
              minimumValue:
                definition.pointValue.kind === "exact"
                  ? definition.pointValue.value
                  : definition.pointValue.kind === "choices"
                    ? Math.min(...definition.pointValue.values)
                    : definition.pointValue.minimum,
              pointValueOptions:
                definition.pointValue.kind === "choices"
                  ? definition.pointValue.values.map((value) => ({
                      selected:
                        String(value) ===
                        (draft?.value ?? String(defaultValue)),
                      value,
                    }))
                  : [],
              preview,
              reviewed: preview !== undefined && error.length === 0,
              canAcquire:
                available && preview !== undefined && error.length === 0,
              effectSummary:
                mechanicalEffectCount === 0
                  ? game.i18n.localize("D6E2.FreeD6.Features.NarrativeOnly")
                  : game.i18n.format("D6E2.FreeD6.Features.EffectsCount", {
                      count: mechanicalEffectCount,
                    }),
              provider: catalog.label,
              roleLabel: game.i18n.localize(
                definition.role === "merit"
                  ? "D6E2.FreeD6.Features.Merit"
                  : "D6E2.FreeD6.Features.Flaw",
              ),
              valueControlId: `d6e2-feature-value-${definitionIndex}`,
            };
          }),
      ),
    });
  }
}

export function openFreeD6FeatureBrowser(actor: FoundryActorDocument): void {
  new D6System2eFreeD6FeatureApplication()
    .withActor(actor)
    .render({ force: true });
}
