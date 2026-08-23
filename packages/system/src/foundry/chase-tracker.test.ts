import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tracker = readFileSync(
  new URL("./chase-tracker.ts", import.meta.url),
  "utf8",
);
const service = readFileSync(
  new URL("./chase-service.ts", import.meta.url),
  "utf8",
);

describe("Foundry chase integration", () => {
  it("registers an ApplicationV2 scene control gated by module and ownership", () => {
    expect(tracker).toContain('Hooks.on("getSceneControlButtons"');
    expect(tracker).toContain("d6ChasesEnabled()");
    expect(tracker).toContain("ownsParticipant()");
    expect(tracker).toContain("D6System2eChaseTracker");
  });

  it("uses scene flags, revision checks, an active-GM socket, and chat audit", () => {
    expect(service).toContain(
      'if (typeof canvas === "undefined") return null;',
    );
    expect(service).toContain('const CHASE_FLAG = "chase"');
    expect(service).toContain("expectedRevision");
    expect(service).toContain("activeGm?.id !== game.user.id");
    expect(service).toContain('actor?.testUserPermission(requester, "OWNER")');
    expect(service).toContain("templates/chat/chase-resolution.hbs");
    expect(service).toContain(
      "rolls.pursuer = new foundry.data.operators.ForcedDeletion()",
    );
    expect(service).toContain(
      "rolls.fleeing = new foundry.data.operators.ForcedDeletion()",
    );
  });
});
