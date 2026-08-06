import {
  D6_FIRST_EDITION_GENRE_PROFILE_CONTRACT_VERSION,
  type D6FirstEditionGenreProfileV1,
  type D6ResolvedFirstEditionGenreProfileV1,
  type D6System2eFirstEditionGenreProfileRegistry,
} from "@d6-system-2e/core";

const ID_PATTERN = /^[a-z][a-z0-9-]*$/u;
const profiles = new Map<string, D6ResolvedFirstEditionGenreProfileV1>();

function requiredId(value: string, field: string): string {
  const normalized = value.trim();
  if (!ID_PATTERN.test(normalized)) throw new TypeError(`${field} is invalid.`);
  return normalized;
}

function normalize(
  ownerId: string,
  source: D6FirstEditionGenreProfileV1,
): D6ResolvedFirstEditionGenreProfileV1 {
  const normalizedOwnerId = requiredId(ownerId, "Genre profile owner id");
  const id = requiredId(source.id, "Genre profile id");
  const genreId = requiredId(source.genreId, "Genre id");
  const version: unknown = source.version;
  if (version !== D6_FIRST_EDITION_GENRE_PROFILE_CONTRACT_VERSION) {
    throw new TypeError(`Genre profile ${id} uses an unsupported version.`);
  }
  if (id !== genreId || ownerId !== id) {
    throw new TypeError(
      "A genre profile id, genre id, and owner id must match.",
    );
  }
  const attributes = source.attributes.map((attribute) =>
    Object.freeze({
      id: requiredId(attribute.id, "Attribute id"),
      label: attribute.label.trim(),
    }),
  );
  const attributeIds = new Set(
    attributes.map(({ id: attributeId }) => attributeId),
  );
  if (
    attributeIds.size !== attributes.length ||
    attributes.some(({ label }) => !label)
  ) {
    throw new TypeError(`Genre profile ${id} has invalid Attributes.`);
  }
  for (const role of [
    source.roles.initiative,
    source.roles.knowledge,
    source.roles.strength,
  ]) {
    if (!attributeIds.has(role))
      throw new TypeError(`Genre profile ${id} has an invalid Attribute role.`);
  }
  const skills = source.skills.map((skill) => {
    if (!attributeIds.has(skill.attributeId)) {
      throw new TypeError(`Skill ${skill.key} uses an inactive Attribute.`);
    }
    return Object.freeze({
      attributeId: skill.attributeId,
      key: requiredId(skill.key, "Skill key"),
      name: skill.name.trim(),
      source: Object.freeze({
        book: skill.source.book.trim(),
        page: skill.source.page,
      }),
    });
  });
  if (new Set(skills.map(({ key }) => key)).size !== skills.length) {
    throw new TypeError(`Genre profile ${id} has duplicate Skill keys.`);
  }
  if (
    skills.some(
      ({ name, source }) =>
        !name ||
        !source.book ||
        !Number.isSafeInteger(source.page) ||
        source.page < 1,
    ) ||
    !Number.isSafeInteger(source.attributeBudgetScore) ||
    source.attributeBudgetScore < 1 ||
    !Number.isSafeInteger(source.skillBudgetScore) ||
    source.skillBudgetScore < 0
  ) {
    throw new TypeError(`Genre profile ${id} has invalid creation data.`);
  }
  return Object.freeze({
    attributeBudgetScore: source.attributeBudgetScore,
    attributes: Object.freeze(attributes),
    genreId,
    id,
    label: source.label.trim(),
    ownerId: normalizedOwnerId,
    roles: Object.freeze({ ...source.roles }),
    skillBudgetScore: source.skillBudgetScore,
    skills: Object.freeze(skills),
    version: D6_FIRST_EDITION_GENRE_PROFILE_CONTRACT_VERSION,
  });
}

export const firstEditionGenreProfileRegistry: D6System2eFirstEditionGenreProfileRegistry =
  Object.freeze({
    current: () =>
      Object.freeze(
        [...profiles.values()].sort((a, b) => a.label.localeCompare(b.label)),
      ),
    register: (ownerId: string, profile: D6FirstEditionGenreProfileV1) => {
      const normalized = normalize(ownerId, profile);
      profiles.set(normalized.id, normalized);
    },
    unregisterOwner: (ownerId: string) => {
      for (const [id, profile] of profiles)
        if (profile.ownerId === ownerId) profiles.delete(id);
    },
  });

export function registeredFirstEditionGenreProfile(
  id: string,
): D6ResolvedFirstEditionGenreProfileV1 | undefined {
  return profiles.get(id);
}
