export function usableItemDescription(value: unknown): string {
  if (typeof value !== "string") return "";
  const description = value.trim();
  if (["", "null", "undefined"].includes(description.toLowerCase())) return "";
  return description;
}

export function itemDescriptionExcerpt(value: unknown, maximum = 220): string {
  const plain = usableItemDescription(value)
    .replace(/<br\s*\/?>/giu, " ")
    .replace(/<\/p>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/\s+/gu, " ")
    .trim();
  if (plain.length <= maximum) return plain;
  const sentence = /^.{40,220}?[.!?](?:\s|$)/u.exec(
    plain.slice(0, maximum + 1),
  )?.[0];
  const excerpt = sentence?.trim() ?? plain.slice(0, maximum).trimEnd();
  return `${excerpt.replace(/[,:;\s]+$/u, "")}…`;
}
