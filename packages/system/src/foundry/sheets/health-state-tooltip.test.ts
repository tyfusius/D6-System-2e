import { describe, expect, it, vi } from "vitest";

import { bindHealthStateDescriptionTooltips } from "./health-state-tooltip";

class FakeHealthStateButton extends EventTarget {
  readonly dataset = {
    d6e2HealthDescriptionId: "d6e2-health-description-hurt",
    tooltip: "Movement is impaired.",
  };
  readonly #attributes = new Map<string, string>();

  getAttribute(name: string): string | null {
    return this.#attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.#attributes.delete(name);
  }

  setAttribute(name: string, value: string): void {
    this.#attributes.set(name, value);
  }
}

function keyboardEvent(key: string): Event {
  const event = new Event("keydown");
  Object.defineProperty(event, "key", { value: key });
  return event;
}

describe("health state description tooltips", () => {
  it("opens the native tooltip on focus and preserves the authored description", async () => {
    const button = new FakeHealthStateButton();
    const activate = vi.fn();
    const deactivate = vi.fn();
    const root = {
      querySelectorAll: vi.fn(() => [button]),
    };

    bindHealthStateDescriptionTooltips(root as unknown as HTMLElement, {
      activate,
      deactivate,
    });
    button.dispatchEvent(new Event("focus"));

    expect(activate).toHaveBeenCalledOnce();
    expect(activate).toHaveBeenCalledWith(button, {
      text: "Movement is impaired.",
    });
    expect(button.getAttribute("aria-describedby")).toBe(
      "d6e2-health-description-hurt",
    );

    let notifyAttributeChange: (() => void) | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "MutationObserver",
      class {
        constructor(callback: () => void) {
          notifyAttributeChange = callback;
        }

        disconnect = disconnect;
        observe = vi.fn();
      },
    );

    button.dispatchEvent(new Event("mouseenter"));
    button.setAttribute("aria-describedby", "tooltip-temporary-id");
    button.dispatchEvent(new Event("mouseleave"));
    await Promise.resolve();
    expect(button.getAttribute("aria-describedby")).toBe(
      "d6e2-health-description-hurt",
    );

    button.removeAttribute("aria-describedby");
    notifyAttributeChange?.();
    expect(button.getAttribute("aria-describedby")).toBe(
      "d6e2-health-description-hurt",
    );
    expect(disconnect).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("dismisses on blur or Escape without intercepting activation keys", async () => {
    const button = new FakeHealthStateButton();
    const activate = vi.fn();
    const deactivate = vi.fn();
    bindHealthStateDescriptionTooltips(
      { querySelectorAll: () => [button] } as unknown as HTMLElement,
      { activate, deactivate },
    );

    button.dispatchEvent(keyboardEvent("Enter"));
    button.dispatchEvent(keyboardEvent(" "));
    expect(deactivate).not.toHaveBeenCalled();

    button.dispatchEvent(keyboardEvent("Escape"));
    button.dispatchEvent(new Event("blur"));
    await Promise.resolve();
    expect(deactivate).toHaveBeenCalledTimes(2);
    expect(button.getAttribute("aria-describedby")).toBe(
      "d6e2-health-description-hurt",
    );
  });
});
