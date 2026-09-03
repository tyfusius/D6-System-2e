import {
  chmod,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  inspectRuntimeCompendiumPermissions,
  runtimeCompendiumRegistryProbe,
} from "./verify-runtime-compendium-permissions.mjs";

const fixtures = [];
const execFileAsync = promisify(execFile);

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "d6e2-pack-permissions-"));
  fixtures.push(root);
  await mkdir(path.join(root, "packs", "user-manual"), { recursive: true });
  await writeFile(
    path.join(root, "packs", "user-manual", "CURRENT"),
    "MANIFEST-000001\n",
  );
  await mkdir(path.join(root, "packages", "provider", "packs", "actors"), {
    recursive: true,
  });
  await writeFile(
    path.join(root, "packages", "provider", "packs", "actors", "CURRENT"),
    "MANIFEST-000001\n",
  );
  await writeFile(
    path.join(root, "system.json"),
    JSON.stringify({
      id: "d6-system-2e",
      packs: [
        {
          name: "user-manual",
          path: "packs/user-manual",
          type: "JournalEntry",
        },
      ],
    }),
  );
  await writeFile(
    path.join(root, "packages", "provider", "module.json"),
    JSON.stringify({
      id: "provider",
      packs: [{ name: "actors", path: "packs/actors", type: "Actor" }],
    }),
  );
  return root;
}

afterEach(async () => {
  await Promise.all(
    fixtures
      .splice(0)
      .map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe("runtime compendium permission verification", () => {
  it("enumerates every system and bundled-module pack and accepts owner-writable LevelDB content", async () => {
    const root = await createFixture();
    await expect(
      inspectRuntimeCompendiumPermissions(root),
    ).resolves.toMatchObject({
      issues: [],
      packs: [
        { collection: "d6-system-2e.user-manual" },
        { collection: "provider.actors" },
      ],
    });
  });

  it("fails closed when blanket snapshot hardening removes LevelDB write access", async () => {
    const root = await createFixture();
    const canonicalRoot = await realpath(root);
    const pack = path.join(
      canonicalRoot,
      "packages",
      "provider",
      "packs",
      "actors",
    );
    const current = path.join(pack, "CURRENT");
    await chmod(current, 0o444);
    await chmod(pack, 0o555);

    try {
      const report = await inspectRuntimeCompendiumPermissions(root);
      expect(report.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            collection: "provider.actors",
            kind: "not-writable",
            path: current,
          }),
          expect.objectContaining({
            collection: "provider.actors",
            kind: "not-writable",
            path: pack,
          }),
        ]),
      );
    } finally {
      await chmod(pack, 0o755);
      await chmod(current, 0o644);
    }
  });

  it("rejects missing packs and manifest paths that escape their owner", async () => {
    const root = await createFixture();
    await writeFile(
      path.join(root, "packages", "provider", "module.json"),
      JSON.stringify({
        id: "provider",
        packs: [
          { name: "missing", path: "packs/missing", type: "Actor" },
          { name: "escape", path: "../../packs/user-manual", type: "Actor" },
        ],
      }),
    );

    const report = await inspectRuntimeCompendiumPermissions(root);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collection: "provider.escape",
          kind: "unsafe-path",
        }),
        expect.objectContaining({
          collection: "provider.missing",
          kind: "missing",
        }),
      ]),
    );
  });

  it("provides a read-only Foundry probe for declared collection recognition and opening", () => {
    const source = runtimeCompendiumRegistryProbe([
      {
        collection: "d6-system-2e.user-manual",
        ownerId: "d6-system-2e",
        source: "system",
      },
      {
        collection: "provider.actors",
        ownerId: "provider",
        source: "bundled-module",
      },
    ]);
    expect(source).toContain("game.modules.get(pack.ownerId)?.active === true");
    expect(source).toContain("game.packs.get(collection)");
    expect(source).toContain("await pack.getIndex()");
    expect(source).toContain("missingCollections");
    expect(source).toContain("failedCollections");
    expect(source).not.toMatch(/create|update|delete|setFlag/u);
  });

  it("runs the CLI when invoked through the mounted system symlink", async () => {
    const root = await createFixture();
    const mountRoot = await mkdtemp(
      path.join(os.tmpdir(), "d6e2-pack-permissions-mount-"),
    );
    fixtures.push(mountRoot);
    const mountedScript = path.join(
      mountRoot,
      "verify-runtime-compendium-permissions.mjs",
    );
    await symlink(
      fileURLToPath(
        new URL("./verify-runtime-compendium-permissions.mjs", import.meta.url),
      ),
      mountedScript,
    );

    const result = await execFileAsync(process.execPath, [mountedScript, root]);
    expect(JSON.parse(result.stdout)).toMatchObject({
      issues: [],
      packs: [
        { collection: "d6-system-2e.user-manual" },
        { collection: "provider.actors" },
      ],
    });
  });

  it("remains side-effect free when imported as a module", async () => {
    const scriptPath = fileURLToPath(
      new URL("./verify-runtime-compendium-permissions.mjs", import.meta.url),
    );
    const result = await execFileAsync(process.execPath, [
      "--input-type=module",
      "--eval",
      `await import(${JSON.stringify(pathToFileURL(scriptPath).href)});`,
    ]);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });
});
