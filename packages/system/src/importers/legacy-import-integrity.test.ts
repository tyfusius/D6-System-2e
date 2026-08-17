import { describe, expect, it } from "vitest";
import {
  LEGACY_IMPORT_INTEGRITY_REVISION,
  legacyImportIntegrityConflict,
  legacyImportSourceFingerprint,
  withLegacyImportIntegrity,
} from "./legacy-import-integrity";

const source = {
  _id: "Fixture00000001",
  flags: {
    "d6-system-2e": {
      legacyImport: {
        sourceUuid: "Item.Fixture00000001",
        sourceVersion: "1.0.7",
      },
    },
  },
  system: { alpha: 1, beta: { left: true, right: false } },
};

describe("legacy import integrity", () => {
  it("uses canonical key ordering and excludes its own metadata", () => {
    const reordered = {
      system: { beta: { right: false, left: true }, alpha: 1 },
      flags: source.flags,
      _id: source._id,
    };
    const fingerprint = legacyImportSourceFingerprint(source);
    const decorated = withLegacyImportIntegrity(source, fingerprint);
    expect(legacyImportSourceFingerprint(reordered)).toBe(fingerprint);
    expect(legacyImportSourceFingerprint(decorated)).toBe(fingerprint);
  });

  it("distinguishes source, version, revision, and fingerprint conflicts", () => {
    const fingerprint = legacyImportSourceFingerprint(source);
    const decorated = withLegacyImportIntegrity(source, fingerprint);
    const expected = {
      fingerprint,
      sourceUuid: "Item.Fixture00000001",
      sourceVersion: "1.0.7",
    };
    expect(legacyImportIntegrityConflict(decorated, expected)).toBeUndefined();
    expect(
      legacyImportIntegrityConflict(decorated, {
        ...expected,
        sourceUuid: "Item.Other00000001",
      }),
    ).toBe("source-uuid");
    expect(
      legacyImportIntegrityConflict(decorated, {
        ...expected,
        sourceVersion: "1.0.8",
      }),
    ).toBe("source-version");
    expect(
      legacyImportIntegrityConflict(
        withLegacyImportIntegrity(source, "fnv1a64:changed"),
        expected,
      ),
    ).toBe("fingerprint");
    const wrongRevision = structuredClone(decorated) as typeof decorated & {
      flags: {
        "d6-system-2e": {
          legacyImport: { integrity: { revision: number } };
        };
      };
    };
    wrongRevision.flags["d6-system-2e"].legacyImport.integrity.revision =
      LEGACY_IMPORT_INTEGRITY_REVISION + 1;
    expect(legacyImportIntegrityConflict(wrongRevision, expected)).toBe(
      "integrity-revision",
    );
  });
});
