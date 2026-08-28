import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string): string => readFileSync(path, "utf8");

describe("native thrown-explosive integration", () => {
  it("dispatches typed attacks before the ordinary weapon dialog while retaining manual bypass", () => {
    const rolls = source("packages/system/src/foundry/rolls/roll-service.ts");
    const dispatch = rolls.indexOf(
      'stringValue(item.system.weaponKind) === "thrown-explosive"',
    );
    const ordinary = rolls.indexOf("const attackSkillKey", dispatch);
    expect(dispatch).toBeGreaterThan(-1);
    expect(ordinary).toBeGreaterThan(dispatch);
    expect(rolls).toContain("explosiveOptions?.bypassPlacement !== true");
    expect(rolls).toContain("rollPlacedThrownExplosiveAttack");
  });

  it("orders aim, authoritative Region creation, ordinary attack, final placement, and detonation", () => {
    const workflow = source(
      "packages/system/src/foundry/explosives/explosive-service.ts",
    );
    const aim = workflow.indexOf("aimController.aim");
    const create = workflow.indexOf('operation: "create"', aim);
    const roll = workflow.indexOf("rollPlacedThrownExplosiveAttack", create);
    const update = workflow.indexOf('operation: "update"', roll);
    const detonate = workflow.indexOf('operation: "detonate"', update);
    expect([aim, create, roll, update, detonate]).toEqual(
      [...[aim, create, roll, update, detonate]].sort((a, b) => a - b),
    );
    expect(workflow).toContain("currentSceneExplosiveTargets");
    expect(workflow).toContain("createD6ExplosiveAttackThreadForDetonation");
    expect(workflow).not.toContain("rollExplosiveZoneDamageAgainst");
    expect(workflow).toContain("await waitForD6BlastReveal()");
    expect(workflow).toContain('profile.detonationTiming === "end-of-round"');
    expect(workflow).toContain('? "armed"');
  });

  it("uses Foundry v14 Regions and ApplicationV2 dialog APIs without legacy surfaces", () => {
    const region = source(
      "packages/system/src/foundry/explosives/explosive-region.ts",
    );
    const aim = source(
      "packages/system/src/foundry/explosives/explosive-aim-controller.ts",
    );
    const combined = `${region}\n${aim}`;
    expect(region).toContain('createEmbeddedDocuments("Region"');
    expect(aim).toContain("canvasTearDown");
    expect(aim).toContain("DialogV2.wait");
    expect(combined).not.toContain("MeasuredTemplate");
    expect(combined).not.toContain("FormApplication");
    expect(combined).not.toContain("jQuery");
  });

  it("keeps cancellation, reload, source retirement, authority, and privacy boundaries explicit", () => {
    const workflow = source(
      "packages/system/src/foundry/explosives/explosive-service.ts",
    );
    const region = source(
      "packages/system/src/foundry/explosives/explosive-region.ts",
    );
    const canvas = source(
      "packages/system/src/foundry/explosives/explosive-canvas.ts",
    );
    const rolls = source("packages/system/src/foundry/rolls/roll-service.ts");
    const thread = source(
      "packages/system/src/foundry/explosives/explosive-attack-thread.ts",
    );
    expect(workflow.indexOf("aimController.aim")).toBeLessThan(
      workflow.indexOf('operation: "create"'),
    );
    expect(workflow).toContain("if (!outcome)");
    expect(workflow).toContain("await deleteRegion(state)");
    expect(workflow).toContain('Hooks.on("canvasReady"');
    expect(workflow).toContain('Hooks.on("deleteToken"');
    expect(workflow).toContain('Hooks.on("deleteItem"');
    expect(workflow).toContain('Hooks.on("deleteActor"');
    expect(region).toContain('actor.testUserPermission(requester, "OWNER")');
    expect(region).toContain("expectedRevision");
    expect(region).toContain("activeD6ExplosiveGm");
    expect(region).toContain("sourceHidden");
    expect(canvas).toContain(
      'label: visible ? (tokenLabel ?? actor.name) : ""',
    );
    expect(rolls).toContain(
      'rollMode: D6RollMode = target.hidden ? "gmroll" : currentDefaultRollMode()',
    );
    expect(thread).toContain(
      'const effectiveRollMode = hidden ? "blindroll" : current.rollMode',
    );
  });

  it("opens one shared zone Damage roll without creating independent target cards", () => {
    const rolls = source("packages/system/src/foundry/rolls/roll-service.ts");
    const start = rolls.indexOf(
      "export async function rollExplosiveZoneDamage",
    );
    const end = rolls.indexOf(
      "export async function rollExplosiveZoneDamageAgainst",
      start,
    );
    const section = rolls.slice(start, end);
    expect(section).toContain("return executeActorRoll(");
    expect(section).toContain("captureRollExecution: captureExecution");
    expect(section).toContain("fixedRollMode: rollMode");
    expect(section).toContain("suppressChatMessage: true");
    expect(section).not.toContain("executePreparedRoll(");
    expect(section).not.toContain("postRoll");
  });

  it("authors exact persistent blast data instead of silently inferring a profile", () => {
    const template = source("templates/item/item-sheet.hbs");
    expect(template).toContain('name="system.blast.activeZoneCount"');
    expect(template).toContain('name="system.blast.damageMode"');
    expect(template).toContain('name="system.blast.detonationTiming"');
    expect(template).toContain(
      'name="system.blast.zones.{{index}}.radiusMeters"',
    );
    expect(template).toContain(
      'name="system.blast.zones.{{index}}.damageScore"',
    );
  });
});
