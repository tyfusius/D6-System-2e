import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildD6RollPool,
  multipleActionPenaltyScore,
  secondEditionBrawnAdjustedThrowRanges,
  secondEditionCoverDefensePlan,
  secondEditionExplosiveRangeForDistance,
  secondEditionNoDodgeDefensePlan,
  secondEditionScaleInteraction,
} from "@d6-system-2e/core";

const rollService = readFileSync(
  new URL("./roll-service.ts", import.meta.url),
  "utf8",
);
const settingsTemplate = readFileSync(
  new URL(
    "../../../../../templates/settings/edition-settings.hbs",
    import.meta.url,
  ),
  "utf8",
);

describe("Second Edition thrown-explosive UI contract", () => {
  const actorOwnedWeaponFixture = Object.freeze({
    actor: Object.freeze({
      id: "SecondEditionThrower",
      system: Object.freeze({
        attributes: Object.freeze({ brawn: Object.freeze({ score: 9 }) }),
      }),
    }),
    item: Object.freeze({
      id: "AuthoredExplosive",
      name: "QA Thrown Explosive",
      parentId: "SecondEditionThrower",
      system: Object.freeze({
        attackAttributeId: "agility",
        attackSkillKey: "throwing",
        equipped: true,
        range: Object.freeze({
          long: 12,
          medium: 7,
          short: 4,
          shortMinimum: 3,
        }),
        weaponKind: "thrown-explosive",
      }),
      type: "weapon",
    }),
  });

  it("keeps the deterministic actor-owned fixture stable across serialization", () => {
    const reloaded: unknown = JSON.parse(
      JSON.stringify(actorOwnedWeaponFixture),
    );

    expect(reloaded).toEqual(actorOwnedWeaponFixture);
  });

  it("covers the adjusted range, pool, MAP, Wild Die, cover, scale, defenses, and rejection matrix", () => {
    const ranges = secondEditionBrawnAdjustedThrowRanges(
      actorOwnedWeaponFixture.item.system.range,
      actorOwnedWeaponFixture.actor.system.attributes.brawn.score,
    );

    expect(ranges).toEqual({
      long: 15,
      medium: 10,
      short: 7,
      shortMinimum: 6,
    });
    expect(secondEditionExplosiveRangeForDistance(5, ranges).band).toBe(
      "point-blank",
    );
    expect(secondEditionExplosiveRangeForDistance(6, ranges).band).toBe(
      "short",
    );
    expect(secondEditionExplosiveRangeForDistance(10, ranges).band).toBe(
      "medium",
    );
    expect(secondEditionExplosiveRangeForDistance(15, ranges).band).toBe(
      "long",
    );
    expect(secondEditionExplosiveRangeForDistance(16, ranges)).toMatchObject({
      band: null,
      maximumDistance: 15,
      outOfRange: true,
    });

    const map = multipleActionPenaltyScore(2);
    const scale = secondEditionScaleInteraction(0, 1);
    const pool = buildD6RollPool(12 - map + scale.attackerAttackBonusScore);
    expect(pool).toMatchObject({
      baseDice: 3,
      code: { dice: 4, pips: 0 },
      wildDice: 1,
    });
    expect(secondEditionCoverDefensePlan(15, 5).defense).toBe(20);
    expect(secondEditionNoDodgeDefensePlan("long", false).defense).toBe(20);
    expect(secondEditionNoDodgeDefensePlan("long", true).defense).toBe(30);
  });

  it("adjusts only typed explosives under the independent Second Edition option", () => {
    expect(rollService).toContain(
      'stringValue(weapon.system.weaponKind) === "thrown-explosive"',
    );
    expect(rollService).toContain("secondEditionBrawnAdjustedThrowRanges");
    expect(rollService).toContain("secondEditionExplosiveRangeForDistance");
    expect(rollService).toContain(
      "TYFUSIUS_HOMEBREW_SETTING_KEYS.secondEditionBrawnGrenadeRanges",
    );
    expect(rollService).toContain('defenseStrategy.family === "static"');
    expect(rollService).toContain('defenseStrategy.family === "range"');
  });

  it("keeps Second Edition attacks on native defense strategies", () => {
    expect(rollService).toContain("const grenadeTarget = firstEditionGrenade");
    expect(rollService).toContain('? "static-dodge"');
    expect(rollService).toContain('? "fixed-range"');
  });

  it("presents the rule inside the single Tyfusius card", () => {
    expect(settingsTemplate).toContain("homebrewSecondEditionSettings");
    expect(settingsTemplate).toContain(
      "D6E2.Settings.TyfusiusHomebrew.Heading",
    );
    expect(settingsTemplate).not.toContain(
      "D6E2.Settings.TyfusiusHomebrew.SecondEditionHeading",
    );
    expect(settingsTemplate).toContain(
      "D6E2.Settings.TyfusiusHomebrew.SecondEditionGrenades.Explanation",
    );
  });
});
