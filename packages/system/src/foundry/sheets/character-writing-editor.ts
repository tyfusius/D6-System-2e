export const CHARACTER_WRITING_FIELD_PATHS = Object.freeze([
  "system.profile.background",
  "system.biography",
] as const);

export type CharacterWritingFieldPath =
  (typeof CHARACTER_WRITING_FIELD_PATHS)[number];

interface CharacterWritingActor {
  readonly isOwner?: boolean;
}

interface CharacterWritingSource {
  readonly background: string;
  readonly biography: string;
}

interface CharacterWritingEnrichmentOptions {
  readonly relativeTo: CharacterWritingActor;
  readonly secrets: boolean;
}

type EnrichHtml = (
  html: string,
  options: CharacterWritingEnrichmentOptions,
) => Promise<string>;

type CleanHtml = (html: string) => string;

export interface CharacterWritingEditorElement {
  readonly value: unknown;
  addEventListener(type: "change" | "save", listener: () => void): void;
  getAttribute(name: "name"): string | null;
}

interface CharacterWritingEditorBinding {
  readonly canEdit: () => boolean;
  readonly persist: (path: CharacterWritingFieldPath, value: string) => void;
}

const writingBindings = new WeakMap<
  CharacterWritingEditorElement,
  { binding: CharacterWritingEditorBinding; lastValue: string }
>();

function characterWritingFieldPath(
  value: string | null,
): CharacterWritingFieldPath | null {
  return CHARACTER_WRITING_FIELD_PATHS.find((path) => path === value) ?? null;
}

export async function enrichCharacterWritingFields(
  actor: CharacterWritingActor,
  source: CharacterWritingSource,
  enrichHtml: EnrichHtml,
  cleanHtml: CleanHtml,
): Promise<
  Readonly<Record<"background" | "biography", { html: string; value: string }>>
> {
  const options = Object.freeze({
    relativeTo: actor,
    secrets: actor.isOwner === true,
  });
  const backgroundValue = cleanHtml(source.background);
  const biographyValue = cleanHtml(source.biography);
  const [background, biography] = await Promise.all([
    enrichHtml(backgroundValue, options),
    enrichHtml(biographyValue, options),
  ]);
  return Object.freeze({
    background: Object.freeze({ html: background, value: backgroundValue }),
    biography: Object.freeze({ html: biography, value: biographyValue }),
  });
}

export function bindCharacterWritingEditors(
  editors: Iterable<CharacterWritingEditorElement>,
  binding: CharacterWritingEditorBinding,
): void {
  for (const editor of editors) {
    const path = characterWritingFieldPath(editor.getAttribute("name"));
    if (!path || typeof editor.value !== "string") continue;
    const existing = writingBindings.get(editor);
    if (existing) {
      existing.binding = binding;
      continue;
    }
    const state = { binding, lastValue: editor.value };
    writingBindings.set(editor, state);
    const persist = (): void => {
      const currentPath = characterWritingFieldPath(
        editor.getAttribute("name"),
      );
      if (
        !currentPath ||
        !state.binding.canEdit() ||
        typeof editor.value !== "string"
      )
        return;
      if (editor.value === state.lastValue) return;
      state.lastValue = editor.value;
      state.binding.persist(currentPath, editor.value);
    };
    editor.addEventListener("change", persist);
    editor.addEventListener("save", persist);
  }
}
