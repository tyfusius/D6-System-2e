import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(root, "dist");
const systemOutput = path.join(outputDirectory, "d6-system-2e.mjs");
const hudDirectory = path.join(root, "packages/token-action-hud-d6-system-2e");
const coreContentDirectory = path.join(
  root,
  "packages/d6-system-2e-core-content",
);
const coreContentOutput = path.join(
  coreContentDirectory,
  "d6-system-2e-core-content.mjs",
);
const secondEditionFantasyDirectory = path.join(
  root,
  "packages/d6-system-2e-fantasy",
);
const secondEditionFantasyOutput = path.join(
  secondEditionFantasyDirectory,
  "d6-system-2e-fantasy.mjs",
);
const hudOutput = path.join(hudDirectory, "token-action-hud-d6-system-2e.mjs");
const spaceDirectory = path.join(root, "packages/open-d6-space-d6-system-2e");
const spaceOutput = path.join(spaceDirectory, "open-d6-space-d6-system-2e.mjs");
const fantasyDirectory = path.join(
  root,
  "packages/open-d6-fantasy-d6-system-2e",
);
const fantasyOutput = path.join(
  fantasyDirectory,
  "open-d6-fantasy-d6-system-2e.mjs",
);
const echoDirectory = path.join(root, "packages/echod6-companion-d6-system-2e");
const echoOutput = path.join(
  echoDirectory,
  "echod6-companion-d6-system-2e.mjs",
);
const outputs = [
  systemOutput,
  `${systemOutput}.map`,
  coreContentOutput,
  `${coreContentOutput}.map`,
  secondEditionFantasyOutput,
  `${secondEditionFantasyOutput}.map`,
  hudOutput,
  `${hudOutput}.map`,
  spaceOutput,
  `${spaceOutput}.map`,
  fantasyOutput,
  `${fantasyOutput}.map`,
  echoOutput,
  `${echoOutput}.map`,
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
      entryPoints: [path.join(coreContentDirectory, "src/main.ts")],
      format: "esm",
      logLevel: "info",
      outfile: coreContentOutput,
      platform: "browser",
      sourcemap: true,
      target: "es2022",
    }),
    build({
      bundle: true,
      entryPoints: [path.join(secondEditionFantasyDirectory, "src/main.ts")],
      format: "esm",
      logLevel: "info",
      outfile: secondEditionFantasyOutput,
      platform: "browser",
      sourcemap: true,
      target: "es2022",
    }),
    build({
      bundle: true,
      entryPoints: [path.join(echoDirectory, "src/main.ts")],
      format: "esm",
      logLevel: "info",
      outfile: echoOutput,
      platform: "browser",
      sourcemap: true,
      target: "es2022",
    }),
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
      entryPoints: [path.join(fantasyDirectory, "src/main.ts")],
      format: "esm",
      logLevel: "info",
      outfile: fantasyOutput,
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
    build({
      bundle: true,
      entryPoints: [path.join(spaceDirectory, "src/main.ts")],
      format: "esm",
      logLevel: "info",
      outfile: spaceOutput,
      platform: "browser",
      sourcemap: true,
      target: "es2022",
    }),
  ]);
}
