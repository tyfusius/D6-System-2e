import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("companion terminology UI contract", () => {
  const character = read("./character-sheet.ts");
  const characterHeader = read(
    "../../../../../templates/actor/character/header.hbs",
  );
  const biography = read(
    "../../../../../templates/actor/character/biography.hbs",
  );
  const item = read("./item-sheet.ts");
  const machine = read("./machine-sheet.ts");
  const machineHeader = read(
    "../../../../../templates/actor/machine/header.hbs",
  );
  const machineSystems = read(
    "../../../../../templates/actor/machine/systems.hbs",
  );

  it("renders selected-only character vocabulary through stable fields", () => {
    expect(character).toContain("terminology.details.allegiance");
    expect(character).toContain("terminology.details.currency");
    expect(characterHeader).toContain('name="system.profile.currency"');
    expect(biography).toContain('name="system.profile.allegiance"');
    expect(biography).toContain('data-persist-on-input="true"');
  });

  it("renders manifestation and Metaphysics labels without renaming documents", () => {
    expect(character).toContain("terminology.manifestations.plural");
    expect(character).toContain("terminology.metaphysics.skills.channel");
    expect(item).toContain("terminology.manifestations.singular");
  });

  it("renders machine vocabulary and the latent interstellar-drive rating", () => {
    expect(machine).toContain("terminology.machines.starshipToughness");
    expect(machine).toContain("terminology.machines.vehicleToughness");
    expect(machineHeader).toContain("{{toughnessLabel}}");
    expect(machineSystems).toContain('name="system.interstellarDrive"');
  });
});
