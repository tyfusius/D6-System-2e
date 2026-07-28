import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const MANUAL_SOURCE = "docs/USER-MANUAL.md";
export const MANUAL_PACK = "packs/user-manual";
export const MANUAL_JOURNAL_NAME = "D6 System Second Edition — User Manual";

function stableId(identity) {
  return createHash("sha256").update(identity).digest("hex").slice(0, 16);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inlineMarkdown(value) {
  let output = escapeHtml(value);
  output = output.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/gu,
    (_match, alt, source) =>
      `<img src="${source}" alt="${alt}" loading="lazy">`,
  );
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/gu, '<a href="$2">$1</a>');
  output = output.replace(/\*\*([^*]+)\*\*/gu, "<strong>$1</strong>");
  output = output.replace(/`([^`]+)`/gu, "<code>$1</code>");
  return output;
}

function journalImagePath(markdown) {
  return markdown.replaceAll(
    'src="../assets/',
    'src="systems/d6-system-2e/assets/',
  );
}

export function markdownToFoundryHtml(markdown) {
  const lines = markdown.trim().split(/\r?\n/u);
  const output = ['<div class="d6e2-user-manual">'];
  let paragraph = [];
  let list = null;
  let quote = [];

  const closeParagraph = () => {
    if (paragraph.length === 0) return;
    output.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (list === null) return;
    output.push(`<${list.tag}>`);
    output.push(
      ...list.items.map((item) => `<li>${inlineMarkdown(item)}</li>`),
    );
    output.push(`</${list.tag}>`);
    list = null;
  };
  const closeQuote = () => {
    if (quote.length === 0) return;
    output.push(
      `<blockquote><p>${inlineMarkdown(quote.join(" "))}</p></blockquote>`,
    );
    quote = [];
  };
  const closeBlocks = () => {
    closeParagraph();
    closeList();
    closeQuote();
  };

  for (const line of lines) {
    if (line.trim() === "") {
      closeBlocks();
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/u.exec(line);
    if (heading !== null) {
      closeBlocks();
      const level = Math.min(heading[1].length, 4);
      output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    if (/^---+$/u.test(line)) {
      closeBlocks();
      output.push("<hr>");
      continue;
    }
    if (line.startsWith("> ")) {
      closeParagraph();
      closeList();
      quote.push(line.slice(2));
      continue;
    }
    const unordered = /^-\s+(.+)$/u.exec(line);
    const ordered = /^\d+\.\s+(.+)$/u.exec(line);
    if (unordered !== null || ordered !== null) {
      closeParagraph();
      closeQuote();
      const nextList = unordered === null ? "ol" : "ul";
      if (list?.tag !== nextList) {
        closeList();
        list = { tag: nextList, items: [] };
      }
      list.items.push((unordered ?? ordered)?.[1] ?? "");
      continue;
    }
    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/u.exec(line);
    if (image !== null) {
      closeBlocks();
      output.push(
        `<figure><img src="${escapeHtml(image[2])}" alt="${escapeHtml(
          image[1],
        )}" loading="lazy"><figcaption>${inlineMarkdown(
          image[1],
        )}</figcaption></figure>`,
      );
      continue;
    }
    if (list !== null && /^\s{2,}\S/u.test(line)) {
      const lastIndex = list.items.length - 1;
      list.items[lastIndex] = `${list.items[lastIndex]} ${line.trim()}`;
      continue;
    }
    closeList();
    paragraph.push(line.trim());
  }
  closeBlocks();
  output.push("</div>");
  return journalImagePath(output.join("\n"));
}

export function parseManual(markdown) {
  const heading = /^#\s+(.+)$/mu.exec(markdown);
  if (heading === null) {
    throw new Error("The manual requires one level-one title.");
  }
  const matches = [...markdown.matchAll(/^##\s+(.+)$/gmu)];
  const chapters = [];
  const introductionStart = heading.index + heading[0].length;
  const introductionEnd = matches[0]?.index ?? markdown.length;
  chapters.push({
    name: "Welcome and Contents",
    markdown: markdown.slice(introductionStart, introductionEnd).trim(),
  });
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const start = (current.index ?? 0) + current[0].length;
    const end = matches[index + 1]?.index ?? markdown.length;
    chapters.push({
      name: current[1].trim(),
      markdown: markdown.slice(start, end).trim(),
    });
  }
  return { title: heading[1].trim(), chapters };
}

export async function expectedManualRecords(root) {
  const [markdown, manifestSource] = await Promise.all([
    readFile(path.join(root, MANUAL_SOURCE), "utf8"),
    readFile(path.join(root, "system.json"), "utf8"),
  ]);
  const manifest = JSON.parse(manifestSource);
  const manual = parseManual(markdown);
  const journalId = stableId("d6-system-2e:user-manual");
  const pageIds = manual.chapters.map((chapter) =>
    stableId(`d6-system-2e:user-manual:${chapter.name}`),
  );
  const stats = {
    coreVersion: "14.365",
    systemId: manifest.id,
    systemVersion: manifest.version,
  };
  const records = [
    {
      key: `!journal!${journalId}`,
      value: {
        _id: journalId,
        categories: [],
        name: MANUAL_JOURNAL_NAME,
        ownership: { default: 2 },
        pages: pageIds,
        _stats: stats,
      },
    },
  ];
  for (let index = 0; index < manual.chapters.length; index += 1) {
    const chapter = manual.chapters[index];
    const pageId = pageIds[index];
    records.push({
      key: `!journal.pages!${journalId}.${pageId}`,
      value: {
        _id: pageId,
        category: null,
        image: {},
        name: chapter.name,
        sort: index * 100000,
        src: null,
        system: {},
        text: {
          content: markdownToFoundryHtml(chapter.markdown),
          format: 1,
        },
        title: { level: 1, show: true },
        type: "text",
        video: { controls: true, volume: 0.5 },
        _stats: stats,
      },
    });
  }
  return records;
}
