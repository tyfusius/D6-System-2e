import { describe, expect, it } from "vitest";
import { ECHO_CAMPAIGN_PACKAGE, isEchoSelected, MODULE_ID } from "./campaign";
import type { D6SystemPublicApi } from "./d6-system-api";

function api(companionId?: string, valid = true): D6SystemPublicApi {
  return {
    apiVersion: 2,
    campaignPackages: {
      register: () => undefined,
      selection: () => ({
        ...(companionId ? { companion: { id: companionId } } : {}),
        valid,
      }),
      unregisterOwner: () => undefined,
    },
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

describe("Echo campaign package", () => {
  it("declares a Space-compatible First Edition companion", () => {
    expect(ECHO_CAMPAIGN_PACKAGE).toMatchObject({
      compatibleGenreIds: ["space"],
      contractVersion: 1,
      id: MODULE_ID,
      kind: "companion",
      rulesFamily: "open-d6-first-edition",
    });
  });

  it("activates only for a valid selected Echo companion", () => {
    expect(isEchoSelected(api(MODULE_ID))).toBe(true);
    expect(isEchoSelected(api("another-companion"))).toBe(false);
    expect(isEchoSelected(api(MODULE_ID, false))).toBe(false);
  });
});
