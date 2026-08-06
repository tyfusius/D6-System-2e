const ATTRIBUTE_DEFINITIONS = Object.freeze({
  agility: Object.freeze({ id: "agility", label: "D6E2.Attribute.Agility" }),
  brawn: Object.freeze({ id: "brawn", label: "D6E2.Attribute.Brawn" }),
  charm: Object.freeze({ id: "charm", label: "D6E2.Attribute.Charm" }),
  knowledge: Object.freeze({
    id: "knowledge",
    label: "D6E2.Attribute.Knowledge",
  }),
  magic: Object.freeze({ id: "magic", label: "D6E2.Attribute.Magic" }),
  mechanical: Object.freeze({
    id: "mechanical",
    label: "D6E2.Attribute.Mechanical",
  }),
  mysticism: Object.freeze({
    id: "mysticism",
    label: "D6E2.Attribute.Mysticism",
  }),
  perception: Object.freeze({
    id: "perception",
    label: "D6E2.Attribute.Perception",
  }),
  technical: Object.freeze({
    id: "technical",
    label: "D6E2.Attribute.Technical",
  }),
});

export const CORE_ATTRIBUTES = Object.freeze([
  ATTRIBUTE_DEFINITIONS.agility,
  ATTRIBUTE_DEFINITIONS.brawn,
  ATTRIBUTE_DEFINITIONS.knowledge,
  ATTRIBUTE_DEFINITIONS.perception,
]);

export const OPTIONAL_ATTRIBUTES = Object.freeze([
  ATTRIBUTE_DEFINITIONS.mechanical,
  ATTRIBUTE_DEFINITIONS.technical,
  ATTRIBUTE_DEFINITIONS.charm,
  ATTRIBUTE_DEFINITIONS.magic,
  ATTRIBUTE_DEFINITIONS.mysticism,
]);

export function characterTemplateAttributeDefinitions(
  useFirstEditionAttributes: boolean,
): readonly { readonly id: string; readonly label: string }[] {
  if (useFirstEditionAttributes) {
    return currentFirstEditionGenreProfile().attributes;
  }
  return Object.freeze([...CORE_ATTRIBUTES, ...OPTIONAL_ATTRIBUTES]);
}

export function activeAttributeDefinitions(
  useFirstEditionAttributes: boolean,
  secondEditionOptional: ReadonlySet<string> = new Set(),
): readonly { readonly id: string; readonly label: string }[] {
  if (!useFirstEditionAttributes) {
    return Object.freeze([
      ...CORE_ATTRIBUTES,
      ...OPTIONAL_ATTRIBUTES.filter(({ id }) => secondEditionOptional.has(id)),
    ]);
  }
  return currentFirstEditionGenreProfile().attributes;
}

export function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function integer(value: unknown): number {
  return Number.isSafeInteger(value) ? Number(value) : 0;
}

export function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
import { currentFirstEditionGenreProfile } from "../../settings/first-edition-genre-profile";
