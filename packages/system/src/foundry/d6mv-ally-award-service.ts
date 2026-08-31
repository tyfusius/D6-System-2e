import {
  D6_ROLL_CONTRACT_VERSION,
  type D6RollResultV1,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import {
  currentTerminology,
  terminologyResourceLabel,
} from "../registries/terminology";
import { currentMetaCurrencyRuntimeStrategy } from "../settings/roll-outcome";
import { foundryRandomId } from "./foundry-random-id";
import { transactActorHeroPoints } from "./hero-point-service";

export interface D6MvAllyAwardFlagV1 {
  readonly amount: number;
  readonly authorityUserId: string;
  readonly recipientActorId: string;
  readonly recipientName: string;
  readonly resourceLabel: string;
  readonly status: "applied";
  readonly transactionId: string;
  readonly version: 1;
}

export interface D6MvAllyAwardProjection {
  readonly flag: D6MvAllyAwardFlagV1 | null;
  readonly showPending: boolean;
  readonly showReceipt: boolean;
}

function appliedAllyAwardFlag(value: unknown): D6MvAllyAwardFlagV1 | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<D6MvAllyAwardFlagV1>;
  return candidate.status === "applied" &&
    candidate.version === 1 &&
    Number.isSafeInteger(candidate.amount) &&
    Number(candidate.amount) > 0 &&
    typeof candidate.authorityUserId === "string" &&
    typeof candidate.recipientActorId === "string" &&
    typeof candidate.recipientName === "string" &&
    typeof candidate.resourceLabel === "string" &&
    typeof candidate.transactionId === "string"
    ? (candidate as D6MvAllyAwardFlagV1)
    : null;
}

export function d6MvAllyAwardProjection(
  value: unknown,
  viewer: { readonly isGM: boolean; readonly ownsRecipient: boolean },
): D6MvAllyAwardProjection {
  const flag = appliedAllyAwardFlag(value);
  return Object.freeze({
    flag,
    showPending: flag === null,
    showReceipt: flag !== null && (viewer.isGM || viewer.ownsRecipient),
  });
}

export function currentD6MvMetaCurrencyLabel(): string {
  const terminology = currentTerminology();
  return currentMetaCurrencyRuntimeStrategy().id ===
    "open-d6.meta-currency.character-and-fate-points"
    ? terminologyResourceLabel(terminology, "fatePoints")
    : terminologyResourceLabel(terminology, "heroPoints");
}

function rollResult(
  message: FoundryChatMessageDocument,
): D6RollResultV1 | null {
  const value = message.getFlag(SYSTEM_ID, "roll");
  return typeof value === "object" &&
    value !== null &&
    "contractVersion" in value &&
    value.contractVersion === D6_ROLL_CONTRACT_VERSION
    ? (value as D6RollResultV1)
    : null;
}

export async function assignD6MvAllyAward(
  message: FoundryChatMessageDocument,
  recipientActorId: string,
): Promise<D6MvAllyAwardFlagV1> {
  if (game.user?.isGM !== true) throw new Error("D6E2.Roll.D6MV.GMRequired");
  const existing = appliedAllyAwardFlag(
    message.getFlag(SYSTEM_ID, "d6mvAllyAward"),
  );
  if (existing) return existing;
  const result = rollResult(message);
  const amount = result?.d6mv?.allyHeroPointAward ?? 0;
  if (amount <= 0) throw new Error("D6E2.Roll.D6MV.AllyAwardUnavailable");
  const recipient = game.actors?.get(recipientActorId);
  if (
    !recipient ||
    !["character", "creature", "npc"].includes(recipient.type)
  ) {
    throw new Error("D6E2.Roll.D6MV.AllyRecipientMissing");
  }
  const flag = Object.freeze({
    amount,
    authorityUserId: game.user.id,
    recipientActorId: recipient.id,
    recipientName: recipient.name,
    resourceLabel: currentD6MvMetaCurrencyLabel(),
    status: "applied" as const,
    transactionId: foundryRandomId(),
    version: 1 as const,
  });
  await transactActorHeroPoints(recipient, 0, amount);
  try {
    await message.update({ [`flags.${SYSTEM_ID}.d6mvAllyAward`]: flag });
  } catch (error) {
    await transactActorHeroPoints(recipient, amount, 0);
    throw error;
  }
  return flag;
}
