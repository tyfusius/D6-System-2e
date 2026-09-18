import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearMachinePilot,
  configureMachinePilot,
  machineCrew,
  machinePilotContext,
  machinePilotRollLabel,
  requireMachinePilot,
  validateMachinePilotSnapshot,
} from "./machine-pilot";
import { openMachinePilotConfiguration } from "./machine-pilot-dialog";
const f = vi.hoisted(() => ({
  read: vi.fn(),
  profile: {
    strategies: {
      attributes: "open-d6.attributes.six-attribute",
      success: "open-d6.success.meets-or-exceeds",
    },
  },
  wait: vi.fn(),
}));
vi.mock("./read-models/actor", () => ({ actorRollSources: f.read }));
vi.mock("../settings/rules-profile-library", () => ({
  currentConfiguredRulesProfile: () => f.profile,
}));
vi.mock("../settings/pip-rules", () => ({
  currentEffectivePipScore: (n: number) => n,
}));
let machine: FoundryActorDocument;
let pilot: FoundryActorDocument;
let roster: unknown[];
const update = vi.fn().mockResolvedValue(undefined);
beforeEach(() => {
  vi.clearAllMocks();
  f.profile.strategies.success = "open-d6.success.meets-or-exceeds";
  f.read.mockReturnValue({
    attributes: [
      { id: "reflexes", label: "Reflexes", score: 9, rollable: true },
    ],
    skills: [{ id: "drive", label: "Driving", score: 12, rollable: true }],
  });
  pilot = {
    id: "pilot",
    type: "character",
    name: "Pilot",
    isOwner: true,
    img: "pilot.webp",
  } as FoundryActorDocument;
  roster = [
    { actorId: "pilot", name: "Pilot" },
    { actorId: "pilot", name: "Duplicate" },
  ];
  machine = {
    id: "machine",
    type: "vehicle",
    isOwner: true,
    system: {
      crew: {
        members: roster,
        pilotActorId: "pilot",
        pilotSkillId: "drive",
        pilotAttributeId: "",
      },
      attributes: { maneuverability: { score: 3 } },
    },
    update,
  } as unknown as FoundryActorDocument;
  vi.stubGlobal("game", {
    user: { id: "owner", isGM: false },
    actors: { get: (id: string) => (id === "pilot" ? pilot : undefined) },
    i18n: { localize: (key: string) => key, format: (key: string) => key },
  });
  vi.stubGlobal("foundry", {
    applications: { api: { DialogV2: { wait: f.wait } } },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("explicit machine pilot assignment", () => {
  it("disables assignment with inline guidance when there are no authorized crew candidates", () => {
    Object.assign(pilot, { isOwner: false });
    expect(machinePilotContext(machine)).toMatchObject({
      canConfigure: true,
      canAssign: false,
      assignmentUnavailableReason: "D6E2.Machine.PilotAddCrewFirst",
    });
    Object.assign(pilot, { isOwner: true });
    expect(machinePilotContext(machine)).toMatchObject({
      canAssign: true,
      assignmentUnavailableReason: "",
    });
    (machine.system.crew as Record<string, unknown>).members = [];
    expect(machinePilotContext(machine).canAssign).toBe(false);
  });
  it("references a roster actor without duplicating members and counts each actor once", async () => {
    await configureMachinePilot(machine, pilot.id, "skill", "drive");
    expect(update).toHaveBeenCalledExactlyOnceWith({
      "system.crew.pilotActorId": "pilot",
      "system.crew.pilotSkillId": "drive",
      "system.crew.pilotAttributeId": "",
    });
    expect(machineCrew(machine)).toEqual([pilot]);
    expect(machine.system.crew).toMatchObject({ members: roster });
    expect(machinePilotContext(machine)).toMatchObject({
      assigned: true,
      canRoll: true,
      scoreLabel: "5D",
    });
  });
  it("accepts explicit untrained Attribute and clears the previous Skill selection", async () => {
    await configureMachinePilot(machine, pilot.id, "attribute", "reflexes");
    expect(update).toHaveBeenCalledWith({
      "system.crew.pilotActorId": "pilot",
      "system.crew.pilotSkillId": "",
      "system.crew.pilotAttributeId": "reflexes",
    });
  });
  it("clears only the pilot role and preserves the crew roster", async () => {
    await clearMachinePilot(machine);
    expect(update).toHaveBeenCalledExactlyOnceWith({
      "system.crew.pilotActorId": "",
      "system.crew.pilotSkillId": "",
      "system.crew.pilotAttributeId": "",
    });
    expect(machine.system.crew).toMatchObject({ members: roster });
  });
  it.each(["machine", "pilot"])(
    "requires ownership of %s for assignment and rolling",
    async (which) => {
      Object.assign(which === "machine" ? machine : pilot, { isOwner: false });
      await expect(
        configureMachinePilot(machine, pilot.id, "skill", "drive"),
      ).rejects.toThrow();
      expect(() => requireMachinePilot(machine)).toThrow("PilotNotAuthorized");
      expect(update).not.toHaveBeenCalled();
    },
  );
  it("supports GM operation of a crew actor", async () => {
    Object.assign(pilot, { isOwner: false });
    if (game.user) Object.assign(game.user, { isGM: true });
    await configureMachinePilot(machine, pilot.id, "skill", "drive");
    expect(requireMachinePilot(machine).pilot).toBe(pilot);
  });
  it.each([
    "unassigned",
    "missing-actor",
    "missing-skill",
    "unsupported-profile",
  ])("explains %s without changing persistent assignment", (reason) => {
    const crew = machine.system.crew as Record<string, unknown>;
    if (reason === "unassigned") crew.pilotActorId = "";
    if (reason === "missing-actor") crew.pilotActorId = "missing";
    if (reason === "missing-skill") crew.pilotSkillId = "missing";
    if (reason === "unsupported-profile")
      f.profile.strategies.success = "d6mv.success.six-degrees";
    expect(machinePilotContext(machine).canRoll).toBe(false);
    expect(machinePilotContext(machine).unavailableReason).toMatch(
      /^D6E2.Machine./,
    );
    expect(() => requireMachinePilot(machine)).toThrow();
    expect(update).not.toHaveBeenCalled();
  });
  it("revalidates a changed assignment or craft contribution before dice", () => {
    const snapshot = requireMachinePilot(machine);
    (
      machine.system.attributes as Record<string, { score: number }>
    ).maneuverability = { score: 6 };
    expect(() => validateMachinePilotSnapshot(machine, snapshot)).toThrow(
      "PilotChanged",
    );
  });
  it.each([1, 2])(
    "cancelling configuration stage %s writes nothing",
    async (stage) => {
      f.wait.mockResolvedValueOnce(stage === 1 ? null : "pilot");
      if (stage === 2) f.wait.mockResolvedValueOnce(null);
      await openMachinePilotConfiguration(machine);
      expect(update).not.toHaveBeenCalled();
    },
  );
  it("rechecks ownership after both selection dialogs, before persisting", async () => {
    f.wait.mockResolvedValueOnce("pilot").mockImplementationOnce(() => {
      Object.assign(pilot, { isOwner: false });
      return Promise.resolve("skill:drive");
    });
    await expect(openMachinePilotConfiguration(machine)).rejects.toThrow(
      "PilotUnavailable",
    );
    expect(update).not.toHaveBeenCalled();
  });
});

it("derives presentation from validated plan without another source projection", () => {
  const state = requireMachinePilot(machine);
  f.read.mockClear();
  expect(machinePilotRollLabel(machine, state.plan.family)).toBe(
    "D6E2.Machine.RollManeuver",
  );
  expect(f.read).not.toHaveBeenCalled();
});
