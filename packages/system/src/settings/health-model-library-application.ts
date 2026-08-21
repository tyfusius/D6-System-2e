import type { D6HealthModelV2, D6RulesProfileV3 } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { availableHealthModels } from "./health-model-library";
import { D6System2eHealthModelApplication } from "./health-model-application";
import type { HealthStateReplacementMap } from "./rules-profile-library";
import {
  availableWorldHealthModels,
  deleteWorldHealthModel,
  saveWorldHealthModel,
  worldHealthModelReferences,
} from "./rules-profile-library";

const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);

type TrackModel = Extract<D6HealthModelV2, { readonly kind: "track" }>;
type LibraryChanged = (
  models: readonly D6HealthModelV2[],
  selectedModelId: string,
) => Promise<void> | void;

function isTrack(model: D6HealthModelV2): model is TrackModel {
  return model.kind === "track";
}

function localized(value: string): string {
  return game.i18n.localize(value);
}

export class D6System2eHealthModelLibraryApplication extends Base {
  static override PARTS = {
    form: {
      template: `systems/${SYSTEM_ID}/templates/settings/health-model-library.hbs`,
    },
  };

  #profileId = "world-rules";
  #models: readonly D6HealthModelV2[] = Object.freeze([]);
  #selectedModelId = "d6e2.health.condition-track";
  #isNewProfile = false;
  #onChanged: LibraryChanged = () => undefined;

  withProfile(
    profile: D6RulesProfileV3,
    options: {
      readonly isNewProfile?: boolean;
      readonly onChanged: LibraryChanged;
    },
  ): this {
    this.#profileId = profile.id;
    this.#models = structuredClone(profile.healthModels);
    this.#selectedModelId = profile.strategies.health;
    this.#isNewProfile = options.isNewProfile === true;
    this.#onChanged = options.onChanged;
    return this;
  }

  #allModels(): readonly D6HealthModelV2[] {
    const merged = new Map(
      availableHealthModels().map((model) => [model.id, model]),
    );
    for (const model of availableWorldHealthModels()) {
      merged.set(model.id, model);
    }
    for (const model of this.#models) merged.set(model.id, model);
    return Object.freeze([...merged.values()]);
  }

  #uniqueModelId(seed = "personal"): string {
    const existing = new Set(this.#allModels().map(({ id }) => id));
    let suffix = 1;
    let id = `${this.#profileId}.health.${seed}`;
    while (existing.has(id))
      id = `${this.#profileId}.health.${seed}-${++suffix}`;
    return id;
  }

  async #changed(
    models: readonly D6HealthModelV2[],
    selectedModelId = this.#selectedModelId,
  ): Promise<void> {
    this.#models = Object.freeze(models);
    this.#selectedModelId = selectedModelId;
    await this.#onChanged(this.#models, this.#selectedModelId);
    await this.render({ force: true });
  }

  #openEditor(model: TrackModel | null, isNew = false, modelId?: string): void {
    new D6System2eHealthModelApplication()
      .withModel(
        this.#profileId,
        model,
        async (saved, replacements: HealthStateReplacementMap) => {
          const normalized = this.#isNewProfile
            ? saved
            : await saveWorldHealthModel(this.#profileId, saved, replacements);
          const models = this.#models.some(({ id }) => id === normalized.id)
            ? this.#models.map((entry) =>
                entry.id === normalized.id ? normalized : entry,
              )
            : [...this.#models, normalized];
          await this.#changed(models, normalized.id);
        },
        async (modelId) => {
          if (!this.#isNewProfile) await deleteWorldHealthModel(modelId);
          const models = this.#models.filter(({ id }) => id !== modelId);
          const selected =
            this.#selectedModelId === modelId
              ? "d6e2.health.condition-track"
              : this.#selectedModelId;
          await this.#changed(models, selected);
        },
        { isNew, ...(modelId ? { modelId } : {}) },
      )
      .render(true);
  }

  static readonly #createModel = function (
    this: D6System2eHealthModelLibraryApplication,
  ): void {
    this.#openEditor(null, true, this.#uniqueModelId());
  };

  static readonly #editModel = function (
    this: D6System2eHealthModelLibraryApplication,
    _event: Event,
    target: HTMLElement,
  ): void {
    const model = this.#models.find(({ id }) => id === target.dataset.modelId);
    if (model && isTrack(model)) this.#openEditor(model);
  };

  static readonly #duplicateModel = function (
    this: D6System2eHealthModelLibraryApplication,
    _event: Event,
    target: HTMLElement,
  ): void {
    const source = this.#allModels().find(
      ({ id }) => id === target.dataset.modelId,
    );
    if (!source || !isTrack(source)) return;
    this.#openEditor(
      {
        ...structuredClone(source),
        id: this.#uniqueModelId("copy"),
        label: game.i18n.format("D6E2.Settings.HealthModel.CopyLabel", {
          label: localized(source.label),
        }),
        source: { kind: "world" },
      },
      true,
    );
  };

  static override DEFAULT_OPTIONS = {
    actions: {
      createModel: this.#createModel,
      duplicateModel: this.#duplicateModel,
      editModel: this.#editModel,
    },
    classes: ["d6e2", "d6e2-health-model-library"],
    id: "d6e2-health-model-library",
    position: { height: 720, width: 920 },
    window: {
      icon: "fa-solid fa-heart-pulse",
      resizable: true,
      title: "D6E2.Settings.HealthModel.LibraryTitle",
    },
  };

  override _prepareContext(): Promise<Record<string, unknown>> {
    const worldIds = new Set([
      ...availableWorldHealthModels().map(({ id }) => id),
      ...this.#models.map(({ id }) => id),
    ]);
    const allModels = this.#allModels();
    const row = (model: D6HealthModelV2) => {
      const references = worldHealthModelReferences(model.id);
      const world = worldIds.has(model.id);
      return {
        active: model.id === this.#selectedModelId,
        canDuplicate: isTrack(model),
        canEdit: world && isTrack(model),
        id: model.id,
        label: localized(model.label),
        origin: world
          ? localized("D6E2.Settings.HealthModel.OriginWorld")
          : model.source.kind === "module"
            ? localized("D6E2.Settings.HealthModel.OriginModule")
            : localized("D6E2.Settings.HealthModel.OriginBundled"),
        referenceCount: references.length,
        referenceNames: references.map(({ label }) => label).join(", "),
        stateCount: isTrack(model) ? model.track.states.length : 0,
      };
    };
    const activeModel = allModels.find(
      ({ id }) => id === this.#selectedModelId,
    );
    const worldModels = allModels
      .filter(({ id }) => worldIds.has(id) && id !== this.#selectedModelId)
      .map(row);
    const contributedModels = allModels
      .filter(({ id }) => !worldIds.has(id) && id !== this.#selectedModelId)
      .map(row);
    const missingSelected = allModels.some(
      ({ id }) => id === this.#selectedModelId,
    )
      ? null
      : { id: this.#selectedModelId };
    return Promise.resolve({
      activeModel: activeModel ? row(activeModel) : null,
      contributedModels,
      hasWorldModels: worldModels.length > 0,
      missingSelected,
      selectedModelId: this.#selectedModelId,
      worldModels,
    });
  }
}
