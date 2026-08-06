export interface HudAction {
  readonly encodedValue: string;
  readonly id: string;
  readonly image?: string;
  readonly info1?: {
    readonly text: string;
    readonly title?: string;
  };
  readonly name: string;
}

export interface HudGroup {
  readonly groups?: readonly HudGroup[];
  readonly id: string;
  readonly name: string;
  readonly nestId?: string;
  readonly type?: "system";
}

export interface HudDefaults {
  readonly groups: readonly HudGroup[];
  readonly layout: readonly HudGroup[];
}

export interface CoreActionHandler {
  readonly actor?: object;
  readonly delimiter: string;
  readonly token?: { readonly id: string };
  addActions(
    actions: readonly HudAction[],
    group: { readonly id: string; readonly type: "system" },
  ): Promise<unknown>;
}

export interface CoreRollHandler {
  readonly actor: object;
  readonly delimiter: string;
  handleActionClick(event: Event, encodedValue: string): Promise<unknown>;
  throwInvalidValueErr(): unknown;
}

export interface CoreSystemManager {
  registerSettings(coreUpdate: (...args: unknown[]) => unknown): void;
}

export interface TokenActionHudCoreModule {
  readonly api: {
    readonly ActionHandler: new () => CoreActionHandler;
    readonly RollHandler: new () => CoreRollHandler;
    readonly SystemManager: new () => CoreSystemManager;
  };
}

export function isTokenActionHudCoreModule(
  value: unknown,
): value is TokenActionHudCoreModule {
  if (typeof value !== "object" || value === null || !("api" in value)) {
    return false;
  }
  const api = value.api;
  return (
    typeof api === "object" &&
    api !== null &&
    "ActionHandler" in api &&
    typeof api.ActionHandler === "function" &&
    "RollHandler" in api &&
    typeof api.RollHandler === "function" &&
    "SystemManager" in api &&
    typeof api.SystemManager === "function"
  );
}
