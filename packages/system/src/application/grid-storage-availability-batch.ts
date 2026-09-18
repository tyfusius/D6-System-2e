import type { D6StorageAvailability } from "@d6-system-2e/core";
export const GRID_STORAGE_AVAILABILITY_BATCH_LIMIT = 128;
export type GridStorageAvailabilityBatch = Readonly<
  Record<string, D6StorageAvailability>
>;
export function validGridStorageAvailabilityBatchIds(
  value: unknown,
): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= GRID_STORAGE_AVAILABILITY_BATCH_LIMIT &&
    value.every(
      (id) => typeof id === "string" && id.length > 0 && id.length <= 512,
    ) &&
    new Set(value).size === value.length
  );
}
