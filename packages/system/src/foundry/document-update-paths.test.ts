import { expect, it } from "vitest";
import { documentUpdateTouches } from "./document-update-paths";
it("filters unrelated changes while retaining flattened, nested, deletion and replacement updates", () => {
  const paths = [
    "system.profile.currencyWallet",
    "flags.d6-system-2e.destinyDamage",
    "ownership",
  ];
  for (const changes of [
    { "system.health.condition": "wounded" },
    { system: { health: { condition: "wounded" } } },
    { "system.profile.biography": "text" },
  ])
    expect(documentUpdateTouches(changes, paths)).toBe(false);
  for (const changes of [
    { "system.profile.currencyWallet.operationReceipts.x": {} },
    { system: { profile: { currencyWallet: {} } } },
    { "system.profile.-=currencyWallet": null },
    { flags: { "d6-system-2e": { "-=destinyDamage": null } } },
    { system: null },
    { system: {} },
    { ownership: { user: 3 } },
    undefined,
  ])
    expect(documentUpdateTouches(changes, paths)).toBe(true);
});
