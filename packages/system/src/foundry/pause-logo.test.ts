import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const logo = readFileSync(
  new URL("../../../../assets/ui/d6-pause-mark.svg", import.meta.url),
  "utf8",
);
const openD6Logo = readFileSync(
  new URL("../../../../assets/ui/open-d6-profile-mark.svg", import.meta.url),
  "utf8",
);
const setupLogo = readFileSync(
  new URL("../../../../assets/ui/d6-system-mark-setup.svg", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../../../../styles/d6-system-2e.css", import.meta.url),
  "utf8",
);
const settingsSource = readFileSync(
  new URL("../settings/system-settings.ts", import.meta.url),
  "utf8",
);
const settingProfiles = readFileSync(
  new URL("../settings/setting-profile.ts", import.meta.url),
  "utf8",
);
const echoTheme = readFileSync(
  new URL(
    "../../../echod6-companion-d6-system-2e/src/theme.ts",
    import.meta.url,
  ),
  "utf8",
);
const manifest = JSON.parse(
  readFileSync(new URL("../../../../system.json", import.meta.url), "utf8"),
) as { readonly media: readonly Record<string, string>[] };

describe("system pause logo", () => {
  it("ships a transparent vector mark with no raster or background surface", () => {
    expect(logo).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(logo).toContain('viewBox="0 0 800 720"');
    expect(logo).toContain('fill="#c89b45"');
    expect(logo.match(/data-part="pip"/gu)).toHaveLength(4);
    expect(logo).toContain(
      '<circle data-part="pip" cx="392" cy="566" r="38" />',
    );
    expect(logo).toContain('data-part="die-outline"');
    expect(logo).toContain('data-part="lettering"');
    expect(logo).not.toContain("<rect");
    expect(logo).not.toContain("<image");
  });

  it("uses the canonical mark for neutral profile and setup identity", () => {
    const withoutViewBox = (value: string): string =>
      value.replace(/viewBox="[^"]+"/u, 'viewBox="canonical"');
    expect(withoutViewBox(setupLogo)).toBe(withoutViewBox(logo));
    expect(setupLogo).toContain('viewBox="-900 -290 2600 1300"');
    expect(
      settingProfiles.match(/assets\/ui\/d6-pause-mark\.svg/gu),
    ).toHaveLength(2);
    expect(manifest.media).toContainEqual({
      thumbnail: "systems/d6-system-2e/assets/ui/d6-system-mark-setup.svg",
      type: "setup",
      url: "systems/d6-system-2e/assets/ui/d6-system-mark-setup.svg",
    });
  });

  it("ships a path-only 220px Open D6 mask with preserved clear space", () => {
    const pathData = /<path\b[^>]*\bd="(?<data>[^"]+)"/u.exec(openD6Logo)
      ?.groups?.data;
    const points = Array.from(
      pathData?.matchAll(
        /(?:M|\s)(?<x>\d+(?:\.\d+)?)\s(?<y>\d+(?:\.\d+)?)(?=\s|M|Z)/gu,
      ) ?? [],
      (match) => ({
        x: Number(match.groups?.x),
        y: Number(match.groups?.y),
      }),
    );

    expect(openD6Logo).toContain('viewBox="0 0 220 220"');
    expect(openD6Logo).toContain('<path fill="#fff"');
    expect(pathData).toBeDefined();
    expect(Math.min(...points.map(({ x }) => x))).toBe(26);
    expect(Math.max(...points.map(({ x }) => x))).toBe(194);
    expect(Math.min(...points.map(({ y }) => y))).toBeGreaterThanOrEqual(32.5);
    expect(Math.max(...points.map(({ y }) => y))).toBeLessThanOrEqual(187.5);
    expect(pathData?.match(/[A-Za-z]/gu)?.length ?? 0).toBeLessThan(500);
    expect(
      pathData?.match(
        /M\d+(?:\.\d+)? \d+(?:\.\d+)?H\d+(?:\.\d+)?V\d+(?:\.\d+)?H\d+(?:\.\d+)?Z/gu,
      ) ?? [],
    ).toHaveLength(0);
    expect(openD6Logo).not.toMatch(/<(?:image|rect|filter|foreignObject)\b/u);
    expect(openD6Logo).not.toMatch(/(?:data:image|base64|#00b8ec|#00b9ed)/iu);
    expect(styles).not.toContain("#00b8ec");
  });

  it("keeps the reusable profile mark separate from its framed editor surface", () => {
    expect(styles).toMatch(
      /\.d6e2-setting-profile-hero-logo\s*\{[^}]*background-color: rgb\(4 7 11 \/ 62%\);/u,
    );
    expect(styles).not.toMatch(
      /\.d6e2-setting-profile-hero\s+\.d6e2-profile-logo-mark\s*\{[^}]*\bbackground:/u,
    );
  });

  it("adds setup-only breathing room without changing the canonical geometry", () => {
    expect(setupLogo).toBe(
      logo.replace('viewBox="0 0 800 720"', 'viewBox="-900 -290 2600 1300"'),
    );
    expect(styles).toContain('url("../assets/ui/d6-pause-mark.svg")');
  });

  it("keeps contributed artwork behavior while independently animating the neutral mark", () => {
    expect(styles).toContain("body.system-d6-system-2e #pause img");
    expect(styles).toContain('url("../assets/ui/d6-pause-mark.svg")');
    expect(styles).toContain("animation: d6e2-pause-cube-breathe");
    expect(styles).toContain(
      "animation: d6e2-pause-mark-breathe 4.8s ease-in-out infinite",
    );
    expect(styles).toContain("animation: d6e2-pause-orbit 16s");
    expect(styles).toContain("animation: d6e2-pause-orbit-reverse 24s");
    expect(styles).toContain(
      'html[data-d6e2-visual-effects-resolved="reduced"]',
    );
    expect(styles).toContain("#pause.paused::before");
    expect(styles).toMatch(
      /data-d6e2-visual-effects-resolved="reduced"[\s\S]*?#pause\s+img,[\s\S]*?\{[\s\S]*?animation: none !important;/u,
    );
    expect(styles).toMatch(
      /data-d6e2-visual-effects-resolved="reduced"[\s\S]*?#pause\s+figcaption::before,[\s\S]*?\{[\s\S]*?animation: none !important;/u,
    );
    expect(styles).toMatch(
      /#pause::after \{[\s\S]*?transform: translate\(-50%, -50%\);/u,
    );
    expect(styles).not.toContain("border-radius: 28%");
    expect(styles).toContain("padding-top: 18px");
    expect(styles).toContain("top: calc(50% - 9px)");
  });

  it("recolors only the resolved neutral mark from the active accent token", () => {
    expect(styles).toMatch(
      /data-d6-system2e-pause-branding="mask"[\s\S]*?#pause[\s\S]*?figcaption::before \{[\s\S]*?bottom: calc\(100% \+ 0\.65rem \+ 24px\);[\s\S]*?left: calc\(50% - 7px\);[\s\S]*?width: 128px;[\s\S]*?height: 128px;[\s\S]*?background-color: var\(--d6e2-setting-logo-color, var\(--od6-accent\)\);[\s\S]*?mask: var\(--d6e2-pause-icon\)/u,
    );
    expect(styles).toMatch(
      /data-d6-system2e-pause-branding="mask"[\s\S]*?#pause[\s\S]*?img \{[\s\S]*?opacity: 0;[\s\S]*?animation: none !important;/u,
    );
    expect(settingsSource).toContain(
      "root.dataset.d6System2ePauseBranding = pausePresentation.mode",
    );
    expect(settingsSource).toContain(
      "root.dataset.d6System2ePauseBrand = pausePresentation.brand",
    );
  });

  it("keeps contributed pause assets outside neutral mask styling", () => {
    expect(echoTheme).toContain(
      'pauseIcon: "modules/echod6-companion-d6-system-2e/art/branding/echo-logo.png"',
    );

    const contributedImageRule =
      /body\.system-d6-system-2e #pause img \{(?<declarations>[^}]*)\}/u.exec(
        styles,
      )?.groups?.declarations;
    expect(contributedImageRule).toBeDefined();
    expect(contributedImageRule).not.toContain("mask:");
    expect(contributedImageRule).not.toContain("background-color:");
  });

  it("resolves the active Setting Profile logo through Foundry's route prefix", () => {
    expect(settingsSource).toContain(
      "foundry.utils.getRoute(pausePresentation.path)",
    );
    expect(settingsSource).toContain("const profile = currentSettingProfile()");
    expect(settingsSource).toContain(
      "resolveSettingProfilePauseIcon(themes, profile)",
    );
    expect(settingsSource).not.toContain("resolvePauseIcon(profile, selected)");
    expect(settingsSource).not.toContain(
      '`url("${selected.pauseIcon ?? "systems/',
    );
  });
});
