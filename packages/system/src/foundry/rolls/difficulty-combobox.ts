interface DifficultyListboxRect {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly width: number;
}

interface DifficultyListboxPlacementOptions {
  readonly anchor: DifficultyListboxRect;
  readonly bounds: DifficultyListboxRect;
  readonly optionCount: number;
  readonly optionHeight: number;
  readonly panelChromeHeight: number;
}

interface DifficultyListboxPlacement {
  readonly left: number;
  readonly maxHeight: number;
  readonly placement: "above" | "below";
  readonly top: number;
  readonly width: number;
}

const LISTBOX_GAP = 4;
const MINIMUM_VISIBLE_OPTIONS = 4;
const VIEWPORT_MARGIN = 8;

export function difficultyListboxPlacement(
  options: DifficultyListboxPlacementOptions,
): DifficultyListboxPlacement {
  const optionCount = Math.max(1, options.optionCount);
  const optionHeight = Math.max(1, options.optionHeight);
  const panelChromeHeight = Math.max(0, options.panelChromeHeight);
  const desiredHeight = optionCount * optionHeight + panelChromeHeight;
  const minimumHeight =
    Math.min(MINIMUM_VISIBLE_OPTIONS, optionCount) * optionHeight +
    panelChromeHeight;
  const availableAbove = Math.max(
    0,
    options.anchor.top - options.bounds.top - LISTBOX_GAP,
  );
  const availableBelow = Math.max(
    0,
    options.bounds.bottom - options.anchor.bottom - LISTBOX_GAP,
  );
  const placement =
    availableBelow >= desiredHeight
      ? "below"
      : availableAbove >= desiredHeight
        ? "above"
        : availableBelow >= minimumHeight
          ? "below"
          : availableAbove >= minimumHeight
            ? "above"
            : availableBelow >= availableAbove
              ? "below"
              : "above";
  const availableHeight =
    placement === "below" ? availableBelow : availableAbove;
  const maxHeight = Math.min(desiredHeight, availableHeight);
  const boundsWidth = Math.max(0, options.bounds.right - options.bounds.left);
  const width = Math.min(options.anchor.width, boundsWidth);
  const left = Math.min(
    Math.max(options.anchor.left, options.bounds.left),
    Math.max(options.bounds.left, options.bounds.right - width),
  );
  const top =
    placement === "below"
      ? options.anchor.bottom + LISTBOX_GAP
      : options.anchor.top - LISTBOX_GAP - maxHeight;
  return { left, maxHeight, placement, top, width };
}

export function bindDifficultySuggestionComboboxes(
  container: HTMLElement,
  onValueChange: (input: HTMLInputElement) => void,
): void {
  for (const root of Array.from(
    container.querySelectorAll<HTMLElement>("[data-difficulty-combobox]"),
  )) {
    bindDifficultySuggestionCombobox(root, onValueChange);
  }
}

