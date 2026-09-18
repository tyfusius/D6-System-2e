export interface HealthStateTooltipManager {
  activate(element: HTMLElement, options: { text: string }): void;
  deactivate(): void;
}

const healthTooltipBindings = new WeakMap<HTMLElement, () => void>();

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
    healthTooltipBindings.get(button)?.();
    const descriptionId = button.dataset.d6e2HealthDescriptionId;
    const text = button.dataset.tooltip;
    if (!descriptionId || !text) return;

    let disposed = false;
    const restoreDescription = (): void => {
      if (
        !disposed &&
        button.getAttribute("aria-describedby") !== descriptionId
      )
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
    const focus = () => {
      tooltip.activate(button, { text });
      restoreDescription();
      restoreAfterTooltipLifecycle();
    };
    const blur = () => {
      tooltip.deactivate();
      restoreAfterTooltipLifecycle();
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      tooltip.deactivate();
      restoreAfterTooltipLifecycle();
    };
    button.addEventListener("focus", focus);
    button.addEventListener("blur", blur);
    button.addEventListener(
      "mouseleave",
      preserveDescriptionThroughHoverTeardown,
    );
    button.addEventListener("keydown", keydown);
    healthTooltipBindings.set(button, () => {
      disposed = true;
      hoverTeardownObserver?.disconnect();
      button.removeEventListener("focus", focus);
      button.removeEventListener("blur", blur);
      button.removeEventListener(
        "mouseleave",
        preserveDescriptionThroughHoverTeardown,
      );
      button.removeEventListener("keydown", keydown);
      healthTooltipBindings.delete(button);
    });
  });
}
