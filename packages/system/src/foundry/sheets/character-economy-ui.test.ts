import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("character economy sheet UI", () => {
  const header = read("../../../../../templates/actor/character/header.hbs");
  const dialog = read(
    "../../../../../templates/actor/character/economy-dialog.hbs",
  );
  const audit = read("../../../../../templates/chat/economy-audit.hbs");
  const sheet = read("./character-sheet.ts");
  const styles = read("../../../../../styles/d6-system-2e.css");

  it("shows compact spend and currency-transfer actions only through the capability context", () => {
    expect(header).toContain("{{#if companionDetails.currencyLabel}}");
    expect(header).toContain("{{#if economy.currencyEnabled}}");
    expect(header).toContain('data-action="spendCurrency"');
    expect(header).toContain('data-action="transferCurrency"');
    expect(header).toContain("{{disabled (not economy.canSpend)}}");
    expect(header).toContain("{{disabled (not economy.canTransfer)}}");
    expect(sheet).toContain("spendCharacterCurrency(this.actor)");
    expect(sheet).toContain("transferCharacterCurrency(this.actor)");
    expect(sheet).toContain("characterCurrencyTransactionsEnabled()");
    expect(sheet).toContain("(isGM || this.actor.isOwner === true)");
    expect(sheet).toContain("currencyLabel: economyCurrencyLabel()");
    expect(sheet).toContain("directEdit: canDirectEditResources");
  });

  it("lets a GM edit every point balance and currency in every mode without stale close submission", () => {
    expect(sheet).toContain(
      "const canDirectEditResources = isGM && this.isEditable",
    );
    expect(sheet).toContain("canEditCharacterPoints: canDirectEditResources");
    expect(sheet).toContain("canEditExperiencePoints: canDirectEditResources");
    expect(sheet).toContain("canEditFatePoints: canDirectEditResources");
    expect(sheet).toContain("canEditHeroPoints: canDirectEditResources");
    expect(header).toContain("{{disabled (not canEditCharacterPoints)}}");
    expect(header).toContain("{{disabled (not canEditFatePoints)}}");
    expect(header).toContain("{{disabled (not canEditHeroPoints)}}");
    expect(header).toContain("{{disabled (not economy.directEdit)}}");
    expect(sheet).toContain("submitOnClose: false");
    expect(sheet).toContain(
      'htmlElement.addEventListener("change", this.#persistChange)',
    );
    expect(sheet).toContain("#persistChangeQueue: Promise<void>");
    expect(sheet).toContain("this.#queuePersistChange(() =>");
    expect(sheet).toContain(
      'htmlElement.addEventListener("input", this.#persistDirectResourceInput)',
    );
    expect(sheet).toContain('input.name !== "system.profile.currency"');
    expect(sheet).toContain("/^system\\.resources\\.[^.]+\\.value$/");
    expect(sheet).not.toContain('input.type === "number" &&');
  });

  it("uses a constrained responsive transaction dialog with recipient and audit guidance", () => {
    expect(dialog).toContain('name="recipient"');
    expect(dialog).toContain('name="amount"');
    expect(dialog).toContain("D6E2.Economy.VisibleNpc");
    expect(dialog).toContain("D6E2.Economy.GmAuditHelp");
    expect(dialog).toContain("{{#if showRecipient}}");
    expect(audit).toContain('eq type "item-drop"');
    expect(audit).toContain("D6E2.Economy.ItemDropped");
    expect(styles).toContain(".d6e2-economy-dialog-content");
    expect(styles).toContain("max-width: calc(100vw - 20px)");
  });

  it("renders a readable private participant receipt with the established card hierarchy", () => {
    expect(audit).toContain("D6E2.Economy.Receipt");
    expect(audit).toContain("d6e2-economy-audit-header");
    expect(audit).toContain("d6e2-economy-audit-summary");
    expect(audit).toContain("d6e2-economy-audit-route");
    expect(audit).toContain("D6E2.Economy.ReceiptAudience");
    expect(audit).toContain("requesterName");
    expect(audit).toContain("sourceName");
    expect(audit).toContain("targetName");
    expect(styles).toContain(".d6e2-economy-audit-card");
    expect(styles).toContain("color: #f5f4f0");
    expect(styles).toContain(".d6e2-economy-audit-footer");
  });
});
