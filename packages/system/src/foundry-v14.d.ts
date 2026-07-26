import type { D6System2eApiV1 } from "@d6-system-2e/core";

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
    readonly sheet: {
      render(force?: boolean): unknown;
    };
    readonly system: Record<string, unknown>;
    update(changes: Record<string, unknown>): Promise<unknown>;
  }

  interface FoundryActorDocument {
    readonly id: string;
    readonly img: string;
    readonly items: {
      readonly contents: readonly FoundryItemDocument[];
      get(id: string): FoundryItemDocument | undefined;
    };
    readonly name: string;
    readonly system: Record<string, unknown>;
    createEmbeddedDocuments(
      documentName: "Item",
      sources: readonly Record<string, unknown>[],
    ): Promise<readonly FoundryItemDocument[]>;
    update(changes: Record<string, unknown>): Promise<unknown>;
  }

  interface FoundryActorSheet extends FoundryDocumentSheet {
    readonly actor: FoundryActorDocument;
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
    readonly i18n: {
      localize(key: string): string;
    };
    readonly system: {
      api?: D6System2eApiV1;
      readonly version?: string;
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
  const foundry: {
    readonly abstract: {
      readonly TypeDataModel: FoundryConstructor<object>;
    };
    readonly applications: {
      readonly api: {
        HandlebarsApplicationMixin<T extends FoundryConstructor<object>>(
          base: T,
        ): T;
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
