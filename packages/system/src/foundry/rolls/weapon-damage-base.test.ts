import { describe, expect, it, vi } from "vitest";
import {
  legacyRangedStrengthDamageFalsePositive,
  resolveWeaponDamageBase,
} from "./weapon-damage-base";

vi.mock("../../settings/pip-rules", () => ({
  currentCombinedPipScore: (...scores: number[]) =>
    scores.reduce((total, score) => total + score, 0),
  currentEffectivePipScore: (score: number) => score,
}));

function weapon(
  system: Record<string, unknown>,
  type = "weapon",
  flags: Record<string, unknown> = {},
) {
  return {
    flags,
    id: "weapon-1",
    name: "Test Weapon",
    system: { damage: 3, ...system },
    type,
  } as unknown as FoundryItemDocument;
}

function legacyWeaponFlags(
  subtype: "Melee" | "Ranged",
  damage: { readonly muscle: boolean; readonly str: boolean },
  damageBasisAuthored = false,
) {
  return {
    "d6-system-2e": {
      ...(damageBasisAuthored ? { damageBasisAuthored: true } : {}),
      legacyImport: {
        adapter: "star-wars-force-actor.v1",
        preserved: { system: { damage, subtype } },
      },
    },
  };
}

function actor(items: readonly FoundryItemDocument[] = []) {
  return {
    items: { contents: items },
    system: {
      attributes: {
        brawn: { score: 9 },
        knowledge: { score: 6 },
      },
    },
  };
}

function skill(
  key: string,
  score: number,
  training: "advanced" | "standard" = "standard",
) {
  return {
    id: `${key}-id`,
    name: key === "demolitions" ? "Demolitions" : "Engineering",
    system: { attributeId: "knowledge", key, score, training },
    type: "skill",
  } as unknown as FoundryItemDocument;
}

