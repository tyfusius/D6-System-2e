import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applySettingProfileTypographyReplacement,
  addWorldSettingProfileFont,
  notifySettingProfileFontAvailabilityChanged,
  removeWorldSettingProfileFont,
  removeWorldSettingProfileFontAndSynchronizeDrafts,
  resetSettingProfileTypographyEditorSubscribersForTests,
  settingProfileFontUsage,
  subscribeSettingProfileTypographyEditor,
} from "./setting-profile-typography";

afterEach(() => {
  resetSettingProfileTypographyEditorSubscribersForTests();
  vi.unstubAllGlobals();
});

describe("Setting Profile font library", () => {
  it("discovers live ApplicationV2 editors through the D6-owned subscriber lifecycle instead of ui.windows", async () => {
    const firstRefresh = vi.fn();
    const secondRefresh = vi.fn();
    const legacyRefresh = vi.fn();
    vi.stubGlobal("ui", {
      windows: {
        1: {
          refreshSettingProfileFontAvailability: legacyRefresh,
        },
      },
    });
    const unsubscribeFirst = subscribeSettingProfileTypographyEditor({
      applySettingProfileTypographyReplacement: vi.fn(),
      refreshSettingProfileFontAvailability: firstRefresh,
    });
    subscribeSettingProfileTypographyEditor({
      applySettingProfileTypographyReplacement: vi.fn(),
      refreshSettingProfileFontAvailability: secondRefresh,
    });

    await notifySettingProfileFontAvailabilityChanged();
    expect(firstRefresh).toHaveBeenCalledOnce();
    expect(secondRefresh).toHaveBeenCalledOnce();
    expect(legacyRefresh).not.toHaveBeenCalled();

    unsubscribeFirst();
    await notifySettingProfileFontAvailabilityChanged();
    expect(firstRefresh).toHaveBeenCalledOnce();
    expect(secondRefresh).toHaveBeenCalledTimes(2);
  });

  it("isolates a failed editor refresh so committed font changes still update every other editor", async () => {
    const failedRefresh = vi.fn(() => Promise.reject(new Error("closed")));
    const healthyRefresh = vi.fn();
    subscribeSettingProfileTypographyEditor({
      applySettingProfileTypographyReplacement: vi.fn(),
      refreshSettingProfileFontAvailability: failedRefresh,
    });
    subscribeSettingProfileTypographyEditor({
      applySettingProfileTypographyReplacement: vi.fn(),
      refreshSettingProfileFontAvailability: healthyRefresh,
    });

    await expect(
      notifySettingProfileFontAvailabilityChanged(),
    ).resolves.toBeUndefined();
    expect(failedRefresh).toHaveBeenCalledOnce();
    expect(healthyRefresh).toHaveBeenCalledOnce();
  });

  it("uses a secondary resizable ApplicationV2 with one scroll owner", () => {
    const source = readFileSync(
      new URL("./setting-profile-font-library-application.ts", import.meta.url),
      "utf8",
    );
    const template = readFileSync(
      new URL(
        "../../../../templates/settings/setting-profile-font-library.hbs",
        import.meta.url,
      ),
      "utf8",
    );
    expect(source).toContain("position: { height: 640, width: 720 }");
    expect(source).toContain("resizable: true");
    expect(source).toContain("new FontFace(");
    expect(source).toContain("await preview.load()");
    expect(source.indexOf("await preview.load()")).toBeLessThan(
      source.indexOf("DialogV2.wait"),
    );
    expect(source).toContain("validLocalFontPath(path)");
    expect(source).toContain("loadSettingProfileFontForRole");
    expect(source).toContain("moduleTitle(ownerId)");
    expect(source).toContain("updateAddFontDialogValidity(dialog.element)");
    expect(source).toContain('button[data-action="add"]');
    expect(source).toContain("add.disabled = !valid");
    expect(source).not.toContain('type: "image"');
    expect(source).not.toMatch(/https?:\/\//u);
    expect(template).toContain('class="d6e2-font-library-scroll"');
    expect(template).toContain('data-action="addFont"');
    expect(template).toContain('data-action="removeFont"');
    expect(template).toContain('tabindex="-1"');
    expect(template).toContain("font.sampleStyle");
    expect(template).toContain("d6e2-font-library-status");
    expect(source).toContain("d6e2-font-library-usage-list");
    expect(source).toContain("if (!replacements) return;");
    expect(source).toContain(
      "removeWorldSettingProfileFontAndSynchronizeDrafts",
    );
    expect(source).not.toMatch(/File\.(?:delete|remove)|rmSync|unlinkSync/u);
  });

  it("creates collision-safe world ids without storing a CSS family", async () => {
    let library: unknown = {
      fonts: {
        "dusty-spur": {
          id: "dusty-spur",
          label: "Dusty Spur",
          path: "fonts/dusty-spur.woff2",
          roles: ["display"],
          version: 1,
        },
      },
      version: 1,
    };
    vi.stubGlobal("game", {
      settings: {
        get: (_system: string, key: string) =>
          key === "worldSettingProfileFonts" ? library : undefined,
        set: vi.fn((_system: string, _key: string, value: unknown) => {
          library = value;
          return Promise.resolve();
        }),
      },
    });
    const refresh = vi.fn();
    subscribeSettingProfileTypographyEditor({
      applySettingProfileTypographyReplacement: vi.fn(),
      refreshSettingProfileFontAvailability: refresh,
    });
    const added = await addWorldSettingProfileFont({
      label: "Dusty Spur",
      path: "fonts/western/dusty-spur.woff2",
    });
    expect(added.id).toBe("dusty-spur-2");
    expect(added).not.toHaveProperty("family");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("atomically reassigns in-use references and rolls profile writes back", async () => {
    const originalProfiles = {
      western: {
        id: "western",
        typography: {
          body: "system/d6-interface",
          display: "world/dusty-spur",
        },
      },
    };
    let profiles: unknown = originalProfiles;
    let fonts: unknown = {
      fonts: {
        "dusty-spur": {
          id: "dusty-spur",
          label: "Dusty Spur",
          path: "fonts/dusty-spur.woff2",
          roles: ["display"],
          version: 1,
        },
      },
      version: 1,
    };
    let failLibrary = true;
    vi.stubGlobal("game", {
      settings: {
        get: (_system: string, key: string) =>
          key === "worldSettingProfileFonts"
            ? fonts
            : { activeProfileId: "western", profiles, version: 5 },
        set: vi.fn((_system: string, key: string, value: unknown) => {
          if (key === "worldSettingProfileFonts" && failLibrary) {
            failLibrary = false;
            return Promise.reject(new Error("write failed"));
          }
          if (key === "worldSettingProfileFonts") fonts = value;
          else profiles = (value as { profiles: unknown }).profiles;
          return Promise.resolve();
        }),
      },
    });
    expect(settingProfileFontUsage("world/dusty-spur")).toHaveLength(1);
    await expect(
      removeWorldSettingProfileFont("world/dusty-spur", {
        display: "system/d6-display",
      }),
    ).rejects.toThrow("write failed");
    expect(profiles).toEqual(originalProfiles);
  });

  it("atomically replaces every used role before removing only the registration", async () => {
    let profiles: Record<string, unknown> = {
      western: {
        id: "western",
        typography: {
          body: "world/dusty-spur",
          display: "world/dusty-spur",
        },
      },
    };
    let library: Record<string, unknown> = {
      fonts: {
        "dusty-spur": {
          id: "dusty-spur",
          label: "Dusty Spur",
          path: "fonts/dusty-spur.woff2",
          roles: ["body", "display"],
          version: 1,
        },
      },
      version: 1,
    };
    vi.stubGlobal("game", {
      settings: {
        get: (_system: string, key: string) =>
          key === "worldSettingProfileFonts"
            ? library
            : { activeProfileId: "western", profiles, version: 5 },
        set: vi.fn((_system: string, key: string, value: unknown) => {
          if (key === "worldSettingProfileFonts")
            library = value as Record<string, unknown>;
          else
            profiles = (value as { profiles: Record<string, unknown> })
              .profiles;
          return Promise.resolve();
        }),
      },
    });

    await removeWorldSettingProfileFont("world/dusty-spur", {
      body: "system/d6-interface",
      display: "system/d6-display",
    });

    expect(profiles.western).toMatchObject({
      typography: {
        body: "system/d6-interface",
        display: "system/d6-display",
      },
    });
    expect(
      (library.fonts as Record<string, unknown>)["dusty-spur"],
    ).toBeUndefined();
  });

  it("patches every open parent draft after replacement so a later Save cannot resurrect the removed ref", async () => {
    let profiles: Record<string, unknown> = {
      inactive: {
        description: "unsaved profile data stays independent",
        id: "inactive",
        typography: {
          body: "world/dusty-spur",
          display: "world/dusty-spur",
        },
      },
      western: {
        id: "western",
        typography: {
          body: "system/d6-interface",
          display: "world/dusty-spur",
        },
      },
    };
    let library: Record<string, unknown> = {
      fonts: {
        "dusty-spur": {
          id: "dusty-spur",
          label: "Dusty Spur",
          path: "fonts/dusty-spur.woff2",
          roles: ["body", "display"],
          version: 1,
        },
      },
      version: 1,
    };
    const firstDraft = {
      label: "unsaved label",
      typography: {
        body: "system/d6-interface",
        display: "world/dusty-spur",
      },
    };
    const secondDraft = {
      label: "another unsaved label",
      typography: {
        body: "world/dusty-spur",
        display: "world/dusty-spur",
      },
    };
    const firstEditor = vi.fn(
      (
        removedRef: string,
        replacements: Readonly<Partial<Record<"body" | "display", string>>>,
      ) => {
        firstDraft.typography = applySettingProfileTypographyReplacement(
          firstDraft.typography,
          removedRef,
          replacements,
        );
      },
    );
    const secondEditor = vi.fn(
      (
        removedRef: string,
        replacements: Readonly<Partial<Record<"body" | "display", string>>>,
      ) => {
        secondDraft.typography = applySettingProfileTypographyReplacement(
          secondDraft.typography,
          removedRef,
          replacements,
        );
      },
    );
    const legacyWindow = vi.fn();
    vi.stubGlobal("game", {
      settings: {
        get: (_system: string, key: string) =>
          key === "worldSettingProfileFonts"
            ? library
            : { activeProfileId: "western", profiles, version: 5 },
        set: vi.fn((_system: string, key: string, value: unknown) => {
          if (key === "worldSettingProfileFonts")
            library = value as Record<string, unknown>;
          else
            profiles = (value as { profiles: Record<string, unknown> })
              .profiles;
          return Promise.resolve();
        }),
      },
    });
    vi.stubGlobal("ui", {
      windows: {
        1: {
          applySettingProfileTypographyReplacement: legacyWindow,
        },
      },
    });
    const firstRefresh = vi.fn();
    const secondRefresh = vi.fn();
    subscribeSettingProfileTypographyEditor({
      applySettingProfileTypographyReplacement: firstEditor,
      refreshSettingProfileFontAvailability: firstRefresh,
    });
    subscribeSettingProfileTypographyEditor({
      applySettingProfileTypographyReplacement: secondEditor,
      refreshSettingProfileFontAvailability: secondRefresh,
    });

    await removeWorldSettingProfileFontAndSynchronizeDrafts(
      "world/dusty-spur",
      {
        body: "system/d6-interface",
        display: "system/d6-display",
      },
    );

    expect(firstEditor).toHaveBeenCalledOnce();
    expect(secondEditor).toHaveBeenCalledOnce();
    expect(firstRefresh).toHaveBeenCalledOnce();
    expect(secondRefresh).toHaveBeenCalledOnce();
    expect(legacyWindow).not.toHaveBeenCalled();
    expect(firstDraft).toEqual({
      label: "unsaved label",
      typography: {
        body: "system/d6-interface",
        display: "system/d6-display",
      },
    });
    expect(secondDraft).toEqual({
      label: "another unsaved label",
      typography: {
        body: "system/d6-interface",
        display: "system/d6-display",
      },
    });
    expect(profiles.western).toMatchObject({
      typography: {
        body: "system/d6-interface",
        display: "system/d6-display",
      },
    });
    expect(profiles.inactive).toMatchObject({
      typography: {
        body: "system/d6-interface",
        display: "system/d6-display",
      },
    });
  });

  it("falls back unsaved draft roles that were absent from persisted replacement usage", async () => {
    let profiles: Record<string, unknown> = {
      western: {
        id: "western",
        typography: {
          body: "system/d6-interface",
          display: "world/dusty-spur",
        },
      },
    };
    let library: Record<string, unknown> = {
      fonts: {
        "dusty-spur": {
          id: "dusty-spur",
          label: "Dusty Spur",
          path: "fonts/dusty-spur.woff2",
          roles: ["body", "display"],
          version: 1,
        },
      },
      version: 1,
    };
    const unsavedDraft = {
      body: "world/dusty-spur",
      display: "system/d6-display",
    };
    vi.stubGlobal("game", {
      settings: {
        get: (_system: string, key: string) =>
          key === "worldSettingProfileFonts"
            ? library
            : { activeProfileId: "western", profiles, version: 5 },
        set: vi.fn((_system: string, key: string, value: unknown) => {
          if (key === "worldSettingProfileFonts")
            library = value as Record<string, unknown>;
          else
            profiles = (value as { profiles: Record<string, unknown> })
              .profiles;
          return Promise.resolve();
        }),
      },
    });
    subscribeSettingProfileTypographyEditor({
      applySettingProfileTypographyReplacement: (
        removedRef: string,
        replacements: Readonly<Partial<Record<"body" | "display", string>>>,
      ) => {
        Object.assign(
          unsavedDraft,
          applySettingProfileTypographyReplacement(
            unsavedDraft,
            removedRef,
            replacements,
          ),
        );
      },
      refreshSettingProfileFontAvailability: vi.fn(),
    });

    await removeWorldSettingProfileFontAndSynchronizeDrafts(
      "world/dusty-spur",
      { display: "system/d6-display" },
    );

    expect(unsavedDraft).toEqual({
      body: "system/d6-interface",
      display: "system/d6-display",
    });
  });

  it("does not patch open drafts when removal rolls back", async () => {
    const originalProfiles = {
      western: {
        id: "western",
        typography: {
          body: "system/d6-interface",
          display: "world/dusty-spur",
        },
      },
    };
    let profiles: unknown = originalProfiles;
    let failLibrary = true;
    const editor = vi.fn();
    vi.stubGlobal("game", {
      settings: {
        get: (_system: string, key: string) =>
          key === "worldSettingProfileFonts"
            ? {
                fonts: {
                  "dusty-spur": {
                    id: "dusty-spur",
                    label: "Dusty Spur",
                    path: "fonts/dusty-spur.woff2",
                    roles: ["display"],
                    version: 1,
                  },
                },
                version: 1,
              }
            : { activeProfileId: "western", profiles, version: 5 },
        set: vi.fn((_system: string, key: string, value: unknown) => {
          if (key === "worldSettingProfileFonts" && failLibrary) {
            failLibrary = false;
            return Promise.reject(new Error("write failed"));
          }
          if (key === "worldSettingProfiles")
            profiles = (value as { profiles: unknown }).profiles;
          return Promise.resolve();
        }),
      },
    });
    subscribeSettingProfileTypographyEditor({
      applySettingProfileTypographyReplacement: editor,
      refreshSettingProfileFontAvailability: vi.fn(),
    });

    await expect(
      removeWorldSettingProfileFontAndSynchronizeDrafts("world/dusty-spur", {
        display: "system/d6-display",
      }),
    ).rejects.toThrow("write failed");
    expect(editor).not.toHaveBeenCalled();
    expect(profiles).toEqual(originalProfiles);
  });

  it("does not rewrite an unrelated unavailable provider reference", () => {
    const draft = {
      body: "module/western-pack/body",
      display: "module/western-pack/display",
    };

    expect(
      applySettingProfileTypographyReplacement(draft, "world/dusty-spur", {
        display: "system/d6-display",
      }),
    ).toEqual(draft);
  });
});
