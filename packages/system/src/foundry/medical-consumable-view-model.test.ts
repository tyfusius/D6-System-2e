import { describe, expect, it } from "vitest";
import {
  medicalAuthorityViewRequired,
  medicalCombatVM,
  medicalConsumableVmFixtures,
  medicalPhysiologyVM,
  medicalStimAdjustedSheetPenalty,
} from "./medical-consumable-view-model";

describe("medical consumable view models", () => {
  it("keeps the default combat UI absent while the component and state are absent", () => {
    expect(
      medicalCombatVM({
        componentEnabled: false,
        physiology: medicalPhysiologyVM({
          kind: "unknown",
          canClassify: false,
        }),
      }),
    ).toBeUndefined();
  });

  it("provides deterministic ready, blocked, private, expired, and unresolved fixtures", () => {
    const fixtures = medicalConsumableVmFixtures();
    expect(Object.isFrozen(fixtures.dialog.ready)).toBe(true);
    expect(fixtures.dialog.ready.eligible).toBe(true);
    expect(fixtures.dialog.blocked.eligible).toBe(false);
    expect(fixtures.combat.unresolved?.stim?.needsAttention).toBe(true);
    expect(fixtures.combat.expired?.stim?.status).toBe("expired");
    expect(fixtures.combat.woundedParent.combat.condition).toBe("wounded");
    expect(fixtures.dialog.pending.pending).toBe(true);
    expect(fixtures.root.claimed.controls.map(({ action }) => action)).toEqual([
      "continue",
      "end-operation",
    ]);
    expect(fixtures.root.duration1.durationRollHtml).toContain(
      'class="dice-roll"',
    );
    expect(fixtures.root.duration1.resultRows[0]?.value).toBe("1 round");
    expect(fixtures.root.duration6.resultRows[0]?.value).toBe("6 rounds");
    expect(fixtures.root.audience.hidden.resultRows[0]?.value).toBe(
      "Hidden roll",
    );
    expect(fixtures.root.privateApplied.durationRollHtml).not.toContain(">4<");
  });

  it("skips unaffected authority reads and suppresses only the current wound contribution", () => {
    expect(
      medicalAuthorityViewRequired({
        markerVersion: 0,
        storedAuthority: undefined,
      }),
    ).toBe(false);
    expect(
      medicalAuthorityViewRequired({
        markerVersion: 0,
        storedAuthority: { ciphertext: "opaque" },
      }),
    ).toBe(true);
    expect(
      medicalAuthorityViewRequired({ markerVersion: 1, storedAuthority: null }),
    ).toBe(true);
    expect(
      medicalStimAdjustedSheetPenalty({
        applicable: true,
        conditionPenaltyScore: 9,
        woundPenaltyScore: 3,
      }),
    ).toBe(6);
    expect(
      medicalStimAdjustedSheetPenalty({
        applicable: false,
        conditionPenaltyScore: 9,
        woundPenaltyScore: 3,
      }),
    ).toBe(9);
  });
});
