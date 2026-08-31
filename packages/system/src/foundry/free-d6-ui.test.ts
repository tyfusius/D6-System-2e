import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  featureEconomyRegistry,
  resetFeatureEconomyRegistryForTests,
} from "../registries/feature-economy";

const character = readFileSync(
  new URL("../../../../templates/actor/character/traits.hbs", import.meta.url),
  "utf8",
);
const attributes = readFileSync(
  new URL(
    "../../../../templates/actor/character/attributes.hbs",
    import.meta.url,
  ),
  "utf8",
);
const browser = readFileSync(
  new URL(
    "../../../../templates/actor/character/free-d6-feature-browser.hbs",
    import.meta.url,
  ),
  "utf8",
);
const creationReview = readFileSync(
  new URL(
    "../../../../templates/actor/character/free-d6-creation-review.hbs",
    import.meta.url,
  ),
  "utf8",
);
const characterSheet = readFileSync(
  new URL("./sheets/character-sheet.ts", import.meta.url),
  "utf8",
);
const featureApplication = readFileSync(
  new URL("./free-d6-feature-application.ts", import.meta.url),
  "utf8",
);
const combat = readFileSync(
  new URL("../../../../templates/actor/character/combat.hbs", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../../../../styles/d6-system-2e.css", import.meta.url),
  "utf8",
);
const localization = JSON.parse(
  readFileSync(new URL("../../../../lang/en.json", import.meta.url), "utf8"),
) as Record<string, string>;

describe("FreeD6 character lifecycle presentation", () => {
  afterEach(() => {
    resetFeatureEconomyRegistryForTests();
    vi.unstubAllGlobals();
  });

  it("keeps physical injury and Fatigue separate with an explicit combined breakdown", () => {
    expect(combat).toContain("combat.freeD6Consequences.physicalLabel");
    expect(combat).toContain("combat.freeD6Consequences.fatigueLevel");
    expect(combat).toContain("combat.freeD6Consequences.penaltyBreakdown");
    expect(combat).toContain('data-action="addFreeD6Fatigue"');
    expect(combat).toContain('data-action="recoverFreeD6Fatigue"');
    expect(
      readFileSync(new URL("./rolls/roll-service.ts", import.meta.url), "utf8"),
    ).toContain("freeD6FatigueAllowsActions(actor)");
    expect(characterSheet).toMatch(
      /physicalLabel:\s+settingHealthStateLabel\(\s+activeHealth\.modelId,\s+activeHealth\.track\?\.currentStateId/u,
    );
    expect(characterSheet).not.toMatch(
      /physicalLabel:\s+activeHealth\.track\?\.currentState\.label/u,
    );
    expect(characterSheet).toContain('"D6E2.Condition.Healthy"');
    expect(characterSheet).not.toContain('"D6E2.Health.Healthy"');
  });

  it("uses the governed Merit and Flaw browser instead of unrestricted item creation", () => {
    expect(character).toContain('data-action="openFreeD6FeatureBrowser"');
    expect(character).toContain('data-action="payOffFreeD6Flaw"');
    expect(browser).toContain('data-action="acquireFeature"');
    expect(browser).toContain('data-action="approveFeatureRequest"');
    expect(browser).toContain('data-action="rejectFeatureRequest"');
    expect(browser).toContain('data-action="cancelFeatureRequest"');
    expect(browser).toContain('data-action="previewFeatureTransaction"');
    expect(browser).toContain("definition.preview.balanceBefore");
    expect(browser).toContain("definition.preview.cost");
    expect(browser).toContain("definition.preview.balanceAfter");
    expect(browser).toContain("aria-invalid");
    expect(browser).toContain("aria-describedby");
    expect(browser).toContain("data-feature-private");
    expect(browser).toContain("definition.pointValueOptions");
    expect(browser).toContain("definition.provider");
    expect(browser).toContain("D6E2.DeveloperDetails");
    expect(browser).toContain("request.requesterLabel");
    expect(browser).toContain("request.focusLabel");
    expect(browser).toContain("request.privacyLabel");
    expect(browser).not.toContain("request.requesterId");
    expect(browser).not.toContain("request.definitionId");
    expect(browser).not.toMatch(/https?:|data:text|@import/u);
    expect(featureApplication).toContain("readonly #drafts");
    expect(featureApplication).toContain("this.#drafts.set");
    expect(featureApplication).toContain("this.#errors.set");
    expect(featureApplication).toContain("CSS.escape(controlId)");
    expect(featureApplication).toContain("previewFreeD6FeatureTransaction");
    expect(featureApplication).toContain(
      "request.requesterId === currentUserId",
    );
  });

  it("renders fixed-value features with Foundry 14 compatible template syntax", () => {
    const handlebars = Handlebars.create();
    handlebars.registerHelper("checked", (value: unknown) =>
      value ? "checked" : "",
    );
    handlebars.registerHelper("disabled", (value: unknown) =>
      value ? "disabled" : "",
    );
    handlebars.registerHelper("localize", (key: string) => key);
    handlebars.registerHelper("not", (value: unknown) => !value);

    const html = handlebars.compile(browser)({
      creation: true,
      definitions: [
        {
          ariaInvalid: false,
          availabilityLabel: "Available",
          canAcquire: true,
          draftFocus: "",
          draftPrivate: false,
          draftValue: 2,
          effectSummary: "Fixed feature",
          error: "",
          errorId: "feature-error",
          fixedValue: true,
          id: "system/fixed-feature",
          label: "Fixed Feature",
          maximumValue: 2,
          minimumValue: 2,
          pointValueOptions: [],
          preview: undefined,
          provider: "D6 System",
          roleLabel: "Merit",
          valueControlId: "feature-value",
        },
      ],
      requests: [],
    });

    expect(html).toContain('id="feature-value"');
    expect(html).toContain("readonly");
    expect(browser).not.toContain("{{readonly ");
  });

  it("projects requester, focus, privacy, and provider state only to the GM and requesting owner", async () => {
    vi.stubGlobal("foundry", {
      applications: {
        api: {
          ApplicationV2: class {
            readonly element = {};
          },
          HandlebarsApplicationMixin: (Base: unknown) => Base,
        },
      },
    });
    featureEconomyRegistry.register("world", {
      definitions: [
        {
          actorTypes: ["character"],
          conflicts: [],
          effects: [],
          id: "world/available-merit",
          label: "Available Merit",
          pointValue: { kind: "exact", value: 2 },
          prerequisites: [],
          role: "merit",
          source: { kind: "world" },
          version: 1,
        },
      ],
      id: "world.features",
      label: "World features",
      version: 2,
    });
    const users = new Map([
      ["player", { id: "player", name: "D6 QA Player" }],
      ["other", { id: "other", name: "Other Player" }],
    ]);
    const requests = [
      {
        actorId: "actor",
        definitionId: "world/available-merit",
        definitionLabel: "Long localized private merit label",
        focus: "Shooting",
        id: "request-private",
        operation: "acquire",
        phase: "advancement",
        private: true,
        providerLabel: "World features",
        requesterId: "player",
        selectedValue: 2,
        status: "pending",
        version: 1,
      },
      {
        actorId: "actor",
        definitionId: "module/missing/flaw",
        definitionLabel: "Unavailable Flaw",
        focus: "",
        id: "request-rejected",
        operation: "acquire",
        phase: "advancement",
        private: false,
        providerLabel: "Missing provider",
        requesterId: "player",
        selectedValue: 1,
        status: "rejected",
        version: 1,
      },
      {
        actorId: "actor",
        definitionId: "module/other/merit",
        definitionLabel: "Other request",
        focus: "Piloting",
        id: "request-other",
        operation: "acquire",
        phase: "advancement",
        private: false,
        requesterId: "other",
        selectedValue: 1,
        status: "pending",
        version: 1,
      },
    ];
    const actor = {
      system: { featureEconomy: { requests } },
    } as unknown as FoundryActorDocument;
    const localize = (key: string) =>
      ({
        "D6E2.FreeD6.Features.NoFocus": "No focus specified",
        "D6E2.FreeD6.Features.PrivacyPrivate": "Private — owner and GM only",
        "D6E2.FreeD6.Features.PrivacyShared": "Shared feature details",
        "D6E2.FreeD6.Features.RequestPending": "Pending GM review",
        "D6E2.FreeD6.Features.RequestRejected": "Rejected",
        "D6E2.FreeD6.Features.UnknownRequester": "Unknown requester",
      })[key] ?? key;
    const projectFor = async (user: { id: string; isGM: boolean }) => {
      vi.stubGlobal("game", {
        i18n: { localize },
        user,
        users: { get: (id: string) => users.get(id) },
      });
      const { freeD6FeatureRequestViews } =
        await import("./free-d6-feature-application");
      return freeD6FeatureRequestViews(actor);
    };

    const gm = await projectFor({ id: "gm", isGM: true });
    expect(gm).toHaveLength(3);
    expect(gm[0]).toMatchObject({
      focusLabel: "Shooting",
      privacyLabel: "Private — owner and GM only",
      providerAvailable: true,
      requesterLabel: "D6 QA Player",
      statusLabel: "Pending GM review",
    });
    expect(gm[1]).toMatchObject({
      focusLabel: "No focus specified",
      privacyLabel: "Shared feature details",
      providerAvailable: false,
      requesterLabel: "D6 QA Player",
      statusLabel: "Rejected",
    });

    const owner = await projectFor({ id: "player", isGM: false });
    expect(owner.map(({ label }) => label)).toEqual([
      "Long localized private merit label",
      "Unavailable Flaw",
    ]);
    expect(await projectFor({ id: "stranger", isGM: false })).toEqual([]);
  });

  it("gives the GM a bounded Creation Point budget control without direct draft binding", () => {
    expect(attributes).toContain('data-action="setFreeD6CreationBudget"');
    expect(attributes).toContain("creation.freeD6.budgetPoints");
    expect(attributes).not.toContain('name="system.creation.freeD6');
    expect(styles).toContain(
      ".d6e2-free-d6-budget-control > :is(input, button)",
    );
  });

  it("reviews the human-readable FreeD6 ledger before finalization and permits cancellation", () => {
    const confirmIndex = characterSheet.indexOf(
      "confirmFreeD6CreationFinalize(this.actor)",
    );
    const finalizeIndex = characterSheet.indexOf(
      "await finalizeCharacterCreation(this.actor)",
    );
    expect(confirmIndex).toBeGreaterThan(-1);
    expect(finalizeIndex).toBeGreaterThan(confirmIndex);
    expect(characterSheet).toContain('action: "cancel"');
    expect(characterSheet).toContain("return result === true");
    expect(creationReview).toContain("review.transactionViews");
    expect(creationReview).not.toContain("sourceId");
  });

  it("keeps one scroll owner, 44px controls, and container-driven 720/520 reflow", () => {
    expect(styles).toContain(
      ".application.d6e2-free-d6-feature-browser\n  .window-content {\n  overflow: hidden;",
    );
    expect(styles).toContain(".d6e2-free-d6-feature-browser-scroll");
    expect(styles).toContain("overflow-y: auto;");
    expect(styles).toContain("min-block-size: 44px;");
    expect(styles).toContain("@container (max-width: 720px)");
    expect(styles).toContain("@container (max-width: 520px)");
    expect(styles).toContain(".d6e2-free-d6-feature-request-metadata");
    expect(styles).toContain("overflow-wrap: anywhere;");
  });

  it("localizes every ordinary browser label", () => {
    for (const key of `${browser}\n${creationReview}`.matchAll(
      /localize\s+"([^"]+)"/gu,
    )) {
      expect(localization[key[1] ?? ""], key[1]).toBeTypeOf("string");
    }
  });
});
