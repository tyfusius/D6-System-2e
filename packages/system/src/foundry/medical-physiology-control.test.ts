import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  bindMedicalPhysiologyControl,
  medicalPhysiologyUpdate,
} from "./medical-physiology-control";

describe("medical physiology control", () => {
  it("binds the control to the rendered Combat part change lifecycle", () => {
    const sheet = readFileSync(
      new URL("./sheets/character-sheet.ts", import.meta.url),
      "utf8",
    );
    expect(sheet).toContain("bindMedicalPhysiologyControl(htmlElement");
    expect(sheet).toContain('if (input.name === "medical.physiology") return');
    expect(sheet).toContain(
      "setMedicalPhysiology: this.#deferMedicalPhysiologyToChange",
    );
  });

  it("builds mutable, monotonic Actor update data", () => {
    const changes = medicalPhysiologyUpdate({ revision: 4 }, "biological");
    expect(changes).toEqual({
      "system.medical.physiology": {
        kind: "biological",
        source: "world",
        revision: 5,
      },
    });
    expect(Object.isExtensible(changes)).toBe(true);
    if (changes) changes._id = "patient";
    expect(changes?._id).toBe("patient");
    expect(medicalPhysiologyUpdate({ revision: 4 }, "invalid")).toBeUndefined();
  });

  it("persists the changed select value through a v14-style mutating Actor double", async () => {
    let listener: (() => void) | undefined;
    const select = {
      value: "unknown",
      addEventListener: (_type: string, next: () => void) => {
        listener = next;
      },
    };
    const persisted = vi.fn((changes: Record<string, unknown>) => {
      changes._id = "patient";
      return Promise.resolve(changes);
    });
    bindMedicalPhysiologyControl(
      { querySelector: () => select } as unknown as ParentNode,
      {
        canClassify: () => true,
        current: () => ({ revision: 1 }),
        persist: persisted,
      },
    );
    select.value = "biological";
    listener?.();
    await vi.waitFor(() => expect(persisted).toHaveBeenCalledOnce());
    expect(persisted.mock.calls[0]?.[0]).toMatchObject({
      _id: "patient",
      "system.medical.physiology": {
        kind: "biological",
        revision: 2,
      },
    });
  });
});
