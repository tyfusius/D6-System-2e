import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";

function colorChannels(hex: string): readonly number[] {
  return [1, 3, 5].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16),
  );
}

function mixChannels(
  foreground: readonly number[],
  background: readonly number[],
  foregroundShare: number,
): readonly number[] {
  return foreground.map((channel, index) =>
    Math.round(
      channel * foregroundShare +
        (background[index] ?? 0) * (1 - foregroundShare),
    ),
  );
}

function relativeLuminance(channels: readonly number[]): number {
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return (
    (linear[0] ?? 0) * 0.2126 +
    (linear[1] ?? 0) * 0.7152 +
    (linear[2] ?? 0) * 0.0722
  );
}

function contrastRatio(
  foreground: readonly number[],
  background: readonly number[],
): number {
  const lighter = Math.max(
    relativeLuminance(foreground),
    relativeLuminance(background),
  );
  const darker = Math.min(
    relativeLuminance(foreground),
    relativeLuminance(background),
  );
  return (lighter + 0.05) / (darker + 0.05);
}

const template = Handlebars.compile(
  readFileSync("templates/chat/explosive-attack-thread.hbs", "utf8"),
);

Handlebars.registerHelper(
  "localize",
  (key: string, options: { readonly hash?: Record<string, unknown> }) => {
    const zone = options.hash?.zone;
    return key === "D6E2.Explosive.Thread.ZoneLabel"
      ? `Zone ${typeof zone === "number" || typeof zone === "string" ? zone : ""}`
      : key;
  },
);

describe("explosive root attack-card projection", () => {
  it("embeds miss deviation evidence in the root and omits it on a hit", () => {
    const miss = template({
      aimedPoint: "100, 100",
      deviation: {
        aimed: "100, 100",
        direction: "Left",
        directionFormula: "1d6",
        directionResult: 5,
        distanceFormula: "2d6",
        distanceResult: 6,
        final: "80, 100",
      },
      finalPoint: "80, 100",
      hasTargets: false,
      targets: [],
      zones: [],
    });
    const hit = template({
      aimedPoint: "100, 100",
      finalPoint: "100, 100",
      hasTargets: false,
      targets: [],
      zones: [],
    });

    expect(miss).toContain("data-explosive-deviation");
    expect(miss).toContain("1d6");
    expect(miss).toContain("2d6");
    expect(miss).toContain("Left");
    expect(hit).not.toContain("data-explosive-deviation");
  });

  it("renders one zone action and an owner-routed Resistance action in the original card", () => {
    const html = template({
      aimedPoint: "100, 100",
      finalPoint: "120, 90",
      hasTargets: true,
      targets: [
        {
          actorImg: "target.webp",
          actorName: "A Very Long Target Name That Must Remain Readable",
          damageTotal: 13,
          healthLabel: "Wounded",
          healthStateId: "wounded",
          healthTone: "wounded",
          promptId: "resistance-id",
          showAction: true,
          stage: "pending-resistance",
          stageLabel: "Resistance pending",
          resistanceLabel: "3D = 8",
          resistanceWildLabel: "Normal",
          zone: 1,
        },
      ],
      zones: [
        {
          damageLabel: "4D",
          promptId: "damage-id",
          showAction: true,
          result: { total: 13 },
          resultTotal: 13,
          stage: "pending",
          stageLabel: "Damage pending",
          zone: 1,
        },
      ],
    });

    expect(html).toContain('data-prompt-id="damage-id"');
    expect(html).toContain('data-prompt-id="resistance-id"');
    expect(html).toContain("Zone 1");
    expect(html).toContain("A Very Long Target Name That Must Remain Readable");
    expect(html.match(/od6chat-explosive-thread/g)).toHaveLength(1);
  });

  it("projects canonical, Body Point, and custom Health outcomes through the established palette", () => {
    const html = template({
      aimedPoint: "100, 100",
      finalPoint: "120, 90",
      hasTargets: true,
      targets: [
        {
          actorImg: "healthy.webp",
          actorName: "Healthy target",
          healthLabel: "Healthy",
          healthStateId: "healthy",
          healthTone: "healthy",
          stage: "applied",
          stageLabel: "Applied",
          zone: 1,
        },
        {
          actorImg: "body-points.webp",
          actorName: "Body Point target",
          healthLabel: "7/20",
          healthStateId: "wounded",
          healthTone: "wounded",
          stage: "applied",
          stageLabel: "Applied",
          zone: 2,
        },
        {
          actorImg: "custom.webp",
          actorName: "Custom model target",
          healthLabel: "Shaken",
          healthStateId: "shaken",
          healthTone: "custom",
          stage: "applied",
          stageLabel: "Applied",
          zone: 3,
        },
      ],
      zones: [],
    });
    const css = readFileSync("styles/d6-system-2e.css", "utf8");

    expect(html).toContain(
      'class="od6chat-explosive-health is-health-healthy"',
    );
    expect(html).toContain('data-health-state="healthy"');
    expect(html).toContain(
      'class="od6chat-explosive-health is-health-wounded"',
    );
    expect(html).toContain('data-health-state="wounded"');
    expect(html).toContain('class="od6chat-explosive-health is-health-custom"');
    expect(html).toContain('data-health-state="shaken"');
    expect(css).toMatch(
      /\.od6chat-explosive-health\.is-health-healthy\s*\{[^}]*--od6-health-outcome:\s*var\(--od6-success\)/s,
    );
    expect(css).toMatch(
      /\.od6chat-explosive-health\.is-health-wounded\s*\{[^}]*--od6-health-outcome:\s*var\(--od6-danger\)/s,
    );
    expect(css).toMatch(
      /\.od6chat-explosive-health\.is-health-custom\s*\{[^}]*--od6-health-outcome:\s*var\(--od6-accent-bright\)/s,
    );
  });

  it("uses a mortal-wound text tint with normal-text contrast across bundled dark themes", () => {
    const css = readFileSync("styles/d6-system-2e.css", "utf8");

    expect(css).toContain("--od6-mortal-wound: #b52245;");
    expect(css).toMatch(
      /--od6-mortal-wound-text:\s*color-mix\(\s*in srgb,\s*var\(--od6-mortal-wound\) 58%,\s*white\s*\);/s,
    );
    expect(css).toMatch(
      /\.od6chat-explosive-health\.is-health-mortally-wounded\s*\{[^}]*--od6-health-outcome:\s*var\(--od6-mortal-wound-text\)/s,
    );

    const mortalWoundText = mixChannels(
      colorChannels("#b52245"),
      colorChannels("#ffffff"),
      0.58,
    );
    const panelBackgrounds = [
      colorChannels("#101114"),
      ...["#0a0d12", "#0b0908", "#040b12", "#050405"].map((background) =>
        mixChannels(colorChannels(background), colorChannels("#ffffff"), 0.86),
      ),
    ];

    for (const panel of panelBackgrounds) {
      expect(contrastRatio(mortalWoundText, panel)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the no-target outcome visible and the responsive name treatment untruncated", () => {
    const html = template({
      aimedPoint: "100, 100",
      finalPoint: "120, 90",
      hasTargets: false,
      targets: [],
      zones: [],
    });
    const css = readFileSync("styles/d6-system-2e.css", "utf8");

    expect(html).toContain("D6E2.Explosive.Thread.NoAffectedTargets");
    expect(css).toContain(
      ".od6chat-explosive-target > div > strong:first-child",
    );
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain("@container (max-width: 320px)");
  });
});
