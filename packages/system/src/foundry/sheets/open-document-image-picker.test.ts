import { afterEach, describe, expect, it, vi } from "vitest";
import { openDocumentImagePicker } from "./open-document-image-picker";

describe("openDocumentImagePicker", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("opens at the current image and persists the selected path", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    let pickerOptions: Record<string, unknown> | undefined;

    class TestFilePicker {
      constructor(options: Record<string, unknown>) {
        pickerOptions = options;
      }

      async browse(): Promise<void> {
        const callback = pickerOptions?.callback as
          ((path: string) => unknown) | undefined;
        if (callback) await callback("worlds/test/new-portrait.webp");
      }
    }

    vi.stubGlobal("foundry", {
      applications: {
        apps: { FilePicker: { implementation: TestFilePicker } },
      },
    });

    const document = { img: "icons/old-portrait.webp", update };
    await openDocumentImagePicker(document);

    expect(pickerOptions).toMatchObject({
      current: "icons/old-portrait.webp",
      document,
      type: "image",
    });
    expect(update).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith({
      img: "worlds/test/new-portrait.webp",
    });
  });
});
