import { readFileSync, writeFileSync } from "node:fs";
import Handlebars from "handlebars";
import { parseHTML } from "linkedom";
import * as rollService from "./roll-service";
import { bindD6EmbeddedRollActions } from "./chat-card-actions";
import { afterEach, expect, it, vi } from "vitest";
import { resolveD6Roll } from "@d6-system-2e/core";
import { renderD6RollResult } from "./roll-service";
vi.mock("../../settings/roll-outcome", () => ({
  currentMetaCurrencyRuntimeStrategy: () => ({
    failedRollReroll: true,
    heroPointStrategy: "heroic",
  }),
  currentRetryRuntimeStrategy: () => ({ followUp: "doubling-down" }),
}));
afterEach(() => vi.unstubAllGlobals());
it("renders the ordinary failed result and its retry controls without creating a ChatMessage", async () => {
  const labels = JSON.parse(readFileSync("lang/en.json", "utf8")) as Record<
    string,
    string
  >;
  const h = Handlebars.create();
  h.registerHelper("eq", (a: unknown, b: unknown) => a === b);
  h.registerHelper("localize", (key: string) => labels[key] ?? key);
  const compiled = h.compile(
    readFileSync("templates/roll/chat-card.hbs", "utf8"),
  );
  const create = vi.fn();
  vi.stubGlobal("ChatMessage", { create });
  vi.stubGlobal("game", {
    user: { id: "gm", isGM: true },
    settings: { get: () => undefined },
    i18n: {
      localize: (key: string) => labels[key] ?? key,
      format: (key: string) => labels[key] ?? key,
    },
  });
  vi.stubGlobal("foundry", {
    applications: {
      handlebars: {
        renderTemplate: (_path: string, vm: unknown) =>
          Promise.resolve(compiled(vm)),
      },
    },
  });
  const actor = {
    id: "worker",
    name: "Long named participant testing a coordinated Skill",
    img: "icons/svg/mystery-man.svg",
    isOwner: true,
    update: vi.fn(),
    system: { resources: { heroPoints: { value: 3 } } },
  } as unknown as FoundryActorDocument;
  const result = resolveD6Roll({
    profileId: "second-edition",
    successEvaluator: "second-edition-strict",
    wildPolicy: "second-edition",
    baseFaces: [2],
    wildFaces: [3],
    request: {
      contractVersion: 2,
      kind: "skill",
      label: "Long named coordinated Skill task",
      score: 6,
      resultModifier: 0,
      heroPointUse: "none",
      rollMode: "publicroll",
      difficulty: 12,
      source: {
        actorId: actor.id,
        actorName: actor.name,
        itemId: "skill",
        attributeId: "perception",
      },
    },
  });
  Object.assign(game, { actors: { contents: [actor] } });
  const content = await renderD6RollResult(actor, result);
  expect(content).toContain('data-action="heroPointReroll"');
  expect(content).toContain('data-action="doubleDown"');
  expect(content).toContain("Long named coordinated Skill task");
  expect(create).not.toHaveBeenCalled();
  const output = process.env.D6_COMBINED_RENDER_FIXTURE;
  if (
    output?.startsWith(
      "/Volumes/Store/FoundryVTT/Instances/development/.agent-runtime/",
    )
  )
    writeFileSync(output, content);
  const { document } = parseHTML(`<section>${content}</section>`);
  const html = document.querySelector("section");
  if (!html) throw new Error("Missing embedded card");
  const ports = {
    claim: vi.fn().mockResolvedValue(true),
    release: vi.fn().mockResolvedValue(undefined),
    retryReward: vi.fn().mockResolvedValue(undefined),
  };
  const reroll = vi
    .spyOn(rollService, "rerollFailedRoll")
    .mockResolvedValue(result);
  bindD6EmbeddedRollActions(
    { id: "combined-root" } as FoundryChatMessageDocument,
    html,
    result,
    false,
    ports,
  );
  html
    .querySelector<HTMLButtonElement>('[data-action="heroPointReroll"]')
    ?.click();
  await vi.waitFor(() => expect(reroll).toHaveBeenCalledWith(actor, result));
  expect(ports.claim).toHaveBeenCalledTimes(1);
  expect(ports.release).not.toHaveBeenCalled();
  expect(
    html.querySelector<HTMLButtonElement>('[data-action="doubleDown"]')
      ?.disabled,
  ).toBe(true);
  for (const used of [true, false]) {
    // Restored stored HTML starts from its original button state. A recorded
    // claim or missing ownership must disable both before the user can act.
    Object.assign(actor, { isOwner: used });
    const restored = parseHTML(
      `<section>${content}</section>`,
    ).document.querySelector("section");
    if (!restored) throw new Error("Missing restored card");
    bindD6EmbeddedRollActions(
      { id: "combined-root" } as FoundryChatMessageDocument,
      restored,
      result,
      used,
      ports,
    );
    for (const button of Array.from(
      restored.querySelectorAll<HTMLButtonElement>(
        '[data-action="heroPointReroll"], [data-action="doubleDown"]',
      ),
    )) {
      expect(button.disabled).toBe(true);
      button.click();
    }
  }
  expect(ports.claim).toHaveBeenCalledTimes(1);
  expect(reroll).toHaveBeenCalledTimes(1);
  reroll.mockRestore();
});
