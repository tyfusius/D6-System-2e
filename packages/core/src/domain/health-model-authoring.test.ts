import { describe, expect, it } from "vitest";
import {
  defaultHealthDamageResults,
  diffHealthTransitions,
  healthDamageResultForStrategyPredicate,
  proposeMonotonicHealthTransitions,
  simulateHealthModelDamage,
  validateHealthDamageResults,
} from "./health-model-authoring";
import { normalizeWorldHealthModel } from "./dynamic-health-model";

const echoStates = [
  "healthy",
  "bruised",
  "wounded",
  "serious",
  "critical",
  "incapacitated",
  "dead",
].map((id, index) => ({
  allowsActions: index < 5,
  id,
  label: id,
  penaltyScore: index,
  terminal: id === "dead",
}));

const echoTransitions = Object.fromEntries(
  echoStates.map(({ id }) => [
    id,
    {
      dead: "dead",
      "mortally-wounded": id === "dead" ? "dead" : "critical",
      staggered: id,
      stunned: id,
      wounded: id === "healthy" ? "wounded" : id,
    },
  ]),
);

describe("health-model authoring", () => {
  it("preserves an authored seven-state Echo matrix instead of proportionally remapping wounded", () => {
    const model = normalizeWorldHealthModel(
      {
        damageStrategyId: "d6e2.damage.conditions",
        description: "Echo",
        id: "echo.health.personal",
        kind: "track",
        label: "Echo",
        source: { kind: "world" },
        track: {
          damageTransitions: echoTransitions,
          initialStateId: "healthy",
          states: echoStates,
        },
        version: 2,
      },
      "echo",
    );
    expect(model.version).toBe(3);
    expect(model.kind === "track" && model.track.damageTransitions).toEqual(
      echoTransitions,
    );
    expect(
      model.kind === "track" &&
        simulateHealthModelDamage(model, {
          currentStateId: "wounded",
          incomingResultId: "wounded",
        }).nextStateId,
    ).toBe("wounded");
  });

  it("keeps canonical Healthy + Wounded -> Wounded on a normalized duplicate", () => {
    const transitions = {
      healthy: {
        dead: "dead",
        "mortally-wounded": "dead",
        staggered: "healthy",
        stunned: "wounded",
        wounded: "wounded",
      },
      wounded: {
        dead: "dead",
        "mortally-wounded": "dead",
        staggered: "wounded",
        stunned: "wounded",
        wounded: "wounded",
      },
      dead: {
        dead: "dead",
        "mortally-wounded": "dead",
        staggered: "dead",
        stunned: "dead",
        wounded: "dead",
      },
    };
    const model = normalizeWorldHealthModel(
      {
        damageStrategyId: "d6e2.damage.conditions",
        id: "copy.health.standard",
        kind: "track",
        label: "Standard copy",
        track: {
          damageTransitions: transitions,
          initialStateId: "healthy",
          states: [echoStates[0], echoStates[2], echoStates[6]],
        },
        version: 2,
      },
      "copy",
    );
    expect(
      model.kind === "track" && model.track.damageTransitions.healthy?.wounded,
    ).toBe("wounded");
  });

  it("keeps generation separate and reports exact changed cells", () => {
    const proposed = proposeMonotonicHealthTransitions(
      echoStates,
      "d6e2.damage.conditions",
    );
    const changes = diffHealthTransitions(echoTransitions, proposed);
    expect(changes.length).toBeGreaterThan(0);
    expect(echoTransitions.wounded?.wounded).toBe("wounded");
    expect(changes).toContainEqual(
      expect.objectContaining({
        currentStateId: "wounded",
        from: "wounded",
        outcomeId: "wounded",
      }),
    );
  });

  it("validates continuous difference bands and an open-ended final band", () => {
    const valid = defaultHealthDamageResults("open-d6.damage.wounds");
    expect(validateHealthDamageResults(valid, "open-d6.damage.wounds")).toEqual(
      [],
    );
    const invalid = valid.map((result, index) =>
      index === 2 && result.rule.kind === "difference-band"
        ? {
            ...result,
            rule: { ...result.rule, band: { maximum: 8, minimum: 5 } },
          }
        : result,
    );
    expect(
      validateHealthDamageResults(invalid, "open-d6.damage.wounds"),
    ).toContainEqual(expect.stringContaining("continuous"));
  });

  it("simulates first-edition bands through the persisted matrix", () => {
    const states = echoStates.filter((_state, index) =>
      [0, 2, 4, 6].includes(index),
    );
    const transitions = proposeMonotonicHealthTransitions(
      states,
      "open-d6.damage.wounds",
    );
    const model = normalizeWorldHealthModel(
      {
        damageStrategyId: "open-d6.damage.wounds",
        id: "sim.health.track",
        kind: "track",
        label: "Simulator",
        track: {
          damageResults: defaultHealthDamageResults("open-d6.damage.wounds"),
          damageTransitions: transitions,
          initialStateId: "healthy",
          ruleProvenance: "generated",
          states,
        },
        version: 3,
      },
      "sim",
    );
    expect(
      model.kind === "track" &&
        simulateHealthModelDamage(model, {
          currentStateId: "healthy",
          damage: 17,
          resistance: 7,
        }),
    ).toMatchObject({ difference: 10, incomingResultId: "incapacitated" });
  });

  it("retains an exact zero Damage minus Resistance result", () => {
    const states = echoStates.filter((_state, index) =>
      [0, 2, 4, 6].includes(index),
    );
    const strategyModel = normalizeWorldHealthModel(
      {
        damageStrategyId: "open-d6.damage.wounds",
        id: "world.health.zero-preview",
        kind: "track",
        label: "Zero preview",
        track: {
          damageResults: defaultHealthDamageResults("open-d6.damage.wounds"),
          damageTransitions: proposeMonotonicHealthTransitions(
            states,
            "open-d6.damage.wounds",
          ),
          initialStateId: "healthy",
          states,
        },
        version: 3,
      },
      "world",
    );
    if (strategyModel.kind !== "track") throw new Error("Track required");
    expect(
      simulateHealthModelDamage(strategyModel, {
        currentStateId: "healthy",
        damage: 7,
        resistance: 7,
      }),
    ).toMatchObject({ damage: 7, difference: 0, resistance: 7 });
  });

  it("rejects simulator inputs that the active strategy would ignore", () => {
    const strategyModel = normalizeWorldHealthModel(
      {
        damageStrategyId: "d6e2.damage.conditions",
        id: "sim.health.conditions",
        kind: "track",
        label: "Conditions",
        track: {
          damageTransitions: echoTransitions,
          initialStateId: "healthy",
          states: echoStates,
        },
        version: 2,
      },
      "sim",
    );
    if (strategyModel.kind !== "track") throw new Error("Track required");
    expect(() =>
      simulateHealthModelDamage(strategyModel, {
        currentStateId: "healthy",
        damage: 7,
        incomingResultId: "wounded",
        resistance: 7,
      }),
    ).toThrow("cannot accept Damage or Resistance");

    const bandModel = normalizeWorldHealthModel(
      {
        ...strategyModel,
        damageStrategyId: "open-d6.damage.wounds",
        track: {
          ...strategyModel.track,
          damageResults: defaultHealthDamageResults("open-d6.damage.wounds"),
          damageTransitions: proposeMonotonicHealthTransitions(
            strategyModel.track.states,
            "open-d6.damage.wounds",
          ),
        },
      },
      "sim",
    );
    if (bandModel.kind !== "track") throw new Error("Track required");
    expect(() =>
      simulateHealthModelDamage(bandModel, {
        currentStateId: "healthy",
        damage: 7,
        incomingResultId: "wounded",
        resistance: 7,
      }),
    ).toThrow("cannot accept an incoming result");
  });

  it.each([2, 8])(
    "normalizes and simulates a custom ordered %i-outcome band model",
    (outcomeCount) => {
      const results = Array.from({ length: outcomeCount }, (_, index) => ({
        description: `Result ${index + 1}`,
        id: `result-${index + 1}`,
        label: `Result ${index + 1}`,
        rule: {
          band: {
            minimum:
              index === 0 ? Number.MIN_SAFE_INTEGER : (index - 1) * 4 + 1,
            ...(index === outcomeCount - 1 ? {} : { maximum: index * 4 }),
          },
          kind: "difference-band" as const,
        },
      }));
      const states = echoStates.filter((_state, index) =>
        [0, 2, 6].includes(index),
      );
      const transitions = proposeMonotonicHealthTransitions(
        states,
        results.map(({ id }) => id),
      );
      const normalized = normalizeWorldHealthModel(
        {
          damageStrategyId: "open-d6.damage.wounds",
          id: "custom.health.dynamic-results",
          kind: "track",
          label: "Dynamic results",
          track: {
            damageResults: results,
            damageTransitions: transitions,
            initialStateId: "healthy",
            states,
          },
          version: 3,
        },
        "custom",
      );
      if (normalized.kind !== "track") throw new Error("Track required");
      expect(normalized.track.damageResults.map(({ id }) => id)).toEqual(
        results.map(({ id }) => id),
      );
      expect(
        Object.keys(normalized.track.damageTransitions.healthy ?? {}),
      ).toEqual(results.map(({ id }) => id));
      expect(
        simulateHealthModelDamage(normalized, {
          currentStateId: "healthy",
          damage: 7,
          resistance: 7,
        }).incomingResultId,
      ).toBe("result-1");
    },
  );

  it("validates dynamic outcome identities, labels, and complete band coverage", () => {
    const valid = [
      {
        description: "",
        id: "none",
        label: "No injury",
        rule: {
          band: { maximum: 0, minimum: Number.MIN_SAFE_INTEGER },
          kind: "difference-band" as const,
        },
      },
      {
        description: "",
        id: "hurt",
        label: "Hurt",
        rule: {
          band: { minimum: 1 },
          kind: "difference-band" as const,
        },
      },
    ];
    const [noInjury, hurt] = valid;
    if (!noInjury || !hurt) throw new Error("Expected two damage results");
    expect(validateHealthDamageResults(valid, "open-d6.damage.wounds")).toEqual(
      [],
    );
    expect(
      validateHealthDamageResults(
        [{ ...noInjury, id: "" }, hurt],
        "open-d6.damage.wounds",
      ),
    ).toContainEqual(expect.stringContaining("portable ID"));
    expect(
      validateHealthDamageResults(
        [noInjury, { ...hurt, id: "none" }],
        "open-d6.damage.wounds",
      ),
    ).toContainEqual(expect.stringContaining("unique"));
    expect(
      validateHealthDamageResults(
        [noInjury, { ...hurt, label: " no injury " }],
        "open-d6.damage.wounds",
      ),
    ).toContainEqual(expect.stringContaining("labels must be unique"));
    expect(
      validateHealthDamageResults(
        [
          {
            ...noInjury,
            rule: {
              band: { maximum: 0, minimum: -10 },
              kind: "difference-band" as const,
            },
          },
          hurt,
        ],
        "open-d6.damage.wounds",
      ),
    ).toContainEqual(expect.stringContaining("negative differences"));
  });

  it("maps stable custom result IDs through canonical Second Edition predicates", () => {
    const strategyModel = normalizeWorldHealthModel(
      {
        damageStrategyId: "d6e2.damage.conditions",
        id: "custom.health.strategy-results",
        kind: "track",
        label: "Strategy results",
        track: {
          damageResults: defaultHealthDamageResults(
            "d6e2.damage.conditions",
          ).map((result, index) => ({
            ...result,
            id: `custom-${index + 1}`,
          })),
          damageTransitions: Object.fromEntries(
            echoStates.map(({ id }) => [
              id,
              Object.fromEntries(
                defaultHealthDamageResults("d6e2.damage.conditions").map(
                  (_result, index) => [`custom-${index + 1}`, id],
                ),
              ),
            ]),
          ),
          initialStateId: "healthy",
          states: echoStates,
        },
        version: 3,
      },
      "custom",
    );
    if (strategyModel.kind !== "track") throw new Error("Track required");
    expect(
      healthDamageResultForStrategyPredicate(strategyModel, "d6e2.wounded"),
    ).toBe("custom-3");
  });
});
