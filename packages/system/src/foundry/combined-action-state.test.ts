import { afterEach, describe, expect, it } from "vitest";
import {
  combinedActionBlocksRoll,
  lockCombinedActionParticipants,
  resetCombinedActionStateForTests,
  unlockCombinedActionParticipants,
} from "./combined-action-state";

afterEach(resetCombinedActionStateForTests);

function actor(skillKey = "athletics") {
  return {
    id: "actor",
    items: {
      get: () => ({ system: { key: skillKey } }),
    },
  } as unknown as FoundryActorDocument;
}

describe("combined-action participant lock", () => {
  it("blocks unrelated actions but keeps reactions and authorized rolls", () => {
    lockCombinedActionParticipants("group", ["actor"]);

    expect(combinedActionBlocksRoll(actor(), "attribute")).toBe(true);
    expect(combinedActionBlocksRoll(actor(), "skill", "item")).toBe(true);
    expect(combinedActionBlocksRoll(actor("dodge"), "skill", "item")).toBe(
      false,
    );
    expect(combinedActionBlocksRoll(actor(), "resistance")).toBe(false);
    expect(combinedActionBlocksRoll(actor(), "skill", "item", "group")).toBe(
      false,
    );

    unlockCombinedActionParticipants("group");
    expect(combinedActionBlocksRoll(actor(), "attribute")).toBe(false);
  });
});
