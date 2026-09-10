import type { D6FirstEditionGenreProfileV1 } from "@d6-system-2e/core";
import { WESTERN1876_ATTRIBUTES } from "./catalog";
import { MODULE_ID } from "./module";

/** The Setting Profile owns the described catalogue; Markdown has no page numbers. */
export const WESTERN1876_GENRE = Object.freeze({
  version: 1,
  id: MODULE_ID,
  genreId: MODULE_ID,
  label: "1876 — Current Working Attributes",
  attributeBudgetScore: 54,
  skillBudgetScore: 21,
  attributes: WESTERN1876_ATTRIBUTES,
  roles: Object.freeze({
    initiative: "perception",
    knowledge: "knowledge",
    strength: "physique",
  }),
  skills: Object.freeze([]),
}) satisfies D6FirstEditionGenreProfileV1;
