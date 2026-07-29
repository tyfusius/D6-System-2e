import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(root, "dist");
const systemOutput = path.join(outputDirectory, "d6-system-2e.mjs");
const hudDirectory = path.join(root, "packages/token-action-hud-d6-system-2e");
const hudOutput = path.join(hudDirectory, "token-action-hud-d6-system-2e.mjs");
const outputs = [
  systemOutput,
  `${systemOutput}.map`,
  hudOutput,
  `${hudOutput}.map`,
];

async function clean() {
  await Promise.all(outputs.map((output) => rm(output, { force: true })));
}

await clean();

if (!process.argv.includes("--clean")) {
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    build({
      bundle: true,
      entryPoints: [path.join(root, "packages/system/src/main.ts")],
      format: "esm",
      logLevel: "info",
      outfile: systemOutput,
      platform: "browser",
      sourcemap: true,
      target: "es2022",
    }),
    build({
      bundle: true,
      entryPoints: [path.join(hudDirectory, "src/main.ts")],
      format: "esm",
      logLevel: "info",
      outfile: hudOutput,
      platform: "browser",
      sourcemap: true,
      target: "es2022",
    }),
  ]);
}
