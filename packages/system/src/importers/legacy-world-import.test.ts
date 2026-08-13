import { describe, expect, it } from "vitest";
import {
  canonicalLegacyWorldReport,
  LEGACY_WORLD_EXPORT_FORMAT,
  serializeCanonicalLegacyWorldReport,
  type CanonicalLegacyWorldReportOptions,
  type LegacyWorldExport,
  type LegacyWorldExportRecord,
} from "./legacy-world-import";

const ANOMALY_OPTIONS: CanonicalLegacyWorldReportOptions = {
  scaleAnomalies: [
    {
      code: "fixture-183-versus-18-source-conflict",
      path: "system.scale.score",
      sourceUuid: "Actor.fixture-anomaly",
    },
  ],
};
const ACTIVE_EFFECT_ID = "EffectFixture001";
const SCENE_ID = "SceneFixture0001";
const TOKEN_ID = "TokenFixture0001";
const DELTA_ID = "DeltaFixture0001";

function actor(
  id: string,
  type: string,
  system: Record<string, unknown>,
): LegacyWorldExportRecord {
  return {
    collection: "actors",
    key: `!actors!${id}`,
    value: { _id: id, name: `Fixture ${id}`, system, type },
  };
}

function scale(score: number): Record<string, unknown> {
  return { scale: { score } };
}

function setting(key: string, value: boolean): LegacyWorldExportRecord {
  return {
    collection: "settings",
    key: `!settings!${key}`,
    value: { key, value: JSON.stringify(value) },
  };
}

function scalePopulation(): LegacyWorldExportRecord[] {
  const records: LegacyWorldExportRecord[] = [];
  for (let index = 0; index < 3; index += 1) {
    records.push(actor(`vehicle-${index}`, "vehicle", scale(2)));
  }
  for (let index = 0; index < 7; index += 1) {
    records.push(
      actor(`character-${index}`, "character", {
        vehicle: scale(index < 2 ? 2 : 3),
      }),
    );
  }
  for (let index = 0; index < 3; index += 1) {
    records.push(actor(`npc-${index}`, "npc", { vehicle: scale(18) }));
  }
  const starshipValues = [
    ...Array<number>(7).fill(3),
    ...Array<number>(10).fill(18),
    20,
    30,
    183,
  ];
  starshipValues.forEach((value, index) => {
    const id = value === 183 ? "fixture-anomaly" : `starship-${index}`;
    records.push(
      actor(id, "starship", {
        ...(index < 11
          ? { embedded_pilot: { actor: { system: { vehicle: scale(18) } } } }
          : {}),
        ...scale(value),
      }),
    );
  });
  records.push({
    collection: "actors",
    key: "!actors.items!vehicle-0.weapon-0",
    value: {
      _id: "weapon-0",
      name: "Fixture mounted weapon",
      system: scale(2),
      type: "vehicle-weapon",
    },
  });
  records.push(actor("zero", "character", scale(0)));
  records.push(
    actor("array-snapshot", "character", {
      archivedVehicles: [{ system: { vehicle: scale(0) } }],
      legacyReference: "Actor.Reference0001",
    }),
  );
  return records;
}

function sourceExport(system: "od6s" | "od6s-next"): LegacyWorldExport {
  const population = scalePopulation().map((entry) =>
    entry.key === "!actors!vehicle-0"
      ? {
          ...entry,
          value: {
            ...(entry.value as Record<string, unknown>),
            effects: [ACTIVE_EFFECT_ID],
          },
        }
      : entry,
  );
  return {
    format: LEGACY_WORLD_EXPORT_FORMAT,
    records: [
      ...population,
      setting(`${system}.dice_for_scale`, system === "od6s"),
      ...(system === "od6s-next" ? [setting("od6s.dice_for_scale", true)] : []),
      {
        collection: "actors",
        key: `!actors.effects!vehicle-0.${ACTIVE_EFFECT_ID}`,
        value: {
          _id: ACTIVE_EFFECT_ID,
          changes: [{ key: "system.attributes.agility.mod" }],
          statuses: [],
        },
      },
      {
        collection: "scenes",
        key: `!scenes!${SCENE_ID}`,
        value: { _id: SCENE_ID, tokens: [TOKEN_ID] },
      },
      {
        collection: "scenes",
        key: `!scenes.tokens!${SCENE_ID}.${TOKEN_ID}`,
        value: {
          _id: TOKEN_ID,
          actorId: "vehicle-0",
          actorLink: false,
          delta: DELTA_ID,
        },
      },
      {
        collection: "scenes",
        key: `!scenes.tokens.delta!${SCENE_ID}.${TOKEN_ID}.${DELTA_ID}`,
        value: { _id: DELTA_ID },
      },
    ],
    source: {
      coreVersion: system === "od6s" ? "12.343" : "14.365",
      system,
      systemVersion: system === "od6s" ? "1.0.7" : "2.0.0-alpha.2",
      worldId: "sanitized-rehearsal",
    },
  };
}

