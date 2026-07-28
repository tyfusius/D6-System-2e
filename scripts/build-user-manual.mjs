import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";
import { expectedManualRecords, MANUAL_PACK } from "./user-manual-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, MANUAL_PACK);
const records = await expectedManualRecords(root);

await rm(directory, { force: true, recursive: true });
const database = new ClassicLevel(directory, { valueEncoding: "json" });
await database.batch(
  records.map(({ key, value }) => ({ type: "put", key, value })),
);
await database.close();

console.info(
  `Built user manual: ${records.length - 1} Journal pages from docs/USER-MANUAL.md`,
);
