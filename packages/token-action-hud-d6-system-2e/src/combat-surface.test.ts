import type {
  D6ActorReadModelV1,
  D6CombatantRoundReadModelV1,
} from "@d6-system-2e/core";
import { describe, expect, it } from "vitest";
import { buildCombatSurface } from "./combat-surface";
import { decodeHudCommand } from "./command-codec";

const labels = {
  actionsForfeited: "Forfeited",
  completeNext: "Complete",
  damage: "Damage",
  noDeclaration: "No declaration",
  resetDeclaration: "Reset",
};

function actor(): D6ActorReadModelV1 {
  return {
    attributes: [
      {
        code: { dice: 3, pips: 0 },
        id: "agility",
        label: "Agility",
        rollable: true,
        score: 9,
      },
      {
        code: { dice: 3, pips: 0 },
        id: "knowledge",
        label: "Knowledge",
        rollable: true,
        score: 9,
      },
    ],
    items: [
      {
        attackAttributeId: "agility",
        attackSkillKey: "shooting",
        damageCode: { dice: 4, pips: 0 },
        equipped: true,
        id: "blaster",
        image: "blaster.webp",
        invocation: "ordinary",
        modes: ["attack", "damage"],
        name: "Blaster",
        type: "weapon",
      },
      {
        attackAttributeId: "knowledge",
        attackSkillKey: "scholar",
        damageCode: { dice: 2, pips: 0 },
        equipped: false,
        id: "reference-book",
        image: "book.webp",
        invocation: "ordinary",
        modes: ["attack", "damage"],
        name: "Reference Book",
        type: "weapon",
      },
    ],
    skills: [
      {
        attributeId: "agility",
        bonusScore: 3,
        code: { dice: 4, pips: 0 },
        id: "shooting-item",
        key: "shooting",
        kind: "standard",
        label: "Shooting",
        rollable: true,
        score: 12,
      },
      {
        attributeId: "knowledge",
        bonusScore: 3,
        code: { dice: 4, pips: 0 },
        id: "scholar-item",
        key: "scholar",
        kind: "standard",
        label: "Scholar",
        rollable: true,
        score: 12,
      },
    ],
  } as unknown as D6ActorReadModelV1;
}

describe("combat HUD surface", () => {
  it("keeps the default surface limited to equipped weapons and linked abilities", () => {
    const sections = buildCombatSurface(actor(), null, "combat", labels, false);
    expect(sections.map(({ id }) => id)).toEqual([
      "round",
      "weapons",
      "abilities",
    ]);
    expect(sections.find(({ id }) => id === "abilities")?.actions).toHaveLength(
      1,
    );
    expect(
      sections.find(({ id }) => id === "abilities")?.actions[0]?.name,
    ).toBe("Shooting");
    expect(sections.find(({ id }) => id === "weapons")?.actions).toHaveLength(
      2,
    );
  });

  it("can expose all rollable abilities through the client setting", () => {
    const sections = buildCombatSurface(
      actor(),
      null,
      "all-rollable",
      labels,
      false,
    );
    expect(sections.find(({ id }) => id === "abilities")?.actions).toHaveLength(
      4,
    );
  });

  it("includes a declared combat ability even when no weapon references it", () => {
    const round = {
      actions: [],
      currentAction: {
        id: "declared",
        kind: "skill",
        label: "Scholar",
        sourceId: "scholar-item",
      },
      penaltyLabel: "−1D",
    } as unknown as D6CombatantRoundReadModelV1;
    const sections = buildCombatSurface(
      actor(),
      round,
      "combat",
      labels,
      false,
    );
    expect(
      sections
        .find(({ id }) => id === "abilities")
        ?.actions.map(({ name }) => name),
    ).toEqual(["Scholar", "Shooting"]);
  });

  it("keeps unequipped weapons and their abilities off the combat surface", () => {
    const sections = buildCombatSurface(actor(), null, "combat", labels, false);
    expect(
      sections
        .find(({ id }) => id === "weapons")
        ?.actions.map(({ name }) => name),
    ).toEqual(["Blaster", "Blaster · Damage"]);
    expect(
      sections
        .find(({ id }) => id === "abilities")
        ?.actions.map(({ name }) => name),
    ).toEqual(["Shooting"]);
  });

  it("includes the active defense and GM-only declaration controls", () => {
    const round = {
      actions: [{ id: "declared" }],
      currentAction: {
        id: "declared",
        kind: "skill",
        label: "Shooting",
        sourceId: "shooting-item",
      },
      firstEditionActiveDefense: { sourceId: "scholar-item" },
      penaltyLabel: "−1D",
    } as unknown as D6CombatantRoundReadModelV1;

    const sections = buildCombatSurface(actor(), round, "combat", labels, true);

    expect(
      sections
        .find(({ id }) => id === "abilities")
        ?.actions.map(({ name }) => name),
    ).toEqual(["Scholar", "Shooting"]);
    expect(
      sections
        .find(({ id }) => id === "round")
        ?.actions.map(({ name }) => name),
    ).toEqual(["Shooting", "Complete", "Reset"]);
  });

  it("uses the round-open command when no action is declared", () => {
    const roundAction = buildCombatSurface(
      actor(),
      null,
      "combat",
      labels,
      false,
    )[0]?.actions[0];

    expect(decodeHudCommand(roundAction?.encodedValue ?? "")).toEqual({
      id: "open",
      kind: "round",
    });
  });

  it("routes a thrown explosive through its typed public workflow", () => {
    const model = actor();
    const explosive = {
      ...model,
      items: model.items.map((item) =>
        item.id === "blaster"
          ? { ...item, invocation: "thrown-explosive" as const }
          : item,
      ),
    };
    const attack = buildCombatSurface(explosive, null, "combat", labels, false)
      .find(({ id }) => id === "weapons")
      ?.actions.find(({ id }) => id === "weapon-blaster-attack");

    expect(decodeHudCommand(attack?.encodedValue ?? "")).toEqual({
      id: "blaster",
      kind: "explosive",
    });
  });

  it("exposes only the weapon modes declared by the public read model", () => {
    const model = actor();
    const attackOnly = {
      ...model,
      items: model.items.map((item) =>
        item.id === "blaster" ? { ...item, modes: ["attack"] as const } : item,
      ),
    };

    expect(
      buildCombatSurface(attackOnly, null, "combat", labels, false)
        .find(({ id }) => id === "weapons")
        ?.actions.map(({ id }) => id),
    ).toEqual(["weapon-blaster-attack"]);
  });
});
