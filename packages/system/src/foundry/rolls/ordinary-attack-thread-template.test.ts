import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";

const template = readFileSync(
  new URL(
    "../../../../../templates/chat/ordinary-attack-thread.hbs",
    import.meta.url,
  ),
  "utf8",
);
const styles = readFileSync(
  new URL("../../../../../styles/d6-system-2e.css", import.meta.url),
  "utf8",
);
const service = readFileSync(
  new URL("./ordinary-attack-thread.ts", import.meta.url),
  "utf8",
);

describe("ordinary attack initiating-root presentation", () => {
  it("renders comparison, next step, target identity, and semantic final Health", () => {
    const handlebars = Handlebars.create();
    handlebars.registerHelper(
      "localize",
      (key: string, options: Handlebars.HelperOptions) => {
        const hash = options.hash as Record<string, unknown>;
        const value = hash.health ?? hash.actor ?? hash.total;
        return typeof value === "string" || typeof value === "number"
          ? String(value)
          : key;
      },
    );
    const html = handlebars.compile(template)({
      actorName: "Attacker",
      attackTotal: 17,
      autofireDamageModifierLabel: "2D",
      damage: { result: { total: 12 } },
      damageKindLabel: "Physical",
      defenseLabel: "Dodge",
      defenseTotal: 11,
      difficulty: { source: "calculated", value: 11 },
      difficultyLabel: "Dodge",
      durationLabel: "Unconscious for 4 minutes",
      hasResistance: true,
      healthLabel: "Wounded",
      healthTone: "wounded",
      resistanceStageLabel: "Health applied",
      restrictionLabel: "Remaining actions are forfeited",
      target: {
        healthStateId: "wounded",
        resistanceTotal: 8,
        stage: "applied",
        targetName: "Target with a deliberately long localized name",
      },
      targetDisplayName: "Target with a deliberately long localized name",
      targetImg: "target.webp",
      weaponName: "Blaster",
    });

    expect(html).toContain("data-ordinary-attack-thread");
    expect(html).toContain("Target with a deliberately long localized name");
    expect(html).toContain('data-health-state="wounded"');
    expect(html).toContain("is-health-wounded");
    expect(html).toContain("Unconscious for 4 minutes");
    expect(html).toContain("Remaining actions are forfeited");
    expect(html).toContain("D6E2.Combat.ActiveResponsive.AutofireDamageBonus");
    expect(html).toContain("+2D");
  });

  it("renders no hidden identity or semantic outcome evidence", () => {
    const handlebars = Handlebars.create();
    handlebars.registerHelper("localize", (key: string) => key);
    const html = handlebars.compile(template)({
      actorName: "Attacker",
      attackTotal: 17,
      damage: { result: { total: 12 } },
      damageKindLabel: "Physical",
      defenseLabel: "Dodge",
      defenseTotal: 11,
      difficulty: { source: "calculated", value: 11 },
      difficultyLabel: "Dodge",
      durationLabel: "Unconscious for 4 minutes",
      hasResistance: true,
      healthLabel: "Wounded",
      healthTone: "wounded",
      resistanceStageLabel: "Health applied",
      restrictionLabel: "Remaining actions are forfeited",
      target: {
        healthStateId: "wounded",
        resistanceTotal: 8,
        stage: "applied",
        targetName: "Secret Target",
      },
      targetDisplayName: "Hidden target",
      targetImg: "icons/svg/mystery-man.svg",
      targetRedacted: true,
      weaponName: "Blaster",
    });

    expect(html).toContain("Hidden target");
    expect(html).not.toContain("Secret Target");
    expect(html).not.toContain("Physical");
    expect(html).not.toContain("Wounded");
    expect(html).not.toContain("Health applied");
    expect(html).not.toContain("Unconscious for 4 minutes");
    expect(html).not.toContain("Remaining actions are forfeited");
    expect(html).not.toContain("data-health-state");
  });

  it("shows an immutable custom difficulty audit only when one was used", () => {
    const handlebars = Handlebars.create();
    handlebars.registerHelper("localize", (key: string) => key);
    const render = handlebars.compile(template);
    const common = {
      actorName: "Attacker",
      attackTotal: 17,
      damage: {},
      resistanceStageLabel: "Damage pending",
      target: { stage: "awaiting-damage" },
      targetDisplayName: "NPC Target",
      targetImg: "target.webp",
      weaponName: "Blaster",
    };
    const custom = render({
      ...common,
      difficulty: { source: "custom", value: 12 },
      difficultyLabel: "Custom Difficulty",
    });
    const calculated = render({
      ...common,
      difficulty: { source: "calculated", value: 15 },
      difficultyLabel: "Range Difficulty",
    });

    expect(custom).toContain('data-difficulty-source="custom"');
    expect(custom).toContain("Custom Difficulty");
    expect(custom).toContain("12");
    expect(calculated).toContain('data-difficulty-source="calculated"');
    expect(calculated).toContain("Range Difficulty");
    expect(calculated).not.toContain("Custom Difficulty");
  });

  it("keeps prompts on the root and contains narrow/200% content", () => {
    expect(template).toContain('data-prompt-id="{{damagePromptId}}"');
    expect(template).toContain('data-prompt-id="{{resistancePromptId}}"');
    expect(service).toContain("suppressChatMessage: true");
    expect(service).not.toContain("ChatMessage.create");
    expect(styles).toContain(".od6chat-ordinary-target");
    expect(styles).toContain("overflow-wrap: anywhere");
    expect(styles).toMatch(
      /\.od6chat-ordinary-thread\s*\{[^}]*container-type:\s*inline-size;/u,
    );
    expect(styles).toMatch(
      /@container \(max-width: 320px\)\s*\{[^}]*\.od6chat-ordinary-comparison\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/su,
    );
  });

  it("keeps Riposte, its continuations, and Wild Feint audit inside the original root", () => {
    const handlebars = Handlebars.create();
    handlebars.registerHelper("localize", (key: string) => key);
    const html = handlebars.compile(template)({
      actorName: "Attacker",
      attackTotal: 7,
      damage: {},
      difficulty: { source: "calculated", value: 10 },
      difficultyLabel: "Parry",
      hasWildFeint: true,
      reactions: [
        {
          actorDisplayName: "Defender",
          actorImg: "defender.webp",
          attack: { result: { total: 14 }, stage: "hit" },
          damage: { result: { total: 11 } },
          damagePromptId: "root:riposte:damage",
          hasResistance: true,
          healthLabel: "Wounded",
          healthTone: "wounded",
          id: "root:riposte",
          phase: "applied",
          phaseLabel: "Resistance resolved — Health applied",
          resistancePromptId: "root:riposte:resistance:attacker",
          showDamageAction: true,
          showReactionAction: true,
          showResistanceAction: true,
          target: {
            healthStateId: "wounded",
            resistanceTotal: 8,
          },
          weaponName: "Vibroblade",
        },
      ],
      resistanceStageLabel: "No Damage",
      target: { stage: "no-damage" },
      targetDisplayName: "Defender",
      targetImg: "defender.webp",
      weaponName: "Sword",
    });

    expect(html).toContain("D6E2.ActionThread.WildFeintRecorded");
    expect(html).toContain('data-reaction-id="root:riposte"');
    expect(html).toContain('data-prompt-id="root:riposte"');
    expect(html).toContain('data-prompt-id="root:riposte:damage"');
    expect(html).toContain('data-prompt-id="root:riposte:resistance:attacker"');
    expect(html).toContain("Resistance resolved — Health applied");
    expect(html).not.toContain("D6E2.ActionThread.DamageStage.no-damage");
    expect(service).toContain('kind: "ordinary-riposte-attack"');
    expect(service).toContain('kind: "ordinary-riposte-damage"');
    expect(service).toContain('kind: "ordinary-riposte-resistance"');
    expect(service).not.toContain("ChatMessage.create");
  });

  it("renders a hidden Riposte as one generic redacted status with no reaction disclosure", () => {
    const handlebars = Handlebars.create();
    handlebars.registerHelper("localize", (key: string) => key);
    const html = handlebars.compile(template)({
      actorName: "Attacker",
      attackTotal: 7,
      damage: {},
      difficulty: { source: "calculated", value: 10 },
      difficultyLabel: "Parry",
      reactions: [
        {
          actorDisplayName: "Hidden target",
          actorImg: "icons/svg/mystery-man.svg",
          attack: { result: { total: 14 }, stage: "hit" },
          damage: { result: { total: 11 } },
          damageKindLabel: "Physical",
          hasResistance: true,
          healthLabel: "Mortally Wounded",
          healthTone: "mortally-wounded",
          id: "root:riposte",
          phase: "redacted",
          phaseLabel: "Reaction details are private",
          redacted: true,
          showDamageAction: true,
          showReactionAction: true,
          showResistanceAction: true,
          target: {
            healthStateId: "mortally-wounded",
            resistanceTotal: 8,
          },
          weaponName: "Secret Vibroblade",
        },
      ],
      resistanceStageLabel: "No Damage",
      target: { stage: "no-damage" },
      targetDisplayName: "Hidden target",
      targetImg: "icons/svg/mystery-man.svg",
      weaponName: "Sword",
    });

    expect(html).toContain("D6E2.ActionThread.RedactedReactionTitle");
    expect(html).toContain("Reaction details are private");
    expect(html).not.toContain("Secret Vibroblade");
    expect(html).not.toContain("Physical");
    expect(html).not.toContain("Mortally Wounded");
    expect(html).not.toContain('data-health-state="mortally-wounded"');
    expect(html).not.toContain('data-prompt-id="root:riposte"');
    expect(html).not.toContain("D6E2.ActionThread.RollDamage");
    expect(html).not.toContain("D6E2.ActionThread.RollResistance");
    expect(html).not.toContain("is-hit");
  });

  it("marks an opening Riposte action busy and disables duplicate activation", () => {
    const handlebars = Handlebars.create();
    handlebars.registerHelper("localize", (key: string) => key);
    const html = handlebars.compile(template)({
      actorName: "Attacker",
      attackTotal: 7,
      damage: {},
      difficulty: { source: "calculated", value: 10 },
      difficultyLabel: "Parry",
      reactions: [
        {
          actorDisplayName: "Defender",
          actorImg: "defender.webp",
          attack: { stage: "rolling" },
          damage: {},
          id: "root:riposte",
          opening: true,
          phase: "opening",
          phaseLabel: "Opening Riposte",
          showReactionAction: true,
          target: {},
          weaponName: "Vibroblade",
        },
      ],
      resistanceStageLabel: "No Damage",
      target: { stage: "no-damage" },
      targetDisplayName: "Defender",
      targetImg: "defender.webp",
      weaponName: "Sword",
    });

    expect(html).toContain('aria-busy="true"');
    expect(html).toMatch(/<button[^>]*disabled[^>]*aria-busy="true"/u);
    expect(html).toContain("fa-spinner");
  });
});
