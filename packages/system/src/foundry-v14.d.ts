import type {
  ActorSource,
  D6System2eApiV1,
  ItemSource,
} from "@d6-system-2e/core";

declare global {
  const Item: {
    readonly implementation: {
      fromDropData(data: Record<string, unknown>): Promise<FoundryItemDocument>;
    };
  };
  function fromUuid(uuid: string): Promise<unknown>;
  const SortingHelpers: {
    performIntegerSort(
      source: FoundryItemDocument,
      options: {
        readonly siblings: readonly FoundryItemDocument[];
        readonly target: FoundryItemDocument;
      },
    ): readonly {
      readonly target: FoundryItemDocument;
      readonly update: Record<string, unknown>;
    }[];
  };

  interface FoundryHookRegistry {
    callAll?(hook: string, ...args: unknown[]): boolean;
    off(hook: string, callback: (...args: unknown[]) => unknown): void;
    on(hook: string, callback: (...args: unknown[]) => unknown): number;
    once(hook: "init" | "ready", callback: () => void | Promise<void>): number;
  }

  interface FoundryDocumentSheet {
    readonly element: HTMLElement;
    readonly isEditable: boolean;
    _onRender(
      context: Record<string, unknown>,
      options: Record<string, unknown>,
    ): Promise<void>;
    render(force?: boolean): unknown;
  }

  interface FoundryItemDocument {
    createEmbeddedDocuments(
      documentName: "ActiveEffect",
      sources: readonly Record<string, unknown>[],
    ): Promise<readonly FoundryActiveEffectDocument[]>;
    deleteEmbeddedDocuments(
      documentName: "ActiveEffect",
      ids: readonly string[],
    ): Promise<unknown>;
    readonly effects: {
      readonly contents: readonly FoundryActiveEffectDocument[];
      get(id: string): FoundryActiveEffectDocument | undefined;
    };
    readonly id: string;
    readonly img: string;
    readonly name: string;
    readonly parent?: FoundryActorDocument;
    readonly sort?: number;
    readonly sheet: {
      render(force?: boolean): unknown;
    };
    readonly system: Record<string, unknown>;
    readonly type: string;
    readonly uuid?: string;
    getFlag?(namespace: string, key: string): unknown;
    toDragData?(): Record<string, unknown>;
    toObject(): ItemSource;
    update(
      changes: Record<string, unknown>,
      options?: Record<string, unknown>,
    ): Promise<unknown>;
  }

  interface FoundryActiveEffectDocument {
    readonly disabled: boolean;
    readonly id: string;
    readonly name: string;
    readonly sheet: {
      render(force?: boolean): unknown;
    };
  }

  interface FoundryActorDocument {
    readonly documentName?: "Actor";
    readonly id: string;
    readonly img: string;
    readonly items: {
      readonly contents: readonly FoundryItemDocument[];
      get(id: string): FoundryItemDocument | undefined;
    };
    readonly isOwner?: boolean;
    readonly name: string;
    readonly sheet: FoundryDocumentSheet;
    readonly system: Record<string, unknown>;
    readonly type: string;
    readonly uuid?: string;
    getActiveTokens?(): readonly FoundryTokenPlaceable[];
    getFlag(namespace: string, key: string): unknown;
    testUserPermission(user: FoundryUser, permission: "OWNER"): boolean;
    createEmbeddedDocuments(
      documentName: "Item",
      sources: readonly Record<string, unknown>[],
      options?: Record<string, unknown>,
    ): Promise<readonly FoundryItemDocument[]>;
    deleteEmbeddedDocuments(
      documentName: "Item",
      ids: readonly string[],
    ): Promise<unknown>;
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

  interface FoundryChatMessageDocument {
    readonly id: string;
    delete(): Promise<unknown>;
    getFlag(namespace: string, key: string): unknown;
    update(changes: Record<string, unknown>): Promise<unknown>;
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

  interface FoundrySceneDocument {
    readonly id: string;
    getFlag(namespace: string, key: string): unknown;
    setFlag(namespace: string, key: string, value: unknown): Promise<unknown>;
    unsetFlag(namespace: string, key: string): Promise<unknown>;
  }

  interface FoundryGame {
    readonly actors?: {
      readonly contents: readonly FoundryActorDocument[];
      get(id: string): FoundryActorDocument | undefined;
    };
    readonly i18n: {
      format(key: string, data: Record<string, unknown>): string;
      localize(key: string): string;
    };
    readonly items?: {
      readonly contents: readonly FoundryItemDocument[];
    };
    readonly messages?: {
      get(id: string): FoundryChatMessageDocument | undefined;
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
          readonly choices?: Readonly<Record<string, string>>;
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
      registerMenu(
        namespace: string,
        key: string,
        configuration: {
          readonly hint: string;
          readonly icon: string;
          readonly label: string;
          readonly name: string;
          readonly restricted: boolean;
          readonly type: FoundryConstructor<object>;
        },
      ): void;
      set(namespace: string, key: string, value: unknown): Promise<unknown>;
    };
    readonly socket?: {
      emit(channel: string, value: unknown): void;
      on(channel: string, listener: (value: unknown) => void): void;
    };
    readonly user?: FoundryUser;
    readonly users?: {
      readonly contents: readonly FoundryUser[];
      get(id: string): FoundryUser | undefined;
    };
    readonly version?: string;
  }

  type FoundryConstructor<T> = new (...args: unknown[]) => T;

  interface FoundryUser {
    readonly active: boolean;
    readonly character?: FoundryActorDocument | null;
    readonly id: string;
    readonly isGM: boolean;
    readonly name?: string;
    readonly targets?: ReadonlySet<FoundryTokenPlaceable>;
    getFlag(scope: string, key: string): unknown;
    setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
  }

  interface FoundryTokenPlaceable {
    readonly actor?: FoundryActorDocument | null;
    readonly center?: {
      readonly x: number;
      readonly y: number;
    };
    readonly controlled?: boolean;
    readonly document?: {
      readonly texture?: {
        readonly src?: string;
      };
    };
    readonly id: string;
    readonly isPreview?: boolean;
    readonly name?: string;
    readonly visible?: boolean;
  }

  const Actor: unknown;
  const CONFIG: {
    readonly Actor: {
      dataModels: Record<string, FoundryConstructor<object>>;
    };
    readonly Item: {
      dataModels: Record<string, FoundryConstructor<object>>;
    };
    readonly Dice?: {
      terms: Record<string, FoundryConstructor<object>>;
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
    create(data: Record<string, unknown>): Promise<FoundryChatMessageDocument>;
    getSpeaker(options: { readonly actor: FoundryActorDocument }): unknown;
  };
  const ui: {
    readonly controls?: {
      render(options?: Record<string, unknown>): unknown;
    };
    readonly notifications: {
      info(message: string): void;
      warn(message: string): void;
    };
  };
  const canvas: {
    readonly grid?: {
      measurePath(
        points: readonly {
          readonly x: number;
          readonly y: number;
        }[],
      ): {
        readonly distance: number;
      };
    };
    readonly scene?: {
      readonly id: string;
      readonly grid?: {
        readonly distance?: number;
      };
      getFlag(namespace: string, key: string): unknown;
      setFlag(namespace: string, key: string, value: unknown): Promise<unknown>;
      unsetFlag(namespace: string, key: string): Promise<unknown>;
    };
    readonly tokens?: {
      readonly placeables: readonly FoundryTokenPlaceable[];
    };
  };
  const foundry: {
    readonly abstract: {
      readonly TypeDataModel: FoundryConstructor<object>;
    };
    readonly applications: {
      readonly api: {
        readonly ApplicationV2: FoundryConstructor<{
          readonly element: HTMLElement;
          readonly rendered: boolean;
          close(): Promise<void>;
          render(options?: boolean | Record<string, unknown>): unknown;
          _onRender(
            context: Record<string, unknown>,
            options: { readonly parts: readonly string[] },
          ): Promise<void>;
          _prepareContext(options?: {
            readonly parts: readonly string[];
          }): Promise<Record<string, unknown>>;
        }> & {
          readonly DEFAULT_OPTIONS: Record<string, unknown>;
          readonly PARTS: Record<string, unknown>;
        };
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
            readonly position?: {
              readonly height?: number | "auto";
              readonly width?: number | "auto";
            };
            readonly render?: (
              event: Event,
              dialog: { close(): Promise<void>; readonly element: HTMLElement },
            ) => void;
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
        readonly FilePicker: {
          implementation: new (options: {
            callback: (path: string) => unknown;
            current: string;
            document: object;
            type: "image";
          }) => {
            browse(): Promise<unknown>;
          };
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
          | "ArrayField"
          | "BooleanField"
          | "HTMLField"
          | "NumberField"
          | "ObjectField"
          | "SchemaField"
          | "StringField",
          FoundryConstructor<object>
        >
      >;
      readonly operators: {
        readonly ForcedDeletion: FoundryConstructor<object>;
      };
    };
    readonly dice?: {
      readonly terms: {
        readonly Die: FoundryConstructor<object>;
      };
    };
    readonly utils: {
      getRoute(path: string): string;
    };
  };
  const game: FoundryGame;
}

export {};