describe("canonical legacy world importer foundation", () => {
  it("reports the complete 45-path rehearsal population without target writes", () => {
    const report = canonicalLegacyWorldReport(
      sourceExport("od6s-next"),
      ANOMALY_OPTIONS,
    );
    expect(report.summary).toMatchObject({
      exact: 46,
      lossy: 0,
      nonzeroScalePaths: 45,
      scalePaths: 47,
      skipped: 1,
      unresolved: 1,
    });
    expect(report.acceptance).toEqual({
      dryRun: true,
      idempotent: true,
      targetWrites: 0,
    });
    expect(report.documentSummary).toMatchObject({
      activeEffects: 1,
      actorDeltas: 1,
      actorDocuments: report.summary.actorDocuments,
      embeddedItems: report.summary.embeddedItems,
      placedTokens: 1,
      referenceFindings: 2,
      scenes: 1,
      skipped: 0,
    });
    expect(
      report.documentSummary.exact + report.documentSummary.unresolved,
    ).toBe(
      report.documentSummary.actorDocuments +
        report.documentSummary.embeddedItems +
        report.documentSummary.activeEffects +
        report.documentSummary.actorDeltas +
        report.documentSummary.actorDeltaItems +
        report.documentSummary.actorDeltaEffects +
        report.documentSummary.actorDeltaItemEffects +
        report.documentSummary.scenes +
        report.documentSummary.placedTokens,
    );
    expect(report.activeEffects).toMatchObject({
      changePaths: 1,
      documents: 1,
      exact: 1,
      originAbsent: 1,
      unresolved: 0,
    });
    expect(report.placedTokens).toMatchObject({
      deltaRootRecords: 1,
      documents: 1,
      exact: 1,
      exactActorReferences: 1,
      exactDeltaReferences: 1,
      exactIndexes: 1,
      unresolved: 0,
    });
    expect(report.actorDeltas).toMatchObject({
      documents: 1,
      exactActorReferences: 1,
      exactDeltaReferences: 1,
      exactEvidence: 1,
      exactTokenReferences: 1,
      roots: 1,
      unresolvedEvidence: 0,
    });
    expect(report.referenceFindings).toContainEqual({
      kind: "foundry-uuid",
      path: "system.legacyReference",
      sourceUuid: "Actor.array-snapshot",
      value: "Actor.Reference0001",
    });
    const anomaly = report.scaleLedger.find(
      ({ source }) => source.uuid === "Actor.fixture-anomaly",
    );
    expect(anomaly).toMatchObject({
      magnitude: 183,
      side: "unresolved",
      source: {
        path: "system.scale.score",
        system: "od6s-next",
        value: 183,
        version: "2.0.0-alpha.2",
      },
      status: "unresolved",
    });
  });

  it("produces byte-identical reports when the same export is imported twice", () => {
    const source = sourceExport("od6s-next");
    expect(
      serializeCanonicalLegacyWorldReport(
        canonicalLegacyWorldReport(source, ANOMALY_OPTIONS),
      ),
    ).toBe(
      serializeCanonicalLegacyWorldReport(
        canonicalLegacyWorldReport(source, ANOMALY_OPTIONS),
      ),
    );
  });

  it("keeps od6s and od6s-next adapters path-for-path compatible", () => {
    const original = canonicalLegacyWorldReport(
      sourceExport("od6s"),
      ANOMALY_OPTIONS,
    );
    const rehearsal = canonicalLegacyWorldReport(
      sourceExport("od6s-next"),
      ANOMALY_OPTIONS,
    );
    const comparable = (report: typeof original) =>
      report.scaleLedger.map(({ magnitude, side, source, status }) => ({
        magnitude,
        path: source.path,
        side,
        status,
        uuid: source.uuid,
        value: source.value,
      }));
    expect(comparable(rehearsal)).toEqual(comparable(original));
  });

  it("reports the rehearsal scale-setting divergence without activating rules", () => {
    const report = canonicalLegacyWorldReport(
      sourceExport("od6s-next"),
      ANOMALY_OPTIONS,
    );
    expect(report.rulesEvidence).toEqual({
      activeKey: "od6s-next.dice_for_scale",
      activeValue: false,
      legacyKey: "od6s.dice_for_scale",
      legacyValue: true,
    });
    expect(report.warnings.map(({ code }) => code)).toEqual([
      "source-scale-disabled",
      "legacy-scale-setting-divergence",
    ]);
  });
});
