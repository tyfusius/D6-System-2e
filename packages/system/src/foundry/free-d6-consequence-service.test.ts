import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FREE_D6_CONSEQUENCE_STATE_KEY,
  addFreeD6Fatigue,
  freeD6ConsequencePenaltyProjection,
  freeD6FatigueAllowsActions,
  freeD6FatigueForActor,
  readFreeD6ConsequenceState,
  recoverFreeD6Fatigue,
} from "./free-d6-consequence-service";

vi.mock("../settings/rules-profile-library", () => ({
  currentConfiguredRulesProfile: () => ({
    strategies: {
      consequenceSuite: "free-d6.consequences.physical-and-fatigue",
    },
  }),
}));

vi.mock("./health-runtime", () => ({
  readActorHealth: () => ({
    track: { currentState: { label: "Wounded", penaltyScore: 3 } },
  }),
}));

function actor() {
  const update = vi.fn((changes: Record<string, unknown>): Promise<void> => {
    if (changes["system.health.tracks"]) {
      subject.system.health.tracks = changes[
        "system.health.tracks"
      ] as typeof subject.system.health.tracks;
    }
    return Promise.resolve();
  });
  const subject = {
    isOwner: true,
    items: {
      contents: [
        {
          type: "skill",
          system: { key: "stamina", attributeId: "strength", score: 0 },
        },
        {
          type: "skill",
          system: { key: "willpower", attributeId: "charisma", score: 0 },
        },
      ],
    },
    system: {
      attributes: { strength: { score: 9 }, charisma: { score: 6 } },
      health: { tracks: { existing: { stateId: "wounded" } } },
    },
    update,
  };
  return {
    document: subject as unknown as FoundryActorDocument,
    update,
  };
}

describe("FreeD6 consequence service", () => {
  beforeEach(() => {
    vi.stubGlobal("game", { user: { isGM: false } });
  });

  it("persists Fatigue separately without changing physical health storage", async () => {
    const { document: subject, update } = actor();
    await addFreeD6Fatigue(subject, "running");
    expect(update).toHaveBeenCalledOnce();
    const tracks = (
      subject.system.health as { tracks: Record<string, unknown> }
    ).tracks;
    expect(tracks.existing).toEqual({ stateId: "wounded" });
    expect(tracks[FREE_D6_CONSEQUENCE_STATE_KEY]).toMatchObject({
      channels: {
        "free-d6.consequence.fatigue": { level: 1, source: "running" },
      },
    });
  });

  it("adds physical and Fatigue penalty provenance", async () => {
    const { document: subject } = actor();
    await addFreeD6Fatigue(subject);
    await addFreeD6Fatigue(subject);
    expect(freeD6ConsequencePenaltyProjection(subject)).toMatchObject({
      totalPenaltyScore: 9,
      effects: [
        { channelId: "d6e2.consequence.physical", penaltyScore: 3 },
        { channelId: "free-d6.consequence.fatigue", penaltyScore: 6 },
      ],
    });
  });

  it("recovers independently and preserves revisioned state", async () => {
    const { document: subject } = actor();
    await addFreeD6Fatigue(subject);
    await addFreeD6Fatigue(subject);
    const recovered = await recoverFreeD6Fatigue(subject);
    expect(recovered.level).toBe(1);
    expect(
      readFreeD6ConsequenceState(subject).channels[
        "free-d6.consequence.fatigue"
      ],
    ).toMatchObject({
      level: 1,
      revision: 3,
    });
  });

  it("derives consciousness from the FreeD6 threshold without mutating wounds", async () => {
    const { document: subject } = actor();
    for (let index = 0; index < 4; index += 1) await addFreeD6Fatigue(subject);
    expect(freeD6FatigueForActor(subject).unconscious).toBe(true);
    expect(freeD6FatigueAllowsActions(subject)).toBe(false);
    expect(
      (subject.system.health as { tracks: Record<string, unknown> }).tracks
        .existing,
    ).toEqual({ stateId: "wounded" });
  });
});
