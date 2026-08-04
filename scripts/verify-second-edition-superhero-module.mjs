import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const system = JSON.parse(
  await readFile(path.join(root, "system.json"), "utf8"),
);
const moduleRoot = path.join(root, "packages/d6-system-2e-superhero");
const manifest = JSON.parse(
  await readFile(path.join(moduleRoot, "module.json"), "utf8"),
);
const moduleSource = await readFile(
  path.join(moduleRoot, "src/main.ts"),
  "utf8",
);

if (
  manifest.id !== "d6-system-2e-superhero" ||
  manifest.version !== system.version ||
  manifest.relationships?.systems?.[0]?.id !== system.id ||
  "packs" in manifest
) {
  throw new Error("Second Edition Superhero manifest is invalid.");
}
if (
  !moduleSource.includes('family: "superhero"') ||
  !moduleSource.includes('mechanicIds: ["superheroes"]') ||
  moduleSource.includes("game.settings.set") ||
  moduleSource.includes("applyPreset")
) {
  throw new Error(
    "Second Edition Superhero must advertise recommended mechanics without activating rules.",
  );
}

await access(path.join(moduleRoot, "d6-system-2e-superhero.mjs"));
console.info(
  "Second Edition Superhero module verified (lawful public catalogs remain empty).",
);
