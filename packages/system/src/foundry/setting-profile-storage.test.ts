import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureSettingProfileDirectory,
  settingProfileAssetDiagnostics,
  settingProfileDirectory,
} from "./setting-profile-storage";
import { normalizeSettingProfile } from "../settings/setting-profile";

const existing = new Set<string>();
const created: string[] = [];

class TestFilePicker {
  browse(): Promise<void> {
    return Promise.resolve();
  }

  static browse(_source: "data", target: string): Promise<void> {
    return existing.has(target)
      ? Promise.resolve()
      : Promise.reject(new Error("Missing directory"));
  }

  static createDirectory(_source: "data", target: string): Promise<void> {
    created.push(target);
    existing.add(target);
    return Promise.resolve();
  }
}

describe("Setting Profile storage", () => {
  beforeEach(() => {
    existing.clear();
    created.length = 0;
    vi.stubGlobal("game", { world: { id: "echo-main" } });
    vi.stubGlobal("foundry", {
      applications: {
        apps: { FilePicker: { implementation: TestFilePicker } },
      },
    });
  });

  it("resolves a world-owned folder from a stable setting ID", () => {
    expect(settingProfileDirectory("My Setting", "World-ID")).toBe(
      "worlds/World-ID/Setting Profiles/my-setting",
    );
  });

  it("creates only the missing profile workspace folders", async () => {
    await expect(ensureSettingProfileDirectory("my-setting")).resolves.toBe(
      "worlds/echo-main/Setting Profiles/my-setting",
    );
    expect(created).toEqual([
      "worlds/echo-main/Setting Profiles",
      "worlds/echo-main/Setting Profiles/my-setting",
    ]);

    created.length = 0;
    await ensureSettingProfileDirectory("my-setting");
    expect(created).toEqual([]);
  });

  it("reports invalid and unavailable image/audio references once per field", async () => {
    const profile = normalizeSettingProfile({
      id: "asset-test",
      label: "Asset Test",
      logo: "worlds/echo-main/logo.webp",
      skills: [
        {
          attributeId: "agility",
          description: "",
          img: "worlds/echo-main/missing.png",
          key: "acrobatics",
          name: "Acrobatics",
          training: "standard",
        },
      ],
      wildDie: {
        one: { kind: "image", value: "worlds/echo-main/missing.png" },
        oneSound: "worlds/echo-main/wild-one.exe",
        six: { kind: "text", value: "6" },
        sixSound: "worlds/echo-main/wild-six.ogg",
      },
    });
    const probed: string[] = [];
    const diagnostics = await settingProfileAssetDiagnostics(
      profile,
      (path) => {
        probed.push(path);
        return Promise.resolve(path !== "worlds/echo-main/missing.png");
      },
    );
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "missing-asset",
        field: "skills.0.img",
      }),
      expect.objectContaining({
        code: "missing-asset",
        field: "wildDie.one.value",
      }),
    ]);
    expect(
      probed.filter((path) => path === "worlds/echo-main/missing.png"),
    ).toHaveLength(1);

    const invalid = await settingProfileAssetDiagnostics(
      { ...profile, logo: "https://example.invalid/logo.png" },
      () => Promise.resolve(true),
    );
    expect(invalid).toContainEqual(
      expect.objectContaining({ code: "invalid-path", field: "logo" }),
    );
  });
});
