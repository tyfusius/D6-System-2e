interface BestiaryFilterEntry {
  readonly element: HTMLElement;
  readonly profileIds: readonly string[];
  readonly text: string;
}

/** Read rendered search text once, before any filtering changes visibility. */
export function indexBestiaryEntries(root: HTMLElement): BestiaryFilterEntry[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(".d6e2-bestiary-entry"),
    (element) => ({
      element,
      profileIds: (element.dataset.profileIds ?? "").split(" "),
      text: element.innerText.toLocaleLowerCase(),
    }),
  );
}

export function filterBestiaryEntries(
  entries: readonly BestiaryFilterEntry[],
  query: string,
  profileId: string,
): number {
  const search = query.trim().toLocaleLowerCase();
  let visibleCount = 0;
  for (const entry of entries) {
    const visible =
      (profileId === "*" || entry.profileIds.includes(profileId)) &&
      (!search || entry.text.includes(search));
    if (entry.element.hidden === visible) entry.element.hidden = !visible;
    if (visible) visibleCount += 1;
  }
  return visibleCount;
}
