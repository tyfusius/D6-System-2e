import { describe, expect, it } from "vitest";
import {
  clearSecretIdentityName,
  gainSecretIdentitySuspicion,
  initialSecretIdentityState,
  makeSecretIdentityPublic,
  reinforceSecretIdentity,
  spendSecretIdentityHeroPoint,
  superheroicDieCodeCapPlan,
} from "./superheroic";

describe("superheroic campaign foundations", () => {
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
});
