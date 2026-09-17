import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ draft: vi.fn(), render: vi.fn() }));
vi.mock("./settings-application", () => ({
  D6System2eSecondEditionSettings: class {
    withRuleActivation(rule: string) {
      mocks.draft(rule);
      return this;
    }
    render = mocks.render;
  },
}));
import { openSheetRuleActivation } from "./sheet-rule-activation";

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("sheet rule activation authorization", () => {
  it.each(["hideouts", "gadgetsGear", "superpowers"])(
    "routes the GM's %s action to the existing settings editor",
    async (rule) => {
      vi.stubGlobal("game", { user: { isGM: true } });
      await openSheetRuleActivation(
        {} as Event,
        { dataset: { ruleActivation: rule } } as unknown as HTMLElement,
      );
      expect(mocks.draft).toHaveBeenCalledWith(rule);
      expect(mocks.render).toHaveBeenCalledWith(true);
    },
  );

  it.each([false, undefined])(
    "rejects non-GM direct invocation (%s)",
    async (isGM) => {
      vi.stubGlobal("game", { user: { isGM } });
      await openSheetRuleActivation(
        {} as Event,
        { dataset: { ruleActivation: "hideouts" } } as unknown as HTMLElement,
      );
      expect(mocks.draft).not.toHaveBeenCalled();
    },
  );

  it("rejects unknown or inherited activation names", async () => {
    vi.stubGlobal("game", { user: { isGM: true } });
    for (const rule of ["arbitrary-setting", "toString", "__proto__"])
      await openSheetRuleActivation(
        {} as Event,
        { dataset: { ruleActivation: rule } } as unknown as HTMLElement,
      );
    expect(mocks.draft).not.toHaveBeenCalled();
  });
});
