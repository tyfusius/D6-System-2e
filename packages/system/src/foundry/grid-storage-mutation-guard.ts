import { itemStorageCapability } from "../item-storage-capability.js";
import {
  gridStorageItemParticipates,
  gridStorageObjectFromItem,
} from "./grid-storage-document-adapter.js";
import { canonical } from "../application/first-edition-action-validation.js";
export { assertGridStorageLegacyMutationAllowed } from "./grid-storage-legacy-guard.js";
import { destinyClientIsAuthority } from "./destiny-crypto.js";
import {
  mutateGridStorageAuthorityState,
  readGridStorageAuthorityState,
} from "./grid-storage-state.js";
import { currencyWalletBlocksHolderRemoval } from "./currency-state.js";

export const GRID_STORAGE_AUTHORITY_WRITE_OPTION =
  "d6GridStorageAuthorityWrite" as const;

const GUARDED_SYSTEM_FIELDS = Object.freeze([
  "equipped",
  "installed",
  "quantity",
  "currencyWallet",
  "hasStorage",
  "gearCategory",
  "storageInstanceId",
  "storageInterior",
  "storagePhysical",
] as const);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function authorityWrite(options: unknown): boolean {
  return (
    record(options)[GRID_STORAGE_AUTHORITY_WRITE_OPTION] === true &&
    destinyClientIsAuthority() &&
    game.user?.isGM === true
  );
}

const migratingItems = new WeakSet<object>();

/** Trusted world-migration scope; readiness does not require crypto election. */
export async function withGridStorageItemMigration<T>(
  items: readonly object[],
  migrate: () => Promise<T>,
): Promise<T> {
  if (game.user?.isGM !== true) throw new Error("D6E2.Storage.Error.Authority");
  for (const item of items) migratingItems.add(item);
  try {
    return await migrate();
  } finally {
    for (const item of items) migratingItems.delete(item);
  }
}

function authorizedItemMigration(item: object, options: unknown): boolean {
  return (
    game.user?.isGM === true &&
    record(options).d6System2eMigration === true &&
    migratingItems.has(item)
  );
}

function guardedSystemChange(changes: unknown): boolean {
  const update = record(changes);
  const system = record(update.system);
  return GUARDED_SYSTEM_FIELDS.some(
    (field) =>
      Object.keys(update).some(
        (key) =>
          key === `system.${field}` || key.startsWith(`system.${field}.`),
      ) || Object.hasOwn(system, field),
  );
}

function incomingStorageIdentity(changes: unknown): string {
  const update = record(changes);
  if (Object.hasOwn(update, "system.storageInstanceId"))
    return text(update["system.storageInstanceId"]);
  return text(record(update.system).storageInstanceId);
}

function warn(): void {
  ui.notifications.warn(
    game.i18n.localize("D6E2.Storage.Error.AuthorityRequired"),
  );
}

function guardGridStorageItemCreate(
  item: unknown,
  _data: unknown,
  options: unknown,
): boolean | undefined {
  if (authorityWrite(options) || !item || typeof item !== "object") return;
  const document = item as FoundryItemDocument;
  if (itemStorageCapability(document).inherent)
    document.updateSource?.({ "system.hasStorage": true });
  if (
    !gridStorageItemParticipates(document) &&
    !currencyWalletBlocksHolderRemoval(document)
  )
    return;
  warn();
  return false;
}

function guardCurrencyHolderActorDelete(
  actor: unknown,
  options: unknown,
): boolean | undefined {
  const document = actor as FoundryActorDocument;
  if (
    authorityWrite(options) ||
    !actor ||
    typeof actor !== "object" ||
    !["character", "vehicle", "starship", "storage-location"].includes(
      document.type,
    ) ||
    record(record(document.system).storage).configured !== true
  )
    return;
  const actorItems = (
    document as {
      readonly items?: { readonly contents?: readonly FoundryItemDocument[] };
    }
  ).items?.contents;
  const funded =
    currencyWalletBlocksHolderRemoval(document) ||
    (actorItems ?? []).some(
      (item) =>
        record(record(item.system).storageInterior).configured === true &&
        currencyWalletBlocksHolderRemoval(item),
    );
  if (!funded) return;
  warn();
  return false;
}

