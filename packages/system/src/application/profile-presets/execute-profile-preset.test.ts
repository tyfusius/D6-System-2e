import { describe, expect, it, vi } from "vitest";
import type { D6ProfilePresetActivationResultV1 } from "@d6-system-2e/core";
import { executeProfilePresetTransaction } from "./execute-profile-preset";

function result(
  rulesProfile = true,
  settingProfile = true,
): D6ProfilePresetActivationResultV1 {
  return {
    preview: {
      changedCount: Number(rulesProfile) + Number(settingProfile),
      changes: { rulesProfile, settingProfile },
      previous: {
        rulesProfileId: "old-rules",
        settingProfileId: "old-setting",
        version: 1,
      },
      requiresReload: settingProfile,
      selection: {
        rulesProfileId: "new-rules",
        settingProfileId: "new-setting",
        version: 1,
      },
      unchangedCount: Number(!rulesProfile) + Number(!settingProfile),
      version: 1,
    },
    rulesProfile: { id: "new-rules" } as never,
    settingProfile: { profile: { id: "new-setting" } } as never,
  };
}

describe("profile preset transaction coordinator", () => {
  it("commits only changed selections in order", async () => {
    const calls: string[] = [];
    const prepared = { result: result(true, true) };
    await expect(
      executeProfilePresetTransaction(prepared, {
        activateRulesProfile: () => {
          calls.push("rules");
          return Promise.resolve();
        },
        activateSettingProfile: () => {
          calls.push("setting");
          return Promise.resolve();
        },
        restore: vi.fn(),
      }),
    ).resolves.toBe(prepared.result);
    expect(calls).toEqual(["rules", "setting"]);
  });

  it("skips unchanged selections", async () => {
    const port = {
      activateRulesProfile: vi.fn(),
      activateSettingProfile: vi.fn(),
      restore: vi.fn(),
    };
    await executeProfilePresetTransaction(
      { result: result(false, false) },
      port,
    );
    expect(port.activateRulesProfile).not.toHaveBeenCalled();
    expect(port.activateSettingProfile).not.toHaveBeenCalled();
    expect(port.restore).not.toHaveBeenCalled();
  });

  it("restores the exact prior selection after either write fails", async () => {
    const failure = new Error("setting write failed");
    const restore = vi.fn(() => Promise.resolve());
    await expect(
      executeProfilePresetTransaction(
        { result: result(true, true) },
        {
          activateRulesProfile: vi.fn(() => Promise.resolve()),
          activateSettingProfile: vi.fn(() => Promise.reject(failure)),
          restore,
        },
      ),
    ).rejects.toBe(failure);
    expect(restore).toHaveBeenCalledOnce();
  });

  it("reports both the commit and rollback failures", async () => {
    const commitFailure = new Error("commit failed");
    const rollbackFailure = new Error("rollback failed");
    await expect(
      executeProfilePresetTransaction(
        { result: result(true, false) },
        {
          activateRulesProfile: vi.fn(() => Promise.reject(commitFailure)),
          activateSettingProfile: vi.fn(),
          restore: vi.fn(() => Promise.reject(rollbackFailure)),
        },
      ),
    ).rejects.toMatchObject({
      errors: [commitFailure, rollbackFailure],
    });
  });
});