describe("personal Weapon damage bases", () => {
  it("preserves fixed personal and machine damage", () => {
    expect(
      resolveWeaponDamageBase(
        actor(),
        weapon({ damageBasis: "fixed" }),
        "brawn",
        false,
      ),
    ).toMatchObject({
      attributeId: "",
      baseKind: "fixed",
      baseScore: 0,
      listedDamageScore: 3,
      score: 3,
    });
    expect(
      resolveWeaponDamageBase(
        actor(),
        weapon({ damageBasis: "attribute-skill" }, "vehicle-weapon"),
        "brawn",
        false,
      ),
    ).toMatchObject({ baseKind: "fixed", score: 3 });
  });

  it("adds the selected Attribute to listed Weapon damage", () => {
    expect(
      resolveWeaponDamageBase(
        actor(),
        weapon({
          damageAttributeId: "knowledge",
          damageBasis: "attribute-skill",
          damageSkillKey: "",
        }),
        "brawn",
        false,
      ),
    ).toMatchObject({
      attributeId: "knowledge",
      baseKind: "attribute",
      baseScore: 6,
      listedDamageScore: 3,
      score: 9,
    });
  });

  it("uses a standard Skill's complete Attribute-plus-Skill pool", () => {
    expect(
      resolveWeaponDamageBase(
        actor([skill("demolitions", 4)]),
        weapon({
          damageAttributeId: "brawn",
          damageBasis: "attribute-skill",
          damageSkillKey: "demolitions",
        }),
        "brawn",
        false,
      ),
    ).toMatchObject({
      attributeId: "knowledge",
      baseKind: "skill",
      baseScore: 10,
      configuredSkillKey: "demolitions",
      score: 13,
      skillItemId: "demolitions-id",
      skillName: "Demolitions",
    });
  });

  it("uses an Advanced Skill's standalone pool", () => {
    expect(
      resolveWeaponDamageBase(
        actor([skill("engineering", 12, "advanced")]),
        weapon({
          damageAttributeId: "brawn",
          damageBasis: "attribute-skill",
          damageSkillKey: "engineering",
        }),
        "brawn",
        false,
      ),
    ).toMatchObject({ baseKind: "skill", baseScore: 12, score: 15 });
  });

  it("falls back from stale Skill or Attribute keys to a deterministic Attribute pool", () => {
    expect(
      resolveWeaponDamageBase(
        actor(),
        weapon({
          damageAttributeId: "knowledge",
          damageBasis: "attribute-skill",
          damageSkillKey: "missing-skill",
        }),
        "brawn",
        false,
      ),
    ).toMatchObject({
      attributeId: "knowledge",
      baseKind: "stale-skill-fallback",
      baseScore: 6,
      score: 9,
    });
    expect(
      resolveWeaponDamageBase(
        actor(),
        weapon({
          damageAttributeId: "missing-attribute",
          damageBasis: "attribute-skill",
          damageSkillKey: "",
        }),
        "brawn",
        false,
      ),
    ).toMatchObject({
      attributeId: "brawn",
      baseKind: "attribute",
      baseScore: 9,
      score: 12,
    });
  });

  it("preserves legacy OpenD6 Strength Damage and does not apply it in Second Edition", () => {
    const strengthWeapon = weapon({
      damage: 6,
      damageBasis: "strength-damage",
    });
    expect(
      resolveWeaponDamageBase(actor(), strengthWeapon, "brawn", true),
    ).toMatchObject({
      attributeId: "brawn",
      baseKind: "strength-damage",
      baseScore: 6,
      listedDamageScore: 6,
      score: 12,
    });
    expect(
      resolveWeaponDamageBase(actor(), strengthWeapon, "brawn", false),
    ).toMatchObject({ baseKind: "fixed", score: 6 });
  });

  it("keeps an imported ranged Blaster's authored 5D fixed despite the hidden legacy str default", () => {
    const blaster = weapon(
      { damage: 15, damageBasis: "strength-damage" },
      "weapon",
      legacyWeaponFlags("Ranged", { muscle: false, str: true }),
    );

    expect(legacyRangedStrengthDamageFalsePositive(blaster)).toBe(true);
    expect(resolveWeaponDamageBase(actor(), blaster, "brawn", true)).toEqual({
      attributeId: "",
      baseKind: "fixed",
      baseScore: 0,
      configuredSkillKey: "",
      listedDamageScore: 15,
      score: 15,
    });
  });

  it("preserves explicit and genuinely muscle-powered Strength Damage", () => {
    const modern = weapon({ damage: 6, damageBasis: "strength-damage" });
    const legacyMelee = weapon(
      { damage: 3, damageBasis: "strength-damage" },
      "weapon",
      legacyWeaponFlags("Melee", { muscle: false, str: true }),
    );
    const legacyMuscle = weapon(
      { damage: 3, damageBasis: "strength-damage" },
      "weapon",
      legacyWeaponFlags("Ranged", { muscle: true, str: true }),
    );

    expect(resolveWeaponDamageBase(actor(), modern, "brawn", true).score).toBe(
      12,
    );
    expect(
      resolveWeaponDamageBase(actor(), legacyMelee, "brawn", true).score,
    ).toBe(9);
    expect(
      resolveWeaponDamageBase(actor(), legacyMuscle, "brawn", true).score,
    ).toBe(9);
  });

  it("honors an explicit Strength Damage edit on an imported ranged Weapon", () => {
    const authoredLegacyRanged = weapon(
      { damage: 15, damageBasis: "strength-damage" },
      "weapon",
      legacyWeaponFlags("Ranged", { muscle: false, str: true }, true),
    );

    expect(legacyRangedStrengthDamageFalsePositive(authoredLegacyRanged)).toBe(
      false,
    );
    expect(
      resolveWeaponDamageBase(actor(), authoredLegacyRanged, "brawn", true),
    ).toMatchObject({
      baseKind: "strength-damage",
      baseScore: 6,
      listedDamageScore: 15,
      score: 21,
    });
  });
});
