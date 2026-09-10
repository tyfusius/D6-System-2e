import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { parseHTML } from "linkedom";
import { firstEditionGenreProfileRegistry } from "../registries/first-edition-genre-profiles";
import { normalizeInitiativeBaseTies } from "./rules-profile-initiative-binding";
const active = vi.hoisted(() => ({ ids: ["perception", "agility"] }));
vi.mock("./attributes", () => ({
  currentActiveAttributeDefinitions: () =>
    active.ids.map((id) => ({
      id,
      label: id === "agility" ? "Dexterity" : id,
    })),
}));
import {
  bindInitiativeTieEditor,
  captureInitiativeTie,
  initiativeTieEditorContext,
  MODERN_INITIATIVE_ID,
} from "./initiative-tie-editor";
import {
  normalizeRulesProfile,
  normalizeWorldRulesProfiles,
  duplicateRulesProfile,
  exportRulesProfile,
  importRulesProfile,
  rulesProfileDiagnostics,
  saveWorldRulesProfile,
  storedWorldRulesProfiles,
  bundledRulesProfiles,
} from "./rules-profile-library";
const values = new Map<string, unknown>();
beforeEach(() => {
  values.clear();
  active.ids = ["perception", "agility"];
  vi.stubGlobal("game", {
    user: { isGM: true },
    actors: { contents: [] },
    i18n: {
      localize: (k: string) => k,
      format: (k: string, d: unknown) => `${k} ${JSON.stringify(d)}`,
    },
    settings: {
      get: (_scope: string, key: string) => values.get(key),
      set: (_scope: string, key: string, value: unknown) => {
        values.set(key, structuredClone(value));
        return Promise.resolve(value);
      },
    },
  });
  vi.stubGlobal("Hooks", { callAll: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());
const modern = () =>
  normalizeRulesProfile({
    id: "initiative-test",
    label: "Initiative test",
    strategies: { initiative: MODERN_INITIATIVE_ID },
    initiativeBaseTies: { version: 1, secondaryAttributeId: "agility" },
  });
describe("ordered optional initiative binding", () => {
  it("leaves V0 absence and saved strategy defaults untouched; V1 is idempotent", () => {
    expect(normalizeInitiativeBaseTies(undefined)).toBeUndefined();
    const old = normalizeWorldRulesProfiles({
      version: 1,
      activeProfileId: "old",
      profiles: {
        old: {
          id: "old",
          strategies: { initiative: "open-d6.initiative.perception" },
        },
      },
    });
    expect(old.profiles.old?.initiativeBaseTies).toBeUndefined();
    expect(old.profiles.old?.strategies.initiative).toBe(
      "open-d6.initiative.perception",
    );
    expect(normalizeWorldRulesProfiles(old)).toEqual(old);
    expect(normalizeRulesProfile(modern())).toEqual(modern());
    expect(
      bundledRulesProfiles().find((p) => p.id === "open-d6")?.strategies
        .initiative,
    ).toBe("open-d6.initiative.perception");
  });
  it.each([
    null,
    [],
    { version: 0, secondaryAttributeId: "agility" },
    { version: 2, secondaryAttributeId: "agility" },
    { version: 1, secondaryAttributeId: "" },
    { version: 1, secondaryAttributeId: "Dexterity" },
  ])("rejects explicit malformed/future state %j", (value) => {
    expect(() =>
      normalizeRulesProfile({ ...modern(), initiativeBaseTies: value }),
    ).toThrow();
  });
  it("preserves explicit binding through copy/export/import/save/reload", async () => {
    const profile = modern();
    expect(duplicateRulesProfile(profile).initiativeBaseTies).toEqual(
      profile.initiativeBaseTies,
    );
    expect(
      importRulesProfile(exportRulesProfile(profile)).initiativeBaseTies,
    ).toEqual(profile.initiativeBaseTies);
    await saveWorldRulesProfile(profile);
    expect(
      storedWorldRulesProfiles().profiles[profile.id]?.initiativeBaseTies,
    ).toEqual(profile.initiativeBaseTies);
  });
  it("uses an inactive bound genre's labels rather than the active world's Dexterity vocabulary", () => {
    const owner = "test-initiative-fantasy";
    firstEditionGenreProfileRegistry.register(owner, {
      version: 1,
      id: owner,
      genreId: owner,
      label: "Fantasy",
      attributes: [
        { id: "acumen", label: "Acumen" },
        { id: "agility", label: "Agility" },
      ],
      roles: { initiative: "acumen", knowledge: "acumen", strength: "agility" },
      attributeBudgetScore: 54,
      skillBudgetScore: 21,
      skills: [],
    });
    try {
      const profile = normalizeRulesProfile({
        ...modern(),
        strategies: {
          ...modern().strategies,
          attributes: "open-d6.attributes.six-attribute",
        },
        firstEditionGenreProfile: { version: 1, id: owner },
      });
      expect(
        initiativeTieEditorContext(profile).options.find(
          (o) => o.value === "agility",
        )?.label,
      ).toBe("Agility");
      expect(
        initiativeTieEditorContext(modern()).options.find(
          (o) => o.value === "agility",
        )?.label,
      ).toBe("Dexterity");
    } finally {
      firstEditionGenreProfileRegistry.unregisterOwner(owner);
    }
  });
  it("blocks absent or inactive secondary through diagnostics without guessing label aliases", () => {
    expect(rulesProfileDiagnostics(modern())).toEqual([]);
    active.ids = ["perception", "reflexes"];
    expect(
      rulesProfileDiagnostics(modern()).some((d) => d.slot === "initiative"),
    ).toBe(true);
    expect(
      initiativeTieEditorContext(modern()).options.find(
        (o) => o.value === "agility",
      ),
    ).toMatchObject({ selected: true });
    const { initiativeBaseTies: _binding, ...unbound } = modern();
    void _binding;
    expect(
      rulesProfileDiagnostics(unbound).some((d) => d.slot === "initiative"),
    ).toBe(true);
  });
});
describe("secondary select draft behavior", () => {
  it("toggles immediately without rerender or losing edits, saves explicit selection and reloads selected option", async () => {
    const { document, Event } = parseHTML(
      `<form><input name="unrelated" value="unsaved"><select name="strategy.initiative"><option selected value="${MODERN_INITIATIVE_ID}">Modern</option><option value="open-d6.initiative.perception">Legacy</option></select><div data-initiative-tie-fields><select name="profile.initiativeBaseTies.secondaryAttributeId"><option value="">Choose</option><option selected value="agility">Dexterity</option></select></div></form>`,
    );
    const form = document.querySelector("form") as unknown as HTMLElement;
    bindInitiativeTieEditor(form);
    const fields = required(
      form.querySelector<HTMLElement>("[data-initiative-tie-fields]"),
    );
    const strategy = required(
      form.querySelector<HTMLSelectElement>('[name="strategy.initiative"]'),
    );
    expect(fields.hidden).toBe(false);
    const selected = strategy.querySelectorAll("option");
    required(selected[0]).removeAttribute("selected");
    required(selected[1]).setAttribute("selected", "");
    strategy.dispatchEvent(new Event("change"));
    expect(fields.hidden).toBe(true);
    expect(
      form.querySelector<HTMLInputElement>('[name="unrelated"]')?.value,
    ).toBe("unsaved");
    required(selected[1]).removeAttribute("selected");
    required(selected[0]).setAttribute("selected", "");
    strategy.dispatchEvent(new Event("change"));
    expect(fields.hidden).toBe(false);
    const captured = captureInitiativeTie(modern(), form);
    await saveWorldRulesProfile(captured);
    const loaded = required(storedWorldRulesProfiles().profiles[captured.id]);
    expect(
      initiativeTieEditorContext(loaded).options.filter((o) => o.selected),
    ).toEqual([{ value: "agility", label: "Dexterity", selected: true }]);
  });
});

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined)
    throw new Error("Missing test fixture");
  return value;
}
