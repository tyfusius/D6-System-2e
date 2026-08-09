import type { D6BestiaryPreviewV1 } from "@d6-system-2e/core";

export interface BestiaryProfileFacet {
  readonly count: number;
  readonly id: string;
  readonly isActive: boolean;
  readonly label: string;
}

export function bestiaryProfileFacets(
  previews: readonly D6BestiaryPreviewV1[],
): readonly BestiaryProfileFacet[] {
  const active = previews[0]?.rulesProfile.active;
  const profiles = new Map<
    string,
    { count: number; id: string; label: string }
  >();

  if (active) profiles.set(active.id, { ...active, count: 0 });
  for (const preview of previews) {
    const seen = new Set<string>();
    for (const profile of preview.rulesProfile.options) {
      if (seen.has(profile.id)) continue;
      seen.add(profile.id);
      const current = profiles.get(profile.id);
      profiles.set(profile.id, {
        ...profile,
        count: (current?.count ?? 0) + 1,
      });
    }
  }

  return Object.freeze(
    [...profiles.values()]
      .sort((left, right) => {
        if (left.id === active?.id) return -1;
        if (right.id === active?.id) return 1;
        return left.label.localeCompare(right.label);
      })
      .map((profile) =>
        Object.freeze({
          ...profile,
          isActive: profile.id === active?.id,
        }),
      ),
  );
}
