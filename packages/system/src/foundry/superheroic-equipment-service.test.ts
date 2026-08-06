import { afterEach, describe, expect, it, vi } from "vitest";
import { SECOND_EDITION_OPTION_KEYS } from "../settings/settings-catalog";
import { rollSkill } from "./rolls/roll-service";
import {
  actorSuperheroicEquipmentRebuildDays,
  readActorSuperheroicEquipmentPowers,
  relyOnActorGearPower,
  setActorSuperheroicEquipmentState,
  useActorGadget,
} from "./superheroic-equipment-service";

vi.mock("./rolls/roll-service", () => ({
  rollAttribute: vi.fn(),
  rollSkill: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function fixture() {
  const talent = {
    id: "power-1",
    name: "Custom Power",
    system: {
      cost: 2,
      rank: 2,
      superpower: true,
      superpowerAutomatic: false,
      superpowerEnhancementCost: 1,
      superpowerLimitationCredit: 2,
    },
    type: "talent",
  };
  const gear = {
    id: "gear-1",
    name: "Custom Gear",
    system: {
      equipped: true,
      superheroicCreatorActorId: "hero",
      superheroicEquipmentKind: "gear",
      superheroicEquipmentState: "ready",
      superheroicPowerSnapshots: [] as {
        automatic: boolean;
        name: string;
        sourceItemId: string;
        totalCost: number;
      }[],
      superheroicPowerTalentIds: ["power-1"],
      superheroicRebuildDisabled: false,
    },
    type: "gear",
    update: vi.fn((changes: Record<string, unknown>) => {
      const state = changes["system.superheroicEquipmentState"];
      if (typeof state === "string") {
        gear.system.superheroicEquipmentState = state;
      }
      return Promise.resolve();
    }),
  };
  const items = [talent, gear];
  const actor = {
    id: "hero",
    isOwner: true,
    items: {
      contents: items,
      get: (id: string) => items.find((item) => item.id === id),
    },
    name: "Hero",
    system: {},
    type: "character",
    update: vi.fn(),
  };
  return { actor, gear };
}

function stubWorld() {
  const settings = new Map<string, unknown>([
    [SECOND_EDITION_OPTION_KEYS.perksFlawsTalentsModule, true],
    [SECOND_EDITION_OPTION_KEYS.superpowersModule, true],
    [SECOND_EDITION_OPTION_KEYS.gadgetsGearModule, true],
  ]);
  const create = vi.fn((message: unknown) => {
    void message;
    return Promise.resolve();
  });
  vi.stubGlobal("game", {
    i18n: { localize: (key: string) => key },
    settings: { get: (_namespace: string, key: string) => settings.get(key) },
    user: { isGM: true },
  });
  vi.stubGlobal("ChatMessage", {
    create,
    getSpeaker: () => ({}),
  });
  return create;
}

describe("superheroic equipment service", () => {
  it("derives contained power cost and normal rebuild time from live Talents", () => {
    const { actor } = fixture();
    stubWorld();
    expect(readActorSuperheroicEquipmentPowers(actor, "gear-1")).toEqual([
      {
        automatic: false,
        name: "Custom Power",
        sourceItemId: "power-1",
        totalCost: 4,
      },
    ]);
    expect(actorSuperheroicEquipmentRebuildDays(actor, "gear-1")).toBe(4);
  });

  it("audits contained-power use and GM condition transitions", async () => {
    const { actor, gear } = fixture();
    const create = stubWorld();
    await relyOnActorGearPower(actor, "gear-1", "power-1");
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      flags: {
        "d6-system-2e": {
          kind: "superheroicGearPower",
          penaltyScore: 0,
        },
      },
    });
    await setActorSuperheroicEquipmentState(actor, "gear-1", "destroyed");
    expect(gear.system.superheroicEquipmentState).toBe("destroyed");
    await setActorSuperheroicEquipmentState(actor, "gear-1", "ready");
    expect(gear.system.superheroicEquipmentState).toBe("ready");
  });

  it("marks a Gadget malfunctioning after its completed Complication roll", async () => {
    const { actor, gear } = fixture();
    gear.system.superheroicEquipmentKind = "gadget";
    Object.assign(gear.system, {
      gadgetTargetId: "skill-1",
      gadgetTargetKind: "skill",
      gadgetUseCase: "A narrow test",
    });
    stubWorld();
    vi.mocked(rollSkill).mockResolvedValue({
      wildOutcome: "complication",
    } as Awaited<ReturnType<typeof rollSkill>>);
    await useActorGadget(actor, "gear-1");
    expect(rollSkill).toHaveBeenCalledWith(actor, "skill-1", {
      gadgetBonus: { itemId: "gear-1" },
    });
    expect(gear.system.superheroicEquipmentState).toBe("malfunctioning");
  });

  it("uses the persisted power snapshot and audits -1D for a borrower", async () => {
    const { actor, gear } = fixture();
    actor.id = "borrower";
    actor.items.contents.splice(0, 1);
    gear.system.superheroicPowerSnapshots = [
      {
        automatic: false,
        name: "Custom Power",
        sourceItemId: "power-1",
        totalCost: 4,
      },
    ];
    const create = stubWorld();
    await relyOnActorGearPower(actor, "gear-1", "power-1");
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      flags: {
        "d6-system-2e": {
          kind: "superheroicGearPower",
          penaltyScore: 3,
        },
      },
    });
  });
});
