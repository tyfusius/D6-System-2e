import {
  D6_CAMPAIGN_PACKAGE_CONTRACT_VERSION,
  D6_SYSTEM_2E_API_VERSION,
  type D6CampaignPackageDiagnosticV1,
  type D6CampaignPackageManifestV1,
  type D6CampaignPackageResolutionV1,
  type D6ResolvedCampaignPackageV1,
  type D6System2eCampaignPackageRegistry,
} from "@d6-system-2e/core";

const ID_PATTERN = /^[a-z][a-z0-9-]*$/u;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;

interface Registration {
  readonly manifest: D6ResolvedCampaignPackageV1;
  readonly ownerId: string;
}

const registrations = new Map<string, Registration>();
const listeners = new Set<() => void>();

function notifyChanged(): void {
  for (const listener of listeners) listener();
}

export function observeCampaignPackageRegistry(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function ids(
  values: readonly string[] | undefined,
  field: string,
): readonly string[] {
  const normalized = [...new Set((values ?? []).map((value) => value.trim()))];
  for (const id of normalized) {
    if (!ID_PATTERN.test(id)) {
      throw new TypeError(
        `Campaign package ${field} contains invalid id "${id}".`,
      );
    }
  }
  return Object.freeze(normalized.sort());
}

function normalize(
  ownerId: string,
  manifest: D6CampaignPackageManifestV1,
): D6ResolvedCampaignPackageV1 {
  const contractVersion = (manifest as { readonly contractVersion?: unknown })
    .contractVersion;
  if (!ID_PATTERN.test(ownerId))
    throw new TypeError(`Campaign package owner id "${ownerId}" is invalid.`);
  if (contractVersion !== D6_CAMPAIGN_PACKAGE_CONTRACT_VERSION) {
    throw new TypeError(
      `Campaign package contract version must be ${D6_CAMPAIGN_PACKAGE_CONTRACT_VERSION}.`,
    );
  }
  if (!ID_PATTERN.test(manifest.id))
    throw new TypeError(`Campaign package id "${manifest.id}" is invalid.`);
  if (manifest.id !== ownerId)
    throw new TypeError(
      "A campaign package id must match its registering Foundry module id.",
    );
  if (!manifest.label.trim())
    throw new TypeError("A campaign package label is required.");
  if (!VERSION_PATTERN.test(manifest.version))
    throw new TypeError("A campaign package must provide a semantic version.");
  if (
    !Number.isInteger(manifest.apiCompatibility.minimum) ||
    !Number.isInteger(manifest.apiCompatibility.maximum) ||
    manifest.apiCompatibility.minimum < 1 ||
    manifest.apiCompatibility.maximum < manifest.apiCompatibility.minimum
  ) {
    throw new TypeError(
      "Campaign package API compatibility must be a valid inclusive version range.",
    );
  }
  const genreId = manifest.genreId?.trim();
  if (manifest.kind === "genre" && (!genreId || !ID_PATTERN.test(genreId))) {
    throw new TypeError("A genre package must provide a valid genreId.");
  }
  if (manifest.kind === "companion" && genreId) {
    throw new TypeError(
      "A companion declares compatibleGenreIds instead of genreId.",
    );
  }
  const compatibleGenreIds = ids(
    manifest.compatibleGenreIds,
    "compatibleGenreIds",
  );
  if (manifest.kind === "companion" && compatibleGenreIds.length === 0) {
    throw new TypeError(
      "A companion must declare at least one compatible genre.",
    );
  }
  return Object.freeze({
    apiCompatibility: Object.freeze({ ...manifest.apiCompatibility }),
    compatibleGenreIds,
    conflicts: ids(manifest.conflicts, "conflicts"),
    contractVersion,
    ...(genreId ? { genreId } : {}),
    id: manifest.id,
    kind: manifest.kind,
    label: manifest.label.trim(),
    ownerId,
    rulesFamily: manifest.rulesFamily,
    ...(manifest.sources
      ? {
          sources: Object.freeze(
            manifest.sources.map((source) =>
              Object.freeze({
                book: source.book.trim(),
                pages: source.pages.trim(),
              }),
            ),
          ),
        }
      : {}),
    version: manifest.version,
  });
}

function diagnostic(
  code: D6CampaignPackageDiagnosticV1["code"],
  packageId: string,
  message: string,
): D6CampaignPackageDiagnosticV1 {
  return Object.freeze({ code, message, packageId });
}

function isApiCompatible(manifest: D6ResolvedCampaignPackageV1): boolean {
  return (
    manifest.apiCompatibility.minimum <= D6_SYSTEM_2E_API_VERSION &&
    manifest.apiCompatibility.maximum >= D6_SYSTEM_2E_API_VERSION
  );
}

function resolve(selection: {
  readonly companionId?: string;
  readonly genreId?: string;
}): D6CampaignPackageResolutionV1 {
  const requestedGenreId = selection.genreId?.trim() ?? "";
  const requestedCompanionId = selection.companionId?.trim() ?? "";
  const diagnostics: D6CampaignPackageDiagnosticV1[] = [];
  let genre = requestedGenreId
    ? registrations.get(requestedGenreId)?.manifest
    : undefined;
  let companion = requestedCompanionId
    ? registrations.get(requestedCompanionId)?.manifest
    : undefined;

  if (requestedGenreId && !genre)
    diagnostics.push(
      diagnostic(
        "unavailable",
        requestedGenreId,
        `Selected genre package "${requestedGenreId}" is not installed and enabled.`,
      ),
    );
  if (genre?.kind !== "genre") {
    if (genre)
      diagnostics.push(
        diagnostic(
          "kind-mismatch",
          genre.id,
          `Selected package "${genre.id}" is not a genre package.`,
        ),
      );
    genre = undefined;
  }
  if (requestedCompanionId && !companion)
    diagnostics.push(
      diagnostic(
        "unavailable",
        requestedCompanionId,
        `Selected companion "${requestedCompanionId}" is not installed and enabled.`,
      ),
    );
  if (companion?.kind !== "companion") {
    if (companion)
      diagnostics.push(
        diagnostic(
          "kind-mismatch",
          companion.id,
          `Selected package "${companion.id}" is not a companion.`,
        ),
      );
    companion = undefined;
  }
  for (const manifest of [genre, companion]) {
    if (manifest && !isApiCompatible(manifest)) {
      diagnostics.push(
        diagnostic(
          "incompatible-api",
          manifest.id,
          `Package "${manifest.id}" does not support system API version ${D6_SYSTEM_2E_API_VERSION}.`,
        ),
      );
    }
  }
  if (companion && !genre)
    diagnostics.push(
      diagnostic(
        "companion-without-genre",
        companion.id,
        `Companion "${companion.id}" requires an active genre package.`,
      ),
    );
  if (genre && companion) {
    if (
      !genre.genreId ||
      !companion.compatibleGenreIds?.includes(genre.genreId) ||
      genre.rulesFamily !== companion.rulesFamily
    ) {
      diagnostics.push(
        diagnostic(
          "incompatible-companion",
          companion.id,
          `Companion "${companion.id}" is not compatible with genre "${genre.genreId ?? genre.id}".`,
        ),
      );
    }
    if (
      genre.conflicts?.includes(companion.id) ||
      companion.conflicts?.includes(genre.id)
    ) {
      diagnostics.push(
        diagnostic(
          "conflict",
          companion.id,
          `Packages "${genre.id}" and "${companion.id}" declare a conflict.`,
        ),
      );
    }
  }
  return Object.freeze({
    ...(companion ? { companion } : {}),
    diagnostics: Object.freeze(diagnostics),
    ...(genre ? { genre } : {}),
    requestedCompanionId,
    requestedGenreId,
    valid: diagnostics.length === 0,
  });
}

export const campaignPackageRegistry: D6System2eCampaignPackageRegistry =
  Object.freeze({
    current: () =>
      Object.freeze(
        Array.from(registrations.values(), ({ manifest }) => manifest).sort(
          (left, right) => left.label.localeCompare(right.label),
        ),
      ),
    register: (ownerId: string, manifest: D6CampaignPackageManifestV1) => {
      const normalized = normalize(ownerId, manifest);
      const existing = registrations.get(normalized.id);
      if (existing && existing.ownerId !== ownerId)
        throw new Error(
          `Campaign package "${normalized.id}" is already registered by "${existing.ownerId}".`,
        );
      registrations.set(normalized.id, { manifest: normalized, ownerId });
      notifyChanged();
    },
    resolve,
    unregisterOwner: (ownerId: string) => {
      let changed = false;
      for (const [id, registration] of registrations) {
        if (registration.ownerId === ownerId) {
          registrations.delete(id);
          changed = true;
        }
      }
      if (changed) notifyChanged();
    },
  });

export function resetCampaignPackageRegistryForTests(): void {
  registrations.clear();
  listeners.clear();
}
