import {
  formatPipScore,
  type D6ResolvedExtraordinaryPowerFrameworkV1,
  type D6System2eApiV2,
} from "@d6-system-2e/core";
import { record, stringValue } from "./values";

interface BindingOption {
  readonly id: string;
  readonly label: string;
  readonly selected: boolean;
}

function frameworkStorageKey(frameworkId: string): string {
  return frameworkId.replaceAll("%", "%25").replaceAll(".", "%2E");
}

function itemKey(item: FoundryItemDocument): string {
  return stringValue(item.system.key);
}

function actorUsesFramework(
  actor: FoundryActorDocument,
  definition: D6ResolvedExtraordinaryPowerFrameworkV1,
): boolean {
  const frameworks = record(
    record(actor.system.extraordinaryPowers).frameworks,
  );
  if (
    Object.hasOwn(frameworks, frameworkStorageKey(definition.id)) ||
    Object.hasOwn(frameworks, definition.id)
  ) {
    return true;
  }

  const skillKeys = new Set(
    definition.skillRoles.flatMap(({ itemKey: key }) => (key ? [key] : [])),
  );
  const powerKeys = new Set(
    definition.powers.map(({ id, itemKey: key }) => key ?? id),
  );
  return actor.items.contents.some(
    (item) =>
      (item.type === "skill" && skillKeys.has(itemKey(item))) ||
      (item.type === "manifestation" && powerKeys.has(itemKey(item))),
  );
}

export function extraordinaryPowerSheetModel(
  actor: FoundryActorDocument,
  api: D6System2eApiV2,
) {
  const skillItems = actor.items.contents.filter(
    (item) => item.type === "skill",
  );
  const manifestationItems = actor.items.contents.filter(
    (item) => item.type === "manifestation",
  );
  const editable = actor.isOwner === true;

  return Object.freeze({
    editable,
    frameworks: Object.freeze(
      api.extraordinaryPowerFrameworkRegistry
        .current()
        .filter((definition) => actorUsesFramework(actor, definition))
        .map((definition) => {
          const state = api.extraordinaryPowers.read(actor, definition.id);
          const roleLabels = new Map(
            definition.skillRoles.map(({ id, label }) => [id, label]),
          );
          const powerLabels = new Map(
            definition.powers.map(({ id, label }) => [id, label]),
          );
          const options = (
            items: readonly FoundryItemDocument[],
            selectedId: string,
          ): readonly BindingOption[] =>
            Object.freeze(
              items.map((item) =>
                Object.freeze({
                  id: item.id,
                  label: item.name,
                  selected: item.id === selectedId,
                }),
              ),
            );

          return Object.freeze({
            canBuild: editable,
            id: definition.id,
            label: definition.label,
            ownerId: definition.ownerId,
            powers: Object.freeze(
              definition.powers.flatMap((power) => {
                const current = state.powers.find(({ id }) => id === power.id);
                const matchingOwnedItem = manifestationItems.find(
                  (item) => itemKey(item) === (power.itemKey ?? power.id),
                );
                if (!current?.boundItemId && !matchingOwnedItem) return [];
                const missingLabels = [
                  ...(current?.missingRoleIds ?? []).map(
                    (id) => roleLabels.get(id) ?? id,
                  ),
                  ...(current?.missingPowerIds ?? []).map(
                    (id) => powerLabels.get(id) ?? id,
                  ),
                  ...(current?.boundItemId ? [] : ["Manifestation"]),
                ];
                return [
                  Object.freeze({
                    available: current?.available === true,
                    bindingOptions: options(
                      manifestationItems,
                      current?.boundItemId ?? "",
                    ),
                    boundItemId: current?.boundItemId ?? "",
                    canActivate:
                      editable &&
                      current?.available === true &&
                      !current.maintained,
                    canDeactivate: editable && current?.maintained === true,
                    canOpenBuilder: editable && !current?.maintained,
                    checkLabel: power.checks
                      .map(
                        ({ difficulty, difficultyMode, skillRoleId }) =>
                          `${roleLabels.get(skillRoleId) ?? skillRoleId} ${difficulty}${difficultyMode === "prompt" ? "+" : ""}`,
                      )
                      .join(" · "),
                    id: power.id,
                    label: power.label,
                    maintained: current?.maintained === true,
                    maintenance: power.maintenance,
                    missingLabel: missingLabels.join(", "),
                    rollActionLabel:
                      current?.available === true
                        ? "D6E2.ExtraordinaryPower.OpenRollBuilder"
                        : "D6E2.ExtraordinaryPower.ResolveSetup",
                  }),
                ];
              }),
            ),
            resources: Object.freeze(
              state.resources.map((resource) =>
                Object.freeze({
                  ...resource,
                  editable: editable && resource.kind === "consequence-track",
                }),
              ),
            ),
            skillRoles: Object.freeze(
              definition.skillRoles.map((role) => {
                const current = state.skillBindings.find(
                  ({ roleId }) => roleId === role.id,
                );
                return Object.freeze({
                  available: current?.available === true,
                  bindingOptions: options(skillItems, current?.itemId ?? ""),
                  canRoll: editable && current?.available === true,
                  id: role.id,
                  itemId: current?.itemId ?? "",
                  label: role.label,
                  scoreLabel: formatPipScore(current?.score ?? 0),
                });
              }),
            ),
          });
        }),
    ),
  });
}
