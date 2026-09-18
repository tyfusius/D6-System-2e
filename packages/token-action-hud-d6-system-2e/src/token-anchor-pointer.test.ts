import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("ignores outside pointer events and closed flyouts while retaining coalesced HUD placement", async () => {
  const { document, window } = parseHTML(
    `<html><body><div id="sidebar"></div><input id="sheet-field"><div id="token-action-hud-app"><div class="tah-tab-group"><button class="tah-group-button">Items</button><div class="tah-subgroups-container"><div class="tah-subgroups">Cargo</div></div></div></div></body></html>`,
  );
  const frames: FrameRequestCallback[] = [];
  const computedStyle = document.createElement("div").style;
  computedStyle.display = "block";
  computedStyle.visibility = "visible";
  const measure = vi.fn(() => computedStyle);
  window.requestAnimationFrame = (callback) => {
    frames.push(callback);
    return frames.length;
  };
  window.getComputedStyle = measure;
  Object.assign(window, { innerWidth: 1200, innerHeight: 800 });
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", document);
  vi.stubGlobal("Node", window.Node);
  vi.stubGlobal("game", { settings: { get: () => true } });
  vi.stubGlobal("Hooks", { on: vi.fn() });
  const { installTokenAnchor } = await import("./token-anchor");
  installTokenAnchor();
  installTokenAnchor();
  frames.splice(0); // initial anchoring is independent of pointer-triggered layout
  const outside = document.querySelector("#sheet-field");
  assert(outside);
  const hudButton = document.querySelector("button");
  assert(hudButton);
  const group = document.querySelector(".tah-tab-group");
  assert(group);
  const emit = (target: Element, type: string) =>
    target.dispatchEvent(new window.Event(type, { bubbles: true }));
  emit(outside, "pointerover");
  emit(outside, "pointerup");
  expect(frames).toHaveLength(0);
  emit(hudButton, "pointerover");
  expect(frames).toHaveLength(1);
  const frame = frames.shift();
  assert(frame);
  frame(0);
  expect(measure).not.toHaveBeenCalled();
  // HUD's bubble handler can open the flyout after our capture listener runs.
  emit(hudButton, "pointerover");
  emit(hudButton, "pointerup");
  group.classList.add("hover");
  expect(frames).toHaveLength(1);
  const openFrame = frames.shift();
  assert(openFrame);
  openFrame(0);
  expect(measure).toHaveBeenCalled();
  expect(
    document
      .querySelector(".tah-subgroups-container")
      ?.classList.contains("expand-down"),
  ).toBe(true);
  measure.mockClear();
  emit(outside, "pointerover");
  expect(frames).toHaveLength(0);
  expect(measure).not.toHaveBeenCalled();
});
