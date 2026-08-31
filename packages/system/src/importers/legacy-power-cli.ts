import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  canonicalLegacyPowerDryRun,
  serializeLegacyPowerDryRun,
} from "./legacy-extraordinary-powers";

function args(): ReadonlyMap<string, string> {
  const values = new Map<string, string>();
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index];
    const value = process.argv[index + 1];
    if (!key?.startsWith("--") || !value) {
      throw new TypeError(
        "Usage: --source <read-only-ndjson-pack> --system <od6s|od6s-next> --version <version> --output <new-output-directory>",
      );
    }
    values.set(key.slice(2), value);
  }
  return values;
}

function required(values: ReadonlyMap<string, string>, key: string): string {
  const value = values.get(key);
  if (!value) throw new TypeError(`Missing --${key}.`);
  return value;
}

async function main(): Promise<void> {
  const values = args();
  const sourcePath = path.resolve(required(values, "source"));
  const output = path.resolve(required(values, "output"));
  const sourceDirectory = path.dirname(sourcePath);
  if (
    output === sourceDirectory ||
    output.startsWith(`${sourceDirectory}${path.sep}`)
  ) {
    throw new RangeError(
      "The output directory must be outside the read-only source directory.",
    );
  }
  const system = required(values, "system");
  if (system !== "od6s" && system !== "od6s-next") {
    throw new TypeError(`Unsupported source system ${system}.`);
  }
  const raw = await readFile(sourcePath, "utf8");
  const records = raw
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown);
  const report = canonicalLegacyPowerDryRun({
    pack: "reuppowers",
    records,
    system,
    version: required(values, "version"),
  });
  const reportJson = serializeLegacyPowerDryRun(report);
  if (
    reportJson !==
    serializeLegacyPowerDryRun(
      canonicalLegacyPowerDryRun({
        pack: "reuppowers",
        records,
        system,
        version: required(values, "version"),
      }),
    )
  ) {
    throw new Error("Legacy power dry run is not idempotent.");
  }
  await mkdir(output, { recursive: false });
  try {
    await writeFile(path.join(output, "report.json"), reportJson, "utf8");
    await writeFile(
      path.join(output, "manifest.json"),
      `${JSON.stringify(
        {
          dryRun: true,
          format: report.format,
          hashes: {
            report: createHash("sha256").update(reportJson).digest("hex"),
            source: createHash("sha256").update(raw).digest("hex"),
          },
          source: report.source,
          targetWrites: 0,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  } catch (error) {
    await rm(output, { force: true, recursive: true });
    throw error;
  }
}

await main();
