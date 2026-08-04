import {
  D6_CONTENT_PACKAGE_CONTRACT_VERSION,
  type D6ContentPackageManifestV1,
  type D6ResolvedContentPackageV1,
  type D6System2eContentPackageRegistry,
} from "@d6-system-2e/core";

const ID_PATTERN = /^[a-z][a-z0-9-]*$/u;
const MECHANIC_ID_PATTERN = /^[a-z][a-z0-9.-]*$/u;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
const registrations = new Map<string, D6ResolvedContentPackageV1>();
const listeners = new Set<() => void>();

function notifyChanged(): void {
  for (const listener of listeners) listener();
}

export function observeContentPackageRegistry(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function normalize(
  ownerId: string,
  manifest: D6ContentPackageManifestV1,
): D6ResolvedContentPackageV1 {
  if (!ID_PATTERN.test(ownerId) || manifest.id !== ownerId) {
    throw new TypeError(
      "A content package id must match its registering Foundry module id.",
    );
  }
  const contractVersion: unknown = manifest.contractVersion;
  if (contractVersion !== D6_CONTENT_PACKAGE_CONTRACT_VERSION) {
    throw new TypeError(
      `Content package contract version must be ${D6_CONTENT_PACKAGE_CONTRACT_VERSION}.`,
    );
  }
  if (!manifest.label.trim() || !VERSION_PATTERN.test(manifest.version)) {
    throw new TypeError(
      "A content package requires a label and semantic version.",
    );
  }
  const mechanicIds = [...new Set(manifest.mechanicIds.map((id) => id.trim()))];
  if (mechanicIds.some((id) => !MECHANIC_ID_PATTERN.test(id))) {
    throw new TypeError(
      "Content package mechanicIds must be stable lowercase IDs.",
    );
  }
  return Object.freeze({
    ...manifest,
    label: manifest.label.trim(),
    mechanicIds: Object.freeze(mechanicIds.sort()),
    ownerId,
  });
}

export const contentPackageRegistry: D6System2eContentPackageRegistry =
  Object.freeze({
    current: () =>
      Object.freeze(
        [...registrations.values()].sort((left, right) =>
          left.label.localeCompare(right.label),
        ),
      ),
    register: (ownerId: string, manifest: D6ContentPackageManifestV1) => {
      const normalized = normalize(ownerId, manifest);
      registrations.set(normalized.id, normalized);
      notifyChanged();
    },
    unregisterOwner: (ownerId: string) => {
      if (registrations.delete(ownerId)) notifyChanged();
    },
  });

export function resetContentPackageRegistryForTests(): void {
  registrations.clear();
  listeners.clear();
}
