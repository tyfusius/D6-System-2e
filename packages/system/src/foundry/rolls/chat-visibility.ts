import type { D6RollMode } from "@d6-system-2e/core";

export interface D6ChatVisibility {
  readonly blind?: boolean;
  readonly whisper?: readonly string[];
}

function requiredCurrentUser(mode: D6RollMode, userId?: string): string {
  if (!userId) {
    throw new Error(
      `Roll mode ${mode} requires the current Foundry user as a recipient.`,
    );
  }
  return userId;
}

export function chatVisibilityForMode(
  mode: D6RollMode,
  gmIds: readonly string[],
  userId?: string,
): D6ChatVisibility {
  if (mode === "gmroll") {
    return {
      whisper: [...new Set([...gmIds, requiredCurrentUser(mode, userId)])],
    };
  }
  if (mode === "blindroll") return { blind: true, whisper: [...gmIds] };
  if (mode === "selfroll") {
    return { whisper: [requiredCurrentUser(mode, userId)] };
  }
  return {};
}
