import { beforeEach, describe, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({
  configuration: vi.fn(),
  projection: vi.fn(),
  dialog: vi.fn(),
}));

vi.mock("./grid-storage-authority.js", () => ({
  requestGridStorageConfiguration: f.configuration,
  requestGridStorageProjection: f.projection,
}));

import { confirmGridStorageRootRemoval } from "./grid-storage-root-removal.js";

beforeEach(() => {
  f.configuration.mockReset().mockResolvedValue(undefined);
  f.projection.mockReset().mockResolvedValue({
    workspace: { revision: 12 },
    objects: {},
    destinations: [],
    latestUndo: null,
  });
  f.dialog.mockReset();
  vi.stubGlobal("game", {
    user: { isGM: true },
    i18n: {
      localize: (key: string) => key,
      format: (key: string, values: Record<string, unknown>) =>
        `${key}:${String(values.name)}`,
    },
  });
  vi.stubGlobal("foundry", {
    applications: { api: { DialogV2: { wait: f.dialog } } },
  });
  vi.stubGlobal("ui", {
    notifications: { info: vi.fn(), warn: vi.fn() },
  });
});

describe("grid storage root removal confirmation", () => {
  const actor = {
    uuid: "Actor.root",
    name: "Root <One>",
  } as FoundryActorDocument & { readonly uuid: string };

  it("treats a nullish dialog result as cancellation with no mutation request", async () => {
    f.dialog.mockResolvedValue(undefined);

    await expect(confirmGridStorageRootRemoval(actor)).resolves.toBe(false);

    expect(f.configuration).not.toHaveBeenCalled();
  });

  it("sends the exact preview revision only after explicit confirmation", async () => {
    f.dialog.mockResolvedValue(true);

    await expect(confirmGridStorageRootRemoval(actor)).resolves.toBe(true);

    expect(f.configuration).toHaveBeenCalledWith({
      kind: "remove-root",
      documentUuid: actor.uuid,
      form: {},
      baseRevision: 12,
    });
    const dialogCall = f.dialog.mock.calls.at(0) as unknown as
      readonly [{ readonly content: string }] | undefined;
    expect(dialogCall?.[0].content).toContain("Root &lt;One&gt;");
  });
});
