import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { D6RollRequestV1 } from "@d6-system-2e/core";
import { rollMachinePilot } from "./roll-service";
import { rollDialogLocalize as localize } from "./roll-dialog.test-fixtures";

const f = vi.hoisted(() => ({ prepare: vi.fn(), wait: vi.fn() }));
vi.mock("../destiny-effects", () => ({ prepareDestinyRoll: f.prepare }));
const stopped = new Error("captured-before-dice-and-costs");
let pilot: FoundryActorDocument;
let machine: FoundryActorDocument;
let profile = "second-edition";
let controls: Record<string, unknown>;
let view: Record<string, unknown>;
const update = vi.fn();
const dice = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  profile = "second-edition";
  view = {};
  controls = {
    characterPointSpend: 0,
    fatePointUse: "none",
    heroPointSpend: 0,
    heroPointUse: "none",
    manualDiceAdjustment: 0,
    mapPenaltyDice: 0,
    resultModifier: 0,
    rollMode: "publicroll",
    selectedDistinctionEffectIds: [],
  };
  f.prepare.mockImplementation(() => {
    throw stopped;
  });
  f.wait.mockImplementation(() => Promise.resolve(controls));
  const skill = {
    id: "drive",
    name: "Driving",
    type: "skill",
    system: {
      key: "driving",
      attributeId: "agility",
      score: 3,
      training: "standard",
    },
  };
  const spec = {
    id: "spec",
    name: "Ground craft",
    type: "specialization",
    system: {
      parentSkillId: "drive",
      parentSkillKey: "driving",
      attributeId: "agility",
      score: 3,
    },
  };
  pilot = {
    id: "pilot",
    name: "Pilot",
    type: "npc",
    isOwner: true,
    system: {
      attributes: { agility: { score: 9 } },
      resources: {},
      health: {},
    },
    items: {
      contents: [skill, spec],
      get: (id: string) => [skill, spec].find((item) => item.id === id),
    },
    getFlag: () => undefined,
    update,
  } as unknown as FoundryActorDocument;
  machine = {
    id: "craft",
    name: "Craft",
    type: "starship",
    isOwner: true,
    system: {
      attributes: { maneuverability: { score: 3 } },
      crew: {
        minimum: 1,
        members: [{ actorId: "pilot" }],
        pilotActorId: "pilot",
        pilotSkillId: "drive",
        pilotAttributeId: "",
      },
    },
    update,
  } as unknown as FoundryActorDocument;
  vi.stubGlobal("game", {
    user: { id: "owner", isGM: false, targets: new Set() },
    actors: {
      contents: [pilot, machine],
      get: (id: string) => [pilot, machine].find((actor) => actor.id === id),
    },
    settings: {
      get: (_module: string, key: string) =>
        key === "worldRulesProfiles"
          ? { version: 7, activeProfileId: profile }
          : undefined,
    },
    i18n: { localize, format: localize },
    modules: new Map(),
  });
  vi.stubGlobal("canvas", { tokens: { controlled: [], placeables: [] } });
  vi.stubGlobal("ui", { notifications: { warn: vi.fn(), error: vi.fn() } });
  vi.stubGlobal("Roll", dice);
  vi.stubGlobal("foundry", {
    utils: { randomID: () => "id" },
    applications: {
      handlebars: {
        renderTemplate: (_path: string, data: Record<string, unknown>) => {
          view = data;
          return Promise.resolve("template");
        },
      },
      api: { DialogV2: { wait: f.wait } },
    },
  });
});
afterEach(() => vi.unstubAllGlobals());
function request(): D6RollRequestV1 {
  return f.prepare.mock.calls[0]?.[1] as D6RollRequestV1;
}

describe("Pilot through the existing roll builder", () => {
  it.each(["vehicle", "starship"])(
    "adds OpenD6 %s Maneuverability once to the pilot's selected skill",
    async (type) => {
      profile = "open-d6";
      Object.assign(machine, { type });
      await expect(rollMachinePilot(machine)).rejects.toBe(stopped);
      expect(request()).toMatchObject({
        kind: "skill",
        score: 15,
        source: { actorId: "pilot", itemId: "drive" },
        context: {
          machinePilot: {
            family: "open-d6",
            maneuverabilityScore: 3,
            crewPenaltyScore: 0,
          },
        },
      });
      expect(f.prepare.mock.calls[0]?.[0]).toBe(pilot);
      expect(view.actor).toBe(pilot);
      expect(update).not.toHaveBeenCalled();
      expect(dice).not.toHaveBeenCalled();
    },
  );
  it("uses a selected owned Specialization through the existing parent-skill composition", async () => {
    (machine.system.crew as Record<string, unknown>).pilotSkillId = "spec";
    await expect(rollMachinePilot(machine)).rejects.toBe(stopped);
    expect(request()).toMatchObject({
      score: 18,
      source: { actorId: "pilot", itemId: "spec" },
    });
  });
  it("supports a selected Attribute fallback without fabricating an Item", async () => {
    Object.assign(machine.system.crew as object, {
      pilotSkillId: "",
      pilotAttributeId: "agility",
    });
    await expect(rollMachinePilot(machine)).rejects.toBe(stopped);
    expect(request()).toMatchObject({
      kind: "attribute",
      score: 12,
      source: { actorId: "pilot", attributeId: "agility" },
    });
    expect(request().source.itemId).toBeUndefined();
  });
  it("keeps ordinary 2e vehicle Driving at the selected character pool", async () => {
    Object.assign(machine, { type: "vehicle" });
    await expect(rollMachinePilot(machine)).rejects.toBe(stopped);
    expect(request()).toMatchObject({
      score: 12,
      context: {
        machinePilot: { maneuverabilityScore: 0, crewPenaltyScore: 0 },
      },
    });
  });
  it("applies pilot injury, MAP, and starship understaffing once each", async () => {
    Object.assign(machine.system.crew as object, { minimum: 2 });
    pilot.system.health = { condition: "wounded" };
    controls.mapPenaltyDice = 1;
    await expect(rollMachinePilot(machine)).rejects.toBe(stopped);
    expect(request()).toMatchObject({
      score: 6,
      context: {
        machinePilot: { maneuverabilityScore: 3, crewPenaltyScore: 3 },
      },
    });
  });
  it("cancel leaves dice, costs, and assignment untouched", async () => {
    f.wait.mockResolvedValue(null);
    expect(await rollMachinePilot(machine)).toBeNull();
    expect(f.prepare).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(dice).not.toHaveBeenCalled();
  });
  it("rejects changed machine data before roll preparation or costs", async () => {
    f.wait.mockImplementation(() => {
      machine.system.attributes = { maneuverability: { score: 6 } };
      return Promise.resolve(controls);
    });
    await expect(rollMachinePilot(machine)).rejects.toThrow("PilotChanged");
    expect(f.prepare).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(dice).not.toHaveBeenCalled();
  });
});
