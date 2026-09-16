import { beforeAll, describe, expect, it, vi } from "vitest";
import type { D6MedicalConsumableUseDialog } from "./medical-consumable-dialog";

vi.mock("./application-v2-form-options", () => ({
  applicationV2FormOptions: (value: unknown) => value,
}));
vi.mock("./medical-consumable-root", () => ({
  startMedicalConsumableRoot: vi.fn(),
}));
vi.mock("./combat-service", () => ({
  readCombatantRound: () => null,
}));
vi.mock("../settings/action-economy", () => ({
  currentActionEconomyRuntimeStrategy: () => ({
    declaration: "action-commitment",
  }),
}));
vi.mock("../settings/rules-profile-library", () => ({
  currentConfiguredRulesProfile: () => ({
    homebrew: { tyfusiusMedicalConsumables: true },
  }),
}));
vi.mock("./health-runtime", () => ({
  readActorHealth: (actor: { wound?: string }) => ({
    kind: "track",
    modelId: "open-d6.health.wound-track",
    damageStrategyId: "open-d6.damage.wounds",
    track: { currentStateId: actor.wound ?? "wounded" },
  }),
}));
vi.mock("./foundry-random-id", () => ({
  foundryRandomId: () => "opaque-operation",
}));

class FakeSelect {
  value: string;
  listener?: (event: { currentTarget: FakeSelect }) => void;

  constructor(value: string) {
    this.value = value;
  }

  addEventListener(
    _name: string,
    listener: (event: { currentTarget: FakeSelect }) => void,
  ): void {
    this.listener = listener;
  }

  change(value: string): void {
    this.value = value;
    this.listener?.({ currentTarget: this });
  }
}

