import { describe, expect, it } from "vitest";
import type { D6SystemPublicApi } from "./d6-system-api";
import {
  ECHO_SETTING_PROFILE_ID,
  isEchoSettingSelected,
  MODULE_ID,
} from "./module";

function api(activeProfileId: string, available = true): D6SystemPublicApi {
  return {
    apiVersion: 2,
    rules: {
      activate: () => Promise.reject(new Error("not used")),
    },
    rulesProfileRegistry: {
      register: () => undefined,
      unregisterOwner: () => undefined,
    },
    profilePreset: {
      activate: () => Promise.reject(new Error("not used")),
    },
    profilePresetRegistry: {
      register: () => undefined,
      unregisterOwner: () => undefined,
    },
    setting: {
      activate: () => Promise.reject(new Error("not used")),
      selection: () => ({ activeProfileId, available }),
    },
    settingProfileRegistry: {
      register: () => undefined,
      unregisterOwner: () => undefined,
    },
    systemId: "d6-system-2e",
    terminology: {
      register: () => undefined,
      unregisterOwner: () => undefined,
    },
    themes: {
      register: () => undefined,
      unregisterOwner: () => undefined,
    },
  };
}

describe("Echo module identity", () => {
  it("keeps package identity separate from its Setting Profile identity", () => {
    expect(MODULE_ID).toBe("echod6-companion-d6-system-2e");
    expect(ECHO_SETTING_PROFILE_ID).toBe("echo-d6");
  });

  it("activates presentation only for an available selected Echo Setting Profile", () => {
    expect(isEchoSettingSelected(api(ECHO_SETTING_PROFILE_ID))).toBe(true);
    expect(isEchoSettingSelected(api("another-setting"))).toBe(false);
    expect(isEchoSettingSelected(api(ECHO_SETTING_PROFILE_ID, false))).toBe(
      false,
    );
  });
});
