import { describe, expect, it, vi } from "vitest";
import {
  HIDEOUT_PIPS_PREREQUISITE_SETTING_KEY,
  HIDEOUT_PREREQUISITE_SETTING_KEY,
  HIDEOUT_SETTING_KEY,
  hideoutDependencyAction,
  resolveHideoutSettingsDependency,
} from "./hideout-settings-dependency";

describe("Hideout settings dependency", () => {
  it("requires no confirmation when the dependency is satisfied or Hideouts are off", () => {
    expect(
      hideoutDependencyAction(
        {
          hiddenBases: true,
          perksFlawsTalents: true,
          pips: true,
          pipsSatisfied: true,
        },
        {
          hiddenBases: false,
          perksFlawsTalents: false,
          pips: false,
          pipsSatisfied: false,
        },
      ),
    ).toBeNull();
    expect(
      hideoutDependencyAction(
        {
          hiddenBases: false,
          perksFlawsTalents: false,
          pips: false,
          pipsSatisfied: false,
        },
        {
          hiddenBases: true,
          perksFlawsTalents: true,
          pips: true,
          pipsSatisfied: true,
        },
      ),
    ).toBeNull();
  });

  it("atomically enables the complete prerequisite chain when all three settings are off", async () => {
    const submitted = {
      hiddenBases: true,
      perksFlawsTalents: false,
      pips: false,
      pipsSatisfied: false,
    };
    const confirm = vi.fn().mockResolvedValue(true);
    const focus = vi.fn();

    await expect(
      resolveHideoutSettingsDependency(
        submitted,
        {
          hiddenBases: false,
          perksFlawsTalents: false,
          pips: false,
          pipsSatisfied: false,
        },
        confirm,
        focus,
      ),
    ).resolves.toEqual({
      hiddenBases: true,
      perksFlawsTalents: true,
      pips: true,
      pipsSatisfied: true,
    });
    expect(confirm).toHaveBeenCalledWith("enable-prerequisites");
    expect(focus).not.toHaveBeenCalled();
    expect(submitted).toEqual({
      hiddenBases: true,
      perksFlawsTalents: false,
      pips: false,
      pipsSatisfied: false,
    });
  });

  it("preserves an already-satisfied Pips prerequisite", async () => {
    await expect(
      resolveHideoutSettingsDependency(
        {
          hiddenBases: true,
          perksFlawsTalents: false,
          pips: false,
          pipsSatisfied: true,
        },
        {
          hiddenBases: false,
          perksFlawsTalents: false,
          pips: false,
          pipsSatisfied: true,
        },
        vi.fn().mockResolvedValue(true),
        vi.fn(),
      ),
    ).resolves.toEqual({
      hiddenBases: true,
      perksFlawsTalents: true,
      pips: false,
      pipsSatisfied: true,
    });
  });

  it.each([false, null])(
    "writes nothing and focuses Hideouts when enabling is dismissed (%s)",
    async (dialogResult) => {
      const submitted = {
        hiddenBases: true,
        perksFlawsTalents: false,
        pips: false,
        pipsSatisfied: false,
      };
      const focus = vi.fn();

      await expect(
        resolveHideoutSettingsDependency(
          submitted,
          {
            hiddenBases: false,
            perksFlawsTalents: false,
            pips: false,
            pipsSatisfied: false,
          },
          vi.fn().mockResolvedValue(dialogResult),
          focus,
        ),
      ).resolves.toBeNull();
      expect(submitted).toEqual({
        hiddenBases: true,
        perksFlawsTalents: false,
        pips: false,
        pipsSatisfied: false,
      });
      expect(focus).toHaveBeenCalledWith(HIDEOUT_SETTING_KEY);
    },
  );

  it("atomically disables Hideouts when its active prerequisite is turned off", async () => {
    await expect(
      resolveHideoutSettingsDependency(
        {
          hiddenBases: true,
          perksFlawsTalents: false,
          pips: true,
          pipsSatisfied: true,
        },
        {
          hiddenBases: true,
          perksFlawsTalents: true,
          pips: true,
          pipsSatisfied: true,
        },
        vi.fn().mockResolvedValue(true),
        vi.fn(),
      ),
    ).resolves.toEqual({
      hiddenBases: false,
      perksFlawsTalents: false,
      pips: true,
      pipsSatisfied: true,
    });
  });

  it("atomically disables both dependents when Pips is turned off", async () => {
    await expect(
      resolveHideoutSettingsDependency(
        {
          hiddenBases: true,
          perksFlawsTalents: true,
          pips: false,
          pipsSatisfied: false,
        },
        {
          hiddenBases: true,
          perksFlawsTalents: true,
          pips: true,
          pipsSatisfied: true,
        },
        vi.fn().mockResolvedValue(true),
        vi.fn(),
      ),
    ).resolves.toEqual({
      hiddenBases: false,
      perksFlawsTalents: false,
      pips: false,
      pipsSatisfied: false,
    });
  });

  it.each([false, null])(
    "writes nothing and focuses the prerequisite when disabling is dismissed (%s)",
    async (dialogResult) => {
      const focus = vi.fn();
      await expect(
        resolveHideoutSettingsDependency(
          {
            hiddenBases: true,
            perksFlawsTalents: false,
            pips: true,
            pipsSatisfied: true,
          },
          {
            hiddenBases: true,
            perksFlawsTalents: true,
            pips: true,
            pipsSatisfied: true,
          },
          vi.fn().mockResolvedValue(dialogResult),
          focus,
        ),
      ).resolves.toBeNull();
      expect(focus).toHaveBeenCalledWith(HIDEOUT_PREREQUISITE_SETTING_KEY);
    },
  );

  it.each([false, null])(
    "writes nothing and focuses Pips when prerequisite teardown is dismissed (%s)",
    async (dialogResult) => {
      const focus = vi.fn();
      await expect(
        resolveHideoutSettingsDependency(
          {
            hiddenBases: true,
            perksFlawsTalents: true,
            pips: false,
            pipsSatisfied: false,
          },
          {
            hiddenBases: true,
            perksFlawsTalents: true,
            pips: true,
            pipsSatisfied: true,
          },
          vi.fn().mockResolvedValue(dialogResult),
          focus,
        ),
      ).resolves.toBeNull();
      expect(focus).toHaveBeenCalledWith(HIDEOUT_PIPS_PREREQUISITE_SETTING_KEY);
    },
  );

  it("is idempotent after the accepted dependency update", async () => {
    const confirm = vi.fn().mockResolvedValue(true);
    const resolved = await resolveHideoutSettingsDependency(
      {
        hiddenBases: true,
        perksFlawsTalents: false,
        pips: false,
        pipsSatisfied: false,
      },
      {
        hiddenBases: false,
        perksFlawsTalents: false,
        pips: false,
        pipsSatisfied: false,
      },
      confirm,
      vi.fn(),
    );
    expect(resolved).not.toBeNull();
    if (!resolved) throw new Error("expected accepted dependency values");
    await resolveHideoutSettingsDependency(
      resolved,
      resolved,
      confirm,
      vi.fn(),
    );
    expect(confirm).toHaveBeenCalledOnce();
  });
});
