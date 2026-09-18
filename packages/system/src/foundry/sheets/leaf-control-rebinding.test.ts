import { describe, expect, it, vi } from "vitest";
import { bindMedicalPhysiologyControl } from "../medical-physiology-control";
import { bindCharacterAttributeKeyboardTooltips } from "./character-tooltips";
import { bindHealthStateDescriptionTooltips } from "./health-state-tooltip";

class Control extends EventTarget {
  value = "biological";
  dataset = {
    tooltip: "Original help",
    d6e2HealthDescriptionId: "original-description",
  };
  attributes = new Map<string, string>();
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}
const tooltip = () => ({ activate: vi.fn(), deactivate: vi.fn() });

describe("retained control rebinding", () => {
  it("persists physiology exactly once using the current authority and revision", () => {
    const select = new Control();
    const root = { querySelector: () => select } as unknown as ParentNode;
    const oldPersist = vi.fn(() => Promise.resolve(undefined));
    const persist = vi.fn(() => Promise.resolve(undefined));
    bindMedicalPhysiologyControl(root, {
      canClassify: () => true,
      current: () => ({ revision: 1 }),
      persist: oldPersist,
    });
    bindMedicalPhysiologyControl(root, {
      canClassify: () => true,
      current: () => ({ revision: 7 }),
      persist,
    });
    select.dispatchEvent(new Event("change"));
    expect(oldPersist).not.toHaveBeenCalled();
    expect(persist).toHaveBeenCalledExactlyOnceWith({
      "system.medical.physiology": {
        kind: "biological",
        source: "world",
        revision: 8,
      },
    });
    bindMedicalPhysiologyControl(root, {
      canClassify: () => false,
      current: () => ({ revision: 8 }),
      persist,
    });
    select.dispatchEvent(new Event("change"));
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("replaces attribute tooltip callbacks rather than multiplying focus work", () => {
    const heading = new Control();
    const root = {
      querySelectorAll: () => [heading],
    } as unknown as HTMLElement;
    const previous = tooltip(),
      current = tooltip();
    bindCharacterAttributeKeyboardTooltips(root, previous);
    heading.dataset.tooltip = "Updated help";
    bindCharacterAttributeKeyboardTooltips(root, current);
    heading.dispatchEvent(new Event("focus"));
    heading.dispatchEvent(new Event("blur"));
    expect(previous.activate).not.toHaveBeenCalled();
    expect(previous.deactivate).not.toHaveBeenCalled();
    expect(current.activate).toHaveBeenCalledExactlyOnceWith(heading, {
      text: "Updated help",
    });
    expect(current.deactivate).toHaveBeenCalledOnce();
  });

  it("cancels stale health tooltip restoration and hover observation on rebind", async () => {
    const button = new Control();
    const root = { querySelectorAll: () => [button] } as unknown as HTMLElement;
    const previous = tooltip(),
      current = tooltip();
    const disconnect = vi.fn();
    const observer = () => ({ disconnect, observe: vi.fn() });
    bindHealthStateDescriptionTooltips(root, previous, observer);
    button.dispatchEvent(new Event("mouseleave"));
    button.dataset.d6e2HealthDescriptionId = "updated-description";
    button.dataset.tooltip = "Updated health help";
    bindHealthStateDescriptionTooltips(root, current, observer);
    await Promise.resolve();
    expect(button.getAttribute("aria-describedby")).toBe("updated-description");
    button.dispatchEvent(new Event("focus"));
    button.dispatchEvent(new Event("blur"));
    expect(disconnect).toHaveBeenCalledOnce();
    expect(previous.activate).not.toHaveBeenCalled();
    expect(previous.deactivate).not.toHaveBeenCalled();
    expect(current.activate).toHaveBeenCalledExactlyOnceWith(button, {
      text: "Updated health help",
    });
    expect(current.deactivate).toHaveBeenCalledOnce();
  });
});
