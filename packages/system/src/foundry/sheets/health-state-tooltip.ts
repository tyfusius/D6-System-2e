export interface HealthStateTooltipManager {
  activate(element: HTMLElement, options: { text: string }): void;
  deactivate(): void;
}

const HEALTH_DESCRIPTION_SELECTOR =
  "[data-d6e2-health-description-id][data-tooltip]";

type HealthStateDescriptionObserver = Pick<
  MutationObserver,
  "disconnect" | "observe"
>;

function createDescriptionObserver(
  callback: MutationCallback,
): HealthStateDescriptionObserver {
  return new MutationObserver(callback);
}

export function bindHealthStateDescriptionTooltips(
  root: HTMLElement,
  tooltip: HealthStateTooltipManager,
  observerFactory: (
    callback: MutationCallback,
  ) => HealthStateDescriptionObserver = createDescriptionObserver,
): void {
  const buttons = root.querySelectorAll<HTMLElement>(
    HEALTH_DESCRIPTION_SELECTOR,
  );
  buttons.forEach((button) => {
    const descriptionId = button.dataset.d6e2HealthDescriptionId;
    const text = button.dataset.tooltip;
    if (!descriptionId || !text) return;

    const restoreDescription = (): void => {
      button.setAttribute("aria-describedby", descriptionId);
    };
    const restoreAfterTooltipLifecycle = (): void => {
      queueMicrotask(restoreDescription);
    };
    let hoverTeardownObserver: HealthStateDescriptionObserver | undefined;
    const preserveDescriptionThroughHoverTeardown = (): void => {
      hoverTeardownObserver?.disconnect();
      const observer = observerFactory(() => {
        if (button.getAttribute("aria-describedby") === descriptionId) return;
        observer.disconnect();
        if (hoverTeardownObserver === observer) {
          hoverTeardownObserver = undefined;
        }
        restoreDescription();
      });
      hoverTeardownObserver = observer;
      observer.observe(button, {
        attributeFilter: ["aria-describedby"],
        attributes: true,
      });
      restoreAfterTooltipLifecycle();
    };

    restoreDescription();
    button.addEventListener("focus", () => {
      tooltip.activate(button, { text });
      restoreDescription();
      restoreAfterTooltipLifecycle();
    });
    button.addEventListener("blur", () => {
      tooltip.deactivate();
      restoreAfterTooltipLifecycle();
    });
    button.addEventListener(
      "mouseleave",
      preserveDescriptionThroughHoverTeardown,
    );
    button.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      tooltip.deactivate();
      restoreAfterTooltipLifecycle();
    });
  });
}
