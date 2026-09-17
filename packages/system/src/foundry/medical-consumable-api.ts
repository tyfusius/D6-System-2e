import {
  MODEL_B_STIM_EFFECT_ID,
  type D6MedicalConsumableReadModelV1,
} from "@d6-system-2e/core";
import { currentConfiguredRulesProfile } from "../settings/rules-profile-library";
import {
  gridStorageAvailabilityForItem,
  requireGridStorageItemAction,
} from "./grid-storage-availability";
import { record } from "./sheets/values";

function authorizedActor(
  value: object,
): (FoundryActorDocument & { readonly uuid: string }) | null {
  const actor = value as Partial<FoundryActorDocument>;
  const user = game.user;
  if (
    !actor.uuid ||
    !actor.items ||
    !user?.active ||
    !(user.isGM || actor.testUserPermission?.(user, "OWNER"))
  )
    return null;
  return actor as FoundryActorDocument & { readonly uuid: string };
}

function supportedStim(item: FoundryItemDocument): boolean {
  const medical = record(item.system.medicalConsumable);
  const duration = record(medical.duration);
  return (
    item.type === "gear" &&
    item.system.gearCategory === "medical-consumable" &&
    Number.isSafeInteger(item.system.quantity) &&
    Number(item.system.quantity) > 0 &&
    medical.version === 1 &&
    medical.effectId === MODEL_B_STIM_EFFECT_ID &&
    medical.compatibility === "biological" &&
    medical.treatmentFamily === "none" &&
    medical.actionCost === 1 &&
    medical.doseCost === 1 &&
    duration.dice === 1 &&
    duration.faces === 6 &&
    duration.unit === "rounds"
  );
}

export async function readMedicalConsumables(
  value: object,
): Promise<readonly D6MedicalConsumableReadModelV1[]> {
  const actor = authorizedActor(value);
  if (
    !actor ||
    !currentConfiguredRulesProfile().homebrew.tyfusiusMedicalConsumables
  )
    return Object.freeze([]);
  const candidates = actor.items.contents.filter(supportedStim);
  const available = await Promise.all(
    candidates.map(async (item) => {
      try {
        const access = await gridStorageAvailabilityForItem(item, actor.uuid);
        if (!access.canUse) return null;
        return Object.freeze({
          id: item.id,
          name: item.name,
          image: item.img,
          quantity: Number(item.system.quantity),
          actionCost: 1 as const,
          doseCost: 1 as const,
        });
      } catch {
        // An unavailable authority or storage projection must not advertise usable equipment.
        return null;
      }
    }),
  );
  return Object.freeze(available.filter((item) => item !== null));
}

export async function beginMedicalConsumableUse(
  value: object,
  itemId: string,
): Promise<void> {
  const actor = authorizedActor(value);
  if (!actor) throw new Error("D6E2.Medical.Unavailable");
  if (!currentConfiguredRulesProfile().homebrew.tyfusiusMedicalConsumables)
    throw new Error("D6E2.Medical.RulesDisabled");
  const item = actor.items.get(itemId);
  if (!item || !supportedStim(item) || item.parent?.uuid !== actor.uuid)
    throw new Error("D6E2.Medical.Unavailable");
  await requireGridStorageItemAction(item, actor.uuid, "use");
  const { openMedicalConsumableUseDialog } =
    await import("./medical-consumable-dialog");
  // The existing dialog/root owns patient consent, quantity and one-action receipts.
  openMedicalConsumableUseDialog(item);
}
