import { parseHTML } from "linkedom";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("does not accumulate frame dragover listeners across repeated renders", async () => {
  const { document, window } = parseHTML("<html><body></body></html>");
  vi.stubGlobal("game", {
    settings: { get: () => undefined },
    i18n: { localize: (key: string) => key },
  });
  vi.stubGlobal("document", document);
  vi.stubGlobal("foundry", {
    utils: { randomID: () => "test-profile" },
    applications: {
      api: {
        HandlebarsApplicationMixin: (base: unknown) => base,
        ApplicationV2: class {
          element = document.createElement("form");
          _onRender() {
            return Promise.resolve();
          }
          close() {
            return Promise.resolve();
          }
        },
      },
    },
  });
  const { D6System2eSettingProfileApplication } =
    await import("./setting-profile-application");
  const app = new D6System2eSettingProfileApplication();
  await app._onRender({}, { parts: [] });
  await app._onRender({}, { parts: [] });
  const event = new window.Event("dragover", {
    cancelable: true,
  });
  const prevent = vi.spyOn(event, "preventDefault");
  app.element.dispatchEvent(event);
  expect(prevent).toHaveBeenCalledTimes(1);
  await app.close();
});
