import { afterEach, describe, expect, it, vi } from "vitest";
import { firstEditionGenreProfileRegistry } from "./first-edition-genre-profiles";
import { currentFirstEditionGenreProfile } from "../settings/first-edition-genre-profile";

const id = "test-fantasy-profile";

afterEach(() => {
  firstEditionGenreProfileRegistry.unregisterOwner(id);
  vi.unstubAllGlobals();
});

describe("First Edition genre profile registry", () => {
  it("resolves the explicitly selected profile and its semantic roles", () => {
    firstEditionGenreProfileRegistry.register(id, {
      attributeBudgetScore: 54,
      attributes: [
        { id: "agility", label: "Agility" },
        { id: "physique", label: "Physique" },
        { id: "intellect", label: "Intellect" },
        { id: "acumen", label: "Acumen" },
      ],
      genreId: id,
      id,
      label: "Test Fantasy",
      roles: {
        initiative: "acumen",
        knowledge: "intellect",
        strength: "physique",
      },
      skillBudgetScore: 21,
      skills: [
        {
          attributeId: "physique",
          key: "running",
          name: "Running",
          source: { book: "Test", page: 1 },
        },
      ],
      version: 1,
    });
    vi.stubGlobal("game", {
      settings: { get: () => id },
    });
    expect(currentFirstEditionGenreProfile()).toMatchObject({
      id,
      roles: { initiative: "acumen", strength: "physique" },
      skillBudgetScore: 21,
    });
  });
});
