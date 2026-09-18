import { afterEach, expect, it, vi } from "vitest";
const campaign = vi.hoisted(() =>
  vi.fn(() => ({ nemesisCompanionsSidekicks: true })),
);
vi.mock("../settings/campaign-profile", () => ({
  currentSecondEditionCampaignProfile: campaign,
}));
vi.mock("./mechanical-edit-guard", () => ({
  withAuthorizedSuperheroicUpdate: (_actor: unknown, work: () => unknown) =>
    work(),
}));
import { registerSuperheroicRelationshipHooks } from "./superheroic-relationships-service";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("rejects unrelated updates before projection while preserving positive XP propagation and recursion guard", () => {
  const update = vi.fn();
  const gm = { isGM: true };
  const nemesis = {
    type: "character",
    system: {
      resources: { experiencePoints: { value: 2 } },
      superheroic: {
        relationships: {
          heroActorId: "hero",
          nemesisActive: true,
          nemesisExperience: 0,
        },
      },
    },
    update,
  };
  vi.stubGlobal("game", { user: gm, actors: { contents: [nemesis] } });
  const on = vi.fn();
  vi.stubGlobal("Hooks", { on });
  registerSuperheroicRelationshipHooks();
  const hook = on.mock.calls[0]?.[1] as (...args: unknown[]) => void;
  const hero = {
    id: "hero",
    system: { resources: { experiencePoints: { value: 3 } } },
  };
  for (let i = 0; i < 100; i += 1)
    hook(hero, { "system.health.condition": "wounded" }, {});
  expect(campaign).not.toHaveBeenCalled();
  hook(hero, { "system.resources.experiencePoints.value": 5 }, {});
  expect(campaign).toHaveBeenCalledOnce();
  expect(update).toHaveBeenCalledOnce();
  hook(hero, { system: { resources: { experiencePoints: { value: 5 } } } }, {});
  expect(update).toHaveBeenCalledTimes(2);
  hook(
    hero,
    { "system.resources.experiencePoints.value": 6 },
    { d6e2NemesisExperienceSync: true },
  );
  expect(update).toHaveBeenCalledTimes(2);
  campaign.mockReturnValue({ nemesisCompanionsSidekicks: false });
  hook(hero, { "system.resources.experiencePoints.value": 6 }, {});
  expect(update).toHaveBeenCalledTimes(2);
});
