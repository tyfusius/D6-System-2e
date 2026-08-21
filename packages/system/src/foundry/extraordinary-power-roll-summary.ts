import type { D6RollMode, D6RollResultV1 } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";

interface SummaryUser {
  readonly id: string;
  readonly isGM: boolean;
}

export interface ExtraordinaryPowerSummaryRow {
  readonly difficulty?: number;
  readonly disclosed: boolean;
  readonly label?: string;
  readonly status?: "failed" | "interrupted" | "succeeded";
  readonly total?: number;
}

export interface ExtraordinaryPowerSummaryAudience {
  readonly allDisclosed: boolean;
  readonly recipientIds?: readonly string[];
  readonly rows: readonly ExtraordinaryPowerSummaryRow[];
}

export interface ExtraordinaryPowerSummaryPublication {
  readonly completedAudienceIndexes: Set<number>;
}

function canReceive(
  mode: D6RollMode,
  user: SummaryUser,
  rollerUserId: string,
): boolean {
  if (mode === "publicroll") return true;
  if (mode === "blindroll") return user.isGM;
  if (mode === "selfroll") return user.id === rollerUserId;
  return user.isGM || user.id === rollerUserId;
}

export function extraordinaryPowerSummaryAudiences(
  rolls: readonly D6RollResultV1[],
  steps: readonly Readonly<{ difficulty: number; label: string }>[],
  users: readonly SummaryUser[],
  rollerUserId: string,
): readonly ExtraordinaryPowerSummaryAudience[] {
  if (rolls.length > steps.length || steps.length === 0 || !rollerUserId) {
    throw new Error("D6E2.ExtraordinaryPower.SummaryInvalid");
  }
  const allPublic =
    rolls.length === steps.length &&
    rolls.every(({ request }) => request.rollMode === "publicroll");
  if (allPublic) {
    return [
      {
        allDisclosed: true,
        rows: steps.map((step, index) => ({
          difficulty: step.difficulty,
          disclosed: true,
          label: step.label,
          status: rolls[index]?.success === true ? "succeeded" : "failed",
          total: rolls[index]?.total ?? 0,
        })),
      },
    ];
  }

  const groups = new Map<
    string,
    { recipientIds: string[]; rows: ExtraordinaryPowerSummaryRow[] }
  >();
  for (const user of users) {
    const disclosed = steps.map((_, index) => {
      const roll = rolls[index];
      return roll
        ? canReceive(roll.request.rollMode, user, rollerUserId)
        : user.id === rollerUserId || user.isGM;
    });
    if (!disclosed.some(Boolean)) continue;
    const key = disclosed.map((value) => (value ? "1" : "0")).join("");
    const existing = groups.get(key);
    if (existing) {
      existing.recipientIds.push(user.id);
      continue;
    }
    groups.set(key, {
      recipientIds: [user.id],
      rows: steps.map((step, index) => {
        const roll = rolls[index];
        return disclosed[index]
          ? roll
            ? {
                difficulty: step.difficulty,
                disclosed: true,
                label: step.label,
                status: roll.success === true ? "succeeded" : "failed",
                total: roll.total,
              }
            : {
                difficulty: step.difficulty,
                disclosed: true,
                label: step.label,
                status: "interrupted",
              }
          : { disclosed: false };
      }),
    });
  }
  return [...groups.values()].map(({ recipientIds, rows }) => ({
    allDisclosed: rows.every(({ disclosed }) => disclosed),
    recipientIds: Object.freeze([...recipientIds]),
    rows: Object.freeze(rows),
  }));
}

export async function postExtraordinaryPowerRollSummary(
  actor: FoundryActorDocument,
  label: string,
  rolls: readonly D6RollResultV1[],
  steps: readonly Readonly<{ difficulty: number; label: string }>[],
  overallSuccess: boolean,
  resultStatus: "cancelled" | "completed",
  publication: ExtraordinaryPowerSummaryPublication = {
    completedAudienceIndexes: new Set<number>(),
  },
): Promise<void> {
  const rollerUserId = game.user?.id;
  const users = game.users?.contents;
  if (!rollerUserId || !users?.some(({ id }) => id === rollerUserId)) {
    throw new Error("D6E2.ExtraordinaryPower.SummaryInvalid");
  }
  const audiences = extraordinaryPowerSummaryAudiences(
    rolls,
    steps,
    users,
    rollerUserId,
  );
  for (const [audienceIndex, audience] of audiences.entries()) {
    if (publication.completedAudienceIndexes.has(audienceIndex)) continue;
    const content = await foundry.applications.handlebars.renderTemplate(
      `systems/${SYSTEM_ID}/templates/chat/extraordinary-power-roll-summary.hbs`,
      {
        actorLabel: actor.name,
        allDisclosed: audience.allDisclosed,
        label,
        outcomeLabel: audience.allDisclosed
          ? game.i18n.localize(
              resultStatus === "cancelled"
                ? "D6E2.ExtraordinaryPower.RollPlanCancelled"
                : overallSuccess
                  ? "D6E2.ExtraordinaryPower.RollPlanSucceeded"
                  : "D6E2.ExtraordinaryPower.RollPlanFailed",
            )
          : game.i18n.localize("D6E2.ExtraordinaryPower.RollPlanHidden"),
        resultCountLabel: audience.allDisclosed
          ? game.i18n.format("D6E2.ExtraordinaryPower.ResultCount", {
              count: audience.rows.filter(
                ({ status }) => status === "succeeded",
              ).length,
              total: steps.length,
            })
          : undefined,
        rows: audience.rows.map((row, index) => ({
          ...row,
          index: index + 1,
          restrictedClass: row.disclosed ? "" : "is-restricted",
          statusLabel: row.disclosed
            ? game.i18n.localize(
                `D6E2.ExtraordinaryPower.StepStatus.${row.status}`,
              )
            : game.i18n.localize("D6E2.ExtraordinaryPower.SummaryRestricted"),
        })),
      },
    );
    await ChatMessage.create({
      content,
      flags: {
        [SYSTEM_ID]: {
          extraordinaryPowerRollSummary: {
            contractVersion: 1,
            frameworkId:
              rolls[0]?.request.context?.extraordinaryPower?.frameworkId ?? "",
            rolledCount: rolls.length,
            stepCount: steps.length,
          },
        },
      },
      ...(audience.recipientIds ? { whisper: [...audience.recipientIds] } : {}),
      speaker: ChatMessage.getSpeaker({ actor }),
    });
    publication.completedAudienceIndexes.add(audienceIndex);
  }
}
