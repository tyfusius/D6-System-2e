import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import { bindItemDescriptionEditorName } from "./item-description-editor";

// Foundry 14.367: ProseMirrorMenu._wrapEditor inserts .editor-container before
// HTMLProseMirrorElement dispatches its non-bubbling open event.
const richEditor = `
  <div class="menu-container"><button type="button">Save</button></div>
  <div class="editor-container">
    <div class="editor-content ProseMirror" contenteditable="true" translate="no"><p>Existing prose.</p></div>
  </div>
  <button class="icon toggle" type="button" disabled></button>`;

// ProseMirrorMenu.#activateSourceEditor appends this control directly to the
// prose-mirror host; CodeMirror creates its contenteditable inside the scroller.
const sourceEditor = `
  <code-mirror class="source-editor" language="html">
    <div class="cm-editor"><div class="cm-scroller">
      <div class="cm-content" contenteditable="true" role="textbox">Existing source.</div>
    </div></div>
  </code-mirror>`;

function requiredElement(root: ParentNode, selector: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing fixture element: ${selector}`);
  return element;
}

function fixture(content = richEditor) {
  const { document, Event } = parseHTML(`<html><body><form>
    <prose-mirror name="system.description" data-d6e2-item-description-editor
      role="group" aria-label="Beskrivelse">${content}</prose-mirror>
    <div class="editor-content" contenteditable="true">Unrelated field.</div>
  </form></body></html>`);
  const editor = requiredElement(document, "prose-mirror");
  return { document, editor, Event };
}

function expectNamed(surface: Element, name = "Beskrivelse"): void {
  expect(surface.getAttribute("aria-label")).toBe(name);
  expect(surface.getAttribute("aria-multiline")).toBe("true");
  expect(surface.getAttribute("role")).toBe("textbox");
}

describe("Item Description editor accessible naming", () => {
  it("names the native nested rich surface without changing content, focus, or form state", () => {
    const { document, editor } = fixture();
    const rich = requiredElement(editor, ".ProseMirror");
    const focus = vi.spyOn(rich, "focus");
    const change = vi.fn();
    const save = vi.fn();
    editor.addEventListener("change", change);
    editor.addEventListener("save", save);
    const content = rich.innerHTML;
    const menu = editor.querySelector(".menu-container");

    bindItemDescriptionEditorName(document);

    expectNamed(rich);
    expect(rich.innerHTML).toBe(content);
    expect(editor.querySelector(".menu-container")).toBe(menu);
    expect(editor.querySelector(".toggle")?.hasAttribute("disabled")).toBe(
      true,
    );
    expect(focus).not.toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(
      document
        .querySelector("form > .editor-content")
        ?.hasAttribute("aria-label"),
    ).toBe(false);
  });

  it("names asynchronously wrapped and reopened rich surfaces on native non-bubbling open", () => {
    const { document, editor, Event } = fixture("");
    bindItemDescriptionEditorName(document);
    editor.innerHTML = richEditor;
    const first = requiredElement(editor, ".ProseMirror");
    expect(first.hasAttribute("aria-label")).toBe(false);
    editor.dispatchEvent(new Event("open", { bubbles: false }));
    expectNamed(first);

    editor.innerHTML = richEditor;
    const reopened = requiredElement(editor, ".ProseMirror");
    expect(reopened).not.toBe(first);
    editor.dispatchEvent(new Event("open", { bubbles: false }));
    expectNamed(reopened);
  });

  it("names the native source hierarchy on focus and preserves naming on return to rich mode", () => {
    const { document, editor, Event } = fixture();
    bindItemDescriptionEditorName(document);
    editor.insertAdjacentHTML("beforeend", sourceEditor);
    const source = requiredElement(editor, ".cm-content");
    const content = source.innerHTML;
    source.dispatchEvent(new Event("focusin", { bubbles: true }));
    expectNamed(source);
    expect(source.innerHTML).toBe(content);

    requiredElement(editor, "code-mirror").remove();
    const rich = requiredElement(editor, ".ProseMirror");
    rich.dispatchEvent(new Event("focusin", { bubbles: true }));
    expectNamed(rich);
  });

  it("does not duplicate bindings or cross into a replacement editor", () => {
    const { document, editor, Event } = fixture();
    bindItemDescriptionEditorName(document);
    bindItemDescriptionEditorName(document);
    const rich = requiredElement(editor, ".ProseMirror");
    const attributes = vi.spyOn(rich, "setAttribute");
    editor.dispatchEvent(new Event("open"));
    expect(attributes).toHaveBeenCalledTimes(3);

    const replacement = editor.cloneNode(true) as HTMLElement;
    editor.replaceWith(replacement);
    bindItemDescriptionEditorName(document);
    const replacementAttributes = vi.spyOn(
      requiredElement(replacement, ".ProseMirror"),
      "setAttribute",
    );
    editor.dispatchEvent(new Event("open"));
    expect(replacementAttributes).not.toHaveBeenCalled();
    replacement.setAttribute("aria-label", "Description du personnage");
    replacement.dispatchEvent(new Event("open"));
    expectNamed(
      requiredElement(replacement, ".ProseMirror"),
      "Description du personnage",
    );
  });

  it("leaves read-only viewers and unnamed surfaces untouched", () => {
    const { document, editor, Event } = fixture();
    editor.setAttribute("aria-label", " ");
    bindItemDescriptionEditorName(document);
    editor.dispatchEvent(new Event("open"));
    expect(
      requiredElement(editor, ".ProseMirror").hasAttribute("aria-label"),
    ).toBe(false);
    editor.remove();
    const content = document.body.innerHTML;
    expect(() => bindItemDescriptionEditorName(document)).not.toThrow();
    expect(document.body.innerHTML).toBe(content);
  });
});
