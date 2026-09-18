import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { afterEach, expect, it, vi } from "vitest";
import { bindDifficultySuggestionComboboxes } from "./difficulty-combobox";

afterEach(() => vi.unstubAllGlobals());

it("disposes an unopened picker without Popover support and preserves the dialog outcome", () => {
  const { document, window } = parseHTML(
    `<html><body><div data-difficulty-combobox><input data-difficulty-input value="10"><button data-action="toggleDifficultySuggestions">Suggestions</button><div role="listbox" hidden><button role="option" data-difficulty-value="10">10</button></div></div></body></html>`,
  );
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", document);
  const input = document.querySelector("input");
  const listbox = document.querySelector<HTMLElement>("[role=listbox]");
  assert(input && listbox);
  const matches = vi.spyOn(listbox, "matches");
  const changed = vi.fn();
  const dispose = bindDifficultySuggestionComboboxes(document.body, changed);
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  expect(changed).toHaveBeenCalledTimes(1);
  const outcome = new Error("original dialog rejection");
  expect(() => {
    try {
      throw outcome;
    } finally {
      dispose();
    }
  }).toThrow(outcome);
  dispose();
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  expect(changed).toHaveBeenCalledTimes(1);
  expect(matches).not.toHaveBeenCalled();
});

it("releases open-picker global listeners on disposal and binds a reused root once", () => {
  const { document, window } = parseHTML(
    `<html><body><div data-difficulty-combobox><input data-difficulty-input value="10"><button data-action="toggleDifficultySuggestions">Suggestions</button><div role="listbox" hidden><button role="option" data-difficulty-value="10">10</button></div></div></body></html>`,
  );
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", document);
  vi.stubGlobal("Node", window.Node);
  const root = document.querySelector<HTMLElement>(
    "[data-difficulty-combobox]",
  );
  assert(root);
  const input = root.querySelector("input");
  assert(input);
  const toggle = root.querySelector("button");
  assert(toggle);
  const listbox = root.querySelector<HTMLElement>("[role=listbox]");
  assert(listbox);
  let open = false;
  listbox.showPopover = () => {
    open = true;
  };
  listbox.hidePopover = () => {
    open = false;
  };
  listbox.matches = () => open;
  let frame: FrameRequestCallback | undefined;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    frame = undefined;
  });
  const measure = vi.spyOn(input, "getBoundingClientRect");
  const oldChanged = vi.fn(),
    changed = vi.fn();
  const disposeOld = bindDifficultySuggestionComboboxes(
    document.body,
    oldChanged,
  );
  const dispose = bindDifficultySuggestionComboboxes(document.body, changed);
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  expect(oldChanged).not.toHaveBeenCalled();
  expect(changed).toHaveBeenCalledTimes(1);
  toggle.dispatchEvent(new window.Event("click", { bubbles: true }));
  expect(open).toBe(true);
  disposeOld(); // a stale cleanup must not close the replacement binding
  expect(open).toBe(true);
  document.dispatchEvent(new window.Event("scroll"));
  expect(measure).toHaveBeenCalledTimes(1);
  frame?.(0);
  expect(measure).toHaveBeenCalledTimes(2);
  root.remove(); // native dialog removal need not produce a focusout event
  dispose();
  measure.mockClear();
  window.dispatchEvent(new window.Event("resize"));
  document.dispatchEvent(new window.Event("scroll"));
  input.dispatchEvent(new window.Event("input"));
  expect(measure).not.toHaveBeenCalled();
  expect(changed).toHaveBeenCalledTimes(1);
  expect(open).toBe(false);
});

it("measures once per frame for anchor movement and ignores unrelated and option-list scrolling", () => {
  const { document, window } = parseHTML(
    `<html><body><aside id="chat"></aside><section class="application"><div data-difficulty-combobox><input data-difficulty-input value="10"><button data-action="toggleDifficultySuggestions">Suggestions</button><div role="listbox" hidden><button role="option" data-difficulty-value="10">10</button></div></div></section></body></html>`,
  );
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", document);
  vi.stubGlobal("Node", window.Node);
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0;
  const requestFrame = vi.fn((callback: FrameRequestCallback) => {
    frames.set(++next, callback);
    return next;
  });
  vi.stubGlobal("requestAnimationFrame", requestFrame);
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  const input = document.querySelector("input"),
    toggle = document.querySelector("button"),
    listbox = document.querySelector<HTMLElement>("[role=listbox]"),
    chat = document.querySelector("#chat"),
    application = document.querySelector(".application");
  assert(input && toggle && listbox && chat && application);
  let open = false;
  listbox.showPopover = () => {
    open = true;
  };
  listbox.hidePopover = () => {
    open = false;
  };
  listbox.matches = () => open;
  const measure = vi.spyOn(input, "getBoundingClientRect");
  const dispose = bindDifficultySuggestionComboboxes(document.body, vi.fn());
  toggle.dispatchEvent(new window.Event("click", { bubbles: true }));
  expect(measure).toHaveBeenCalledOnce();
  listbox.dispatchEvent(new window.Event("scroll", { bubbles: true }));
  chat.dispatchEvent(new window.Event("scroll", { bubbles: true }));
  expect(requestFrame).not.toHaveBeenCalled();
  for (let i = 0; i < 20; i++) {
    application.dispatchEvent(new window.Event("scroll", { bubbles: true }));
    window.dispatchEvent(new window.Event("resize"));
  }
  expect(requestFrame).toHaveBeenCalledOnce();
  expect(measure).toHaveBeenCalledOnce();
  for (const [id, callback] of frames) {
    frames.delete(id);
    callback(0);
  }
  expect(measure).toHaveBeenCalledTimes(2);
  window.dispatchEvent(new window.Event("resize"));
  expect(frames.size).toBe(1);
  dispose();
  expect(frames.size).toBe(0);
  expect(open).toBe(false);
  window.dispatchEvent(new window.Event("resize"));
  expect(requestFrame).toHaveBeenCalledTimes(2);
});
