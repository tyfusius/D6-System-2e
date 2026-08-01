import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(
  await readFile(path.join(root, "content/skills.json"), "utf8"),
);
const profiles = [
  ["second-edition", "second-edition-skills"],
  ["open-d6", "open-d6-skills"],
];

function documentId(identity) {
  return createHash("sha256").update(identity).digest("hex").slice(0, 16);
}

function source(entry, profile) {
  const _id = documentId(`${profile}:${entry.key}`);
  return {
    _id,
    name: entry.name,
    type: "skill",
    img: "icons/svg/dice-target.svg",
    system: {
      attributeId: entry.attributeId,
      description: "",
      key: entry.key,
      score: 0,
      source: {
        book:
          profile === "open-d6" ? "OpenD6 Space" : "D6 System: Second Edition",
        module: entry.module,
        page: entry.sourcePage,
      },
      training: "standard",
    },
    effects: [],
    folder: null,
    flags: {},
    ownership: { default: 0 },
    sort: 0,
    _stats: {
      compendiumSource: null,
      coreVersion: "14.365",
      createdTime: null,
      duplicateSource: null,
      lastModifiedBy: null,
      modifiedTime: null,
      systemId: "d6-system-2e",
      systemVersion: "0.1.0-alpha.13",
    },
  };
}

for (const [profile, directoryName] of profiles) {
  const directory = path.join(root, "packs", directoryName);
  await rm(directory, { force: true, recursive: true });
  const db = new ClassicLevel(directory, { valueEncoding: "json" });
  const entries = catalog
    .filter((entry) => entry.profiles.includes(profile))
    .map((entry) => source(entry, profile));
  await db.batch(
    entries.map((entry) => ({
      type: "put",
      key: `!items!${entry._id}`,
      value: entry,
    })),
  );
  await db.close();
  console.info(`Built ${directoryName}: ${entries.length} skills`);
}
