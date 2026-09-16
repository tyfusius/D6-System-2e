import translations from "../../../../../lang/en.json";
import { rollVisibility } from "./roll-dialog-controls";

export function rollDialogLocalize(key: string): string {
  return (translations as Record<string, string>)[key] ?? key;
}

/** Real-template fixtures for Core behavior tests and Design's separate renders. */
export function rollDialogFixture(overrides: Record<string, unknown> = {}) {
  const visibility = rollVisibility("publicroll", rollDialogLocalize);
  return {
    actor: {
      id: "actor",
      name: "Example character",
      img: "icons/svg/mystery-man.svg",
    },
    label: "Skill check",
    baseScore: 12,
    scoreLabel: "4D",
    finalDifficulty: "—",
    defaultDifficulty: undefined,
    hasFixedDifficulty: false,
    hasRollDescriptionRegion: true,
    rollDescription: "A short description.",
    rollDescriptionFull: "A short description.",
    showDifficultyControls: true,
    showModifierControls: true,
    showMapControl: true,
    showRollOptions: true,
    showOppositionControls: true,
    mapPenaltyDice: 0,
    manualDiceAdjustment: 0,
    rollVisibility: visibility,
    rollModeLocked: false,
    publicRollSelected: true,
    rollOptionsSummary: `${visibility.label} · ${rollDialogLocalize("D6E2.Roll.Options.None")}`,
    manualOppositionSummary: rollDialogLocalize("D6E2.Roll.Opposition.NotSet"),
    actorKindPlayer: true,
    actorKindNonPlayer: false,
    actorKindUnknown: false,
    opponentKindUnknown: true,
    ...overrides,
  };
}