function guardCurrencyHolderActorCreate(
  actor: unknown,
  data: unknown,
  options: unknown,
): boolean | undefined {
  if (authorityWrite(options) || !actor || typeof actor !== "object") return;
  const document = actor as FoundryActorDocument;
  if (
    !["character", "vehicle", "starship", "storage-location"].includes(
      document.type,
    )
  )
    return;
  const actorItems = (
    document as {
      readonly items?: { readonly contents?: readonly FoundryItemDocument[] };
    }
  ).items?.contents;
  const funded =
    currencyWalletBlocksHolderRemoval(document) ||
    (actorItems ?? []).some(
      (item) =>
        record(record(item.system).storageInterior).configured === true &&
        currencyWalletBlocksHolderRemoval(item),
    ) ||
    (Array.isArray(record(data).items)
      ? (record(data).items as unknown[])
      : []
    ).some((item: unknown) => {
      const source = record(item);
      return (
        record(record(source.system).storageInterior).configured === true &&
        currencyWalletBlocksHolderRemoval(
          source as unknown as FoundryItemDocument,
        )
      );
    });
  if (!funded) return;
  warn();
  return false;
}

function guardGridStorageItemUpdate(
  item: unknown,
  changes: unknown,
  options: unknown,
): boolean | undefined {
  if (authorityWrite(options) || !item || typeof item !== "object") return;
  if (authorizedItemMigration(item, options)) return;
  const document = item as FoundryItemDocument;
  const update = record(changes);
  const incoming = { ...record(update.system) };
  for (const [key, value] of Object.entries(update))
    if (key.startsWith("system.")) incoming[key.slice(7)] = value;
  const capabilityChange =
    Object.hasOwn(incoming, "hasStorage") ||
    Object.hasOwn(incoming, "gearCategory");
  if (
    capabilityChange &&
    itemStorageCapability(document).supported &&
    document.parent
  ) {
    warn();
    return false;
  }
  const removesInterior =
    record(incoming.storageInterior).configured === false ||
    incoming["storageInterior.configured"] === false;
  if (removesInterior && currencyWalletBlocksHolderRemoval(document)) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Storage.Currency.Error.FundsPresent"),
    );
    return false;
  }
  if (
    capabilityChange &&
    currencyWalletBlocksHolderRemoval(document) &&
    (incoming.hasStorage === false ||
      (document.system.gearCategory === "container" &&
        incoming.gearCategory !== undefined &&
        incoming.gearCategory !== "container"))
  ) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Storage.Currency.Error.FundsPresent"),
    );
    return false;
  }
  const createsIdentity = incomingStorageIdentity(changes).length > 0;
  if (
    !guardedSystemChange(changes) ||
    (!gridStorageItemParticipates(document) && !createsIdentity)
  )
    return;
  warn();
  return false;
}

function guardGridStorageItemDelete(
  item: unknown,
  options: unknown,
): boolean | undefined {
  if (
    authorityWrite(options) ||
    !item ||
    typeof item !== "object" ||
    !gridStorageItemParticipates(item as FoundryItemDocument)
  )
    return;
  warn();
  return false;
}

