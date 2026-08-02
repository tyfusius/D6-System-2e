import type { D6CanvasPoint } from "./token-movement-service";

export interface TokenDestinationPreview {
  readonly blocked: boolean;
  readonly canMove: boolean;
  readonly distance: number;
  readonly maximumDistance: number;
}

interface DestinationRuntime {
  readonly activeLayer?: { activate(): void };
  readonly app?: { readonly view?: HTMLCanvasElement };
  readonly grid?: {
    getSnappedPoint(
      point: D6CanvasPoint,
      options: Record<string, unknown>,
    ): D6CanvasPoint;
  };
  readonly regions?: { activate(): void };
  readonly scene?: object;
  readonly stage?: {
    off(event: string, callback: (event: unknown) => void): void;
    on(event: string, callback: (event: unknown) => void): void;
  };
}

function eventPoint(event: unknown, stage: object): D6CanvasPoint | null {
  const direct =
    typeof event === "object" && event !== null && "getLocalPosition" in event
      ? (event as {
          getLocalPosition(target: object): D6CanvasPoint;
        })
      : undefined;
  if (direct) return direct.getLocalPosition(stage);
  const data =
    typeof event === "object" && event !== null && "data" in event
      ? (
          event as {
            readonly data?: {
              getLocalPosition(target: object): D6CanvasPoint;
            };
          }
        ).data
      : undefined;
  return data?.getLocalPosition(stage) ?? null;
}

export async function chooseTokenMovementDestination(
  options: Readonly<{
    preview(point: D6CanvasPoint): TokenDestinationPreview;
    title: string;
  }>,
): Promise<D6CanvasPoint | null> {
  const runtime = canvas as unknown as DestinationRuntime;
  if (!runtime.scene || !runtime.stage || !runtime.app?.view || !runtime.grid) {
    throw new Error("D6E2.Movement.Error.CanvasUnavailable");
  }
  const previousLayer = runtime.activeLayer;
  runtime.regions?.activate();
  let destination: D6CanvasPoint | null = null;
  let state: TokenDestinationPreview | null = null;
  let dialogElement: HTMLElement | undefined;

  const updateStatus = (): void => {
    const status = dialogElement?.querySelector<HTMLElement>(
      "[data-token-movement-status]",
    );
    const confirm = dialogElement?.querySelector<HTMLButtonElement>(
      '[data-action="confirm"]',
    );
    if (!status || !confirm) return;
    const key = state?.blocked
      ? "Blocked"
      : state?.canMove
        ? "Valid"
        : state
          ? "TooFar"
          : "Choose";
    status.dataset.state = key.toLowerCase();
    status.textContent = state
      ? game.i18n.format(`D6E2.Movement.Status.${key}`, {
          distance: Math.round(state.distance * 10) / 10,
          maximum: Math.round(state.maximumDistance * 10) / 10,
        })
      : game.i18n.localize("D6E2.Movement.Status.Choose");
    confirm.disabled = state?.canMove !== true;
  };
  const move = (event: unknown): void => {
    const point = eventPoint(event, runtime.stage as object);
    if (!point) return;
    destination = runtime.grid?.getSnappedPoint(point, {}) ?? point;
    try {
      state = options.preview(destination);
    } catch {
      state = null;
    }
    updateStatus();
  };
  const confirmOnCanvas = (event: unknown): void => {
    move(event);
    if (state?.canMove) {
      dialogElement
        ?.querySelector<HTMLButtonElement>('[data-action="confirm"]')
        ?.click();
    }
  };
  const cancel = (event: Event): void => {
    event.preventDefault();
    dialogElement
      ?.querySelector<HTMLButtonElement>('[data-action="cancel"]')
      ?.click();
  };
  const escape = (event: KeyboardEvent): void => {
    if (event.key === "Escape") cancel(event);
  };
  const teardown = (): void => {
    dialogElement
      ?.querySelector<HTMLButtonElement>('[data-action="cancel"]')
      ?.click();
  };

  runtime.stage.on("pointermove", move);
  runtime.stage.on("pointerdown", confirmOnCanvas);
  runtime.app.view.addEventListener("contextmenu", cancel);
  globalThis.addEventListener("keydown", escape, true);
  Hooks.on("canvasTearDown", teardown);
  try {
    const result = await foundry.applications.api.DialogV2.wait<D6CanvasPoint>({
      buttons: [
        {
          action: "cancel",
          label: game.i18n.localize("D6E2.Cancel"),
        },
        {
          action: "confirm",
          callback: () => {
            if (!destination) {
              throw new Error("D6E2.Movement.Error.InvalidDestination");
            }
            return destination;
          },
          class: "od6roll-submit",
          default: true,
          icon: "fa-solid fa-location-crosshairs",
          label: game.i18n.localize("D6E2.Movement.Confirm"),
        },
      ],
      classes: ["d6e2", "od6roll-dialog", "d6e2-token-movement-dialog"],
      content:
        '<div class="od6roll-shell"><p>' +
        game.i18n.localize("D6E2.Movement.ChooseHelp") +
        '</p><p data-token-movement-status role="status" aria-live="polite"></p></div>',
      modal: false,
      position: { width: 430 },
      render: (_event, dialog) => {
        dialogElement = dialog.element;
        updateStatus();
      },
      window: {
        icon: "fa-solid fa-person-walking-arrow-right",
        title: options.title,
      },
    });
    return result && typeof result === "object" ? result : null;
  } finally {
    runtime.stage.off("pointermove", move);
    runtime.stage.off("pointerdown", confirmOnCanvas);
    runtime.app.view.removeEventListener("contextmenu", cancel);
    globalThis.removeEventListener("keydown", escape, true);
    Hooks.off("canvasTearDown", teardown);
    previousLayer?.activate();
  }
}
