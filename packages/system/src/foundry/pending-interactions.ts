import {
  registerD6PendingInteraction,
  reopenD6PendingInteraction,
  type RegisterD6PendingInteractionOptions,
} from "../application/pending-interactions";
import { SYSTEM_ID } from "../constants";
import { SHARED_SETTING_KEYS } from "../settings/settings-catalog";
import { booleanSetting } from "../settings/setting-values";

export const PENDING_INTERACTION_DELIVERY_LEDGER =
  "pendingInteractionDeliveryLedger";

interface DeliveryLedgerEntry {
  readonly expiresAt: number;
  readonly id: string;
}

let automaticDeliveryQueue: Promise<void> = Promise.resolve();
const AUTOMATIC_DELIVERY_RETENTION_MS = 24 * 60 * 60_000;

function deliveryLedger(value: unknown): readonly DeliveryLedgerEntry[] {
  if (typeof value !== "string" || value.length > 20_000) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const entries: readonly unknown[] = parsed;
    return entries.flatMap((entry) => {
      if (
        !entry ||
        typeof entry !== "object" ||
        !("id" in entry) ||
        typeof entry.id !== "string" ||
        !("expiresAt" in entry) ||
        typeof entry.expiresAt !== "number" ||
        !Number.isFinite(entry.expiresAt)
      ) {
        return [];
      }
      return [{ id: entry.id, expiresAt: entry.expiresAt }];
    });
  } catch {
    return [];
  }
}

async function claimAutomaticDelivery(
  id: string,
  expiresAt: number,
): Promise<boolean> {
  const now = Date.now();
  if (expiresAt <= now) return false;
  const current = deliveryLedger(
    game.settings.get(SYSTEM_ID, PENDING_INTERACTION_DELIVERY_LEDGER),
  ).filter((entry) => entry.expiresAt > now);
  if (current.some((entry) => entry.id === id)) return false;
  const next = [
    ...current,
    {
      expiresAt: Math.max(expiresAt, now + AUTOMATIC_DELIVERY_RETENTION_MS),
      id,
    },
  ].slice(-100);
  await game.settings.set(
    SYSTEM_ID,
    PENDING_INTERACTION_DELIVERY_LEDGER,
    JSON.stringify(next),
  );
  return true;
}

export async function registerFoundryPendingInteraction(
  options: RegisterD6PendingInteractionOptions,
  delivery: {
    readonly automaticEligible?: boolean;
    readonly forceOpen?: boolean;
  } = {},
): Promise<void> {
  const { created } = registerD6PendingInteraction(options);
  if (!created || !options.reopen) return;
  if (delivery.forceOpen === true) {
    await reopenD6PendingInteraction(options.id);
    return;
  }
  if (
    delivery.automaticEligible !== true ||
    !booleanSetting(SHARED_SETTING_KEYS.autoOpenPendingPrompts, false)
  ) {
    return;
  }
  const expiresAt = options.expiresAt ?? Date.now() + 24 * 60 * 60_000;
  const scheduled = automaticDeliveryQueue.then(async () => {
    if (await claimAutomaticDelivery(options.id, expiresAt)) {
      await reopenD6PendingInteraction(options.id);
    }
  });
  automaticDeliveryQueue = scheduled.catch(() => undefined);
  await scheduled;
}

export async function resetFoundryPendingInteractionDeliveryForTests(): Promise<void> {
  await automaticDeliveryQueue.catch(() => undefined);
  automaticDeliveryQueue = Promise.resolve();
}
