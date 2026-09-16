import {
  requestGridStorageConfiguration,
  requestGridStorageProjection,
} from "./grid-storage-authority.js";

function escaped(value: string): string {
  return value.replace(
    /[&<>"']/gu,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

export async function confirmGridStorageRootRemoval(
  actor: FoundryActorDocument & { readonly uuid: string },
): Promise<boolean> {
  if (!game.user?.isGM) return false;
  const projection = await requestGridStorageProjection({
    actorUuid: actor.uuid,
  });
  const baseRevision = projection.workspace?.revision;
  if (baseRevision === null || baseRevision === undefined) return false;
  const confirmed = await foundry.applications.api.DialogV2.wait<boolean>({
    buttons: [
      {
        action: "remove",
        callback: () => true,
        class: "bright",
        default: false,
        icon: "fa-solid fa-box-archive",
        label: game.i18n.localize("D6E2.Storage.RemoveStorageRoot"),
      },
      {
        action: "cancel",
        callback: () => false,
        default: true,
        label: game.i18n.localize("D6E2.Cancel"),
      },
    ],
    classes: ["d6e2", "od6roll-dialog", "d6e2-storage-root-removal"],
    content: `<p>${game.i18n.format("D6E2.Storage.RemoveStorageRootConfirm", {
      name: escaped(actor.name),
    })}</p><p>${game.i18n.localize("D6E2.Storage.RemoveStorageRootPreservesItems")}</p>`,
    modal: true,
    window: {
      icon: "fa-solid fa-box-archive",
      title: game.i18n.localize("D6E2.Storage.RemoveStorageRootTitle"),
    },
  });
  if (confirmed !== true) return false;
  try {
    await requestGridStorageConfiguration({
      kind: "remove-root",
      documentUuid: actor.uuid,
      form: {},
      baseRevision,
    });
    ui.notifications.info(
      game.i18n.localize("D6E2.Storage.RemoveStorageRootCompleted"),
    );
    return true;
  } catch (error) {
    ui.notifications.warn(
      game.i18n.localize(
        error instanceof Error
          ? error.message
          : "D6E2.Storage.Error.RootRemovalUnavailable",
      ),
    );
    return false;
  }
}
