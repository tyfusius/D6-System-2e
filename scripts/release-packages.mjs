import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export const repository = Object.freeze({
  owner: "tyfusius",
  name: "D6-System-2e",
  url: "https://github.com/tyfusius/D6-System-2e",
});

export const COLLABORATOR_DISTRIBUTION = "private-collaborator";
export const PUBLIC_DISTRIBUTION = "general-public";
export const ECHO_PACKAGE_ID = "echod6-companion-d6-system-2e";

const allReleasePackages = Object.freeze([
  {
    id: "d6-system-2e",
    kind: "system",
    manifestName: "system.json",
    sourceRoot: root,
    extras: [
      "assets",
      "templates",
      "README.md",
      "CHANGELOG.md",
      "LICENSE-NOTICE.md",
    ],
  },
  ...[
    "d6-system-2e-core-content",
    "d6-system-2e-fantasy",
    "d6-system-2e-science-fiction",
    "d6-system-2e-superhero",
    "open-d6-core-content-d6-system-2e",
    "open-d6-adventure-d6-system-2e",
    "open-d6-fantasy-d6-system-2e",
    "open-d6-space-d6-system-2e",
    ECHO_PACKAGE_ID,
    "token-action-hud-d6-system-2e",
  ].map((id) => ({
    id,
    kind: "module",
    manifestName: "module.json",
    sourceRoot: path.join(root, "packages", id),
    extras:
      id === ECHO_PACKAGE_ID
        ? ["art", "README.md", "SETTING.md", "LICENSE-NOTICE.md"]
        : id === "open-d6-space-d6-system-2e"
          ? ["OPEN-GAME-CONTENT.md", "OPEN-GAME-LICENSE.txt"]
          : [],
  })),
]);

export const releasePackages = allReleasePackages;
export const publicReleasePackages = Object.freeze(
  allReleasePackages
    .filter(({ id }) => id !== ECHO_PACKAGE_ID)
    .map((specification) =>
      Object.freeze({
        ...specification,
        extras:
          specification.kind === "system"
            ? specification.extras.filter(
                (relativePath) => relativePath !== "CHANGELOG.md",
              )
            : specification.extras,
      }),
    ),
);

export function releasePackagesFor(distribution) {
  if (distribution === COLLABORATOR_DISTRIBUTION) return releasePackages;
  if (distribution === PUBLIC_DISTRIBUTION) return publicReleasePackages;
  throw new RangeError(`Unknown release distribution: ${distribution}`);
}

export async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

export function referencedPaths(manifest) {
  return [
    ...(manifest.esmodules ?? []),
    ...(manifest.styles ?? []),
    ...(manifest.languages ?? []).map(({ path: languagePath }) => languagePath),
    ...(manifest.packs ?? []).map(({ path: packPath }) => packPath),
  ];
}

export function releaseDirectory(
  version,
  distribution = COLLABORATOR_DISTRIBUTION,
) {
  const suffix = distribution === PUBLIC_DISTRIBUTION ? "-public" : "";
  return path.join(root, "release", `${version}${suffix}`);
}
