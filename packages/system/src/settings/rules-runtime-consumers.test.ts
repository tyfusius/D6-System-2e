import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("rules runtime boundaries", () => {
  it("keeps public and settings consumers off the retired edition adapter", () => {
    for (const path of [
      "packages/system/src/api/create-api.ts",
      "packages/system/src/settings/rules-selection.ts",
      "packages/system/src/settings/settings-application.ts",
    ]) {
      expect(source(path)).not.toContain("currentEditionCapabilityProfile");
      expect(source(path)).not.toContain("edition-capabilities");
    }
  });

  it("publishes the API-v2 direct profile surface without compatibility projections", () => {
    const api = source("packages/core/src/contracts/api.ts");
    expect(api).toContain("configured(): D6RulesProfileV2");
    expect(api).toContain("runtime(): D6RulesRuntimeSnapshotV1");
    expect(api).toContain("selection(): D6RulesSelectionV1");
    expect(api).not.toContain("rules.current()");
    expect(api).not.toContain("rules.applyPreset()");
    expect(api).not.toContain("rules.capabilities()");
  });
});
