import { acknowledgeDestinyDamage } from "./destiny-damage";
import { record } from "./sheets/values";
import { SYSTEM_ID } from "../constants";
import {
  registerD6PendingInteraction,
  resolveD6PendingInteraction,
  setD6PendingInteractionStatus,
  type RegisterD6PendingInteractionOptions,
} from "../application/pending-interactions";
import {
  destinyOutboxCount,
  replayDestinyOutbox,
  destinyEnabled,
  destinyPrimaryGM,
  destinyPrivateView,
  destinyPublicState,
  refreshDestinyView,
  requestDestiny,
  subscribeDestiny,
} from "./destiny-service";
import {
  confirmDestiny,
  destinyText,
  destinyWorkspace,
} from "./destiny-workspace";

const registered = new Map<string, { createdAt: number; controller: string }>();
async function recoverActivation(id: string): Promise<void> {
  const state = await refreshDestinyView();
  const t = state.temptations[id];
  if (!t) return;
  if (!game.user?.isGM) {
    const actor = game.actors?.get(t.actorId);
    if (
      !t.completed &&
      t.plan &&
      actor?.isOwner &&
      t.userId === game.user?.id &&
      (await confirmDestiny(
        destinyText("ResumeActivation"),
        destinyText("ResumeActivationHelp"),
      ))
    ) {
      const { executeExtraordinaryPowerRollPlan } =
        await import("./extraordinary-power-service");
      await executeExtraordinaryPowerRollPlan(actor, t.plan);
    } else await destinyWorkspace.open("history");
    return;
  }
  if (t.status === "failed" && !t.adjudicated) {
    if (
      await confirmDestiny(
        destinyText("Adjudicate"),
        destinyText("AdjudicateHelp"),
      )
    )
      await requestDestiny({ kind: "adjudicate", activationId: id });
    return;
  }
  if (t.status === "rolling") {
    const entered = await foundry.applications.api.DialogV2.wait<{
      die: number;
      reason: string;
    } | null>({
      classes: ["d6e2", "od6roll-dialog"],
      window: { title: destinyText("RecoverTemptation") },
      modal: true,
      rejectClose: false,
      content: `<p>${destinyText("RecoverTemptationHelp")}</p><label>${destinyText("OriginalDie")}<input name="originalDie" type="number" min="1" max="6" step="1" required></label><label>${destinyText("RecoveryReason")}<textarea name="recoveryReason" maxlength="2000" required></textarea></label>`,
      buttons: [
        { action: "cancel", label: destinyText("back"), callback: () => null },
        {
          action: "recover",
          label: destinyText("RecoverRecordedDie"),
          callback: (_e, b) => {
            const die = b.form?.elements.namedItem("originalDie");
            const reason = b.form?.elements.namedItem("recoveryReason");
            return die instanceof HTMLInputElement &&
              reason instanceof HTMLTextAreaElement
              ? { die: die.valueAsNumber, reason: reason.value }
              : null;
          },
        },
      ],
    });
    if (entered)
      await requestDestiny({
        kind: "recover-temptation",
        activationId: id,
        ...entered,
      });
    return;
  }
  if (!t.completed) {
    const reason = await foundry.applications.api.DialogV2.wait<string | null>({
      classes: ["d6e2", "od6roll-dialog"],
      window: { title: destinyText("CloseInterruptedActivation") },
      modal: true,
      rejectClose: false,
      content: `<p>${destinyText("CloseInterruptedActivationHelp")}</p><label>${destinyText("RecoveryReason")}<textarea name="recoveryReason" maxlength="2000" required></textarea></label>`,
      buttons: [
        { action: "cancel", label: destinyText("back"), callback: () => null },
        {
          action: "close",
          label: destinyText("CloseInterruptedActivation"),
          callback: (_e, b) => {
            const field = b.form?.elements.namedItem("recoveryReason");
            return field instanceof HTMLTextAreaElement ? field.value : null;
          },
        },
      ],
    });
    if (reason)
      await requestDestiny({ kind: "abandon-power", activationId: id, reason });
  }
}

