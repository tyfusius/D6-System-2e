import { describe, expect, it, vi } from "vitest";
import { initialDestinyState, type D6DestinyStateV1 } from "@d6-system-2e/core";
import { DestinyAuthority } from "./destiny-authority";
const gm = { userId: "gm", isGM: true, actorIds: [] };
function setup() {
  let state: D6DestinyStateV1 = initialDestinyState();
  let active = true;
  const deliver = vi.fn(async () => {
    await Promise.resolve();
    return undefined;
  });
  const store = {
    isAuthority: () => active,
    read: async () => await Promise.resolve(state),
    write: vi.fn(async (next: D6DestinyStateV1, expected: number) => {
      await Promise.resolve();
      expect(state.revision).toBe(expected);
      state = next;
    }),
    validate: vi.fn(async () => {
      await Promise.resolve();
      return undefined;
    }),
    deliver,
  };
  return {
    authority: new DestinyAuthority(store),
    store,
    read: () => state,
    stop: () => {
      active = false;
    },
  };
}
const reset = {
  version: 1 as const,
  id: "one",
  expectedRevision: 0,
  sessionId: "",
  operation: {
    kind: "reset" as const,
    sessionId: "s",
    size: 3,
    nominatedUserId: "p",
  },
};
describe("Destiny authoritative orchestration", () => {
  it("serializes competing commands and never overwrites the winner", async () => {
    const s = setup();
    const [one, two] = await Promise.allSettled([
      s.authority.execute(reset, gm),
      s.authority.execute({ ...reset, id: "two" }, gm),
    ]);
    expect(one.status).toBe("fulfilled");
    expect(two.status).toBe("rejected");
    expect(s.store.write).toHaveBeenCalledTimes(1);
  });
  it("recovers delivery after persistence without another pool transition", async () => {
    const s = setup();
    s.store.deliver.mockRejectedValueOnce(new Error("interrupted"));
    await expect(s.authority.execute(reset, gm)).rejects.toThrow("interrupted");
    await expect(s.authority.execute(reset, gm)).resolves.toEqual(s.read());
    expect(s.store.write).toHaveBeenCalledTimes(1);
    expect(s.store.deliver).toHaveBeenCalledTimes(2);
  });
  it("fails closed when the elected GM changes during validation", async () => {
    const s = setup();
    s.store.validate.mockImplementationOnce(async () => {
      await Promise.resolve();
      s.stop();
    });
    await expect(s.authority.execute(reset, gm)).rejects.toThrow(
      "GMUnavailable",
    );
    expect(s.store.write).not.toHaveBeenCalled();
  });
});
