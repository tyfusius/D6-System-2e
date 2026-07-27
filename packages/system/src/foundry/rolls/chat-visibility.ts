import type { D6RollMode } from "@d6-system-2e/core";

export interface D6ChatVisibility {
  readonly blind?: boolean;
  readonly whisper?: readonly string[];
}

export function chatVisibilityForMode(
  mode: D6RollMode,
  gmIds: readonly string[],
  userId?: string,
): D6ChatVisibility {
  if (mode === "gmroll") {
    return {
      whisper: [...new Set([...gmIds, ...(userId ? [userId] : [])])],
    };
  }
  if (mode === "blindroll") return { blind: true, whisper: [...gmIds] };
  if (mode === "selfroll") return { whisper: userId ? [userId] : [] };
  return {};
}
