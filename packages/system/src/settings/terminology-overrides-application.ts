import type { D6System2eTerminologyContribution } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { currentPackageTerminology } from "../registries/terminology";
import {
  currentSettingProfile,
  saveCurrentSettingProfile,
} from "./setting-profile";
import {
  TERMINOLOGY_OVERRIDE_FIELDS,
  terminologyOverridesFromEntries,
  terminologyOverrideValue,
} from "./terminology-overrides";

export async function openSettingProfileTerminologyEditor(): Promise<boolean> {
  const profile = currentSettingProfile();
  const packageTerminology = currentPackageTerminology();
  const inherited: D6System2eTerminologyContribution = {
    ...packageTerminology,
    attributes: {
      ...packageTerminology.attributes,
      ...Object.fromEntries(
        profile.attributes.map(({ id, label }) => [id, label]),
      ),
    },
  };
  const groupDefinitions = [
    ["presentation", "D6E2.Settings.Terminology.Presentation"],
    ["attributes", "D6E2.Settings.Terminology.Attributes"],
    ["resources", "D6E2.Settings.Terminology.Resources"],
    ["details", "D6E2.Settings.Terminology.Details"],
    ["metaphysics", "D6E2.Settings.Terminology.Metaphysics"],
    ["machines", "D6E2.Settings.Terminology.Machines"],
  ] as const;
  const groups = groupDefinitions.map(([id, label]) => ({
    fields: TERMINOLOGY_OVERRIDE_FIELDS.filter(
      (definition) => definition.group === id,
    ).map((definition) => ({
      label: game.i18n.localize(definition.label),
      path: definition.path,
      placeholder:
        terminologyOverrideValue(inherited, definition.path) ||
        game.i18n.localize(definition.defaultLabel),
      value: terminologyOverrideValue(profile.terminology, definition.path),
    })),
    id,
    label: game.i18n.localize(label),
  }));
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/settings/terminology-overrides.hbs`,
    { groups, profileLabel: profile.label },
  );
  const result = await foundry.applications.api.DialogV2.wait<
    | { readonly action: "reset" }
    | {
        readonly action: "save";
        readonly contribution: ReturnType<
          typeof terminologyOverridesFromEntries
        >;
      }
  >({
    buttons: [
      {
        action: "cancel",
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "reset",
        callback: () => ({ action: "reset" }),
        label: game.i18n.localize("D6E2.Settings.Terminology.RestoreInherited"),
      },
      {
        action: "save",
        callback: (_event, button) => ({
          action: "save",
          contribution: terminologyOverridesFromEntries(
            button.form
              ? Array.from(
                  button.form.querySelectorAll<HTMLInputElement>("input[name]"),
                ).map((input) => [input.name, input.value] as const)
              : [],
          ),
        }),
        class: "od6roll-submit",
        default: true,
        label: game.i18n.localize("D6E2.Save"),
      },
    ],
    classes: [
      "d6e2",
      "od6roll-dialog",
      "d6e2-wide-dialog",
      "d6e2-terminology-dialog",
    ],
    content,
    modal: true,
    position: { width: 720 },
    rejectClose: false,
    window: {
      icon: "fa-solid fa-signature",
      title: game.i18n.format("D6E2.Settings.Terminology.ProfileTitle", {
        profile: profile.label,
      }),
    },
  });
  if (!result) return false;
  await saveCurrentSettingProfile({
    ...profile,
    terminology: result.action === "reset" ? {} : result.contribution,
  });
  ui.notifications.info(
    game.i18n.localize(
      result.action === "reset"
        ? "D6E2.Settings.Terminology.Restored"
        : "D6E2.Settings.Terminology.Saved",
    ),
  );
  return true;
}
