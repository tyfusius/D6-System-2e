import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const implementation = readFileSync(
  new URL("./game-settings-root.ts", import.meta.url),
  "utf8",
);
const registration = readFileSync(
  new URL("./system-settings.ts", import.meta.url),
  "utf8",
);
const compatibilityRegistration = readFileSync(
  new URL("./rules-compatibility.ts", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../../../../styles/d6-system-2e.css", import.meta.url),
  "utf8",
);

describe("root Game Settings system mode", () => {
  it("enhances Foundry's native SettingsConfig system category", () => {
    expect(implementation).toContain('Hooks.on("renderSettingsConfig"');
    expect(implementation).toContain('[data-category="system"]');
    expect(implementation).toContain(
      "category.prepend(buildSystemModeSetup(category))",
    );
  });

  it("uses explicit accessible selection and disabled menu states", () => {
    expect(implementation).toContain(
      'selector.setAttribute("role", "radiogroup")',
    );
    expect(implementation).toContain('button.setAttribute("role", "radio")');
    expect(implementation).toContain('button.setAttribute("aria-checked"');
    expect(implementation).toContain("button.disabled = !active");
    expect(implementation).toContain('button.setAttribute("aria-disabled"');
  });

  it("updates the open settings category after committing Game System Mode", () => {
    expect(implementation).toContain("void applyGameMode(requested)");
    expect(implementation).toContain(
      "updateSystemModeSetup(category, currentGameMode())",
    );
    expect(registration).toContain('Hooks.callAll?.("d6e2GameModeChanged")');
  });

  it("keeps edition-owned rules out of the raw root list", () => {
    expect(registration).toContain("registerDefinition(definition, false)");
    expect(compatibilityRegistration.match(/config: false/g)).toHaveLength(2);
  });

  it("provides non-color active and inactive visual cues", () => {
    expect(styles).toContain(".d6e2-game-mode-choice.is-active");
    expect(styles).toContain(".form-group.d6e2-edition-menu-inactive");
    expect(styles).toContain("button:disabled");
    expect(styles).toContain("opacity: 0.55");
  });
});
