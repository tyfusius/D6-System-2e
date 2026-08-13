import { describe, expect, it } from "vitest";
import { legacyScaleDryRun, type LegacyScaleEvidence } from "./legacy-scale";

const VALUES = [0, 2, 3, 6, 18, 20, 30, 183] as const;

function fixtures(sourceSystem: "od6s" | "od6s-next"): LegacyScaleEvidence[] {
  return VALUES.map((sourceValue) => ({
    ...(sourceValue === 183
      ? { anomaly: "fixture-183-versus-18-source-conflict" }
      : {}),
    documentKind: "starship",
    path: "system.scale.score",
    sourceSystem,
    sourceUuid:
      sourceValue === 183
        ? "Actor.fixture-anomaly"
        : `Actor.scale-${sourceValue}`,
    sourceValue,
    sourceVersion: sourceSystem === "od6s" ? "1.0.7" : "2.0.0-alpha.2",
  }));
}

describe("dual-source legacy scalar dry run", () => {
  it.each(["od6s", "od6s-next"] as const)(
    "preserves exact %s pip magnitudes and quarantines the known anomaly",
    (sourceSystem) => {
      const report = legacyScaleDryRun(fixtures(sourceSystem));
      expect(report.rows.map(({ magnitude }) => magnitude)).toEqual(VALUES);
      expect(report.exact).toBe(7);
      expect(report.unresolved).toBe(1);
      expect(report.rows.at(-1)).toMatchObject({
        confidence: "unresolved",
        magnitude: 183,
        side: "unresolved",
        source: {
          system: sourceSystem,
          value: 183,
        },
        status: "unresolved",
      });
    },
  );

  it("reports personal side ambiguity and Weapon inheritance explicitly", () => {
    const report = legacyScaleDryRun([
      {
        documentKind: "creature",
        path: "system.scale.score",
        sourceSystem: "od6s",
        sourceUuid: "Actor.small-or-large",
        sourceValue: 3,
        sourceVersion: "1.0.7",
      },
      {
        documentKind: "weapon",
        path: "system.scale.score",
        sourceSystem: "od6s",
        sourceUuid: "Item.inherited",
        sourceValue: 0,
        sourceVersion: "1.0.7",
      },
      {
        documentKind: "vehicle-weapon",
        path: "system.scale.score",
        sourceSystem: "od6s-next",
        sourceUuid: "Item.override",
        sourceValue: 2,
        sourceVersion: "2.0.0-alpha.2",
      },
    ]);
    expect(report.rows[0]).toMatchObject({
      side: "unresolved",
      status: "unresolved",
    });
    expect(report.rows[1]).toMatchObject({
      explicit: false,
      side: "human",
      status: "exact",
    });
    expect(report.rows[2]).toMatchObject({
      confidence: "inferred",
      explicit: true,
      magnitude: 2,
      side: "larger",
    });
  });
});
