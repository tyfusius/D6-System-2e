import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { describe, expect, it, vi } from "vitest";
import {
  bindCharacterWritingEditors,
  enrichCharacterWritingFields,
} from "./character-writing-editor";

const root = process.cwd();
const source = (path: string): string =>
  readFileSync(`${root}/${path}`, "utf8");

class FakeEditor {
  readonly #listeners = new Map<string, Set<() => void>>();

  constructor(
    readonly name: string,
    public value: string,
  ) {}

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.#listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(type, listeners);
  }

  getAttribute(name: string): string | null {
    return name === "name" ? this.name : null;
  }

  emit(type: string): void {
    for (const listener of this.#listeners.get(type) ?? []) listener();
  }
}

describe("Character writing editors", () => {
  it("restores the stock OD6S Next ProseMirror workflow without textareas or a toolbar fork", () => {
    const template = source("templates/actor/character/biography.hbs");
    const background =
      /<prose-mirror[\s\S]*?name="system\.profile\.background"[\s\S]*?<\/prose-mirror>/u.exec(
        template,
      )?.[0];
    const biography =
      /<prose-mirror[\s\S]*?name="system\.biography"[\s\S]*?<\/prose-mirror>/u.exec(
        template,
      )?.[0];

    for (const editor of [background, biography]) {
      expect(editor).toBeDefined();
      expect(editor).toContain('button="true"');
      expect(editor).toContain('toggled="false"');
      expect(editor).toContain("data-d6e2-character-writing-editor");
    }
    const textareas = template.match(/<textarea[\s\S]*?<\/textarea>/gu) ?? [];
    expect(textareas.join("\n")).not.toMatch(
      /name="(?:system\.profile\.background|system\.biography)"/u,
    );
    expect(template).not.toContain("d6e2-writing-toolbar");
  });

  it("renders enriched HTML without edit affordances for non-editable viewers", () => {
    const template = source("templates/actor/character/biography.hbs");

    expect(template).toContain("writing.background.html");
    expect(template).toContain("writing.biography.html");
    expect(template).toContain('class="d6e2-writing-content enriched-content"');
    expect(template).toMatch(/\{\{#if editable\}\}[\s\S]*?<prose-mirror/u);
    expect(template).toMatch(/\{\{else\}\}[\s\S]*?writing\.background\.html/u);
  });

  it("renders formatted writing as HTML rather than exposing raw tags", () => {
    const handlebars = Handlebars.create();
    handlebars.registerHelper("localize", (key: string) => key);
    handlebars.registerHelper("not", (value: unknown) => !value);
    handlebars.registerHelper("disabled", (value: unknown) =>
      value ? "disabled" : "",
    );
    const render = handlebars.compile(
      source("templates/actor/character/biography.hbs"),
    );

    const html = render({
      actor: {
        system: {
          biography: "<p>raw notes</p>",
          profile: {
            age: "",
            background: "<p>raw background</p>",
            gender: "",
            height: "",
            personality: "",
            physicalDescription: "",
            weight: "",
          },
        },
      },
      companionDetails: {},
      editable: false,
      tab: { cssClass: "active" },
      writing: {
        background: {
          html: "<p><strong>Rendered history</strong></p>",
          value: "<p><strong>Rendered history</strong></p>",
        },
        biography: {
          html: "<ul><li>Rendered note</li></ul>",
          value: "<ul><li>Rendered note</li></ul>",
        },
      },
    });

    expect(html).toContain("<p><strong>Rendered history</strong></p>");
    expect(html).toContain("<ul><li>Rendered note</li></ul>");
    expect(html).not.toContain("&lt;strong&gt;");
    expect(html).not.toContain("<prose-mirror");
    expect(html).not.toContain("raw background");
    expect(html).not.toContain("raw notes");
  });

  it("enriches both stored HTML fields with actor-relative owner visibility", async () => {
    const actor = { isOwner: true };
    const enrich = vi.fn((html: string) =>
      Promise.resolve(`<safe>${html}</safe>`),
    );

    const writing = await enrichCharacterWritingFields(
      actor,
      {
        biography: "<p>Campaign</p>",
        background: "<strong>History</strong>",
      },
      enrich,
      (html) => html,
    );

    expect(writing).toEqual({
      background: {
        html: "<safe><strong>History</strong></safe>",
        value: "<strong>History</strong>",
      },
      biography: {
        html: "<safe><p>Campaign</p></safe>",
        value: "<p>Campaign</p>",
      },
    });
    expect(enrich).toHaveBeenNthCalledWith(1, "<strong>History</strong>", {
      relativeTo: actor,
      secrets: true,
    });
    expect(enrich).toHaveBeenNthCalledWith(2, "<p>Campaign</p>", {
      relativeTo: actor,
      secrets: true,
    });
  });

  it("hides secret blocks while enriching for non-owners", async () => {
    const actor = { isOwner: false };
    const enrich = vi.fn(() => Promise.resolve("<p>visible</p>"));

    await enrichCharacterWritingFields(
      actor,
      { biography: "notes", background: "history" },
      enrich,
      (html) => html,
    );

    expect(enrich).toHaveBeenCalledWith("history", {
      relativeTo: actor,
      secrets: false,
    });
  });

  it("cleans stored HTML before enrichment without double-escaping markup", async () => {
    const actor = { isOwner: true };
    const clean = vi.fn((html: string) =>
      html
        .replace(/<script[\s\S]*?<\/script>/gu, "")
        .replace(/ on\w+="[^"]*"/gu, ""),
    );
    const enrich = vi.fn((html: string) => Promise.resolve(html));

    const writing = await enrichCharacterWritingFields(
      actor,
      {
        background:
          '<p onclick="steal()"><strong>History</strong></p><script>steal()</script>',
        biography: '<a onmouseover="steal()">Notes</a>',
      },
      enrich,
      clean,
    );

    expect(writing.background.html).toBe("<p><strong>History</strong></p>");
    expect(writing.biography.html).toBe("<a>Notes</a>");
    expect(writing.background.value).toBe("<p><strong>History</strong></p>");
    expect(writing.biography.value).toBe("<a>Notes</a>");
    expect(writing.background.html).not.toContain("&lt;strong&gt;");
    expect(enrich).not.toHaveBeenCalledWith(
      expect.stringMatching(/script|onmouseover|onclick/u),
      expect.anything(),
    );
  });

  it("persists only changed allowlisted fields for authorized editors", () => {
    const background = new FakeEditor(
      "system.profile.background",
      "<p>Old background</p>",
    );
    const biography = new FakeEditor("system.biography", "<p>Old notes</p>");
    const persist = vi.fn();

    bindCharacterWritingEditors([background, biography], {
      canEdit: () => true,
      persist,
    });
    background.emit("save");
    background.value = "<p>New background</p>";
    background.emit("change");
    background.emit("save");
    biography.value = "<p>New notes</p>";
    biography.emit("save");

    expect(persist.mock.calls).toEqual([
      ["system.profile.background", "<p>New background</p>"],
      ["system.biography", "<p>New notes</p>"],
    ]);
  });

  it("rebinds after close or reload without a spurious write, then saves the next edit", () => {
    const persisted = "<p>Persisted background</p>";
    const reopened = new FakeEditor("system.profile.background", persisted);
    const persist = vi.fn();

    bindCharacterWritingEditors([reopened], {
      canEdit: () => true,
      persist,
    });
    reopened.emit("save");
    reopened.value = "<p>Edited after reload</p>";
    reopened.emit("save");

    expect(persist).toHaveBeenCalledOnce();
    expect(persist).toHaveBeenCalledWith(
      "system.profile.background",
      "<p>Edited after reload</p>",
    );
  });

  it("uses explicit ApplicationV2 editor events without legacy submit-on-close behavior", () => {
    const sheet = source(
      "packages/system/src/foundry/sheets/character-sheet.ts",
    );
    const binding = source(
      "packages/system/src/foundry/sheets/character-writing-editor.ts",
    );

    expect(sheet).toContain("bindCharacterWritingEditors(");
    expect(binding).toContain('editor.addEventListener("change", persist)');
    expect(binding).toContain('editor.addEventListener("save", persist)');
    expect(sheet).not.toContain("submitOnClose");
  });

  it("does not persist for non-editors or unknown field bindings", () => {
    const forbidden = new FakeEditor(
      "system.profile.background",
      "<p>changed</p>",
    );
    const unknown = new FakeEditor("system.privateNotes", "secret");
    const persist = vi.fn();

    bindCharacterWritingEditors([forbidden], {
      canEdit: () => false,
      persist,
    });
    bindCharacterWritingEditors([unknown], {
      canEdit: () => true,
      persist,
    });
    forbidden.value = "<p>attempt</p>";
    forbidden.emit("save");
    unknown.value = "changed";
    unknown.emit("change");

    expect(persist).not.toHaveBeenCalled();
  });

  it("declares every edited HTMLField for Foundry server sanitization", () => {
    const manifest = JSON.parse(source("system.json")) as {
      documentTypes: {
        Actor: { character: { htmlFields: string[] } };
      };
    };

    expect(manifest.documentTypes.Actor.character.htmlFields).toEqual([
      "biography",
      "profile.background",
    ]);
  });
});
