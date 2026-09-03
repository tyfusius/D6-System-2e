import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { describe, expect, it, vi } from "vitest";
import {
  enrichItemDescription,
  itemDescriptionEditorValue,
} from "./item-description-editor";

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("OpenD6 Next item-management parity", () => {
  const template = read("../../../../../templates/item/item-sheet.hbs");
  const sheet = read("./item-sheet.ts");

  it("provides accessible Details, Description, and Effects workspaces", () => {
    expect(template.match(/data-action="setItemTab"/gu)).toHaveLength(3);
    expect(template).toContain('data-item-tab="details"');
    expect(template).toContain('data-item-tab="description"');
    expect(template).toContain('data-item-tab="effects"');
    expect(template).toContain('role="tab"');
    expect(sheet).toContain("setItemTab: this.#setItemTab");
    expect(sheet).toContain("tab.disabled = false");
  });

  it("registers native Active Effect create, inspect, and delete actions", () => {
    expect(template).toContain('data-action="createEffect"');
    expect(template).toContain('data-action="editEffect"');
    expect(template).toContain('data-action="deleteEffect"');
    expect(sheet).toContain("createEffect: this.#createEffect");
    expect(sheet).toContain("editEffect: this.#editEffect");
    expect(sheet).toContain("deleteEffect: this.#deleteEffect");
    expect(sheet).toContain('createEmbeddedDocuments("ActiveEffect"');
    expect(sheet).toContain('deleteEmbeddedDocuments("ActiveEffect"');
  });

  it("keeps effect mutation behind the GM Free Edit boundary", () => {
    expect(sheet).toContain("if (game.user?.isGM !== true) return false");
    expect(sheet).toContain(
      'record(parent.system.sheetMode).value === "freeedit"',
    );
    expect(sheet).toContain("if (!this.#mayManageEffects()) return");
    expect(template).toContain("{{#if mayManageEffects}}");
    expect(template).toContain("{{#if @root.mayManageEffects}}");
    expect(template).toContain('class="od6item-effect-summary"');
  });

  it("uses Foundry's shared ProseMirror pipeline for every Item description", () => {
    const descriptionEditor =
      /<prose-mirror[\s\S]*?name="system\.description"[\s\S]*?<\/prose-mirror>/u.exec(
        template,
      )?.[0];

    expect(descriptionEditor).toBeDefined();
    expect(descriptionEditor).toContain('button="true"');
    expect(descriptionEditor).toContain('editable="true"');
    expect(descriptionEditor).toContain('toggled="false"');
    expect(descriptionEditor).toContain("description.value");
    expect(descriptionEditor).toContain("description.html");
    expect(template).not.toMatch(/<textarea[^>]*name="system\.description"/u);
    expect(template).toContain('class="od6v2-rich-text enriched-content"');
    expect(template).toMatch(
      /\{\{#if descriptionEditable\}\}[\s\S]*?<prose-mirror[\s\S]*?\{\{else\}\}[\s\S]*?description\.html/u,
    );

    const manifest = JSON.parse(
      readFileSync(
        new URL("../../../../../system.json", import.meta.url),
        "utf8",
      ),
    ) as {
      documentTypes: {
        Item: Record<string, { htmlFields?: readonly string[] }>;
      };
    };
    for (const [type, definition] of Object.entries(
      manifest.documentTypes.Item,
    )) {
      expect(definition.htmlFields, type).toContain("description");
    }
    expect(read("./register.ts")).toContain("types: ITEM_TYPES");
  });

  it("enriches links relative to the Item and exposes secrets only to owners", async () => {
    const item = { isOwner: true };
    const enrich = vi.fn((html: string) =>
      Promise.resolve(`<enriched>${html}</enriched>`),
    );

    const description = await enrichItemDescription(
      item,
      true,
      "<p>@UUID[Actor.test]{Linked actor}</p>",
      enrich,
      (html) => html,
    );

    expect(description).toEqual({
      html: "<enriched><p>@UUID[Actor.test]{Linked actor}</p></enriched>",
      value: "<p>@UUID[Actor.test]{Linked actor}</p>",
    });
    expect(enrich).toHaveBeenCalledWith(
      "<p>@UUID[Actor.test]{Linked actor}</p>",
      { relativeTo: item, secrets: true },
    );
  });

  it("keeps empty descriptions canonical and hides edit controls from viewers", async () => {
    const description = await enrichItemDescription(
      {},
      false,
      "",
      (html, options) => Promise.resolve(`${String(options.secrets)}:${html}`),
      (html) => html,
    );
    expect(description).toEqual({ html: "false:", value: "" });

    const handlebars = Handlebars.create();
    handlebars.registerHelper("localize", (key: string) => key);
    const isolatedDescription =
      /<section class="od6item-description">[\s\S]*?<\/section>/u.exec(
        template,
      )?.[0] ?? "";
    const rendered = handlebars.compile(isolatedDescription)({
      description: { html: "<p>Read-only description</p>", value: "" },
      descriptionEditable: false,
      hasSourceReference: false,
    });
    expect(rendered).toContain("<p>Read-only description</p>");
    expect(rendered).not.toContain("<prose-mirror");

    const emptyRendered = handlebars.compile(isolatedDescription)({
      description: { html: "", value: "" },
      descriptionEditable: false,
      hasSourceReference: false,
    });
    expect(emptyRendered).toContain("D6E2.Item.NoDescription");
    expect(emptyRendered).toContain("od6item-description-empty");
  });

  it("reads the current ProseMirror value for explicit Save without narrowing Item type", () => {
    const querySelector = vi.fn(() => ({
      value: "<p>Updated talent description</p>",
    }));
    const root = {
      querySelector,
    } as unknown as ParentNode;

    expect(itemDescriptionEditorValue(root)).toBe(
      "<p>Updated talent description</p>",
    );
    expect(querySelector).toHaveBeenCalledWith(
      'prose-mirror[data-d6e2-item-description-editor][name="system.description"]',
    );
    expect(sheet).not.toMatch(/item\.type[^\n]*itemDescriptionEditorValue/u);

    const missing = {
      querySelector: () => ({ value: undefined }),
    } as unknown as ParentNode;
    expect(itemDescriptionEditorValue(missing)).toBeNull();
  });

  it("lets owners edit narrative descriptions without unlocking mechanics", () => {
    expect(template).toContain("{{#if descriptionEditable}}");
    expect(sheet).toContain("descriptionEditable: this.isEditable");
    expect(sheet).toContain('_form.elements.namedItem("system.description")');
    expect(sheet).toContain("itemDescriptionEditorValue");
    expect(sheet).toContain("if (!directEdit)");
    expect(sheet).toContain(
      "Object.assign(changes, descriptionChanges(submittedDescription))",
    );
    expect(template).toContain('data-action="saveDescription"');
    expect(sheet).toContain("saveDescription: this.#saveDescription");
    expect(sheet).toContain('value.length === 0 ? " " : value');
    expect(sheet).toContain("descriptionChanges(description)");
    expect(sheet).toContain("delete changes.img");
  });

  it("offers an explicit submit action for directly editable item details", () => {
    expect(template).toContain("{{#if directEdit}}");
    expect(template).toContain('<button type="submit">');
    expect(sheet).toContain(
      "persistsEquipmentFieldsImmediately(this.item.type)",
    );
    expect(sheet).toContain("equipmentFieldRequiresRerender(input.name)");
    expect(sheet).toContain("form: applicationV2FormOptions({");
    expect(sheet).not.toContain("submitOnClose");
  });

  it("presents campaign era and restricts provenance changes to the GM", () => {
    expect(template).toContain("campaignEquipmentEraLabel");
    expect(template).toContain('name="system.equipmentProvenance.era"');
    expect(template).toContain("{{disabled (not provenanceEditable)}}");
    expect(template).toContain("D6E2.Equipment.Catalog.Provenance");
    expect(sheet).toContain(
      "provenanceEditable: directEdit && game.user?.isGM === true",
    );
  });

  it("opens world and compendium Items whose parent is null", () => {
    expect(sheet).toContain("this.item.parent != null");
    expect(sheet).not.toContain("this.item.parent !== undefined");
  });

  it("exposes the Weapon ammunition state already stored by the data model", () => {
    expect(template).toContain('name="system.ammunition.current"');
    expect(template).toContain('name="system.ammunition.maximum"');
    expect(template).toContain("D6E2.Item.AmmunitionCurrent");
    expect(template).toContain("D6E2.Item.AmmunitionMaximum");
  });

  it("authors stable species and bundle contracts instead of name lookup", () => {
    expect(template).toContain("{{#if isTemplateContainer}}");
    expect(template).toContain('name="system.rulesFamily"');
    expect(template).toContain('name="system.members.{{@index}}.uuid"');
    expect(template).toContain(
      'name="system.attributeBounds.{{@index}}.minimum"',
    );
    expect(template).toContain('data-action="addTemplateMember"');
    expect(template).toContain('data-action="addSpeciesBound"');
    expect(sheet).toContain("addTemplateMember: this.#addTemplateMember");
    expect(sheet).toContain("addSpeciesBound: this.#addSpeciesBound");
  });
});
