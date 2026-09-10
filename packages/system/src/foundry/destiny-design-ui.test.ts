import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { parseHTML } from "linkedom";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const dockTemplate = read("../../../../templates/destiny/dock.hbs");
const workspaceTemplate = read("../../../../templates/destiny/workspace.hbs");
const css = read("../../../../styles/destiny.css");
const handlebars = Handlebars.create();
handlebars.registerHelper("not", (value: unknown) => !value);
handlebars.registerHelper("or", (...values: unknown[]) =>
  values.slice(0, -1).some(Boolean),
);
handlebars.registerHelper("disabled", (value: unknown) =>
  value ? "disabled" : "",
);
handlebars.registerHelper("checked", (value: unknown) =>
  value ? "checked" : "",
);
const labelKeys = Array.from(
  new Set(
    Array.from(
      (dockTemplate + workspaceTemplate).matchAll(/labels\.(\w+)/g),
      (match) => match[1],
    ),
  ),
);
const labels = Object.fromEntries<string>(
  labelKeys.map((key) => [key ?? "", `Label ${key}`] as const),
);
const images = {
  lightImage: "/systems/d6-system-2e/assets/ui/destiny-light.svg",
  darkImage: "/systems/d6-system-2e/assets/ui/destiny-dark.svg",
};

