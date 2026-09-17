import { SECOND_EDITION_OPTION_KEYS } from "./settings-catalog";

export const SHEET_RULE_ACTIVATIONS = {
  hideouts: [SECOND_EDITION_OPTION_KEYS.hiddenBasesModule],
  gadgetsGear: [
    SECOND_EDITION_OPTION_KEYS.gadgetsGearModule,
    SECOND_EDITION_OPTION_KEYS.superpowersModule,
  ],
  superpowers: [SECOND_EDITION_OPTION_KEYS.superpowersModule],
} as const;

export type SheetRuleActivation = keyof typeof SHEET_RULE_ACTIVATIONS;

export function isSheetRuleActivation(
  value: string,
): value is SheetRuleActivation {
  return Object.hasOwn(SHEET_RULE_ACTIVATIONS, value);
}

/** Open an unsaved activation draft; the existing settings Save owns consent and persistence. */
export async function openSheetRuleActivation(
  _event: Event,
  target: HTMLElement,
): Promise<void> {
  const rule = target.dataset.ruleActivation ?? "";
  if (game.user?.isGM !== true || !isSheetRuleActivation(rule)) return;
  const { D6System2eSecondEditionSettings } =
    await import("./settings-application");
  await new D6System2eSecondEditionSettings()
    .withRuleActivation(rule)
    .render(true);
}