function bindDifficultySuggestionCombobox(
  root: HTMLElement,
  onValueChange: (input: HTMLInputElement) => void,
): void {
  const input = root.querySelector<HTMLInputElement>(
    "[data-difficulty-input], input[name='difficulty']",
  );
  const toggle = root.querySelector<HTMLButtonElement>(
    '[data-action="toggleDifficultySuggestions"]',
  );
  const listbox = root.querySelector<HTMLElement>('[role="listbox"]');
  const options = Array.from(
    root.querySelectorAll<HTMLButtonElement>(
      '[role="option"][data-difficulty-value]',
    ),
  );
  if (!input || !toggle || !listbox || options.length === 0) return;

  let activeIndex = -1;
  let placementListenersBound = false;
  listbox.setAttribute("popover", "manual");
  const matchingIndex = (): number =>
    options.findIndex(
      (option) => option.dataset.difficultyValue === input.value,
    );
  const synchronizeSelection = (): void => {
    options.forEach((option) => {
      option.setAttribute(
        "aria-selected",
        String(option.dataset.difficultyValue === input.value),
      );
    });
  };
  const setActive = (index: number): void => {
    activeIndex = Math.max(0, Math.min(options.length - 1, index));
    options.forEach((option, optionIndex) => {
      option.classList.toggle("is-active", optionIndex === activeIndex);
    });
    const active = options[activeIndex];
    if (!active) return;
    input.setAttribute("aria-activedescendant", active.id);
    const activeTop = active.offsetTop;
    const activeBottom = activeTop + active.offsetHeight;
    if (activeTop < listbox.scrollTop) listbox.scrollTop = activeTop;
    else if (activeBottom > listbox.scrollTop + listbox.clientHeight) {
      listbox.scrollTop = activeBottom - listbox.clientHeight;
    }
  };
  const positionListbox = (): void => {
    const anchor = input.getBoundingClientRect();
    const application = root.closest<HTMLElement>(".application");
    const applicationRect = application?.getBoundingClientRect();
    const viewportRight = window.innerWidth - VIEWPORT_MARGIN;
    const viewportBottom = window.innerHeight - VIEWPORT_MARGIN;
    const bounds = {
      bottom: Math.min(
        viewportBottom,
        (applicationRect?.bottom ?? viewportBottom) - VIEWPORT_MARGIN,
      ),
      left: Math.max(
        VIEWPORT_MARGIN,
        (applicationRect?.left ?? 0) + VIEWPORT_MARGIN,
      ),
      right: Math.min(
        viewportRight,
        (applicationRect?.right ?? viewportRight) - VIEWPORT_MARGIN,
      ),
      top: Math.max(
        VIEWPORT_MARGIN,
        (applicationRect?.top ?? 0) + VIEWPORT_MARGIN,
      ),
      width: 0,
    };
    const optionHeight = Math.max(
      44,
      ...options.map((option) => option.offsetHeight),
    );
    const optionContentHeight = options.reduce(
      (height, option) => height + option.offsetHeight,
      0,
    );
    const placement = difficultyListboxPlacement({
      anchor,
      bounds,
      optionCount: options.length,
      optionHeight,
      panelChromeHeight: Math.max(
        0,
        listbox.scrollHeight - optionContentHeight,
      ),
    });
    listbox.dataset.difficultyPlacement = placement.placement;
    listbox.style.setProperty(
      "--d6e2-difficulty-listbox-left",
      `${placement.left}px`,
    );
    listbox.style.setProperty(
      "--d6e2-difficulty-listbox-max-height",
      `${placement.maxHeight}px`,
    );
    listbox.style.setProperty(
      "--d6e2-difficulty-listbox-top",
      `${placement.top}px`,
    );
    listbox.style.setProperty(
      "--d6e2-difficulty-listbox-width",
      `${placement.width}px`,
    );
  };
  const bindPlacementListeners = (): void => {
    if (placementListenersBound) return;
    window.addEventListener("resize", positionListbox);
    document.addEventListener("scroll", positionListbox, true);
    placementListenersBound = true;
  };
  const unbindPlacementListeners = (): void => {
    if (!placementListenersBound) return;
    window.removeEventListener("resize", positionListbox);
    document.removeEventListener("scroll", positionListbox, true);
    placementListenersBound = false;
  };
  const open = (direction: 1 | -1 = 1): void => {
    listbox.hidden = false;
    listbox.showPopover();
    positionListbox();
    bindPlacementListeners();
    input.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-expanded", "true");
    const matched = matchingIndex();
    setActive(matched >= 0 ? matched : direction > 0 ? 0 : options.length - 1);
  };
  const close = (): void => {
    unbindPlacementListeners();
    if (listbox.matches(":popover-open")) listbox.hidePopover();
    listbox.hidden = true;
    input.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    options.forEach((option) => option.classList.remove("is-active"));
    delete listbox.dataset.difficultyPlacement;
    for (const property of [
      "--d6e2-difficulty-listbox-left",
      "--d6e2-difficulty-listbox-max-height",
      "--d6e2-difficulty-listbox-top",
      "--d6e2-difficulty-listbox-width",
    ]) {
      listbox.style.removeProperty(property);
    }
    activeIndex = -1;
  };
  const choose = (option: HTMLButtonElement): void => {
    input.value = option.dataset.difficultyValue ?? "";
    synchronizeSelection();
    close();
    input.focus();
    onValueChange(input);
  };

  synchronizeSelection();
  toggle.addEventListener("click", () => {
    if (listbox.hidden) open();
    else close();
    input.focus();
  });
  input.addEventListener("input", () => {
    synchronizeSelection();
    if (!listbox.hidden) {
      const matched = matchingIndex();
      if (matched >= 0) setActive(matched);
    }
    onValueChange(input);
  });
  input.addEventListener("keydown", (event) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        event.stopPropagation();
        if (listbox.hidden) open(1);
        else setActive(activeIndex + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        event.stopPropagation();
        if (listbox.hidden) open(-1);
        else setActive(activeIndex - 1);
        break;
      case "Home":
        if (listbox.hidden) return;
        event.preventDefault();
        event.stopPropagation();
        setActive(0);
        break;
      case "End":
        if (listbox.hidden) return;
        event.preventDefault();
        event.stopPropagation();
        setActive(options.length - 1);
        break;
      case "Enter": {
        if (listbox.hidden || activeIndex < 0) return;
        event.preventDefault();
        event.stopPropagation();
        const active = options[activeIndex];
        if (active) choose(active);
        break;
      }
      case "Escape":
        if (listbox.hidden) return;
        event.preventDefault();
        event.stopPropagation();
        close();
        break;
      case "Tab":
        close();
        break;
    }
  });
  options.forEach((option) => {
    option.addEventListener("pointerdown", (event) => event.preventDefault());
    option.addEventListener("click", () => choose(option));
  });
  root.addEventListener("focusout", (event) => {
    const next = event.relatedTarget;
    if (next instanceof Node && root.contains(next)) return;
    close();
  });
}
