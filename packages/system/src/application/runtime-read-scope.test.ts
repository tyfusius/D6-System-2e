import { describe, expect, it, vi } from "vitest";
import {
  invalidateRuntimeReadScope,
  readRuntimeProjection,
  withRuntimeReadScope,
} from "./runtime-read-scope";

describe("synchronous runtime read scopes", () => {
  it("shares nested projections only within a read, including undefined values", () => {
    const key = {},
      read = vi.fn(() => undefined);
    withRuntimeReadScope(() => {
      readRuntimeProjection(key, read);
      withRuntimeReadScope(() => readRuntimeProjection(key, read));
    });
    expect(read).toHaveBeenCalledOnce();
    readRuntimeProjection(key, read);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("releases state on failure and retries unsuccessful projections", () => {
    const key = {},
      fail = vi.fn(() => {
        throw new Error("projection");
      });
    expect(() =>
      withRuntimeReadScope(() => readRuntimeProjection(key, fail)),
    ).toThrow("projection");
    expect(readRuntimeProjection(key, () => 42)).toBe(42);
  });
  it("ends at the first await and never shares across overlapping async work", async () => {
    const key = {};
    let value = 1;
    const pending = withRuntimeReadScope(async () => {
      expect(readRuntimeProjection(key, () => value)).toBe(1);
      await Promise.resolve();
      return readRuntimeProjection(key, () => value);
    });
    value = 2;
    expect(readRuntimeProjection(key, () => value)).toBe(2);
    expect(await pending).toBe(2);
  });
  it("invalidates nested contribution changes without restoring stale results", () => {
    const key = {},
      read = vi.fn(() => 2);
    withRuntimeReadScope(() => {
      readRuntimeProjection(key, () => {
        invalidateRuntimeReadScope();
        return 1;
      });
      expect(readRuntimeProjection(key, read)).toBe(2);
      expect(readRuntimeProjection(key, read)).toBe(2);
      expect(read).toHaveBeenCalledOnce();
    });
  });
});
