import { parseHTML } from "linkedom";
import { expect, it, vi } from "vitest";
import {
  filterBestiaryEntries,
  indexBestiaryEntries,
} from "./bestiary-browser-filter";

it("searches rendered text without remeasuring filtered entries on each keystroke", () => {
  const { document } = parseHTML(`<html><body>
    <article class="d6e2-bestiary-entry" data-profile-ids="fantasy adventure">Wolf</article>
    <article class="d6e2-bestiary-entry" data-profile-ids="space">Droid</article>
  </body></html>`);
  const elements = Array.from(
    document.querySelectorAll<HTMLElement>("article"),
  );
  const reads = elements.map((element) =>
    vi.spyOn(element, "innerText", "get"),
  );
  const entries = indexBestiaryEntries(document.body);
  expect(filterBestiaryEntries(entries, " WOLF ", "*")).toBe(1);
  expect(elements.map((element) => element.hidden)).toEqual([false, true]);
  expect(filterBestiaryEntries(entries, "droid", "fantasy")).toBe(0);
  expect(filterBestiaryEntries(entries, "droid", "space")).toBe(1);
  expect(elements.map((element) => element.hidden)).toEqual([true, false]);
  expect(filterBestiaryEntries(entries, "", "*")).toBe(2);
  expect(elements.map((element) => element.hidden)).toEqual([false, false]);
  for (const read of reads) expect(read).toHaveBeenCalledTimes(1);
});

it("refreshes search text and profiles for newly rendered catalog content", () => {
  const { document } = parseHTML(`<html><body>
    <article class="d6e2-bestiary-entry" data-profile-ids="fantasy">Wolf</article>
  </body></html>`);
  let entries = indexBestiaryEntries(document.body);
  expect(filterBestiaryEntries(entries, "wolf", "fantasy")).toBe(1);
  document.body.innerHTML =
    '<article class="d6e2-bestiary-entry" data-profile-ids="space">Robot</article>';
  entries = indexBestiaryEntries(document.body);
  expect(filterBestiaryEntries(entries, "wolf", "*")).toBe(0);
  expect(filterBestiaryEntries(entries, "robot", "fantasy")).toBe(0);
  expect(filterBestiaryEntries(entries, "robot", "space")).toBe(1);
});
