import { describe, expect, it } from "vitest";
import {
  clearSecretIdentityName,
  gainSecretIdentitySuspicion,
  initialSecretIdentityState,
  makeSecretIdentityPublic,
  reinforceSecretIdentity,
  spendSecretIdentityHeroPoint,
  superpowerTalentCostPlan,
  superheroicEquipmentRebuildDays,
  superheroicEquipmentStateAfterComplication,
  superheroicEquipmentUsePenaltyScore,
  superheroicDieCodeCapPlan,
  nemesisEncounterPointPool,
  nemesisExperienceAward,
} from "./superheroic";

describe("superheroic campaign foundations", () => {
  it("refreshes Nemesis Points and mirrors only positive hero XP awards", () => {
    expect(nemesisEncounterPointPool(1)).toBe(4);
    expect(nemesisEncounterPointPool(6)).toBe(9);
    expect(() => nemesisEncounterPointPool(0)).toThrow(RangeError);
    expect(nemesisExperienceAward(4, 7)).toBe(3);
    expect(nemesisExperienceAward(7, 4)).toBe(0);
  });
  it("caps whole dice while preserving legal pips", () => {
    expect(superheroicDieCodeCapPlan(50, "standard")).toMatchObject({
      applied: true,
      capDice: 15,
      cappedScore: 47,
      originalScore: 50,
    });
    expect(superheroicDieCodeCapPlan(50, "standard", true)).toMatchObject({
      applied: false,
      bypassed: true,
      cappedScore: 50,
    });
  });

  it("tracks the bounded secret-identity Hero Point pool", () => {
    const initial = initialSecretIdentityState();
    const reinforced = reinforceSecretIdentity(initial);
    expect(reinforced.heroPoints).toBe(2);
    expect(spendSecretIdentityHeroPoint(reinforced).heroPoints).toBe(1);
  });

  it("exposes an identity when the d6 is at or below Suspicion", () => {
    const result = gainSecretIdentitySuspicion(
      { ...initialSecretIdentityState(), suspicion: 2 },
      3,
      true,
    );
    expect(result.exposed).toBe(true);
    expect(result.state).toMatchObject({
      heroPoints: 2,
      status: "exposed",
      suspicion: 3,
    });
    expect(clearSecretIdentityName(result.state)).toMatchObject({
      status: "active",
      suspicion: 0,
    });
  });

  it("makes going public permanent and removes the private pool", () => {
    expect(
      makeSecretIdentityPublic(initialSecretIdentityState()),
    ).toMatchObject({ heroPoints: 0, status: "public" });
  });

  it("prices ranked Superpower Talents with per-rank enhancements and one-time limitations", () => {
    expect(superpowerTalentCostPlan(2, 3, 1, 4)).toMatchObject({
      baseCostPerRank: 2,
      enhancementCostPerRank: 1,
      limitationCredit: 4,
      rank: 3,
      totalCost: 5,
    });
    expect(superpowerTalentCostPlan(0, 1, 0, 99).totalCost).toBe(1);
  });

  it("resolves superheroic equipment penalties, rebuild time, and complications", () => {
    expect(superheroicEquipmentUsePenaltyScore("hero-a", "hero-a")).toBe(0);
    expect(superheroicEquipmentUsePenaltyScore("hero-a", "hero-b")).toBe(3);
    expect(
      superheroicEquipmentRebuildDays([{ totalCost: 2 }, { totalCost: 4 }]),
    ).toBe(6);
    expect(
      superheroicEquipmentRebuildDays([{ totalCost: 6 }], true),
    ).toBeNull();
    expect(superheroicEquipmentStateAfterComplication("ready")).toBe(
      "malfunctioning",
    );
    expect(superheroicEquipmentStateAfterComplication("destroyed")).toBe(
      "destroyed",
    );
  });
});
