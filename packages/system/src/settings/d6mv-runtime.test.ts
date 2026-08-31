import { describe, expect, it } from "vitest";
import { bundledProfilePresets } from "../registries/profile-presets";
import { actionEconomyRuntimeStrategy } from "./action-economy";
import { advancementRuntimeStrategy } from "./advancement";
import { defenseRuntimeStrategy } from "./defenses";
import { D6MV_STRATEGY_COMPOSITION } from "./d6mv-profile";
import { healthModelForStrategy } from "./health-model-library";
import { initiativeRuntimeStrategy } from "./initiative";
import { movementRuntimeStrategy } from "./movement";
import {
  metaCurrencyRuntimeStrategy,
  retryRuntimeStrategy,
  successRuntimeStrategy,
  wildDieRuntimeStrategy,
} from "./roll-outcome";
import {
  bundledRulesProfiles,
  rulesProfileDiagnostics,
} from "./rules-profile-library";
import { scaleRuntimeStrategy } from "./scale";
import { bundledSettingProfiles } from "./setting-profile";

describe("D6MV bundled runtime composition", () => {
  it("publishes one atomic Rules/Setting preset with every selected strategy available", () => {
    const rules = bundledRulesProfiles().find(({ id }) => id === "d6mv");
    const setting = bundledSettingProfiles().find(
      ({ profile }) => profile.id === "d6mv",
    )?.profile;
    const preset = bundledProfilePresets().find(
      ({ preset: entry }) => entry.id === "d6mv-default",
    )?.preset;
    expect(rules?.strategies).toEqual(D6MV_STRATEGY_COMPOSITION);
    expect(rules && rulesProfileDiagnostics(rules)).toEqual([]);
    expect(setting).toMatchObject({
      id: "d6mv",
      logoAsWatermark: false,
      originRulesFamily: "d6-system-second-edition",
      terminology: { resources: { experiencePoints: "Skill Points" } },
    });
    expect(setting?.attributes).toHaveLength(6);
    expect(setting?.skills).toHaveLength(36);
    expect(preset?.selection).toEqual({
      rulesProfileId: "d6mv",
      settingProfileId: "d6mv",
      version: 1,
    });
  });

  it("resolves every D6MV strategy to its source-specific runtime family", () => {
    expect(
      actionEconomyRuntimeStrategy(D6MV_STRATEGY_COMPOSITION.actionEconomy),
    ).toMatchObject({ family: "d6mv", penalty: "declared-actions-minus-one" });
    expect(
      defenseRuntimeStrategy(D6MV_STRATEGY_COMPOSITION.activeDefenses),
    ).toMatchObject({
      family: "srp",
      fullDefense: "d6mv-resistance-skill-bonus",
    });
    expect(
      advancementRuntimeStrategy(D6MV_STRATEGY_COMPOSITION.advancement),
    ).toMatchObject({ family: "d6mv", cost: "d6mv-split-resources" });
    expect(
      initiativeRuntimeStrategy(D6MV_STRATEGY_COMPOSITION.initiative),
    ).toMatchObject({ family: "d6mv", roundTransition: "clear-rolled-totals" });
    expect(
      movementRuntimeStrategy(D6MV_STRATEGY_COMPOSITION.movement),
    ).toMatchObject({ family: "d6mv", segment: "free-or-action" });
    expect(
      successRuntimeStrategy(D6MV_STRATEGY_COMPOSITION.successEvaluator),
    ).toMatchObject({ threshold: "six-degrees" });
    expect(
      wildDieRuntimeStrategy(D6MV_STRATEGY_COMPOSITION.wildDie),
    ).toMatchObject({ choiceAuthority: "split-d6mv", policy: "d6mv" });
    expect(
      retryRuntimeStrategy(D6MV_STRATEGY_COMPOSITION.retries),
    ).toMatchObject({
      followUp: "hero-reroll",
    });
    expect(
      metaCurrencyRuntimeStrategy(D6MV_STRATEGY_COMPOSITION.metaCurrency),
    ).toMatchObject({
      failedRollReroll: true,
      primaryResource: "heroPoints",
      rollSpend: "double-die-code",
    });
    expect(scaleRuntimeStrategy(D6MV_STRATEGY_COMPOSITION.scale)).toMatchObject(
      {
        id: "d6mv.scale.three-rank",
      },
    );
    expect(
      healthModelForStrategy(D6MV_STRATEGY_COMPOSITION.health),
    ).toMatchObject({
      damageStrategyId: "d6mv.damage.strength-multiples",
      id: "d6mv.health.injury-track",
    });
  });

  it("keeps unknown strategies on the existing safe runtime fallbacks", () => {
    expect(successRuntimeStrategy("missing").id).toBe(
      "d6e2.success.strictly-greater",
    );
    expect(wildDieRuntimeStrategy("missing").policy).toBe("second-edition");
    expect(scaleRuntimeStrategy("missing").id).not.toBe(
      "d6mv.scale.three-rank",
    );
  });
});
