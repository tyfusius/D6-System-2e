import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";
import { expectedManualRecords, MANUAL_PACK } from "./user-manual-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expected = await expectedManualRecords(root);
const expectedMap = new Map(expected.map(({ key, value }) => [key, value]));
const database = new ClassicLevel(path.join(root, MANUAL_PACK), {
  readOnly: true,
  valueEncoding: "json",
});
const actualMap = new Map();
for await (const [key, value] of database.iterator()) {
  actualMap.set(key, value);
}
await database.close();

if (actualMap.size !== expectedMap.size) {
  throw new Error(
    `User manual pack has ${actualMap.size} records; expected ${expectedMap.size}. Run npm run manual:build.`,
  );
}
for (const [key, value] of expectedMap) {
  if (JSON.stringify(actualMap.get(key)) !== JSON.stringify(value)) {
    throw new Error(
      `User manual pack record ${key} is stale. Run npm run manual:build.`,
    );
  }
}

const markdown = await readFile(path.join(root, "docs/USER-MANUAL.md"), "utf8");
const imagePaths = [
  ...markdown.matchAll(/\]\(\.\.\/(assets\/manual\/[^)]+)\)/gu),
].map((match) => match[1]);
for (const imagePath of imagePaths) {
  await access(path.join(root, imagePath));
}
if (new Set(imagePaths).size !== imagePaths.length) {
  throw new Error("The user manual references a screenshot more than once.");
}

console.info(
  `User manual verified: ${expected.length - 1} pages and ${imagePaths.length} screenshots.`,
);
