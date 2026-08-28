import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const registry = source("../application/pending-interactions.ts");
const rolls = source("./roll-requests.ts");
const combined = source("./combined-actions.ts");
const economy = source("./economy-service.ts");
const chase = source("./chase-tracker.ts");
const damage = source("./rolls/ordinary-attack-thread.ts");
const quickbars = source("./quickbars.ts");
const taskTemplate = source(
  "../../../../templates/apps/active-tasks-quickbar.hbs",
);
const styles = source("../../../../styles/d6-system-2e.css");

Handlebars.registerHelper("localize", (key: string) => key);

function renderTasks(tasks: readonly Record<string, unknown>[]): string {
  return Handlebars.compile(taskTemplate)({
    compact: false,
    count: tasks.length,
    tasks,
  });
}

describe("unified system pending-prompt integrations", () => {
  it("tracks typed workflows without inspecting arbitrary window or DOM state", () => {
    expect(registry).toContain('"damage-resolution"');
    expect(registry).toContain('"economy-approval"');
    expect(registry).toContain('"chase-participation"');
    expect(registry).not.toContain("querySelector");
    expect(registry).not.toContain("ui.windows");
  });

  it("keeps ordinary requested rolls immediate while resistance and riposte are opt-in and reopenable", () => {
    expect(rolls).toContain(
      'message.subject.kind === "resistance" ||\n        message.subject.kind === "riposte"',
    );
    expect(rolls).toContain(
      'message.subject.kind !== "resistance" &&\n        message.subject.kind !== "riposte"',
    );
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
      "export async function executeD6OrdinaryAttackDamage(",
    );
    expect(damage).toContain("claimD6OrdinaryAttackDamage");
    expect(damage).toContain(
      "reopen: () => executeD6OrdinaryAttackDamage(message)",
    );
    expect(damage).toContain('kind: "damage-resolution"');
    expect(damage).toContain("{ automaticEligible: true }");
    expect(damage).toContain("suppressChatMessage: true");
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

  it("renders explicit opening and failed states with the active action identified", () => {
    expect(quickbars).toContain('failed: task.status === "failed"');
    expect(taskTemplate).not.toContain("task.remoteFailed");

    const opening = renderTasks([
      {
        controllerOnline: true,
        id: "opening-task",
        kindLabel: "Requested roll",
        label: "Dexterity",
        reopenable: true,
        reopening: true,
        statusLabel: "Opening prompt…",
        working: true,
      },
    ]);
    expect(opening).toContain('aria-busy="true"');
    expect(opening).toContain("Opening prompt…");
    expect(opening).toContain("fa-spinner");
    expect(opening).toContain('role="status"');

    const failed = renderTasks([
      {
        canTakeOver: true,
        controllerOnline: true,
        failed: true,
        id: "failed-task",
        kindLabel: "Requested roll",
        label: "Dexterity",
        reopenable: true,
        statusLabel: "The last action failed. Retry the available action.",
        takeover: true,
      },
    ]);
    expect(failed).toContain('class="has-failed"');
    expect(failed).toContain('role="alert"');
    expect(failed).toContain("fa-triangle-exclamation");
    expect(failed).toContain("Retry the available action");
    expect(failed).toContain('data-action="takeOverTask"');
    expect(failed).not.toContain('data-action="takeOverTask" disabled');
  });

  it("emits only authorized role actions and preserves long configured labels", () => {
    const player = renderTasks([
      {
        controllerOnline: true,
        id: "player-task",
        kindLabel: "Requested roll",
        label:
          "A very long configured Attribute name that needs two readable lines",
        reopenable: true,
      },
    ]);
    expect(player).toContain('data-action="reopenTask"');
    expect(player).not.toContain('data-action="takeOverTask"');
    expect(player).not.toContain('data-action="cancelTask"');

    const gm = renderTasks([
      {
        canTakeOver: true,
        cancellable: true,
        controllerOnline: false,
        id: "gm-task",
        kindLabel: "Requested roll",
        label: "Dexterity",
        takeover: true,
      },
    ]);
    expect(gm).toContain('data-action="takeOverTask"');
    expect(gm).toContain('data-action="cancelTask"');

    const labelRule =
      /\.od6tasks-list article strong\s*\{(?<body>[^}]*)\}/su.exec(styles)
        ?.groups?.body;
    expect(labelRule).toContain("-webkit-line-clamp: 2");
    expect(labelRule).toContain("white-space: normal");
    expect(labelRule).toContain("overflow-wrap: anywhere");
    expect(labelRule).not.toContain("text-overflow: ellipsis");
  });
});
