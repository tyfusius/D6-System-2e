interface ImageDocument {
  readonly img: string;
  update(changes: Record<string, unknown>): Promise<unknown>;
}

/** Open Foundry's native image browser and persist the selected artwork immediately. */
export async function openDocumentImagePicker(
  document: ImageDocument,
): Promise<void> {
  const picker = new foundry.applications.apps.FilePicker.implementation({
    callback: (path) => document.update({ img: path }),
    current: document.img,
    document,
    type: "image",
  });
  await picker.browse();
}
