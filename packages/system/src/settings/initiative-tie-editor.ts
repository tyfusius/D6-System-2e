import type { D6RulesProfileV5 } from "@d6-system-2e/core";
import { currentFirstEditionGenreProfile } from "./first-edition-genre-profile";
import { currentActiveAttributeDefinitions } from "./attributes";
import { boundFirstEditionGenreProfile } from "./rules-profile-genre-binding";
import { normalizeInitiativeBaseTies } from "./rules-profile-initiative-binding";

export const MODERN_INITIATIVE_ID = "open-d6.initiative.perception-base";
export const INITIATIVE_SECONDARY_FIELD =
  "profile.initiativeBaseTies.secondaryAttributeId";

export function initiativeTieAttributes(profile: D6RulesProfileV5) {
  const bound = boundFirstEditionGenreProfile(profile);
  if (bound && bound.id !== currentFirstEditionGenreProfile().id)
    return bound.attributes;
  const vocabulary = currentActiveAttributeDefinitions();
  return bound
    ? bound.attributes.map((a) => ({
        ...a,
        label: vocabulary.find((v) => v.id === a.id)?.label ?? a.label,
      }))
    : vocabulary;
}

export function initiativeTieEditorContext(profile: D6RulesProfileV5) {
  const selected = profile.initiativeBaseTies?.secondaryAttributeId ?? "";
  let attributes: ReturnType<typeof initiativeTieAttributes> = [];
  try {
    attributes = initiativeTieAttributes(profile);
  } catch {
    /* Profile diagnostics explain unavailable genres. */
  }
  const options = [
    {
      value: "",
      label: game.i18n.localize(
        "D6E2.Settings.RulesProfile.InitiativeTie.Choose",
      ),
      selected: !selected,
    },
    ...attributes.map((a) => ({
      value: a.id,
      label: game.i18n.localize(a.label),
      selected: a.id === selected,
    })),
  ];
  if (selected && !attributes.some((a) => a.id === selected))
    options.push({
      value: selected,
      label: game.i18n.format(
        "D6E2.Settings.RulesProfile.InitiativeTie.Unavailable",
        { id: selected },
      ),
      selected: true,
    });
  return {
    enabled: profile.strategies.initiative === MODERN_INITIATIVE_ID,
    label: game.i18n.localize("D6E2.Settings.RulesProfile.InitiativeTie.Label"),
    help: game.i18n.localize("D6E2.Settings.RulesProfile.InitiativeTie.Help"),
    options,
  };
}

export function captureInitiativeTie(
  profile: D6RulesProfileV5,
  form: HTMLElement,
): D6RulesProfileV5 {
  const control = form.querySelector<HTMLSelectElement>(
    `[name="${INITIATIVE_SECONDARY_FIELD}"]`,
  );
  if (!control || profile.strategies.initiative !== MODERN_INITIATIVE_ID)
    return profile;
  const { initiativeBaseTies: _previous, ...rest } = profile;
  void _previous;
  const id = control.value.trim();
  const binding = id
    ? normalizeInitiativeBaseTies({ version: 1, secondaryAttributeId: id })
    : undefined;
  return binding ? { ...rest, initiativeBaseTies: binding } : rest;
}

/** Bound once to each rendered form; toggles without discarding unsaved fields. */
export function bindInitiativeTieEditor(form: HTMLElement): void {
  const strategy = form.querySelector<HTMLSelectElement>(
    '[name="strategy.initiative"]',
  );
  const fields = form.querySelector<HTMLElement>(
    "[data-initiative-tie-fields]",
  );
  if (!strategy || !fields) return;
  const refresh = () => {
    const enabled = strategy.value === MODERN_INITIATIVE_ID;
    fields.hidden = !enabled;
    const select = fields.querySelector<HTMLSelectElement>(
      `[name="${INITIATIVE_SECONDARY_FIELD}"]`,
    );
    if (select) {
      select.disabled = !enabled;
      select.required = enabled;
    }
  };
  if (!strategy.dataset.initiativeTieBound) {
    strategy.addEventListener("change", refresh);
    strategy.dataset.initiativeTieBound = "true";
  }
  refresh();
}
