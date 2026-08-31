import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../settings/rules-profile-library", () => ({
  currentConfiguredRulesProfile: () => ({
    strategies: { creation: "free-d6.creation.creation-points" },
  }),
}));

vi.mock("./mechanical-edit-guard", () => ({
  withAuthorizedCreationUpdate: (
    _actor: unknown,
    callback: () => Promise<unknown>,
  ) => callback(),
}));

import {
  adjustFreeD6CreationAttribute,
  adjustFreeD6CreationSkill,
  finalizeFreeD6Creation,
  freeD6CreationView,
  readFreeD6CreationDraft,
  setFreeD6CreationBudget,
} from "./free-d6-creation-service";

function fixture() {
  const system = {
    attributes: { agility: { score: 9 }, strength: { score: 9 } },
    creation: {
      active: true,
      freeD6: {} as unknown,
      template: { templateId: "" },
    },
    resources: { characterPoints: { value: 5 } },
  };
  const skill = {
    id: "skill",
    name: "Stamina",
    type: "skill",
    system: { attributeId: "strength", key: "stamina", score: 0 },
    update: vi.fn((changes: Record<string, unknown>): Promise<void> => {
      if (changes["system.score"] !== undefined)
        skill.system.score = Number(changes["system.score"]);
      return Promise.resolve();
    }),
  };
  const update = vi.fn((changes: Record<string, unknown>): Promise<void> => {
    if (changes["system.creation.freeD6"] !== undefined)
      system.creation.freeD6 = changes["system.creation.freeD6"];
    if (changes["system.creation.active"] === false)
      system.creation.active = false;
    if (changes["system.resources.characterPoints.value"] !== undefined)
      system.resources.characterPoints.value = Number(
        changes["system.resources.characterPoints.value"],
      );
    if (changes["system.attributes.agility.score"] !== undefined)
      system.attributes.agility.score = Number(
        changes["system.attributes.agility.score"],
      );
    return Promise.resolve();
  });
  const actor = {
    id: "actor",
    isOwner: true,
    type: "character",
    items: { contents: [skill] },
    system,
    update,
  };
  return {
    actor: actor as unknown as FoundryActorDocument,
    skill: skill as unknown as FoundryItemDocument,
    system,
    update,
  };
}

describe("FreeD6 Actor creation service", () => {
  beforeEach(() => vi.stubGlobal("game", { user: { isGM: true } }));

  it("starts from 30 CP without rewriting a missing legacy draft on read", () => {
    const { actor, update } = fixture();
    expect(freeD6CreationView(actor).ledger).toMatchObject({
      budgetUnits: 60,
      remainingUnits: 60,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("records 10 CP per Attribute pip and 1 CP per Skill pip", async () => {
    const { actor, skill } = fixture();
    await adjustFreeD6CreationAttribute(actor, "agility", 10);
    await adjustFreeD6CreationSkill(actor, skill, 1);
    expect(freeD6CreationView(actor).ledger).toMatchObject({
      remainingUnits: 38,
    });
    expect(
      readFreeD6CreationDraft(actor).transactions.map(
        ({ kind, pointUnits }) => ({ kind, pointUnits }),
      ),
    ).toEqual([
      { kind: "attribute", pointUnits: 20 },
      { kind: "skill", pointUnits: 2 },
    ]);
  });

  it("lets the GM set the campaign budget and rejects overspending before mutation", async () => {
    const { actor, system } = fixture();
    await setFreeD6CreationBudget(actor, 5);
    await expect(
      adjustFreeD6CreationAttribute(actor, "agility", 10),
    ).rejects.toThrow("D6E2.Creation.AttributeBudgetExceeded");
    expect(system.attributes.agility.score).toBe(9);
  });

  it("finalizes once with five plus remaining Creation Points", async () => {
    const { actor, system } = fixture();
    await adjustFreeD6CreationAttribute(actor, "agility", 10);
    await finalizeFreeD6Creation(actor);
    expect(system.creation.active).toBe(false);
    expect(system.resources.characterPoints.value).toBe(25);
    expect(readFreeD6CreationDraft(actor).finalized).toBe(true);
  });

  it("does not turn a chosen template baseline into unearned Creation Point credit", async () => {
    const { actor, skill } = fixture();
    await expect(
      adjustFreeD6CreationAttribute(actor, "agility", 8),
    ).rejects.toThrow("D6E2.Creation.Error.BelowTemplateBaseline");
    await expect(adjustFreeD6CreationSkill(actor, skill, -1)).rejects.toThrow(
      "D6E2.Creation.Error.BelowTemplateBaseline",
    );
    expect(readFreeD6CreationDraft(actor).transactions).toEqual([]);
  });
});