export function registerDestinyPending(): void {
  const sync = () => {
    const desired = new Set<string>();
    const state = destinyPrivateView();
    const shared = destinyPublicState();
    const gm = game.user?.isGM === true;
    const primary = destinyPrimaryGM();
    const add = (
      key: string,
      options: Omit<RegisterD6PendingInteractionOptions, "id" | "createdAt">,
      failed = false,
    ) => {
      const id = `destiny:${key}`;
      desired.add(id);
      const existing = registered.get(id);
      if (existing && existing.controller !== options.controllerUserId)
        resolveD6PendingInteraction(id);
      const createdAt = existing?.createdAt ?? Date.now();
      registered.set(id, { createdAt, controller: options.controllerUserId });
      registerD6PendingInteraction({ ...options, id, createdAt });
      if (failed) setD6PendingInteractionStatus(id, "failed");
    };
    if (destinyEnabled() && game.user) {
      if (destinyOutboxCount() > 0)
        add(`outbox:${game.user.id}`, {
          kind: "destiny-recovery",
          label: destinyText("RetrySavedRequests"),
          controllerUserId: game.user.id,
          reopen: async () => {
            await replayDestinyOutbox();
            await refreshDestinyView();
            return "dismissed";
          },
        });
      if (
        shared.status === "awaiting-roll" &&
        (gm || shared.nominatedUserId === game.user.id)
      )
        add(`session:${shared.sessionId}`, {
          kind: "destiny-session",
          label: destinyText("rollSession"),
          controllerUserId: shared.nominatedUserId,
          reopen: async () => {
            await destinyWorkspace.open("session");
            return "dismissed";
          },
        });
      for (const p of Object.values(state?.proposals ?? {})) {
        if (!["pending", "revision", "delivering"].includes(p.status)) continue;
        add(
          `proposal:${p.id}`,
          {
            kind: "destiny-review",
            label: destinyText(
              p.status === "revision" ? "reviseProposal" : "gmReview",
            ),
            controllerUserId: gm ? (primary?.id ?? game.user.id) : p.userId,
            actorId: p.actorId,
            actorName:
              game.actors?.get(p.actorId)?.name ?? destinyText("MissingActor"),
            subjectLabel: p.request,
            reopen: async () => {
              await destinyWorkspace.open(
                !gm && p.status === "revision" ? "proposal" : "pending",
                "",
                p.id,
              );
              return "dismissed";
            },
            ...(p.status === "delivering"
              ? {}
              : {
                  cancel: async () => {
                    await requestDestiny({ kind: "cancel", proposalId: p.id });
                  },
                }),
          },
          p.status === "delivering",
        );
      }
      if (gm)
        for (const actor of game.actors?.contents ?? [])
          for (const [id, value] of Object.entries(
            record(actor.getFlag(SYSTEM_ID, "destinyDamage")),
          )) {
            if (record(value).status !== "applying") continue;
            add(
              `damage:${actor.id}:${id}`,
              {
                kind: "destiny-recovery",
                label: destinyText("DamageRecovery"),
                controllerUserId: game.user.id,
                actorId: actor.id,
                actorName: actor.name,
                reopen: async () => {
                  const reason = await foundry.applications.api.DialogV2.wait<
                    string | null
                  >({
                    classes: ["d6e2", "od6roll-dialog"],
                    window: { title: destinyText("DamageRecovery") },
                    modal: true,
                    rejectClose: false,
                    content: `<p>${destinyText("DamageRecoveryHelp")}</p><label>${destinyText("RecoveryReason")}<textarea name="reason" maxlength="2000" required></textarea></label>`,
                    buttons: [
                      {
                        action: "cancel",
                        label: destinyText("back"),
                        callback: () => null,
                      },
                      {
                        action: "confirm",
                        label: destinyText("AcknowledgeCurrentHealth"),
                        callback: (_e, b) => {
                          const field = b.form?.elements.namedItem("reason");
                          return field instanceof HTMLTextAreaElement
                            ? field.value
                            : null;
                        },
                      },
                    ],
                  });
                  if (reason) await acknowledgeDestinyDamage(actor, id, reason);
                  return "dismissed";
                },
              },
              true,
            );
          }
      for (const t of Object.values(state?.temptations ?? {})) {
        if (
          t.adjudicated ||
          ((t.status === "clear" || t.status === "resisted") && t.completed)
        )
          continue;
        if (t.status === "sampled" && !Object.keys(t.rollRequests ?? {}).length)
          continue;
        add(
          `activation:${t.id}`,
          {
            kind: "destiny-recovery",
            label: destinyText(
              t.status === "failed" ? "Adjudicate" : "ActivationRecovery",
            ),
            actorId: t.actorId,
            actorName:
              game.actors?.get(t.actorId)?.name ?? destinyText("MissingActor"),
            controllerUserId: gm ? (primary?.id ?? game.user.id) : t.userId,
            reopen: async () => {
              await recoverActivation(t.id);
              return "dismissed";
            },
          },
          t.status === "failed" ||
            t.status === "applying" ||
            t.status === "rolling",
        );
      }
    }
    for (const id of registered.keys())
      if (!desired.has(id)) {
        resolveD6PendingInteraction(id);
        registered.delete(id);
      }
  };
  subscribeDestiny(sync);
  Hooks.once("ready", sync);
  Hooks.on("updateUser", sync);
  Hooks.on("updateActor", sync);
}
