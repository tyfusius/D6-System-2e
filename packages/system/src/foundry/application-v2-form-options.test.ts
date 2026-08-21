import { describe, expect, it } from "vitest";
import { applicationV2FormOptions } from "./application-v2-form-options";

describe("ApplicationV2 form options", () => {
  it("admits only the Foundry 14 ApplicationV2 form contract", () => {
    const handler = (): void => undefined;
    const options = applicationV2FormOptions({
      closeOnSubmit: false,
      handler,
      submitOnChange: false,
    });

    expect(options).toEqual({
      closeOnSubmit: false,
      handler,
      submitOnChange: false,
    });
    expect(Object.isFrozen(options)).toBe(true);

    const legacyOptionsMustFailTypecheck = (): void => {
      applicationV2FormOptions({
        closeOnSubmit: false,
        handler,
        submitOnChange: false,
        // @ts-expect-error FormApplicationV1-only options must fail typecheck.
        submitOnClose: true,
      });
    };
    expect(legacyOptionsMustFailTypecheck).toBeTypeOf("function");
  });
});
