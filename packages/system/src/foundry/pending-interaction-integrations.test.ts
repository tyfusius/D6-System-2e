import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const registry = source("../application/pending-interactions.ts");
const rolls = source("./roll-requests.ts");
const combined = source("./combined-actions.ts");
const economy = source("./economy-service.ts");
const chase = source("./chase-tracker.ts");
const damage = source("./rolls/chat-card-actions.ts");
const quickbars = source("./quickbars.ts");
const taskTemplate = source(
  "../../../../templates/apps/active-tasks-quickbar.hbs",
);

describe("unified system pending-prompt integrations", () => {
  it("tracks typed workflows without inspecting arbitrary window or DOM state", () => {
    expect(registry).toContain('"damage-resolution"');
    expect(registry).toContain('"economy-approval"');
    expect(registry).toContain('"chase-participation"');
    expect(registry).not.toContain("querySelector");
    expect(registry).not.toContain("ui.windows");
  });

  it("keeps explicit requested rolls immediate while resistance is opt-in and reopenable", () => {
    expect(rolls).toContain(
      'automaticEligible: message.subject.kind === "resistance"',
    );
    expect(rolls).toContain('forceOpen: message.subject.kind !== "resistance"');
    expect(rolls).toContain('if (!result) return "dismissed"');
    expect(rolls).toContain('Hooks.on("userConnected"');
    expect(rolls).toContain('type: "recover-pending-requests"');
    expect(rolls).toContain("request.requesterUserId === coordinator.id");
    expect(rolls).toContain("outgoingRequests.values()");
    expect(rolls).toContain(
      "terminologyAttributeLabel(currentTerminology(), subject.attributeId)",
    );
  });

  it("retains dismissed Combined Action and transfer approvals as tasks", () => {
    expect(combined).toContain('if (accepted === null) return "dismissed"');
    expect(combined).toContain("{ automaticEligible: true }");
    expect(economy).toContain('if (accepted === null) return "dismissed"');
    expect(economy).toContain('kind: "economy-approval"');
    expect(economy).toContain("message.expiresAt - message.createdAt");
  });

  it("uses one guarded damage operation for automatic delivery and the visible fallback", () => {
    expect(damage).toContain(
      "export async function executeSuccessfulHitDamageFollowUp",
    );
    expect(damage).toContain("await claimRollFollowUp(message, actor)");
    expect(damage).toContain(
      "executeSuccessfulHitDamageFollowUp(message, actor, result)",
    );
    expect(damage).toContain('kind: "damage-resolution"');
    expect(damage).toContain("{ automaticEligible: true }");
  });

  it("rebuilds chase participation tasks from the persisted Scene contract", () => {
    expect(chase).toContain("const state = readD6Chase()");
    expect(chase).toContain("state.rolls[side]");
    expect(chase).toContain('kind: "chase-participation"');
    expect(chase).toContain("actor.isOwner === true");
  });

  it("projects recipient tasks through the existing ApplicationV2 workspace", () => {
    expect(quickbars).toContain("activeD6PendingInteractions(");
    expect(quickbars).toContain(
      "game.user.isGM || activeD6PendingInteractions(game.user.id).length > 0",
    );
    expect(taskTemplate).toContain('data-action="reopenTask"');
    expect(taskTemplate).toContain('data-action="takeOverTask"');
    expect(taskTemplate).toContain('data-action="cancelTask"');
    expect(quickbars).not.toContain("FormApplication");
  });
});
