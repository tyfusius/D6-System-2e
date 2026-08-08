const BRAND_MARK_CLASS = "echo-brand-mark";

interface ApplicationElementOwner {
  readonly element?: HTMLElement | null;
}

function brandingSurfaces(element: HTMLElement): readonly HTMLElement[] {
  if (element.classList.contains("od6s-item-v2")) {
    return Array.from(
      element.querySelectorAll<HTMLElement>(".od6item-section-heading"),
    );
  }
  if (element.classList.contains("od6roll-dialog")) {
    const identity = element.querySelector<HTMLElement>(".od6roll-identity");
    return identity ? [identity] : [];
  }
  return [];
}

export function removeEchoBranding(root: ParentNode = document): void {
  for (const mark of Array.from(root.querySelectorAll(`.${BRAND_MARK_CLASS}`)))
    mark.remove();
}

export function applyEchoBranding(
  application: ApplicationElementOwner,
): boolean {
  const element = application.element;
  if (!element) return false;

  const surfaces = brandingSurfaces(element);
  for (const surface of surfaces) {
    if (surface.querySelector(`.${BRAND_MARK_CLASS}`)) continue;

    const mark = document.createElement("span");
    mark.className = BRAND_MARK_CLASS;
    mark.dataset.companionBranding = "echo-d6";
    mark.setAttribute("aria-hidden", "true");

    const logo = document.createElement("span");
    logo.className = "echo-brand-logo";
    mark.append(logo);

    const trailingControls = surface.querySelector<HTMLElement>(
      ".od6v2-theme-control, .od6v2-toolbar-actions",
    );
    surface.insertBefore(mark, trailingControls);
  }
  return surfaces.length > 0;
}
