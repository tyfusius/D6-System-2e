import { describe, expect, it, vi } from "vitest";
import {
  activeAttributeDefinitions,
  characterTemplateAttributeDefinitions,
} from "./values";

vi.mock("../../settings/attributes", () => ({
  currentActiveAttributeDefinitions: () => [
    { id: "agility", label: "Agility" },
    { id: "charm", label: "Charm" },
  ],
  currentTemplateAttributeDefinitions: () => [
    { id: "agility", label: "Agility" },
    { id: "charm", label: "Charm" },
    { id: "technical", label: "Technical" },
  ],
}));

describe("active attribute definitions", () => {
  it("projects only the active Attribute strategy definitions", () => {
    expect(
      activeAttributeDefinitions().map((attribute) => attribute.id),
    ).toEqual(["agility", "charm"]);
  });

  it("retains inactive definitions for Character Template authoring", () => {
    expect(
      characterTemplateAttributeDefinitions().map((attribute) => attribute.id),
    ).toEqual(["agility", "charm", "technical"]);
  });
});
