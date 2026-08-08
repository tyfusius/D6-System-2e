const CORE_TEMPLATE_ROOT = "modules/token-action-hud-core/templates";

export const TOKEN_ACTION_HUD_CORE_TEMPLATES = Object.freeze(
  [
    "action",
    "add-popover",
    "custom-style-form",
    "group",
    "hud",
    "list-subgroup",
    "settings",
    "tab-subgroup",
    "form-hud",
    "form-group",
    "form-subgroup",
  ].map((name) => `${CORE_TEMPLATE_ROOT}/${name}.hbs`),
);

interface CoreTemplateLoader {
  loadTemplates(paths: readonly string[]): Promise<unknown>;
}

export async function preloadTokenActionHudCoreTemplates(
  value: unknown,
): Promise<boolean> {
  if (
    typeof value !== "object" ||
    value === null ||
    !("loadTemplates" in value) ||
    typeof value.loadTemplates !== "function"
  ) {
    return false;
  }

  const loader = value as CoreTemplateLoader;
  await loader.loadTemplates(TOKEN_ACTION_HUD_CORE_TEMPLATES);
  return true;
}
