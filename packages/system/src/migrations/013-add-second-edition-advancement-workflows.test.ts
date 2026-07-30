import { describe, expect, it } from "vitest";
import type { ActorSource } from "@d6-system-2e/core";
import { addSecondEditionAdvancementWorkflows } from "./013-add-second-edition-advancement-workflows";

function actor(
  system: Record<string, unknown>,
  type = "character",
): ActorSource {
  return { items: [], system, type };
}

describe("schema 13 Second Edition advancement workflows", () => {
  it("adds empty Milestone balances and Narrative arcs", () => {
    const source = actor({});
    addSecondEditionAdvancementWorkflows(source);
    expect(source.system.advancement).toEqual({
      milestone: { attributeDice: 0, skillPips: 0 },
      narrativeArcs: [],
    });
  });

  it("preserves valid balances, arcs, and unrelated advancement state", () => {
    const arcs = [{ id: "arc-1", title: "Master the blade" }];
    const source = actor({
      advancement: {
        milestone: { attributeDice: 2, skillPips: 12 },
        narrativeArcs: arcs,
        retained: true,
      },
    });
    addSecondEditionAdvancementWorkflows(source);
    expect(source.system.advancement).toEqual({
      milestone: { attributeDice: 2, skillPips: 12 },
      narrativeArcs: arcs,
      retained: true,
    });
  });

  it("is idempotent and ignores non-personal Actors", () => {
    const source = actor({
      advancement: {
        milestone: { attributeDice: -2, skillPips: "bad" },
      },
    });
    const vehicle = actor({}, "vehicle");
    addSecondEditionAdvancementWorkflows(source);
    addSecondEditionAdvancementWorkflows(source);
    addSecondEditionAdvancementWorkflows(vehicle);
    expect(source.system.advancement).toEqual({
      milestone: { attributeDice: 0, skillPips: 0 },
      narrativeArcs: [],
    });
    expect(vehicle.system).toEqual({});
  });
});
