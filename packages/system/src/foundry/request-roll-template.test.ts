import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const requestDialog = readFileSync(
  new URL("../../../../templates/roll/request-dialog.hbs", import.meta.url),
  "utf8",
);
const playerDialog = readFileSync(
  new URL("../../../../templates/roll/dialog.hbs", import.meta.url),
  "utf8",
);
const requestService = readFileSync(
  new URL("./roll-requests.ts", import.meta.url),
  "utf8",
);
const rollService = readFileSync(
  new URL("./rolls/roll-service.ts", import.meta.url),
  "utf8",
);

describe("OpenD6 Next requested-roll parity", () => {
  it("requires the GM to choose the request audience before delivery", () => {
    expect(requestDialog).toContain('name="visibility"');
    expect(requestDialog).toContain("{{#each visibilityOptions as |option|}}");
    expect(requestService).toContain('value: "public"');
    expect(requestService).toContain('value: "private"');
    expect(requestService).toContain('value: "hidden"');
    expect(requestService).toContain("promptRequestedRollConfiguration(");
  });

  it("offers deterministic multiple-owner routing", () => {
    expect(requestDialog).toContain('name="recipientUserId"');
    expect(requestDialog).toContain("{{else if showRecipientChoice}}");
  });

  it("falls back to a local GM roll when no player owner is online", () => {
    expect(requestDialog).toContain("{{#if gmFallback}}");
    expect(requestDialog).toContain("D6E2.RequestRoll.GmFallback");
    expect(requestService).toContain("gmFallback: recipients.length === 0");
    expect(requestService).toContain(
      "execute: remoteController ? executeRemote : executeLocal",
    );
  });

  it("normalizes non-object DialogV2 cancel results to null", () => {
    expect(requestService).toContain(
      'result && typeof result === "object" ? result : null',
    );
    expect(rollService).toContain(
      'result && typeof result === "object" ? result : null',
    );
  });

  it("locks the player roll builder to the GM-selected audience", () => {
    expect(playerDialog).toContain("{{#if rollModeLocked}}");
    expect(playerDialog).toContain('name="rollMode"');
    expect(playerDialog).toContain('type="hidden"');
    expect(playerDialog).toContain('value="{{requestedRoll.rollMode}}"');
    expect(playerDialog).toContain("{{requestedRoll.visibilityLabel}}");
  });

  it("offers bounded Basic and Classic Hero Point steppers", () => {
    expect(playerDialog).toContain("{{#if showHeroPointDice}}");
    expect(playerDialog).toContain('data-hero-point-step="-1"');
    expect(playerDialog).toContain('data-hero-point-step="1"');
    expect(playerDialog).toContain('name="heroPointSpend"');
    expect(playerDialog).toContain('type="hidden"');
    expect(playerDialog).toContain("{{#if heroPointDiceWild}}");
    expect(rollService).toContain('inputChecked(form, "doubleDieCode")');
    expect(rollService).toContain('inputChecked(form, "bypassDieCodeCap")');
    expect(rollService).toContain('"classic-bonus-wild-dice"');
    expect(rollService).toContain('"basic-bonus-dice"');
  });

  it("carries a version, lifetime, requester, recipient, and visibility", () => {
    expect(requestService).toContain("ROLL_REQUEST_VERSION");
    expect(requestService).toContain("ROLL_REQUEST_LIFETIME_MS");
    expect(requestService).toContain("requesterName:");
    expect(requestService).toContain("targetUserId:");
    expect(requestService).toContain("visibility:");
  });

  it("propagates GM cancellation to the player's open roll builder", () => {
    expect(requestService).toContain('type: "cancel"');
    expect(requestService).toContain("cancelRequestedRollDialog(message.id)");
    expect(rollService).toContain(
      "export function cancelRequestedRollDialog(requestId: string)",
    );
    expect(rollService).toContain(
      "requestedRollDialogs.set(requestedRoll.requestId, dialog)",
    );
  });
});
