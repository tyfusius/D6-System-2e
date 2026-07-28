import { describe, expect, it } from "vitest";
import type { ActorSource, ItemSource } from "@d6-system-2e/core";
import {
  addMachineActorFields,
  addMachineWeaponFields,
} from "./010-add-machine-actors";

function actor(type: string, system: Record<string, unknown>): ActorSource {
  return { items: [], system, type };
}

describe("schema 10 machine Actor fields", () => {
  it("adds source-backed starship defaults while preserving unknown data", () => {
    const source = actor("starship", { custom: { retained: true } });
    addMachineActorFields(source);
    expect(source.system).toMatchObject({
      attributes: {
        engines: { score: 3 },
        hull: { score: 3 },
        maneuverability: { score: 3 },
        navicomp: { score: 3 },
      },
      crew: { minimum: 1 },
      custom: { retained: true },
      health: { condition: "healthy" },
      shields: { score: 0 },
    });
  });

  it("adds vehicle and creature fields idempotently", () => {
    const vehicle = actor("vehicle", {
      armor: { imported: true, score: 6 },
      passengers: 4,
    });
    const creature = actor("creature", {
      defenses: { dodgeOverride: 25 },
    });
    addMachineActorFields(vehicle);
    addMachineActorFields(creature);
    const snapshot = structuredClone({ creature, vehicle });
    addMachineActorFields(vehicle);
    addMachineActorFields(creature);
    expect({ creature, vehicle }).toEqual(snapshot);
    expect(vehicle.system).toMatchObject({
      armor: { imported: true, score: 6 },
      passengers: 4,
    });
    expect(creature.system.defenses).toEqual({
      dodgeOverride: 25,
      parryOverride: 0,
    });
  });

  it("adds a canonical attack bonus to machine weapons only", () => {
    const weapon: ItemSource = {
      system: { custom: "retained" },
      type: "vehicle-weapon",
    };
    const gear: ItemSource = { system: {}, type: "vehicle-gear" };
    addMachineWeaponFields(weapon);
    addMachineWeaponFields(gear);
    expect(weapon.system).toEqual({
      attackBonus: 0,
      custom: "retained",
    });
    expect(gear.system).toEqual({});
  });
});
