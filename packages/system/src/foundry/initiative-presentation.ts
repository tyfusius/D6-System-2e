import { formatPipScore } from "@d6-system-2e/core";
import { currentInitiativeRuntimeStrategy } from "../settings/initiative";
import { MODERN_INITIATIVE_ID } from "../settings/initiative-tie-editor";
import {
  initiativeAttributeBindingsForActor,
  initiativeBaseBindingsForActor,
  type InitiativeCombatantLike,
} from "./combat-documents";

/** Optional actor details are read only for GM/owners; initiative itself is supplied
 * by the existing authorized row projection (never fetched to fill a hidden row). */
export function initiativePresentation(
  value: number | null | undefined,
  combatant?: InitiativeCombatantLike,
) {
  const strategy = currentInitiativeRuntimeStrategy().id;
  const initiativeDisplay =
    value === undefined ? undefined : value === null ? "—" : String(value);
  let initiativeExplanation: string | undefined;
  if (
    strategy === MODERN_INITIATIVE_ID ||
    strategy === "open-d6.initiative.perception-reflexes"
  ) {
    const authorized =
      game.user?.isGM === true || combatant?.actor?.isOwner === true;
    const actor = authorized ? combatant?.actor : undefined;
    const bindings =
      strategy === MODERN_INITIATIVE_ID
        ? initiativeAttributeBindingsForActor(actor)
        : (() => {
            const fixed = initiativeBaseBindingsForActor(actor);
            return {
              primary: fixed.perception,
              secondary: fixed.reflexes,
              primaryLabel: "D6E2.Attribute.Perception",
              secondaryLabel: "D6E2.Attribute.Reflexes",
            };
          })();
    const label = (key: string) => game.i18n.localize(key);
    initiativeExplanation = game.i18n.format(
      "D6E2.Combat.Initiative.BaseTieExplanation",
      {
        primary: label(bindings.primaryLabel),
        secondary: label(bindings.secondaryLabel),
      },
    );
    if (authorized && value !== undefined && value !== null) {
      initiativeExplanation +=
        " " +
        game.i18n.format("D6E2.Combat.Initiative.BaseTieScores", {
          primary: label(bindings.primaryLabel),
          secondary: label(bindings.secondaryLabel),
          primaryScore:
            bindings.primary === undefined
              ? label("D6E2.Combat.Initiative.MissingBase")
              : formatPipScore(bindings.primary),
          secondaryScore:
            bindings.secondary === undefined
              ? label("D6E2.Combat.Initiative.MissingBase")
              : formatPipScore(bindings.secondary),
        });
    }
  } else if (strategy === "open-d6.initiative.perception") {
    initiativeExplanation = game.i18n.localize(
      "D6E2.Combat.Initiative.LegacyExplanation",
    );
  }
  return {
    initiativeDisplay,
    initiativeExplanation,
    initiativeCompatibility: strategy === "open-d6.initiative.perception",
  };
}

export function presentNativeInitiative(
  element: HTMLElement,
  combatants: readonly InitiativeCombatantLike[],
): void {
  const strategy = currentInitiativeRuntimeStrategy().id;
  if (
    ![
      MODERN_INITIATIVE_ID,
      "open-d6.initiative.perception-reflexes",
      "open-d6.initiative.perception",
    ].includes(strategy)
  )
    return;
  for (const row of Array.from(
    element.querySelectorAll<HTMLElement>(".combatant[data-combatant-id]"),
  )) {
    const combatant = combatants.find((c) => c.id === row.dataset.combatantId);
    if (
      !combatant ||
      combatant.initiative === null ||
      !Number.isFinite(combatant.initiative)
    )
      continue;
    // Native rolled totals may be spans or editable/readonly initiative inputs.
    const target = row.querySelector<HTMLElement>(
      ".token-initiative > span, .token-initiative > input.initiative-input",
    );
    if (!target) continue;
    const view = initiativePresentation(combatant.initiative, combatant);
    const input = target.tagName === "INPUT";
    if (!input && strategy !== "open-d6.initiative.perception")
      target.textContent = view.initiativeDisplay ?? "";
    if (view.initiativeExplanation) {
      target.classList.add("d6e2-initiative-explanation");
      target.dataset.tooltip = "";
      target.dataset.tooltipText = view.initiativeExplanation;
      if (input)
        target.setAttribute("aria-description", view.initiativeExplanation);
      else {
        target.setAttribute(
          "aria-label",
          `${view.initiativeDisplay}. ${view.initiativeExplanation}`,
        );
        target.tabIndex = 0;
      }
    }
  }
  bindInitiativeTooltips(element);
}

/** Foundry 14.367 TooltipManager.activate(text) displays literal text on focus.
 * Keep Tab/native row actions intact; blur and Escape dismiss the help. */
export function bindInitiativeTooltips(root: HTMLElement): void {
  const manager = (
    game as typeof game & {
      tooltip?: {
        element?: HTMLElement | null;
        activate(element: HTMLElement, options: { text: string }): void;
        deactivate(): void;
      };
    }
  ).tooltip;
  if (!manager) return;
  for (const target of Array.from(
    root.querySelectorAll<HTMLElement>(
      ".d6e2-initiative-explanation, .d6e2-round-grid-initiative[data-tooltip][tabindex='0']",
    ),
  )) {
    if (target.dataset.initiativeTooltipBound) continue;
    const originalDescription = target.getAttribute("aria-describedby");
    target.dataset.tooltipText ??= target.dataset.tooltip ?? "";
    const dismiss = () => {
      if (manager.element === target) manager.deactivate();
      if (originalDescription)
        target.setAttribute("aria-describedby", originalDescription);
    };
    target.addEventListener("focus", () =>
      manager.activate(target, { text: target.dataset.tooltipText ?? "" }),
    );
    target.addEventListener("blur", dismiss);
    target.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && manager.element === target) {
        event.preventDefault();
        event.stopPropagation();
        dismiss();
      }
    });
    target.dataset.initiativeTooltipBound = "true";
  }
}
