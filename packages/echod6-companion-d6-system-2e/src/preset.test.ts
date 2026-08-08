import { describe, expect, it, vi } from "vitest";
import type { D6SystemPublicApi } from "./d6-system-api";
import { applyEchoPreset, createEchoProfilePreset } from "./preset";

describe("Echo recommended-rules action", () => {
  it("activates the module-provided Echo Rules and Setting Profiles", async () => {
    vi.stubGlobal("game", { i18n: { localize: (key: string) => key } });
    const activatePreset = vi.fn(() =>
      Promise.resolve({ preview: { changedCount: 2, unchangedCount: 0 } }),
    );
    const api = {
      profilePreset: { activate: activatePreset },
    } as unknown as D6SystemPublicApi;

    await expect(applyEchoPreset(api)).resolves.toMatchObject({
      preview: { changedCount: 2, unchangedCount: 0 },
    });
    expect(activatePreset).toHaveBeenCalledWith({
      rulesProfileId: "echo-d6",
      settingProfileId: "echo-d6",
      version: 1,
    });
  });

  it("publishes one portable named recommendation for discovery", () => {
    expect(createEchoProfilePreset((key) => key)).toEqual({
      description: "ECHOD6.Settings.PresetHint",
      id: "echo-d6-recommended",
      label: "ECHOD6.Settings.PresetName",
      selection: {
        rulesProfileId: "echo-d6",
        settingProfileId: "echo-d6",
        version: 1,
      },
      version: 1,
    });
  });
});
