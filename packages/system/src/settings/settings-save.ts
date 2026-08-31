import { SYSTEM_ID } from "../constants";
import { batchRenderedDocumentSheetRefreshes } from "./rendered-document-sheets";

export type SystemSettingSaveValue = boolean | number | string;

export interface SystemSettingSaveEntry {
  readonly key: string;
  readonly value: SystemSettingSaveValue;
}

/** Persist only changed values and flush affected rendered sheets once afterward. */
export async function persistSystemSettingsSave(
  entries: readonly SystemSettingSaveEntry[],
  afterSettings: () => Promise<void> = () => Promise.resolve(),
): Promise<number> {
  return batchRenderedDocumentSheetRefreshes(async () => {
    let changed = 0;
    const prior: SystemSettingSaveEntry[] = [];
    try {
      for (const entry of entries) {
        const value = game.settings.get(SYSTEM_ID, entry.key) as
          boolean | number | string;
        if (Object.is(value, entry.value)) continue;
        prior.push({ key: entry.key, value });
        await game.settings.set(SYSTEM_ID, entry.key, entry.value);
        changed += 1;
      }
      await afterSettings();
      return changed;
    } catch (error) {
      for (const entry of prior.reverse()) {
        await game.settings.set(SYSTEM_ID, entry.key, entry.value);
      }
      throw error;
    }
  });
}
