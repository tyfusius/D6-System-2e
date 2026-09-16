import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMedicalConsumableRoot } from "../application/medical-consumable-root";
import { medicalRootViewModel } from "./medical-consumable-root";

vi.mock("./medical-consumable-authority", () => ({
  MEDICAL_ROOT_FLAG: "medicalConsumableRoot",
  registerMedicalConsumableAuthority: vi.fn(),
  requestMedicalRoot: vi.fn(),
  setMedicalRootRenderer: vi.fn(),
}));
vi.mock("../settings/setting-values", () => ({
  currentDefaultRollMode: () => "publicroll",
}));
vi.mock("./first-edition-action-roll-ports", () => ({
  createFoundryFirstEditionRollPorts: vi.fn(),
}));
vi.mock("./initiating-action-message", () => ({
  hydrateD6FoundryRolls: () => Promise.resolve([]),
}));
vi.mock("./health-runtime", () => ({
  readActorHealth: () => ({
    kind: "track",
    modelId: "open-d6.health.wound-track",
    damageStrategyId: "open-d6.damage.wounds",
    track: {
      currentStateId: "healthy",
      currentState: {
        id: "healthy",
        label: "D6E2.Condition.Healthy",
      },
      states: [
        { id: "healthy", label: "D6E2.Condition.Healthy" },
        { id: "wounded", label: "D6E2.Condition.Wounded" },
      ],
    },
  }),
}));

describe("medical consumable root view model", () => {
  beforeEach(() => {
    const documents = new Map<string, unknown>([
      ["Actor.administrator", { name: "Administrator" }],
      ["Actor.patient", { name: "Patient" }],
      ["Actor.administrator.Item.stim", { name: "Model B Stim" }],
    ]);
    vi.stubGlobal("fromUuid", (uuid: string) =>
      Promise.resolve(documents.get(uuid)),
    );
    vi.stubGlobal("game", {
      i18n: {
        localize: (key: string) =>
          key === "D6E2.Condition.Wounded" ? "Wounded" : key,
      },
    });
  });

  it("uses the patient header once and the active health state label for injury", async () => {
    const root = createMedicalConsumableRoot({
      rootMessageId: "medicalroot00001",
      useId: "medicaluse000001",
      initiatorUserId: "owner",
      coordinatorUserId: "gm",
      controllerUserId: "owner",
      administrator: {
        actorId: "administrator",
        actorUuid: "Actor.administrator",
      },
      patient: { actorId: "patient", actorUuid: "Actor.patient" },
      item: {
        actorUuid: "Actor.administrator",
        itemId: "stim",
        itemUuid: "Actor.administrator.Item.stim",
        beforeQuantity: 2,
      },
      injury: "wounded",
      rollMode: "publicroll",
      runtime: {
        profileId: "open-d6",
        healthModelId: "open-d6.health.wound-track",
        damageStrategyId: "open-d6.damage.wounds",
        actionEconomyStrategyId: "open-d6.action-economy.flexible",
      },
    });

    const view = await medicalRootViewModel(root);
    expect(view.patientLabel).toBe("Patient");
    expect(view.contextRows).toEqual([
      { label: "D6E2.Medical.Root.Injury", value: "Wounded" },
      {
        label: "D6E2.Medical.Root.Action",
        value: "D6E2.Medical.Root.OneAction",
      },
      {
        label: "D6E2.Medical.Root.Dose",
        value: "D6E2.Medical.Root.OneDose",
      },
    ]);
  });
});
