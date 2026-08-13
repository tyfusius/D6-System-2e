import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ClassicLevel } from "classic-level";
import {
  canonicalLegacyWorldReport,
  LEGACY_WORLD_EXPORT_FORMAT,
  serializeCanonicalLegacyWorldReport,
  type LegacyWorldExport,
  type LegacyWorldExportRecord,
  type LegacyWorldSource,
  type LegacyScaleAnomalyEvidence,
} from "./legacy-world-import";
import {
  canonicalLegacyDocumentEnvelopes,
  serializeCanonicalLegacyDocumentEnvelopes,
} from "./legacy-document-envelope";
import type { LegacyExtraordinaryPowerActorMapping } from "./legacy-extraordinary-power-actors";

interface WorldManifest {
  readonly coreVersion?: unknown;
  readonly id?: unknown;
  readonly system?: unknown;
  readonly systemVersion?: unknown;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`Missing ${label}.`);
  }
  return value;
}

function argumentsByName(): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index];
    const value = process.argv[index + 1];
    if (!key?.startsWith("--") || !value) {
      throw new TypeError(
        "Usage: --world <cloned-world-path> --output <new-output-directory> [--expect-nonzero <count>] [--scale-anomaly <UUID|path|code>]",
      );
    }
    result.set(key.slice(2), value);
  }
  return result;
}

async function readCollection(
  directory: string,
  collection: LegacyWorldExportRecord["collection"],
): Promise<readonly LegacyWorldExportRecord[]> {
  const database = new ClassicLevel<string, unknown>(directory, {
    valueEncoding: "json",
  });
  const result: LegacyWorldExportRecord[] = [];
  try {
    for await (const [key, value] of database.iterator()) {
      result.push({ collection, key, value });
    }
  } finally {
    await database.close();
  }
  return result;
}

