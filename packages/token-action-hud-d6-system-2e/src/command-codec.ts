export type D6HudCommand =
  | { readonly kind: "attribute"; readonly id: string }
  | { readonly kind: "skill"; readonly id: string }
  | { readonly kind: "weapon-attack"; readonly id: string }
  | { readonly kind: "weapon-damage"; readonly id: string }
  | { readonly kind: "explosive"; readonly id: string }
  | {
      readonly kind: "round";
      readonly id: "complete" | "open" | "reset" | "run-current";
    };

const PREFIX = "d6e2:";

export function encodeHudCommand(command: D6HudCommand): string {
  return `${PREFIX}${encodeURIComponent(JSON.stringify(command))}`;
}

export function decodeHudCommand(value: string): D6HudCommand | null {
  if (!value.startsWith(PREFIX)) return null;
  try {
    const candidate = JSON.parse(
      decodeURIComponent(value.slice(PREFIX.length)),
    ) as unknown;
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      !("kind" in candidate) ||
      !("id" in candidate) ||
      typeof candidate.kind !== "string" ||
      typeof candidate.id !== "string" ||
      candidate.id.length === 0
    ) {
      return null;
    }
    if (
      [
        "attribute",
        "skill",
        "weapon-attack",
        "weapon-damage",
        "explosive",
      ].includes(candidate.kind)
    ) {
      return candidate as D6HudCommand;
    }
    if (
      candidate.kind === "round" &&
      ["complete", "open", "reset", "run-current"].includes(candidate.id)
    ) {
      return candidate as D6HudCommand;
    }
    return null;
  } catch {
    return null;
  }
}
