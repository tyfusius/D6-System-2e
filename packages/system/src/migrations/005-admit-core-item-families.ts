import type { Migration } from "@d6-system-2e/core";

/*
 * Version 5 admits the first cross-edition Item union schemas. The migration is
 * intentionally non-coercive: DataModel defaults initialize new documents, while
 * existing and imported records retain their source fields until an explicit,
 * reportable importer mapping is approved.
 */
export const admitCoreItemFamiliesMigration: Migration = Object.freeze({
  name: "Admit specialization, trait, weapon, armor, and gear Item families",
  version: 5,
});
