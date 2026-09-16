import type {
  D6ParticipantKind,
  D6RollMode,
  D6RollOpposition,
} from "@d6-system-2e/core";

export interface RollDialogAuthority {
  readonly manualOppositionAllowed: boolean;
  readonly lockedRollMode?: D6RollMode;
  readonly defaultRollMode: D6RollMode;
}

export function manualOppositionAllowed(context: {
  readonly kind: string;
  readonly fixedDifficulty?: number | undefined;
  readonly targetControlled?: boolean | undefined;
  readonly requestOwned?: boolean | undefined;
}): boolean {
  return (
    context.kind !== "resistance" &&
    context.fixedDifficulty === undefined &&
    !context.targetControlled &&
    !context.requestOwned
  );
}

// Match the existing chase participant adapter; ownership is not character type.
export function rollActorParticipantKind(type: string): D6ParticipantKind {
  return type === "character"
    ? "player-character"
    : ["npc", "creature"].includes(type)
      ? "non-player-character"
      : "unknown";
}

export function effectiveRollDialogMode(
  authority: RollDialogAuthority,
  selected: string,
): D6RollMode {
  return (
    authority.lockedRollMode ??
    (["publicroll", "gmroll", "blindroll", "selfroll"].includes(selected)
      ? (selected as D6RollMode)
      : authority.defaultRollMode)
  );
}

export function rollVisibility(
  mode: D6RollMode,
  localize: (key: string) => string,
  locked = false,
) {
  const suffix = {
    publicroll: "Public",
    gmroll: "Gm",
    blindroll: "Blind",
    selfroll: "Self",
  }[mode];
  const icon = {
    publicroll: "fa-earth-americas",
    gmroll: "fa-user-shield",
    blindroll: "fa-eye-slash",
    selfroll: "fa-user-lock",
  }[mode];
  return { mode, label: localize(`D6E2.Roll.Mode.${suffix}`), icon, locked };
}

const bounds: Record<string, { min?: number; max?: number }> = {
  mapPenaltyDice: { min: 0 },
  manualDiceAdjustment: { min: -99, max: 99 },
  resultModifier: {},
  difficulty: {},
  oppositionTotal: {},
  oppositionWildDie: { min: 1, max: 6 },
};

export function validRollNumber(value: number, name: string): boolean {
  const limit = bounds[name] ?? {};
  return (
    Number.isSafeInteger(value) &&
    (limit.min === undefined || value >= limit.min) &&
    (limit.max === undefined || value <= limit.max)
  );
}

/** Defence in depth after the dialog returns, before any costs/roll preparation. */
export function assertRollDialogSubmission(
  controls: {
    readonly mapPenaltyDice: number;
    readonly manualDiceAdjustment: number;
    readonly resultModifier: number;
    readonly difficulty?: number;
    readonly opposition?: D6RollOpposition;
  },
  authority: RollDialogAuthority,
): void {
  if (controls.opposition !== undefined && !authority.manualOppositionAllowed)
    throw new Error("D6E2.Roll.Options.OppositionUnavailable");
  const values = {
    mapPenaltyDice: controls.mapPenaltyDice,
    manualDiceAdjustment: controls.manualDiceAdjustment,
    resultModifier: controls.resultModifier,
    difficulty: controls.difficulty,
    oppositionTotal: controls.opposition?.total,
    oppositionWildDie: controls.opposition?.wildDieFace,
  };
  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined && !validRollNumber(value, name))
      throw new Error("D6E2.Roll.Options.InvalidNumber");
  }
}

function field(
  root: ParentNode,
  name: string,
): HTMLInputElement | HTMLSelectElement | null {
  return root.querySelector<HTMLInputElement | HTMLSelectElement>(
    `[name="${name}"]`,
  );
}
function numberValue(root: ParentNode, name: string): number | undefined {
  const value = field(root, name)?.value.trim() ?? "";
  if (!value) return undefined;
  const number = Number(value);
  return validRollNumber(number, name) ? number : undefined;
}

