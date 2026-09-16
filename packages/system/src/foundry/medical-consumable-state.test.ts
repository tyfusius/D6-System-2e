import { describe, expect, it } from "vitest";
import { modelBStimInitialState } from "@d6-system-2e/core";
import {
  parseMedicalActorAuthority,
  reconcileMedicalStimClock,
} from "./medical-consumable-state";

function authority() {
  const active = modelBStimInitialState({
    campaignTime: 100,
    combatRound: null,
    combatUuid: null,
    durationRoll: 4,
    rootMessageId: "medicalroot00001",
    sourceActorUuid: "Actor.patient",
    sourceItemName: "Model B Stim",
    sourceItemUuid: "Actor.admin.Item.stim",
    useId: "medicaluse000001",
  });
  return {
    version: 1 as const,
    active,
    audits: [],
    history: [
      {
        version: 1 as const,
        useId: active.useId,
        rootMessageId: active.rootMessageId,
        itemName: active.sourceItemName,
        summary: "Model B wound-penalty suppression",
        rollMode: "selfroll" as const,
        terminal: "active" as const,
      },
    ],
    receipts: {
      [active.useId]: { version: 1 as const, witness: "witness" },
    },
  };
}

describe("medical consumable encrypted Actor authority", () => {
  it("accepts a complete state and returns an isolated clone", () => {
    const source = authority();
    const parsed = parseMedicalActorAuthority(source);
    expect(parsed).toEqual(source);
    expect(parsed).not.toBe(source);
  });

  it("fails closed when active evidence is incomplete or malformed", () => {
    const source = authority();
    expect(() => parseMedicalActorAuthority(null)).toThrow(
      "D6E2.Medical.Error.InvalidAuthorityState",
    );
    expect(() =>
      parseMedicalActorAuthority({ ...source, receipts: {} }),
    ).toThrow("D6E2.Medical.Error.InvalidAuthorityState");
    expect(() =>
      parseMedicalActorAuthority({
        ...source,
        active: { ...source.active, durationRoll: 7 },
      }),
    ).toThrow("D6E2.Medical.Error.InvalidAuthorityState");
  });

  it("retains operational receipts outside the 50-row display limit but caps authority growth", () => {
    const source = authority();
    const receipts = Object.fromEntries(
      Array.from({ length: 4097 }, (_, index) => [
        `use-${index}`,
        { version: 1, witness: `witness-${index}` },
      ]),
    );
    expect(() =>
      parseMedicalActorAuthority({ ...source, active: undefined, receipts }),
    ).toThrow("D6E2.Medical.Error.InvalidAuthorityState");
  });

  it("rejects malformed clock events before reading or mutating authority", async () => {
    await expect(
      reconcileMedicalStimClock(
        { uuid: "Actor.patient" } as never,
        null as never,
      ),
    ).rejects.toThrow("D6E2.Medical.Error.InvalidAuthorityState");
  });
});
