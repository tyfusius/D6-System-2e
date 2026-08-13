import {
  D6_EXTRAORDINARY_POWER_FRAMEWORK_CONTRACT_VERSION,
  type D6ExtraordinaryPowerStateV1,
  type D6ResolvedExtraordinaryPowerFrameworkV1,
  type D6System2eApiV2,
} from "@d6-system-2e/core";
import { describe, expect, it } from "vitest";
import { extraordinaryPowerSheetModel } from "./extraordinary-power-sheet-model";

const framework: D6ResolvedExtraordinaryPowerFrameworkV1 = Object.freeze({
  activation: Object.freeze({
    actionPenalty: "one-per-skill-check",
    strategy: "all-required-skills",
    usesWildDie: true,
  }),
  id: "test.force",
  label: "The Force",
  maintenance: Object.freeze({
    actionPenalty: "one-per-maintained-power",
    strategy: "active-toggle",
  }),
  ownerId: "test-companion",
  powers: Object.freeze([
    Object.freeze({
      checks: Object.freeze([{ difficulty: 10, skillRoleId: "control" }]),
      id: "accelerate-healing",
      label: "Accelerate Healing",
      maintenance: "none" as const,
    }),
    Object.freeze({
      checks: Object.freeze([{ difficulty: 12, skillRoleId: "control" }]),
      id: "affect-mind",
      label: "Affect Mind",
      maintenance: "none" as const,
    }),
  ]),
  resourceRoles: Object.freeze([]),
  skillRoles: Object.freeze([
    Object.freeze({
      id: "control",
      itemKey: "force-control",
      label: "Control",
    }),
  ]),
  version: D6_EXTRAORDINARY_POWER_FRAMEWORK_CONTRACT_VERSION,
});

function actor(
  contents: readonly Record<string, unknown>[] = [],
  frameworks: Record<string, unknown> = {},
): FoundryActorDocument {
  return {
    isOwner: true,
    items: {
      contents,
      get: (id: string) => contents.find((item) => item.id === id),
    },
    system: { extraordinaryPowers: { frameworks } },
  } as unknown as FoundryActorDocument;
}

function state(
  boundPowerId = "",
  boundItemId = "",
): D6ExtraordinaryPowerStateV1 {
  return Object.freeze({
    contractVersion: D6_EXTRAORDINARY_POWER_FRAMEWORK_CONTRACT_VERSION,
    frameworkId: framework.id,
    frameworkLabel: framework.label,
    maintainedPowerIds: Object.freeze([]),
    powers: Object.freeze(
      framework.powers.map((power) =>
        Object.freeze({
          available: power.id === boundPowerId,
          boundItemId: power.id === boundPowerId ? boundItemId : "",
          id: power.id,
          label: power.label,
          maintained: false,
          missingPowerIds: Object.freeze([]),
          missingRoleIds: Object.freeze([]),
        }),
      ),
    ),
    resources: Object.freeze([]),
    skillBindings: Object.freeze([]),
  });
}

function api(currentState = state()): D6System2eApiV2 {
  return {
    extraordinaryPowerFrameworkRegistry: {
      current: () => Object.freeze([framework]),
    },
    extraordinaryPowers: {
      read: () => currentState,
    },
  } as unknown as D6System2eApiV2;
}

describe("extraordinary power character sheet model", () => {
  it("does not expose a globally registered framework to an unrelated actor", () => {
    expect(extraordinaryPowerSheetModel(actor(), api()).frameworks).toEqual([]);
  });

  it("recognizes framework state and shows only bound actor powers", () => {
    const hero = actor(
      [
        {
          id: "healing-item",
          name: "Accelerate Healing",
          system: { key: "accelerate-healing" },
          type: "manifestation",
        },
      ],
      { "test%2Eforce": { powerBindings: {} } },
    );
    const model = extraordinaryPowerSheetModel(
      hero,
      api(state("accelerate-healing", "healing-item")),
    );

    expect(model.frameworks).toHaveLength(1);
    expect(model.frameworks[0]?.powers.map(({ id }) => id)).toEqual([
      "accelerate-healing",
    ]);
  });

  it("recognizes an actor from a matching embedded framework Skill", () => {
    const hero = actor([
      {
        id: "control-skill",
        name: "Control",
        system: { key: "force-control" },
        type: "skill",
      },
    ]);

    const model = extraordinaryPowerSheetModel(hero, api());
    expect(model.frameworks).toHaveLength(1);
    expect(model.frameworks[0]?.powers).toEqual([]);
  });

  it("offers an owned keyed power even before a stale binding is repaired", () => {
    const hero = actor([
      {
        id: "mind-item",
        name: "Affect Mind",
        system: { key: "affect-mind" },
        type: "manifestation",
      },
    ]);

    const model = extraordinaryPowerSheetModel(hero, api());
    expect(model.frameworks[0]?.powers.map(({ id }) => id)).toEqual([
      "affect-mind",
    ]);
  });
});
