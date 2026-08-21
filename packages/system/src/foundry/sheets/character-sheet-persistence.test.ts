import { describe, expect, it, vi } from "vitest";
import { CharacterSheetPersistenceQueue } from "./character-sheet-persistence";

function deferred(): {
  readonly promise: Promise<void>;
  readonly reject: (error: unknown) => void;
  readonly resolve: () => void;
} {
  let reject!: (error: unknown) => void;
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("CharacterSheetPersistenceQueue", () => {
  it("carries an in-flight point edit into a rapid mode transition", async () => {
    const firstUpdate = deferred();
    const state = {
      mode: "normal",
      points: 0,
    };
    const updates: Readonly<Record<string, unknown>>[] = [];
    const update = vi.fn(
      async (changes: Readonly<Record<string, unknown>>): Promise<void> => {
        updates.push(changes);
        if (updates.length === 1) await firstUpdate.promise;
        if (
          typeof changes["system.resources.experiencePoints.value"] === "number"
        ) {
          state.points = changes["system.resources.experiencePoints.value"];
        }
        if (typeof changes["system.sheetMode.value"] === "string") {
          state.mode = changes["system.sheetMode.value"];
        }
      },
    );
    const queue = new CharacterSheetPersistenceQueue(vi.fn());

    queue.enqueueDirectResource(
      "system.resources.experiencePoints.value",
      25,
      update,
    );
    queue.enqueueModeTransition("advance", update);
    await Promise.resolve();

    expect(update).toHaveBeenCalledTimes(1);
    firstUpdate.resolve();
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(2));

    expect(updates[1]).toEqual({
      "system.resources.experiencePoints.value": 25,
      "system.sheetMode.value": "advance",
    });
    expect(state).toEqual({ mode: "advance", points: 25 });
  });

  it("retries a failed direct point edit as part of the mode transition", async () => {
    const errors: unknown[] = [];
    const updates: Readonly<Record<string, unknown>>[] = [];
    const state = { mode: "normal", points: 0 };
    const update = vi.fn(
      (changes: Readonly<Record<string, unknown>>): Promise<void> => {
        updates.push(changes);
        if (updates.length === 1) {
          return Promise.reject(new Error("transient update failure"));
        }
        state.points = Number(
          changes["system.resources.experiencePoints.value"],
        );
        state.mode = String(changes["system.sheetMode.value"]);
        return Promise.resolve();
      },
    );
    const queue = new CharacterSheetPersistenceQueue((error) => {
      errors.push(error);
    });

    queue.enqueueDirectResource(
      "system.resources.experiencePoints.value",
      18,
      update,
    );
    queue.enqueueModeTransition("freeedit", update);
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(2));

    expect(errors).toHaveLength(1);
    expect(updates[1]).toEqual({
      "system.resources.experiencePoints.value": 18,
      "system.sheetMode.value": "freeedit",
    });
    expect(state).toEqual({ mode: "freeedit", points: 18 });
  });

  it("serializes rapid mode document writes without owning rendering", async () => {
    const updates: Readonly<Record<string, unknown>>[] = [];
    const update = vi.fn(
      (changes: Readonly<Record<string, unknown>>): Promise<void> => {
        updates.push(changes);
        return Promise.resolve();
      },
    );
    const queue = new CharacterSheetPersistenceQueue(vi.fn());

    queue.enqueueModeTransition("freeedit", update);
    queue.enqueueModeTransition("normal", update);
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(2));

    expect(updates).toEqual([
      { "system.sheetMode.value": "freeedit" },
      { "system.sheetMode.value": "normal" },
    ]);
  });
});
