import { describe, expect, it } from "vitest";
import {
  augmentationAcquisitionDifficulty,
  augmentationCapacity,
  augmentationFirewall,
  augmentationInstallDifficulty,
  augmentationInstallMinutes,
  cyberwareDisableTurns,
  hackingConsequence,
  personalFirewall,
} from "./cyberpunk";

describe("Second Edition Cyberpunk rules", () => {
  it("derives personal and augmentation firewalls", () => {
    expect(personalFirewall(8)).toBe(10);
    expect(augmentationFirewall(3)).toBe(15);
  });

  it("derives capacity, installation, and acquisition values", () => {
    expect(augmentationCapacity(11)).toBe(3);
    expect(augmentationInstallDifficulty(2)).toBe(20);
    expect(augmentationInstallMinutes(2)).toBe(120);
    expect(augmentationAcquisitionDifficulty(4)).toBe(25);
  });

  it("uses the Computers whole dice for a disable duration", () => {
    expect(cyberwareDisableTurns(14)).toBe(4);
  });

  it("resolves the gated hacking consequence roll", () => {
    expect(hackingConsequence(4, 6)).toBe("none");
    expect(hackingConsequence(5, 4)).toBe("none");
    expect(hackingConsequence(5, 5)).toBe("noticed");
    expect(hackingConsequence(14, 6)).toBe("identity-exposed");
  });
});
