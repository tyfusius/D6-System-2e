import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const characterSheet = readFileSync(
  new URL("./sheets/character-sheet.ts", import.meta.url),
  "utf8",
);
const characterTemplate = readFileSync(
  new URL(
    "../../../../templates/actor/character/superheroic.hbs",
    import.meta.url,
  ),
  "utf8",
);
const itemTemplate = readFileSync(
  new URL("../../../../templates/item/item-sheet.hbs", import.meta.url),
  "utf8",
);
const rollService = readFileSync(
  new URL("./rolls/roll-service.ts", import.meta.url),
  "utf8",
);
const itemSheet = readFileSync(
  new URL("./sheets/item-sheet.ts", import.meta.url),
  "utf8",
);
const chatTemplate = readFileSync(
  new URL("../../../../templates/roll/chat-card.hbs", import.meta.url),
  "utf8",
);

describe("Gadgets & Gear UI", () => {
  it("provides bounded Item authoring without protected catalog content", () => {
    expect(itemTemplate).toContain("system.superheroicEquipmentKind");
    expect(itemTemplate).toContain("superheroicPowerTalentIds");
    expect(itemTemplate).toContain("system.gadgetUseCase");
    expect(itemTemplate).toContain("D6E2.GadgetsGear.RebuildDisabled");
    expect(itemSheet).toContain('input.name === "superheroicGadgetTarget"');
  });

  it("provides owner use and GM condition controls on the Superheroic tab", () => {
    expect(characterTemplate).toContain('data-action="useGadget"');
    expect(characterTemplate).toContain('data-action="useGearPower"');
    expect(characterTemplate).toContain(
      'data-action="setSuperheroicEquipmentState"',
    );
    expect(characterSheet).toContain("campaignProfile.gadgetsGear");
  });

  it("validates and audits the narrow +1D Gadget roll", () => {
    expect(rollService).toContain("gadgetRollContext");
    expect(rollService).toContain("gadgetBonusScore");
    expect(chatTemplate).toContain("superheroicEquipmentContext.useCase");
    expect(chatTemplate).toContain(
      "{{superheroicEquipmentContext.sourcePage}}",
    );
  });
});
