import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rollService = readFileSync(
  new URL("./roll-service.ts", import.meta.url),
  "utf8",
);
const characterSheet = readFileSync(
  new URL("../sheets/character-sheet.ts", import.meta.url),
  "utf8",
);
const template = readFileSync(
  new URL(
    "../../../../../templates/actor/character/extraordinary-powers.hbs",
    import.meta.url,
  ),
  "utf8",
);

describe("direct extraordinary-power Skill rolls", () => {
  it("routes the Force workspace through its framework-bound adapter", () => {
    expect(template).toContain('data-action="rollExtraordinaryPowerSkill"');
    expect(template).not.toContain('data-action="rollSkill"');
    expect(characterSheet).toContain("rollExtraordinaryPowerRoleSkill(");
    expect(characterSheet).toContain(
      "rollExtraordinaryPowerSkill: this.#rollExtraordinaryPowerSkill",
    );
  });

  it("uses the normal roll engine with exact Item context and no generic psionics gate", () => {
    const start = rollService.indexOf(
      "export async function rollExtraordinaryPowerSkillDirect",
    );
    const end = rollService.indexOf(
      "async function executeExtraordinaryPowerSkillRoll",
      start,
    );
    const direct = rollService.slice(start, end);
    expect(direct).toContain("executeExtraordinaryPowerSkillRoll(");
    expect(direct).not.toContain("currentSecondEditionCampaignProfile");
    expect(rollService).toContain(
      "if (psionic && !currentSecondEditionCampaignProfile().psionics)",
    );
    expect(rollService).toMatch(
      /executeExtraordinaryPowerSkillRoll[\s\S]*?executeActorRoll\(actor,\s*\{[\s\S]*?kind:\s*"skill"[\s\S]*?source:\s*\{[\s\S]*?itemId:\s*skill\.id/u,
    );
    expect(rollService).toContain(
      'actor.items.get(requestSource.source.itemId ?? "")?.system.description',
    );
    expect(rollService).toContain("rollMode: controls.rollMode");
    expect(rollService).toContain("currentWildDieRuntimeStrategy().policy");
    expect(rollService).toContain("await ChatMessage.create(");
  });
});