function ndjson(records: readonly LegacyWorldExportRecord[]): string {
  return `${records.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function anomalyEvidence(
  value: string | undefined,
): LegacyScaleAnomalyEvidence[] {
  if (!value) return [];
  const [sourceUuid, anomalyPath, code, ...extra] = value.split("|");
  if (!sourceUuid || !anomalyPath || !code || extra.length > 0) {
    throw new TypeError(
      "--scale-anomaly must be <source UUID>|<source path>|<evidence code>.",
    );
  }
  return [{ code, path: anomalyPath, sourceUuid }];
}

export async function runLegacyRehearsal(
  extraordinaryPowerActorMapping?: LegacyExtraordinaryPowerActorMapping,
): Promise<void> {
  const args = argumentsByName();
  const world = path.resolve(requiredString(args.get("world"), "world path"));
  const output = path.resolve(
    requiredString(args.get("output"), "output directory"),
  );
  if (output === world || output.startsWith(`${world}${path.sep}`)) {
    throw new RangeError(
      "The export directory must be outside the source world.",
    );
  }
  const manifest = JSON.parse(
    await readFile(path.join(world, "world.json"), "utf8"),
  ) as WorldManifest;
  const system = requiredString(manifest.system, "source system");
  if (system !== "od6s" && system !== "od6s-next") {
    throw new TypeError(`Unsupported source system ${system}.`);
  }
  const source: LegacyWorldSource = {
    coreVersion: requiredString(manifest.coreVersion, "core version"),
    system,
    systemVersion: requiredString(manifest.systemVersion, "system version"),
    worldId: requiredString(manifest.id, "world ID"),
  };
  const scaleAnomalies = anomalyEvidence(args.get("scale-anomaly"));
  await mkdir(output, { recursive: false });
  const clone = await mkdtemp(path.join(os.tmpdir(), "d6-legacy-export-"));
  try {
    const collections = [
      "actors",
      "cards",
      "folders",
      "items",
      "journal",
      "macros",
      "playlists",
      "scenes",
      "settings",
      "tables",
    ] as const;
    for (const collection of collections) {
      await cp(
        path.join(world, "data", collection),
        path.join(clone, collection),
        { recursive: true },
      );
    }
    const actorRecords = await readCollection(
      path.join(clone, "actors"),
      "actors",
    );
    const settingRecords = await readCollection(
      path.join(clone, "settings"),
      "settings",
    );
    const itemRecords = await readCollection(
      path.join(clone, "items"),
      "items",
    );
    const folderRecords = await readCollection(
      path.join(clone, "folders"),
      "folders",
    );
    const sceneRecords = await readCollection(
      path.join(clone, "scenes"),
      "scenes",
    );
    const cardRecords = await readCollection(
      path.join(clone, "cards"),
      "cards",
    );
    const journalRecords = await readCollection(
      path.join(clone, "journal"),
      "journal",
    );
    const macroRecords = await readCollection(
      path.join(clone, "macros"),
      "macros",
    );
    const playlistRecords = await readCollection(
      path.join(clone, "playlists"),
      "playlists",
    );
    const tableRecords = await readCollection(
      path.join(clone, "tables"),
      "tables",
    );
    const records = [
      ...actorRecords,
      ...cardRecords,
      ...folderRecords,
      ...itemRecords,
      ...journalRecords,
      ...macroRecords,
      ...playlistRecords,
      ...sceneRecords,
      ...settingRecords,
      ...tableRecords,
    ];
    const sourceExport: LegacyWorldExport = {
      format: LEGACY_WORLD_EXPORT_FORMAT,
      records,
      source,
    };
    const report = canonicalLegacyWorldReport(sourceExport, {
      ...(extraordinaryPowerActorMapping
        ? { extraordinaryPowerActorMapping }
        : {}),
      scaleAnomalies,
    });
    const secondReport = canonicalLegacyWorldReport(sourceExport, {
      ...(extraordinaryPowerActorMapping
        ? { extraordinaryPowerActorMapping }
        : {}),
      scaleAnomalies,
    });
    const reportJson = serializeCanonicalLegacyWorldReport(report);
    if (reportJson !== serializeCanonicalLegacyWorldReport(secondReport)) {
      throw new Error("Canonical dry run is not idempotent.");
    }
    const documents = canonicalLegacyDocumentEnvelopes(source, records);
    const documentsJson = serializeCanonicalLegacyDocumentEnvelopes(
      documents.documents,
    );
    if (
      documentsJson !==
      serializeCanonicalLegacyDocumentEnvelopes(
        canonicalLegacyDocumentEnvelopes(source, records).documents,
      )
    ) {
      throw new Error("Canonical document envelopes are not idempotent.");
    }
    const expected = args.get("expect-nonzero");
    if (
      expected !== undefined &&
      report.summary.nonzeroScalePaths !== Number(expected)
    ) {
      throw new Error(
        `Found ${report.summary.nonzeroScalePaths} nonzero scale paths; expected ${expected}.`,
      );
    }
    const actorsJson = ndjson(actorRecords);
    const foldersJson = ndjson(folderRecords);
    const itemsJson = ndjson(itemRecords);
    const scenesJson = ndjson(sceneRecords);
    const settingsJson = ndjson(settingRecords);
    const cardsJson = ndjson(cardRecords);
    const journalJson = ndjson(journalRecords);
    const macrosJson = ndjson(macroRecords);
    const playlistsJson = ndjson(playlistRecords);
    const tablesJson = ndjson(tableRecords);
    const manifestJson = `${JSON.stringify(
      {
        format: LEGACY_WORLD_EXPORT_FORMAT,
        hashes: {
          actors: sha256(actorsJson),
          cards: sha256(cardsJson),
          documents: sha256(documentsJson),
          folders: sha256(foldersJson),
          items: sha256(itemsJson),
          journal: sha256(journalJson),
          macros: sha256(macrosJson),
          playlists: sha256(playlistsJson),
          report: sha256(reportJson),
          scenes: sha256(scenesJson),
          settings: sha256(settingsJson),
          tables: sha256(tablesJson),
        },
        recordCounts: {
          actors: actorRecords.length,
          cards: cardRecords.length,
          documents: documents.documents.length,
          folders: folderRecords.length,
          items: itemRecords.length,
          journal: journalRecords.length,
          macros: macroRecords.length,
          playlists: playlistRecords.length,
          scenes: sceneRecords.length,
          settings: settingRecords.length,
          tables: tableRecords.length,
        },
        source,
      },
      null,
      2,
    )}\n`;
    await writeFile(path.join(output, "actors.ndjson"), actorsJson, {
      flag: "wx",
    });
    await writeFile(path.join(output, "settings.ndjson"), settingsJson, {
      flag: "wx",
    });
    await writeFile(path.join(output, "cards.ndjson"), cardsJson, {
      flag: "wx",
    });
    await writeFile(path.join(output, "journal.ndjson"), journalJson, {
      flag: "wx",
    });
    await writeFile(path.join(output, "macros.ndjson"), macrosJson, {
      flag: "wx",
    });
    await writeFile(path.join(output, "playlists.ndjson"), playlistsJson, {
      flag: "wx",
    });
    await writeFile(path.join(output, "tables.ndjson"), tablesJson, {
      flag: "wx",
    });
    await writeFile(path.join(output, "folders.ndjson"), foldersJson, {
      flag: "wx",
    });
    await writeFile(path.join(output, "items.ndjson"), itemsJson, {
      flag: "wx",
    });
    await writeFile(path.join(output, "scenes.ndjson"), scenesJson, {
      flag: "wx",
    });
    await writeFile(path.join(output, "documents.ndjson"), documentsJson, {
      flag: "wx",
    });
    await writeFile(path.join(output, "report.json"), reportJson, {
      flag: "wx",
    });
    await writeFile(path.join(output, "manifest.json"), manifestJson, {
      flag: "wx",
    });
    console.log(
      JSON.stringify(
        {
          output,
          source,
          activeEffects: report.activeEffects,
          actorDeltas: report.actorDeltas,
          documentSummary: report.documentSummary,
          folderReferences: report.folderReferences,
          folderTopology: report.folderTopology,
          extraordinaryPowerActors: report.extraordinaryPowerActors?.summary,
          placedTokens: report.placedTokens,
          prototypeTokens: report.prototypeTokens,
          summary: report.summary,
          warnings: report.warnings,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await rm(output, { force: true, recursive: true });
    throw error;
  } finally {
    await rm(clone, { force: true, recursive: true });
  }
}
