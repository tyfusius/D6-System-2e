import { parseHTML } from "linkedom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decorateManualRollMessage,
  registerManualRollPresentation,
  resetManualRollPresentationForTests,
} from "./manual-roll-presentation";

const nativeRoll = `
  <div class="dice-roll" data-action="expandRoll">
    <div class="dice-result">
      <div class="dice-formula">3d6 + 1dw</div>
      <div class="dice-tooltip"><div class="wrapper"><section class="tooltip-part">dice details</section></div></div>
      <h4 class="dice-total">17</h4>
    </div>
  </div>`;

function required<T>(value: T | null): T {
  if (value === null) throw new Error("Missing fixture element");
  return value;
}

function message(systemRoll?: unknown) {
  return {
    getFlag: vi.fn((_namespace: string, key: string) =>
      key === "roll" ? systemRoll : undefined,
    ),
  } as unknown as FoundryChatMessageDocument;
}

function fixture(content = nativeRoll) {
  const { document, window } = parseHTML(
    `<li class="chat-message"><div class="message-content">${content}</div></li>`,
  );
  vi.stubGlobal("HTMLElement", window.HTMLElement);
  vi.stubGlobal("document", document);
  return required(document.querySelector<HTMLElement>(".chat-message"));
}

describe("plain native roll presentation", () => {
  beforeEach(() => {
    vi.stubGlobal("game", {
      i18n: {
        localize: (key: string) =>
          key === "D6E2.Roll.Manual" ? "Manual roll" : key,
      },
    });
  });

  afterEach(() => {
    resetManualRollPresentationForTests();
    vi.unstubAllGlobals();
  });

  it("decorates the captured pure native roll without changing its roll semantics", () => {
    const html = fixture();
    expect(decorateManualRollMessage(message(), html)).toBe(1);
    const roll = required(html.querySelector<HTMLElement>(".dice-roll"));
    const formula = required(roll.querySelector<HTMLElement>(".dice-formula"));
    const tooltip = required(roll.querySelector<HTMLElement>(".dice-tooltip"));
    const icon = required(
      formula.querySelector<HTMLElement>(":scope > .od6-manual-roll-icon"),
    );
    expect(roll.classList.contains("od6-manual-roll")).toBe(true);
    expect(roll.dataset.action).toBe("expandRoll");
    expect(formula.textContent).toContain("3d6 + 1dw");
    expect(tooltip.textContent).toContain("dice details");
    expect(roll.querySelector(".dice-total")?.textContent).toBe("17");
    expect(icon.getAttribute("role")).toBe("img");
    expect(icon.getAttribute("aria-label")).toBe("Manual roll");
    expect(icon.getAttribute("title")).toBe("Manual roll");
    expect(icon.querySelector("i")?.className).toBe("fa-solid fa-hand");
    expect(icon.querySelector("i")?.getAttribute("aria-hidden")).toBe("true");
    expect(decorateManualRollMessage(message(), html)).toBe(1);
    expect(formula.querySelectorAll(".od6-manual-roll-icon")).toHaveLength(1);
  });

  it("decorates each direct roll in a native multiple-roll message", () => {
    const html = fixture(`${nativeRoll}${nativeRoll.replace("17", "9")}`);
    expect(decorateManualRollMessage(message(), html)).toBe(2);
    expect(html.querySelectorAll(".dice-roll.od6-manual-roll")).toHaveLength(2);
    expect(html.querySelectorAll(".od6-manual-roll-icon")).toHaveLength(2);
  });

  it.each([
    [
      "a structured D6 roll",
      `<article class="od6chat-roll">${nativeRoll}</article>`,
      undefined,
    ],
    [
      "a narrated roll",
      `<p>Automated mortality check</p>${nativeRoll}`,
      undefined,
    ],
    ["raw narration beside a roll", `Automated check ${nativeRoll}`, undefined],
    [
      "a nested module roll",
      `<section class="module-card">${nativeRoll}</section>`,
      undefined,
    ],
    ["a D6 result flag", nativeRoll, { contractVersion: 2 }],
  ])("does not label %s as manual", (_label, content, systemRoll) => {
    const html = fixture(content);
    const before = html.innerHTML;
    expect(decorateManualRollMessage(message(systemRoll), html)).toBe(0);
    expect(html.innerHTML).toBe(before);
  });

  it("registers one render hook and accepts the message-content element", () => {
    const hooks = new Map<string, (...args: unknown[]) => void>();
    const on = vi.fn((name: string, callback: (...args: unknown[]) => void) =>
      hooks.set(name, callback),
    );
    vi.stubGlobal("Hooks", {
      on,
    });
    registerManualRollPresentation();
    registerManualRollPresentation();
    const html = required(
      fixture().querySelector<HTMLElement>(".message-content"),
    );
    hooks.get("renderChatMessageHTML")?.(message(), html);
    expect(on).toHaveBeenCalledTimes(1);
    expect(
      html.querySelector(".dice-roll")?.classList.contains("od6-manual-roll"),
    ).toBe(true);
  });
});
