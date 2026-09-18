import { describe, expect, it } from "vitest";
import type { ActorSource } from "@d6-system-2e/core";
import { addMachinePilot } from "./060-add-machine-pilots";

describe("schema60 explicit machine pilot", () => {
  it.each(["vehicle", "starship"])(
    "leaves %s unassigned and preserves the full roster idempotently",
    (type) => {
      const crew = {
        members: [{ actorId: "pilot", name: "Pilot", retained: true }],
        minimum: 3,
        extra: "retained",
      };
      const actor: ActorSource = {
        type,
        items: [],
        system: { crew: structuredClone(crew) },
      };
      addMachinePilot(actor);
      addMachinePilot(actor);
      expect(actor.system.crew).toEqual({
        ...crew,
        pilotActorId: "",
        pilotSkillId: "",
        pilotAttributeId: "",
      });
    },
  );
  it("retains explicit assignment and source selection", () => {
    const crew = {
      pilotActorId: "actor",
      pilotSkillId: "skill",
      pilotAttributeId: "",
      members: [],
    };
    const actor: ActorSource = {
      type: "vehicle",
      items: [],
      system: { crew: structuredClone(crew) },
    };
    addMachinePilot(actor);
    expect(actor.system.crew).toEqual(crew);
  });
  it("does not add pilot state to a character", () => {
    const actor: ActorSource = { type: "character", items: [], system: {} };
    addMachinePilot(actor);
    expect(actor.system).toEqual({});
  });
});
