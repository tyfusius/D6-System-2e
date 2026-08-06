type SceneControlApplicationLauncher = () => void;

const launchers = new Map<string, SceneControlApplicationLauncher>();
let hookRegistered = false;

export function shouldLaunchWithoutCanvas(canvasReady: boolean): boolean {
  return !canvasReady;
}

function sceneControlsElement(
  application: unknown,
  renderedElement: unknown,
): HTMLElement | undefined {
  if (renderedElement instanceof HTMLElement) return renderedElement;
  if (
    application &&
    typeof application === "object" &&
    "element" in application &&
    application.element instanceof HTMLElement
  ) {
    return application.element;
  }
  return undefined;
}

function bindNoCanvasLaunchers(root: HTMLElement): void {
  for (const [toolName, launch] of launchers) {
    const button = root.querySelector<HTMLElement>(
      `[data-action="tool"][data-tool="${toolName}"]`,
    );
    if (!button || button.dataset.d6NoCanvasLauncher === "true") continue;
    button.dataset.d6NoCanvasLauncher = "true";
    button.addEventListener(
      "click",
      (event) => {
        const canvasReady =
          (canvas as { readonly ready?: unknown }).ready === true;
        if (!shouldLaunchWithoutCanvas(canvasReady)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        launch();
      },
      { capture: true },
    );
  }
}

export function registerSceneControlApplicationButton(
  toolName: string,
  launch: SceneControlApplicationLauncher,
): void {
  launchers.set(toolName, launch);
  if (hookRegistered) return;
  hookRegistered = true;
  Hooks.on(
    "renderSceneControls",
    (application: unknown, renderedElement: unknown) => {
      const root = sceneControlsElement(application, renderedElement);
      if (root) bindNoCanvasLaunchers(root);
    },
  );
}
