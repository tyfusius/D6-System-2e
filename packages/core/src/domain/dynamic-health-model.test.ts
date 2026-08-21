import { describe, expect, it } from "vitest";
import {
  generateMonotonicDamageTransitions,
  healthDamageOutcomes,
  nextHealthStateAtRoundStart,
  nextHealthStateForDamage,
  normalizeWorldHealthModel,
} from "./dynamic-health-model";

const states = [
  {
    allowsActions: true,
    id: "ready",
    label: "Ready",
    penaltyScore: 0,
    terminal: false,
  },
  {
    allowsActions: true,
    id: "shaken",
    label: "Shaken",
    penaltyScore: 3,
    roundStartStateId: "ready",
    terminal: false,
  },
  {
    allowsActions: false,
    id: "down",
    label: "Down",
    penaltyScore: 6,
    terminal: true,
  },
] as const;

function validModel() {
  const outcomes = healthDamageOutcomes("d6e2.damage.conditions");
  return {
    damageStrategyId: "d6e2.damage.conditions",
    description: "A compact custom track",
    id: "campaign.health.grit",
    kind: "track",
    label: "Grit",
    track: {
      damageTransitions: generateMonotonicDamageTransitions(states, outcomes),
      initialStateId: "ready",
      states,
    },
  };
}

describe("dynamic health-model v2", () => {
  it("normalizes a complete world-owned model and applies damage and round-start transitions", () => {
    const model = normalizeWorldHealthModel(validModel(), "campaign");
    expect(model.version).toBe(2);
    expect(nextHealthStateForDamage(model as never, "ready", "staggered")).toBe(
      "shaken",
    );
    expect(nextHealthStateForDamage(model as never, "down", "wounded")).toBe(
      "down",
    );
    expect(nextHealthStateAtRoundStart(model as never, "shaken")).toBe("ready");
  });

  it("generates complete monotonic rows with absorbing terminal states", () => {
    const outcomes = healthDamageOutcomes("open-d6.damage.wounds");
    const table = generateMonotonicDamageTransitions(states, outcomes);
    expect(Object.keys(table.ready ?? {})).toEqual(outcomes);
    expect(table.ready?.none).toBe("ready");
    expect(table.ready?.dead).toBe("down");
    expect(new Set(Object.values(table.down ?? {}))).toEqual(new Set(["down"]));
  });

  it.each([
    [
      "one state",
      {
        ...validModel(),
        track: { ...validModel().track, states: states.slice(0, 1) },
      },
    ],
    [
      "unsafe penalty",
      {
        ...validModel(),
        track: {
          ...validModel().track,
          states: [
            { ...states[0], penaltyScore: Number.NaN },
            ...states.slice(1),
          ],
        },
      },
    ],
    [
      "no terminal",
      {
        ...validModel(),
        track: {
          ...validModel().track,
          states: states.map((state) => ({ ...state, terminal: false })),
        },
      },
    ],
    [
      "terminal escape",
      {
        ...validModel(),
        track: {
          ...validModel().track,
          damageTransitions: {
            ...validModel().track.damageTransitions,
            down: {
              ...validModel().track.damageTransitions.down,
              wounded: "ready",
            },
          },
        },
      },
    ],
    [
      "missing transition",
      {
        ...validModel(),
        track: {
          ...validModel().track,
          damageTransitions: {
            ...validModel().track.damageTransitions,
            ready: {},
          },
        },
      },
    ],
    [
      "round cycle",
      {
        ...validModel(),
        track: {
          ...validModel().track,
          states: [
            { ...states[0], roundStartStateId: "shaken" },
            states[1],
            states[2],
          ],
        },
      },
    ],
    ["foreign namespace", { ...validModel(), id: "other.health.grit" }],
  ])("rejects %s", (_label, value) => {
    expect(() => normalizeWorldHealthModel(value, "campaign")).toThrow();
  });
});
