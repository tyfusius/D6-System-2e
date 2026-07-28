import { describe, expect, it } from "vitest";
import { markdownToFoundryHtml, parseManual } from "./user-manual-lib.mjs";

describe("user manual compiler", () => {
  it("splits the introduction and level-two chapters into stable Journal pages", () => {
    const manual = parseManual(`# Manual

Introduction.

## First

First chapter.

## Second

Second chapter.
`);

    expect(manual.title).toBe("Manual");
    expect(manual.chapters.map(({ name }) => name)).toEqual([
      "Welcome and Contents",
      "First",
      "Second",
    ]);
  });

  it("renders supported Markdown and rewrites installed screenshot paths", () => {
    const html = markdownToFoundryHtml(`
### Roll

**Choose** a \`Skill\`.

- One
- A deliberately long second item that
  continues on another source line.

![Roll builder.](../assets/manual/roll-builder.png)
`);

    expect(html).toContain("<h3>Roll</h3>");
    expect(html).toContain("<strong>Choose</strong>");
    expect(html).toContain("<code>Skill</code>");
    expect(html).toContain("<ul>");
    expect(html).toContain(
      "<li>A deliberately long second item that continues on another source line.</li>",
    );
    expect(html).toContain(
      'src="systems/d6-system-2e/assets/manual/roll-builder.png"',
    );
  });
});
