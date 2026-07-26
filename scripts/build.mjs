import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(root, "dist");
const outputs = [
  path.join(outputDirectory, "d6-system-2e.mjs"),
  path.join(outputDirectory, "d6-system-2e.mjs.map"),
];

async function clean() {
  await Promise.all(outputs.map((output) => rm(output, { force: true })));
}

await clean();

if (!process.argv.includes("--clean")) {
  await mkdir(outputDirectory, { recursive: true });
  await build({
    bundle: true,
    entryPoints: [path.join(root, "packages/system/src/main.ts")],
    format: "esm",
    logLevel: "info",
    outfile: outputs[0],
    platform: "browser",
    sourcemap: true,
    target: "es2022",
  });
}
