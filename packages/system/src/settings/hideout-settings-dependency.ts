export const HIDEOUT_SETTING_KEY = "secondEditionHiddenBasesModule";
export const HIDEOUT_PREREQUISITE_SETTING_KEY =
  "secondEditionPerksFlawsTalentsModule";
export const HIDEOUT_PIPS_PREREQUISITE_SETTING_KEY = "secondEditionPipsModule";

export type HideoutDependencyAction =
  "disable-dependents" | "enable-prerequisites";

export interface HideoutDependencyValues {
  readonly hiddenBases: boolean;
  readonly perksFlawsTalents: boolean;
  /** The configurable Second Edition Pips setting submitted by the form. */
  readonly pips: boolean;
  /** Whether the submitted Rules Profile + setting provides active Pips. */
  readonly pipsSatisfied: boolean;
}

export function hideoutDependencyAction(
  submitted: HideoutDependencyValues,
  current: HideoutDependencyValues,
): HideoutDependencyAction | null {
  const hiddenBasesMissingRankedFeatures =
    submitted.hiddenBases && !submitted.perksFlawsTalents;
  const rankedFeaturesMissingPips =
    submitted.perksFlawsTalents && !submitted.pipsSatisfied;
  if (!hiddenBasesMissingRankedFeatures && !rankedFeaturesMissingPips) {
    return null;
  }

  const pipsWasDisabled =
    current.pipsSatisfied &&
    current.perksFlawsTalents &&
    !submitted.pipsSatisfied;
  const rankedFeaturesWereDisabled =
    current.hiddenBases &&
    current.perksFlawsTalents &&
    !submitted.perksFlawsTalents;
  return pipsWasDisabled || rankedFeaturesWereDisabled
    ? "disable-dependents"
    : "enable-prerequisites";
}

/**
 * Resolve the only invalid Hideout settings combination without mutating the
 * caller's raw form values. A dismissed dialog returns null and identifies the
 * control that initiated the dependency conflict.
 */
export async function resolveHideoutSettingsDependency(
  submitted: HideoutDependencyValues,
  current: HideoutDependencyValues,
  confirm: (action: HideoutDependencyAction) => Promise<boolean | null>,
  focus: (settingKey: string) => void,
): Promise<HideoutDependencyValues | null> {
  const action = hideoutDependencyAction(submitted, current);
  if (!action) return Object.freeze({ ...submitted });

  if ((await confirm(action)) !== true) {
    focus(
      action === "enable-prerequisites"
        ? submitted.hiddenBases
          ? HIDEOUT_SETTING_KEY
          : HIDEOUT_PREREQUISITE_SETTING_KEY
        : current.pipsSatisfied && !submitted.pipsSatisfied
          ? HIDEOUT_PIPS_PREREQUISITE_SETTING_KEY
          : HIDEOUT_PREREQUISITE_SETTING_KEY,
    );
    return null;
  }

  if (action === "enable-prerequisites") {
    const requiresRankedFeatures =
      submitted.hiddenBases || submitted.perksFlawsTalents;
    return Object.freeze({
      hiddenBases: submitted.hiddenBases,
      perksFlawsTalents: requiresRankedFeatures,
      pips: submitted.pipsSatisfied ? submitted.pips : true,
      pipsSatisfied: true,
    });
  }

  const perksFlawsTalents =
    submitted.perksFlawsTalents && submitted.pipsSatisfied;
  return Object.freeze({
    hiddenBases: submitted.hiddenBases && perksFlawsTalents,
    perksFlawsTalents,
    pips: submitted.pips,
    pipsSatisfied: submitted.pipsSatisfied,
  });
}
