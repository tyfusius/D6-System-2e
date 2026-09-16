import { parseHTML } from "linkedom";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("starts Add Font disabled and revalidates every prerequisite on input/change", async () => {
  const { document, window } = parseHTML("<html><body></body></html>");
  const fonts = new Set();
  Object.defineProperty(document, "fonts", { value: fonts });
  vi.stubGlobal("document", document);
  vi.stubGlobal("game", { i18n: { localize: (key: string) => key } });
  const error = vi.fn();
  vi.stubGlobal("ui", { notifications: { error, warn: vi.fn() } });
  vi.stubGlobal(
    "FontFace",
    class {
      load() {
        return Promise.resolve(this);
      }
    },
  );
  let exercised = false;
  vi.stubGlobal("foundry", {
    utils: { getRoute: (path: string) => path },
    applications: {
      apps: {
        FilePicker: {
          implementation: class {
            constructor(
              private options: { callback(path: string): Promise<void> },
            ) {}
            async browse() {
              await this.options.callback("fonts/example.woff2");
            }
          },
        },
      },
      api: {
        ApplicationV2: class {
          render = vi.fn();
        },
        HandlebarsApplicationMixin: (base: unknown) => base,
        DialogV2: {
          wait: (options: {
            content: string;
            buttons: { action: string; disabled?: boolean }[];
            render(event: Event, dialog: { element: HTMLElement }): void;
          }) => {
            const add = options.buttons.find(
              (button) => button.action === "add",
            );
            expect(add?.disabled).toBe(true);
            const root = document.createElement("form");
            root.innerHTML =
              options.content +
              '<button data-action="add" disabled>Add Font</button>';
            const button = root.querySelector("button");
            const label =
              root.querySelector<HTMLInputElement>('[name="fontLabel"]');
            const display = root.querySelector<HTMLInputElement>(
              '[name="fontDisplay"]',
            );
            const body =
              root.querySelector<HTMLInputElement>('[name="fontBody"]');
            const consent = root.querySelector<HTMLInputElement>(
              '[name="fontAcknowledgement"]',
            );
            if (!button || !label || !display || !body || !consent)
              throw new Error("Missing font dialog control");
            // linkedom does not implement checkbox checked state.
            display.checked = true;
            body.checked = consent.checked = false;
            options.render(new window.Event("render"), { element: root });
            const verify = (disabled: boolean) => {
              expect(button.disabled).toBe(disabled);
              expect(button.getAttribute("aria-disabled")).toBe(
                String(disabled),
              );
            };
            const change = (input: HTMLInputElement) =>
              input.dispatchEvent(
                new window.Event("change", { bubbles: true }),
              );
            verify(true);
            label.value = "Example";
            label.dispatchEvent(new window.Event("input", { bubbles: true }));
            verify(true);
            consent.checked = true;
            change(consent);
            verify(false);
            consent.checked = false;
            change(consent);
            verify(true);
            consent.checked = true;
            change(consent);
            label.value = "   ";
            label.dispatchEvent(new window.Event("input", { bubbles: true }));
            verify(true);
            label.value = "Example";
            change(label);
            display.checked = false;
            change(display);
            verify(true);
            body.checked = true;
            change(body);
            verify(false);
            exercised = true;
            return Promise.resolve(null);
          },
        },
      },
    },
  });
  const { D6System2eFontLibraryApplication } =
    await import("./setting-profile-font-library-application");
  const library = new D6System2eFontLibraryApplication();
  await D6System2eFontLibraryApplication.DEFAULT_OPTIONS.actions.addFont.call(
    library,
  );
  expect(exercised).toBe(true);
  expect(error).not.toHaveBeenCalled();
  expect(fonts.size).toBe(0);
});
