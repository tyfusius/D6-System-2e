import { afterEach, describe, expect, it, vi } from "vitest";
import {
  actorDefaultImage,
  DEFAULT_DOCUMENT_IMAGES,
  initializeActorDefaultImage,
  initializeItemDefaultImage,
  itemDefaultImage,
  refreshExistingDocumentDefaultImages,
  updateWeaponDefaultImage,
  weaponDefaultImage,
} from "./document-default-images";

afterEach(() => vi.unstubAllGlobals());

describe("document default images", () => {
  it("selects Actor artwork by document type", () => {
    expect(actorDefaultImage("character")).toBe(
      DEFAULT_DOCUMENT_IMAGES.actorCharacter,
    );
    expect(actorDefaultImage("creature")).toBe(
      DEFAULT_DOCUMENT_IMAGES.actorCreature,
    );
    expect(actorDefaultImage("starship")).toBe(
      DEFAULT_DOCUMENT_IMAGES.actorStarship,
    );
  });

  it("selects Item artwork by document type and weapon configuration", () => {
    expect(itemDefaultImage("skill")).toBe(DEFAULT_DOCUMENT_IMAGES.itemSkill);
    expect(itemDefaultImage("cybernetic")).toBe(
      DEFAULT_DOCUMENT_IMAGES.itemCybernetic,
    );
    expect(weaponDefaultImage({ range: { long: 40 } })).toBe(
      DEFAULT_DOCUMENT_IMAGES.itemRangedWeapon,
    );
    expect(weaponDefaultImage({ weaponKind: "thrown-explosive" })).toBe(
      DEFAULT_DOCUMENT_IMAGES.itemThrownExplosive,
    );
  });

  it("replaces only stock Actor and Item placeholders on creation", () => {
    const actorUpdate = vi.fn<(changes: Record<string, unknown>) => void>();
    const itemUpdate = vi.fn<(changes: Record<string, unknown>) => void>();
    initializeActorDefaultImage(
      { type: "vehicle", updateSource: actorUpdate },
      { img: "icons/svg/mystery-man.svg", type: "vehicle" },
    );
    initializeItemDefaultImage(
      { type: "armor", updateSource: itemUpdate },
      { img: "icons/svg/item-bag.svg", type: "armor" },
    );
    expect(actorUpdate).toHaveBeenCalledWith({
      img: DEFAULT_DOCUMENT_IMAGES.actorVehicle,
    });
    expect(itemUpdate).toHaveBeenCalledWith({
      img: DEFAULT_DOCUMENT_IMAGES.itemArmor,
    });

    initializeActorDefaultImage(
      { type: "character", updateSource: actorUpdate },
      { img: "worlds/example/custom.webp", type: "character" },
    );
    initializeItemDefaultImage(
      { type: "gear", updateSource: itemUpdate },
      { img: "worlds/example/custom.webp", type: "gear" },
    );
    expect(actorUpdate).toHaveBeenCalledTimes(1);
    expect(itemUpdate).toHaveBeenCalledTimes(1);
  });

  it("tracks weapon kind while preserving custom artwork", () => {
    const rangedChanges: Record<string, unknown> = {
      system: { range: { long: 25 } },
    };
    updateWeaponDefaultImage(
      {
        img: DEFAULT_DOCUMENT_IMAGES.itemMeleeWeapon,
        system: { range: { short: 0, medium: 0, long: 0 } },
        type: "weapon",
      },
      rangedChanges,
    );
    expect(rangedChanges.img).toBe(DEFAULT_DOCUMENT_IMAGES.itemRangedWeapon);

    const customChanges: Record<string, unknown> = {
      system: { range: { long: 25 } },
    };
    updateWeaponDefaultImage(
      {
        img: "worlds/example/custom.webp",
        system: { range: { short: 0, medium: 0, long: 0 } },
        type: "weapon",
      },
      customChanges,
    );
    expect(customChanges.img).toBeUndefined();
  });

  it("refreshes persisted stock placeholders without touching custom art", async () => {
    const actorUpdate = vi.fn(() => Promise.resolve(undefined));
    const skillUpdate = vi.fn(() => Promise.resolve(undefined));
    const customUpdate = vi.fn(() => Promise.resolve(undefined));
    vi.stubGlobal("game", {
      actors: {
        contents: [
          {
            img: "icons/svg/mystery-man.svg",
            items: {
              contents: [
                {
                  img: "icons/svg/dice-target.svg",
                  system: {},
                  type: "skill",
                  update: skillUpdate,
                },
              ],
            },
            system: {},
            type: "npc",
            update: actorUpdate,
          },
        ],
      },
      items: {
        contents: [
          {
            img: "worlds/example/custom.webp",
            system: {},
            type: "gear",
            update: customUpdate,
          },
        ],
      },
      user: { isGM: true },
    });

    await expect(refreshExistingDocumentDefaultImages()).resolves.toBe(2);
    expect(actorUpdate).toHaveBeenCalledWith({
      img: DEFAULT_DOCUMENT_IMAGES.actorCharacter,
    });
    expect(skillUpdate).toHaveBeenCalledWith({
      img: DEFAULT_DOCUMENT_IMAGES.itemSkill,
    });
    expect(customUpdate).not.toHaveBeenCalled();
  });
});
