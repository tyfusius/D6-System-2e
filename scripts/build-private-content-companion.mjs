import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const descriptionPath = path.join(
  root,
  "private-content/skill-descriptions.json",
);
const moduleRoot = path.resolve(
  root,
  "../../modules/d6-system-2e-private-content",
);
const catalog = JSON.parse(
  await readFile(path.join(root, "content/skills.json"), "utf8"),
);
const descriptions = JSON.parse(await readFile(descriptionPath, "utf8"));
const entries = catalog.filter(
  (entry) =>
    entry.profiles.includes("second-edition") &&
    typeof descriptions[entry.key] === "string" &&
    descriptions[entry.key].trim().length > 0,
);

function documentId(key) {
  return createHash("sha256")
    .update(`second-edition:${key}`)
    .digest("hex")
    .slice(0, 16);
}

await mkdir(moduleRoot, { recursive: true });
await writeFile(
  path.join(moduleRoot, "module.json"),
  `${JSON.stringify(
    {
      id: "d6-system-2e-private-content",
      type: "module",
      title: "D6 System 2e Private Content",
      description:
        "Local-only licensed descriptions for the D6 System Second Edition.",
      version: "0.1.0",
      compatibility: { minimum: "14.365", verified: "14.365" },
      relationships: {
        systems: [{ id: "d6-system-2e", type: "system" }],
      },
      packs: [
        {
          name: "second-edition-skills-private",
          label: "D6 System: Second Edition Skills (Private)",
          path: "packs/second-edition-skills-private",
          type: "Item",
          system: "d6-system-2e",
        },
      ],
    },
    null,
    2,
  )}\n`,
);

const packDirectory = path.join(
  moduleRoot,
  "packs/second-edition-skills-private",
);
await rm(packDirectory, { force: true, recursive: true });
const db = new ClassicLevel(packDirectory, { valueEncoding: "json" });
await db.batch(
  entries.map((entry) => {
    const _id = documentId(entry.key);
    return {
      type: "put",
      key: `!items!${_id}`,
      value: {
        _id,
        name: entry.name,
        type: "skill",
        img: "icons/svg/dice-target.svg",
        system: {
          attributeId: entry.attributeId,
          description: descriptions[entry.key],
          key: entry.key,
          score: 0,
          source: {
            book: "D6 System: Second Edition",
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
          systemVersion: "0.1.0-alpha.0",
        },
      },
    };
  }),
);
await db.close();
console.info(
  `Built local companion ${moduleRoot} with ${entries.length} enriched skills.`,
);