function render(template: string, context: Record<string, unknown>) {
  return parseHTML(
    `<html><body><form>${handlebars.compile(template)({ labels, ...images, title: "Destiny", summary: "2 Light · 1 Dark", busy: false, ...context })}</form></body></html>`,
  ).document;
}
function required(root: ParentNode, selector: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing rendered element: ${selector}`);
  return element;
}

const request = {
  id: "private-request-id",
  actorName: "Mara",
  requesterName: "Player",
  statusLabel: "Awaiting approval",
  story: "I packed a respirator before departure.",
  benefit: "One respirator",
  situation: "Underwater",
  equipmentRequested: true,
  canReview: true,
};
const review = {
  requestId: request.id,
  canApprove: false,
  customSelected: true,
  name: "Respirator",
  quantity: 1,
  charges: 2,
  temporarySelected: true,
  description: "One character, one use.",
  preview: "Mara receives one temporary respirator with two charges.",
};
const recipient = [{ value: "actor-id", label: "Mara", selected: true }];

// These tests render production templates and exercise their actual DOM; they
// deliberately do not substitute selector fakes or claim native Foundry QA.
describe("Destiny production presentation", () => {
  it("renders the dock part as one element containing every optional notice and live region", () => {
    for (const context of [
      {},
      {
        needsSession: true,
        placementHelp: "Use arrows to move.",
        error: "GM unavailable",
        announcement: "Coin changed.",
      },
    ]) {
      // Inspect the compiled part itself, before any ApplicationV2 host wrapper.
      const doc = parseHTML(
        `<html><body>${handlebars.compile(dockTemplate)({ labels, ...images, ...context })}</body></html>`,
      ).document;
      expect(doc.body.children).toHaveLength(1);
      const root = required(doc.body, ".d6-destiny-dock-root");
      expect(root.parentElement).toBe(doc.body);
      expect(root.querySelector(".d6-destiny-strip")).not.toBeNull();
      expect(
        root.querySelector('.d6-destiny-sr[aria-live="polite"]'),
      ).not.toBeNull();
      expect(root.querySelectorAll(".d6-destiny-dock-note")).toHaveLength(
        context.error ? 3 : 0,
      );
      expect(
        Array.from(doc.body.childNodes).filter(
          (node) => node.nodeType === 3 && (node.textContent ?? "").trim(),
        ),
      ).toHaveLength(0);
    }
  });

  it("keeps physical coin order, both faces and reserved/unavailable meaning without an optimistic flip", () => {
    const coins = [
      {
        id: "coin-a",
        side: "light",
        label: "Coin 1: Light, reserved",
        reserved: true,
        canUse: false,
      },
      {
        id: "coin-b",
        side: "dark",
        label: "Coin 2: Dark, GM use",
        canUse: false,
      },
      {
        id: "coin-c",
        side: "light",
        label: "Coin 3: Light, available",
        canUse: true,
      },
    ];
    const doc = render(dockTemplate, { coins, canManage: false });
    const buttons = Array.from(
      doc.querySelectorAll<HTMLElement>("[data-coin-id]"),
    );
    expect(buttons.map((button) => button.dataset.coinId)).toEqual(
      coins.map((coin) => coin.id),
    );
    for (const button of buttons) {
      expect(button.querySelectorAll("img[alt='']")).toHaveLength(2);
      expect(button.hasAttribute("disabled")).toBe(false);
      expect(button.getAttribute("aria-label")).toBeTruthy();
    }
    expect(buttons[0]?.getAttribute("aria-disabled")).toBe("true");
    expect(buttons[0]?.querySelector(".d6-destiny-reservation")).not.toBeNull();
    expect(doc.querySelector('[data-flipping="true"]')).toBeNull();
    expect(doc.querySelector('[data-action="manageDestiny"]')).toBeNull();
    expect(required(doc, "[role='status']").getAttribute("aria-live")).toBe(
      "polite",
    );
  });

  it("renders an explicitly confirmed flip only for its stable coin identity", () => {
    const doc = render(dockTemplate, {
      coins: [
        {
          id: "coin-a",
          side: "dark",
          flipping: true,
          canUse: false,
          label: "Coin 1: Dark",
        },
      ],
    });
    expect(required(doc, '[data-flipping="true"]').dataset.coinId).toBe(
      "coin-a",
    );
    expect(doc.querySelectorAll(".d6-destiny-object")).toHaveLength(1);
    expect(doc.querySelectorAll("[data-action='openCoin']")).toHaveLength(1);
  });

  it("escapes narrative drafts, associates visible field labels and never offers immediate proposal spending", () => {
    const story =
      '</textarea><script>alert("no")</script><p>Earlier preparation</p>';
    const doc = render(workspaceTemplate, {
      showProposal: true,
      actors: recipient,
      proposal: {
        story,
        benefit: "One respirator",
        canSubmit: true,
        equipmentRequested: true,
      },
    });
    expect(doc.querySelector("script")).toBeNull();
    // Linkedom preserves character references in textarea raw-text nodes.
    expect(required(doc, '[name="story"]').textContent).toBe(
      Handlebars.escapeExpression(story),
    );
    for (const field of Array.from(
      doc.querySelectorAll("input:not([type='hidden']), select, textarea"),
    )) {
      expect(field.closest("label")?.textContent.trim()).toBeTruthy();
    }
    expect(
      required(doc, '[name="actorId"] option[selected]').getAttribute("value"),
    ).toBe("actor-id");
    expect(
      doc.querySelector('[data-action="submitDestinyProposal"]'),
    ).not.toBeNull();
    expect(doc.querySelector('[data-action="commitDestinyEffect"]')).toBeNull();
    expect(
      doc.querySelector('[data-action="approveDestinyProposal"]'),
    ).toBeNull();
  });

  it("requires an explicit GM complication confirmation with a bounded narrative and no flashback approval", () => {
    for (const busy of [false, true]) {
      const doc = render(workspaceTemplate, {
        showComplication: true,
        canManage: true,
        busy,
        actors: recipient,
        complication: { story: "The bridge collapses.", canCommit: true },
      });
      expect(required(doc, '[name="story"]').getAttribute("maxlength")).toBe(
        "2000",
      );
      expect(required(doc, '[name="story"]').hasAttribute("required")).toBe(
        true,
      );
      expect(required(doc, '[name="story"]').textContent).toBe(
        "The bridge collapses.",
      );
      expect(
        required(doc, '[name="situation"]').getAttribute("maxlength"),
      ).toBe("1000");
      expect(
        required(doc, '[data-action="commitDestinyComplication"]').hasAttribute(
          "disabled",
        ),
      ).toBe(busy);
      expect(
        doc.querySelector('[data-action="submitDestinyProposal"]'),
      ).toBeNull();
      expect(
        doc.querySelector('[data-action="approveDestinyProposal"]'),
      ).toBeNull();
      expect(doc.querySelector('[name="equipmentRequested"]')).toBeNull();
    }
    const unavailable = render(workspaceTemplate, {
      showComplication: true,
      canManage: true,
      complication: { canCommit: false },
    });
    expect(
      required(
        unavailable,
        '[data-action="commitDestinyComplication"]',
      ).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("puts exact GM equipment approval in one fieldset and requires preview readiness", () => {
    const doc = render(workspaceTemplate, {
      showRequest: true,
      canManage: true,
      requests: [request],
      review,
      showDeliveryDetails: true,
      showCustomDelivery: true,
      deliveryActors: recipient,
    });
    expect(doc.querySelectorAll("fieldset")).toHaveLength(1);
    expect(required(doc, '[name="deliveryQuantity"]').getAttribute("max")).toBe(
      "20",
    );
    expect(required(doc, '[name="deliveryCharges"]').getAttribute("max")).toBe(
      "100",
    );
    expect(
      required(doc, '[data-action="approveDestinyProposal"]').hasAttribute(
        "disabled",
      ),
    ).toBe(true);
    expect(required(doc, ".d6-destiny-review").dataset.requestId).toBe(
      request.id,
    );
    expect(required(doc, ".d6-destiny-approval-preview").textContent).toContain(
      review.preview,
    );
    expect(doc.body.textContent).not.toContain(request.id);
    expect(doc.querySelector('[name="deliveryItemUuid"]')).toBeNull();
    const approved = render(workspaceTemplate, {
      showRequest: true,
      canManage: true,
      requests: [request],
      review: { ...review, canApprove: true },
      showDeliveryDetails: false,
    });
    expect(
      required(approved, '[data-action="approveDestinyProposal"]').hasAttribute(
        "disabled",
      ),
    ).toBe(false);
    expect(approved.querySelector('[name="deliveryQuantity"]')).toBeNull();
  });

  it("withholds GM review, equipment and correction surfaces from other roles even if a view flag is stale", () => {
    const doc = render(workspaceTemplate, {
      canManage: false,
      showSession: true,
      showComplication: true,
      showCorrection: true,
      showRequest: true,
      requests: [],
      review,
    });
    for (const action of [
      "approveDestinyProposal",
      "commitDestinyComplication",
      "rejectDestinyProposal",
      "resetDestinySession",
      "correctDestinyPool",
      "nominateDestinyPlayer",
    ]) {
      expect(doc.querySelector(`[data-action="${action}"]`)).toBeNull();
    }
    expect(doc.querySelector('[name="reviewRequestId"]')).toBeNull();
    expect(doc.body.textContent).not.toContain(review.preview);
  });

  it("limits recovery to GM session controls and renders only public status text", () => {
    const security = {
      status: "Recovery is available",
      help: "Enroll another GM.",
      canExport: true,
      canImport: false,
      key: "secret-key-sentinel",
      passphrase: "secret-passphrase-sentinel",
    };
    const doc = render(workspaceTemplate, {
      canManage: true,
      showSession: true,
      security,
    });
    expect(
      required(doc, '[data-action="exportDestinyKey"]').hasAttribute(
        "disabled",
      ),
    ).toBe(false);
    expect(
      required(doc, '[data-action="importDestinyKey"]').hasAttribute(
        "disabled",
      ),
    ).toBe(true);
    expect(doc.body.textContent).toContain(security.status);
    expect(doc.body.textContent).not.toContain(security.key);
    expect(doc.body.textContent).not.toContain(security.passphrase);
    expect(
      doc.querySelector('input[type="password"], input[type="file"]'),
    ).toBeNull();
    for (const context of [
      { canManage: false, showSession: true },
      { canManage: true, showSession: false },
    ]) {
      const hidden = render(workspaceTemplate, { ...context, security });
      expect(
        hidden.querySelector('[data-action="exportDestinyKey"]'),
      ).toBeNull();
      expect(
        hidden.querySelector('[data-action="importDestinyKey"]'),
      ).toBeNull();
    }
    const busy = render(workspaceTemplate, {
      canManage: true,
      showSession: true,
      busy: true,
      security: { ...security, canImport: true },
    });
    expect(
      required(busy, '[data-action="exportDestinyKey"]').hasAttribute(
        "disabled",
      ),
    ).toBe(true);
    expect(
      required(busy, '[data-action="importDestinyKey"]').hasAttribute(
        "disabled",
      ),
    ).toBe(true);
    expect(
      required(busy, '[data-action="closeDestiny"]').hasAttribute("disabled"),
    ).toBe(false);
  });

  it("offers only projected eligible effects and retains a visible reason for refusing a spend", () => {
    const reason = "This effect already has a committed Destiny intervention.";
    const doc = render(workspaceTemplate, {
      showEffect: true,
      effects: [
        {
          value: "opaque-effect",
          label: "Incoming hit · Mara",
          selected: true,
        },
      ],
      effect: { canCommit: false, reason },
    });
    expect(required(doc, '[name="effectId"] option').textContent).toBe(
      "Incoming hit · Mara",
    );
    expect(doc.querySelector("input[type='number']")).toBeNull();
    expect(doc.querySelector("input[type='text']")).toBeNull();
    expect(
      required(doc, '[data-action="commitDestinyEffect"]').hasAttribute(
        "disabled",
      ),
    ).toBe(true);
    expect(doc.body.textContent).toContain(reason);
  });

  it("keeps failure and pending announcements separate, with Close and Back outside the scrolling body", () => {
    const doc = render(workspaceTemplate, {
      showProposal: true,
      busy: true,
      canBack: true,
      error: "The pool changed. Review the current coin.",
      announcement: "Proposal reserved a Light coin.",
      proposal: { canSubmit: true },
    });
    expect(required(doc, '[role="alert"]').textContent).toContain(
      "The pool changed",
    );
    expect(
      required(doc, '[data-action="submitDestinyProposal"]').hasAttribute(
        "disabled",
      ),
    ).toBe(true);
    for (const action of ["closeDestiny", "backDestiny"]) {
      const button = required(doc, `[data-action="${action}"]`);
      expect(button.closest(".d6-destiny-body")).toBeNull();
      expect(button.hasAttribute("disabled")).toBe(false);
    }
    expect(required(doc, '[aria-live="polite"]').textContent).toBe(
      "Proposal reserved a Light coin.",
    );
  });

  it("renders every workspace mode with explicit button types and no duplicate element IDs", () => {
    for (const mode of [
      "showChoices",
      "showComplication",
      "showProposal",
      "showRequest",
      "showEffect",
      "showHistory",
      "showSession",
      "showCorrection",
    ]) {
      const doc = render(workspaceTemplate, {
        [mode]: true,
        canManage: true,
        actors: recipient,
        requests: [request],
        review,
        session: {},
        proposal: {},
        poolSizes: [1, 2, 3].map((value) => ({
          value,
          label: String(value),
          selected: value === 3,
        })),
        correctionCoins: [{ id: "a", label: "Coin 1", lightSelected: true }],
        choices: [{ kind: "flashback", label: "Flashback", available: true }],
        effect: {},
      });
      for (const button of Array.from(doc.querySelectorAll("button")))
        expect(button.getAttribute("type")).toBe("button");
      const ids = Array.from(
        doc.querySelectorAll("[id]"),
        (element) => element.id,
      );
      expect(new Set(ids).size).toBe(ids.length);
      expect(doc.querySelectorAll("form")).toHaveLength(1);
    }
  });

  it("keeps content button typography and states off native window header controls", () => {
    const doc = parseHTML(
      '<html><body><form class="d6e2 d6-destiny-workspace"><header class="window-header"><button class="header-control icon fa-solid fa-xmark" data-action="close"></button></header><div class="window-content"><div class="d6-destiny-shell"><button data-action="closeDestiny">Close</button></div></div></form></body></html>',
    ).document;
    const native = required(doc, ".window-header button");
    const content = required(doc, ".d6-destiny-shell button");
    let contentFontRules = 0;
    postcss.parse(css).walkRules((rule) => {
      if (!rule.selector.includes("button")) return;
      // Check potential state styling too, without depending on simulated focus/hover.
      const selector = rule.selector.replace(
        /:not\(:disabled\)|:hover|:focus-visible|:disabled/g,
        "",
      );
      expect(native.matches(selector), rule.selector).toBe(false);
      if (content.matches(selector))
        rule.walkDecls("font", (declaration) => {
          expect(declaration.value).toBe("inherit");
          contentFontRules++;
        });
    });
    expect(contentFontRules).toBe(1);
  });

  it("keeps viewport containment, 44px targets and reduced motion in the component stylesheet", () => {
    const root = postcss.parse(css);
    const declarations = (selector: string) => {
      const result = new Map<string, string>();
      root.walkRules((rule) => {
        if (rule.selector === selector)
          rule.walkDecls((declaration) => {
            result.set(declaration.prop, declaration.value);
          });
      });
      return result;
    };
    expect(declarations(".d6e2.d6-destiny-dock").get("position")).toBe("fixed");
    expect(declarations(".d6-destiny-dock-root").get("display")).toBe("flex");
    expect(declarations(".d6-destiny-dock-root").get("flex-direction")).toBe(
      "column",
    );
    expect(declarations(".d6-destiny-dock-root").get("max-width")).toBe("100%");
    expect(declarations(".d6-destiny-body").get("overflow")).toBe(
      "hidden auto",
    );
    expect(declarations(".d6-destiny-body").get("min-height")).toBe("0");
    expect(declarations(".d6-destiny-footer").get("flex")).toBe("0 0 auto");
    expect(declarations(".d6-destiny-strip button").get("min-height")).toBe(
      "var(--destiny-control)",
    );
    expect(css).toContain("--destiny-control: 44px");
    expect(declarations(".d6-destiny-object").get("width")).toBe("32px");
    expect(css).toContain('[data-d6e2-visual-effects-resolved="reduced"]');
    expect(css).toContain(
      'html:not([data-d6e2-visual-effects-resolved="full"])',
    );
    expect(css).not.toContain("infinite");
    expect(css).not.toContain("backdrop-filter");
  });

  it("uses independent scalable light/dark engravings with no script, embedded bitmap or external asset", () => {
    const light = read("../../../../assets/ui/destiny-light.svg");
    const dark = read("../../../../assets/ui/destiny-dark.svg");
    expect(light).not.toBe(dark);
    for (const svg of [light, dark]) {
      const doc = parseHTML(svg).document;
      expect(required(doc, "svg").getAttribute("viewBox")).toBe("0 0 128 128");
      expect(
        doc.querySelector(
          "script, foreignObject, image, animate, animateTransform",
        ),
      ).toBeNull();
      expect(svg).not.toMatch(/(?:href|src)\s*=\s*["'](?:https?:|data:)/);
    }
  });
});