export function revealRollField(input: HTMLElement): void {
  for (
    let parent = input.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    if (parent.tagName === "DETAILS") parent.setAttribute("open", "");
    if (parent.hasAttribute("data-opposition-wild-field"))
      parent.hidden = false;
  }
  input.focus();
}

let nextErrorId = 0;

function showError(input: HTMLInputElement, message: string): void {
  input.setAttribute("aria-invalid", "true");
  let error = input.parentElement?.querySelector<HTMLElement>(
    "[data-roll-field-error]",
  );
  if (!error) {
    error = input.ownerDocument.createElement("small");
    error.dataset.rollFieldError = "";
    error.id = `roll-field-error-${++nextErrorId}-${input.name}`;
    input.parentElement?.append(error);
  }
  error.textContent = message;
  error.hidden = false;
  const describedBy = new Set(
    (input.getAttribute("aria-describedby") ?? "")
      .split(/\s+/u)
      .filter(Boolean),
  );
  describedBy.add(error.id);
  input.setAttribute("aria-describedby", [...describedBy].join(" "));
  revealRollField(input);
  // Keep focus on the editable value, but expose its complete error row too.
  const errorHost = error.parentElement ?? input.parentElement;
  if (typeof errorHost?.scrollIntoView === "function") {
    errorHost.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

/** Validate the raw text before inputNumber can truncate or drop it. */
export function validateRollDialogForm(
  root: ParentNode,
  authority: RollDialogAuthority,
  localize: (key: string) => string,
): boolean {
  for (const input of Array.from(
    root.querySelectorAll<HTMLInputElement>("input[type=number]"),
  )) {
    if (input.disabled) continue;
    const raw = input.value.trim();
    const value = Number(raw);
    const min = input.getAttribute("min");
    const max = input.getAttribute("max");
    const step = input.getAttribute("step");
    const invalid =
      input.validity.badInput ||
      (raw !== "" &&
        (!validRollNumber(value, input.name) ||
          (min !== null && value < Number(min)) ||
          (max !== null && value > Number(max)) ||
          (step !== null &&
            step !== "any" &&
            (value - Number(min ?? 0)) % Number(step) !== 0)));
    if (invalid) {
      showError(input, localize("D6E2.Roll.Options.InvalidNumber"));
      return false;
    }
  }
  const opposition = field(root, "oppositionTotal");
  if (!authority.manualOppositionAllowed && opposition?.value.trim()) {
    showError(
      opposition as HTMLInputElement,
      localize("D6E2.Roll.Options.OppositionUnavailable"),
    );
    return false;
  }
  return true;
}

export function rollNumberStep(
  raw: string,
  direction: number,
  min?: number,
  max?: number,
  step = 1,
): number | undefined {
  const current = raw.trim() === "" ? 0 : Number(raw);
  if (
    !Number.isSafeInteger(current) ||
    !Number.isSafeInteger(step) ||
    step <= 0
  )
    return undefined;
  const next = Math.min(
    max ?? Infinity,
    Math.max(min ?? -Infinity, current + direction * step),
  );
  return Number.isSafeInteger(next) ? next : undefined;
}

export function updateRollDescriptions(root: ParentNode): void {
  const excerpt = root.querySelector<HTMLElement>("[data-roll-description]");
  const full = root.querySelector<HTMLElement>("[data-roll-description-full]");
  const details = root.querySelector<HTMLElement>(
    "[data-roll-description-disclosure]",
  );
  const region = root.querySelector<HTMLElement>(
    "[data-roll-description-region]",
  );
  const select = field(root, "advancedSkillItemId") as HTMLSelectElement | null;
  const option = select?.value
    ? Array.from(select.querySelectorAll<HTMLOptionElement>("option")).find(
        (option) => option.value === select.value,
      )
    : undefined;
  const shortText = option
    ? (option.dataset.description ?? "")
    : (excerpt?.dataset.baseDescription ?? "");
  const fullText = option
    ? (option.dataset.descriptionFull ?? shortText)
    : (full?.dataset.baseDescriptionFull ?? shortText);
  if (excerpt) {
    excerpt.textContent = shortText;
    excerpt.hidden =
      shortText.length === 0 ||
      (fullText !== shortText && details?.hasAttribute("open") === true);
  }
  if (full) full.textContent = fullText;
  if (details) details.hidden = fullText.length === 0 || fullText === shortText;
  if (region) region.hidden = shortText.length === 0 && fullText.length === 0;
}

export function rollDialogComparison(
  root: ParentNode,
  authority: RollDialogAuthority,
  difficulty: number | undefined,
): { opposed: boolean; value: number | undefined } {
  const total = authority.manualOppositionAllowed
    ? numberValue(root, "oppositionTotal")
    : undefined;
  return total === undefined
    ? { opposed: false, value: difficulty }
    : { opposed: true, value: total };
}

export function updateRollDialogSummaries(
  root: ParentNode,
  authority: RollDialogAuthority,
  localize: (key: string) => string,
): void {
  let mode = effectiveRollDialogMode(
    authority,
    field(root, "rollMode")?.value ?? "",
  );
  const target = field(root, "targetId") as HTMLSelectElement | null;
  const option = Array.from(target?.options ?? []).find(
    (option) => option.value === target?.value,
  );
  if (
    target?.dataset.targetPurpose === "attack" &&
    option?.dataset.hidden === "true" &&
    !["gmroll", "blindroll"].includes(mode)
  )
    mode = "gmroll";
  const visibility = rollVisibility(mode, localize);
  const visibilityLabel = root.querySelector<HTMLElement>(
    "[data-roll-visibility-label]",
  );
  if (visibilityLabel) visibilityLabel.textContent = visibility.label;
  const visibilityIcon = root.querySelector<HTMLElement>(
    "[data-roll-visibility-icon]",
  );
  if (visibilityIcon) visibilityIcon.className = `fa-solid ${visibility.icon}`;
  const parts = [visibility.label];
  const signed = (value: number) =>
    `${value > 0 ? "+" : "−"}${Math.abs(value)}`;
  for (const [name, key, unit, multiplier] of [
    ["mapPenaltyDice", "Map", "D", -1],
    ["manualDiceAdjustment", "Dice", "D", 1],
    ["resultModifier", "Total", "", 1],
  ] as const) {
    const value = numberValue(root, name);
    if (value)
      parts.push(
        `${localize(`D6E2.Roll.Options.${key}`)} ${signed(value * multiplier)}${unit}`,
      );
    else if (field(root, name)?.value.trim() && value === undefined)
      parts.push(localize("D6E2.Roll.Options.InvalidNumber"));
  }
  if (parts.length === 1) parts.push(localize("D6E2.Roll.Options.None"));
  const summary = root.querySelector<HTMLElement>(
    "[data-roll-options-summary]",
  );
  if (summary) summary.textContent = parts.join(" · ");
  const total = numberValue(root, "oppositionTotal");
  const opposition = root.querySelector<HTMLElement>(
    "[data-manual-opposition-summary]",
  );
  const incomplete = [
    "oppositionName",
    "oppositionTotal",
    "oppositionWildDie",
    "actorKind",
    "opponentKind",
  ].some((name) => {
    const input = field(root, name);
    return (
      input !== null && input.value !== (input.dataset.initialRollValue ?? "")
    );
  });
  const opponentName = field(root, "oppositionName")?.value.trim() ?? "";
  if (opposition)
    opposition.textContent =
      total !== undefined && authority.manualOppositionAllowed
        ? `${opponentName.length > 0 ? opponentName : localize("D6E2.Roll.Opposition.DefaultName")} ${total}`
        : localize(
            incomplete
              ? "D6E2.Roll.Opposition.Incomplete"
              : "D6E2.Roll.Opposition.NotSet",
          );
  const wild = root.querySelector<HTMLElement>("[data-opposition-wild-field]");
  if (wild)
    wild.hidden =
      !field(root, "oppositionWildDie")?.value.trim() &&
      (field(root, "actorKind")?.value !== "player-character" ||
        field(root, "opponentKind")?.value !== "player-character");
  for (const wrapper of Array.from(
    root.querySelectorAll<HTMLElement>("[data-roll-number-control]"),
  )) {
    const input = wrapper.querySelector<HTMLInputElement>("input");
    if (!input) continue;
    const value = input.value.trim() === "" ? undefined : Number(input.value);
    for (const button of Array.from(
      wrapper.querySelectorAll<HTMLButtonElement>("[data-roll-step]"),
    )) {
      const limit = input.getAttribute(
        Number(button.dataset.rollStep) < 0 ? "min" : "max",
      );
      button.disabled =
        input.disabled ||
        input.readOnly ||
        (value !== undefined &&
          Number.isFinite(value) &&
          limit !== null &&
          (Number(button.dataset.rollStep) < 0
            ? value <= Number(limit)
            : value >= Number(limit)));
    }
  }
}

export function bindRollDialogControls(
  root: HTMLElement,
  authority: RollDialogAuthority,
  localize: (key: string) => string,
  updatePreview: () => void,
): void {
  if (root.dataset.rollControlsBound === "true") return;
  root.dataset.rollControlsBound = "true";
  for (const input of Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select"),
  ))
    input.dataset.initialRollValue = input.value;
  const refresh = () => {
    updateRollDialogSummaries(root, authority, localize);
    updateRollDescriptions(root);
  };
  root.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;
    input.removeAttribute("aria-invalid");
    const error = input.parentElement?.querySelector<HTMLElement>(
      "[data-roll-field-error]",
    );
    if (error) error.hidden = true;
    refresh();
    if (
      ["oppositionTotal", "oppositionWildDie", "resultModifier"].includes(
        input.name,
      )
    )
      updatePreview();
  });
  root.addEventListener("change", refresh);
  root
    .querySelector("[data-roll-description-disclosure]")
    ?.addEventListener("toggle", () => updateRollDescriptions(root));
  root.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "[data-roll-step]",
    );
    if (!button || button.disabled) return;
    const input = button
      .closest("[data-roll-number-control]")
      ?.querySelector<HTMLInputElement>("input");
    if (!input || input.disabled || input.readOnly) return;
    const next = rollNumberStep(
      input.value,
      Number(button.dataset.rollStep),
      input.hasAttribute("min") ? Number(input.getAttribute("min")) : undefined,
      input.hasAttribute("max") ? Number(input.getAttribute("max")) : undefined,
      input.hasAttribute("step") ? Number(input.getAttribute("step")) : 1,
    );
    if (next === undefined) {
      showError(input, localize("D6E2.Roll.Options.InvalidNumber"));
      return;
    }
    input.value = String(next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  // Capture before DialogV2's submit callback; also validate inside that callback.
  const stopInvalid = (event: Event) => {
    const submitter =
      event.type === "click"
        ? (event.target as Element).closest(
            "[data-action='roll'],.od6roll-submit",
          )
        : (event as SubmitEvent).submitter;
    if (event.type === "click" && !submitter) return;
    if ((submitter as HTMLElement | null)?.dataset.action === "cancel") return;
    if (!validateRollDialogForm(root, authority, localize)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  root.addEventListener("click", stopInvalid, true);
  root.addEventListener("submit", stopInvalid, true);
  root.addEventListener(
    "invalid",
    (event) => {
      const input = event.target as HTMLInputElement;
      event.preventDefault();
      showError(input, localize("D6E2.Roll.Options.InvalidNumber"));
    },
    true,
  );
  refresh();
}