export async function synchronizeGridStorageItemWitness(
  document: FoundryItemDocument,
): Promise<void> {
  if (
    !destinyClientIsAuthority() ||
    !game.user?.isGM ||
    !gridStorageItemParticipates(document)
  )
    return;
  const instanceId = text(record(document.system).storageInstanceId);
  if (!instanceId || !document.uuid || !document.parent?.uuid) return;
  const state = await readGridStorageAuthorityState();
  const object = state.ledger.objects[instanceId];
  if (
    object?.documentUuid !== document.uuid ||
    object.ownerActorUuid !== document.parent.uuid ||
    object.quantity !== Number(record(document.system).quantity) ||
    (object.location.disposition === "equipped") !==
      (record(document.system).equipped === true) ||
    (object.location.disposition === "installed") !==
      (record(document.system).installed === true)
  ) {
    warn();
    return;
  }
  const projected = await gridStorageObjectFromItem(
    document as FoundryItemDocument & {
      readonly uuid: string;
      readonly parent: FoundryActorDocument & { readonly uuid: string };
    },
    object.location,
  );
  if (canonical(projected.definition) !== canonical(object.definition)) {
    warn();
    return;
  }
  if (projected.witness === object.witness) return;
  await mutateGridStorageAuthorityState(state.ledger.revision, (current) => [
    {
      ...current,
      ledger: {
        ...current.ledger,
        revision: current.ledger.revision + 1,
        objects: {
          ...current.ledger.objects,
          [instanceId]: { ...object, witness: projected.witness },
        },
      },
    },
    undefined,
  ]);
}

export async function reconcileGridStorageItemWitnesses(): Promise<void> {
  if (!destinyClientIsAuthority() || !game.user?.isGM) return;
  const state = await readGridStorageAuthorityState();
  const objects = { ...state.ledger.objects };
  let changed = false;
  for (const [instanceId, object] of Object.entries(objects)) {
    const document = (await fromUuid(
      object.documentUuid,
    )) as FoundryItemDocument | null;
    if (
      !document ||
      !gridStorageItemParticipates(document) ||
      document.uuid !== object.documentUuid ||
      document.parent?.uuid !== object.ownerActorUuid ||
      text(record(document.system).storageInstanceId) !== instanceId ||
      Number(record(document.system).quantity) !== object.quantity ||
      (object.location.disposition === "equipped") !==
        (record(document.system).equipped === true) ||
      (object.location.disposition === "installed") !==
        (record(document.system).installed === true)
    )
      continue;
    const projected = await gridStorageObjectFromItem(
      document as FoundryItemDocument & {
        readonly uuid: string;
        readonly parent: FoundryActorDocument & { readonly uuid: string };
      },
      object.location,
    );
    if (canonical(projected.definition) !== canonical(object.definition))
      continue;
    if (projected.witness === object.witness) continue;
    objects[instanceId] = { ...object, witness: projected.witness };
    changed = true;
  }
  if (!changed) return;
  await mutateGridStorageAuthorityState(state.ledger.revision, (current) => [
    {
      ...current,
      ledger: {
        ...current.ledger,
        revision: current.ledger.revision + 1,
        objects,
      },
    },
    undefined,
  ]);
}

async function reconcileGridStorageItemUpdate(
  item: unknown,
  _changes: unknown,
  options: unknown,
): Promise<void> {
  if (
    authorityWrite(options) ||
    !destinyClientIsAuthority() ||
    !game.user?.isGM ||
    !item ||
    typeof item !== "object" ||
    !gridStorageItemParticipates(item as FoundryItemDocument)
  )
    return;
  await synchronizeGridStorageItemWitness(item as FoundryItemDocument);
}

export function registerGridStorageMutationGuards(): void {
  Hooks.on("preCreateActor", guardCurrencyHolderActorCreate);
  Hooks.on("preCreateItem", guardGridStorageItemCreate);
  Hooks.on("preUpdateItem", guardGridStorageItemUpdate);
  Hooks.on("preDeleteItem", guardGridStorageItemDelete);
  Hooks.on("preDeleteActor", guardCurrencyHolderActorDelete);
  Hooks.on(
    "updateItem",
    (...args: unknown[]) =>
      void reconcileGridStorageItemUpdate(args[0], args[1], args[2]),
  );
}