describe("medical consumable dialog selection lifecycle", () => {
  let Dialog: typeof D6MedicalConsumableUseDialog;

  beforeAll(async () => {
    class ApplicationV2 {
      element: { querySelector: (selector: string) => FakeSelect | null } = {
        querySelector: () => null,
      };
      render = vi.fn(() => Promise.resolve(this));
      close = vi.fn(() => Promise.resolve());

      _onRender(): Promise<void> {
        return Promise.resolve();
      }
    }
    vi.stubGlobal("foundry", {
      applications: {
        api: {
          ApplicationV2,
          HandlebarsApplicationMixin: (Base: typeof ApplicationV2) => Base,
        },
      },
    });
    Dialog = (await import("./medical-consumable-dialog"))
      .D6MedicalConsumableUseDialog;
  });

  it("preserves visibility and recomputes eligibility after patient changes", async () => {
    const administrator = {
      id: "administrator",
      uuid: "Actor.administrator",
      name: "Administrator",
      type: "character",
      wound: "wounded",
      system: {
        health: { firstEditionState: { consciousness: "conscious" } },
        medical: {
          physiology: { kind: "biological" },
          stim: { version: 0 },
        },
      },
    };
    const blocked = {
      id: "blocked",
      uuid: "Actor.blocked",
      name: "A Blocked Patient",
      type: "character",
      wound: "healthy",
      system: {
        health: { firstEditionState: { consciousness: "conscious" } },
        medical: {
          physiology: { kind: "biological" },
          stim: { version: 0 },
        },
      },
    };
    const eligible = {
      id: "eligible",
      uuid: "Actor.eligible",
      name: "B Eligible Patient",
      type: "character",
      wound: "wounded",
      system: {
        health: { firstEditionState: { consciousness: "conscious" } },
        medical: {
          physiology: { kind: "biological" },
          stim: { version: 0 },
        },
      },
    };
    vi.stubGlobal("game", {
      users: {
        contents: [
          { active: true, character: blocked },
          { active: true, character: eligible },
        ],
      },
      settings: { get: () => "publicroll" },
      i18n: { localize: (key: string) => key, format: (key: string) => key },
    });
    vi.stubGlobal("canvas", { tokens: { placeables: [] } });
    const item = {
      parent: administrator,
      system: { quantity: 1 },
    } as unknown as FoundryItemDocument;
    const dialog = new Dialog().withItem(item);
    const useMode = new FakeSelect("self");
    const patient = new FakeSelect(administrator.uuid);
    const rollMode = new FakeSelect("publicroll");
    Object.defineProperty(dialog, "element", {
      value: {
        querySelector: (selector: string) =>
          selector.includes("useMode")
            ? useMode
            : selector.includes("patientUuid")
              ? patient
              : selector.includes("rollMode")
                ? rollMode
                : null,
      },
    });
    await dialog._onRender({}, { parts: [] });
    rollMode.change("blindroll");
    useMode.change("administer");
    const blockedContext = (await dialog._prepareContext()) as {
      partId?: string;
      rollMode: string;
      rollModeOptions: readonly {
        value: string;
        label: string;
        selected: boolean;
      }[];
      patientUuid: string;
      eligible: boolean;
    };
    expect(Object.isExtensible(blockedContext)).toBe(true);
    blockedContext.partId = "form";
    expect(blockedContext).toMatchObject({
      partId: "form",
      rollMode: "blindroll",
      patientUuid: blocked.uuid,
      eligible: false,
    });
    expect(blockedContext.rollModeOptions).toEqual([
      {
        value: "publicroll",
        label: "D6E2.Roll.Mode.Public",
        selected: false,
      },
      {
        value: "gmroll",
        label: "D6E2.Roll.Mode.Gm",
        selected: false,
      },
      {
        value: "selfroll",
        label: "D6E2.Roll.Mode.Self",
        selected: false,
      },
      {
        value: "blindroll",
        label: "D6E2.Roll.Mode.Blind",
        selected: true,
      },
    ]);
    patient.change(eligible.uuid);
    const eligibleContext = (await dialog._prepareContext()) as {
      rollMode: string;
      patientUuid: string;
      eligible: boolean;
    };
    expect(eligibleContext).toMatchObject({
      rollMode: "blindroll",
      patientUuid: eligible.uuid,
      eligible: true,
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- The inherited ApplicationV2 render member is a Vitest mock in this harness.
    const render = dialog.render as ReturnType<typeof vi.fn>;
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("does not advertise a GM-only patient as ready to a player", async () => {
    const administrator = {
      id: "administrator",
      uuid: "Actor.administrator",
      name: "Administrator",
      type: "character",
      wound: "wounded",
      system: {
        health: { firstEditionState: { consciousness: "conscious" } },
        medical: {
          physiology: { kind: "biological" },
          stim: { version: 0 },
        },
      },
    };
    const patient = {
      id: "gm-patient",
      uuid: "Actor.gm-patient",
      name: "GM Patient",
      type: "character",
      wound: "wounded",
      testUserPermission: () => false,
      system: {
        health: { firstEditionState: { consciousness: "conscious" } },
        medical: {
          physiology: { kind: "biological" },
          stim: { version: 0 },
        },
      },
    };
    vi.stubGlobal("game", {
      user: { id: "owner", active: true, isGM: false },
      users: {
        contents: [
          {
            id: "owner",
            active: true,
            isGM: false,
            character: administrator,
          },
          { id: "gm", active: true, isGM: true },
        ],
      },
      settings: { get: () => "publicroll" },
      i18n: { localize: (key: string) => key, format: (key: string) => key },
    });
    vi.stubGlobal("canvas", {
      tokens: { placeables: [{ visible: true, actor: patient }] },
    });
    const dialog = new Dialog().withItem({
      parent: administrator,
      system: { quantity: 5 },
    } as unknown as FoundryItemDocument);
    const useMode = new FakeSelect("self");
    Object.defineProperty(dialog, "element", {
      value: {
        querySelector: (selector: string) =>
          selector.includes("useMode") ? useMode : null,
      },
    });
    await dialog._onRender({}, { parts: [] });
    useMode.change("administer");
    await expect(dialog._prepareContext()).resolves.toMatchObject({
      patientUuid: patient.uuid,
      eligible: false,
      eligibilityLabel: "D6E2.Medical.Error.PatientControllerUnavailable",
    });
  });
});
