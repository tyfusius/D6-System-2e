import { gridStorageItemParticipates } from "./grid-storage-document-adapter.js";

export function assertGridStorageLegacyMutationAllowed(
  item: FoundryItemDocument,
): void {
  if (gridStorageItemParticipates(item))
    throw new Error("D6E2.Storage.Error.AuthorityRequired");
}
