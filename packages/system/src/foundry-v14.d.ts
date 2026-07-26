import type {
  ActorSource,
  D6System2eApiV1,
  ItemSource,
} from "@d6-system-2e/core";

declare global {
  interface FoundryHookRegistry {
    on(hook: string, callback: (...args: unknown[]) => unknown): number;
    once(hook: "init" | "ready", callback: () => void | Promise<void>): number;
  }

  interface FoundryDocumentSheet {
    readonly isEditable: boolean;
  }

  interface FoundryItemDocument {
    readonly id: string;
    readonly name: string;
    readonly parent?: FoundryActorDocument;
    readonly sheet: {
      render(force?: boolean): unknown;
    };
    readonly system: Record<string, unknown>;
    readonly type: string;
    toObject(): ItemSource;
    update(
      changes: Record<string, unknown>,
      options?: Record<string, unknown>,
    ): Promise<unknown>;
  }

  interface FoundryActorDocument {
    readonly id: string;
    readonly img: string;
    readonly items: {
      readonly contents: readonly FoundryItemDocument[];
      get(id: string): FoundryItemDocument | undefined;
    };
    readonly isOwner?: boolean;
    readonly name: string;
    readonly system: Record<string, unknown>;
    readonly type: string;
    createEmbeddedDocuments(
      documentName: "Item",
      sources: readonly Record<string, unknown>[],
    ): Promise<readonly FoundryItemDocument[]>;
    toObject(): ActorSource;
    update(
      changes: Record<string, unknown>,
      options?: Record<string, unknown>,
    ): Promise<unknown>;
    updateEmbeddedDocuments(
      documentName: "Item",
      changes: readonly Record<string, unknown>[],
      options?: Record<string, unknown>,
    ): Promise<unknown>;
  }

  interface FoundryRollDieResult {
    readonly active?: boolean;
    readonly result: number;
  }

  interface FoundryRollDieTerm {
    readonly results: readonly FoundryRollDieResult[];
  }

  interface FoundryRoll {
    readonly dice: readonly FoundryRollDieTerm[];
    readonly total: number;
  }

  interface FoundryDialogButton {
    readonly form?: HTMLFormElement;
  }

  interface FoundryActorSheet extends FoundryDocumentSheet {
    readonly actor: FoundryActorDocument;
    readonly tabGroups: Record<string, string>;
    _attachPartListeners(
      partId: string,
      htmlElement: HTMLElement,
      options: Record<string, unknown>,
    ): void;
  }

  interface FoundryItemSheet extends FoundryDocumentSheet {
    readonly item: FoundryItemDocument;
  }

  interface FoundryFormData {
    readonly object: Record<string, unknown>;
  }

  interface FoundrySourceDocument {
    updateSource(changes: Record<string, unknown>): void;
  }

  interface FoundryGame {
    readonly actors?: {
      readonly contents: readonly FoundryActorDocument[];
    };
    readonly i18n: {
      localize(key: string): string;
    };
    readonly items?: {
      readonly contents: readonly FoundryItemDocument[];
    };
    readonly system: {
      api?: D6System2eApiV1;
      readonly version?: string;
    };
    readonly settings: {
      get(namespace: string, key: string): unknown;
      register(
        namespace: string,
        key: string,
        configuration: {
          readonly config: boolean;
          readonly default: unknown;
          readonly hint: string;
          readonly name: string;
          readonly onChange?: (value: unknown) => void;
          readonly requiresReload?: boolean;
          readonly scope: "client" | "world";
          readonly type: unknown;
        },
      ): void;
      set(namespace: string, key: string, value: unknown): Promise<unknown>;
    };
    readonly user?: {
      readonly id?: string;
      readonly isGM?: boolean;
    };
    readonly users?: {
      readonly contents: readonly {
        readonly id: string;
        readonly isGM?: boolean;
      }[];
      get(id: string): { readonly isGM?: boolean } | undefined;
    };
    readonly version?: string;
  }

  type FoundryConstructor<T> = new (...args: unknown[]) => T;

  const Actor: unknown;
  const CONFIG: {
    readonly Actor: {
      dataModels: Record<string, FoundryConstructor<object>>;
    };
    readonly Item: {
      dataModels: Record<string, FoundryConstructor<object>>;
    };
  };
  const Hooks: FoundryHookRegistry;
  const Item: unknown;
  const Roll: new (
    formula: string,
    data?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => FoundryRoll & {
    evaluate(): Promise<FoundryRoll>;
  };
  const ChatMessage: {
    create(data: Record<string, unknown>): Promise<unknown>;
    getSpeaker(options: { readonly actor: FoundryActorDocument }): unknown;
  };
  const ui: {
    readonly notifications: {
      warn(message: string): void;
    };
  };
  const foundry: {
    readonly abstract: {
      readonly TypeDataModel: FoundryConstructor<object>;
    };
    readonly applications: {
      readonly api: {
        readonly DialogV2: {
          wait<T>(options: {
            readonly buttons: readonly {
              readonly action: string;
              readonly callback?: (
                event: Event,
                button: FoundryDialogButton,
              ) => T;
              readonly class?: string;
              readonly default?: boolean;
              readonly icon?: string;
              readonly label: string;
            }[];
            readonly classes?: readonly string[];
            readonly content: string;
            readonly modal?: boolean;
            readonly rejectClose?: boolean;
            readonly window?: {
              readonly icon?: string;
              readonly title: string;
            };
          }): Promise<T | null>;
        };
        HandlebarsApplicationMixin<T extends FoundryConstructor<object>>(
          base: T,
        ): T;
      };
      readonly handlebars: {
        renderTemplate(
          path: string,
          data: Record<string, unknown>,
        ): Promise<string>;
      };
      readonly apps: {
        readonly DocumentSheetConfig: {
          registerSheet(
            documentClass: unknown,
            namespace: string,
            sheetClass: FoundryConstructor<object>,
            options: {
              readonly label: string;
              readonly makeDefault: boolean;
              readonly types: readonly string[];
            },
          ): void;
        };
      };
      readonly sheets: {
        readonly ActorSheetV2: FoundryConstructor<FoundryActorSheet>;
        readonly ItemSheetV2: FoundryConstructor<FoundryItemSheet>;
      };
    };
    readonly data: {
      readonly fields: Readonly<
        Record<
          "HTMLField" | "NumberField" | "SchemaField" | "StringField",
          FoundryConstructor<object>
        >
      >;
    };
  };
  const game: FoundryGame;
}

export {};
