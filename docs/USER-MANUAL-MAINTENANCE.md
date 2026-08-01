# User manual maintenance

`docs/USER-MANUAL.md` is the authoritative public user-manual source. The same
file is rendered on GitHub and compiled into the
`d6-system-2e.user-manual` Foundry Journal compendium.

This policy is also enforced by the repository instructions: every
user-facing change or new feature updates the manual in the same change, and
visible UI changes refresh the affected screenshots before completion.

## Required workflow

Every user-facing feature pass must:

1. update the affected manual section;
2. add or refresh a screenshot when the visible workflow changed;
3. retain concise book/page references for rules-owned behavior;
4. label unavailable automation as planned, deferred, or blocked;
5. run `npm run manual:build` when the source changes; and
6. run `npm run check` before the milestone is reported complete.

Screenshots live in `assets/manual/`. Use dedicated development-world fixtures,
exclude private campaign information, capture the actual Foundry v14 UI, and
restore any temporary settings or Actor modes afterward.

## Supported Markdown

The Journal compiler intentionally accepts the conservative subset used by the
manual: headings, paragraphs, ordered and unordered lists, blockquotes, images,
links, strong emphasis, inline code, and horizontal rules. Extending the syntax
requires deterministic compiler and verification coverage.

The compiler splits the Markdown at level-two headings. The introduction becomes
the first Journal page and every `##` chapter becomes one additional page.
Image paths beginning with `../assets/` are rewritten to installed system paths
inside Foundry.

## Coverage ledger

| Area                           | Manual section | Screenshot | Edition/profile coverage |
| ------------------------------ | -------------- | ---------- | ------------------------ |
| Campaign selection             | 1, 2, 9        | Yes        | 2e, OpenD6, custom       |
| Character modes                | 3              | Yes        | Both                     |
| Character creation             | 4              | Yes        | 2e, Pips, templates      |
| Rolls and chat                 | 5              | Yes        | 2e and OpenD6 strategies |
| Advancement                    | 6              | Yes        | 2e XP, OpenD6 CP         |
| Items                          | 7              | Yes        | Shared/profile-filtered  |
| Combat and Conditions          | 8              | Yes        | 2e; OpenD6 gaps explicit |
| Environmental hazards          | 8              | Yes        | 2e optional component    |
| Game settings                  | 9              | Yes        | Both                     |
| Compendiums                    | 10             | Planned    | Both                     |
| Quickbars and roll requests    | 11             | Yes        | Shared contracts         |
| Permissions/API/integrations   | 11             | No         | Shared contracts         |
| Planned and blocked boundaries | 12             | No         | Both                     |
