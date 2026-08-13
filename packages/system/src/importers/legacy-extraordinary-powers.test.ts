import { describe, expect, it } from "vitest";
import {
  canonicalLegacyPowerDryRun,
  serializeLegacyPowerDryRun,
  type LegacyPowerSource,
} from "./legacy-extraordinary-powers";

function source(records: readonly unknown[]): LegacyPowerSource {
  return {
    pack: "synthetic.powers",
    records,
    system: "od6s",
    version: "1.0.7",
  };
}

describe("legacy extraordinary-power canonical dry run", () => {
  it("withholds protected fields and refuses to infer unstructured mechanics", () => {
    const report = canonicalLegacyPowerDryRun(
      source([
        {
          _id: "powerFixture",
          data: { description: "Synthetic prose", label: "Synthetic label" },
          effects: [
            { changes: [{ key: "data.attributes.met.mod", value: "1" }] },
          ],
          img: "synthetic/icon.svg",
          name: "Synthetic power",
          type: "manifestation",
        },
      ]),
    );

    expect(report).toMatchObject({
      dryRun: true,
      summary: {
        assetsWithheld: 1,
        lossy: 1,
        powers: 1,
        proseWithheld: 2,
        records: 1,
        unresolved: 1,
      },
      targetWrites: 0,
    });
    expect(report.rows[0]).toMatchObject({
      kind: "power",
      notes: [
        "checks-not-structured",
        "difficulty-not-structured",
        "maintenance-not-structured",
        "prerequisites-not-structured",
        "legacy-active-effects-require-explicit-conversion",
        "protected-prose-withheld",
        "asset-reference-withheld",
      ],
      status: "unresolved",
    });
    expect(serializeLegacyPowerDryRun(report)).not.toContain("Synthetic");
    expect(serializeLegacyPowerDryRun(report)).not.toContain("icon.svg");
    expect(serializeLegacyPowerDryRun(report)).not.toContain("data.attributes");
  });

  it("sorts deterministically and records non-power role evidence as skipped", () => {
    const fixture = source([
      { _id: "z", data: {}, effects: [], type: "skill" },
      { _id: "a", data: {}, effects: [], type: "manifestation" },
      { _id: "x", type: "unsupported" },
    ]);
    const first = canonicalLegacyPowerDryRun(fixture);
    const second = canonicalLegacyPowerDryRun(fixture);

    expect(serializeLegacyPowerDryRun(first)).toBe(
      serializeLegacyPowerDryRun(second),
    );
    expect(first.rows.map(({ source: rowSource }) => rowSource.uuid)).toEqual([
      "Item.a",
      "Item.x",
      "Item.z",
    ]);
    expect(first.summary).toMatchObject({
      powers: 1,
      skipped: 1,
      skillRoles: 1,
      unknown: 1,
      unresolved: 2,
    });
  });
});
