export const CORE_ATTRIBUTES = Object.freeze([
  Object.freeze({ id: "agility", label: "D6E2.Attribute.Agility" }),
  Object.freeze({ id: "brawn", label: "D6E2.Attribute.Brawn" }),
  Object.freeze({ id: "knowledge", label: "D6E2.Attribute.Knowledge" }),
  Object.freeze({ id: "perception", label: "D6E2.Attribute.Perception" }),
]);

export function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function integer(value: unknown): number {
  return Number.isSafeInteger(value) ? Number(value) : 0;
}
