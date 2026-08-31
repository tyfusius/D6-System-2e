import { afterEach, describe, expect, it, vi } from "vitest";
import type { D6SettingProfileV5 } from "@d6-system-2e/core";
import {
  D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY,
  applyD6SettingProfileTypographyScope,
  availableSettingProfileFonts,
  loadSettingProfileFontForRole,
  replaceAppliedSettingProfileTypography,
  registerSettingProfileFontContribution,
  resetSettingProfileFontRegistryForTests,
  resetSettingProfileTypographyEditorSubscribersForTests,
  resolveSettingProfileTypography,
  settingProfileTypographyProperties,
  synchronizeSettingProfileTypography,
  subscribeSettingProfileTypographyEditor,
  unregisterSettingProfileFontOwner,
  validateSettingProfileTypography,
  validLocalFontPath,
} from "./setting-profile-typography";

afterEach(() => {
  resetSettingProfileFontRegistryForTests();
  resetSettingProfileTypographyEditorSubscribersForTests();
  vi.unstubAllGlobals();
});

describe("Setting Profile typography", () => {
  it("offers only stable system-safe font ids and inert family stacks", () => {
    const fonts = availableSettingProfileFonts();
    expect(fonts.map(({ ref }) => ref)).toEqual([
      "system/d6-display",
      "system/d6-interface",
      "system/system-sans",
    ]);
    expect(new Set(fonts.map(({ id }) => id)).size).toBe(fonts.length);
    for (const font of fonts) {
      expect(font.ref).toMatch(/^system\/[a-z][a-z0-9-]*$/u);
      expect(font.family).not.toMatch(/(?:@import|url\(|[{};])/iu);
    }
  });

  it("preserves missing typography and resolves unavailable ids without CSS injection", () => {
    expect(resolveSettingProfileTypography(undefined)).toMatchObject({
      body: { available: true, effectiveId: "system/d6-interface" },
      display: { available: true, effectiveId: "system/d6-display" },
    });
    expect(
      resolveSettingProfileTypography({
        body: "system/d6-interface",
        display: "module/western-pack/dusty-spur",
      }),
    ).toMatchObject({
      display: {
        available: false,
        effectiveId: "system/d6-display",
        requestedId: "module/western-pack/dusty-spur",
      },
      body: {
        available: true,
        effectiveId: "system/d6-interface",
        requestedId: "system/d6-interface",
      },
    });
    const properties = settingProfileTypographyProperties({
      body: "system/system-sans",
      display: "module/western-pack/dusty-spur",
    });
    expect(properties["--d6e2-profile-font-body"]).toContain("system-ui");
    expect(properties["--d6e2-profile-font-display"]).toContain(
      "Avenir Next Condensed",
    );
  });

  it("strictly rejects arbitrary ids while accepting the controlled registry", () => {
    expect(
      validateSettingProfileTypography(D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY),
    ).toEqual({ valid: true });
    expect(
      validateSettingProfileTypography({
        display: "url-https-example-invalid",
        body: "system/d6-interface",
      }),
    ).toEqual({
      role: "display",
      reason: "malformed",
      valid: false,
    });
  });

  it("accepts only local font assets and owner-scoped module contributions", () => {
    expect(validLocalFontPath("fonts/western/dusty-spur.woff2")).toBe(true);
    for (const unsafe of [
      "https://example.com/font.woff2",
      "data:font/woff2;base64,AAAA",
      "/fonts/font.ttf",
      "fonts/../secret.otf",
      "fonts/font.svg",
      'fonts/font"}.woff2',
    ]) {
      expect(validLocalFontPath(unsafe)).toBe(false);
    }
    vi.stubGlobal("Hooks", { callAll: vi.fn() });
    const refresh = vi.fn();
    subscribeSettingProfileTypographyEditor({
      applySettingProfileTypographyReplacement: vi.fn(),
      refreshSettingProfileFontAvailability: refresh,
    });
    registerSettingProfileFontContribution("western-pack", {
      id: "dusty-spur",
      label: "Dusty Spur",
      path: "modules/western-pack/fonts/dusty-spur.woff2",
      roles: ["display"],
      version: 1,
    });
    expect(
      availableSettingProfileFonts().find(
        ({ ref }) => ref === "module/western-pack/dusty-spur",
      ),
    ).toMatchObject({ ownerId: "western-pack", source: "module" });
    expect(refresh).toHaveBeenCalledOnce();
    unregisterSettingProfileFontOwner("western-pack");
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(() =>
      registerSettingProfileFontContribution("western-pack", {
        id: "foreign",
        label: "Foreign",
        path: "modules/other/fonts/foreign.woff2",
        roles: ["display"],
        version: 1,
      }),
    ).toThrow("belong to their module");
  });

  it("replaces exact typography properties and removes stale role overrides", () => {
    const properties = new Map([
      ["--d6e2-font-display", "old display"],
      ["--od6-font-display", "old display"],
      ["--unrelated", "preserved"],
    ]);
    const root = {
      dataset: {
        d6System2eTypographyProperties:
          "--d6e2-font-display,--od6-font-display",
        d6System2eTypographySignature: "old",
      } as Record<string, string>,
      style: {
        removeProperty: (name: string) => {
          properties.delete(name);
          return "";
        },
        setProperty: (name: string, value: string) => {
          properties.set(name, value);
        },
      },
    };
    const typography = {
      body: "system/system-sans",
      display: "system/d6-display",
    } as const;

    expect(replaceAppliedSettingProfileTypography(root, typography)).toBe(true);
    expect(properties).toEqual(
      new Map([
        ["--unrelated", "preserved"],
        ["--d6e2-profile-font-body", expect.stringContaining("system-ui")],
        [
          "--d6e2-profile-font-display",
          expect.stringContaining("Avenir Next Condensed"),
        ],
      ]),
    );
    expect(replaceAppliedSettingProfileTypography(root, typography)).toBe(
      false,
    );
  });

  it("keeps explicit client theme selection independent from shared typography", () => {
    const profile = {
      id: "world-setting",
      logo: "",
      typography: {
        body: "system/system-sans",
        display: "system/d6-display",
      },
    } as Pick<D6SettingProfileV5, "id" | "logo" | "typography">;
    const properties = settingProfileTypographyProperties(profile.typography);
    expect(properties["--d6e2-profile-font-body"]).toContain("system-ui");
    expect(properties["--d6e2-profile-font-display"]).toContain(
      "Avenir Next Condensed",
    );
  });

  it("scopes typography to D6 applications and cards without touching third-party roots", () => {
    const element = (selector: string) => {
      const classes = new Set<string>();
      return {
        classList: {
          add: (value: string) => classes.add(value),
          contains: (value: string) => classes.has(value),
        },
        matches: (value: string) =>
          value.split(",").some((entry) => entry.trim() === selector),
        querySelector: () => null,
        classes,
      };
    };
    const d6 = element(".application.d6e2");
    const tah = element(".token-action-hud");
    expect(
      applyD6SettingProfileTypographyScope(d6 as unknown as HTMLElement),
    ).toBe(true);
    expect(d6.classes.has("d6e2-typography-scope")).toBe(true);
    expect(
      applyD6SettingProfileTypographyScope(tah as unknown as HTMLElement),
    ).toBe(false);
    expect(tah.classes.size).toBe(0);
  });

  it("keeps fallback painted through load failure and restores a provider font on return", async () => {
    vi.stubGlobal("Hooks", { callAll: vi.fn() });
    vi.stubGlobal("foundry", { utils: { getRoute: (path: string) => path } });
    const faces = new Set<unknown>();
    vi.stubGlobal("document", {
      fonts: {
        add: (face: unknown) => faces.add(face),
        delete: (face: unknown) => faces.delete(face),
      },
    });
    let shouldLoad = false;
    vi.stubGlobal(
      "FontFace",
      class {
        constructor(
          readonly family: string,
          readonly source: string,
        ) {}
        async load(): Promise<this> {
          if (!shouldLoad) throw new Error("missing");
          return await Promise.resolve(this);
        }
      },
    );
    const register = () =>
      registerSettingProfileFontContribution("western-pack", {
        id: "dusty-spur",
        label: "Dusty Spur",
        path: "modules/western-pack/fonts/dusty-spur.woff2",
        roles: ["display"],
        version: 1,
      });
    const properties = new Map<string, string>();
    const root = {
      dataset: {} as Record<string, string>,
      style: {
        removeProperty: (name: string) => {
          properties.delete(name);
          return "";
        },
        setProperty: (name: string, value: string) =>
          properties.set(name, value),
      },
    };
    const typography = {
      body: "system/d6-interface",
      display: "module/western-pack/dusty-spur",
    } as const;
    register();
    await synchronizeSettingProfileTypography(root, typography);
    expect(properties.get("--d6e2-profile-font-display")).toContain(
      "Avenir Next Condensed",
    );
    unregisterSettingProfileFontOwner("western-pack");
    await synchronizeSettingProfileTypography(root, typography);
    expect(properties.get("--d6e2-profile-font-display")).toContain(
      "Avenir Next Condensed",
    );
    shouldLoad = true;
    register();
    await synchronizeSettingProfileTypography(root, typography);
    expect(properties.get("--d6e2-profile-font-display")).toContain(
      "d6e2-local-module-western-pack-dusty-spur",
    );
    expect(faces.size).toBe(1);
  });

  it("loads a selected asset face for an editor preview and reports a truthful fallback", async () => {
    vi.stubGlobal("Hooks", { callAll: vi.fn() });
    vi.stubGlobal("foundry", { utils: { getRoute: (path: string) => path } });
    const faces = new Set<unknown>();
    vi.stubGlobal("document", {
      fonts: {
        add: (face: unknown) => faces.add(face),
        delete: (face: unknown) => faces.delete(face),
      },
    });
    let shouldLoad = true;
    vi.stubGlobal(
      "FontFace",
      class {
        constructor(
          readonly family: string,
          readonly source: string,
        ) {}
        async load(): Promise<this> {
          if (!shouldLoad) throw new Error("missing");
          return await Promise.resolve(this);
        }
      },
    );
    registerSettingProfileFontContribution("western-pack", {
      id: "dusty-spur",
      label: "Dusty Spur",
      path: "modules/western-pack/fonts/dusty-spur.woff2",
      roles: ["display"],
      version: 1,
    });

    const loaded = await loadSettingProfileFontForRole(
      "module/western-pack/dusty-spur",
      "display",
    );
    expect(loaded).toMatchObject({
      available: true,
      effectiveId: "module/western-pack/dusty-spur",
    });
    expect(loaded.family).toContain(
      "d6e2-local-module-western-pack-dusty-spur",
    );
    expect(faces.size).toBe(1);

    resetSettingProfileFontRegistryForTests();
    shouldLoad = false;
    registerSettingProfileFontContribution("western-pack", {
      id: "dusty-spur",
      label: "Dusty Spur",
      path: "modules/western-pack/fonts/dusty-spur.woff2",
      roles: ["display"],
      version: 1,
    });
    const failed = await loadSettingProfileFontForRole(
      "module/western-pack/dusty-spur",
      "display",
    );
    expect(failed).toMatchObject({
      available: false,
      effectiveId: "system/d6-display",
    });
    expect(failed.family).toContain("Avenir Next Condensed");
  });
});
