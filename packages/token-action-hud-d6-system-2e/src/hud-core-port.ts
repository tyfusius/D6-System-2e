export interface CoreHudAction {
  readonly encodedValue: string;
  readonly id: string;
  readonly image?: string;
  readonly info1?: { readonly text: string; readonly title?: string };
  readonly name: string;
}

export interface CoreHudGroup {
  readonly groups?: readonly CoreHudGroup[];
  readonly id: string;
  readonly name: string;
  readonly nestId?: string;
  readonly type?: "system";
}

export interface CoreActionPort {
  readonly actor?: object;
  readonly token?: { readonly id: string };
  addActions(
    actions: readonly CoreHudAction[],
    group: { readonly id: string; readonly type: "system" },
  ): Promise<unknown>;
}

export interface CoreRollPort {
  readonly actor: object;
  handleActionClick(event: Event, encodedValue: string): Promise<unknown>;
  throwInvalidValueErr(): unknown;
}

export interface CoreSystemPort {
  registerSettings(callback: (...args: unknown[]) => unknown): void;
}

export interface TokenActionHudCoreApi {
  readonly ActionHandler: new () => CoreActionPort;
  readonly RollHandler: new () => CoreRollPort;
  readonly SystemManager: new () => CoreSystemPort;
}

export function tokenActionHudCoreApi(value: unknown): TokenActionHudCoreApi {
  const api =
    typeof value === "object" && value !== null && "api" in value
      ? value.api
      : null;
  if (
    typeof api !== "object" ||
    api === null ||
    !("ActionHandler" in api) ||
    typeof api.ActionHandler !== "function" ||
    !("RollHandler" in api) ||
    typeof api.RollHandler !== "function" ||
    !("SystemManager" in api) ||
    typeof api.SystemManager !== "function"
  ) {
    throw new TypeError("Token Action HUD Core 2.1 API is unavailable.");
  }
  return api as unknown as TokenActionHudCoreApi;
}
