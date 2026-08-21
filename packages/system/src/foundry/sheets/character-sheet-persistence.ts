import type { CharacterSheetMode } from "./sheet-mode";

type DocumentChanges = Readonly<Record<string, unknown>>;
type UpdateDocument = (changes: DocumentChanges) => Promise<unknown>;

export class CharacterSheetPersistenceQueue {
  readonly #onError: (error: unknown) => void;
  readonly #pendingDirectResources = new Map<string, unknown>();
  #queue: Promise<void> = Promise.resolve();

  constructor(onError: (error: unknown) => void) {
    this.#onError = onError;
  }

  enqueue(operation: () => Promise<unknown>): void {
    this.#queue = this.#queue
      .then(async () => {
        await operation();
      })
      .catch((error: unknown) => {
        this.#onError(error);
      });
  }

  enqueueDirectResource(
    name: string,
    value: unknown,
    update: UpdateDocument,
  ): void {
    this.#pendingDirectResources.set(name, value);
    this.enqueue(async () => {
      await update({ [name]: value });
      if (Object.is(this.#pendingDirectResources.get(name), value)) {
        this.#pendingDirectResources.delete(name);
      }
    });
  }

  enqueueModeTransition(
    mode: CharacterSheetMode,
    update: UpdateDocument,
  ): void {
    // Snapshot synchronously. A rapid mode change can be queued while the
    // immediately preceding resource update is still in flight. Replaying
    // only those explicitly edited balances makes the mode transition atomic
    // without submitting the rest of the rendered form.
    const pendingResources = Object.fromEntries(this.#pendingDirectResources);
    this.enqueue(async () => {
      await update({
        ...pendingResources,
        "system.sheetMode.value": mode,
      });
      for (const [name, value] of Object.entries(pendingResources)) {
        if (Object.is(this.#pendingDirectResources.get(name), value)) {
          this.#pendingDirectResources.delete(name);
        }
      }
      // The Actor update owns its normal Foundry sheet rerender. Starting a
      // second explicit ApplicationV2 render here can leave the application in
      // RENDERING state and make its native change handler reject later input.
    });
  }
}
