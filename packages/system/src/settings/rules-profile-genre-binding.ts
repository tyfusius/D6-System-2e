import type {
  D6FirstEditionGenreProfileReferenceV1,
  D6ResolvedFirstEditionGenreProfileV1,
  D6RulesProfileV5,
  D6SettingProfileV5,
} from "@d6-system-2e/core";
import { registeredFirstEditionGenreProfile } from "../registries/first-edition-genre-profiles";

/** Ordered optional extension: V0 absence remains unbound; V1 is normalized
 * idempotently. Malformed/future explicit versions are never erased or reset. */
export function normalizeFirstEditionGenreProfileReference(
  value: unknown,
): D6FirstEditionGenreProfileReferenceV1 | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Invalid First Edition genre profile reference.");
  const source = value as Record<string, unknown>;
  if (source.version !== 1)
    throw new TypeError(
      "Unsupported First Edition genre profile reference version.",
    );
  if (typeof source.id !== "string" || !/^[a-z][a-z0-9-]*$/u.test(source.id))
    throw new TypeError("Invalid First Edition genre profile reference id.");
  return Object.freeze({ version: 1, id: source.id });
}

export function boundFirstEditionGenreProfile(
  profile: D6RulesProfileV5,
): D6ResolvedFirstEditionGenreProfileV1 | undefined {
  const reference = normalizeFirstEditionGenreProfileReference(
    profile.firstEditionGenreProfile,
  );
  if (!reference) return undefined;
  if (profile.strategies.attributes !== "open-d6.attributes.six-attribute")
    throw new TypeError(
      "A First Edition genre profile binding requires the OpenD6 genre Attribute strategy.",
    );
  const genre = registeredFirstEditionGenreProfile(reference.id);
  if (!genre)
    throw new RangeError(
      `Required First Edition genre profile is unavailable: ${reference.id}`,
    );
  return genre;
}

export function validateBoundGenreSetting(
  genre: D6ResolvedFirstEditionGenreProfileV1,
  setting: D6SettingProfileV5,
): void {
  const vocabulary = new Set(setting.attributes.map((a) => a.id));
  const missing = genre.attributes.filter((a) => !vocabulary.has(a.id));
  if (missing.length)
    throw new RangeError(
      `Setting Profile lacks bound Attributes: ${missing.map((a) => a.id).join(", ")}`,
    );
  const active = new Set(genre.attributes.map((a) => a.id));
  const invalid = setting.skills.filter(
    (skill) => !active.has(skill.attributeId),
  );
  if (invalid.length)
    throw new RangeError(
      `Setting Skills use Attributes outside the bound genre: ${invalid.map((skill) => skill.key).join(", ")}`,
    );
}
