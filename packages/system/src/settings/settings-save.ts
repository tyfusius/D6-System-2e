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
    for (const entry of entries) {
      if (Object.is(game.settings.get(SYSTEM_ID, entry.key), entry.value)) {
        continue;
      }
      await game.settings.set(SYSTEM_ID, entry.key, entry.value);
      changed += 1;
    }
    await afterSettings();
    return changed;
  });
}
