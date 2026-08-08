import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("roll outcome runtime ownership", () => {
  it("keeps optional refinements at direct strategy boundaries", () => {
    const runtime = source("./roll-outcome.ts");
    expect(runtime).not.toContain("useFirstEdition");
    expect(runtime).toContain("currentConfiguredRulesProfile().strategies");
    expect(runtime).toContain("SECOND_EDITION_OPTION_KEYS.wildDieStrategy");
    expect(runtime).toContain("SECOND_EDITION_OPTION_KEYS.heroPointStrategy");
  });

  it("prevents execution and Foundry consumers from redispatching on edition outcome flags", () => {
    for (const path of [
      "../application/rolls/execute-roll.ts",
      "../foundry/actor-defaults.ts",
      "../foundry/condition-service.ts",
      "../foundry/hero-point-service.ts",
      "../foundry/rolls/damage-resolution.ts",
      "../foundry/rolls/roll-service.ts",
      "../foundry/sheets/character-sheet.ts",
    ]) {
      const contents = source(path);
      expect(contents).not.toContain("firstEditionMetaCurrency");
      expect(contents).not.toContain("firstEditionRetries");
      expect(contents).not.toContain("firstEditionSuccessEvaluator");
      expect(contents).not.toContain("firstEditionWildDie");
    }
  });

  it("projects the resolved identities and uses neutral sheet presentation", () => {
    expect(source("../foundry/read-models/actor.ts")).toContain(
      "metaCurrencyStrategyId",
    );
    expect(source("../foundry/rolls/roll-service.ts")).toContain(
      "currentWildDieRuntimeStrategy().policy",
    );
    expect(
      source("../../../../templates/actor/character/header.hbs"),
    ).toContain("{{#if openD6MetaCurrency}}");
  });
});
